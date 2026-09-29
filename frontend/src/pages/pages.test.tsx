import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ordem, Pagamento, RegistroAuditoria, Usuario } from "../api";
import { Auditoria, tomDaAcao } from "./Auditoria";
import { CadastroOficina } from "./CadastroOficina";
import { PortalCliente, situacaoDoPagamento } from "./PortalCliente";
import { TelaAssinaturaBloqueada } from "./TelaAssinaturaBloqueada";
import { TelaLogin } from "./TelaLogin";

const html = (elemento: React.ReactElement) => renderToStaticMarkup(elemento);
const nada = () => {};
const nadaAsync = async () => {};

afterEach(() => {
  vi.useRealTimers();
});

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

describe("TelaLogin", () => {
  it("abre no modo da oficina, com link de cadastro", () => {
    const resultado = html(<TelaLogin onEntrar={nada} onCadastrar={nada} />);
    expect(resultado).toContain("GESTOR DE OFICINA");
    expect(resultado).toContain("cadastre sua oficina");
  });
});

describe("CadastroOficina", () => {
  it("mostra os campos obrigatórios e o teste grátis", () => {
    const resultado = html(<CadastroOficina onVoltar={nada} onCadastrado={nada} />);
    expect(resultado).toContain("nome da oficina *");
    expect(resultado).toContain("CNPJ ou CPF *");
    expect(resultado).toContain("10 dias de teste grátis");
  });
});

describe("TelaAssinaturaBloqueada", () => {
  it("oferece reativar quando a assinatura foi cancelada", () => {
    const resultado = html(
      <TelaAssinaturaBloqueada status="cancelada" onTentarNovamente={nadaAsync} onReativar={nadaAsync} onSair={nada} />
    );
    expect(resultado).toContain("assinatura cancelada");
    expect(resultado).toContain("reativar assinatura");
  });

  it("oferece verificar o pagamento quando está atrasada", () => {
    const resultado = html(
      <TelaAssinaturaBloqueada status="atrasada" onTentarNovamente={nadaAsync} onReativar={nadaAsync} onSair={nada} />
    );
    expect(resultado).toContain("já paguei, verificar novamente");
  });
});

describe("Auditoria", () => {
  const equipe = [{ id: 1, nome: "Kestner", email: "k@x.com", perfil: "admin" }] as Usuario[];
  const registros = [
    { id: 1, usuarioId: 1, acao: "criou", entidade: "O.S. #0001", detalhe: "orçamento", em: "2026-09-28T14:35:00" },
    { id: 2, usuarioId: 99, acao: "excluiu", entidade: "cliente João", detalhe: "", em: "2026-09-28T15:00:00" },
  ] as RegistroAuditoria[];

  it("lista os registros com data formatada e nome de quem fez", () => {
    const resultado = html(<Auditoria auditoria={registros} equipe={equipe} />);
    expect(resultado).toContain("28/09/2026 14:35");
    expect(resultado).toContain("O.S. #0001");
    expect(resultado).toContain("Kestner");
  });

  it("mostra 'usuário removido' quando a pessoa não está mais na equipe", () => {
    expect(html(<Auditoria auditoria={registros} equipe={equipe} />)).toContain("usuário removido");
  });
});

describe("PortalCliente", () => {
  const cliente = { id: 1, nome: "João da Silva", email: "joao@x.com", oficinaId: 1 };
  const ordens = [
    { id: 1, numero: "0001", veiculoPlaca: "ABC1D23", veiculoModelo: "Gol", veiculoAno: 2015, status: "entregue", descricao: "revisão" },
    { id: 2, numero: "0002", veiculoPlaca: "ABC1D23", veiculoModelo: "Gol", veiculoAno: 2015, status: "aberta", descricao: "freio" },
  ] as Ordem[];
  const pagamentos = [
    { id: 1, valor: 150, vencimento: "2026-09-01", pagoEm: null, forma: null, documento: null },
  ] as Pagamento[];

  it("cumprimenta pelo primeiro nome e conta veículos sem repetir", () => {
    const resultado = html(<PortalCliente cliente={cliente} oficina={null} ordens={ordens} pagamentos={[]} onSair={nada} />);
    expect(resultado).toContain("olá, João");
    expect(resultado).toContain("1 veículo");
    expect(resultado).not.toContain("1 veículos");
  });

  it("marca como atrasado um pagamento vencido", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00-03:00"));

    const resultado = html(<PortalCliente cliente={cliente} oficina={null} ordens={[]} pagamentos={pagamentos} onSair={nada} />);
    expect(resultado).toContain("vencimento 01/09/2026");
    expect(resultado).toContain("atrasado");
  });
});
