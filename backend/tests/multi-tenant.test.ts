import { describe, expect, it } from "vitest";
import { api, auth, cenarioBasico, criarCliente, criarOficina, criarProduto } from "./helpers";

// O ponto mais crítico de um SaaS multi-tenant: uma oficina NUNCA pode
// ver ou mexer em dados de outra.
describe("isolamento entre oficinas", () => {
  it("cada oficina só lista os próprios clientes", async () => {
    const a = await criarOficina("A");
    const b = await criarOficina("B");
    await criarCliente(a.token, { nome: "Cliente da A" });
    await criarCliente(b.token, { nome: "Cliente da B" });

    const res = await api.get("/clientes").set(auth(a.token));

    expect(res.body.map((c: { nome: string }) => c.nome)).toEqual(["Cliente da A"]);
  });

  it("não deixa editar nem excluir cliente de outra oficina", async () => {
    const a = await criarOficina("A");
    const b = await criarOficina("B");
    const clienteDaB = await criarCliente(b.token);

    const editar = await api.put(`/clientes/${clienteDaB.id}`).set(auth(a.token)).send({ nome: "Hackeado", telefone: "1" });
    const excluir = await api.delete(`/clientes/${clienteDaB.id}`).set(auth(a.token));

    expect(editar.status).toBe(404);
    expect(excluir.status).toBe(404);
  });

  it("não deixa cadastrar veículo em cliente de outra oficina", async () => {
    const a = await criarOficina("A");
    const b = await criarOficina("B");
    const clienteDaB = await criarCliente(b.token);

    const res = await api
      .post("/veiculos")
      .set(auth(a.token))
      .send({ clienteId: clienteDaB.id, placa: "XYZ1234", modelo: "Uno" });

    expect(res.status).toBe(404);
  });

  it("não deixa abrir O.S. com cliente e veículo de outra oficina", async () => {
    const a = await criarOficina("A");
    const b = await cenarioBasico();

    const res = await api
      .post("/ordens")
      .set(auth(a.token))
      .send({ clienteId: b.cliente.id, veiculoId: b.veiculo.id, descricao: "teste" });

    expect(res.status).toBe(400);
  });

  it("ignora peças de outra oficina ao calcular a O.S.", async () => {
    const a = await cenarioBasico();
    const b = await criarOficina("B");
    const pecaDaB = await criarProduto(b.token, { precoVenda: 999, quantidadeEstoque: 5 });

    const res = await api
      .post("/ordens")
      .set(auth(a.token))
      .send({
        clienteId: a.cliente.id,
        veiculoId: a.veiculo.id,
        descricao: "tentando usar peça alheia",
        pecas: [{ produtoId: pecaDaB.id, quantidade: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.valor_total).toBe(0);
    // o estoque da outra oficina não foi tocado
    const estoqueB = await api.get("/produtos").set(auth(b.token));
    expect(estoqueB.body[0].quantidade_estoque).toBe(5);
  });

  it("não deixa ver O.S. de outra oficina", async () => {
    const a = await criarOficina("A");
    const b = await cenarioBasico();
    const os = await api
      .post("/ordens")
      .set(auth(b.token))
      .send({ clienteId: b.cliente.id, veiculoId: b.veiculo.id, descricao: "da B" });

    const res = await api.get(`/ordens/${os.body.id}`).set(auth(a.token));
    expect(res.status).toBe(404);
  });

  it("não deixa registrar alerta de WhatsApp para cliente de outra oficina", async () => {
    const a = await criarOficina("A");
    const b = await cenarioBasico();

    const res = await api
      .post("/alertas-whatsapp")
      .set(auth(a.token))
      .send({ clienteId: b.cliente.id, veiculoId: b.veiculo.id });

    expect(res.status).toBe(404);
  });
});

describe("perfis de acesso", () => {
  async function loginComPerfil(perfil: "atendente" | "mecanico") {
    const oficina = await criarOficina();
    const email = `${perfil}@x.com`;
    await api.post("/equipe").set(auth(oficina.token)).send({ nome: perfil, email, senha: "123", perfil });
    const login = await api.post("/auth/login-equipe").send({ email, senha: "123" });
    return login.body.token as string;
  }

  it("mecânico não acessa o financeiro", async () => {
    const token = await loginComPerfil("mecanico");
    expect((await api.get("/pagamentos").set(auth(token))).status).toBe(403);
  });

  it("atendente acessa pagamentos, mas não despesas nem auditoria", async () => {
    const token = await loginComPerfil("atendente");
    expect((await api.get("/pagamentos").set(auth(token))).status).toBe(200);
    expect((await api.get("/despesas").set(auth(token))).status).toBe(403);
    expect((await api.get("/auditoria").set(auth(token))).status).toBe(403);
  });

  it("só o admin gerencia a equipe", async () => {
    const token = await loginComPerfil("atendente");
    const res = await api.post("/equipe").set(auth(token)).send({ nome: "X", email: "x@x.com", senha: "1" });
    expect(res.status).toBe(403);
  });

  it("cliente do portal não acessa rotas da equipe", async () => {
    const { token } = await criarOficina();
    await criarCliente(token, { email: "c@x.com", senha: "abc" });
    const login = await api.post("/auth/login-cliente").send({ email: "c@x.com", senha: "abc" });

    const res = await api.get("/clientes").set(auth(login.body.token));
    expect(res.status).toBe(403);
  });
});

describe("equipe", () => {
  it("respeita o limite de 3 acessos por oficina", async () => {
    const { token } = await criarOficina();
    await api.post("/equipe").set(auth(token)).send({ nome: "B", email: "b@x.com", senha: "1" });
    await api.post("/equipe").set(auth(token)).send({ nome: "C", email: "c@x.com", senha: "1" });

    const quarto = await api.post("/equipe").set(auth(token)).send({ nome: "D", email: "d@x.com", senha: "1" });

    expect(quarto.status).toBe(400);
    expect(quarto.body.erro).toContain("limite");
  });

  it("não deixa remover o último admin", async () => {
    const { token } = await criarOficina();
    const equipe = await api.get("/equipe").set(auth(token));

    const res = await api.delete(`/equipe/${equipe.body[0].id}`).set(auth(token));
    expect(res.status).toBe(400);
  });

  it("recusa perfil inválido", async () => {
    const { token } = await criarOficina();
    const res = await api.post("/equipe").set(auth(token)).send({ nome: "X", email: "x@x.com", senha: "1", perfil: "dono" });
    expect(res.status).toBe(400);
  });
});
