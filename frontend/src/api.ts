// ============================================================
// CLIENTE DE API — fala com o backend (oficina-backend)
// ============================================================
// A URL vem da variável VITE_API_URL (arquivo .env.local no seu PC ou
// "Environment Variables" na Vercel). Se não estiver definida, usa o
// backend de produção.
const API_BASE: string = import.meta.env.VITE_API_URL || "https://backend-production-1ac5e.up.railway.app";

// ------------------------------------------------------------
// Tipos do domínio (já em camelCase, como o app usa)
// ------------------------------------------------------------
export type PerfilUsuario = "admin" | "atendente" | "mecanico";
export type StatusOS = "orcamento" | "aberta" | "em_andamento" | "aguardando_peca" | "concluida" | "entregue" | "cancelada";
export type StatusAssinatura = "trial" | "ativa" | "atrasada" | "cancelada" | "pendente_configuracao";
export type FormaPagamento = "dinheiro" | "cartao" | "pix";
export type Id = number;

export interface Oficina {
  id: Id;
  nome: string;
  cnpj: string | null;
  telefone: string;
  endereco: string | null;
  logoUrl: string | null;
}

export interface Usuario {
  id: Id;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  oficinaId?: Id;
}

export interface Cliente {
  id: Id;
  nome: string;
  telefone: string;
  cpf: string | null;
  endereco: string | null;
  email: string | null;
}

export interface Veiculo {
  id: Id;
  clienteId: Id;
  placa: string;
  marca: string | null;
  modelo: string;
  ano: number | null;
  cor: string | null;
  kmAtual: number | null;
}

export interface Servico {
  id: Id;
  nome: string;
  preco: number;
}

export interface Produto {
  id: Id;
  nome: string;
  quantidadeEstoque: number;
  /** alias usado pelas telas antigas */
  quantidade: number;
  estoqueMinimo: number;
  precoVenda: number;
  precoCusto: number;
}

export interface PecaUtilizada {
  produtoId: Id;
  quantidade: number;
}

export interface Ordem {
  id: Id;
  numero: string;
  clienteId: Id;
  veiculoId: Id;
  mecanicoId: Id | null;
  status: StatusOS;
  kmEntrada: string | null;
  descricaoProblema: string;
  observacoesMecanico: string | null;
  sinal: number;
  valorTotal: number;
  dataSaida: string | null;
  criadoEm: string;
  clienteNome?: string;
  veiculoModelo?: string;
  veiculoPlaca?: string;
  veiculoAno?: number | null;
  servicosIds?: Id[];
  pecasUtilizadas?: PecaUtilizada[];
  /** aliases usados pelas telas antigas */
  descricao: string;
  km: string | null;
}

export interface Comprovante {
  nome: string;
  tipo: string;
  dados: string;
}

export interface Pagamento {
  id: Id;
  osId: Id;
  valor: number;
  vencimento: string; // AAAA-MM-DD
  pagoEm: string | null; // AAAA-MM-DD
  forma: FormaPagamento | null;
  documento: string | null;
  comprovanteUrl: string | null;
  comprovante: Comprovante | null;
  osNumero?: string;
  clienteNome?: string;
}

export interface Despesa {
  id: Id;
  descricao: string;
  categoria: string;
  valor: number;
  dataVencimento: string | null;
  fixa: boolean;
}

export interface RegistroAuditoria {
  id: Id;
  usuarioId: Id | null;
  usuarioNome: string | null;
  acao: string;
  entidade: string;
  detalhe: string | null;
  criadoEm: string;
  /** alias usado pelas telas antigas */
  em: string;
}

export interface Assinatura {
  status: StatusAssinatura;
  valor: number;
  trialTerminaEm: string | null;
}

export interface CobrancaAssinatura {
  id: string;
  vencimento: string;
  valor: number;
  status: string;
  pagoEm: string | null;
  formaPagamento: string;
  linkPagamento: string;
}

export interface AlertaWhatsapp {
  id: Id;
  clienteId: Id;
  veiculoId: Id;
  enviadoEm: string;
}

export interface LoginEquipeResposta {
  token: string;
  usuario: Usuario;
}

export interface LoginClienteResposta {
  token: string;
  cliente: { id: Id; nome: string; email: string; oficinaId: Id };
}

export interface CadastroOficinaResposta {
  token: string;
  usuario: Usuario;
  oficina: Oficina;
}

// Erro com o código que o backend manda (ex: "assinatura_pendente")
export class ApiError extends Error {
  codigo?: string;
  status: number;

  constructor(mensagem: string, status: number, codigo?: string) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.codigo = codigo;
  }
}

// ------------------------------------------------------------
// Conversão snake_case (banco) → camelCase (front-end)
// ------------------------------------------------------------
// O banco fala snake_case (nome_da_coluna), o front-end fala camelCase
// (nomeDaVariavel). Essa função converte automaticamente toda resposta
// da API, pra não precisar reescrever o app inteiro por causa disso.
function toCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), toCamel(v)])
    );
  }
  return obj;
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function apiFetch<T>(path: string, { method = "GET", body, token }: { method?: Metodo; body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const texto = await resposta.text();
  const dados = texto ? (JSON.parse(texto) as { mensagem?: string; erro?: string } | null) : null;

  if (!resposta.ok) {
    throw new ApiError(
      dados?.mensagem || dados?.erro || `erro na requisição (${resposta.status})`,
      resposta.status,
      dados?.erro // ex: "assinatura_pendente" — usado pra mostrar uma tela específica
    );
  }
  return toCamel(dados) as T;
}

// ------------------------------------------------------------
// pequenos adaptadores pra manter os nomes que o resto do app já usa
// (assim não precisamos reescrever componentes por causa de nomes)
// ------------------------------------------------------------
function adaptarOrdem(o: Ordem): Ordem {
  return { ...o, descricao: o.descricaoProblema, km: o.kmEntrada };
}

function adaptarProduto(p: Produto): Produto {
  return { ...p, quantidade: p.quantidadeEstoque };
}
type ProdutoForm = Partial<Omit<Produto, "id" | "quantidadeEstoque">>;
function paraApiProduto(dados: ProdutoForm) {
  const { quantidade, ...resto } = dados;
  return { ...resto, quantidadeEstoque: quantidade };
}

function adaptarPagamento(p: Pagamento): Pagamento {
  return { ...p, comprovante: p.comprovanteUrl ? { nome: "comprovante", tipo: "", dados: p.comprovanteUrl } : null };
}
type PagamentoForm = Record<string, unknown> & { comprovante?: Comprovante | null };
function paraApiPagamento(dados: PagamentoForm) {
  const { comprovante, ...resto } = dados;
  return { ...resto, comprovante: comprovante?.dados || null };
}

function adaptarAuditoria(a: RegistroAuditoria): RegistroAuditoria {
  return { ...a, em: a.criadoEm };
}

type Corpo = Record<string, unknown>;

export const api = {
  // ---- auth ----
  cadastrarOficina: (body: Corpo) => apiFetch<CadastroOficinaResposta>("/auth/cadastrar-oficina", { method: "POST", body }),
  loginEquipe: (body: { email: string; senha: string }) => apiFetch<LoginEquipeResposta>("/auth/login-equipe", { method: "POST", body }),
  loginCliente: (body: { email: string; senha: string }) => apiFetch<LoginClienteResposta>("/auth/login-cliente", { method: "POST", body }),

  // ---- oficina e assinatura ----
  minhaOficina: (token: string) => apiFetch<Oficina | null>("/oficinas/minha", { token }),
  atualizarOficina: (token: string, body: Corpo) => apiFetch<Oficina>("/oficinas/minha", { method: "PUT", token, body }),
  verAssinatura: (token: string) => apiFetch<Assinatura | null>("/oficinas/minha/assinatura", { token }),
  listarCobrancasAssinatura: (token: string) => apiFetch<CobrancaAssinatura[]>("/oficinas/minha/assinatura/cobrancas", { token }),
  configurarAssinatura: (token: string) => apiFetch<{ ok: true }>("/oficinas/minha/assinatura/configurar", { method: "POST", token }),
  cancelarAssinatura: (token: string) => apiFetch<{ ok: true }>("/oficinas/minha/assinatura/cancelar", { method: "POST", token }),

  // ---- equipe ----
  listarEquipe: (token: string) => apiFetch<Usuario[]>("/equipe", { token }),
  criarUsuario: (token: string, body: Corpo) => apiFetch<Usuario>("/equipe", { method: "POST", token, body }),
  removerUsuario: (token: string, id: Id) => apiFetch<null>(`/equipe/${id}`, { method: "DELETE", token }),

  // ---- clientes ----
  listarClientes: (token: string) => apiFetch<Cliente[]>("/clientes", { token }),
  criarCliente: (token: string, body: Corpo) => apiFetch<Cliente>("/clientes", { method: "POST", token, body }),
  editarCliente: (token: string, id: Id, body: Corpo) => apiFetch<Cliente>(`/clientes/${id}`, { method: "PUT", token, body }),
  excluirCliente: (token: string, id: Id) => apiFetch<null>(`/clientes/${id}`, { method: "DELETE", token }),

  // ---- veiculos ----
  listarVeiculos: (token: string) => apiFetch<Veiculo[]>("/veiculos", { token }),
  criarVeiculo: (token: string, body: Corpo) => apiFetch<Veiculo>("/veiculos", { method: "POST", token, body }),
  editarVeiculo: (token: string, id: Id, body: Corpo) => apiFetch<Veiculo>(`/veiculos/${id}`, { method: "PUT", token, body }),
  excluirVeiculo: (token: string, id: Id) => apiFetch<null>(`/veiculos/${id}`, { method: "DELETE", token }),

  // ---- servicos ----
  listarServicos: (token: string) => apiFetch<Servico[]>("/servicos", { token }),
  criarServico: (token: string, body: Corpo) => apiFetch<Servico>("/servicos", { method: "POST", token, body }),
  editarServico: (token: string, id: Id, body: Corpo) => apiFetch<Servico>(`/servicos/${id}`, { method: "PUT", token, body }),
  excluirServico: (token: string, id: Id) => apiFetch<null>(`/servicos/${id}`, { method: "DELETE", token }),

  // ---- produtos / estoque ----
  listarProdutos: async (token: string) => (await apiFetch<Produto[]>("/produtos", { token })).map(adaptarProduto),
  criarProduto: async (token: string, body: ProdutoForm) =>
    adaptarProduto(await apiFetch<Produto>("/produtos", { method: "POST", token, body: paraApiProduto(body) })),
  editarProduto: async (token: string, id: Id, body: ProdutoForm) =>
    adaptarProduto(await apiFetch<Produto>(`/produtos/${id}`, { method: "PUT", token, body: paraApiProduto(body) })),
  excluirProduto: (token: string, id: Id) => apiFetch<null>(`/produtos/${id}`, { method: "DELETE", token }),

  // ---- ordens de serviço ----
  listarOrdens: async (token: string) => (await apiFetch<Ordem[]>("/ordens", { token })).map(adaptarOrdem),
  criarOrdem: async (token: string, body: Corpo) => adaptarOrdem(await apiFetch<Ordem>("/ordens", { method: "POST", token, body })),
  mudarStatusOrdem: async (token: string, id: Id, status: StatusOS) =>
    adaptarOrdem(await apiFetch<Ordem>(`/ordens/${id}/status`, { method: "PATCH", token, body: { status } })),
  salvarMecanicoOrdem: async (token: string, id: Id, mecanicoId: Id | null) =>
    adaptarOrdem(await apiFetch<Ordem>(`/ordens/${id}/mecanico`, { method: "PATCH", token, body: { mecanicoId } })),
  salvarObservacoesOrdem: async (token: string, id: Id, observacoesMecanico: string) =>
    adaptarOrdem(await apiFetch<Ordem>(`/ordens/${id}/observacoes`, { method: "PATCH", token, body: { observacoesMecanico } })),
  salvarSinalOrdem: async (token: string, id: Id, sinal: number) =>
    adaptarOrdem(await apiFetch<Ordem>(`/ordens/${id}/sinal`, { method: "PATCH", token, body: { sinal } })),
  finalizarOrdem: (token: string, id: Id, body: Corpo) => apiFetch<{ ok: true }>(`/ordens/${id}/finalizar`, { method: "POST", token, body }),
  excluirOrdem: (token: string, id: Id) => apiFetch<null>(`/ordens/${id}`, { method: "DELETE", token }),

  // ---- pagamentos ----
  listarPagamentos: async (token: string) => (await apiFetch<Pagamento[]>("/pagamentos", { token })).map(adaptarPagamento),
  lancarPagamento: async (token: string, body: PagamentoForm) =>
    adaptarPagamento(await apiFetch<Pagamento>("/pagamentos", { method: "POST", token, body: paraApiPagamento(body) })),
  marcarPago: async (token: string, id: Id, body: PagamentoForm) =>
    adaptarPagamento(await apiFetch<Pagamento>(`/pagamentos/${id}/pagar`, { method: "PATCH", token, body: paraApiPagamento(body) })),
  estornarPagamento: async (token: string, id: Id) =>
    adaptarPagamento(await apiFetch<Pagamento>(`/pagamentos/${id}/estornar`, { method: "PATCH", token })),

  // ---- despesas ----
  listarDespesas: (token: string) => apiFetch<Despesa[]>("/despesas", { token }),
  criarDespesa: (token: string, body: Corpo) => apiFetch<Despesa>("/despesas", { method: "POST", token, body }),
  excluirDespesa: (token: string, id: Id) => apiFetch<null>(`/despesas/${id}`, { method: "DELETE", token }),

  // ---- auditoria ----
  listarAuditoria: async (token: string, usuarioId?: Id) =>
    (await apiFetch<RegistroAuditoria[]>(`/auditoria${usuarioId ? `?usuarioId=${usuarioId}` : ""}`, { token })).map(adaptarAuditoria),

  // ---- portal do cliente ----
  minhasOrdensCliente: async (token: string) => (await apiFetch<Ordem[]>("/portal/minhas-ordens", { token })).map(adaptarOrdem),
  meusPagamentosCliente: async (token: string) => (await apiFetch<Pagamento[]>("/portal/meus-pagamentos", { token })).map(adaptarPagamento),

  // ---- alertas de whatsapp ----
  listarAlertas: (token: string) => apiFetch<AlertaWhatsapp[]>("/alertas-whatsapp", { token }),
  registrarAlerta: (token: string, body: { clienteId: Id; veiculoId: Id }) =>
    apiFetch<AlertaWhatsapp>("/alertas-whatsapp", { method: "POST", token, body }),
};
