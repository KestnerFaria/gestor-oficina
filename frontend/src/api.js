// ============================================================
// CLIENTE DE API — fala com o backend (oficina-backend)
// ============================================================
// Troque pela URL do seu backend quando publicar (Railway/Render).
const API_BASE = "https://backend-production-1ac5e.up.railway.app";

// O banco fala snake_case (nome_da_coluna), o front-end fala camelCase
// (nomeDaVariavel). Essa função converte automaticamente toda resposta
// da API, pra não precisar reescrever o app inteiro por causa disso.
function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        toCamel(v),
      ])
    );
  }
  return obj;
}

async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    const erro = new Error(dados?.mensagem || dados?.erro || `erro na requisição (${resposta.status})`);
    erro.codigo = dados?.erro; // ex: "assinatura_pendente" — usado pra mostrar uma tela específica
    erro.status = resposta.status;
    throw erro;
  }
  return toCamel(dados);
}

// ------------------------------------------------------------
// pequenos adaptadores pra manter os nomes que o resto do app já usa
// (assim não precisamos reescrever componentes por causa de nomes)
// ------------------------------------------------------------
function adaptarOrdem(o) {
  if (!o) return o;
  return { ...o, descricao: o.descricaoProblema, km: o.kmEntrada };
}

function adaptarProduto(p) {
  if (!p) return p;
  return { ...p, quantidade: p.quantidadeEstoque };
}
function paraApiProduto(dados) {
  const { quantidade, ...resto } = dados;
  return { ...resto, quantidadeEstoque: quantidade };
}

function adaptarPagamento(p) {
  if (!p) return p;
  return { ...p, comprovante: p.comprovanteUrl ? { nome: "comprovante", tipo: "", dados: p.comprovanteUrl } : null };
}
function paraApiPagamento(dados) {
  const { comprovante, ...resto } = dados;
  return { ...resto, comprovante: comprovante?.dados || null };
}

function adaptarAuditoria(a) {
  if (!a) return a;
  return { ...a, em: a.criadoEm };
}

export const api = {
  // ---- auth ----
  cadastrarOficina: (body) => apiFetch("/auth/cadastrar-oficina", { method: "POST", body }),
  loginEquipe: (body) => apiFetch("/auth/login-equipe", { method: "POST", body }),
  loginCliente: (body) => apiFetch("/auth/login-cliente", { method: "POST", body }),

  // ---- oficina ----
  minhaOficina: (token) => apiFetch("/oficinas/minha", { token }),
  atualizarOficina: (token, body) => apiFetch("/oficinas/minha", { method: "PUT", token, body }),
  verAssinatura: (token) => apiFetch("/oficinas/minha/assinatura", { token }),
  configurarAssinatura: (token) => apiFetch("/oficinas/minha/assinatura/configurar", { method: "POST", token }),

  // ---- equipe ----
  listarEquipe: (token) => apiFetch("/equipe", { token }),
  criarUsuario: (token, body) => apiFetch("/equipe", { method: "POST", token, body }),
  removerUsuario: (token, id) => apiFetch(`/equipe/${id}`, { method: "DELETE", token }),

  // ---- clientes ----
  listarClientes: (token) => apiFetch("/clientes", { token }),
  criarCliente: (token, body) => apiFetch("/clientes", { method: "POST", token, body }),
  editarCliente: (token, id, body) => apiFetch(`/clientes/${id}`, { method: "PUT", token, body }),
  excluirCliente: (token, id) => apiFetch(`/clientes/${id}`, { method: "DELETE", token }),

  // ---- veiculos ----
  listarVeiculos: (token) => apiFetch("/veiculos", { token }),
  criarVeiculo: (token, body) => apiFetch("/veiculos", { method: "POST", token, body }),
  editarVeiculo: (token, id, body) => apiFetch(`/veiculos/${id}`, { method: "PUT", token, body }),
  excluirVeiculo: (token, id) => apiFetch(`/veiculos/${id}`, { method: "DELETE", token }),

  // ---- servicos ----
  listarServicos: (token) => apiFetch("/servicos", { token }),
  criarServico: (token, body) => apiFetch("/servicos", { method: "POST", token, body }),
  editarServico: (token, id, body) => apiFetch(`/servicos/${id}`, { method: "PUT", token, body }),
  excluirServico: (token, id) => apiFetch(`/servicos/${id}`, { method: "DELETE", token }),

  // ---- produtos / estoque ----
  listarProdutos: async (token) => (await apiFetch("/produtos", { token })).map(adaptarProduto),
  criarProduto: async (token, body) => adaptarProduto(await apiFetch("/produtos", { method: "POST", token, body: paraApiProduto(body) })),
  editarProduto: async (token, id, body) => adaptarProduto(await apiFetch(`/produtos/${id}`, { method: "PUT", token, body: paraApiProduto(body) })),
  excluirProduto: (token, id) => apiFetch(`/produtos/${id}`, { method: "DELETE", token }),

  // ---- ordens de serviço ----
  listarOrdens: async (token) => (await apiFetch("/ordens", { token })).map(adaptarOrdem),
  criarOrdem: async (token, body) => adaptarOrdem(await apiFetch("/ordens", { method: "POST", token, body })),
  mudarStatusOrdem: async (token, id, status) => adaptarOrdem(await apiFetch(`/ordens/${id}/status`, { method: "PATCH", token, body: { status } })),
  salvarMecanicoOrdem: async (token, id, mecanicoId) => adaptarOrdem(await apiFetch(`/ordens/${id}/mecanico`, { method: "PATCH", token, body: { mecanicoId } })),
  salvarObservacoesOrdem: async (token, id, observacoesMecanico) => adaptarOrdem(await apiFetch(`/ordens/${id}/observacoes`, { method: "PATCH", token, body: { observacoesMecanico } })),
  salvarSinalOrdem: async (token, id, sinal) => adaptarOrdem(await apiFetch(`/ordens/${id}/sinal`, { method: "PATCH", token, body: { sinal } })),
  finalizarOrdem: (token, id, body) => apiFetch(`/ordens/${id}/finalizar`, { method: "POST", token, body }),
  excluirOrdem: (token, id) => apiFetch(`/ordens/${id}`, { method: "DELETE", token }),

  // ---- pagamentos ----
  listarPagamentos: async (token) => (await apiFetch("/pagamentos", { token })).map(adaptarPagamento),
  lancarPagamento: async (token, body) => adaptarPagamento(await apiFetch("/pagamentos", { method: "POST", token, body: paraApiPagamento(body) })),
  marcarPago: async (token, id, body) => adaptarPagamento(await apiFetch(`/pagamentos/${id}/pagar`, { method: "PATCH", token, body: paraApiPagamento(body) })),
  estornarPagamento: async (token, id) => adaptarPagamento(await apiFetch(`/pagamentos/${id}/estornar`, { method: "PATCH", token })),

  // ---- despesas ----
  listarDespesas: (token) => apiFetch("/despesas", { token }),
  criarDespesa: (token, body) => apiFetch("/despesas", { method: "POST", token, body }),
  excluirDespesa: (token, id) => apiFetch(`/despesas/${id}`, { method: "DELETE", token }),

  // ---- auditoria ----
  listarAuditoria: async (token, usuarioId) =>
    (await apiFetch(`/auditoria${usuarioId ? `?usuarioId=${usuarioId}` : ""}`, { token })).map(adaptarAuditoria),

  // ---- portal do cliente ----
  minhasOrdensCliente: async (token) => (await apiFetch("/portal/minhas-ordens", { token })).map(adaptarOrdem),
  meusPagamentosCliente: async (token) => (await apiFetch("/portal/meus-pagamentos", { token })).map(adaptarPagamento),

  // ---- alertas de whatsapp ----
  listarAlertas: (token) => apiFetch("/alertas-whatsapp", { token }),
  registrarAlerta: (token, body) => apiFetch("/alertas-whatsapp", { method: "POST", token, body }),
};