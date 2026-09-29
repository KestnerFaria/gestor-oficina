import { useState } from "react";
import { useDadosCliente } from "./hooks/useDadosCliente";
import { useDadosOficina } from "./hooks/useDadosOficina";
import { useSessao } from "./hooks/useSessao";
import { CadastroOficina } from "./pages/CadastroOficina";
import { PainelOficina } from "./pages/PainelOficina";
import { PortalCliente } from "./pages/PortalCliente";
import { TelaAssinaturaBloqueada } from "./pages/TelaAssinaturaBloqueada";
import { TelaLogin } from "./pages/TelaLogin";
import type { Sessao } from "./sessao";
import { C, FONTS } from "./styles/theme";

function TelaCarregando() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
      <style>{FONTS}</style>
      <div style={{ color: C.inkSoft, fontSize: 14 }}>carregando...</div>
    </div>
  );
}

// ------------------------------------------------------------
// Área da equipe: carrega os dados e decide entre carregando,
// bloqueio de assinatura e o painel
// ------------------------------------------------------------
function AreaDaEquipe({ sessao, onSair }: { sessao: Extract<Sessao, { tipo: "equipe" }>; onSair: () => void }) {
  const { dados, carregando, bloqueio, recarregar, reativarAssinatura, actions } = useDadosOficina(sessao, onSair);

  if (bloqueio) {
    return (
      <TelaAssinaturaBloqueada
        mensagem={bloqueio.mensagem}
        status={bloqueio.status}
        onTentarNovamente={recarregar}
        onReativar={reativarAssinatura}
        onSair={onSair}
      />
    );
  }

  if (carregando || !dados.oficina) return <TelaCarregando />;

  return <PainelOficina usuario={sessao.usuario} oficina={dados.oficina} dados={dados} actions={actions} onSair={onSair} />;
}

// ------------------------------------------------------------
// Área do cliente (portal)
// ------------------------------------------------------------
function AreaDoCliente({ sessao, onSair }: { sessao: Extract<Sessao, { tipo: "cliente" }>; onSair: () => void }) {
  const { oficina, ordens, pagamentos, carregando } = useDadosCliente(sessao, onSair);
  if (carregando) return <TelaCarregando />;
  return <PortalCliente cliente={sessao.cliente} oficina={oficina} ordens={ordens} pagamentos={pagamentos} onSair={onSair} />;
}

// ============================================================
// APP RAIZ — decide qual tela mostrar
// ============================================================
export default function OficinaApp() {
  const { sessao, entrar, sair } = useSessao();
  const [tela, setTela] = useState<"login" | "cadastro">("login");

  if (!sessao) {
    if (tela === "cadastro") {
      return (
        <CadastroOficina
          onVoltar={() => setTela("login")}
          onCadastrado={(nova) => {
            entrar(nova);
            setTela("login");
          }}
        />
      );
    }
    return <TelaLogin onEntrar={entrar} onCadastrar={() => setTela("cadastro")} />;
  }

  // key={token}: cada login recria a área do zero, sem sobrar dados da
  // sessão anterior (ex: outra oficina logada no mesmo navegador)
  if (sessao.tipo === "cliente") return <AreaDoCliente key={sessao.token} sessao={sessao} onSair={sair} />;
  return <AreaDaEquipe key={sessao.token} sessao={sessao} onSair={sair} />;
}
