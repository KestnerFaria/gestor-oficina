import { describe, expect, it } from "vitest";
import { api, auth, cenarioBasico, criarProduto, criarServico } from "./helpers";

async function abrirOS(ctx: Awaited<ReturnType<typeof cenarioBasico>>, extra: Record<string, unknown> = {}) {
  return api
    .post("/ordens")
    .set(auth(ctx.token))
    .send({ clienteId: ctx.cliente.id, veiculoId: ctx.veiculo.id, descricao: "barulho no motor", ...extra });
}

describe("criação de O.S.", () => {
  it("calcula o valor total com preços do servidor, não do front-end", async () => {
    const ctx = await cenarioBasico();
    const servico = await criarServico(ctx.token, { preco: 80.5 });
    const peca = await criarProduto(ctx.token, { precoVenda: 30 });

    const res = await abrirOS(ctx, {
      servicosIds: [servico.id],
      pecas: [{ produtoId: peca.id, quantidade: 2 }],
      valorTotal: 1, // tentativa de mandar preço pelo front — deve ser ignorada
    });

    expect(res.status).toBe(201);
    expect(res.body.valor_total).toBe(140.5);
    expect(res.body.status).toBe("orcamento");
  });

  it("aceita id de peça vindo como texto", async () => {
    const ctx = await cenarioBasico();
    const peca = await criarProduto(ctx.token, { precoVenda: 25 });

    const res = await abrirOS(ctx, { pecas: [{ produtoId: String(peca.id), quantidade: "2" }] });

    expect(res.body.valor_total).toBe(50);
  });

  it("dá baixa no estoque ao usar peças e devolve ao excluir a O.S.", async () => {
    const ctx = await cenarioBasico();
    const peca = await criarProduto(ctx.token, { quantidadeEstoque: 10 });

    const os = await abrirOS(ctx, { pecas: [{ produtoId: peca.id, quantidade: 3 }] });
    const depoisDeUsar = await api.get("/produtos").set(auth(ctx.token));
    expect(depoisDeUsar.body[0].quantidade_estoque).toBe(7);

    await api.delete(`/ordens/${os.body.id}`).set(auth(ctx.token));
    const depoisDeExcluir = await api.get("/produtos").set(auth(ctx.token));
    expect(depoisDeExcluir.body[0].quantidade_estoque).toBe(10);
  });

  it("numera as O.S. em sequência por oficina", async () => {
    const ctx = await cenarioBasico();
    const outra = await cenarioBasico();

    const primeira = await abrirOS(ctx);
    const segunda = await abrirOS(ctx);
    const daOutraOficina = await abrirOS(outra);

    expect(primeira.body.numero).toBe("0001");
    expect(segunda.body.numero).toBe("0002");
    expect(daOutraOficina.body.numero).toBe("0001");
  });

  // regressão: a numeração usava COUNT(*) + 1, então depois de excluir a
  // O.S. 0001 a próxima tentava ser 0002 de novo e quebrava com erro 500
  it("não repete número depois de excluir uma O.S.", async () => {
    const ctx = await cenarioBasico();
    const primeira = await abrirOS(ctx);
    await abrirOS(ctx);

    await api.delete(`/ordens/${primeira.body.id}`).set(auth(ctx.token));
    const nova = await abrirOS(ctx);

    expect(nova.status).toBe(201);
    expect(nova.body.numero).toBe("0003");
  });

  it("não repete número com várias O.S. criadas ao mesmo tempo", async () => {
    const ctx = await cenarioBasico();

    const respostas = await Promise.all(Array.from({ length: 5 }, () => abrirOS(ctx)));

    expect(respostas.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    const numeros = respostas.map((r) => r.body.numero).sort();
    expect(numeros).toEqual(["0001", "0002", "0003", "0004", "0005"]);
  });

  it("exige cliente, veículo e descrição", async () => {
    const ctx = await cenarioBasico();
    const res = await api.post("/ordens").set(auth(ctx.token)).send({ clienteId: ctx.cliente.id });
    expect(res.status).toBe(400);
  });

  it("recusa veículo que não é do cliente informado", async () => {
    const ctx = await cenarioBasico();
    const outroCliente = await api.post("/clientes").set(auth(ctx.token)).send({ nome: "Outro", telefone: "1" });

    const res = await api
      .post("/ordens")
      .set(auth(ctx.token))
      .send({ clienteId: outroCliente.body.id, veiculoId: ctx.veiculo.id, descricao: "x" });

    expect(res.status).toBe(400);
  });
});

describe("andamento da O.S.", () => {
  it("muda o status e registra na auditoria", async () => {
    const ctx = await cenarioBasico();
    const os = await abrirOS(ctx);

    const res = await api.patch(`/ordens/${os.body.id}/status`).set(auth(ctx.token)).send({ status: "em_andamento" });
    const auditoria = await api.get("/auditoria").set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("em_andamento");
    expect(auditoria.body[0].detalhe).toBe("status: em andamento");
  });

  it("recusa status inexistente", async () => {
    const ctx = await cenarioBasico();
    const os = await abrirOS(ctx);

    const res = await api.patch(`/ordens/${os.body.id}/status`).set(auth(ctx.token)).send({ status: "pronto" });
    expect(res.status).toBe(400);
  });

  it("lista as O.S. com serviços e peças agregados", async () => {
    const ctx = await cenarioBasico();
    const servico = await criarServico(ctx.token);
    const peca = await criarProduto(ctx.token);
    await abrirOS(ctx, { servicosIds: [servico.id], pecas: [{ produtoId: peca.id, quantidade: 1 }] });

    const res = await api.get("/ordens").set(auth(ctx.token));

    expect(res.body).toHaveLength(1);
    expect(res.body[0].servicos_ids).toEqual([servico.id]);
    expect(res.body[0].pecas_utilizadas).toEqual([{ produtoId: peca.id, nome: "Filtro de óleo", quantidade: 1, precoUnitario: 30 }]);
    expect(res.body[0].itens_servicos).toEqual([{ servicoId: servico.id, nome: "Troca de óleo", preco: 80 }]);
    expect(res.body[0].cliente_nome).toBe("João da Silva");
  });

  it("só o admin exclui O.S.", async () => {
    const ctx = await cenarioBasico();
    const os = await abrirOS(ctx);
    await api.post("/equipe").set(auth(ctx.token)).send({ nome: "At", email: "at@x.com", senha: "1", perfil: "atendente" });
    const atendente = await api.post("/auth/login-equipe").send({ email: "at@x.com", senha: "1" });

    const res = await api.delete(`/ordens/${os.body.id}`).set(auth(atendente.body.token));
    expect(res.status).toBe(403);
  });
});

// Os itens da O.S. guardam o preço do dia em que ela foi aberta. A tela e a
// impressão usavam o preço ATUAL do catálogo: depois de um reajuste, a O.S.
// antiga mostrava o item com o preço novo e o total com o preço antigo.
describe("preços congelados na O.S.", () => {
  it("mantém o preço do dia mesmo depois de reajustar o catálogo", async () => {
    const ctx = await cenarioBasico();
    const servico = await criarServico(ctx.token, { preco: 80 });
    const peca = await criarProduto(ctx.token, { precoVenda: 30 });
    await abrirOS(ctx, { servicosIds: [servico.id], pecas: [{ produtoId: peca.id, quantidade: 2 }] });

    await api.put(`/servicos/${servico.id}`).set(auth(ctx.token)).send({ nome: "Troca de óleo", preco: 100 });
    await api.put(`/produtos/${peca.id}`).set(auth(ctx.token)).send({ nome: "Filtro de óleo", precoVenda: 45, quantidadeEstoque: 8 });
    const [os] = (await api.get("/ordens").set(auth(ctx.token))).body;

    expect(os.valor_total).toBe(140);
    expect(os.itens_servicos[0].preco).toBe(80);
    expect(os.pecas_utilizadas[0].precoUnitario).toBe(30);
  });

  it("continua mostrando o item depois que ele sai do catálogo", async () => {
    const ctx = await cenarioBasico();
    const servico = await criarServico(ctx.token, { nome: "Alinhamento", preco: 60 });
    await abrirOS(ctx, { servicosIds: [servico.id] });

    await api.delete(`/servicos/${servico.id}`).set(auth(ctx.token));
    const [os] = (await api.get("/ordens").set(auth(ctx.token))).body;

    expect(os.itens_servicos).toEqual([{ servicoId: servico.id, nome: "Alinhamento", preco: 60 }]);
  });

  it("a O.S. recém-criada já volta com nome e preço dos itens", async () => {
    const ctx = await cenarioBasico();
    const servico = await criarServico(ctx.token, { preco: 80 });

    const res = await abrirOS(ctx, { servicosIds: [servico.id] });

    expect(res.body.itens_servicos).toEqual([{ servicoId: servico.id, nome: "Troca de óleo", preco: 80 }]);
    expect(res.body.cliente_nome).toBe("João da Silva");
  });

  it("não duplica itens quando a O.S. tem serviços e peças ao mesmo tempo", async () => {
    const ctx = await cenarioBasico();
    const s1 = await criarServico(ctx.token, { nome: "A", preco: 10 });
    const s2 = await criarServico(ctx.token, { nome: "B", preco: 20 });
    const p1 = await criarProduto(ctx.token, { nome: "P1" });
    const p2 = await criarProduto(ctx.token, { nome: "P2" });
    await abrirOS(ctx, { servicosIds: [s1.id, s2.id], pecas: [{ produtoId: p1.id, quantidade: 1 }, { produtoId: p2.id, quantidade: 1 }] });

    const [os] = (await api.get("/ordens").set(auth(ctx.token))).body;

    expect(os.servicos_ids).toHaveLength(2);
    expect(os.itens_servicos).toHaveLength(2);
    expect(os.pecas_utilizadas).toHaveLength(2);
  });
});
