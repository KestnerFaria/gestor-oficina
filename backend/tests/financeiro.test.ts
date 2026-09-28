import { describe, expect, it } from "vitest";
import { api, auth, cenarioBasico, criarServico } from "./helpers";

// Cria uma O.S. de R$ 200 com R$ 50 de sinal
async function osDeDuzentos() {
  const ctx = await cenarioBasico();
  const servico = await criarServico(ctx.token, { preco: 200 });
  const os = await api
    .post("/ordens")
    .set(auth(ctx.token))
    .send({ clienteId: ctx.cliente.id, veiculoId: ctx.veiculo.id, descricao: "revisão", servicosIds: [servico.id], sinal: 50 });
  return { ...ctx, os: os.body as { id: number; numero: string } };
}

describe("finalização da O.S.", () => {
  it("gera o pagamento do valor restante (total menos sinal)", async () => {
    const ctx = await osDeDuzentos();

    const res = await api
      .post(`/ordens/${ctx.os.id}/finalizar`)
      .set(auth(ctx.token))
      .send({ dataSaida: "2026-09-28", pago: true, forma: "pix" });
    const pagamentos = await api.get("/pagamentos").set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(pagamentos.body).toHaveLength(1);
    expect(pagamentos.body[0]).toMatchObject({ valor: 150, forma: "pix", pago_em: "2026-09-28" });
  });

  it("deixa o pagamento pendente quando não foi pago na entrega", async () => {
    const ctx = await osDeDuzentos();

    await api
      .post(`/ordens/${ctx.os.id}/finalizar`)
      .set(auth(ctx.token))
      .send({ dataSaida: "2026-09-28", pago: false, vencimento: "2026-10-10" });
    const pagamentos = await api.get("/pagamentos").set(auth(ctx.token));

    expect(pagamentos.body[0]).toMatchObject({ valor: 150, pago_em: null, vencimento: "2026-10-10" });
  });

  it("marca a O.S. como entregue", async () => {
    const ctx = await osDeDuzentos();
    await api.post(`/ordens/${ctx.os.id}/finalizar`).set(auth(ctx.token)).send({ dataSaida: "2026-09-28", pago: true, forma: "dinheiro" });

    const os = await api.get(`/ordens/${ctx.os.id}`).set(auth(ctx.token));

    expect(os.body.status).toBe("entregue");
    expect(os.body.data_saida).toBe("2026-09-28");
  });

  it("não gera pagamento quando o sinal já cobriu tudo", async () => {
    const ctx = await cenarioBasico();
    const servico = await criarServico(ctx.token, { preco: 100 });
    const os = await api
      .post("/ordens")
      .set(auth(ctx.token))
      .send({ clienteId: ctx.cliente.id, veiculoId: ctx.veiculo.id, descricao: "x", servicosIds: [servico.id], sinal: 100 });

    await api.post(`/ordens/${os.body.id}/finalizar`).set(auth(ctx.token)).send({ dataSaida: "2026-09-28", pago: true, forma: "pix" });
    const pagamentos = await api.get("/pagamentos").set(auth(ctx.token));

    expect(pagamentos.body).toHaveLength(0);
  });

  it("exige a data de saída", async () => {
    const ctx = await osDeDuzentos();
    const res = await api.post(`/ordens/${ctx.os.id}/finalizar`).set(auth(ctx.token)).send({ pago: true });
    expect(res.status).toBe(400);
  });
});

describe("pagamentos", () => {
  // regressão: datas vinham como "2026-10-10T00:00:00.000Z" e a tela
  // mostrava "10T00:00:00.000Z/10/2026"
  it("devolve as datas no formato AAAA-MM-DD", async () => {
    const ctx = await osDeDuzentos();
    const res = await api
      .post("/pagamentos")
      .set(auth(ctx.token))
      .send({ osId: ctx.os.id, valor: 100, vencimento: "2026-10-10" });

    expect(res.body.vencimento).toBe("2026-10-10");
    expect(res.body.vencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("registra recebimento e estorno", async () => {
    const ctx = await osDeDuzentos();
    const lancado = await api
      .post("/pagamentos")
      .set(auth(ctx.token))
      .send({ osId: ctx.os.id, valor: 100, vencimento: "2026-10-10" });

    const pago = await api.patch(`/pagamentos/${lancado.body.id}/pagar`).set(auth(ctx.token)).send({ forma: "cartao" });
    expect(pago.body.forma).toBe("cartao");
    expect(pago.body.pago_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const estornado = await api.patch(`/pagamentos/${lancado.body.id}/estornar`).set(auth(ctx.token));
    expect(estornado.body).toMatchObject({ pago_em: null, forma: null });
  });

  it("não lança pagamento em O.S. de outra oficina", async () => {
    const a = await cenarioBasico();
    const b = await osDeDuzentos();

    const res = await api.post("/pagamentos").set(auth(a.token)).send({ osId: b.os.id, valor: 1, vencimento: "2026-10-10" });
    expect(res.status).toBe(404);
  });

  it("exige O.S., valor e vencimento", async () => {
    const ctx = await osDeDuzentos();
    const res = await api.post("/pagamentos").set(auth(ctx.token)).send({ osId: ctx.os.id });
    expect(res.status).toBe(400);
  });
});

describe("despesas", () => {
  it("admin lança, lista e exclui despesas", async () => {
    const ctx = await cenarioBasico();

    const criada = await api
      .post("/despesas")
      .set(auth(ctx.token))
      .send({ descricao: "Aluguel", valor: 2500, categoria: "fixas", fixa: true, dataVencimento: "2026-10-05" });
    expect(criada.status).toBe(201);
    expect(criada.body.data_vencimento).toBe("2026-10-05");

    const lista = await api.get("/despesas").set(auth(ctx.token));
    expect(lista.body).toHaveLength(1);

    const excluida = await api.delete(`/despesas/${criada.body.id}`).set(auth(ctx.token));
    expect(excluida.status).toBe(204);
  });
});

describe("portal do cliente", () => {
  it("cliente vê apenas as próprias O.S. e pagamentos", async () => {
    const ctx = await osDeDuzentos();
    await api.put(`/clientes/${ctx.cliente.id}`).set(auth(ctx.token)).send({
      nome: "João da Silva",
      telefone: "11988887777",
      email: "joao@x.com",
      senha: "abc123",
    });
    const outroCliente = await api.post("/clientes").set(auth(ctx.token)).send({ nome: "Outro", telefone: "1" });
    const outroVeiculo = await api.post("/veiculos").set(auth(ctx.token)).send({ clienteId: outroCliente.body.id, placa: "zzz9999", modelo: "Uno" });
    await api
      .post("/ordens")
      .set(auth(ctx.token))
      .send({ clienteId: outroCliente.body.id, veiculoId: outroVeiculo.body.id, descricao: "não é do João" });
    await api.post(`/ordens/${ctx.os.id}/finalizar`).set(auth(ctx.token)).send({ dataSaida: "2026-09-28", pago: false });

    const login = await api.post("/auth/login-cliente").send({ email: "joao@x.com", senha: "abc123" });
    const ordens = await api.get("/portal/minhas-ordens").set(auth(login.body.token));
    const pagamentos = await api.get("/portal/meus-pagamentos").set(auth(login.body.token));

    expect(ordens.body).toHaveLength(1);
    expect(ordens.body[0].numero).toBe(ctx.os.numero);
    expect(pagamentos.body).toHaveLength(1);
  });
});
