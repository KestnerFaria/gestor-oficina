import { useState, useEffect } from "react";
import { api } from "./api";
import { agoraISO, fmtData, fmtDataHora, hojeISO } from "./utils/datas";
import { CATEGORIAS_DESPESA, FORMAS, STATUS_LABEL, STATUS_TONE } from "./constants";
import { btnBase, btnPrimary, C, FONTS, inputStyle } from "./styles/theme";
import { Badge, CamposComprovante, Field, ModalSelecao, Plate, SeletorForma, StatCard } from "./components/ui";
import { Auditoria } from "./pages/Auditoria";
import { CadastroOficina } from "./pages/CadastroOficina";
import { Dashboard } from "./pages/Dashboard";
import { DadosOficina } from "./pages/DadosOficina";
import { Despesas } from "./pages/Despesas";
import { Equipe } from "./pages/Equipe";
import { Financeiro } from "./pages/Financeiro";
import { MinhaAssinatura } from "./pages/MinhaAssinatura";
import { PortalCliente } from "./pages/PortalCliente";
import { ServicosEstoque } from "./pages/ServicosEstoque";
import { TelaAssinaturaBloqueada } from "./pages/TelaAssinaturaBloqueada";
import { TelaLogin } from "./pages/TelaLogin";

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

// ---------- impressão da O.S. ----------
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

// ---------- nova O.S. ----------

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

