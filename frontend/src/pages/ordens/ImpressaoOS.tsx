import { useState, type CSSProperties } from "react";
import type { Cliente, Id, Oficina, Ordem, Pagamento, Produto, Servico, Usuario, Veiculo } from "../../api";
import { Badge, Plate } from "../../components/ui";
import { FORMAS, STATUS_LABEL, STATUS_TONE } from "../../constants";
import { btnBase, btnPrimary, C, FONTS } from "../../styles/theme";
import { agoraISO, fmtData, fmtDataHora } from "../../utils/datas";

type Formato = "cliente" | "fiscal";

const FORMATOS: [Formato, string, string][] = [
  ["cliente", "O.S. para o cliente", "sem CPF · via de entrega"],
  ["fiscal", "via fiscal", "com CPF · arquivo da oficina"],
];

const linha: CSSProperties = { display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 };
const rot: CSSProperties = { color: C.inkSoft, fontSize: 12 };
const tituloSecao: CSSProperties = { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 };

interface ImpressaoOSProps {
  os: Ordem;
  oficina: Oficina | null;
  cliente: Cliente | undefined;
  veiculo: Veiculo | undefined;
  usuarios: Usuario[];
  servicos: Servico[];
  produtos: Produto[];
  pagamentos: Pagamento[];
  onFechar: () => void;
}

// Documento da O.S. para imprimir ou salvar em PDF. A via fiscal mostra o
// CPF do cliente e os documentos de pagamento; a do cliente, não.
export function ImpressaoOS({ os, oficina, cliente, veiculo, usuarios, servicos, produtos, pagamentos, onFechar }: ImpressaoOSProps) {
  const [formato, setFormato] = useState<Formato>("cliente");
  const fiscal = formato === "fiscal";

  const nomeUsuario = (id: Id | null) => usuarios.find((u) => u.id === id)?.nome || "-";
  const servicosDaOS = servicos.filter((s) => os.servicosIds?.includes(s.id));
  const pecasDaOS = os.pecasUtilizadas || [];

  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,36,42,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1000,
        padding: "32px 24px",
        overflowY: "auto",
      }}
    >
      <style>{FONTS}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720 }}>
        {/* barra de controle — não sai na impressão */}
        <div className="no-print" style={{ margin: "0 auto 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button style={btnBase} onClick={onFechar}>
              ✕ fechar
            </button>
            <button style={btnPrimary} onClick={() => window.print()}>
              imprimir / salvar PDF
            </button>
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ ...tituloSecao, letterSpacing: 0.4 }}>formato do documento</div>
            <div style={{ display: "flex", gap: 8 }}>
              {FORMATOS.map(([id, titulo, sub]) => (
                <button
                  key={id}
                  onClick={() => setFormato(id)}
                  style={{
                    ...btnBase,
                    flex: 1,
                    textAlign: "left",
                    padding: "10px 12px",
                    background: formato === id ? C.accentBg : "#fff",
                    borderColor: formato === id ? C.accent : C.border,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: formato === id ? C.accentDark : C.ink }}>{titulo}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="print-area"
          style={{ margin: "0 auto", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: 32, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
        >
          {/* cabeçalho da empresa */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: `2px solid ${C.steel}`,
              paddingBottom: 14,
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {oficina?.logo && <img src={oficina.logo} alt="logo" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 6, flexShrink: 0 }} />}
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
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>ordem de serviço</div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, fontWeight: 500, color: C.accent }}>#{os.numero}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{fmtDataHora(os.criadoEm)}</div>
              <div style={{ marginTop: 6 }}>
                <Badge tone={fiscal ? "warn" : "muted"}>{fiscal ? "via fiscal" : "via do cliente"}</Badge>
              </div>
            </div>
          </div>

          {/* cliente e veículo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 18 }}>
            <div>
              <div style={tituloSecao}>cliente</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{cliente?.nome}</div>
              <div style={{ ...rot, marginTop: 3, lineHeight: 1.6 }}>
                <div>{cliente?.telefone}</div>
                {fiscal && cliente?.cpf && <div>CPF: {cliente.cpf}</div>}
                {cliente?.endereco && <div>{cliente.endereco}</div>}
              </div>
            </div>
            <div>
              <div style={tituloSecao}>veículo</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Plate placa={veiculo?.placa ?? ""} />
              </div>
              <div style={{ ...rot, lineHeight: 1.6 }}>
                <div>
                  {veiculo?.marca} {veiculo?.modelo} · {veiculo?.ano}
                  {veiculo?.cor ? ` · ${veiculo.cor}` : ""}
                </div>
                {os.km && <div>KM de entrada: {os.km}</div>}
                {os.dataSaida && <div>Data de saída: {fmtData(os.dataSaida)}</div>}
              </div>
            </div>
          </div>

          {/* relato */}
          <div style={{ marginBottom: 18 }}>
            <div style={tituloSecao}>relato / serviço solicitado</div>
            <div style={{ fontSize: 13, color: C.ink, background: C.bg, padding: "12px 14px", borderRadius: 6, lineHeight: 1.6, minHeight: 50 }}>{os.descricao}</div>
          </div>

          {/* serviços e peças */}
          {(servicosDaOS.length > 0 || pecasDaOS.length > 0) && (
            <div style={{ marginBottom: 18 }}>
              <div style={tituloSecao}>serviços e peças</div>
              {servicosDaOS.map((s) => (
                <div key={`serv-${s.id}`} style={linha}>
                  <span style={rot}>{s.nome}</span>
                  <span>R$ {s.preco.toLocaleString("pt-BR")}</span>
                </div>
              ))}
              {pecasDaOS.map((u) => {
                const produto = produtos.find((p) => p.id === u.produtoId);
                if (!produto) return null;
                return (
                  <div key={`peca-${produto.id}`} style={linha}>
                    <span style={rot}>
                      {produto.nome}
                      {u.quantidade > 1 ? ` (${u.quantidade}x)` : ""}
                    </span>
                    <span>R$ {(produto.precoVenda * u.quantidade).toLocaleString("pt-BR")}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* observações do mecânico */}
          {os.observacoesMecanico && (
            <div style={{ marginBottom: 18 }}>
              <div style={tituloSecao}>observações técnicas</div>
              <div style={{ fontSize: 13, color: C.ink, background: C.bg, padding: "12px 14px", borderRadius: 6, lineHeight: 1.6 }}>{os.observacoesMecanico}</div>
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
                  ) : (
                    " · em aberto"
                  )}
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
              <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "Oswald, sans-serif" }}>R$ {(os.valorTotal - (os.sinal || 0)).toLocaleString("pt-BR")}</span>
            </div>
          </div>

          {/* assinaturas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 44 }}>
            <div style={{ borderTop: `1px solid ${C.ink}`, paddingTop: 6, textAlign: "center", fontSize: 11, color: C.inkSoft }}>assinatura do cliente</div>
            <div style={{ borderTop: `1px solid ${C.ink}`, paddingTop: 6, textAlign: "center", fontSize: 11, color: C.inkSoft }}>responsável pela oficina</div>
          </div>

          <div style={{ textAlign: "center", fontSize: 10, color: C.muted, marginTop: 24 }}>
            {fiscal ? "via fiscal · uso interno da oficina" : "via do cliente"} · documento gerado em {fmtDataHora(agoraISO())}
          </div>
        </div>
      </div>
    </div>
  );
}
