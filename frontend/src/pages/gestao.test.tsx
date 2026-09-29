import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Despesa, Oficina, Pagamento, Produto, Servico, Usuario } from "../api";
import { DadosOficina } from "./DadosOficina";
import { Despesas } from "./Despesas";
import { Equipe } from "./Equipe";
import { MinhaAssinatura } from "./MinhaAssinatura";
import { ServicosEstoque } from "./ServicosEstoque";

const html = (elemento: React.ReactElement) => renderToStaticMarkup(elemento);
const acao = async () => {};

afterEach(() => {
  vi.useRealTimers();
});

const admin = { id: 1, nome: "Kestner", email: "k@x.com", perfil: "admin" } as Usuario;
const atendente = { id: 2, nome: "Ana", email: "a@x.com", perfil: "atendente" } as Usuario;

describe("Equipe", () => {
  const acoes = { criarUsuario: acao, removerUsuario: acao };

  it("mostra quantos acessos foram usados e marca o próprio usuário", () => {
    const resultado = html(<Equipe usuario={admin} minhaEquipe={[admin, atendente]} actions={acoes} />);
    expect(resultado).toContain("2 de 3 acessos usados");
    expect(resultado).toContain("Kestner (você)");
    expect(resultado).toContain("+ novo acesso");
  });

  it("esconde o botão de novo acesso quando atinge o limite", () => {
    const terceiro = { id: 3, nome: "Zé", email: "z@x.com", perfil: "mecanico" } as Usuario;
    const resultado = html(<Equipe usuario={admin} minhaEquipe={[admin, atendente, terceiro]} actions={acoes} />);
    expect(resultado).toContain("limite de 3 acessos atingido");
    expect(resultado).not.toContain("+ novo acesso");
    expect(resultado).toContain("mecânico");
  });
});

describe("Despesas", () => {
  const acoes = { criarDespesa: acao, excluirDespesa: acao };

  it("calcula faturamento, despesas e saldo do mês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00-03:00"));
    const despesas = [{ id: 1, descricao: "Aluguel", categoria: "aluguel", valor: 1000, dataVencimento: "2026-10-05", fixa: true }] as Despesa[];
    const pagamentos = [
      { id: 1, valor: 1500, pagoEm: "2026-09-10" },
      { id: 2, valor: 700, pagoEm: "2026-08-10" },
    ] as Pagamento[];

    const resultado = html(<Despesas despesas={despesas} meusPagamentos={pagamentos} actions={acoes} />);

    expect(resultado).toContain("R$ 1.500"); // faturamento de setembro
    expect(resultado).toContain("R$ 1.000"); // despesas
    expect(resultado).toContain("R$ 500"); // saldo
    expect(resultado).toContain("aluguel · fixa · vence 05/10/2026");
  });
});

describe("DadosOficina", () => {
  const oficina = {
    id: 1,
    nome: "Oficina do Zé",
    cnpj: "11222333000181",
    telefone: "1199999",
    endereco: null,
    logoUrl: "data:image/png;base64,AAA",
    logo: "data:image/png;base64,AAA",
  } as Oficina;
  const acoes = { atualizarOficina: acao };

  it("mostra a logo atual da oficina", () => {
    expect(html(<DadosOficina usuario={admin} oficina={oficina} actions={acoes} />)).toContain('src="data:image/png;base64,AAA"');
  });

  it("não deixa quem não é admin editar", () => {
    const resultado = html(<DadosOficina usuario={atendente} oficina={oficina} actions={acoes} />);
    expect(resultado).toContain("apenas administradores podem alterar");
    expect(resultado).toContain("disabled");
  });
});

describe("ServicosEstoque", () => {
  const acoes = { criarServico: acao, editarServico: acao, excluirServico: acao, criarProduto: acao, editarProduto: acao, excluirProduto: acao };

  it("lista serviços e marca peças com estoque baixo", () => {
    const servicos = [{ id: 1, nome: "Troca de óleo", preco: 80 }] as Servico[];
    const produtos = [
      { id: 1, nome: "Filtro", quantidade: 1, estoqueMinimo: 2, precoVenda: 30 },
      { id: 2, nome: "Vela", quantidade: 10, estoqueMinimo: 2, precoVenda: 15 },
    ] as Produto[];

    const resultado = html(<ServicosEstoque meusServicos={servicos} meusProdutos={produtos} actions={acoes} />);

    expect(resultado).toContain("Troca de óleo");
    expect(resultado.match(/baixo/g)).toHaveLength(1); // só o filtro
  });

  it("mostra mensagens quando está vazio", () => {
    const resultado = html(<ServicosEstoque meusServicos={[]} meusProdutos={[]} actions={acoes} />);
    expect(resultado).toContain("nenhum serviço cadastrado ainda");
    expect(resultado).toContain("nenhum item cadastrado no estoque");
  });
});

describe("MinhaAssinatura", () => {
  it("começa mostrando 'carregando'", () => {
    const acoes = {
      verAssinatura: async () => null,
      listarCobrancasAssinatura: async () => [],
      configurarAssinatura: acao,
      cancelarAssinatura: acao,
    };
    expect(html(<MinhaAssinatura actions={acoes} />)).toContain("carregando...");
  });
});
