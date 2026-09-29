import { useState, useMemo, useEffect } from "react";
import { api } from "./api";
import { agoraISO, fmtData, fmtDataHora, hojeISO } from "./utils/datas";
import { CATEGORIAS_DESPESA, FORMAS, STATUS_LABEL, STATUS_TONE } from "./constants";

// ---------- estilo / tokens ----------
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area {
    position: absolute !important; top: 0 !important; left: 0 !important;
    width: 100% !important; margin: 0 !important; border: none !important;
    padding: 0 !important; background: #fff !important; box-shadow: none !important;
  }
  .no-print { display: none !important; }
  body { background: #fff !important; }
}
`;

const C = {
  bg: "#F1EFE8",
  surface: "#FFFFFF",
  ink: "#20242A",
  inkSoft: "#5B6169",
  muted: "#8A8F97",
  border: "#DCD8CE",
  accent: "#E0611F",
  accentDark: "#A9430F",
  accentBg: "#FCE6D6",
  ok: "#2F6E4F",
  okBg: "#E1EFE6",
  warn: "#B8862E",
  warnBg: "#FBEFD8",
  danger: "#B23A2E",
  dangerBg: "#F8E1DD",
  steel: "#3A4048",
};

function Badge({ children, tone = "muted" }) {
  const map = {
    ok: { bg: C.okBg, fg: C.ok },
    warn: { bg: C.warnBg, fg: C.warn },
    danger: { bg: C.dangerBg, fg: C.danger },
    accent: { bg: C.accentBg, fg: C.accentDark },
    muted: { bg: "#ECEAE3", fg: C.inkSoft },
  };
  const t = map[tone];
  return (
    <span style={{ background: t.bg, color: t.fg, fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 500, letterSpacing: 0.3, textTransform: "uppercase", padding: "3px 9px", borderRadius: 3, display: "inline-block" }}>
      {children}
    </span>
  );
}

function Plate({ placa }) {
  return (
    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, fontWeight: 500, color: C.ink, background: "#fff", border: `1.5px solid ${C.steel}`, borderRadius: 3, padding: "2px 7px", letterSpacing: 1 }}>
      {placa}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 11px",
  fontSize: 14,
  fontFamily: "Inter, sans-serif",
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  background: "#fff",
  color: C.ink,
  outline: "none",
};

const btnBase = {
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  fontWeight: 500,
  padding: "9px 16px",
  borderRadius: 5,
  cursor: "pointer",
  border: `1px solid ${C.border}`,
  background: "#fff",
  color: C.ink,
};

const btnPrimary = { ...btnBase, background: C.accent, borderColor: C.accent, color: "#fff" };

// ============================================================
// APP RAIZ — autenticação + carregamento de dados via API
// ============================================================
export default function OficinaApp() {
  const [sessao, setSessao] = useState(null); // { tipo, token, usuario|cliente }
  const [tela, setTela] = useState("login"); // login | cadastro
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [bloqueioAssinatura, setBloqueioAssinatura] = useState(null); // { mensagem } | null

  const [oficina, setOficina] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [alertasWhatsapp, setAlertasWhatsapp] = useState([]);

  // dados do portal do cliente (separados, pois o cliente só vê os próprios)
  const [minhasOrdensCliente, setMinhasOrdensCliente] = useState([]);
  const [meusPagamentosCliente, setMeusPagamentosCliente] = useState([]);

  // restaura a sessão salva ao abrir o app, pra não precisar logar de novo a cada F5
  useEffect(() => {
    const salvo = localStorage.getItem("oficina_sessao");
    if (salvo) {
      try { setSessao(JSON.parse(salvo)); } catch { localStorage.removeItem("oficina_sessao"); }
    }
  }, []);

  function entrar(nova) {
    setSessao(nova);
    localStorage.setItem("oficina_sessao", JSON.stringify(nova));
  }

  function sair() {
    setSessao(null);
    localStorage.removeItem("oficina_sessao");
  }

  useEffect(() => {
    if (sessao?.tipo === "equipe") carregarDadosDaOficina();
    if (sessao?.tipo === "cliente") carregarDadosDoCliente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  async function carregarDadosDaOficina() {
    setCarregando(true);
    setErroCarregamento("");
    setBloqueioAssinatura(null);
    const token = sessao.token;
    try {
      const podeFinanceiro = ["admin", "atendente"].includes(sessao.usuario.perfil);
      const [of, us, cl, ve, se, pr, or_, al] = await Promise.all([
        api.minhaOficina(token),
        api.listarEquipe(token),
        api.listarClientes(token),
        api.listarVeiculos(token),
        api.listarServicos(token),
        api.listarProdutos(token),
        api.listarOrdens(token),
        api.listarAlertas(token),
      ]);
      setOficina(of); setUsuarios(us); setClientes(cl); setVeiculos(ve);
      setServicos(se); setProdutos(pr); setOrdens(or_); setAlertasWhatsapp(al);

      if (podeFinanceiro) setPagamentos(await api.listarPagamentos(token));
    } catch (e) {
      if (e.codigo === "assinatura_pendente") {
        setBloqueioAssinatura({ mensagem: e.message, status: e.assinaturaStatus });
      } else {
        setErroCarregamento(e.message);
        sair();
      }
    } finally {
      setCarregando(false);
    }
  }

  async function carregarDadosDoCliente() {
    setCarregando(true);
    setErroCarregamento("");
    const token = sessao.token;
    try {
      const [of, os_, pg] = await Promise.all([
        api.minhaOficina(token),
        api.minhasOrdensCliente(token),
        api.meusPagamentosCliente(token),
      ]);
      setOficina(of); setMinhasOrdensCliente(os_); setMeusPagamentosCliente(pg);
    } catch (e) {
      setErroCarregamento(e.message);
      sair();
    } finally {
      setCarregando(false);
    }
  }

  // ---- ações que falam com a API e atualizam o estado local com a resposta ----
  const token = sessao?.token;

  const actions = {
    // clientes
    criarCliente: async (dados) => { const novo = await api.criarCliente(token, dados); setClientes((p) => [...p, novo]); },
    editarCliente: async (id, dados) => { const at = await api.editarCliente(token, id, dados); setClientes((p) => p.map((c) => (c.id === id ? at : c))); },
    excluirCliente: async (id) => { await api.excluirCliente(token, id); setClientes((p) => p.filter((c) => c.id !== id)); setVeiculos((p) => p.filter((v) => v.clienteId !== id)); },

    // veículos
    criarVeiculo: async (dados) => { const novo = await api.criarVeiculo(token, dados); setVeiculos((p) => [...p, novo]); return novo; },
    editarVeiculo: async (id, dados) => { const at = await api.editarVeiculo(token, id, dados); setVeiculos((p) => p.map((v) => (v.id === id ? at : v))); },
    excluirVeiculo: async (id) => { await api.excluirVeiculo(token, id); setVeiculos((p) => p.filter((v) => v.id !== id)); },

    // catálogo de serviços
    criarServico: async (dados) => { const novo = await api.criarServico(token, dados); setServicos((p) => [...p, novo]); },
    editarServico: async (id, dados) => { const at = await api.editarServico(token, id, dados); setServicos((p) => p.map((s) => (s.id === id ? at : s))); },
    excluirServico: async (id) => { await api.excluirServico(token, id); setServicos((p) => p.filter((s) => s.id !== id)); },

    // estoque
    criarProduto: async (dados) => { const novo = await api.criarProduto(token, dados); setProdutos((p) => [...p, novo]); },
    editarProduto: async (id, dados) => { const at = await api.editarProduto(token, id, dados); setProdutos((p) => p.map((x) => (x.id === id ? at : x))); },
    excluirProduto: async (id) => { await api.excluirProduto(token, id); setProdutos((p) => p.filter((x) => x.id !== id)); },

    // ordens de serviço
    criarOrdem: async (dados) => {
      const nova = await api.criarOrdem(token, dados);
      setOrdens((p) => [nova, ...p]);
      setProdutos(await api.listarProdutos(token)); // reflete a baixa de estoque feita pelo servidor
      return nova;
    },
    mudarStatusOrdem: async (id, status) => { const at = await api.mudarStatusOrdem(token, id, status); setOrdens((p) => p.map((o) => (o.id === id ? { ...o, ...at } : o))); },
    salvarMecanicoOrdem: async (id, mecanicoId) => { const at = await api.salvarMecanicoOrdem(token, id, mecanicoId); setOrdens((p) => p.map((o) => (o.id === id ? { ...o, ...at } : o))); },
    salvarObservacoesOrdem: async (id, obs) => { const at = await api.salvarObservacoesOrdem(token, id, obs); setOrdens((p) => p.map((o) => (o.id === id ? { ...o, ...at } : o))); },
    salvarSinalOrdem: async (id, sinal) => { const at = await api.salvarSinalOrdem(token, id, sinal); setOrdens((p) => p.map((o) => (o.id === id ? { ...o, ...at } : o))); },
    finalizarOrdem: async (id, dados) => {
      await api.finalizarOrdem(token, id, dados);
      setOrdens(await api.listarOrdens(token));
      if (["admin", "atendente"].includes(sessao.usuario.perfil)) setPagamentos(await api.listarPagamentos(token));
    },
    excluirOrdem: async (id) => {
      await api.excluirOrdem(token, id);
      setOrdens((p) => p.filter((o) => o.id !== id));
      setPagamentos((p) => p.filter((pg) => pg.osId !== id));
      setProdutos(await api.listarProdutos(token)); // reflete a devolução de estoque
    },

    // financeiro
    lancarPagamento: async (dados) => { const novo = await api.lancarPagamento(token, dados); setPagamentos((p) => [...p, novo]); },
    marcarPago: async (id, dados) => { const at = await api.marcarPago(token, id, dados); setPagamentos((p) => p.map((x) => (x.id === id ? at : x))); },
    estornarPagamento: async (id) => { const at = await api.estornarPagamento(token, id); setPagamentos((p) => p.map((x) => (x.id === id ? at : x))); },

    // despesas (carregadas sob demanda, só quando a aba é aberta)
    carregarDespesas: async () => setDespesas(await api.listarDespesas(token)),
    criarDespesa: async (dados) => { const nova = await api.criarDespesa(token, dados); setDespesas((p) => [...p, nova]); },
    excluirDespesa: async (id) => { await api.excluirDespesa(token, id); setDespesas((p) => p.filter((d) => d.id !== id)); },

    // equipe
    criarUsuario: async (dados) => { const novo = await api.criarUsuario(token, dados); setUsuarios((p) => [...p, novo]); },
    removerUsuario: async (id) => { await api.removerUsuario(token, id); setUsuarios((p) => p.filter((u) => u.id !== id)); },

    // dados da oficina
    atualizarOficina: async (dados) => { const at = await api.atualizarOficina(token, dados); setOficina(at); },
    verAssinatura: async () => api.verAssinatura(token),
    listarCobrancasAssinatura: async () => api.listarCobrancasAssinatura(token),
    configurarAssinatura: async () => api.configurarAssinatura(token),
    cancelarAssinatura: async () => api.cancelarAssinatura(token),

    // auditoria (carregada sob demanda)
    carregarAuditoria: async (usuarioId) => setAuditoria(await api.listarAuditoria(token, usuarioId)),

    // alerta de whatsapp
    registrarAlerta: async (clienteId, veiculoId) => {
      const novo = await api.registrarAlerta(token, { clienteId, veiculoId });
      setAlertasWhatsapp((p) => [novo, ...p]);
    },
  };

  // qualquer ação que esbarrar numa assinatura atrasada/cancelada troca a
  // tela inteira pro aviso de cobrança, em vez de mostrar um erro solto
  // dentro do formulário que a pessoa estava usando.
  const actionsProtegidas = Object.fromEntries(
    Object.entries(actions).map(([nome, fn]) => [
      nome,
      async (...args) => {
        try {
          return await fn(...args);
        } catch (e) {
          if (e.codigo === "assinatura_pendente") {
            setBloqueioAssinatura({ mensagem: e.message, status: e.assinaturaStatus });
            return;
          }
          throw e;
        }
      },
    ])
  );

  if (!sessao && tela === "cadastro") {
    return <CadastroOficina onVoltar={() => setTela("login")} onCadastrado={(dados) => { entrar(dados); setTela("login"); }} />;
  }

  if (!sessao) {
    return <TelaLogin onEntrar={entrar} onCadastrar={() => setTela("cadastro")} />;
  }

  if (carregando && !oficina) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
        <style>{FONTS}</style>
        <div style={{ color: C.inkSoft, fontSize: 14 }}>carregando...</div>
      </div>
    );
  }

  if (bloqueioAssinatura && sessao.tipo === "equipe") {
    return (
      <TelaAssinaturaBloqueada
        mensagem={bloqueioAssinatura.mensagem}
        status={bloqueioAssinatura.status}
        onTentarNovamente={() => { setBloqueioAssinatura(null); carregarDadosDaOficina(); }}
        onReativar={async () => { await api.configurarAssinatura(token); setBloqueioAssinatura(null); await carregarDadosDaOficina(); }}
        onSair={sair}
      />
    );
  }

  if (erroCarregamento && !oficina) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 12, gap: 14 }}>
        <style>{FONTS}</style>
        <div style={{ color: C.danger, fontSize: 14 }}>{erroCarregamento}</div>
        <button style={btnPrimary} onClick={sair}>voltar ao login</button>
      </div>
    );
  }

  if (sessao.tipo === "cliente") {
    return (
      <PortalCliente
        cliente={sessao.cliente} oficina={oficina}
        ordens={minhasOrdensCliente} pagamentos={meusPagamentosCliente}
        onSair={sair}
      />
    );
  }

  return (
    <PainelOficina
      usuario={sessao.usuario} onSair={sair}
      oficina={oficina}
      usuarios={usuarios}
      clientes={clientes} veiculos={veiculos}
      servicos={servicos} produtos={produtos}
      ordens={ordens} pagamentos={pagamentos}
      despesas={despesas} auditoria={auditoria}
      alertasWhatsapp={alertasWhatsapp}
      actions={actionsProtegidas}
    />
  );
}

// ============================================================
// TELA DE ASSINATURA ATRASADA — bloqueia o uso até regularizar
// ============================================================
function TelaAssinaturaBloqueada({ mensagem, status, onTentarNovamente, onReativar, onSair }) {
  const [verificando, setVerificando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const cancelada = status === "cancelada";

  async function tentarNovamente() {
    setVerificando(true);
    setErroAcao("");
    try { await onTentarNovamente(); } catch (e) { setErroAcao(e.message); } finally { setVerificando(false); }
  }

  async function reativar() {
    setVerificando(true);
    setErroAcao("");
    try { await onReativar(); } catch (e) { setErroAcao(e.message); } finally { setVerificando(false); }
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.steel, minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 24 }}>
      <style>{FONTS}</style>
      <div style={{ width: 420 }}>
        <div style={{ background: C.surface, borderRadius: 10, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>{cancelada ? "🚫" : "⏸️"}</div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
            {cancelada ? "assinatura cancelada" : "assinatura pendente"}
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
            {mensagem || (cancelada
              ? "a assinatura desta oficina foi cancelada. reative para continuar usando o sistema."
              : "sua assinatura está atrasada. verifique o email de cobrança enviado pelo Asaas e regularize o pagamento pra continuar usando o sistema.")}
          </div>

          {erroAcao && <div style={{ fontSize: 12, color: C.danger, marginBottom: 14 }}>{erroAcao}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cancelada ? (
              <button style={btnPrimary} onClick={reativar} disabled={verificando}>
                {verificando ? "reativando..." : "reativar assinatura"}
              </button>
            ) : (
              <button style={btnPrimary} onClick={tentarNovamente} disabled={verificando}>
                {verificando ? "verificando..." : "já paguei, verificar novamente"}
              </button>
            )}
            <button style={btnBase} onClick={onSair}>sair</button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#9BA1A9", textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
          dúvidas sobre a cobrança? entre em contato com o suporte do sistema.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function TelaLogin({ onEntrar, onCadastrar }) {
  const [modo, setModo] = useState("equipe");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro("");
    setCarregando(true);
    try {
      if (modo === "equipe") {
        const { token, usuario } = await api.loginEquipe({ email, senha });
        onEntrar({ tipo: "equipe", token, usuario });
      } else {
        const { token, cliente } = await api.loginCliente({ email, senha });
        onEntrar({ tipo: "cliente", token, cliente });
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.steel, minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 24 }}>
      <style>{FONTS}</style>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, fontWeight: 600, color: "#fff", letterSpacing: 1 }}>GESTOR DE OFICINA</div>
          <div style={{ fontSize: 13, color: "#B4B9C0", marginTop: 4 }}>acesso restrito</div>
        </div>

        <div style={{ background: C.surface, borderRadius: 10, padding: 22 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, background: C.bg, padding: 4, borderRadius: 6 }}>
            {[["equipe", "sou da oficina"], ["cliente", "sou cliente"]].map(([id, label]) => (
              <button key={id} onClick={() => { setModo(id); setErro(""); setEmail(""); setSenha(""); }}
                style={{ ...btnBase, flex: 1, padding: "7px 0", fontSize: 12, border: "none", background: modo === id ? "#fff" : "transparent", color: modo === id ? C.ink : C.inkSoft, fontWeight: modo === id ? 600 : 500 }}>
                {label}
              </button>
            ))}
          </div>

          <Field label="email">
            <input style={inputStyle} value={email} onChange={(e) => { setEmail(e.target.value); setErro(""); }} placeholder="seu@email.com" />
          </Field>
          <Field label="senha">
            <input style={inputStyle} type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(""); }} placeholder="••••••" onKeyDown={(e) => e.key === "Enter" && entrar()} />
          </Field>

          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

          <button style={{ ...btnPrimary, width: "100%" }} onClick={entrar} disabled={carregando}>{carregando ? "entrando..." : "entrar"}</button>

          {modo === "equipe" && (
            <div style={{ textAlign: "center", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.inkSoft }}>não tem conta? </span>
              <span onClick={onCadastrar} style={{ fontSize: 12, color: C.accentDark, fontWeight: 600, cursor: "pointer" }}>cadastre sua oficina</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CADASTRO DE OFICINA
// ============================================================
function CadastroOficina({ onVoltar, onCadastrado }) {
  const [f, setF] = useState({ nomeOficina: "", cnpj: "", telefone: "", endereco: "", logo: null, nomeUsuario: "", email: "", senha: "", senha2: "" });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErro(""); };

  function lerLogo(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) return setErro("a imagem deve ter no máximo 1MB.");
    const reader = new FileReader();
    reader.onload = () => { setF((prev) => ({ ...prev, logo: reader.result })); setErro(""); };
    reader.readAsDataURL(file);
  }

  async function cadastrar() {
    if (!f.nomeOficina || !f.telefone || !f.nomeUsuario || !f.email || !f.senha) {
      return setErro("preencha os campos obrigatórios.");
    }
    if (f.senha !== f.senha2) return setErro("as senhas não conferem.");

    setCarregando(true);
    try {
      const { token, usuario } = await api.cadastrarOficina(f);
      onCadastrado({ tipo: "equipe", token, usuario });
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.steel, minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 24 }}>
      <style>{FONTS}</style>
      <div style={{ width: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, fontWeight: 600, color: "#fff", letterSpacing: 1 }}>CADASTRAR OFICINA</div>
          <div style={{ fontSize: 13, color: "#B4B9C0", marginTop: 4 }}>esses dados aparecem no cabeçalho das O.S. impressas</div>
        </div>

        <div style={{ background: C.surface, borderRadius: 10, padding: 22 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>dados da empresa</div>

          <Field label="nome da oficina *">
            <input style={inputStyle} value={f.nomeOficina} onChange={set("nomeOficina")} placeholder="Ex: Oficina do João" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="CNPJ ou CPF *">
              <input style={inputStyle} value={f.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0001-00" />
            </Field>
            <Field label="telefone *">
              <input style={inputStyle} value={f.telefone} onChange={set("telefone")} placeholder="(00) 0000-0000" />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: -8, marginBottom: 12 }}>
            necessário para configurar a cobrança após os 10 dias de teste grátis.
          </div>

          <Field label="endereço">
            <input style={inputStyle} value={f.endereco} onChange={set("endereco")} placeholder="Rua, número, bairro, cidade/UF" />
          </Field>

          <Field label="logo da oficina (opcional)">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {f.logo && (
                <img src={f.logo} alt="logo" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff" }} />
              )}
              <input type="file" accept="image/*" onChange={(e) => lerLogo(e.target.files?.[0])} style={{ ...inputStyle, padding: "7px 8px", fontSize: 12, flex: 1 }} />
              {f.logo && (
                <button style={{ ...btnBase, padding: "6px 10px", fontSize: 12 }} onClick={() => setF({ ...f, logo: null })}>remover</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>aparece no cabeçalho da O.S. impressa. até 1MB.</div>
          </Field>

          <div style={{ fontSize: 11, color: C.muted, margin: "18px 0 12px", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            seu acesso de administrador
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="seu nome *">
              <input style={inputStyle} value={f.nomeUsuario} onChange={set("nomeUsuario")} placeholder="Nome completo" />
            </Field>
            <Field label="email de acesso *">
              <input style={inputStyle} value={f.email} onChange={set("email")} placeholder="seu@email.com" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="senha *">
              <input style={inputStyle} type="password" value={f.senha} onChange={set("senha")} placeholder="••••••" />
            </Field>
            <Field label="repetir senha *">
              <input style={inputStyle} type="password" value={f.senha2} onChange={set("senha2")} placeholder="••••••" />
            </Field>
          </div>

          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...btnBase, flex: 1 }} onClick={onVoltar}>voltar</button>
            <button style={{ ...btnPrimary, flex: 2 }} onClick={cadastrar} disabled={carregando}>{carregando ? "criando..." : "criar conta e entrar"}</button>
          </div>

          <div style={{ background: C.accentBg, borderRadius: 8, padding: "12px 14px", marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.accentDark }}>
              10 dias de teste grátis, sem compromisso
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
              depois, R$ 170/mês. cancele quando quiser.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAINEL DA OFICINA
// ============================================================
function PainelOficina({ usuario, onSair, oficina, usuarios, clientes, veiculos, servicos, produtos, ordens, pagamentos, despesas, auditoria, alertasWhatsapp, actions }) {
  const [aba, setAba] = useState("dashboard");
  const [imprimindo, setImprimindo] = useState(null); // O.S. a imprimir
  const [gerenciando, setGerenciando] = useState(null); // O.S. sendo aberta para gestão

  // o backend já devolve só os dados desta oficina — nada de filtrar aqui.
  // mantemos os nomes "meus*" só pra não precisar tocar nos componentes filhos.
  const meusClientes = clientes;
  const meusVeiculos = veiculos;
  const meusServicos = servicos;
  const meusProdutos = produtos;
  const minhasOrdens = ordens;
  const meusPagamentos = pagamentos;
  const minhaAuditoria = auditoria;
  const meusAlertas = alertasWhatsapp;
  const minhaEquipe = usuarios;

  const podeFinanceiro = usuario.perfil === "admin" || usuario.perfil === "atendente";
  const podeAuditoria = usuario.perfil === "admin";
  const podeAdmin = usuario.perfil === "admin";

  // despesas e auditoria são carregadas sob demanda, só quando a aba é aberta
  // (os endpoints são admin-only e não fazem sentido pré-carregar pra todo mundo)
  useEffect(() => {
    if (aba === "despesas" && podeAdmin) actions.carregarDespesas().catch(() => {});
    if (aba === "auditoria" && podeAuditoria) actions.carregarAuditoria().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  if (gerenciando) {
    return (
      <DetalheOS
        usuario={usuario} actions={actions}
        os={gerenciando}
        cliente={clientes.find((c) => c.id === gerenciando.clienteId)}
        veiculo={veiculos.find((v) => v.id === gerenciando.veiculoId)}
        servicos={servicos} produtos={produtos} equipe={minhaEquipe}
        ordens={ordens}
        pagamentos={pagamentos}
        onVoltar={() => setGerenciando(null)}
        onImprimir={(os) => { setGerenciando(null); setImprimindo(os); }}
      />
    );
  }

  const nav = [
    { id: "dashboard", label: "dashboard" },
    { id: "nova_os", label: "nova O.S." },
    { id: "clientes", label: "clientes e veículos" },
    { id: "catalogo", label: "serviços e estoque" },
    ...(podeFinanceiro ? [{ id: "financeiro", label: "financeiro" }] : []),
    ...(podeAdmin ? [{ id: "despesas", label: "despesas mensais" }] : []),
    { id: "empresa", label: "dados da oficina" },
    ...(podeAdmin ? [{ id: "assinatura", label: "minha assinatura" }] : []),
    ...(podeAdmin ? [{ id: "equipe", label: "acessos da equipe" }] : []),
    ...(podeAuditoria ? [{ id: "auditoria", label: "auditoria" }] : []),
  ];

  return (
    <>
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 600, display: "grid", gridTemplateColumns: "210px 1fr", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <style>{FONTS}</style>

      <div style={{ background: C.steel, padding: "20px 14px", color: "#fff", display: "flex", flexDirection: "column" }}>
        {oficina?.logo && (
          <img src={oficina.logo} alt="logo" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, background: "#fff", marginBottom: 10, marginLeft: 4 }} />
        )}
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 0.5, paddingLeft: 4, lineHeight: 1.3 }}>
          {oficina?.nome?.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: "#8F959D", paddingLeft: 4, marginBottom: 22, marginTop: 2 }}>
          {oficina?.cnpj || ""}
        </div>

        {nav.map((n) => (
          <div key={n.id} onClick={() => setAba(n.id)}
            style={{ padding: "10px", borderRadius: 5, fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 2, background: aba === n.id ? C.accent : "transparent", color: aba === n.id ? "#fff" : "#C7CBD1" }}>
            {n.label}
          </div>
        ))}

        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #4A5058" }}>
          <div style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{usuario.nome}</div>
          <div style={{ fontSize: 11, color: "#8F959D", marginBottom: 10 }}>{usuario.perfil}</div>
          <button style={{ ...btnBase, width: "100%", padding: "6px 0", fontSize: 12, background: "transparent", borderColor: "#4A5058", color: "#C7CBD1" }} onClick={onSair}>sair</button>
        </div>
      </div>

      <div style={{ padding: 24, overflowX: "auto" }}>
        {aba === "dashboard" && (
          <Dashboard clientes={meusClientes} veiculos={meusVeiculos} ordens={minhasOrdens} pagamentos={meusPagamentos} servicos={meusServicos} oficina={oficina} usuario={usuario} actions={actions} alertas={meusAlertas} onImprimir={setImprimindo} onAbrir={setGerenciando} />
        )}

        {aba === "nova_os" && (
          <NovaOS usuario={usuario} actions={actions} clientes={meusClientes} veiculos={veiculos} servicos={meusServicos} produtos={produtos} equipe={minhaEquipe} ordens={ordens} onImprimir={setImprimindo} />
        )}

        {aba === "clientes" && (
          <ClientesVeiculos usuario={usuario} actions={actions} clientes={clientes} veiculos={veiculos} meusClientes={meusClientes} />
        )}

        {aba === "catalogo" && (
          <ServicosEstoque usuario={usuario} actions={actions} servicos={servicos} produtos={produtos} meusServicos={meusServicos} meusProdutos={meusProdutos} />
        )}

        {aba === "financeiro" && podeFinanceiro && (
          <Financeiro usuario={usuario} actions={actions} usuarios={usuarios} pagamentos={pagamentos} meusPagamentos={meusPagamentos} ordens={minhasOrdens} clientes={meusClientes} />
        )}

        {aba === "despesas" && podeAdmin && (
          <Despesas usuario={usuario} actions={actions} despesas={despesas} meusPagamentos={meusPagamentos} />
        )}

        {aba === "empresa" && (
          <DadosOficina usuario={usuario} oficina={oficina} actions={actions} />
        )}

        {aba === "assinatura" && podeAdmin && (
          <MinhaAssinatura usuario={usuario} oficina={oficina} actions={actions} />
        )}

        {aba === "equipe" && podeAdmin && (
          <Equipe usuario={usuario} actions={actions} usuarios={usuarios} minhaEquipe={minhaEquipe} />
        )}

        {aba === "auditoria" && podeAuditoria && (
          <Auditoria auditoria={minhaAuditoria} equipe={minhaEquipe} />
        )}
      </div>
    </div>

    {imprimindo && (
      <ImpressaoOS
        os={imprimindo} oficina={oficina}
        cliente={clientes.find((c) => c.id === imprimindo.clienteId)}
        veiculo={veiculos.find((v) => v.id === imprimindo.veiculoId)}
        usuarios={usuarios} servicos={servicos} produtos={produtos}
        pagamentos={pagamentos.filter((p) => p.osId === imprimindo.id)}
        onFechar={() => setImprimindo(null)}
      />
    )}
    </>
  );
}

// ---------- catálogo de serviços e estoque ----------
function ServicosEstoque({ usuario, actions, servicos, produtos, meusServicos, meusProdutos }) {
  const [showServico, setShowServico] = useState(false);
  const [fServico, setFServico] = useState({ nome: "", preco: "" });
  const [editServico, setEditServico] = useState(null);
  const [erroServico, setErroServico] = useState("");

  const [showProduto, setShowProduto] = useState(false);
  const [fProduto, setFProduto] = useState({ nome: "", quantidade: "", precoVenda: "", estoqueMinimo: "" });
  const [editProduto, setEditProduto] = useState(null);
  const [erroProduto, setErroProduto] = useState("");

  async function addServico() {
    if (!fServico.nome || !fServico.preco) return;
    try {
      await actions.criarServico({ nome: fServico.nome, preco: Number(fServico.preco) });
      setFServico({ nome: "", preco: "" });
      setShowServico(false);
      setErroServico("");
    } catch (e) { setErroServico(e.message); }
  }
  async function salvarServico() {
    try {
      await actions.editarServico(editServico.id, { nome: editServico.nome, preco: Number(editServico.preco) });
      setEditServico(null);
    } catch (e) { setErroServico(e.message); }
  }
  async function removerServico(s) {
    try { await actions.excluirServico(s.id); } catch (e) { setErroServico(e.message); }
  }

  async function addProduto() {
    if (!fProduto.nome) return;
    try {
      await actions.criarProduto({
        nome: fProduto.nome,
        quantidade: Number(fProduto.quantidade) || 0,
        precoVenda: Number(fProduto.precoVenda) || 0,
        estoqueMinimo: Number(fProduto.estoqueMinimo) || 0,
      });
      setFProduto({ nome: "", quantidade: "", precoVenda: "", estoqueMinimo: "" });
      setShowProduto(false);
      setErroProduto("");
    } catch (e) { setErroProduto(e.message); }
  }
  async function salvarProduto() {
    try {
      await actions.editarProduto(editProduto.id, {
        nome: editProduto.nome,
        quantidade: Number(editProduto.quantidade) || 0,
        precoVenda: Number(editProduto.precoVenda) || 0,
        estoqueMinimo: Number(editProduto.estoqueMinimo) || 0,
      });
      setEditProduto(null);
    } catch (e) { setErroProduto(e.message); }
  }
  async function removerProduto(p) {
    try { await actions.excluirProduto(p.id); } catch (e) { setErroProduto(e.message); }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>serviços e estoque</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>os serviços cadastrados aqui aparecem para seleção na abertura de O.S.</div>
      </div>

      {/* SERVIÇOS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>catálogo de serviços</div>
        <button style={btnPrimary} onClick={() => setShowServico(!showServico)}>+ novo serviço</button>
      </div>

      {showServico && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 200px auto", gap: 10, alignItems: "end" }}>
          <div><Field label="nome do serviço"><input style={inputStyle} value={fServico.nome} onChange={(e) => setFServico({ ...fServico, nome: e.target.value })} placeholder="Ex: Troca de óleo" /></Field></div>
          <div><Field label="valor (R$)"><input style={inputStyle} value={fServico.preco} onChange={(e) => setFServico({ ...fServico, preco: e.target.value })} placeholder="Ex: 120" /></Field></div>
          <button style={{ ...btnPrimary, marginBottom: 14 }} onClick={addServico}>salvar</button>
          {erroServico && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.danger }}>{erroServico}</div>}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 26 }}>
        {meusServicos.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.muted }}>nenhum serviço cadastrado ainda.</div>}
        {meusServicos.map((s, i) => (
          editServico && editServico.id === s.id ? (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 160px auto", gap: 10, alignItems: "center", padding: "10px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
              <input style={inputStyle} value={editServico.nome} onChange={(e) => setEditServico({ ...editServico, nome: e.target.value })} />
              <input style={inputStyle} value={editServico.preco} onChange={(e) => setEditServico({ ...editServico, preco: e.target.value })} />
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...btnBase, padding: "6px 10px", fontSize: 12 }} onClick={() => setEditServico(null)}>cancelar</button>
                <button style={{ ...btnPrimary, padding: "6px 10px", fontSize: 12 }} onClick={salvarServico}>salvar</button>
              </div>
            </div>
          ) : (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.ink }}>{s.nome}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: C.ink }}>R$ {s.preco.toLocaleString("pt-BR")}</span>
                <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12 }} onClick={() => setEditServico(s)}>editar</button>
                <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12, color: C.danger }} onClick={() => removerServico(s)}>excluir</button>
              </div>
            </div>
          )
        ))}
      </div>

      {/* ESTOQUE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>estoque de peças</div>
        <button style={btnPrimary} onClick={() => setShowProduto(!showProduto)}>+ novo item</button>
      </div>

      {showProduto && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 10 }}>
          <input style={inputStyle} placeholder="nome da peça" value={fProduto.nome} onChange={(e) => setFProduto({ ...fProduto, nome: e.target.value })} />
          <input style={inputStyle} placeholder="quantidade" value={fProduto.quantidade} onChange={(e) => setFProduto({ ...fProduto, quantidade: e.target.value })} />
          <input style={inputStyle} placeholder="preço de venda (R$)" value={fProduto.precoVenda} onChange={(e) => setFProduto({ ...fProduto, precoVenda: e.target.value })} />
          <input style={inputStyle} placeholder="estoque mínimo" value={fProduto.estoqueMinimo} onChange={(e) => setFProduto({ ...fProduto, estoqueMinimo: e.target.value })} />
          <button style={{ ...btnPrimary, gridColumn: "1 / -1" }} onClick={addProduto}>salvar item</button>
          {erroProduto && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.danger }}>{erroProduto}</div>}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {meusProdutos.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.muted }}>nenhum item cadastrado no estoque.</div>}
        {meusProdutos.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted, textAlign: "left", background: C.bg }}>
                <th style={{ fontWeight: 500, padding: "9px 16px" }}>item</th>
                <th style={{ fontWeight: 500 }}>quantidade</th>
                <th style={{ fontWeight: 500 }}>preço de venda</th>
                <th style={{ fontWeight: 500, padding: "9px 16px", textAlign: "right" }}>ação</th>
              </tr>
            </thead>
            <tbody>
              {meusProdutos.map((p) =>
                editProduto && editProduto.id === p.id ? (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 16px" }}><input style={inputStyle} value={editProduto.nome} onChange={(e) => setEditProduto({ ...editProduto, nome: e.target.value })} /></td>
                    <td><input style={inputStyle} value={editProduto.quantidade} onChange={(e) => setEditProduto({ ...editProduto, quantidade: e.target.value })} /></td>
                    <td><input style={inputStyle} value={editProduto.precoVenda} onChange={(e) => setEditProduto({ ...editProduto, precoVenda: e.target.value })} /></td>
                    <td style={{ padding: "8px 16px", textAlign: "right" }}>
                      <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, marginRight: 6 }} onClick={() => setEditProduto(null)}>cancelar</button>
                      <button style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12 }} onClick={salvarProduto}>salvar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 16px" }}>{p.nome}</td>
                    <td>
                      {p.quantidade}
                      {p.quantidade <= p.estoqueMinimo && <Badge tone="danger"> baixo</Badge>}
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace" }}>R$ {p.precoVenda.toLocaleString("pt-BR")}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12, marginRight: 6 }} onClick={() => setEditProduto(p)}>editar</button>
                      <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12, color: C.danger }} onClick={() => removerProduto(p)}>excluir</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- dados da oficina (editar cabeçalho de impressão) ----------
function DadosOficina({ usuario, oficina, actions }) {
  const [f, setF] = useState(oficina);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const podeEditar = usuario.perfil === "admin";

  async function salvar() {
    try {
      await actions.atualizarOficina(f);
      setSalvo(true);
      setErro("");
      setTimeout(() => setSalvo(false), 2500);
    } catch (e) {
      setErro(e.message);
    }
  }

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSalvo(false); };

  function lerLogo(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) return setErro("a imagem deve ter no máximo 1MB.");
    const reader = new FileReader();
    reader.onload = () => { setF((prev) => ({ ...prev, logo: reader.result })); setSalvo(false); setErro(""); };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>dados da oficina</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>aparecem no cabeçalho de toda O.S. impressa</div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <Field label="nome da oficina">
          <input style={inputStyle} value={f.nome} onChange={set("nome")} disabled={!podeEditar} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="CNPJ">
            <input style={inputStyle} value={f.cnpj || ""} onChange={set("cnpj")} disabled={!podeEditar} />
          </Field>
          <Field label="telefone">
            <input style={inputStyle} value={f.telefone || ""} onChange={set("telefone")} disabled={!podeEditar} />
          </Field>
        </div>
        <Field label="endereço">
          <input style={inputStyle} value={f.endereco || ""} onChange={set("endereco")} disabled={!podeEditar} />
        </Field>

        <Field label="logo da oficina">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {f.logo ? (
                <img src={f.logo} alt="logo da oficina" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 8 }} />
              ) : (
                <span style={{ fontSize: 10, color: C.muted }}>sem logo</span>
              )}
            </div>
            {podeEditar && (
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={(e) => lerLogo(e.target.files?.[0])} style={{ ...inputStyle, padding: "7px 8px", fontSize: 12, width: "100%" }} />
                {f.logo && (
                  <button style={{ ...btnBase, padding: "4px 10px", fontSize: 11, marginTop: 6, color: C.danger }} onClick={() => { setF({ ...f, logo: null }); setSalvo(false); }}>remover logo</button>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>aparece no cabeçalho da O.S. impressa. até 1MB.</div>
        </Field>

        {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

        {podeEditar ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
            {salvo && <span style={{ fontSize: 12, color: C.ok }}>alterações salvas</span>}
            <button style={btnPrimary} onClick={salvar}>salvar</button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.muted }}>apenas administradores podem alterar esses dados.</div>
        )}
      </div>
    </div>
  );
}

// ---------- minha assinatura (cobrança do SaaS) ----------
const STATUS_COBRANCA = {
  PENDING: { label: "a vencer", tone: "warn" },
  OVERDUE: { label: "atrasado", tone: "danger" },
  RECEIVED: { label: "pago", tone: "ok" },
  CONFIRMED: { label: "pago", tone: "ok" },
  RECEIVED_IN_CASH: { label: "pago (manual)", tone: "ok" },
  REFUNDED: { label: "estornado", tone: "danger" },
};

const FORMA_COBRANCA = {
  BOLETO: "boleto",
  CREDIT_CARD: "cartão",
  PIX: "pix",
  UNDEFINED: "a escolher",
};

function MinhaAssinatura({ usuario, oficina, actions }) {
  const [assinatura, setAssinatura] = useState(null);
  const [cobrancas, setCobrancas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [configurando, setConfigurando] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const [a, c] = await Promise.all([actions.verAssinatura(), actions.listarCobrancasAssinatura()]);
      setAssinatura(a);
      setCobrancas(c);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function configurarAssinatura() {
    setConfigurando(true);
    setErro("");
    try {
      await actions.configurarAssinatura();
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setConfigurando(false);
    }
  }

  async function cancelarAssinatura() {
    setCancelando(true);
    setErro("");
    try {
      await actions.cancelarAssinatura();
      setConfirmarCancelamento(false);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>minha assinatura</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>cobrança do sistema — Pix, boleto ou cartão, e o histórico de meses pagos</div>
      </div>

      {carregando && <div style={{ fontSize: 13, color: C.muted }}>carregando...</div>}

      {!carregando && assinatura && (
        <div style={{
          background: assinatura.status === "ativa" ? C.okBg : assinatura.status === "atrasada" || assinatura.status === "cancelada" ? C.dangerBg : C.accentBg,
          border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                {assinatura.status === "trial" && `período de teste grátis — até ${fmtData(assinatura.trialTerminaEm)}`}
                {assinatura.status === "ativa" && "assinatura em dia"}
                {assinatura.status === "atrasada" && "assinatura atrasada"}
                {assinatura.status === "cancelada" && "assinatura cancelada"}
                {assinatura.status === "pendente_configuracao" && "cobrança ainda não configurada"}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                mensalidade: R$ {Number(assinatura.valor).toLocaleString("pt-BR")}
              </div>
            </div>
            {(assinatura.status === "pendente_configuracao" || assinatura.status === "cancelada") && (
              <button style={btnPrimary} onClick={configurarAssinatura} disabled={configurando}>
                {configurando ? "configurando..." : assinatura.status === "cancelada" ? "reativar assinatura" : "configurar cobrança"}
              </button>
            )}
            {(assinatura.status === "ativa" || assinatura.status === "trial") && !confirmarCancelamento && (
              <button style={{ ...btnBase, color: C.danger }} onClick={() => setConfirmarCancelamento(true)}>
                cancelar assinatura
              </button>
            )}
          </div>

          {confirmarCancelamento && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>
                isso cancela a assinatura no Asaas e bloqueia o acesso da equipe ao sistema até reativar. tem certeza?
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={btnBase} onClick={() => setConfirmarCancelamento(false)}>voltar</button>
                <button style={{ ...btnBase, color: "#fff", background: C.danger, borderColor: C.danger }} onClick={cancelarAssinatura} disabled={cancelando}>
                  {cancelando ? "cancelando..." : "confirmar cancelamento"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 16 }}>{erro}</div>}

      {!carregando && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink }}>
            histórico de meses
          </div>
          {cobrancas.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>
              nenhuma cobrança gerada ainda — assim que o período de teste terminar, o primeiro mês aparece aqui.
            </div>
          )}
          {cobrancas.map((c, i) => {
            const st = STATUS_COBRANCA[c.status] || { label: c.status?.toLowerCase() || "-", tone: "muted" };
            return (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>vencimento {fmtData(c.vencimento)}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                    {c.pagoEm ? `pago em ${fmtData(c.pagoEm)} · ${FORMA_COBRANCA[c.formaPagamento] || c.formaPagamento}` : `forma: ${FORMA_COBRANCA[c.formaPagamento] || "a escolher"}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: C.ink }}>
                    R$ {Number(c.valor).toLocaleString("pt-BR")}
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {c.status !== "RECEIVED" && c.status !== "CONFIRMED" && c.status !== "RECEIVED_IN_CASH" && c.linkPagamento && (
                    <a href={c.linkPagamento} target="_blank" rel="noopener noreferrer"
                      style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12, textDecoration: "none", display: "inline-block" }}>
                      pagar agora
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- impressão da O.S. ----------// ---------- impressão da O.S. ----------
function ImpressaoOS({ os, oficina, cliente, veiculo, usuarios, servicos, produtos, pagamentos, onFechar }) {
  const [formato, setFormato] = useState("cliente"); // cliente | fiscal
  const fiscal = formato === "fiscal";

  const nomeUsuario = (id) => usuarios.find((u) => u.id === id)?.nome || "-";
  const linha = { display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 };
  const rot = { color: C.inkSoft, fontSize: 12 };

  return (
    <div onClick={onFechar}
      style={{ position: "fixed", inset: 0, background: "rgba(32,36,42,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "32px 24px", overflowY: "auto" }}>
      <style>{FONTS}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720 }}>

        {/* barra de controle — não sai na impressão */}
        <div className="no-print" style={{ margin: "0 auto 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button style={btnBase} onClick={onFechar}>✕ fechar</button>
            <button style={btnPrimary} onClick={() => window.print()}>imprimir / salvar PDF</button>
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600, marginBottom: 8 }}>
              formato do documento
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                ["cliente", "O.S. para o cliente", "sem CPF · via de entrega"],
                ["fiscal", "via fiscal", "com CPF · arquivo da oficina"],
              ].map(([id, titulo, sub]) => (
                <button key={id} onClick={() => setFormato(id)}
                  style={{
                    ...btnBase, flex: 1, textAlign: "left", padding: "10px 12px",
                    background: formato === id ? C.accentBg : "#fff",
                    borderColor: formato === id ? C.accent : C.border,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: formato === id ? C.accentDark : C.ink }}>{titulo}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="print-area" style={{ margin: "0 auto", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: 32, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>

          {/* cabeçalho da empresa */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${C.steel}`, paddingBottom: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            {oficina?.logo && (
              <img src={oficina.logo} alt="logo" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 6, flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: 0.5 }}>
                {oficina?.nome?.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.6 }}>
                {oficina?.cnpj && <div>CNPJ: {oficina.cnpj}</div>}
                {oficina?.telefone && <div>Tel: {oficina.telefone}</div>}
                {oficina?.endereco && <div>{oficina.endereco}</div>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              ordem de serviço
            </div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, fontWeight: 500, color: C.accent }}>#{os.numero}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{fmtDataHora(os.criadoEm)}</div>
            <div style={{ marginTop: 6 }}>
              <Badge tone={fiscal ? "warn" : "muted"}>{fiscal ? "via fiscal" : "via do cliente"}</Badge>
            </div>
          </div>
        </div>

        {/* cliente e veiculo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>cliente</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{cliente?.nome}</div>
            <div style={{ ...rot, marginTop: 3, lineHeight: 1.6 }}>
              <div>{cliente?.telefone}</div>
              {fiscal && cliente?.cpf && <div>CPF: {cliente.cpf}</div>}
              {cliente?.endereco && <div>{cliente.endereco}</div>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>veículo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Plate placa={veiculo?.placa} />
            </div>
            <div style={{ ...rot, lineHeight: 1.6 }}>
              <div>{veiculo?.marca} {veiculo?.modelo} · {veiculo?.ano}{veiculo?.cor ? ` · ${veiculo.cor}` : ""}</div>
              {os.km && <div>KM de entrada: {os.km}</div>}
              {os.dataSaida && <div>Data de saída: {fmtData(os.dataSaida)}</div>}
            </div>
          </div>
        </div>

        {/* relato */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>relato / serviço solicitado</div>
          <div style={{ fontSize: 13, color: C.ink, background: C.bg, padding: "12px 14px", borderRadius: 6, lineHeight: 1.6, minHeight: 50 }}>
            {os.descricao}
          </div>
        </div>

        {/* serviços */}
        {(servicos.filter((s) => os.servicosIds?.includes(s.id)).length > 0 || (os.pecasUtilizadas || []).length > 0) && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>serviços e peças</div>
            {servicos.filter((s) => os.servicosIds?.includes(s.id)).map((s) => (
              <div key={`serv-${s.id}`} style={linha}>
                <span style={rot}>{s.nome}</span>
                <span>R$ {s.preco.toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {(os.pecasUtilizadas || []).map((u) => {
              const produto = produtos.find((p) => p.id === u.produtoId);
              if (!produto) return null;
              return (
                <div key={`peca-${produto.id}`} style={linha}>
                  <span style={rot}>{produto.nome}{u.quantidade > 1 ? ` (${u.quantidade}x)` : ""}</span>
                  <span>R$ {(produto.precoVenda * u.quantidade).toLocaleString("pt-BR")}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* observações do mecânico */}
        {os.observacoesMecanico && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>observações técnicas</div>
            <div style={{ fontSize: 13, color: C.ink, background: C.bg, padding: "12px 14px", borderRadius: 6, lineHeight: 1.6 }}>
              {os.observacoesMecanico}
            </div>
          </div>
        )}

        {/* valores */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 18 }}>
          <div style={linha}>
            <span style={rot}>status</span>
            <Badge tone={STATUS_TONE[os.status]}>{STATUS_LABEL[os.status]}</Badge>
          </div>
          <div style={linha}>
            <span style={rot}>aberta por</span>
            <span>{nomeUsuario(os.criadoPor)}</span>
          </div>
          {os.mecanicoId && (
            <div style={linha}>
              <span style={rot}>mecânico responsável</span>
              <span>{nomeUsuario(os.mecanicoId)}</span>
            </div>
          )}
          {pagamentos.map((p) => (
            <div key={p.id} style={{ ...linha, alignItems: "flex-start" }}>
              <span style={rot}>parcela · vence {fmtData(p.vencimento)}</span>
              <span style={{ textAlign: "right" }}>
                R$ {p.valor.toLocaleString("pt-BR")}
                {p.pagoEm ? (
                  <>
                    {" · "}pago em {fmtData(p.pagoEm)}
                    {p.forma && ` via ${FORMAS[p.forma].label}`}
                    <div style={{ fontSize: 11, color: C.inkSoft }}>
                      recebido por {nomeUsuario(p.recebidoPor)}
                      {fiscal && p.documento && ` · doc ${p.documento}`}
                      {fiscal && p.comprovante && " · comprovante anexado"}
                    </div>
                  </>
                ) : " · em aberto"}
              </span>
            </div>
          ))}
          <div style={{ ...linha, marginTop: 4 }}>
            <span style={rot}>valor dos serviços</span>
            <span>R$ {os.valorTotal.toLocaleString("pt-BR")}</span>
          </div>
          {os.sinal > 0 && (
            <div style={linha}>
              <span style={rot}>sinal recebido</span>
              <span style={{ color: C.ok }}>− R$ {os.sinal.toLocaleString("pt-BR")}</span>
            </div>
          )}
          <div style={{ ...linha, borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{os.sinal > 0 ? "restante a cobrar" : "total"}</span>
            <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "Oswald, sans-serif" }}>
              R$ {(os.valorTotal - (os.sinal || 0)).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        {/* assinaturas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 44 }}>
          <div style={{ borderTop: `1px solid ${C.ink}`, paddingTop: 6, textAlign: "center", fontSize: 11, color: C.inkSoft }}>
            assinatura do cliente
          </div>
          <div style={{ borderTop: `1px solid ${C.ink}`, paddingTop: 6, textAlign: "center", fontSize: 11, color: C.inkSoft }}>
            responsável pela oficina
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: C.muted, marginTop: 24 }}>
          {fiscal ? "via fiscal · uso interno da oficina" : "via do cliente"} · documento gerado em {fmtDataHora(agoraISO())}
        </div>
      </div>
    </div>
    </div>
  );
}

// ---------- detalhe / gestão da O.S. ----------
function DetalheOS({ usuario, actions, os, cliente, veiculo, servicos, produtos, equipe, ordens, pagamentos, onVoltar, onImprimir }) {
  const osAtual = ordens.find((o) => o.id === os.id) || os;
  const [sinalEdit, setSinalEdit] = useState(String(osAtual.sinal || ""));
  const [mecanicoEdit, setMecanicoEdit] = useState(osAtual.mecanicoId ? String(osAtual.mecanicoId) : "");
  const [obsEdit, setObsEdit] = useState(osAtual.observacoesMecanico || "");
  const [obsSalva, setObsSalva] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [dataSaidaInput, setDataSaidaInput] = useState(osAtual.dataSaida || "");
  const [decisao, setDecisao] = useState(null); // 'pago' | 'pendente'
  const [forma, setForma] = useState("dinheiro");
  const [documento, setDocumento] = useState("");
  const [comprovante, setComprovante] = useState(null);
  const [vencimentoPendente, setVencimentoPendente] = useState("");
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);
  const [confirmarExclusaoOS, setConfirmarExclusaoOS] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const podeExcluir = usuario.perfil === "admin";

  const nomesServicos = servicos.filter((s) => osAtual.servicosIds?.includes(s.id));
  const pecasUsadas = (osAtual.pecasUtilizadas || []).map((u) => ({ ...u, produto: produtos.find((p) => p.id === u.produtoId) })).filter((u) => u.produto);
  const valorRestante = osAtual.valorTotal - (osAtual.sinal || 0);
  const finalizavel = !["entregue", "cancelada"].includes(osAtual.status);

  async function mudarStatus(novoStatus) {
    try { await actions.mudarStatusOrdem(os.id, novoStatus); } catch (e) { setErro(e.message); }
  }

  async function excluirOS() {
    try {
      await actions.excluirOrdem(os.id);
      onVoltar();
    } catch (e) { setErro(e.message); }
  }

  async function salvarSinal() {
    try { await actions.salvarSinalOrdem(os.id, Number(sinalEdit) || 0); } catch (e) { setErro(e.message); }
  }

  async function salvarMecanico() {
    try { await actions.salvarMecanicoOrdem(os.id, mecanicoEdit ? Number(mecanicoEdit) : null); } catch (e) { setErro(e.message); }
  }

  async function salvarObservacoes() {
    try {
      await actions.salvarObservacoesOrdem(os.id, obsEdit);
      setObsSalva(true);
      setTimeout(() => setObsSalva(false), 2000);
    } catch (e) { setErro(e.message); }
  }

  function lerArquivo(file) {
    if (!file) return setComprovante(null);
    const reader = new FileReader();
    reader.onload = () => setComprovante({ nome: file.name, tipo: file.type, dados: reader.result });
    reader.readAsDataURL(file);
  }

  async function confirmarFinalizacao() {
    if (!dataSaidaInput) return setErro("informe a data de saída do veículo.");
    if (valorRestante > 0) {
      if (!decisao) return setErro("informe se o valor restante já foi pago ou fica pendente.");
      if (decisao === "pago" && FORMAS[forma].exigeDoc && !documento && !comprovante) {
        return setErro(`informe o ${FORMAS[forma].rotuloDoc} ou anexe o comprovante.`);
      }
      if (decisao === "pendente" && !vencimentoPendente) {
        return setErro("informe a data de vencimento do valor pendente.");
      }
    }

    setSalvando(true);
    try {
      await actions.finalizarOrdem(os.id, {
        dataSaida: dataSaidaInput,
        pago: decisao === "pago",
        forma: decisao === "pago" ? forma : null,
        documento: decisao === "pago" ? (documento || null) : null,
        comprovante: decisao === "pago" ? comprovante : null,
        vencimento: decisao === "pendente" ? vencimentoPendente : null,
      });
      setErro("");
      setConcluido(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 600, padding: 24, borderRadius: 12 }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button style={btnBase} onClick={onVoltar}>← voltar</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnBase} onClick={() => onImprimir(osAtual)}>imprimir O.S.</button>
            {podeExcluir && (
              confirmarExclusaoOS ? (
                <>
                  <button style={{ ...btnBase, color: "#fff", background: C.danger, borderColor: C.danger }} onClick={excluirOS}>confirmar exclusão</button>
                  <button style={btnBase} onClick={() => setConfirmarExclusaoOS(false)}>cancelar</button>
                </>
              ) : (
                <button style={{ ...btnBase, color: C.danger }} onClick={() => setConfirmarExclusaoOS(true)}>excluir O.S.</button>
              )
            )}
          </div>
        </div>

        {confirmarExclusaoOS && (
          <div style={{ background: C.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.danger }}>
            isso remove a O.S. #{osAtual.numero} permanentemente, junto com os pagamentos lançados nela. peças do estoque usadas nesta O.S. serão devolvidas automaticamente. essa ação não pode ser desfeita.
          </div>
        )}

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>O.S. #{osAtual.numero}</div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{cliente?.nome}</div>
            </div>
            <Badge tone={STATUS_TONE[osAtual.status]}>{STATUS_LABEL[osAtual.status]}</Badge>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Plate placa={veiculo?.placa} />
            <span style={{ fontSize: 13, color: C.inkSoft }}>{veiculo?.marca} {veiculo?.modelo} · {veiculo?.ano}{veiculo?.cor ? ` · ${veiculo.cor}` : ""}</span>
          </div>

          <div style={{ fontSize: 13, color: C.ink, background: C.bg, padding: "10px 12px", borderRadius: 6, marginBottom: 16 }}>
            {osAtual.descricao}
          </div>

          {(nomesServicos.length > 0 || pecasUsadas.length > 0) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600, marginBottom: 6 }}>serviços e peças</div>
              {nomesServicos.map((s) => (
                <div key={`serv-${s.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span style={{ color: C.inkSoft }}>{s.nome}</span>
                  <span>R$ {s.preco.toLocaleString("pt-BR")}</span>
                </div>
              ))}
              {pecasUsadas.map((u) => (
                <div key={`peca-${u.produto.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span style={{ color: C.inkSoft }}>{u.produto.nome}{u.quantidade > 1 ? ` (${u.quantidade}x)` : ""}</span>
                  <span>R$ {(u.produto.precoVenda * u.quantidade).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <Field label="mecânico responsável">
              <select style={inputStyle} value={mecanicoEdit} onChange={(e) => setMecanicoEdit(e.target.value)}>
                <option value="">não definido</option>
                {equipe.filter((u) => u.perfil !== "atendente").map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </Field>
            <button style={{ ...btnBase, marginBottom: 14 }} onClick={salvarMecanico}>salvar</button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Field label="observações do mecânico">
              <textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} placeholder="Anotações técnicas sobre o serviço realizado, peças trocadas, recomendações futuras..." value={obsEdit} onChange={(e) => setObsEdit(e.target.value)} />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button style={btnBase} onClick={salvarObservacoes}>salvar observações</button>
              {obsSalva && <span style={{ fontSize: 12, color: C.ok }}>salvo.</span>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <Field label="sinal recebido (R$)">
              <input style={inputStyle} value={sinalEdit} onChange={(e) => setSinalEdit(e.target.value)} placeholder="0" />
            </Field>
            <button style={{ ...btnBase, marginBottom: 14 }} onClick={salvarSinal}>salvar sinal</button>
          </div>

          <div style={{ background: C.bg, borderRadius: 6, padding: "12px 14px", fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: C.inkSoft }}>valor total</span>
              <span>R$ {osAtual.valorTotal.toLocaleString("pt-BR")}</span>
            </div>
            {osAtual.sinal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ color: C.inkSoft }}>sinal recebido</span>
                <span style={{ color: C.ok }}>− R$ {osAtual.sinal.toLocaleString("pt-BR")}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 0", borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>restante a cobrar</span>
              <span style={{ fontWeight: 600 }}>R$ {valorRestante.toLocaleString("pt-BR")}</span>
            </div>
          </div>

          {osAtual.dataSaida && (
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 10 }}>veículo entregue em {fmtData(osAtual.dataSaida)}</div>
          )}
        </div>

        {/* mudar status (fluxo intermediário, sem finalizar) */}
        {finalizavel && !showFinalizar && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 10 }}>atualizar andamento</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["orcamento", "aberta", "em_andamento", "aguardando_peca", "cancelada"].map((s) => (
                <button key={s} onClick={() => mudarStatus(s)}
                  style={{ ...btnBase, padding: "6px 12px", fontSize: 12, background: osAtual.status === s ? C.steel : "#fff", color: osAtual.status === s ? "#fff" : C.ink, borderColor: osAtual.status === s ? C.steel : C.border }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* finalizar e entregar */}
        {finalizavel && !concluido && (
          !showFinalizar ? (
            <button style={{ ...btnPrimary, width: "100%", padding: "12px 0" }} onClick={() => setShowFinalizar(true)}>
              finalizar O.S. e entregar veículo
            </button>
          ) : (
            <div style={{ background: C.surface, border: `2px solid ${C.accent}`, borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 14 }}>finalizar e entregar veículo</div>

              <Field label="data de saída do veículo">
                <input style={inputStyle} type="date" value={dataSaidaInput} onChange={(e) => { setDataSaidaInput(e.target.value); setErro(""); }} />
              </Field>

              {valorRestante > 0 ? (
                <>
                  <div style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
                    valor restante a cobrar: <strong>R$ {valorRestante.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <button onClick={() => { setDecisao("pago"); setErro(""); }}
                      style={{ ...btnBase, flex: 1, padding: "10px 0", background: decisao === "pago" ? C.ok : "#fff", borderColor: decisao === "pago" ? C.ok : C.border, color: decisao === "pago" ? "#fff" : C.ink, fontWeight: 600 }}>
                      já foi pago
                    </button>
                    <button onClick={() => { setDecisao("pendente"); setErro(""); }}
                      style={{ ...btnBase, flex: 1, padding: "10px 0", background: decisao === "pendente" ? C.warn : "#fff", borderColor: decisao === "pendente" ? C.warn : C.border, color: decisao === "pendente" ? "#fff" : C.ink, fontWeight: 600 }}>
                      fica pendente
                    </button>
                  </div>

                  {decisao === "pago" && (
                    <div style={{ background: C.bg, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                      <SeletorForma valor={forma} onChange={(f) => { setForma(f); setDocumento(""); setComprovante(null); setErro(""); }} />
                      {FORMAS[forma].exigeDoc && (
                        <CamposComprovante forma={forma} documento={documento} comprovante={comprovante}
                          onDocumento={(v) => { setDocumento(v); setErro(""); }}
                          onArquivo={(file) => { lerArquivo(file); setErro(""); }} />
                      )}
                    </div>
                  )}

                  {decisao === "pendente" && (
                    <Field label="vencimento do valor pendente">
                      <input style={inputStyle} type="date" value={vencimentoPendente} onChange={(e) => { setVencimentoPendente(e.target.value); setErro(""); }} />
                    </Field>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.ok, marginBottom: 14 }}>o sinal recebido já cobre o valor total — nada a cobrar na saída.</div>
              )}

              {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={btnBase} onClick={() => { setShowFinalizar(false); setErro(""); }}>cancelar</button>
                <button style={btnPrimary} onClick={confirmarFinalizacao} disabled={salvando}>{salvando ? "salvando..." : "confirmar entrega"}</button>
              </div>
            </div>
          )
        )}

        {concluido && (
          <div style={{ background: C.okBg, borderRadius: 10, padding: 18, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: C.ok, fontWeight: 600, marginBottom: 10 }}>
              O.S. #{osAtual.numero} finalizada e entregue em {fmtData(dataSaidaInput)}.
            </div>
            <button style={btnPrimary} onClick={() => onImprimir({ ...osAtual, status: "entregue", dataSaida: dataSaidaInput })}>imprimir O.S.</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- dashboard ----------
function mesesEntre(dataISO) {
  if (!dataISO) return null;
  const d1 = new Date(dataISO);
  const d2 = new Date();
  let meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) meses -= 1;
  return Math.max(0, meses);
}

function linkWhatsapp(telefone, mensagem) {
  const digitos = (telefone || "").replace(/\D/g, "");
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

function Dashboard({ clientes, veiculos, ordens, pagamentos, servicos, oficina, usuario, actions, alertas, onImprimir, onAbrir }) {
  const abertas = ordens.filter((o) => !["concluida", "entregue", "cancelada"].includes(o.status)).length;
  const emAndamento = ordens.filter((o) => o.status === "em_andamento").length;
  const faturamentoHoje = pagamentos.filter((p) => p.pagoEm === hojeISO()).reduce((s, p) => s + p.valor, 0);
  const atrasados = pagamentos.filter((p) => !p.pagoEm && p.vencimento < hojeISO()).length;

  const clienteNome = (id) => clientes.find((c) => c.id === id)?.nome || "-";
  const veiculoInfo = (id) => {
    const v = veiculos.find((v) => v.id === id);
    return v ? `${v.modelo} ${v.ano}` : "-";
  };

  // serviços de troca de óleo e de motor identificados pelo nome (funciona mesmo com nomes cadastrados livremente)
  const servicosOleoIds = servicos.filter((s) => s.nome.toLowerCase().includes("óleo") || s.nome.toLowerCase().includes("oleo")).map((s) => s.id);
  const servicosMotorIds = servicos.filter((s) => s.nome.toLowerCase().includes("motor")).map((s) => s.id);

  // clientes sem troca de óleo há 6+ meses (ou nunca registrada)
  const clientesParaContato = [];
  clientes.forEach((c) => {
    veiculos.filter((v) => v.clienteId === c.id).forEach((v) => {
      const ordensOleo = ordens.filter((o) => o.veiculoId === v.id && o.servicosIds?.some((id) => servicosOleoIds.includes(id)));
      const ultima = ordensOleo.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))[0];
      const meses = ultima ? mesesEntre(ultima.criadoEm) : null;
      if (meses === null || meses >= 6) {
        clientesParaContato.push({ cliente: c, veiculo: v, ultima, meses });
      }
    });
  });
  clientesParaContato.sort((a, b) => (b.meses ?? 999) - (a.meses ?? 999));

  // veículos com manutenção de motor completo registrada
  const historicoMotor = ordens
    .filter((o) => o.servicosIds?.some((id) => servicosMotorIds.includes(id)))
    .map((o) => ({ os: o, cliente: clientes.find((c) => c.id === o.clienteId), veiculo: veiculos.find((v) => v.id === o.veiculoId) }))
    .sort((a, b) => new Date(b.os.criadoEm) - new Date(a.os.criadoEm));

  return (
    <div>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 18, color: C.ink }}>visão geral</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="O.S. em aberto" value={abertas} />
        <StatCard label="em andamento" value={emAndamento} />
        <StatCard label="pagamentos atrasados" value={atrasados} tone={atrasados > 0 ? "danger" : "ok"} />
        <StatCard label="faturamento hoje" value={`R$ ${faturamentoHoje.toLocaleString("pt-BR")}`} tone="ok" />
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.ink }}>ordens de serviço recentes</div>
        {ordens.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhuma O.S. cadastrada ainda.</div>}
        {ordens.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted, textAlign: "left" }}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>O.S.</th>
                <th style={{ fontWeight: 500 }}>cliente</th>
                <th style={{ fontWeight: 500 }}>veículo</th>
                <th style={{ fontWeight: 500 }}>status</th>
                <th style={{ fontWeight: 500, textAlign: "right" }}>valor</th>
                <th style={{ fontWeight: 500, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {ordens.map((o) => (
                <tr key={o.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "9px 0", fontFamily: "JetBrains Mono, monospace" }}>{o.numero}</td>
                  <td>{clienteNome(o.clienteId)}</td>
                  <td>{veiculoInfo(o.veiculoId)}</td>
                  <td><Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                  <td style={{ textAlign: "right" }}>R$ {o.valorTotal.toLocaleString("pt-BR")}</td>
                  <td style={{ textAlign: "right" }}>
                    <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12, marginRight: 6 }} onClick={() => onAbrir(o)}>gerenciar</button>
                    <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12 }} onClick={() => onImprimir(o)}>imprimir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* clientes sem troca de óleo há 6+ meses — alerta de retorno via whatsapp */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>clientes sem retorno (troca de óleo há 6+ meses)</div>
          {clientesParaContato.length > 0 && <Badge tone="warn">{clientesParaContato.length}</Badge>}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          identificado pelo nome do serviço conter "óleo" no catálogo — confira se seus serviços de troca de óleo estão nomeados assim.
        </div>
        {clientesParaContato.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhum cliente atrasado no momento.</div>}
        {clientesParaContato.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted, textAlign: "left" }}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>cliente</th>
                <th style={{ fontWeight: 500 }}>telefone</th>
                <th style={{ fontWeight: 500 }}>veículo</th>
                <th style={{ fontWeight: 500 }}>última troca de óleo</th>
                <th style={{ fontWeight: 500 }}>tempo</th>
                <th style={{ fontWeight: 500 }}>alerta enviado em</th>
                <th style={{ fontWeight: 500, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {clientesParaContato.map(({ cliente, veiculo, ultima, meses }, i) => {
                const msg = `Olá ${cliente.nome.split(" ")[0]}! Aqui é da ${oficina?.nome || "oficina"}. Faz um tempo que não fazemos a troca de óleo do seu ${veiculo.modelo} (placa ${veiculo.placa}) — quer agendar uma revisão?`;
                const alertasDoCliente = alertas.filter((a) => a.clienteId === cliente.id && a.veiculoId === veiculo.id);
                const ultimoAlerta = alertasDoCliente.sort((a, b) => new Date(b.enviadoEm) - new Date(a.enviadoEm))[0];
                return (
                  <tr key={`${cliente.id}-${veiculo.id}`} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                    <td style={{ padding: "9px 0" }}>{cliente.nome}</td>
                    <td>{cliente.telefone}</td>
                    <td>{veiculo.modelo} <Plate placa={veiculo.placa} /></td>
                    <td>{ultima ? fmtData(ultima.criadoEm.slice(0, 10)) : "nunca registrada"}</td>
                    <td><Badge tone={meses === null || meses >= 6 ? "danger" : "warn"}>{meses === null ? "nunca" : `${meses} meses`}</Badge></td>
                    <td>
                      {ultimoAlerta ? (
                        <span style={{ color: C.inkSoft }}>{fmtDataHora(ultimoAlerta.enviadoEm)}</span>
                      ) : (
                        <span style={{ color: C.muted }}>nunca enviado</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <a href={linkWhatsapp(cliente.telefone, msg)} target="_blank" rel="noopener noreferrer"
                        onClick={() => actions.registrarAlerta(cliente.id, veiculo.id).catch(() => {})}
                        style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12, textDecoration: "none", display: "inline-block" }}>
                        chamar no whatsapp
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* histórico de manutenção de motor completo */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: C.ink }}>veículos com manutenção de motor completo</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          identificado pelo nome do serviço conter "motor" no catálogo.
        </div>
        {historicoMotor.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhum registro ainda.</div>}
        {historicoMotor.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted, textAlign: "left" }}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>veículo</th>
                <th style={{ fontWeight: 500 }}>cliente</th>
                <th style={{ fontWeight: 500 }}>km no serviço</th>
                <th style={{ fontWeight: 500 }}>data</th>
                <th style={{ fontWeight: 500 }}>status</th>
              </tr>
            </thead>
            <tbody>
              {historicoMotor.map(({ os, cliente, veiculo }, i) => (
                <tr key={os.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <td style={{ padding: "9px 0" }}>{veiculo?.modelo} {veiculo?.placa && <Plate placa={veiculo.placa} />}</td>
                  <td>{cliente?.nome}</td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{os.km || "-"}</td>
                  <td>{fmtData((os.dataSaida || os.criadoEm).slice(0, 10))}</td>
                  <td><Badge tone={STATUS_TONE[os.status]}>{STATUS_LABEL[os.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const bg = tone === "danger" ? C.dangerBg : tone === "ok" ? C.okBg : "#fff";
  const fg = tone === "danger" ? C.danger : tone === "ok" ? C.ok : C.ink;
  return (
    <div style={{ background: bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: tone ? fg : C.inkSoft, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: fg, fontFamily: "Oswald, sans-serif" }}>{value}</div>
    </div>
  );
}

// ---------- nova O.S. ----------
// ---------- modal de seleção (serviços / peças) ----------
function ModalSelecao({ titulo, onFechar, children }) {
  return (
    <div
      onClick={onFechar}
      style={{ position: "fixed", inset: 0, background: "rgba(32,36,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 460, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, fontWeight: 600, color: C.ink }}>{titulo}</div>
          <button onClick={onFechar} style={{ ...btnBase, padding: "4px 10px", fontSize: 12 }}>fechar</button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 0" }}>{children}</div>
      </div>
    </div>
  );
}

function NovaOS({ usuario, actions, clientes, veiculos, servicos, produtos, equipe, ordens, onImprimir }) {
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [km, setKm] = useState("");
  const [servicosIds, setServicosIds] = useState([]);
  const [pecas, setPecas] = useState({}); // { produtoId: quantidade }
  const [mecanicoId, setMecanicoId] = useState("");
  const [sinal, setSinal] = useState("");
  const [novoVeiculo, setNovoVeiculo] = useState(false);
  const [nv, setNv] = useState({ placa: "", marca: "", modelo: "", ano: "", cor: "" });
  const [criada, setCriada] = useState(null);
  const [modalAberto, setModalAberto] = useState(null); // "servicos" | "pecas" | null
  const [salvando, setSalvando] = useState(false);

  const meusProdutos = produtos;
  const veiculosDoCliente = veiculos.filter((v) => v.clienteId === Number(clienteId));

  async function salvarVeiculo() {
    try {
      const novo = await actions.criarVeiculo({ clienteId: Number(clienteId), ...nv, ano: Number(nv.ano) });
      setVeiculoId(String(novo.id));
      setNovoVeiculo(false);
      setNv({ placa: "", marca: "", modelo: "", ano: "", cor: "" });
    } catch (e) {
      setCriada({ erro: e.message });
    }
  }

  function toggleServico(id) {
    setServicosIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function togglePeca(produtoId) {
    setPecas((prev) => {
      const next = { ...prev };
      if (next[produtoId]) delete next[produtoId];
      else next[produtoId] = 1;
      return next;
    });
  }
  function mudarQuantidadePeca(produtoId, qtd) {
    const disponivel = meusProdutos.find((p) => p.id === produtoId)?.quantidade ?? 1;
    const v = Math.max(1, Math.min(Number(qtd) || 1, disponivel));
    setPecas((prev) => ({ ...prev, [produtoId]: v }));
  }

  const valorCatalogo = servicos.filter((s) => servicosIds.includes(s.id)).reduce((sum, s) => sum + s.preco, 0);
  const valorPecas = Object.entries(pecas).reduce((sum, [pid, qtd]) => {
    const produto = meusProdutos.find((p) => p.id === Number(pid));
    return sum + (produto ? produto.precoVenda * qtd : 0);
  }, 0);
  const valorSinal = Number(sinal) || 0;
  const valorTotalCalculado = valorCatalogo + valorPecas;
  const valorRestanteCalculado = valorTotalCalculado - valorSinal;

  async function abrirOS(status) {
    if (!clienteId || !veiculoId || !descricao) {
      setCriada({ erro: "preencha cliente, veículo e a descrição do problema." });
      return;
    }
    const pecasUtilizadas = Object.entries(pecas).map(([produtoId, quantidade]) => ({ produtoId: Number(produtoId), quantidade }));

    setSalvando(true);
    try {
      const nova = await actions.criarOrdem({
        clienteId: Number(clienteId), veiculoId: Number(veiculoId), descricao, km, status,
        servicosIds, pecas: pecasUtilizadas, sinal: valorSinal, mecanicoId: mecanicoId ? Number(mecanicoId) : null,
      });
      setCriada({ os: nova });
      setClienteId(""); setVeiculoId(""); setDescricao(""); setKm(""); setServicosIds([]); setPecas({}); setSinal(""); setMecanicoId("");
    } catch (e) {
      setCriada({ erro: e.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 18, color: C.ink }}>nova ordem de serviço</div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="cliente">
            <select style={inputStyle} value={clienteId} onChange={(e) => { setClienteId(e.target.value); setVeiculoId(""); }}>
              <option value="">selecione</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>

          <Field label="veículo">
            {!novoVeiculo ? (
              <select style={inputStyle} value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} disabled={!clienteId}>
                <option value="">{clienteId ? "selecione" : "selecione o cliente primeiro"}</option>
                {veiculosDoCliente.map((v) => <option key={v.id} value={v.id}>{v.modelo} {v.ano} · {v.placa}</option>)}
              </select>
            ) : (
              <button style={{ ...btnBase, width: "100%" }} onClick={() => setNovoVeiculo(false)}>cancelar novo veículo</button>
            )}
            {clienteId && !novoVeiculo && (
              <div style={{ marginTop: 6, fontSize: 12, color: C.accentDark, cursor: "pointer" }} onClick={() => setNovoVeiculo(true)}>
                + cadastrar novo veículo para este cliente
              </div>
            )}
          </Field>
        </div>

        {novoVeiculo && (
          <div style={{ background: C.bg, borderRadius: 8, padding: 14, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <input style={inputStyle} placeholder="placa" value={nv.placa} onChange={(e) => setNv({ ...nv, placa: e.target.value.toUpperCase() })} />
            <input style={inputStyle} placeholder="ano" value={nv.ano} onChange={(e) => setNv({ ...nv, ano: e.target.value })} />
            <input style={inputStyle} placeholder="cor" value={nv.cor} onChange={(e) => setNv({ ...nv, cor: e.target.value })} />
            <input style={inputStyle} placeholder="marca" value={nv.marca} onChange={(e) => setNv({ ...nv, marca: e.target.value })} />
            <input style={{ ...inputStyle, gridColumn: "span 2" }} placeholder="modelo" value={nv.modelo} onChange={(e) => setNv({ ...nv, modelo: e.target.value })} />
            <button style={{ ...btnPrimary, gridColumn: "1 / -1" }} onClick={salvarVeiculo} disabled={!nv.placa || !nv.modelo}>salvar veículo</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="km atual">
            <input style={inputStyle} placeholder="Ex: 84200" value={km} onChange={(e) => setKm(e.target.value)} />
          </Field>
          <Field label="mecânico responsável (opcional)">
            <select style={inputStyle} value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)}>
              <option value="">não definido ainda</option>
              {equipe.filter((u) => u.perfil !== "atendente").map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Field>
        </div>

        <Field label="relato do cliente">
          <textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} placeholder="O que o cliente descreveu sobre o problema" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>

        {/* serviços — seleção via caixa de diálogo */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
            serviços a realizar
          </label>
          <button style={{ ...btnBase, width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={() => setModalAberto("servicos")}>
            <span>{servicosIds.length > 0 ? `${servicosIds.length} serviço(s) selecionado(s)` : "selecionar serviços"}</span>
            <span style={{ color: C.accentDark, fontSize: 12 }}>abrir catálogo →</span>
          </button>

          {servicosIds.length > 0 && (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, marginTop: 8, overflow: "hidden" }}>
              {servicos.filter((s) => servicosIds.includes(s.id)).map((s, i) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.ink }}>{s.nome}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>R$ {s.preco.toLocaleString("pt-BR")}</span>
                    <button style={{ ...btnBase, padding: "3px 8px", fontSize: 11, color: C.danger }} onClick={() => toggleServico(s.id)}>remover</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {modalAberto === "servicos" && (
          <ModalSelecao titulo="selecionar serviços" onFechar={() => setModalAberto(null)}>
            {servicos.length === 0 ? (
              <div style={{ padding: "14px 20px", fontSize: 13, color: C.muted }}>
                nenhum serviço cadastrado ainda. cadastre em "serviços e estoque".
              </div>
            ) : servicos.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", cursor: "pointer", background: servicosIds.includes(s.id) ? C.accentBg : "#fff" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={servicosIds.includes(s.id)} onChange={() => toggleServico(s.id)} />
                  <span style={{ fontSize: 14, color: C.ink }}>{s.nome}</span>
                </span>
                <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: C.ink }}>R$ {s.preco.toLocaleString("pt-BR")}</span>
              </label>
            ))}
          </ModalSelecao>
        )}

        {/* peças do estoque — seleção via caixa de diálogo */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
            peças do estoque utilizadas
          </label>
          <button style={{ ...btnBase, width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={() => setModalAberto("pecas")}>
            <span>{Object.keys(pecas).length > 0 ? `${Object.keys(pecas).length} peça(s) selecionada(s)` : "selecionar peças do estoque"}</span>
            <span style={{ color: C.accentDark, fontSize: 12 }}>abrir estoque →</span>
          </button>

          {Object.keys(pecas).length > 0 && (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, marginTop: 8, overflow: "hidden" }}>
              {Object.entries(pecas).map(([pid, qtd], i) => {
                const produto = meusProdutos.find((p) => p.id === Number(pid));
                if (!produto) return null;
                return (
                  <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 13, color: C.ink }}>{produto.nome}{qtd > 1 ? ` (${qtd}x)` : ""}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>R$ {(produto.precoVenda * qtd).toLocaleString("pt-BR")}</span>
                      <button style={{ ...btnBase, padding: "3px 8px", fontSize: 11, color: C.danger }} onClick={() => togglePeca(produto.id)}>remover</button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {modalAberto === "pecas" && (
          <ModalSelecao titulo="selecionar peças do estoque" onFechar={() => setModalAberto(null)}>
            {meusProdutos.length === 0 ? (
              <div style={{ padding: "14px 20px", fontSize: 13, color: C.muted }}>
                nenhuma peça cadastrada ainda. cadastre em "serviços e estoque".
              </div>
            ) : meusProdutos.map((p) => {
              const marcada = pecas[p.id] !== undefined;
              const semEstoque = p.quantidade <= 0;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: marcada ? C.accentBg : "#fff", opacity: semEstoque && !marcada ? 0.5 : 1 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: semEstoque && !marcada ? "not-allowed" : "pointer", flex: 1 }}>
                    <input type="checkbox" checked={marcada} disabled={semEstoque && !marcada} onChange={() => togglePeca(p.id)} />
                    <span style={{ fontSize: 14, color: C.ink }}>{p.nome}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>({p.quantidade} em estoque)</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {marcada && (
                      <input type="number" min={1} max={p.quantidade} value={pecas[p.id]} onChange={(e) => mudarQuantidadePeca(p.id, e.target.value)}
                        style={{ ...inputStyle, width: 56, padding: "4px 6px", textAlign: "center" }} />
                    )}
                    <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: C.ink, minWidth: 70, textAlign: "right" }}>
                      R$ {p.precoVenda.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </ModalSelecao>
        )}

        <Field label="sinal recebido (opcional)">
          <input style={inputStyle} placeholder="Ex: 100" value={sinal} onChange={(e) => setSinal(e.target.value)} />
        </Field>

        {/* resumo de valores */}
        <div style={{ background: C.bg, borderRadius: 6, padding: "12px 14px", marginBottom: 14, fontSize: 13 }}>
          {valorCatalogo > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: C.inkSoft }}>serviços do catálogo</span>
              <span>R$ {valorCatalogo.toLocaleString("pt-BR")}</span>
            </div>
          )}
          {valorPecas > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: C.inkSoft }}>peças utilizadas</span>
              <span>R$ {valorPecas.toLocaleString("pt-BR")}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontWeight: valorSinal > 0 ? 400 : 600 }}>
            <span style={{ color: valorSinal > 0 ? C.inkSoft : C.ink }}>valor total</span>
            <span>R$ {valorTotalCalculado.toLocaleString("pt-BR")}</span>
          </div>
          {valorSinal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: C.inkSoft }}>sinal recebido</span>
              <span style={{ color: C.ok }}>− R$ {valorSinal.toLocaleString("pt-BR")}</span>
            </div>
          )}
          {valorSinal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 0", borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>restante a cobrar</span>
              <span style={{ fontWeight: 600 }}>R$ {valorRestanteCalculado.toLocaleString("pt-BR")}</span>
            </div>
          )}
        </div>

        {criada?.erro && <div style={{ fontSize: 13, color: C.danger, marginBottom: 12 }}>{criada.erro}</div>}

        {criada?.os && (
          <div style={{ background: C.okBg, borderRadius: 6, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.ok }}>O.S. #{criada.os.numero} criada com sucesso.</span>
            <button style={{ ...btnBase, padding: "5px 12px", fontSize: 12 }} onClick={() => onImprimir(criada.os)}>imprimir O.S.</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <button style={btnBase} onClick={() => abrirOS("orcamento")} disabled={salvando}>salvar como orçamento</button>
          <button style={btnPrimary} onClick={() => abrirOS("aberta")} disabled={salvando}>{salvando ? "salvando..." : "abrir O.S."}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- clientes e veiculos ----------
function ClientesVeiculos({ usuario, actions, clientes, veiculos, meusClientes }) {
  const [expandido, setExpandido] = useState(null);
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", cpf: "", endereco: "", email: "", senha: "" });
  const [editCliente, setEditCliente] = useState(null);
  const [editVeiculo, setEditVeiculo] = useState(null);
  const [novoVeiculoPara, setNovoVeiculoPara] = useState(null); // id do cliente
  const [nv, setNv] = useState({ placa: "", marca: "", modelo: "", ano: "", cor: "" });
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [confirmarVeiculo, setConfirmarVeiculo] = useState(null);
  const [erro, setErro] = useState("");

  async function addCliente() {
    if (!form.nome || !form.telefone) return;
    try {
      await actions.criarCliente(form);
      setForm({ nome: "", telefone: "", cpf: "", endereco: "", email: "", senha: "" });
      setShowNovo(false);
      setErro("");
    } catch (e) { setErro(e.message); }
  }

  async function salvarEdicaoCliente() {
    try {
      await actions.editarCliente(editCliente.id, editCliente);
      setEditCliente(null);
      setErro("");
    } catch (e) { setErro(e.message); }
  }

  async function excluirCliente(c) {
    try {
      await actions.excluirCliente(c.id);
      setConfirmarExclusao(null);
      if (expandido === c.id) setExpandido(null);
    } catch (e) { setErro(e.message); }
  }

  async function salvarEdicaoVeiculo() {
    try {
      await actions.editarVeiculo(editVeiculo.id, editVeiculo);
      setEditVeiculo(null);
    } catch (e) { setErro(e.message); }
  }

  async function removerVeiculo(v) {
    try {
      await actions.excluirVeiculo(v.id);
      setConfirmarVeiculo(null);
    } catch (e) { setErro(e.message); }
  }

  async function addVeiculo(clienteId) {
    if (!nv.placa || !nv.modelo) return;
    try {
      await actions.criarVeiculo({ clienteId, ...nv, ano: Number(nv.ano) || null });
      setNv({ placa: "", marca: "", modelo: "", ano: "", cor: "" });
      setNovoVeiculoPara(null);
    } catch (e) { setErro(e.message); }
  }

  // bloco de gestão de veículos, reutilizado na lista e na edição
  // bloco de gestão de veículos, reutilizado na lista e na edição
  function BlocoVeiculos({ cliente }) {
    const dele = veiculos.filter((v) => v.clienteId === cliente.id);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>
            veículos deste cliente
          </div>
          {novoVeiculoPara !== cliente.id && (
            <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12 }} onClick={() => { setNovoVeiculoPara(cliente.id); setNv({ placa: "", marca: "", modelo: "", ano: "", cor: "" }); }}>
              + adicionar veículo
            </button>
          )}
        </div>

        {novoVeiculoPara === cliente.id && (
          <div style={{ background: "#fff", border: `1px solid ${C.accent}`, borderRadius: 6, padding: 12, marginBottom: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
            <input style={inputStyle} placeholder="placa" value={nv.placa} onChange={(e) => setNv({ ...nv, placa: e.target.value.toUpperCase() })} />
            <input style={inputStyle} placeholder="marca" value={nv.marca} onChange={(e) => setNv({ ...nv, marca: e.target.value })} />
            <input style={inputStyle} placeholder="modelo" value={nv.modelo} onChange={(e) => setNv({ ...nv, modelo: e.target.value })} />
            <input style={inputStyle} placeholder="ano" value={nv.ano} onChange={(e) => setNv({ ...nv, ano: e.target.value })} />
            <input style={inputStyle} placeholder="cor" value={nv.cor} onChange={(e) => setNv({ ...nv, cor: e.target.value })} />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={{ ...btnBase, padding: "6px 12px", fontSize: 12 }} onClick={() => setNovoVeiculoPara(null)}>cancelar</button>
              <button style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }} onClick={() => addVeiculo(cliente.id)} disabled={!nv.placa || !nv.modelo}>salvar veículo</button>
            </div>
          </div>
        )}

        {dele.length === 0 && novoVeiculoPara !== cliente.id && (
          <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>nenhum veículo cadastrado.</div>
        )}

        {dele.map((v) =>
          editVeiculo && editVeiculo.id === v.id ? (
            <div key={v.id} style={{ background: "#fff", border: `1px solid ${C.accent}`, borderRadius: 6, padding: 10, marginBottom: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.6fr 0.8fr", gap: 8 }}>
              <input style={inputStyle} value={editVeiculo.placa} onChange={(e) => setEditVeiculo({ ...editVeiculo, placa: e.target.value.toUpperCase() })} placeholder="placa" />
              <input style={inputStyle} value={editVeiculo.marca} onChange={(e) => setEditVeiculo({ ...editVeiculo, marca: e.target.value })} placeholder="marca" />
              <input style={inputStyle} value={editVeiculo.modelo} onChange={(e) => setEditVeiculo({ ...editVeiculo, modelo: e.target.value })} placeholder="modelo" />
              <input style={inputStyle} value={editVeiculo.ano} onChange={(e) => setEditVeiculo({ ...editVeiculo, ano: e.target.value })} placeholder="ano" />
              <input style={inputStyle} value={editVeiculo.cor || ""} onChange={(e) => setEditVeiculo({ ...editVeiculo, cor: e.target.value })} placeholder="cor" />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={{ ...btnBase, padding: "6px 12px", fontSize: 12 }} onClick={() => setEditVeiculo(null)}>cancelar</button>
                <button style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }} onClick={salvarEdicaoVeiculo}>salvar</button>
              </div>
            </div>
          ) : (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Plate placa={v.placa} />
                <span style={{ fontSize: 13, color: C.ink }}>{v.marca} {v.modelo} · {v.ano}{v.cor ? ` · ${v.cor}` : ""}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => setEditVeiculo(v)}>editar</button>
                {confirmarVeiculo === v.id ? (
                  <>
                    <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: "#fff", background: C.danger, borderColor: C.danger }} onClick={() => removerVeiculo(v)}>confirmar</button>
                    <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirmarVeiculo(null)}>cancelar</button>
                  </>
                ) : (
                  <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: C.danger }} onClick={() => setConfirmarVeiculo(v.id)}>excluir</button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>clientes e veículos</div>
        <button style={btnPrimary} onClick={() => setShowNovo(!showNovo)}>+ novo cliente</button>
      </div>

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input style={inputStyle} placeholder="telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            <input style={inputStyle} placeholder="CPF (opcional)" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input style={inputStyle} placeholder="endereço · rua, número, bairro, cidade/UF" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>acesso ao portal do cliente (opcional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input style={inputStyle} placeholder="email de acesso" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input style={inputStyle} placeholder="senha de acesso" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
          </div>
          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={{ ...btnPrimary, width: "100%" }} onClick={addCliente}>salvar cliente</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meusClientes.length === 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>
            nenhum cliente cadastrado nesta oficina. comece cadastrando o primeiro.
          </div>
        )}

        {meusClientes.map((c) => {
          const dele = veiculos.filter((v) => v.clienteId === c.id);
          const aberto = expandido === c.id;
          const editando = editCliente && editCliente.id === c.id;

          return (
            <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              {editando ? (
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>
                    dados do cliente
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <input style={inputStyle} value={editCliente.nome} onChange={(e) => setEditCliente({ ...editCliente, nome: e.target.value })} placeholder="nome" />
                    <input style={inputStyle} value={editCliente.telefone} onChange={(e) => setEditCliente({ ...editCliente, telefone: e.target.value })} placeholder="telefone" />
                    <input style={inputStyle} value={editCliente.cpf || ""} onChange={(e) => setEditCliente({ ...editCliente, cpf: e.target.value })} placeholder="CPF" />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <input style={inputStyle} value={editCliente.endereco || ""} onChange={(e) => setEditCliente({ ...editCliente, endereco: e.target.value })} placeholder="endereço · rua, número, bairro, cidade/UF" />
                  </div>

                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>acesso ao portal</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <input style={inputStyle} value={editCliente.email || ""} onChange={(e) => setEditCliente({ ...editCliente, email: e.target.value })} placeholder="email de acesso" />
                      <input style={inputStyle} value={editCliente.senha || ""} onChange={(e) => setEditCliente({ ...editCliente, senha: e.target.value })} placeholder="nova senha (deixe em branco p/ manter)" />
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 14, background: C.bg, margin: "0 -16px 14px", padding: "14px 16px" }}>
                    <BlocoVeiculos cliente={c} />
                  </div>

                  {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>{erro}</div>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button style={btnBase} onClick={() => { setEditCliente(null); setEditVeiculo(null); setNovoVeiculoPara(null); setErro(""); }}>fechar</button>
                    <button style={btnPrimary} onClick={salvarEdicaoCliente}>salvar alterações</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                  <div onClick={() => setExpandido(aberto ? null : c.id)} style={{ cursor: "pointer", flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>
                      {c.telefone}{c.cpf ? ` · ${c.cpf}` : ""}{c.email ? ` · acesso: ${c.email}` : " · sem acesso"}
                    </div>
                    {c.endereco && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{c.endereco}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tone="muted">{dele.length} veículo{dele.length !== 1 ? "s" : ""}</Badge>
                    <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => { setEditCliente(c); setExpandido(null); }}>editar</button>
                    {confirmarExclusao === c.id ? (
                      <>
                        <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: "#fff", background: C.danger, borderColor: C.danger }} onClick={() => excluirCliente(c)}>confirmar</button>
                        <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirmarExclusao(null)}>cancelar</button>
                      </>
                    ) : (
                      <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: C.danger }} onClick={() => setConfirmarExclusao(c.id)}>excluir</button>
                    )}
                  </div>
                </div>
              )}

              {aberto && !editando && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px", background: C.bg }}>
                  <BlocoVeiculos cliente={c} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- financeiro ----------
function Financeiro({ usuario, actions, usuarios, pagamentos, meusPagamentos, ordens, clientes }) {
  const [filtro, setFiltro] = useState("todos");
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState({ osId: "", valor: "", vencimento: "", jaPago: false, forma: "dinheiro", documento: "", comprovante: null });
  const [baixando, setBaixando] = useState(null); // pagamento sendo marcado como pago
  const [baixa, setBaixa] = useState({ forma: "dinheiro", documento: "", comprovante: null });
  const [erro, setErro] = useState("");
  const hoje = hojeISO();

  const nomeUsuario = (id) => usuarios.find((u) => u.id === id)?.nome || "-";
  const clienteDaOS = (id) => {
    const os = ordens.find((o) => o.id === id);
    return clientes.find((c) => c.id === os?.clienteId)?.nome || "-";
  };

  const linhas = useMemo(() => meusPagamentos.map((p) => ({
    ...p,
    situacao: p.pagoEm ? "pago" : p.vencimento < hoje ? "atrasado" : "pendente",
  })), [meusPagamentos, hoje]);

  const filtradas = linhas.filter((p) => filtro === "todos" || p.situacao === filtro);
  const totalPendente = linhas.filter((p) => p.situacao !== "pago").reduce((s, p) => s + p.valor, 0);

  // totais por forma de pagamento (só os já pagos)
  const porForma = useMemo(() => {
    const t = { dinheiro: 0, cartao: 0, pix: 0 };
    linhas.filter((p) => p.pagoEm && p.forma).forEach((p) => { t[p.forma] = (t[p.forma] || 0) + p.valor; });
    return t;
  }, [linhas]);

  function lerArquivo(file, cb) {
    if (!file) return cb(null);
    const reader = new FileReader();
    reader.onload = () => cb({ nome: file.name, tipo: file.type, dados: reader.result });
    reader.readAsDataURL(file);
  }

  async function confirmarBaixa() {
    const cfg = FORMAS[baixa.forma];
    if (cfg.exigeDoc && !baixa.documento && !baixa.comprovante) {
      setErro(`informe o ${cfg.rotuloDoc} ou anexe o comprovante.`);
      return;
    }
    try {
      await actions.marcarPago(baixando.id, { forma: baixa.forma, documento: baixa.documento || null, comprovante: baixa.comprovante });
      setBaixando(null);
      setBaixa({ forma: "dinheiro", documento: "", comprovante: null });
      setErro("");
    } catch (e) { setErro(e.message); }
  }

  async function marcarNaoPago(p) {
    try { await actions.estornarPagamento(p.id); } catch (e) { setErro(e.message); }
  }

  async function addPagamento() {
    if (!form.osId || !form.valor || !form.vencimento) return setErro("preencha O.S., valor e vencimento.");
    if (form.jaPago && FORMAS[form.forma].exigeDoc && !form.documento && !form.comprovante) {
      return setErro(`informe o ${FORMAS[form.forma].rotuloDoc} ou anexe o comprovante.`);
    }
    try {
      await actions.lancarPagamento({
        osId: Number(form.osId), valor: Number(form.valor), vencimento: form.vencimento, jaPago: form.jaPago,
        forma: form.jaPago ? form.forma : null,
        documento: form.jaPago ? (form.documento || null) : null,
        comprovante: form.jaPago ? form.comprovante : null,
      });
      setForm({ osId: "", valor: "", vencimento: "", jaPago: false, forma: "dinheiro", documento: "", comprovante: null });
      setShowNovo(false);
      setErro("");
    } catch (e) { setErro(e.message); }
  }

  const toneMap = { pago: "ok", pendente: "warn", atrasado: "danger" };
  const labelMap = { pago: "pago", pendente: "a vencer", atrasado: "atrasado" };

  return (
    <div style={{ maxWidth: 940 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>financeiro</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>total em aberto: R$ {totalPendente.toLocaleString("pt-BR")}</div>
        </div>
        <button style={btnPrimary} onClick={() => { setShowNovo(!showNovo); setErro(""); }}>+ novo pagamento</button>
      </div>

      {/* resumo por forma de pagamento */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        {Object.entries(FORMAS).map(([k, cfg]) => (
          <div key={k} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>recebido em {cfg.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, fontFamily: "Oswald, sans-serif", color: C.ink }}>
              R$ {(porForma[k] || 0).toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <select style={inputStyle} value={form.osId} onChange={(e) => setForm({ ...form, osId: e.target.value })}>
              <option value="">selecione a O.S.</option>
              {ordens.map((o) => <option key={o.id} value={o.id}>#{o.numero} · {clienteDaOS(o.id)}</option>)}
            </select>
            <input style={inputStyle} placeholder="valor (R$)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            <input style={inputStyle} type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
            <input type="checkbox" checked={form.jaPago} onChange={(e) => { setForm({ ...form, jaPago: e.target.checked }); setErro(""); }} />
            cliente já pagou (registra você como quem recebeu)
          </label>

          {form.jaPago && (
            <div style={{ background: C.bg, borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <SeletorForma
                valor={form.forma}
                onChange={(f) => { setForm({ ...form, forma: f, documento: "", comprovante: null }); setErro(""); }}
              />
              {FORMAS[form.forma].exigeDoc && (
                <CamposComprovante
                  forma={form.forma}
                  documento={form.documento}
                  comprovante={form.comprovante}
                  onDocumento={(v) => { setForm({ ...form, documento: v }); setErro(""); }}
                  onArquivo={(file) => lerArquivo(file, (c) => { setForm((f) => ({ ...f, comprovante: c })); setErro(""); })}
                />
              )}
            </div>
          )}

          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={btnPrimary} onClick={addPagamento}>salvar pagamento</button>
        </div>
      )}

      {/* painel de baixa */}
      {baixando && (
        <div style={{ background: C.surface, border: `2px solid ${C.accent}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
            registrar recebimento · O.S. #{ordens.find((o) => o.id === baixando.osId)?.numero}
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 14 }}>
            {clienteDaOS(baixando.osId)} · R$ {baixando.valor.toLocaleString("pt-BR")}
          </div>

          <SeletorForma valor={baixa.forma} onChange={(f) => { setBaixa({ forma: f, documento: "", comprovante: null }); setErro(""); }} />

          {FORMAS[baixa.forma].exigeDoc && (
            <CamposComprovante
              forma={baixa.forma}
              documento={baixa.documento}
              comprovante={baixa.comprovante}
              onDocumento={(v) => { setBaixa({ ...baixa, documento: v }); setErro(""); }}
              onArquivo={(file) => lerArquivo(file, (c) => { setBaixa((b) => ({ ...b, comprovante: c })); setErro(""); })}
            />
          )}

          {erro && <div style={{ fontSize: 12, color: C.danger, marginTop: 10 }}>{erro}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <button style={btnBase} onClick={() => { setBaixando(null); setErro(""); }}>cancelar</button>
            <button style={btnPrimary} onClick={confirmarBaixa}>confirmar recebimento</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["todos", "pendente", "atrasado", "pago"].map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ ...btnBase, padding: "6px 12px", fontSize: 12, background: filtro === f ? C.steel : "#fff", color: filtro === f ? "#fff" : C.ink, borderColor: filtro === f ? C.steel : C.border }}>
            {f === "todos" ? "todos" : labelMap[f]}
          </button>
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.muted, textAlign: "left", background: C.bg }}>
              <th style={{ fontWeight: 500, padding: "9px 16px" }}>O.S.</th>
              <th style={{ fontWeight: 500 }}>cliente</th>
              <th style={{ fontWeight: 500 }}>vencimento</th>
              <th style={{ fontWeight: 500 }}>situação</th>
              <th style={{ fontWeight: 500 }}>forma / comprovante</th>
              <th style={{ fontWeight: 500 }}>recebido por</th>
              <th style={{ fontWeight: 500, textAlign: "right" }}>valor</th>
              <th style={{ fontWeight: 500, padding: "9px 16px", textAlign: "right" }}>ação</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: C.muted }}>nenhum lançamento nesse filtro.</td></tr>
            )}
            {filtradas.map((p) => {
              const os = ordens.find((o) => o.id === p.osId);
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace" }}>#{os?.numero}</td>
                  <td>{clienteDaOS(p.osId)}</td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{fmtData(p.vencimento)}</td>
                  <td><Badge tone={toneMap[p.situacao]}>{labelMap[p.situacao]}</Badge></td>
                  <td style={{ fontSize: 12 }}>
                    {p.forma ? (
                      <>
                        <Badge tone={p.forma === "dinheiro" ? "ok" : "accent"}>{FORMAS[p.forma].label}</Badge>
                        {p.documento && (
                          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.inkSoft, marginTop: 3 }}>{p.documento}</div>
                        )}
                        {p.comprovante && (
                          <a href={p.comprovante.dados} download={p.comprovante.nome}
                            style={{ fontSize: 11, color: C.accentDark, textDecoration: "underline", cursor: "pointer" }}>
                            ver comprovante
                          </a>
                        )}
                      </>
                    ) : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: p.recebidoPor ? C.ink : C.muted }}>
                    {p.recebidoPor ? nomeUsuario(p.recebidoPor) : "—"}
                    {p.pagoEm && <div style={{ fontSize: 11, color: C.muted }}>em {fmtData(p.pagoEm)}</div>}
                  </td>
                  <td style={{ textAlign: "right" }}>R$ {p.valor.toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    {p.situacao === "pago"
                      ? <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => marcarNaoPago(p)}>estornar</button>
                      : <button style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12 }} onClick={() => { setBaixando(p); setBaixa({ forma: "dinheiro", documento: "", comprovante: null }); setErro(""); }}>marcar pago</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// seletor de forma de pagamento
function SeletorForma({ valor, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.inkSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
        forma de pagamento
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {Object.entries(FORMAS).map(([k, cfg]) => (
          <button key={k} onClick={() => onChange(k)}
            style={{
              ...btnBase, flex: 1, padding: "10px 0", fontSize: 13,
              background: valor === k ? C.accent : "#fff",
              borderColor: valor === k ? C.accent : C.border,
              color: valor === k ? "#fff" : C.ink,
              fontWeight: valor === k ? 600 : 500,
            }}>
            {cfg.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// campos de comprovante (cartão / pix)
function CamposComprovante({ forma, documento, comprovante, onDocumento, onArquivo }) {
  const cfg = FORMAS[forma];
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {cfg.rotuloDoc}
          </label>
          <input style={inputStyle} value={documento} onChange={(e) => onDocumento(e.target.value)}
            placeholder={forma === "pix" ? "Ex: E1234567820260810" : "Ex: 004512"} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
            anexar comprovante
          </label>
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => onArquivo(e.target.files?.[0])}
            style={{ ...inputStyle, padding: "7px 8px", fontSize: 12 }} />
        </div>
      </div>
      {comprovante && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.ok, display: "flex", alignItems: "center", gap: 8 }}>
          <span>anexado: {comprovante.nome}</span>
          <a href={comprovante.dados} download={comprovante.nome} style={{ color: C.accentDark, textDecoration: "underline" }}>ver</a>
        </div>
      )}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
        informe o {cfg.rotuloDoc} ou anexe o comprovante — pelo menos um dos dois.
      </div>
    </div>
  );
}

// ---------- auditoria ----------
// ---------- equipe / acessos (máximo 3 por oficina) ----------
const LIMITE_ACESSOS = 3;
const PERFIS = { admin: "admin", atendente: "atendente", mecanico: "mecânico" };

function Equipe({ usuario, actions, usuarios, minhaEquipe }) {
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", perfil: "atendente" });
  const [erro, setErro] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  const noLimite = minhaEquipe.length >= LIMITE_ACESSOS;
  const admins = minhaEquipe.filter((u) => u.perfil === "admin");

  async function addUsuario() {
    if (!form.nome || !form.email || !form.senha) return setErro("preencha nome, email e senha.");
    if (noLimite) return setErro(`limite de ${LIMITE_ACESSOS} acessos por oficina atingido.`);
    try {
      await actions.criarUsuario(form);
      setForm({ nome: "", email: "", senha: "", perfil: "atendente" });
      setShowNovo(false);
      setErro("");
    } catch (e) { setErro(e.message); }
  }

  async function removerUsuario(u) {
    if (u.perfil === "admin" && admins.length <= 1) {
      setErro("não é possível remover o último administrador da oficina.");
      setConfirmarExclusao(null);
      return;
    }
    try {
      await actions.removerUsuario(u.id);
      setConfirmarExclusao(null);
    } catch (e) { setErro(e.message); }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>acessos da equipe</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{minhaEquipe.length} de {LIMITE_ACESSOS} acessos usados nesta oficina</div>
        </div>
        {!noLimite && <button style={btnPrimary} onClick={() => { setShowNovo(!showNovo); setErro(""); }}>+ novo acesso</button>}
      </div>

      {noLimite && !showNovo && (
        <div style={{ background: C.warnBg, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: C.warn }}>
          limite de {LIMITE_ACESSOS} acessos atingido. remova um acesso existente para poder cadastrar outro.
        </div>
      )}

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <select style={inputStyle} value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
              {Object.entries(PERFIS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="email de acesso" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input style={inputStyle} type="password" placeholder="senha" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={{ ...btnPrimary, width: "100%" }} onClick={addUsuario}>salvar acesso</button>
        </div>
      )}

      {erro && !showNovo && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {minhaEquipe.map((u) => (
          <div key={u.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{u.nome}{u.id === usuario.id ? " (você)" : ""}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{u.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={u.perfil === "admin" ? "accent" : "muted"}>{PERFIS[u.perfil]}</Badge>
              {confirmarExclusao === u.id ? (
                <>
                  <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: "#fff", background: C.danger, borderColor: C.danger }} onClick={() => removerUsuario(u)}>confirmar</button>
                  <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirmarExclusao(null)}>cancelar</button>
                </>
              ) : (
                <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: C.danger }} onClick={() => { setConfirmarExclusao(u.id); setErro(""); }}>remover</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- despesas mensais ----------
function Despesas({ usuario, actions, despesas, meusPagamentos }) {
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState({ descricao: "", categoria: "outros", valor: "", dataVencimento: "", fixa: false });
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [erro, setErro] = useState("");

  const minhasDespesas = despesas;
  const totalMes = minhasDespesas.reduce((s, d) => s + d.valor, 0);

  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);
  const faturamentoMes = meusPagamentos.filter((p) => p.pagoEm && p.pagoEm.slice(0, 7) === mesAtual).reduce((s, p) => s + p.valor, 0);

  async function addDespesa() {
    if (!form.descricao || !form.valor) return;
    try {
      await actions.criarDespesa({ ...form, valor: Number(form.valor) });
      setForm({ descricao: "", categoria: "outros", valor: "", dataVencimento: "", fixa: false });
      setShowNovo(false);
      setErro("");
    } catch (e) { setErro(e.message); }
  }

  async function removerDespesa(d) {
    try {
      await actions.excluirDespesa(d.id);
      setConfirmarExclusao(null);
    } catch (e) { setErro(e.message); }
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>despesas mensais</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>total de despesas cadastradas: R$ {totalMes.toLocaleString("pt-BR")}</div>
        </div>
        <button style={btnPrimary} onClick={() => setShowNovo(!showNovo)}>+ nova despesa</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <StatCard label="faturamento do mês" value={`R$ ${faturamentoMes.toLocaleString("pt-BR")}`} tone="ok" />
        <StatCard label="despesas do mês" value={`R$ ${totalMes.toLocaleString("pt-BR")}`} tone="danger" />
        <StatCard label="saldo do mês" value={`R$ ${(faturamentoMes - totalMes).toLocaleString("pt-BR")}`} tone={faturamentoMes - totalMes >= 0 ? "ok" : "danger"} />
      </div>

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="descrição · Ex: aluguel do galpão" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <select style={inputStyle} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {Object.entries(CATEGORIAS_DESPESA).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <input style={inputStyle} placeholder="valor (R$)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, alignItems: "center" }}>
            <input style={inputStyle} type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.inkSoft }}>
              <input type="checkbox" checked={form.fixa} onChange={(e) => setForm({ ...form, fixa: e.target.checked })} />
              despesa fixa (se repete todo mês)
            </label>
          </div>
          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={{ ...btnPrimary, width: "100%" }} onClick={addDespesa}>salvar despesa</button>
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {minhasDespesas.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>nenhuma despesa cadastrada ainda.</div>
        )}
        {minhasDespesas.map((d, i) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{d.descricao}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                {CATEGORIAS_DESPESA[d.categoria]}{d.fixa ? " · fixa" : ""}{d.dataVencimento ? ` · vence ${fmtData(d.dataVencimento)}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: C.danger }}>R$ {d.valor.toLocaleString("pt-BR")}</span>
              {confirmarExclusao === d.id ? (
                <>
                  <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: "#fff", background: C.danger, borderColor: C.danger }} onClick={() => removerDespesa(d)}>confirmar</button>
                  <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirmarExclusao(null)}>cancelar</button>
                </>
              ) : (
                <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: C.danger }} onClick={() => setConfirmarExclusao(d.id)}>excluir</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Auditoria({ auditoria, equipe }) {
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const nomeUsuario = (id) => equipe.find((u) => u.id === id)?.nome || "usuário removido";
  const filtrada = auditoria.filter((a) => filtroUsuario === "todos" || a.usuarioId === Number(filtroUsuario));

  const toneAcao = (acao) => {
    if (acao.includes("excluiu") || acao.includes("estornou")) return "danger";
    if (acao.includes("recebeu")) return "ok";
    if (acao.includes("alterou")) return "warn";
    return "accent";
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>auditoria</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>registro de tudo que foi alterado nesta oficina, e por quem</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.inkSoft }}>filtrar por usuário:</span>
        <select style={{ ...inputStyle, width: 220 }} value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
          <option value="todos">todos</option>
          {equipe.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {filtrada.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>nenhum registro ainda.</div>
        )}
        {filtrada.map((a, i) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
            <div style={{ width: 130, flexShrink: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.muted }}>{fmtDataHora(a.em)}</div>
            <div style={{ width: 140, flexShrink: 0 }}><Badge tone={toneAcao(a.acao)}>{a.acao}</Badge></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{a.entidade}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{a.detalhe}</div>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, textAlign: "right", flexShrink: 0 }}>{nomeUsuario(a.usuarioId)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- portal do cliente ----------
function PortalCliente({ cliente, oficina, ordens, pagamentos, onSair }) {
  const minhasOrdens = ordens;
  const meusPagamentos = pagamentos;
  const veiculosUnicos = [...new Map(minhasOrdens.map((o) => [o.veiculoPlaca, { modelo: o.veiculoModelo, ano: o.veiculoAno, placa: o.veiculoPlaca }])).values()];
  const hoje = hojeISO();

  const toneMap = { pago: "ok", pendente: "warn", atrasado: "danger" };
  const labelMap = { pago: "pago", pendente: "a vencer", atrasado: "atrasado" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 560, borderRadius: 12, border: `1px solid ${C.border}`, padding: 24 }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>olá, {cliente.nome.split(" ")[0]}</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{oficina?.nome} · {veiculosUnicos.length} veículo{veiculosUnicos.length !== 1 ? "s" : ""}</div>
          </div>
          <button style={btnBase} onClick={onSair}>sair</button>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.ink }}>minhas ordens de serviço</div>
          {minhasOrdens.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhuma O.S. registrada.</div>}
          {minhasOrdens.map((o) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>#{o.numero} · {o.veiculoModelo} {o.veiculoAno}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{o.descricao}</div>
              </div>
              <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
            </div>
          ))}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.ink }}>meus pagamentos</div>
          {meusPagamentos.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhum pagamento registrado.</div>}
          {meusPagamentos.map((p) => {
            const situacao = p.pagoEm ? "pago" : p.vencimento < hoje ? "atrasado" : "pendente";
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, color: C.ink }}>vencimento {fmtData(p.vencimento)} · R$ {p.valor.toLocaleString("pt-BR")}</div>
                  {p.forma && (
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                      pago via {FORMAS[p.forma].label}{p.documento ? ` · ${p.documento}` : ""}
                    </div>
                  )}
                </div>
                <Badge tone={toneMap[situacao]}>{labelMap[situacao]}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
