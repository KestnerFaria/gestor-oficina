import { useState } from "react";
import type { Cliente, Comprovante, FormaPagamento, Id, Ordem, Produto, Servico, StatusOS, Usuario, Veiculo } from "../../api";
import { Badge, CamposComprovante, Field, Plate, SeletorForma } from "../../components/ui";
import { FORMAS, STATUS_LABEL, STATUS_TONE } from "../../constants";
import { itensDaOrdem } from "../../regras";
import { btnBase, btnPrimary, C, FONTS, inputStyle } from "../../styles/theme";
import { lerArquivo } from "../../utils/arquivos";
import { fmtData } from "../../utils/datas";
import { mensagemDeErro } from "../../utils/erros";

// Status que podem ser escolhidos à mão (concluída/entregue vêm da finalização)
const STATUS_INTERMEDIARIOS: StatusOS[] = ["orcamento", "aberta", "em_andamento", "aguardando_peca", "cancelada"];

type Decisao = "pago" | "pendente";

export interface DadosFinalizacao {
  dataSaida: string;
  pago: boolean;
  forma: FormaPagamento | null;
  documento: string | null;
  comprovante: Comprovante | null;
  vencimento: string | null;
}

interface DetalheOSProps {
  usuario: Usuario;
  os: Ordem;
  cliente: Cliente | undefined;
  veiculo: Veiculo | undefined;
  servicos: Servico[];
  produtos: Produto[];
  equipe: Usuario[];
  ordens: Ordem[];
  actions: {
    mudarStatusOrdem: (id: Id, status: StatusOS) => Promise<void>;
    excluirOrdem: (id: Id) => Promise<void>;
    salvarSinalOrdem: (id: Id, sinal: number) => Promise<void>;
    salvarMecanicoOrdem: (id: Id, mecanicoId: Id | null) => Promise<void>;
    salvarObservacoesOrdem: (id: Id, observacoes: string) => Promise<void>;
    finalizarOrdem: (id: Id, dados: DadosFinalizacao) => Promise<void>;
  };
  onVoltar: () => void;
  onImprimir: (os: Ordem) => void;
}

// Gestão de uma O.S.: mecânico, observações, sinal, andamento e entrega
export function DetalheOS({ usuario, os, cliente, veiculo, servicos, produtos, equipe, ordens, actions, onVoltar, onImprimir }: DetalheOSProps) {
  // a O.S. da lista é a versão mais atual (muda quando salvamos algo)
  const osAtual = ordens.find((o) => o.id === os.id) || os;

  const [sinalEdit, setSinalEdit] = useState(String(osAtual.sinal || ""));
  const [mecanicoEdit, setMecanicoEdit] = useState(osAtual.mecanicoId ? String(osAtual.mecanicoId) : "");
  const [obsEdit, setObsEdit] = useState(osAtual.observacoesMecanico || "");
  const [obsSalva, setObsSalva] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [dataSaidaInput, setDataSaidaInput] = useState(osAtual.dataSaida || "");
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [documento, setDocumento] = useState("");
  const [comprovante, setComprovante] = useState<Comprovante | null>(null);
  const [vencimentoPendente, setVencimentoPendente] = useState("");
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);
  const [confirmarExclusaoOS, setConfirmarExclusaoOS] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const podeExcluir = usuario.perfil === "admin";

  // preço congelado no dia da O.S. (o que foi cobrado), não o do catálogo hoje
  const itens = itensDaOrdem(osAtual, servicos, produtos);
  const valorRestante = osAtual.valorTotal - (osAtual.sinal || 0);
  const finalizavel = !["entregue", "cancelada"].includes(osAtual.status);

  // roda uma ação da API e mostra a mensagem se der erro
  async function executar(acao: () => Promise<void>) {
    try {
      setErro("");
      await acao();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const mudarStatus = (novoStatus: StatusOS) => executar(() => actions.mudarStatusOrdem(os.id, novoStatus));
  const salvarSinal = () => executar(() => actions.salvarSinalOrdem(os.id, Number(sinalEdit) || 0));
  const salvarMecanico = () => executar(() => actions.salvarMecanicoOrdem(os.id, mecanicoEdit ? Number(mecanicoEdit) : null));

  const excluirOS = () =>
    executar(async () => {
      await actions.excluirOrdem(os.id);
      onVoltar();
    });

  const salvarObservacoes = () =>
    executar(async () => {
      await actions.salvarObservacoesOrdem(os.id, obsEdit);
      setObsSalva(true);
      setTimeout(() => setObsSalva(false), 2000);
    });

  async function anexarComprovante(arquivo: File | undefined) {
    try {
      setComprovante(await lerArquivo(arquivo));
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
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
        documento: decisao === "pago" ? documento || null : null,
        comprovante: decisao === "pago" ? comprovante : null,
        vencimento: decisao === "pendente" ? vencimentoPendente : null,
      });
      setErro("");
      setConcluido(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const botaoDecisao = (valor: Decisao, cor: string) => ({
    ...btnBase,
    flex: 1,
    padding: "10px 0",
    background: decisao === valor ? cor : "#fff",
    borderColor: decisao === valor ? cor : C.border,
    color: decisao === valor ? "#fff" : C.ink,
    fontWeight: 600,
  });

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: 600, padding: 24, borderRadius: 12 }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button style={btnBase} onClick={onVoltar}>
            ← voltar
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnBase} onClick={() => onImprimir(osAtual)}>
              imprimir O.S.
            </button>
            {podeExcluir &&
              (confirmarExclusaoOS ? (
                <>
                  <button style={{ ...btnBase, color: "#fff", background: C.danger, borderColor: C.danger }} onClick={excluirOS}>
                    confirmar exclusão
                  </button>
                  <button style={btnBase} onClick={() => setConfirmarExclusaoOS(false)}>
                    cancelar
                  </button>
                </>
              ) : (
                <button style={{ ...btnBase, color: C.danger }} onClick={() => setConfirmarExclusaoOS(true)}>
                  excluir O.S.
                </button>
              ))}
          </div>
        </div>

        {confirmarExclusaoOS && (
          <div style={{ background: C.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.danger }}>
            isso remove a O.S. #{osAtual.numero} permanentemente, junto com os pagamentos lançados nela. peças do estoque usadas nesta O.S. serão devolvidas
            automaticamente. essa ação não pode ser desfeita.
          </div>
        )}

        {/* erros de salvar mecânico, observações, sinal, status ou exclusão.
            (antes só apareciam dentro do painel de finalização, e essas
            ações falhavam em silêncio) */}
        {erro && !showFinalizar && (
          <div style={{ background: C.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.danger }}>{erro}</div>
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
            <Plate placa={veiculo?.placa ?? ""} />
            <span style={{ fontSize: 13, color: C.inkSoft }}>
              {veiculo?.marca} {veiculo?.modelo} · {veiculo?.ano}
              {veiculo?.cor ? ` · ${veiculo.cor}` : ""}
            </span>
          </div>

          <div style={{ fontSize: 13, color: C.ink, background: C.bg, padding: "10px 12px", borderRadius: 6, marginBottom: 16 }}>{osAtual.descricao}</div>

          {itens.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600, marginBottom: 6 }}>serviços e peças</div>
              {itens.map((item) => (
                <div key={item.chave} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span style={{ color: C.inkSoft }}>
                    {item.nome}
                    {item.quantidade > 1 ? ` (${item.quantidade}x)` : ""}
                  </span>
                  <span>R$ {item.valor.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}
          >
            <Field label="mecânico responsável">
              <select style={inputStyle} value={mecanicoEdit} onChange={(e) => setMecanicoEdit(e.target.value)}>
                <option value="">não definido</option>
                {equipe
                  .filter((u) => u.perfil !== "atendente")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
              </select>
            </Field>
            <button style={{ ...btnBase, marginBottom: 14 }} onClick={salvarMecanico}>
              salvar
            </button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Field label="observações do mecânico">
              <textarea
                style={{ ...inputStyle, resize: "vertical" }}
                rows={3}
                placeholder="Anotações técnicas sobre o serviço realizado, peças trocadas, recomendações futuras..."
                value={obsEdit}
                onChange={(e) => setObsEdit(e.target.value)}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button style={btnBase} onClick={salvarObservacoes}>
                salvar observações
              </button>
              {obsSalva && <span style={{ fontSize: 12, color: C.ok }}>salvo.</span>}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}
          >
            <Field label="sinal recebido (R$)">
              <input style={inputStyle} value={sinalEdit} onChange={(e) => setSinalEdit(e.target.value)} placeholder="0" />
            </Field>
            <button style={{ ...btnBase, marginBottom: 14 }} onClick={salvarSinal}>
              salvar sinal
            </button>
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

          {osAtual.dataSaida && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 10 }}>veículo entregue em {fmtData(osAtual.dataSaida)}</div>}
        </div>

        {/* mudar status (fluxo intermediário, sem finalizar) */}
        {finalizavel && !showFinalizar && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 10 }}>atualizar andamento</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STATUS_INTERMEDIARIOS.map((s) => (
                <button
                  key={s}
                  onClick={() => mudarStatus(s)}
                  style={{
                    ...btnBase,
                    padding: "6px 12px",
                    fontSize: 12,
                    background: osAtual.status === s ? C.steel : "#fff",
                    color: osAtual.status === s ? "#fff" : C.ink,
                    borderColor: osAtual.status === s ? C.steel : C.border,
                  }}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* finalizar e entregar */}
        {finalizavel &&
          !concluido &&
          (!showFinalizar ? (
            <button style={{ ...btnPrimary, width: "100%", padding: "12px 0" }} onClick={() => setShowFinalizar(true)}>
              finalizar O.S. e entregar veículo
            </button>
          ) : (
            <div style={{ background: C.surface, border: `2px solid ${C.accent}`, borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 14 }}>finalizar e entregar veículo</div>

              <Field label="data de saída do veículo">
                <input
                  style={inputStyle}
                  type="date"
                  value={dataSaidaInput}
                  onChange={(e) => {
                    setDataSaidaInput(e.target.value);
                    setErro("");
                  }}
                />
              </Field>

              {valorRestante > 0 ? (
                <>
                  <div style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
                    valor restante a cobrar: <strong>R$ {valorRestante.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <button
                      onClick={() => {
                        setDecisao("pago");
                        setErro("");
                      }}
                      style={botaoDecisao("pago", C.ok)}
                    >
                      já foi pago
                    </button>
                    <button
                      onClick={() => {
                        setDecisao("pendente");
                        setErro("");
                      }}
                      style={botaoDecisao("pendente", C.warn)}
                    >
                      fica pendente
                    </button>
                  </div>

                  {decisao === "pago" && (
                    <div style={{ background: C.bg, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                      <SeletorForma
                        valor={forma}
                        onChange={(f) => {
                          setForma(f);
                          setDocumento("");
                          setComprovante(null);
                          setErro("");
                        }}
                      />
                      {FORMAS[forma].exigeDoc && (
                        <CamposComprovante
                          forma={forma}
                          documento={documento}
                          comprovante={comprovante}
                          onDocumento={(v) => {
                            setDocumento(v);
                            setErro("");
                          }}
                          onArquivo={anexarComprovante}
                        />
                      )}
                    </div>
                  )}

                  {decisao === "pendente" && (
                    <Field label="vencimento do valor pendente">
                      <input
                        style={inputStyle}
                        type="date"
                        value={vencimentoPendente}
                        onChange={(e) => {
                          setVencimentoPendente(e.target.value);
                          setErro("");
                        }}
                      />
                    </Field>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.ok, marginBottom: 14 }}>o sinal recebido já cobre o valor total — nada a cobrar na saída.</div>
              )}

              {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  style={btnBase}
                  onClick={() => {
                    setShowFinalizar(false);
                    setErro("");
                  }}
                >
                  cancelar
                </button>
                <button style={btnPrimary} onClick={confirmarFinalizacao} disabled={salvando}>
                  {salvando ? "salvando..." : "confirmar entrega"}
                </button>
              </div>
            </div>
          ))}

        {concluido && (
          <div style={{ background: C.okBg, borderRadius: 10, padding: 18, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: C.ok, fontWeight: 600, marginBottom: 10 }}>
              O.S. #{osAtual.numero} finalizada e entregue em {fmtData(dataSaidaInput)}.
            </div>
            <button style={btnPrimary} onClick={() => onImprimir({ ...osAtual, status: "entregue", dataSaida: dataSaidaInput })}>
              imprimir O.S.
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
