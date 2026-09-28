import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelarAssinaturaAsaas,
  criarAssinaturaAsaas,
  criarClienteAsaas,
  listarCobrancasAssinaturaAsaas,
} from "../src/asaas";
import { pool } from "../src/db";
import { api, auth, criarOficina } from "./helpers";

// As funções do Asaas estão mockadas em tests/setup/each-file.ts.
// Aqui simulamos o Asaas funcionando.
function asaasNoAr() {
  vi.mocked(criarClienteAsaas).mockResolvedValue({ id: "cus_123" });
  vi.mocked(criarAssinaturaAsaas).mockResolvedValue({ id: "sub_123" });
}

async function statusDaAssinatura(oficinaId: number) {
  const r = await pool.query("SELECT status, asaas_subscription_id FROM assinaturas WHERE oficina_id = $1", [oficinaId]);
  return r.rows[0];
}

beforeEach(() => {
  vi.mocked(criarClienteAsaas).mockReset().mockRejectedValue(new Error("Asaas indisponível (mock)"));
  vi.mocked(criarAssinaturaAsaas).mockReset().mockRejectedValue(new Error("Asaas indisponível (mock)"));
  vi.mocked(cancelarAssinaturaAsaas).mockClear();
});

describe("cadastro com o Asaas funcionando", () => {
  it("inicia o teste grátis de 10 dias", async () => {
    asaasNoAr();
    const { oficinaId } = await criarOficina();

    expect(await statusDaAssinatura(oficinaId)).toEqual({ status: "trial", asaas_subscription_id: "sub_123" });

    const primeiraCobranca = vi.mocked(criarAssinaturaAsaas).mock.calls[0]![0].nextDueDate;
    const daquiDezDias = new Date();
    daquiDezDias.setDate(daquiDezDias.getDate() + 10);
    expect(primeiraCobranca).toBe(daquiDezDias.toISOString().slice(0, 10));
  });
});

describe("configurar assinatura depois (tela dados da oficina)", () => {
  // regressão: a rota consultava usuarios.telefone, coluna que não existe,
  // e a falha derrubava o servidor inteiro
  it("funciona para uma oficina que ficou pendente no cadastro", async () => {
    const { token, oficinaId } = await criarOficina(); // Asaas fora do ar no cadastro
    asaasNoAr();

    const res = await api.post("/oficinas/minha/assinatura/configurar").set(auth(token));

    expect(res.status).toBe(200);
    expect(await statusDaAssinatura(oficinaId)).toMatchObject({ status: "trial" });
    // usa o telefone da oficina (não existe telefone no usuário)
    expect(vi.mocked(criarClienteAsaas).mock.calls[0]![0].telefone).toBe("11999990000");
  });

  it("manda a data da 1ª cobrança no formato AAAA-MM-DD", async () => {
    const { token } = await criarOficina();
    asaasNoAr();

    await api.post("/oficinas/minha/assinatura/configurar").set(auth(token));

    expect(vi.mocked(criarAssinaturaAsaas).mock.calls[0]![0].nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reativação de assinatura cancelada cobra a partir de hoje (sem novo teste grátis)", async () => {
    const { token, oficinaId } = await criarOficina();
    await pool.query("UPDATE assinaturas SET status = 'cancelada' WHERE oficina_id = $1", [oficinaId]);
    asaasNoAr();

    await api.post("/oficinas/minha/assinatura/configurar").set(auth(token));

    const hoje = new Date().toISOString().slice(0, 10);
    expect(vi.mocked(criarAssinaturaAsaas).mock.calls[0]![0].nextDueDate).toBe(hoje);
  });

  it("devolve erro amigável quando o Asaas recusa", async () => {
    const { token } = await criarOficina();

    const res = await api.post("/oficinas/minha/assinatura/configurar").set(auth(token));

    expect(res.status).toBe(400);
    expect(res.body.erro).toEqual(expect.any(String));
  });
});

describe("cancelamento e bloqueio", () => {
  it("cancelar bloqueia a equipe com status 402, mas libera a tela da oficina", async () => {
    asaasNoAr();
    const { token } = await criarOficina();

    await api.post("/oficinas/minha/assinatura/cancelar").set(auth(token));
    const rotaComum = await api.get("/clientes").set(auth(token));
    const telaDaOficina = await api.get("/oficinas/minha/assinatura").set(auth(token));

    expect(vi.mocked(cancelarAssinaturaAsaas)).toHaveBeenCalledWith("sub_123");
    expect(rotaComum.status).toBe(402);
    expect(rotaComum.body.erro).toBe("assinatura_pendente");
    expect(telaDaOficina.status).toBe(200);
  });

  it("lista as cobranças da assinatura, mais recentes primeiro", async () => {
    asaasNoAr();
    const { token } = await criarOficina();
    vi.mocked(listarCobrancasAssinaturaAsaas).mockResolvedValueOnce({
      data: [
        { id: "p1", dueDate: "2026-09-01", value: 170, status: "RECEIVED", billingType: "PIX", invoiceUrl: "u1", paymentDate: "2026-09-01" },
        { id: "p2", dueDate: "2026-10-01", value: 170, status: "PENDING", billingType: "UNDEFINED", invoiceUrl: "u2" },
      ],
    });

    const res = await api.get("/oficinas/minha/assinatura/cobrancas").set(auth(token));

    expect(res.body.map((c: { id: string }) => c.id)).toEqual(["p2", "p1"]);
    expect(res.body[1]).toMatchObject({ pagoEm: "2026-09-01", linkPagamento: "u1" });
  });
});

describe("webhook do Asaas", () => {
  async function oficinaEmTrial() {
    asaasNoAr();
    return criarOficina();
  }

  it("recusa chamada sem o token correto", async () => {
    const res = await api.post("/webhooks/asaas").set("asaas-access-token", "errado").send({ event: "PAYMENT_RECEIVED" });
    expect(res.status).toBe(401);
  });

  it("pagamento confirmado ativa a assinatura", async () => {
    const { oficinaId } = await oficinaEmTrial();

    await api
      .post("/webhooks/asaas")
      .set("asaas-access-token", "token-webhook-teste")
      .send({ event: "PAYMENT_RECEIVED", payment: { subscription: "sub_123" } });

    await vi.waitFor(async () => expect((await statusDaAssinatura(oficinaId)).status).toBe("ativa"));
  });

  it("pagamento vencido bloqueia a equipe", async () => {
    const { token, oficinaId } = await oficinaEmTrial();

    await api
      .post("/webhooks/asaas")
      .set("asaas-access-token", "token-webhook-teste")
      .send({ event: "PAYMENT_OVERDUE", payment: { subscription: "sub_123" } });
    await vi.waitFor(async () => expect((await statusDaAssinatura(oficinaId)).status).toBe("atrasada"));

    const res = await api.get("/clientes").set(auth(token));
    expect(res.status).toBe(402);
  });

  it("ignora eventos que o sistema não usa", async () => {
    const { oficinaId } = await oficinaEmTrial();

    const res = await api
      .post("/webhooks/asaas")
      .set("asaas-access-token", "token-webhook-teste")
      .send({ event: "PAYMENT_CREATED", payment: { subscription: "sub_123" } });

    expect(res.status).toBe(200);
    expect((await statusDaAssinatura(oficinaId)).status).toBe("trial");
  });
});
