// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";

// campos <input type="date"> visíveis, na ordem da tela
const camposData = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cliente, Ordem, Pagamento, Produto, Servico, Usuario, Veiculo } from "../../api";
import { DetalheOS } from "./DetalheOS";
import { ImpressaoOS } from "./ImpressaoOS";
import { NovaOS } from "./NovaOS";

afterEach(() => {
  cleanup();
});

const admin = { id: 1, nome: "Kestner", email: "k@x.com", perfil: "admin" } as Usuario;
const mecanico = { id: 2, nome: "Zé Mecânico", email: "z@x.com", perfil: "mecanico" } as Usuario;
const atendente = { id: 3, nome: "Ana", email: "a@x.com", perfil: "atendente" } as Usuario;
const cliente = { id: 1, nome: "João da Silva", telefone: "1199", cpf: "123.456.789-00", endereco: null, email: null } as Cliente;
const veiculo = { id: 10, clienteId: 1, placa: "ABC1D23", marca: "VW", modelo: "Gol", ano: 2015, cor: null, kmAtual: null } as Veiculo;
const servico = { id: 1, nome: "Troca de óleo", preco: 80 } as Servico;
const filtro = { id: 5, nome: "Filtro", quantidade: 3, quantidadeEstoque: 3, estoqueMinimo: 1, precoVenda: 30, precoCusto: 10 } as Produto;

const osBase = {
  id: 7,
  numero: "0007",
  clienteId: 1,
  veiculoId: 10,
  mecanicoId: null,
  criadoPor: 1,
  status: "aberta",
  descricao: "barulho no motor",
  km: "84200",
  observacoesMecanico: null,
  sinal: 50,
  valorTotal: 200,
  dataSaida: null,
  criadoEm: "2026-09-28T10:00:00",
  servicosIds: [],
  pecasUtilizadas: [],
} as unknown as Ordem;

describe("NovaOS", () => {
  function acoes() {
    return {
      criarVeiculo: vi.fn().mockResolvedValue({ ...veiculo, id: 99 }),
      criarOrdem: vi.fn().mockResolvedValue({ ...osBase, numero: "0008" }),
    };
  }

  it("abre a O.S. com serviço, peça, mecânico e sinal", async () => {
    const a = acoes();
    const usuario = userEvent.setup();
    render(<NovaOS clientes={[cliente]} veiculos={[veiculo]} servicos={[servico]} produtos={[filtro]} equipe={[admin, mecanico, atendente]} actions={a} onImprimir={() => {}} />);

    await usuario.selectOptions(screen.getByDisplayValue("selecione"), "1");
    await usuario.selectOptions(screen.getByDisplayValue("selecione"), "10");
    await usuario.type(screen.getByPlaceholderText("O que o cliente descreveu sobre o problema"), "barulho");
    await usuario.selectOptions(screen.getByDisplayValue("não definido ainda"), "2");

    await usuario.click(screen.getByText("selecionar serviços"));
    await usuario.click(screen.getByRole("checkbox"));
    await usuario.click(screen.getByText("fechar"));

    await usuario.click(screen.getByText("selecionar peças do estoque"));
    await usuario.click(screen.getByRole("checkbox"));
    // seleciona o "1" que já está no campo e digita por cima
    await usuario.tripleClick(screen.getByRole("spinbutton"));
    await usuario.keyboard("2");
    await usuario.click(screen.getByText("fechar"));

    await usuario.type(screen.getByPlaceholderText("Ex: 100"), "40");
    expect(screen.getByText("R$ 140")).toBeTruthy(); // 80 + 2 x 30
    expect(screen.getByText("R$ 100")).toBeTruthy(); // restante

    await usuario.click(screen.getByText("abrir O.S."));

    expect(a.criarOrdem).toHaveBeenCalledWith({
      clienteId: 1,
      veiculoId: 10,
      descricao: "barulho",
      km: "",
      status: "aberta",
      servicosIds: [1],
      pecas: [{ produtoId: 5, quantidade: 2 }],
      sinal: 40,
      mecanicoId: 2,
    });
    expect(await screen.findByText("O.S. #0008 criada com sucesso.")).toBeTruthy();
  });

  it("não deixa escolher mais peças do que tem no estoque", async () => {
    const usuario = userEvent.setup();
    render(<NovaOS clientes={[cliente]} veiculos={[veiculo]} servicos={[]} produtos={[filtro]} equipe={[]} actions={acoes()} onImprimir={() => {}} />);

    await usuario.click(screen.getByText("selecionar peças do estoque"));
    await usuario.click(screen.getByRole("checkbox"));
    await usuario.tripleClick(screen.getByRole("spinbutton"));
    await usuario.keyboard("9");

    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "3");
  });

  it("avisa quando faltam cliente, veículo ou descrição", async () => {
    const a = acoes();
    const usuario = userEvent.setup();
    render(<NovaOS clientes={[cliente]} veiculos={[veiculo]} servicos={[]} produtos={[]} equipe={[]} actions={a} onImprimir={() => {}} />);

    await usuario.click(screen.getByText("abrir O.S."));

    expect(screen.getByText("preencha cliente, veículo e a descrição do problema.")).toBeTruthy();
    expect(a.criarOrdem).not.toHaveBeenCalled();
  });

  it("só lista mecânicos e admins como responsáveis", () => {
    render(<NovaOS clientes={[]} veiculos={[]} servicos={[]} produtos={[]} equipe={[admin, mecanico, atendente]} actions={acoes()} onImprimir={() => {}} />);
    expect(screen.getByRole("option", { name: "Zé Mecânico" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Ana" })).toBeNull();
  });
});

describe("DetalheOS", () => {
  function acoes() {
    return {
      mudarStatusOrdem: vi.fn().mockResolvedValue(undefined),
      excluirOrdem: vi.fn().mockResolvedValue(undefined),
      salvarSinalOrdem: vi.fn().mockResolvedValue(undefined),
      salvarMecanicoOrdem: vi.fn().mockResolvedValue(undefined),
      salvarObservacoesOrdem: vi.fn().mockResolvedValue(undefined),
      finalizarOrdem: vi.fn().mockResolvedValue(undefined),
    };
  }

  function renderizar(a = acoes(), usuario = admin, os = osBase) {
    render(
      <DetalheOS
        usuario={usuario}
        os={os}
        cliente={cliente}
        veiculo={veiculo}
        servicos={[servico]}
        produtos={[filtro]}
        equipe={[admin, mecanico]}
        ordens={[os]}
        actions={a}
        onVoltar={() => {}}
        onImprimir={() => {}}
      />
    );
    return a;
  }

  it("mostra o restante a cobrar descontando o sinal", () => {
    renderizar();
    expect(screen.getByText("R$ 150")).toBeTruthy();
  });

  it("exige decidir se o restante foi pago antes de entregar", async () => {
    const a = renderizar();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByText("finalizar O.S. e entregar veículo"));
    await usuario.type(camposData()[0]!, "2026-09-29"); // data de saída
    await usuario.click(screen.getByText("confirmar entrega"));

    expect(screen.getByText("informe se o valor restante já foi pago ou fica pendente.")).toBeTruthy();
    expect(a.finalizarOrdem).not.toHaveBeenCalled();
  });

  it("entrega com o restante pendente e vencimento", async () => {
    const a = renderizar();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByText("finalizar O.S. e entregar veículo"));
    await usuario.type(camposData()[0]!, "2026-09-29"); // data de saída
    await usuario.click(screen.getByText("fica pendente"));
    await usuario.type(camposData()[1]!, "2026-10-10"); // vencimento
    await usuario.click(screen.getByText("confirmar entrega"));

    expect(a.finalizarOrdem).toHaveBeenCalledWith(7, {
      dataSaida: "2026-09-29",
      pago: false,
      forma: null,
      documento: null,
      comprovante: null,
      vencimento: "2026-10-10",
    });
    expect(await screen.findByText("O.S. #0007 finalizada e entregue em 29/09/2026.")).toBeTruthy();
  });

  it("muda o andamento da O.S.", async () => {
    const a = renderizar();
    await userEvent.setup().click(screen.getByRole("button", { name: "aguard. peça" }));
    expect(a.mudarStatusOrdem).toHaveBeenCalledWith(7, "aguardando_peca");
  });

  it("só o admin vê o botão de excluir", () => {
    renderizar(acoes(), mecanico);
    expect(screen.queryByText("excluir O.S.")).toBeNull();
  });
});

describe("ImpressaoOS", () => {
  const pagamento = {
    id: 1,
    osId: 7,
    valor: 150,
    vencimento: "2026-10-10",
    pagoEm: "2026-09-29",
    forma: "pix",
    documento: "E123",
    recebidoPor: 1,
    comprovante: null,
  } as Pagamento;

  function renderizar() {
    render(
      <ImpressaoOS
        os={osBase}
        oficina={{ id: 1, nome: "Oficina do Zé", cnpj: "11.222.333/0001-81", telefone: "1133", endereco: null, logoUrl: null, logo: null }}
        cliente={cliente}
        veiculo={veiculo}
        usuarios={[admin]}
        servicos={[]}
        produtos={[]}
        pagamentos={[pagamento]}
        onFechar={() => {}}
      />
    );
  }

  it("via do cliente não mostra CPF nem documento do pagamento", () => {
    renderizar();
    expect(screen.getByText("OFICINA DO ZÉ")).toBeTruthy();
    expect(screen.queryByText("CPF: 123.456.789-00")).toBeNull();
    expect(screen.queryByText(/doc E123/)).toBeNull();
    expect(screen.getByText("R$ 150", { selector: "span" })).toBeTruthy();
  });

  it("via fiscal mostra CPF e documento do pagamento", async () => {
    renderizar();
    await userEvent.setup().click(screen.getByText("via fiscal", { selector: "div" }));
    expect(screen.getByText("CPF: 123.456.789-00")).toBeTruthy();
    expect(screen.getByText(/doc E123/)).toBeTruthy();
  });
});

// Regressão: a tela e a impressão usavam o preço ATUAL do catálogo. Depois
// de um reajuste, a O.S. antiga mostrava o item com preço novo e o total
// com o preço antigo; e itens que saíram do catálogo sumiam da O.S.
describe("preços congelados na O.S.", () => {
  // O.S. aberta quando a troca de óleo custava R$ 80 e o filtro R$ 30
  const osComItens = {
    ...osBase,
    valorTotal: 140,
    sinal: 0,
    servicosIds: [1, 2],
    itensServicos: [
      { servicoId: 1, nome: "Troca de óleo", preco: 80 },
      { servicoId: 2, nome: "Alinhamento (saiu do catálogo)", preco: 0 },
    ],
    pecasUtilizadas: [{ produtoId: 5, nome: "Filtro", quantidade: 2, precoUnitario: 30 }],
  } as unknown as Ordem;
  // catálogo de hoje: óleo reajustado, filtro mais caro, alinhamento excluído
  const servicosHoje = [{ ...servico, preco: 100 }];
  const produtosHoje = [{ ...filtro, precoVenda: 45 }];

  it("a impressão mostra o preço do dia da O.S.", () => {
    render(
      <ImpressaoOS
        os={osComItens}
        oficina={null}
        cliente={cliente}
        veiculo={veiculo}
        usuarios={[admin]}
        servicos={servicosHoje}
        produtos={produtosHoje}
        pagamentos={[]}
        onFechar={() => {}}
      />
    );
    expect(screen.getByText("R$ 80")).toBeTruthy();
    expect(screen.getByText("R$ 60")).toBeTruthy(); // 2 x 30
    expect(screen.queryByText("R$ 100")).toBeNull();
    expect(screen.queryByText("R$ 90")).toBeNull();
    expect(screen.getByText("Alinhamento (saiu do catálogo)")).toBeTruthy();
  });

  it("o detalhe da O.S. mostra o preço do dia da O.S.", () => {
    render(
      <DetalheOS
        usuario={admin}
        os={osComItens}
        cliente={cliente}
        veiculo={veiculo}
        servicos={servicosHoje}
        produtos={produtosHoje}
        equipe={[admin]}
        ordens={[osComItens]}
        actions={{
          mudarStatusOrdem: vi.fn(),
          excluirOrdem: vi.fn(),
          salvarSinalOrdem: vi.fn(),
          salvarMecanicoOrdem: vi.fn(),
          salvarObservacoesOrdem: vi.fn(),
          finalizarOrdem: vi.fn(),
        }}
        onVoltar={() => {}}
        onImprimir={() => {}}
      />
    );
    expect(screen.getByText("R$ 80")).toBeTruthy();
    expect(screen.getByText("R$ 60")).toBeTruthy();
    expect(screen.queryByText("R$ 100")).toBeNull();
  });
});

// Regressão: erros ao salvar sinal, mecânico, observações, status ou ao
// excluir só apareciam dentro do painel de finalização — fora dele, a
// ação falhava e a tela não dizia nada.
describe("erros no detalhe da O.S.", () => {
  it("mostra o erro quando não consegue salvar o sinal", async () => {
    const acoesComErro = {
      mudarStatusOrdem: vi.fn(),
      excluirOrdem: vi.fn(),
      salvarSinalOrdem: vi.fn().mockRejectedValue(new Error("a assinatura desta oficina está atrasada.")),
      salvarMecanicoOrdem: vi.fn(),
      salvarObservacoesOrdem: vi.fn(),
      finalizarOrdem: vi.fn(),
    };
    render(
      <DetalheOS
        usuario={admin}
        os={osBase}
        cliente={cliente}
        veiculo={veiculo}
        servicos={[]}
        produtos={[]}
        equipe={[admin]}
        ordens={[osBase]}
        actions={acoesComErro}
        onVoltar={() => {}}
        onImprimir={() => {}}
      />
    );

    await userEvent.setup().click(screen.getByText("salvar sinal"));

    expect(await screen.findByText("a assinatura desta oficina está atrasada.")).toBeTruthy();
  });
});
