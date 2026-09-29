import { useMemo, useState } from "react";
import type { Cliente, Comprovante, FormaPagamento, Id, Ordem, Pagamento, Usuario } from "../api";
import { Badge, CamposComprovante, SeletorForma } from "../components/ui";
import { FORMAS, type Tom } from "../constants";
import { situacaoDoPagamento, totaisPorForma, type SituacaoPagamento } from "../regras";
import { btnBase, btnPrimary, C, inputStyle } from "../styles/theme";
import { lerArquivo } from "../utils/arquivos";
import { fmtData, hojeISO } from "../utils/datas";
import { mensagemDeErro } from "../utils/erros";

type Filtro = "todos" | SituacaoPagamento;

const FILTROS: Filtro[] = ["todos", "pendente", "atrasado", "pago"];
const TOM_SITUACAO: Record<SituacaoPagamento, Tom> = { pago: "ok", pendente: "warn", atrasado: "danger" };
const LABEL_SITUACAO: Record<SituacaoPagamento, string> = { pago: "pago", pendente: "a vencer", atrasado: "atrasado" };

interface DadosRecebimento {
  forma: FormaPagamento;
  documento: string;
  comprovante: Comprovante | null;
}

interface NovoLancamento extends DadosRecebimento {
  osId: string; // vem do <select> como texto
  valor: string;
  vencimento: string;
  jaPago: boolean;
}

const RECEBIMENTO_VAZIO: DadosRecebimento = { forma: "dinheiro", documento: "", comprovante: null };
const LANCAMENTO_VAZIO: NovoLancamento = { osId: "", valor: "", vencimento: "", jaPago: false, ...RECEBIMENTO_VAZIO };

// Cartão e PIX exigem o número do documento OU o comprovante anexado
function faltaComprovante({ forma, documento, comprovante }: DadosRecebimento): boolean {
  return FORMAS[forma].exigeDoc && !documento && !comprovante;
}

interface FinanceiroProps {
  usuarios: Usuario[];
  meusPagamentos: Pagamento[];
  ordens: Ordem[];
  clientes: Cliente[];
  actions: {
    marcarPago: (id: Id, dados: { forma: FormaPagamento; documento: string | null; comprovante: Comprovante | null }) => Promise<void>;
    estornarPagamento: (id: Id) => Promise<void>;
    lancarPagamento: (dados: {
      osId: number;
      valor: number;
      vencimento: string;
      jaPago: boolean;
      forma: FormaPagamento | null;
      documento: string | null;
      comprovante: Comprovante | null;
    }) => Promise<void>;
  };
}

export function Financeiro({ usuarios, meusPagamentos, ordens, clientes, actions }: FinanceiroProps) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState<NovoLancamento>(LANCAMENTO_VAZIO);
  const [baixando, setBaixando] = useState<Pagamento | null>(null); // pagamento sendo marcado como pago
  const [baixa, setBaixa] = useState<DadosRecebimento>(RECEBIMENTO_VAZIO);
  const [erro, setErro] = useState("");
  const hoje = hojeISO();

  const nomeUsuario = (id: Id) => usuarios.find((u) => u.id === id)?.nome || "-";
  const clienteDaOS = (id: Id) => {
    const os = ordens.find((o) => o.id === id);
    return clientes.find((c) => c.id === os?.clienteId)?.nome || "-";
  };

  const linhas = useMemo(() => meusPagamentos.map((p) => ({ ...p, situacao: situacaoDoPagamento(p, hoje) })), [meusPagamentos, hoje]);
  const porForma = useMemo(() => totaisPorForma(linhas), [linhas]);

  const filtradas = linhas.filter((p) => filtro === "todos" || p.situacao === filtro);
  const totalPendente = linhas.filter((p) => p.situacao !== "pago").reduce((soma, p) => soma + p.valor, 0);

  async function confirmarBaixa() {
    if (!baixando) return;
    if (faltaComprovante(baixa)) {
      setErro(`informe o ${FORMAS[baixa.forma].rotuloDoc} ou anexe o comprovante.`);
      return;
    }
    try {
      await actions.marcarPago(baixando.id, { forma: baixa.forma, documento: baixa.documento || null, comprovante: baixa.comprovante });
      setBaixando(null);
      setBaixa(RECEBIMENTO_VAZIO);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function estornar(p: Pagamento) {
    try {
      await actions.estornarPagamento(p.id);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function addPagamento() {
    if (!form.osId || !form.valor || !form.vencimento) return setErro("preencha O.S., valor e vencimento.");
    if (form.jaPago && faltaComprovante(form)) {
      return setErro(`informe o ${FORMAS[form.forma].rotuloDoc} ou anexe o comprovante.`);
    }
    try {
      await actions.lancarPagamento({
        osId: Number(form.osId),
        valor: Number(form.valor),
        vencimento: form.vencimento,
        jaPago: form.jaPago,
        forma: form.jaPago ? form.forma : null,
        documento: form.jaPago ? form.documento || null : null,
        comprovante: form.jaPago ? form.comprovante : null,
      });
      setForm(LANCAMENTO_VAZIO);
      setShowNovo(false);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function anexar(arquivo: File | undefined, salvar: (comprovante: Comprovante | null) => void) {
    try {
      salvar(await lerArquivo(arquivo));
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const formas = Object.entries(FORMAS) as [FormaPagamento, (typeof FORMAS)[FormaPagamento]][];

  return (
    <div style={{ maxWidth: 940 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>financeiro</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>total em aberto: R$ {totalPendente.toLocaleString("pt-BR")}</div>
        </div>
        <button
          style={btnPrimary}
          onClick={() => {
            setShowNovo(!showNovo);
            setErro("");
          }}
        >
          + novo pagamento
        </button>
      </div>

      {/* resumo por forma de pagamento */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        {formas.map(([forma, cfg]) => (
          <div key={forma} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>recebido em {cfg.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, fontFamily: "Oswald, sans-serif", color: C.ink }}>
              R$ {porForma[forma].toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <select style={inputStyle} value={form.osId} onChange={(e) => setForm({ ...form, osId: e.target.value })}>
              <option value="">selecione a O.S.</option>
              {ordens.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.numero} · {clienteDaOS(o.id)}
                </option>
              ))}
            </select>
            <input style={inputStyle} placeholder="valor (R$)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            <input style={inputStyle} type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={form.jaPago}
              onChange={(e) => {
                setForm({ ...form, jaPago: e.target.checked });
                setErro("");
              }}
            />
            cliente já pagou (registra você como quem recebeu)
          </label>

          {form.jaPago && (
            <div style={{ background: C.bg, borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <SeletorForma
                valor={form.forma}
                onChange={(forma) => {
                  setForm({ ...form, forma, documento: "", comprovante: null });
                  setErro("");
                }}
              />
              {FORMAS[form.forma].exigeDoc && (
                <CamposComprovante
                  forma={form.forma}
                  documento={form.documento}
                  comprovante={form.comprovante}
                  onDocumento={(documento) => {
                    setForm({ ...form, documento });
                    setErro("");
                  }}
                  onArquivo={(arquivo) => anexar(arquivo, (comprovante) => setForm((f) => ({ ...f, comprovante })))}
                />
              )}
            </div>
          )}

          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={btnPrimary} onClick={addPagamento}>
            salvar pagamento
          </button>
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

          <SeletorForma
            valor={baixa.forma}
            onChange={(forma) => {
              setBaixa({ forma, documento: "", comprovante: null });
              setErro("");
            }}
          />

          {FORMAS[baixa.forma].exigeDoc && (
            <CamposComprovante
              forma={baixa.forma}
              documento={baixa.documento}
              comprovante={baixa.comprovante}
              onDocumento={(documento) => {
                setBaixa({ ...baixa, documento });
                setErro("");
              }}
              onArquivo={(arquivo) => anexar(arquivo, (comprovante) => setBaixa((b) => ({ ...b, comprovante })))}
            />
          )}

          {erro && <div style={{ fontSize: 12, color: C.danger, marginTop: 10 }}>{erro}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <button
              style={btnBase}
              onClick={() => {
                setBaixando(null);
                setErro("");
              }}
            >
              cancelar
            </button>
            <button style={btnPrimary} onClick={confirmarBaixa}>
              confirmar recebimento
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              ...btnBase,
              padding: "6px 12px",
              fontSize: 12,
              background: filtro === f ? C.steel : "#fff",
              color: filtro === f ? "#fff" : C.ink,
              borderColor: filtro === f ? C.steel : C.border,
            }}
          >
            {f === "todos" ? "todos" : LABEL_SITUACAO[f]}
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
              <tr>
                <td colSpan={8} style={{ padding: 20, textAlign: "center", color: C.muted }}>
                  nenhum lançamento nesse filtro.
                </td>
              </tr>
            )}
            {filtradas.map((p) => {
              const os = ordens.find((o) => o.id === p.osId);
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace" }}>#{os?.numero}</td>
                  <td>{clienteDaOS(p.osId)}</td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{fmtData(p.vencimento)}</td>
                  <td>
                    <Badge tone={TOM_SITUACAO[p.situacao]}>{LABEL_SITUACAO[p.situacao]}</Badge>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {p.forma ? (
                      <>
                        <Badge tone={p.forma === "dinheiro" ? "ok" : "accent"}>{FORMAS[p.forma].label}</Badge>
                        {p.documento && <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.inkSoft, marginTop: 3 }}>{p.documento}</div>}
                        {p.comprovante && (
                          <a
                            href={p.comprovante.dados}
                            download={p.comprovante.nome}
                            style={{ fontSize: 11, color: C.accentDark, textDecoration: "underline", cursor: "pointer" }}
                          >
                            ver comprovante
                          </a>
                        )}
                      </>
                    ) : (
                      <span style={{ color: C.muted }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: p.recebidoPor ? C.ink : C.muted }}>
                    {p.recebidoPor ? nomeUsuario(p.recebidoPor) : "—"}
                    {p.pagoEm && <div style={{ fontSize: 11, color: C.muted }}>em {fmtData(p.pagoEm)}</div>}
                  </td>
                  <td style={{ textAlign: "right" }}>R$ {p.valor.toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    {p.situacao === "pago" ? (
                      <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => estornar(p)}>
                        estornar
                      </button>
                    ) : (
                      <button
                        style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12 }}
                        onClick={() => {
                          setBaixando(p);
                          setBaixa(RECEBIMENTO_VAZIO);
                          setErro("");
                        }}
                      >
                        marcar pago
                      </button>
                    )}
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
