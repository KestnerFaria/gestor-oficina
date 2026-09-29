import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  type AlertaWhatsapp,
  type Cliente,
  type Despesa,
  type Id,
  type Oficina,
  type Ordem,
  type Pagamento,
  type Produto,
  type RegistroAuditoria,
  type Servico,
  type StatusAssinatura,
  type StatusOS,
  type Usuario,
  type Veiculo,
} from "../api";
import type { Sessao } from "../sessao";
import { mensagemDeErro } from "../utils/erros";

type SessaoEquipe = Extract<Sessao, { tipo: "equipe" }>;

// Corpo que as telas mandam para a API (cada tela tipa o seu formulário)
type Corpo = object;

export interface Bloqueio {
  mensagem: string;
  status?: StatusAssinatura;
}

export interface DadosDaOficina {
  oficina: Oficina | null;
  usuarios: Usuario[];
  clientes: Cliente[];
  veiculos: Veiculo[];
  servicos: Servico[];
  produtos: Produto[];
  ordens: Ordem[];
  pagamentos: Pagamento[];
  despesas: Despesa[];
  auditoria: RegistroAuditoria[];
  alertas: AlertaWhatsapp[];
}

const DADOS_VAZIOS: DadosDaOficina = {
  oficina: null,
  usuarios: [],
  clientes: [],
  veiculos: [],
  servicos: [],
  produtos: [],
  ordens: [],
  pagamentos: [],
  despesas: [],
  auditoria: [],
  alertas: [],
};

const assinaturaBloqueada = (e: unknown): e is ApiError => e instanceof ApiError && e.codigo === "assinatura_pendente";

// Envolve cada ação: se a API responder que a assinatura está atrasada ou
// cancelada, a tela inteira troca para o aviso de cobrança, em vez de
// mostrar um erro solto no formulário que a pessoa estava usando.
function protegerAcoes<T extends Record<string, (...args: never[]) => Promise<unknown>>>(acoes: T, aoBloquear: (b: Bloqueio) => void): T {
  const protegidas = Object.entries(acoes).map(([nome, acao]) => [
    nome,
    async (...args: never[]) => {
      try {
        return await acao(...args);
      } catch (e) {
        if (assinaturaBloqueada(e)) aoBloquear({ mensagem: e.message, status: e.assinaturaStatus });
        throw e;
      }
    },
  ]);
  return Object.fromEntries(protegidas) as T;
}

// Carrega todos os dados da oficina logada e oferece as ações que falam
// com a API e atualizam a tela com a resposta.
//
// O componente que usa este hook é recriado a cada login (key={token}),
// então o estado sempre começa limpo — nunca sobra dado de outra sessão.
export function useDadosOficina(sessao: SessaoEquipe, aoSessaoInvalida: () => void) {
  const { token } = sessao;
  const podeFinanceiro = sessao.usuario.perfil === "admin" || sessao.usuario.perfil === "atendente";

  const [dados, setDados] = useState<DadosDaOficina>(DADOS_VAZIOS);
  const [carregando, setCarregando] = useState(true);
  const [bloqueio, setBloqueio] = useState<Bloqueio | null>(null);

  // atualiza só um pedaço dos dados, a partir do valor anterior
  function atualizar<K extends keyof DadosDaOficina>(chave: K, novoValor: (anterior: DadosDaOficina[K]) => DadosDaOficina[K]) {
    setDados((d) => ({ ...d, [chave]: novoValor(d[chave]) }));
  }
  const substituir = <K extends keyof DadosDaOficina>(chave: K, valor: DadosDaOficina[K]) => atualizar(chave, () => valor);
  const trocarPorId = <T extends { id: Id }>(lista: T[], id: Id, novo: T) => lista.map((x) => (x.id === id ? novo : x));
  // PATCH da O.S. devolve só a linha da tabela: mantém os itens que já tínhamos
  const mesclarOrdem = (id: Id, parcial: Ordem) => atualizar("ordens", (lista) => lista.map((o) => (o.id === id ? { ...o, ...parcial } : o)));

  async function carregar() {
    setCarregando(true);
    setBloqueio(null);
    try {
      const [oficina, usuarios, clientes, veiculos, servicos, produtos, ordens, alertas] = await Promise.all([
        api.minhaOficina(token),
        api.listarEquipe(token),
        api.listarClientes(token),
        api.listarVeiculos(token),
        api.listarServicos(token),
        api.listarProdutos(token),
        api.listarOrdens(token),
        api.listarAlertas(token),
      ]);
      const pagamentos = podeFinanceiro ? await api.listarPagamentos(token) : [];
      setDados((d) => ({ ...d, oficina, usuarios, clientes, veiculos, servicos, produtos, ordens, alertas, pagamentos }));
    } catch (e) {
      if (assinaturaBloqueada(e)) {
        setBloqueio({ mensagem: e.message, status: e.assinaturaStatus });
      } else {
        // token expirado ou inválido: volta para o login
        console.error("falha ao carregar os dados da oficina:", mensagemDeErro(e));
        aoSessaoInvalida();
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // carrega uma vez por sessão (o componente é recriado a cada login)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acoes = {
    // clientes
    criarCliente: async (corpo: Corpo) => {
      const novo = await api.criarCliente(token, corpo);
      atualizar("clientes", (l) => [...l, novo]);
    },
    editarCliente: async (id: Id, corpo: Corpo) => {
      const editado = await api.editarCliente(token, id, corpo);
      atualizar("clientes", (l) => trocarPorId(l, id, editado));
    },
    excluirCliente: async (id: Id) => {
      await api.excluirCliente(token, id);
      atualizar("clientes", (l) => l.filter((c) => c.id !== id));
      atualizar("veiculos", (l) => l.filter((v) => v.clienteId !== id)); // o banco apaga os veículos junto
    },

    // veículos
    criarVeiculo: async (corpo: Corpo) => {
      const novo = await api.criarVeiculo(token, corpo);
      atualizar("veiculos", (l) => [...l, novo]);
      return novo;
    },
    editarVeiculo: async (id: Id, corpo: Corpo) => {
      const editado = await api.editarVeiculo(token, id, corpo);
      atualizar("veiculos", (l) => trocarPorId(l, id, editado));
    },
    excluirVeiculo: async (id: Id) => {
      await api.excluirVeiculo(token, id);
      atualizar("veiculos", (l) => l.filter((v) => v.id !== id));
    },

    // catálogo de serviços
    criarServico: async (corpo: Corpo) => {
      const novo = await api.criarServico(token, corpo);
      atualizar("servicos", (l) => [...l, novo]);
    },
    editarServico: async (id: Id, corpo: Corpo) => {
      const editado = await api.editarServico(token, id, corpo);
      atualizar("servicos", (l) => trocarPorId(l, id, editado));
    },
    excluirServico: async (id: Id) => {
      await api.excluirServico(token, id);
      atualizar("servicos", (l) => l.filter((s) => s.id !== id));
    },

    // estoque
    criarProduto: async (corpo: Parameters<typeof api.criarProduto>[1]) => {
      const novo = await api.criarProduto(token, corpo);
      atualizar("produtos", (l) => [...l, novo]);
    },
    editarProduto: async (id: Id, corpo: Parameters<typeof api.editarProduto>[2]) => {
      const editado = await api.editarProduto(token, id, corpo);
      atualizar("produtos", (l) => trocarPorId(l, id, editado));
    },
    excluirProduto: async (id: Id) => {
      await api.excluirProduto(token, id);
      atualizar("produtos", (l) => l.filter((p) => p.id !== id));
    },

    // ordens de serviço
    criarOrdem: async (corpo: Corpo) => {
      const nova = await api.criarOrdem(token, corpo);
      atualizar("ordens", (l) => [nova, ...l]);
      substituir("produtos", await api.listarProdutos(token)); // reflete a baixa de estoque feita pelo servidor
      return nova;
    },
    mudarStatusOrdem: async (id: Id, status: StatusOS) => mesclarOrdem(id, await api.mudarStatusOrdem(token, id, status)),
    salvarMecanicoOrdem: async (id: Id, mecanicoId: Id | null) => mesclarOrdem(id, await api.salvarMecanicoOrdem(token, id, mecanicoId)),
    salvarObservacoesOrdem: async (id: Id, observacoes: string) => mesclarOrdem(id, await api.salvarObservacoesOrdem(token, id, observacoes)),
    salvarSinalOrdem: async (id: Id, sinal: number) => mesclarOrdem(id, await api.salvarSinalOrdem(token, id, sinal)),
    finalizarOrdem: async (id: Id, corpo: Corpo) => {
      await api.finalizarOrdem(token, id, corpo);
      substituir("ordens", await api.listarOrdens(token));
      if (podeFinanceiro) substituir("pagamentos", await api.listarPagamentos(token));
    },
    excluirOrdem: async (id: Id) => {
      await api.excluirOrdem(token, id);
      atualizar("ordens", (l) => l.filter((o) => o.id !== id));
      atualizar("pagamentos", (l) => l.filter((p) => p.osId !== id));
      substituir("produtos", await api.listarProdutos(token)); // reflete a devolução de estoque
    },

    // financeiro
    lancarPagamento: async (corpo: Parameters<typeof api.lancarPagamento>[1]) => {
      const novo = await api.lancarPagamento(token, corpo);
      atualizar("pagamentos", (l) => [...l, novo]);
    },
    marcarPago: async (id: Id, corpo: Parameters<typeof api.marcarPago>[2]) => {
      const pago = await api.marcarPago(token, id, corpo);
      atualizar("pagamentos", (l) => trocarPorId(l, id, pago));
    },
    estornarPagamento: async (id: Id) => {
      const estornado = await api.estornarPagamento(token, id);
      atualizar("pagamentos", (l) => trocarPorId(l, id, estornado));
    },

    // despesas (carregadas sob demanda, só quando a aba é aberta)
    carregarDespesas: async () => substituir("despesas", await api.listarDespesas(token)),
    criarDespesa: async (corpo: Corpo) => {
      const nova = await api.criarDespesa(token, corpo);
      atualizar("despesas", (l) => [...l, nova]);
    },
    excluirDespesa: async (id: Id) => {
      await api.excluirDespesa(token, id);
      atualizar("despesas", (l) => l.filter((d) => d.id !== id));
    },

    // equipe
    criarUsuario: async (corpo: Corpo) => {
      const novo = await api.criarUsuario(token, corpo);
      atualizar("usuarios", (l) => [...l, novo]);
    },
    removerUsuario: async (id: Id) => {
      await api.removerUsuario(token, id);
      atualizar("usuarios", (l) => l.filter((u) => u.id !== id));
    },

    // dados da oficina e assinatura
    atualizarOficina: async (corpo: Corpo) => substituir("oficina", await api.atualizarOficina(token, corpo)),
    verAssinatura: () => api.verAssinatura(token),
    listarCobrancasAssinatura: () => api.listarCobrancasAssinatura(token),
    configurarAssinatura: () => api.configurarAssinatura(token),
    cancelarAssinatura: () => api.cancelarAssinatura(token),

    // auditoria (carregada sob demanda)
    carregarAuditoria: async (usuarioId?: Id) => substituir("auditoria", await api.listarAuditoria(token, usuarioId)),

    // alerta de whatsapp
    registrarAlerta: async (clienteId: Id, veiculoId: Id) => {
      const novo = await api.registrarAlerta(token, { clienteId, veiculoId });
      atualizar("alertas", (l) => [novo, ...l]);
    },
  };

  const actions = protegerAcoes(acoes, setBloqueio);

  // usado pela tela de bloqueio
  async function reativarAssinatura() {
    await api.configurarAssinatura(token);
    await carregar();
  }

  return { dados, carregando, bloqueio, recarregar: carregar, reativarAssinatura, actions };
}

export type AcoesDaOficina = ReturnType<typeof useDadosOficina>["actions"];
