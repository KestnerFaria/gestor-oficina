import { useEffect, useState } from "react";
import type { Assinatura, CobrancaAssinatura, StatusAssinatura } from "../api";
import { Badge } from "../components/ui";
import { cobrancaPaga, seloDaCobranca } from "../regras";
import { btnBase, btnPrimary, C } from "../styles/theme";
import { fmtData } from "../utils/datas";
import { mensagemDeErro } from "../utils/erros";

const FORMA_COBRANCA: Record<string, string> = {
  BOLETO: "boleto",
  CREDIT_CARD: "cartão",
  PIX: "pix",
  UNDEFINED: "a escolher",
};

// Texto e cor do quadro de status da assinatura
function resumoDaAssinatura(assinatura: Assinatura): { texto: string; fundo: string } {
  const textos: Record<StatusAssinatura, string> = {
    trial: `período de teste grátis — até ${fmtData(assinatura.trialTerminaEm)}`,
    ativa: "assinatura em dia",
    atrasada: "assinatura atrasada",
    cancelada: "assinatura cancelada",
    pendente_configuracao: "cobrança ainda não configurada",
  };
  const fundo =
    assinatura.status === "ativa"
      ? C.okBg
      : assinatura.status === "atrasada" || assinatura.status === "cancelada"
        ? C.dangerBg
        : C.accentBg;
  return { texto: textos[assinatura.status], fundo };
}

interface MinhaAssinaturaProps {
  actions: {
    verAssinatura: () => Promise<Assinatura | null>;
    listarCobrancasAssinatura: () => Promise<CobrancaAssinatura[]>;
    configurarAssinatura: () => Promise<unknown>;
    cancelarAssinatura: () => Promise<unknown>;
  };
}

// Assinatura do sistema: status, histórico de meses e link de pagamento
export function MinhaAssinatura({ actions }: MinhaAssinaturaProps) {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [cobrancas, setCobrancas] = useState<CobrancaAssinatura[]>([]);
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
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // carrega só ao abrir a tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function configurarAssinatura() {
    setConfigurando(true);
    setErro("");
    try {
      await actions.configurarAssinatura();
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
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
      setErro(mensagemDeErro(e));
    } finally {
      setCancelando(false);
    }
  }

  const resumo = assinatura ? resumoDaAssinatura(assinatura) : null;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>minha assinatura</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>cobrança do sistema — Pix, boleto ou cartão, e o histórico de meses pagos</div>
      </div>

      {carregando && <div style={{ fontSize: 13, color: C.muted }}>carregando...</div>}

      {!carregando && assinatura && resumo && (
        <div style={{ background: resumo.fundo, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{resumo.texto}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>mensalidade: R$ {Number(assinatura.valor).toLocaleString("pt-BR")}</div>
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
                <button style={btnBase} onClick={() => setConfirmarCancelamento(false)}>
                  voltar
                </button>
                <button
                  style={{ ...btnBase, color: "#fff", background: C.danger, borderColor: C.danger }}
                  onClick={cancelarAssinatura}
                  disabled={cancelando}
                >
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
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink }}>histórico de meses</div>
          {cobrancas.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>
              nenhuma cobrança gerada ainda — assim que o período de teste terminar, o primeiro mês aparece aqui.
            </div>
          )}
          {cobrancas.map((c, i) => {
            const selo = seloDaCobranca(c.status);
            const forma = FORMA_COBRANCA[c.formaPagamento];
            return (
              <div
                key={c.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>vencimento {fmtData(c.vencimento)}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                    {c.pagoEm ? `pago em ${fmtData(c.pagoEm)} · ${forma || c.formaPagamento}` : `forma: ${forma || "a escolher"}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: C.ink }}>
                    R$ {Number(c.valor).toLocaleString("pt-BR")}
                  </span>
                  <Badge tone={selo.tone}>{selo.label}</Badge>
                  {!cobrancaPaga(c.status) && c.linkPagamento && (
                    <a
                      href={c.linkPagamento}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12, textDecoration: "none", display: "inline-block" }}
                    >
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
