// @vitest-environment jsdom
// Testes de interação: simulam uma pessoa clicando e digitando num
// navegador de verdade (jsdom), com a Testing Library.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cliente, Ordem, Pagamento, Usuario, Veiculo } from "../api";
import { ClientesVeiculos } from "./ClientesVeiculos";
import { Dashboard } from "./Dashboard";
import { Financeiro } from "./Financeiro";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const cliente = { id: 1, nome: "João da Silva", telefone: "(11) 98888-7777", cpf: null, endereco: null, email: null } as Cliente;
const veiculo = { id: 10, clienteId: 1, placa: "XYZ9876", marca: "VW", modelo: "Gol", ano: 2015, cor: null, kmAtual: null } as Veiculo;

function acoesClientes() {
  return {
    criarCliente: vi.fn().mockResolvedValue(undefined),
    editarCliente: vi.fn().mockResolvedValue(undefined),
    excluirCliente: vi.fn().mockResolvedValue(undefined),
    criarVeiculo: vi.fn().mockResolvedValue(undefined),
    editarVeiculo: vi.fn().mockResolvedValue(undefined),
    excluirVeiculo: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ClientesVeiculos", () => {
  // regressão: o bloco de veículos era declarado dentro do componente pai e
  // o campo perdia o foco a cada letra — digitando "ABC1D23" ficava só "A"
  it("deixa digitar a placa inteira de um veículo novo", async () => {
    const acoes = acoesClientes();
    const usuario = userEvent.setup();
    render(<ClientesVeiculos meusClientes={[cliente]} veiculos={[]} actions={acoes} />);

    await usuario.click(screen.getByText("João da Silva"));
    await usuario.click(screen.getByText("+ adicionar veículo"));
    await usuario.type(screen.getByPlaceholderText("placa"), "abc1d23");
    await usuario.type(screen.getByPlaceholderText("modelo"), "Onix");
    await usuario.type(screen.getByPlaceholderText("ano"), "2020");
    await usuario.click(screen.getByText("salvar veículo"));

    expect(acoes.criarVeiculo).toHaveBeenCalledWith({ clienteId: 1, placa: "ABC1D23", marca: "", modelo: "Onix", ano: 2020, cor: "" });
  });

  it("deixa editar um veículo existente sem perder o foco", async () => {
    const acoes = acoesClientes();
    const usuario = userEvent.setup();
    render(<ClientesVeiculos meusClientes={[cliente]} veiculos={[veiculo]} actions={acoes} />);

    await usuario.click(screen.getByText("João da Silva"));
    await usuario.click(screen.getAllByText("editar")[1]!); // [0] edita o cliente, [1] o veículo
    const modelo = screen.getByPlaceholderText("modelo");
    await usuario.clear(modelo);
    await usuario.type(modelo, "Gol G5");
    await usuario.click(screen.getByText("salvar"));

    expect(acoes.editarVeiculo).toHaveBeenCalledWith(10, expect.objectContaining({ modelo: "Gol G5", placa: "XYZ9876" }));
  });

  it("mostra o erro da API quando não consegue salvar o veículo", async () => {
    const acoes = acoesClientes();
    acoes.criarVeiculo.mockRejectedValue(new Error("placa já cadastrada"));
    const usuario = userEvent.setup();
    render(<ClientesVeiculos meusClientes={[cliente]} veiculos={[]} actions={acoes} />);

    await usuario.click(screen.getByText("João da Silva"));
    await usuario.click(screen.getByText("+ adicionar veículo"));
    await usuario.type(screen.getByPlaceholderText("placa"), "abc1234");
    await usuario.type(screen.getByPlaceholderText("modelo"), "Uno");
    await usuario.click(screen.getByText("salvar veículo"));

    expect(await screen.findByText("placa já cadastrada")).toBeTruthy();
  });

  it("cadastra um cliente novo", async () => {
    const acoes = acoesClientes();
    const usuario = userEvent.setup();
    render(<ClientesVeiculos meusClientes={[]} veiculos={[]} actions={acoes} />);

    await usuario.click(screen.getByText("+ novo cliente"));
    await usuario.type(screen.getByPlaceholderText("nome completo"), "Maria Souza");
    await usuario.type(screen.getByPlaceholderText("telefone"), "11977776666");
    await usuario.click(screen.getByText("salvar cliente"));

    expect(acoes.criarCliente).toHaveBeenCalledWith(expect.objectContaining({ nome: "Maria Souza", telefone: "11977776666" }));
  });
});

describe("Financeiro", () => {
  const ordem = { id: 5, numero: "0005", clienteId: 1 } as Ordem;
  const pendente = { id: 1, osId: 5, valor: 150, vencimento: "2026-10-10", pagoEm: null, forma: null, documento: null, recebidoPor: null, comprovante: null } as Pagamento;
  const admin = { id: 1, nome: "Kestner", email: "k@x.com", perfil: "admin" } as Usuario;

  function acoesFinanceiro() {
    return {
      marcarPago: vi.fn().mockResolvedValue(undefined),
      estornarPagamento: vi.fn().mockResolvedValue(undefined),
      lancarPagamento: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("exige documento ou comprovante para receber no PIX", async () => {
    const acoes = acoesFinanceiro();
    const usuario = userEvent.setup();
    render(<Financeiro usuarios={[admin]} meusPagamentos={[pendente]} ordens={[ordem]} clientes={[cliente]} actions={acoes} />);

    await usuario.click(screen.getByText("marcar pago"));
    await usuario.click(screen.getByText("PIX"));
    await usuario.click(screen.getByText("confirmar recebimento"));

    expect(screen.getByText("informe o ID da transação ou anexe o comprovante.")).toBeTruthy();
    expect(acoes.marcarPago).not.toHaveBeenCalled();
  });

  it("registra o recebimento no PIX com o ID da transação", async () => {
    const acoes = acoesFinanceiro();
    const usuario = userEvent.setup();
    render(<Financeiro usuarios={[admin]} meusPagamentos={[pendente]} ordens={[ordem]} clientes={[cliente]} actions={acoes} />);

    await usuario.click(screen.getByText("marcar pago"));
    await usuario.click(screen.getByText("PIX"));
    await usuario.type(screen.getByPlaceholderText("Ex: E1234567820260810"), "E999");
    await usuario.click(screen.getByText("confirmar recebimento"));

    expect(acoes.marcarPago).toHaveBeenCalledWith(1, { forma: "pix", documento: "E999", comprovante: null });
  });

  it("filtra por situação", async () => {
    const usuario = userEvent.setup();
    const pago = { ...pendente, id: 2, pagoEm: "2026-09-01", forma: "dinheiro" as const };
    render(<Financeiro usuarios={[admin]} meusPagamentos={[pendente, pago]} ordens={[ordem]} clientes={[cliente]} actions={acoesFinanceiro()} />);

    await usuario.click(screen.getByRole("button", { name: "pago" }));

    expect(screen.getByText("estornar")).toBeTruthy();
    expect(screen.queryByText("marcar pago")).toBeNull();
  });
});

describe("Dashboard", () => {
  it("monta o link do WhatsApp e registra o alerta ao clicar", async () => {
    const registrarAlerta = vi.fn().mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    render(
      <Dashboard
        clientes={[cliente]}
        veiculos={[veiculo]}
        ordens={[]}
        pagamentos={[]}
        servicos={[]}
        oficina={null}
        alertas={[]}
        actions={{ registrarAlerta }}
        onAbrir={() => {}}
        onImprimir={() => {}}
      />
    );

    const link = screen.getByText("chamar no whatsapp");
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=Ol%C3%A1%20Jo%C3%A3o/);
    await usuario.click(link);
    expect(registrarAlerta).toHaveBeenCalledWith(1, 10);
  });
});
