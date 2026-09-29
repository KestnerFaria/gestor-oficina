import { useState } from "react";
import type { StatusAssinatura } from "../api";
import { btnBase, btnPrimary, C, FONTS } from "../styles/theme";
import { mensagemDeErro } from "../utils/erros";

interface TelaAssinaturaBloqueadaProps {
  mensagem?: string;
  status?: StatusAssinatura;
  onTentarNovamente: () => Promise<void>;
  onReativar: () => Promise<void>;
  onSair: () => void;
}

// Aparece quando a assinatura da oficina está atrasada ou cancelada
// (o backend responde 402 e o app troca para esta tela).
export function TelaAssinaturaBloqueada({ mensagem, status, onTentarNovamente, onReativar, onSair }: TelaAssinaturaBloqueadaProps) {
  const [verificando, setVerificando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const cancelada = status === "cancelada";

  // mesma lógica para os dois botões: mostra "carregando", roda a ação
  // e exibe a mensagem se der erro
  async function executar(acao: () => Promise<void>) {
    setVerificando(true);
    setErroAcao("");
    try {
      await acao();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    } finally {
      setVerificando(false);
    }
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
            {mensagem ||
              (cancelada
                ? "a assinatura desta oficina foi cancelada. reative para continuar usando o sistema."
                : "sua assinatura está atrasada. verifique o email de cobrança enviado pelo Asaas e regularize o pagamento pra continuar usando o sistema.")}
          </div>

          {erroAcao && <div style={{ fontSize: 12, color: C.danger, marginBottom: 14 }}>{erroAcao}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cancelada ? (
              <button style={btnPrimary} onClick={() => executar(onReativar)} disabled={verificando}>
                {verificando ? "reativando..." : "reativar assinatura"}
              </button>
            ) : (
              <button style={btnPrimary} onClick={() => executar(onTentarNovamente)} disabled={verificando}>
                {verificando ? "verificando..." : "já paguei, verificar novamente"}
              </button>
            )}
            <button style={btnBase} onClick={onSair}>
              sair
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#9BA1A9", textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
          dúvidas sobre a cobrança? entre em contato com o suporte do sistema.
        </div>
      </div>
    </div>
  );
}
