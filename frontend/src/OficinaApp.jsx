import { useState, useEffect } from "react";
import { api } from "./api";
import { btnBase, btnPrimary, C, FONTS } from "./styles/theme";
import { Auditoria } from "./pages/Auditoria";
import { CadastroOficina } from "./pages/CadastroOficina";
import { ClientesVeiculos } from "./pages/ClientesVeiculos";
import { Dashboard } from "./pages/Dashboard";
import { DadosOficina } from "./pages/DadosOficina";
import { Despesas } from "./pages/Despesas";
import { Equipe } from "./pages/Equipe";
import { Financeiro } from "./pages/Financeiro";
import { MinhaAssinatura } from "./pages/MinhaAssinatura";
import { DetalheOS } from "./pages/ordens/DetalheOS";
import { ImpressaoOS } from "./pages/ordens/ImpressaoOS";
import { NovaOS } from "./pages/ordens/NovaOS";
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

