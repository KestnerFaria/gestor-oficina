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
    expect(res.body[0].pecas_utilizadas).toEqual([{ produtoId: peca.id, quantidade: 1 }]);
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
