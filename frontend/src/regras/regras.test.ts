import { describe, expect, it } from "vitest";
import { cobrancaPaga, estoqueBaixo, faturamentoDoMes, seloDaCobranca, situacaoDoPagamento, tomDaAcao } from ".";

describe("situacaoDoPagamento", () => {
  const hoje = "2026-09-28";

  it("pago quando tem data de pagamento", () => {
    expect(situacaoDoPagamento({ pagoEm: "2026-09-01", vencimento: "2026-08-01" }, hoje)).toBe("pago");
  });

  it("atrasado quando venceu antes de hoje e não foi pago", () => {
    expect(situacaoDoPagamento({ pagoEm: null, vencimento: "2026-09-27" }, hoje)).toBe("atrasado");
  });

  it("a vencer quando vence hoje ou depois", () => {
    expect(situacaoDoPagamento({ pagoEm: null, vencimento: "2026-09-28" }, hoje)).toBe("pendente");
    expect(situacaoDoPagamento({ pagoEm: null, vencimento: "2026-10-10" }, hoje)).toBe("pendente");
  });
});

describe("faturamentoDoMes", () => {
  const pagamentos = [
    { pagoEm: "2026-09-02", valor: 100 },
    { pagoEm: "2026-09-28", valor: 50.5 },
    { pagoEm: "2026-08-31", valor: 999 }, // mês anterior
    { pagoEm: null, valor: 300 }, // ainda não pago
  ];

  it("soma só o que foi recebido no mês", () => {
    expect(faturamentoDoMes(pagamentos, "2026-09")).toBe(150.5);
  });

  it("é zero quando nada foi recebido no mês", () => {
    expect(faturamentoDoMes(pagamentos, "2026-10")).toBe(0);
  });
});

describe("estoqueBaixo", () => {
  it("avisa quando a quantidade chega ao mínimo", () => {
    expect(estoqueBaixo({ quantidade: 2, estoqueMinimo: 2 })).toBe(true);
    expect(estoqueBaixo({ quantidade: 1, estoqueMinimo: 2 })).toBe(true);
  });

  it("não avisa acima do mínimo", () => {
    expect(estoqueBaixo({ quantidade: 3, estoqueMinimo: 2 })).toBe(false);
  });
});

describe("tomDaAcao", () => {
  it("vermelho para exclusões e estornos", () => {
    expect(tomDaAcao("excluiu")).toBe("danger");
    expect(tomDaAcao("estornou pagamento")).toBe("danger");
  });

  it("verde para recebimentos, amarelo para alterações", () => {
    expect(tomDaAcao("recebeu pagamento")).toBe("ok");
    expect(tomDaAcao("alterou")).toBe("warn");
  });

  it("laranja para o resto", () => {
    expect(tomDaAcao("criou")).toBe("accent");
  });
});

describe("cobranças do Asaas", () => {
  it("traduz os status conhecidos", () => {
    expect(seloDaCobranca("OVERDUE")).toEqual({ label: "atrasado", tone: "danger" });
    expect(seloDaCobranca("RECEIVED_IN_CASH")).toEqual({ label: "pago (manual)", tone: "ok" });
  });

  it("mostra status desconhecido em minúsculas, sem cor", () => {
    expect(seloDaCobranca("AWAITING_RISK_ANALYSIS")).toEqual({ label: "awaiting_risk_analysis", tone: "muted" });
  });

  it("sabe quais status contam como pago", () => {
    expect(cobrancaPaga("CONFIRMED")).toBe(true);
    expect(cobrancaPaga("PENDING")).toBe(false);
  });
});
