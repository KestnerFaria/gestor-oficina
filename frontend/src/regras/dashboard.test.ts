import { describe, expect, it } from "vitest";
import type { Cliente, Ordem, Pagamento, Servico, Veiculo } from "../api";
import { clientesSemTrocaDeOleo, historicoDeMotor, linkWhatsapp, mesesDesde, resumoDoDia, totaisPorForma } from ".";

const agora = new Date("2026-09-28T12:00:00-03:00");

describe("mesesDesde", () => {
  it("conta meses completos", () => {
    expect(mesesDesde("2026-03-28T10:00:00", agora)).toBe(6);
    expect(mesesDesde("2026-03-29T10:00:00", agora)).toBe(5); // ainda falta um dia
  });

  it("devolve null sem data e nunca é negativo", () => {
    expect(mesesDesde(null, agora)).toBeNull();
    expect(mesesDesde("2026-12-01T00:00:00", agora)).toBe(0);
  });
});

describe("linkWhatsapp", () => {
  it("limpa o telefone e adiciona o 55", () => {
    expect(linkWhatsapp("(11) 98888-7777", "oi")).toBe("https://wa.me/5511988887777?text=oi");
  });

  it("não duplica o 55 e codifica a mensagem", () => {
    expect(linkWhatsapp("5511988887777", "olá, tudo bem?")).toBe("https://wa.me/5511988887777?text=ol%C3%A1%2C%20tudo%20bem%3F");
  });
});

describe("clientes sem troca de óleo", () => {
  const servicos = [
    { id: 1, nome: "Troca de Óleo 5W30", preco: 80 },
    { id: 2, nome: "Retífica de motor", preco: 3000 },
    { id: 3, nome: "Alinhamento", preco: 60 },
  ] as Servico[];
  const clientes = [
    { id: 1, nome: "Ana", telefone: "1" },
    { id: 2, nome: "Bia", telefone: "2" },
    { id: 3, nome: "Caio", telefone: "3" },
  ] as Cliente[];
  const veiculos = [
    { id: 10, clienteId: 1, modelo: "Gol", placa: "AAA1111" },
    { id: 20, clienteId: 2, modelo: "Uno", placa: "BBB2222" },
    { id: 30, clienteId: 3, modelo: "Ka", placa: "CCC3333" },
  ] as Veiculo[];
  const ordens = [
    { id: 1, veiculoId: 10, clienteId: 1, servicosIds: [1], criadoEm: "2026-08-01T10:00:00" }, // Ana trocou há 1 mês
    { id: 2, veiculoId: 20, clienteId: 2, servicosIds: [1], criadoEm: "2025-12-01T10:00:00" }, // Bia há 9 meses
    { id: 3, veiculoId: 30, clienteId: 3, servicosIds: [3], criadoEm: "2026-09-01T10:00:00" }, // Caio nunca trocou óleo
    { id: 4, veiculoId: 20, clienteId: 2, servicosIds: [2], criadoEm: "2026-09-10T10:00:00" }, // motor da Bia
  ] as Ordem[];

  it("lista quem nunca trocou primeiro, depois os mais atrasados", () => {
    const lista = clientesSemTrocaDeOleo({ clientes, veiculos, ordens, servicos }, agora);
    expect(lista.map((c) => [c.cliente.nome, c.meses])).toEqual([
      ["Caio", null],
      ["Bia", 9],
    ]);
  });

  it("reconhece 'óleo' com ou sem acento, maiúsculo ou minúsculo", () => {
    const semAcento = [{ id: 1, nome: "TROCA OLEO", preco: 80 }] as Servico[];
    const lista = clientesSemTrocaDeOleo({ clientes, veiculos, ordens, servicos: semAcento }, agora);
    expect(lista.find((c) => c.cliente.nome === "Ana")).toBeUndefined();
  });

  it("histórico de motor traz a O.S. com cliente e veículo", () => {
    const historico = historicoDeMotor({ clientes, veiculos, ordens, servicos });
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({ os: { id: 4 }, cliente: { nome: "Bia" }, veiculo: { placa: "BBB2222" } });
  });
});

describe("resumoDoDia", () => {
  it("conta O.S. abertas, em andamento, atrasados e faturamento de hoje", () => {
    const ordens = [{ status: "aberta" }, { status: "em_andamento" }, { status: "entregue" }, { status: "cancelada" }] as Ordem[];
    const pagamentos = [
      { pagoEm: "2026-09-28", valor: 100, vencimento: "2026-09-28" },
      { pagoEm: "2026-09-27", valor: 999, vencimento: "2026-09-27" },
      { pagoEm: null, valor: 50, vencimento: "2026-09-20" },
      { pagoEm: null, valor: 50, vencimento: "2026-10-20" },
    ] as Pagamento[];

    expect(resumoDoDia(ordens, pagamentos, "2026-09-28")).toEqual({ abertas: 2, emAndamento: 1, faturamentoHoje: 100, atrasados: 1 });
  });
});

describe("totaisPorForma", () => {
  it("soma só os pagamentos recebidos, por forma", () => {
    const pagamentos = [
      { pagoEm: "2026-09-01", forma: "pix", valor: 100 },
      { pagoEm: "2026-09-02", forma: "pix", valor: 50 },
      { pagoEm: "2026-09-03", forma: "dinheiro", valor: 30 },
      { pagoEm: null, forma: null, valor: 999 },
    ] as Pagamento[];
    expect(totaisPorForma(pagamentos)).toEqual({ dinheiro: 30, cartao: 0, pix: 150 });
  });
});
