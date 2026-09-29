import type { Oficina, Ordem, Pagamento } from "../api";
import { Badge } from "../components/ui";
import { FORMAS, STATUS_LABEL, STATUS_TONE, type Tom } from "../constants";
import type { Sessao } from "../sessao";
import { btnBase, C, FONTS } from "../styles/theme";
import { fmtData, hojeISO } from "../utils/datas";

type Situacao = "pago" | "pendente" | "atrasado";

const TOM_SITUACAO: Record<Situacao, Tom> = { pago: "ok", pendente: "warn", atrasado: "danger" };
const LABEL_SITUACAO: Record<Situacao, string> = { pago: "pago", pendente: "a vencer", atrasado: "atrasado" };

// Pago, a vencer ou atrasado, comparando o vencimento com a data de hoje
export function situacaoDoPagamento(pagamento: Pick<Pagamento, "pagoEm" | "vencimento">, hoje: string): Situacao {
  if (pagamento.pagoEm) return "pago";
  return pagamento.vencimento < hoje ? "atrasado" : "pendente";
}

interface PortalClienteProps {
  cliente: Extract<Sessao, { tipo: "cliente" }>["cliente"];
  oficina: Oficina | null;
  ordens: Ordem[];
  pagamentos: Pagamento[];
  onSair: () => void;
}

// Área do cliente da oficina: vê as próprias O.S. e pagamentos
export function PortalCliente({ cliente, oficina, ordens, pagamentos, onSair }: PortalClienteProps) {
  // um Map por placa elimina veículos repetidos (várias O.S. do mesmo carro)
  const quantidadeVeiculos = new Map(ordens.map((o) => [o.veiculoPlaca, true])).size;
  const hoje = hojeISO();

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 560, borderRadius: 12, border: `1px solid ${C.border}`, padding: 24 }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>olá, {cliente.nome.split(" ")[0]}</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>
              {oficina?.nome} · {quantidadeVeiculos} veículo{quantidadeVeiculos !== 1 ? "s" : ""}
            </div>
          </div>
          <button style={btnBase} onClick={onSair}>
            sair
          </button>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.ink }}>minhas ordens de serviço</div>
          {ordens.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhuma O.S. registrada.</div>}
          {ordens.map((o) => (
            <div
              key={o.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}` }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
                  #{o.numero} · {o.veiculoModelo} {o.veiculoAno}
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{o.descricao}</div>
              </div>
              <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
            </div>
          ))}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.ink }}>meus pagamentos</div>
          {pagamentos.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhum pagamento registrado.</div>}
          {pagamentos.map((p) => {
            const situacao = situacaoDoPagamento(p, hoje);
            return (
              <div
                key={p.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}` }}
              >
                <div>
                  <div style={{ fontSize: 13, color: C.ink }}>
                    vencimento {fmtData(p.vencimento)} · R$ {p.valor.toLocaleString("pt-BR")}
                  </div>
                  {p.forma && (
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                      pago via {FORMAS[p.forma].label}
                      {p.documento ? ` · ${p.documento}` : ""}
                    </div>
                  )}
                </div>
                <Badge tone={TOM_SITUACAO[situacao]}>{LABEL_SITUACAO[situacao]}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
