import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

// Simula o backend: toda chamada fetch devolve o JSON informado
function backendResponde(corpo: unknown) {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status: 200 }));
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api.minhaOficina", () => {
  // regressão: a API manda "logo_url", mas as telas leem "logo". Sem o
  // alias, a logo nunca aparecia e salvar os dados da oficina a apagava.
  it("expõe a logo como 'logo' para as telas", async () => {
    backendResponde({ id: 1, nome: "Oficina do Zé", logo_url: "data:image/png;base64,AAA" });

    const oficina = await api.minhaOficina("token");

    expect(oficina?.logo).toBe("data:image/png;base64,AAA");
    expect(oficina?.logoUrl).toBe("data:image/png;base64,AAA");
  });

  it("aceita oficina sem logo", async () => {
    backendResponde({ id: 1, nome: "Oficina do Zé", logo_url: null });
    expect((await api.minhaOficina("token"))?.logo).toBeNull();
  });
});

describe("api.atualizarOficina", () => {
  it("devolve a oficina salva já com a logo", async () => {
    backendResponde({ id: 1, nome: "Nova", logo_url: "data:image/png;base64,BBB" });
    expect((await api.atualizarOficina("token", { nome: "Nova" })).logo).toBe("data:image/png;base64,BBB");
  });
});

describe("apiFetch", () => {
  it("converte snake_case em camelCase e manda o token", async () => {
    const fetchFalso = backendResponde([{ id: 1, nome: "Troca de óleo", preco: 80, oficina_id: 7 }]);

    const servicos = await api.listarServicos("meu-token");

    expect(servicos[0]).toMatchObject({ nome: "Troca de óleo", oficinaId: 7 });
    const [, opcoes] = fetchFalso.mock.calls[0]!;
    expect(opcoes.headers.Authorization).toBe("Bearer meu-token");
  });

  it("transforma a resposta de erro em ApiError com código", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: "assinatura_pendente", mensagem: "assinatura atrasada" }), { status: 402 }))
    );

    await expect(api.listarClientes("token")).rejects.toMatchObject({
      message: "assinatura atrasada",
      codigo: "assinatura_pendente",
      status: 402,
    });
  });
});
