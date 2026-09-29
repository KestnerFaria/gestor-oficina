// @vitest-environment jsdom
// Testes do app inteiro, simulando o servidor: cada chamada fetch é
// respondida conforme a rota, como o backend real responderia.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type Resposta = { status?: number; corpo: unknown };
type Rotas = Record<string, Resposta | (() => Resposta)>;

const oficina = { id: 1, nome: "Oficina do Zé", cnpj: "11222333000181", telefone: "1133", endereco: null, logo_url: null };
const usuario = { id: 1, nome: "Kestner", email: "k@x.com", perfil: "admin", oficinaId: 1 };

// dados vazios de uma oficina que está em dia
const dadosEmDia: Rotas = {
  "GET /oficinas/minha": { corpo: oficina },
  "GET /equipe": { corpo: [usuario] },
  "GET /clientes": { corpo: [] },
  "GET /veiculos": { corpo: [] },
  "GET /servicos": { corpo: [] },
  "GET /produtos": { corpo: [] },
  "GET /ordens": { corpo: [] },
  "GET /alertas-whatsapp": { corpo: [] },
  "GET /pagamentos": { corpo: [] },
};

// como o backend responde qualquer rota da equipe com a assinatura cancelada
const bloqueioCancelada: Resposta = {
  status: 402,
  corpo: {
    erro: "assinatura_pendente",
    mensagem: 'a assinatura desta oficina foi cancelada. reative em "dados da oficina" para continuar usando o sistema.',
    status: "cancelada",
  },
};

function simularServidor(rotas: () => Rotas) {
  const chamadas: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, opcoes: RequestInit = {}) => {
      const caminho = new URL(url).pathname;
      const chave = `${opcoes.method ?? "GET"} ${caminho}`;
      chamadas.push(chave);
      const rota = rotas()[chave];
      if (!rota) throw new Error(`rota não simulada: ${chave}`);
      const { status = 200, corpo } = typeof rota === "function" ? rota() : rota;
      return new Response(JSON.stringify(corpo), { status });
    })
  );
  return chamadas;
}

async function fazerLogin() {
  const u = userEvent.setup();
  await u.type(screen.getByPlaceholderText("seu@email.com"), "k@x.com");
  await u.type(screen.getByPlaceholderText("••••••"), "senha");
  await u.click(screen.getByRole("button", { name: "entrar" }));
  return u;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("entra no painel da oficina e lembra a sessão", async () => {
    simularServidor(() => ({ ...dadosEmDia, "POST /auth/login-equipe": { corpo: { token: "tk", usuario } } }));
    render(<App />);

    await fazerLogin();

    expect(await screen.findByText("visão geral")).toBeTruthy();
    expect(screen.getByText("OFICINA DO ZÉ")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("oficina_sessao")!)).toMatchObject({ tipo: "equipe", token: "tk" });
  });

  it("mostra o erro de senha errada", async () => {
    simularServidor(() => ({ "POST /auth/login-equipe": { status: 401, corpo: { erro: "email ou senha incorretos." } } }));
    render(<App />);

    await fazerLogin();

    expect(await screen.findByText("email ou senha incorretos.")).toBeTruthy();
  });

  it("volta para o login ao sair", async () => {
    localStorage.setItem("oficina_sessao", JSON.stringify({ tipo: "equipe", token: "tk", usuario }));
    simularServidor(() => dadosEmDia);
    render(<App />);

    await screen.findByText("visão geral");
    await userEvent.setup().click(screen.getByRole("button", { name: "sair" }));

    expect(screen.getByText("GESTOR DE OFICINA")).toBeTruthy();
    expect(localStorage.getItem("oficina_sessao")).toBeNull();
  });
});

describe("assinatura cancelada", () => {
  // Regressão: o backend manda status "cancelada" no corpo da resposta 402,
  // mas o cliente da API descartava esse campo. A tela de bloqueio nunca
  // sabia que era cancelamento, mostrava "já paguei, verificar novamente"
  // em vez de "reativar", e a oficina ficava presa para sempre.
  it("oferece reativar e libera o sistema depois", async () => {
    let reativada = false;
    const chamadas = simularServidor(() => {
      const rotas: Rotas = { ...dadosEmDia, "POST /auth/login-equipe": { corpo: { token: "tk", usuario } } };
      if (!reativada) {
        for (const chave of Object.keys(dadosEmDia)) if (chave !== "GET /oficinas/minha") rotas[chave] = bloqueioCancelada;
      }
      rotas["POST /oficinas/minha/assinatura/configurar"] = () => {
        reativada = true;
        return { corpo: { ok: true } };
      };
      return rotas;
    });
    render(<App />);

    const u = await fazerLogin();
    expect(await screen.findByText("assinatura cancelada")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "reativar assinatura" }));

    expect(await screen.findByText("visão geral")).toBeTruthy();
    expect(chamadas).toContain("POST /oficinas/minha/assinatura/configurar");
  });
});
