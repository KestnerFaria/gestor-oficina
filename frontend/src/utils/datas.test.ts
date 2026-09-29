import { afterEach, describe, expect, it, vi } from "vitest";
import { agoraISO, fmtData, fmtDataHora, hojeISO } from "./datas";

afterEach(() => {
  vi.useRealTimers();
});

describe("hojeISO", () => {
  it("devolve a data de hoje no formato AAAA-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00-03:00"));

    expect(hojeISO()).toBe("2026-09-28");
  });

  // Bug encontrado: a versão antiga usava toISOString(), que é UTC.
  // No Brasil (UTC-3), depois das 21h o sistema já achava que era amanhã.
  it("continua sendo hoje às 22h no horário de Brasília", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T22:30:00-03:00"));

    expect(hojeISO()).toBe("2026-09-28");
  });

  it("vira o dia só à meia-noite", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T00:05:00-03:00"));

    expect(hojeISO()).toBe("2026-09-29");
  });
});

describe("agoraISO", () => {
  it("devolve data e hora locais no formato AAAA-MM-DDTHH:MM:SS", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T22:30:05-03:00"));

    expect(agoraISO()).toBe("2026-09-28T22:30:05");
  });
});

describe("fmtData", () => {
  it("converte AAAA-MM-DD para DD/MM/AAAA", () => {
    expect(fmtData("2026-09-28")).toBe("28/09/2026");
  });

  it("mostra um traço quando não há data", () => {
    expect(fmtData(null)).toBe("-");
    expect(fmtData(undefined)).toBe("-");
    expect(fmtData("")).toBe("-");
  });
});

describe("fmtDataHora", () => {
  it("formata data e hora", () => {
    expect(fmtDataHora("2026-09-28T14:35:10")).toBe("28/09/2026 14:35");
  });

  it("funciona só com a data", () => {
    expect(fmtDataHora("2026-09-28")).toBe("28/09/2026");
  });

  it("mostra um traço quando não há data", () => {
    expect(fmtDataHora(null)).toBe("-");
  });
});
