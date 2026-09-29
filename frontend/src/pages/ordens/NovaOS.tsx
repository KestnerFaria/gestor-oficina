import { useState } from "react";
import type { Cliente, Id, Ordem, Produto, Servico, StatusOS, Usuario, Veiculo } from "../../api";
import { Field, ModalSelecao } from "../../components/ui";
import { btnBase, btnPrimary, C, inputStyle, labelStyle } from "../../styles/theme";
import { mensagemDeErro } from "../../utils/erros";

interface NovoVeiculo {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
}

const VEICULO_VAZIO: NovoVeiculo = { placa: "", marca: "", modelo: "", ano: "", cor: "" };

// Resultado da última tentativa de abrir O.S.: sucesso ou mensagem de erro
type Resultado = { os: Ordem } | { erro: string } | null;

export interface DadosNovaOrdem {
  clienteId: Id;
  veiculoId: Id;
  descricao: string;
  km: string;
  status: StatusOS;
  servicosIds: Id[];
  pecas: { produtoId: Id; quantidade: number }[];
  sinal: number;
  mecanicoId: Id | null;
}

interface NovaOSProps {
  clientes: Cliente[];
  veiculos: Veiculo[];
  servicos: Servico[];
  produtos: Produto[];
  equipe: Usuario[];
  actions: {
    criarVeiculo: (dados: Omit<NovoVeiculo, "ano"> & { clienteId: Id; ano: number | null }) => Promise<Veiculo>;
    criarOrdem: (dados: DadosNovaOrdem) => Promise<Ordem>;
  };
  onImprimir: (os: Ordem) => void;
}

const seletorCatalogo = { ...btnBase, width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" } as const;
const listaSelecionados = { border: `1px solid ${C.border}`, borderRadius: 6, marginTop: 8, overflow: "hidden" } as const;
const btnRemover = { ...btnBase, padding: "3px 8px", fontSize: 11, color: C.danger };

export function NovaOS({ clientes, veiculos, servicos, produtos, equipe, actions, onImprimir }: NovaOSProps) {
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [km, setKm] = useState("");
  const [servicosIds, setServicosIds] = useState<Id[]>([]);
  const [pecas, setPecas] = useState<Record<Id, number>>({}); // { produtoId: quantidade }
  const [mecanicoId, setMecanicoId] = useState("");
  const [sinal, setSinal] = useState("");
  const [novoVeiculo, setNovoVeiculo] = useState(false);
  const [nv, setNv] = useState<NovoVeiculo>(VEICULO_VAZIO);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [modalAberto, setModalAberto] = useState<"servicos" | "pecas" | null>(null);
  const [salvando, setSalvando] = useState(false);

  const veiculosDoCliente = veiculos.filter((v) => v.clienteId === Number(clienteId));
  const servicosSelecionados = servicos.filter((s) => servicosIds.includes(s.id));
  const pecasSelecionadas = Object.entries(pecas).flatMap(([id, quantidade]) => {
    const produto = produtos.find((p) => p.id === Number(id));
    return produto ? [{ produto, quantidade }] : [];
  });

  async function salvarVeiculo() {
    try {
      // ano em branco vai como null, igual à tela de clientes
      const novo = await actions.criarVeiculo({ clienteId: Number(clienteId), ...nv, ano: Number(nv.ano) || null });
      setVeiculoId(String(novo.id));
      setNovoVeiculo(false);
      setNv(VEICULO_VAZIO);
    } catch (e) {
      setResultado({ erro: mensagemDeErro(e) });
    }
  }

  function toggleServico(id: Id) {
    setServicosIds((anteriores) => (anteriores.includes(id) ? anteriores.filter((x) => x !== id) : [...anteriores, id]));
  }

  function togglePeca(produtoId: Id) {
    setPecas((anteriores) => {
      const proximas = { ...anteriores };
      if (proximas[produtoId]) delete proximas[produtoId];
      else proximas[produtoId] = 1;
      return proximas;
    });
  }

  // quantidade entre 1 e o que tem em estoque
  function mudarQuantidadePeca(produtoId: Id, quantidade: string) {
    const disponivel = produtos.find((p) => p.id === produtoId)?.quantidade ?? 1;
    const valor = Math.max(1, Math.min(Number(quantidade) || 1, disponivel));
    setPecas((anteriores) => ({ ...anteriores, [produtoId]: valor }));
  }

  // prévia dos valores (o servidor recalcula com os preços dele ao salvar)
  const valorCatalogo = servicosSelecionados.reduce((soma, s) => soma + s.preco, 0);
  const valorPecas = pecasSelecionadas.reduce((soma, { produto, quantidade }) => soma + produto.precoVenda * quantidade, 0);
  const valorSinal = Number(sinal) || 0;
  const valorTotal = valorCatalogo + valorPecas;
  const valorRestante = valorTotal - valorSinal;

  async function abrirOS(status: StatusOS) {
    if (!clienteId || !veiculoId || !descricao) {
      setResultado({ erro: "preencha cliente, veículo e a descrição do problema." });
      return;
    }

    setSalvando(true);
    try {
      const nova = await actions.criarOrdem({
        clienteId: Number(clienteId),
        veiculoId: Number(veiculoId),
        descricao,
        km,
        status,
        servicosIds,
        pecas: pecasSelecionadas.map(({ produto, quantidade }) => ({ produtoId: produto.id, quantidade })),
        sinal: valorSinal,
        mecanicoId: mecanicoId ? Number(mecanicoId) : null,
      });
      setResultado({ os: nova });
      setClienteId("");
      setVeiculoId("");
      setDescricao("");
      setKm("");
      setServicosIds([]);
      setPecas({});
      setSinal("");
      setMecanicoId("");
    } catch (e) {
      setResultado({ erro: mensagemDeErro(e) });
    } finally {
      setSalvando(false);
    }
  }

  const linhaResumo = { display: "flex", justifyContent: "space-between", padding: "3px 0" } as const;

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 18, color: C.ink }}>nova ordem de serviço</div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="cliente">
            <select
              style={inputStyle}
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setVeiculoId("");
              }}
            >
              <option value="">selecione</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field label="veículo">
            {!novoVeiculo ? (
              <select style={inputStyle} value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} disabled={!clienteId}>
                <option value="">{clienteId ? "selecione" : "selecione o cliente primeiro"}</option>
                {veiculosDoCliente.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.modelo} {v.ano} · {v.placa}
                  </option>
                ))}
              </select>
            ) : (
              <button style={{ ...btnBase, width: "100%" }} onClick={() => setNovoVeiculo(false)}>
                cancelar novo veículo
              </button>
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
            <button style={{ ...btnPrimary, gridColumn: "1 / -1" }} onClick={salvarVeiculo} disabled={!nv.placa || !nv.modelo}>
              salvar veículo
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="km atual">
            <input style={inputStyle} placeholder="Ex: 84200" value={km} onChange={(e) => setKm(e.target.value)} />
          </Field>
          <Field label="mecânico responsável (opcional)">
            <select style={inputStyle} value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)}>
              <option value="">não definido ainda</option>
              {equipe
                .filter((u) => u.perfil !== "atendente")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        <Field label="relato do cliente">
          <textarea
            style={{ ...inputStyle, resize: "vertical" }}
            rows={3}
            placeholder="O que o cliente descreveu sobre o problema"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Field>

        {/* serviços — seleção via caixa de diálogo */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>serviços a realizar</label>
          <button style={seletorCatalogo} onClick={() => setModalAberto("servicos")}>
            <span>{servicosIds.length > 0 ? `${servicosIds.length} serviço(s) selecionado(s)` : "selecionar serviços"}</span>
            <span style={{ color: C.accentDark, fontSize: 12 }}>abrir catálogo →</span>
          </button>

          {servicosSelecionados.length > 0 && (
            <div style={listaSelecionados}>
              {servicosSelecionados.map((s, i) => (
                <div
                  key={s.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}
                >
                  <span style={{ fontSize: 13, color: C.ink }}>{s.nome}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>R$ {s.preco.toLocaleString("pt-BR")}</span>
                    <button style={btnRemover} onClick={() => toggleServico(s.id)}>
                      remover
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {modalAberto === "servicos" && (
          <ModalSelecao titulo="selecionar serviços" onFechar={() => setModalAberto(null)}>
            {servicos.length === 0 ? (
              <div style={{ padding: "14px 20px", fontSize: 13, color: C.muted }}>nenhum serviço cadastrado ainda. cadastre em "serviços e estoque".</div>
            ) : (
              servicos.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 20px",
                    cursor: "pointer",
                    background: servicosIds.includes(s.id) ? C.accentBg : "#fff",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" checked={servicosIds.includes(s.id)} onChange={() => toggleServico(s.id)} />
                    <span style={{ fontSize: 14, color: C.ink }}>{s.nome}</span>
                  </span>
                  <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: C.ink }}>R$ {s.preco.toLocaleString("pt-BR")}</span>
                </label>
              ))
            )}
          </ModalSelecao>
        )}

        {/* peças do estoque — seleção via caixa de diálogo */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>peças do estoque utilizadas</label>
          <button style={seletorCatalogo} onClick={() => setModalAberto("pecas")}>
            <span>{pecasSelecionadas.length > 0 ? `${pecasSelecionadas.length} peça(s) selecionada(s)` : "selecionar peças do estoque"}</span>
            <span style={{ color: C.accentDark, fontSize: 12 }}>abrir estoque →</span>
          </button>

          {pecasSelecionadas.length > 0 && (
            <div style={listaSelecionados}>
              {pecasSelecionadas.map(({ produto, quantidade }, i) => (
                <div
                  key={produto.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}
                >
                  <span style={{ fontSize: 13, color: C.ink }}>
                    {produto.nome}
                    {quantidade > 1 ? ` (${quantidade}x)` : ""}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>R$ {(produto.precoVenda * quantidade).toLocaleString("pt-BR")}</span>
                    <button style={btnRemover} onClick={() => togglePeca(produto.id)}>
                      remover
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {modalAberto === "pecas" && (
          <ModalSelecao titulo="selecionar peças do estoque" onFechar={() => setModalAberto(null)}>
            {produtos.length === 0 ? (
              <div style={{ padding: "14px 20px", fontSize: 13, color: C.muted }}>nenhuma peça cadastrada ainda. cadastre em "serviços e estoque".</div>
            ) : (
              produtos.map((p) => {
                const marcada = pecas[p.id] !== undefined;
                const bloqueada = p.quantidade <= 0 && !marcada; // sem estoque
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 20px",
                      background: marcada ? C.accentBg : "#fff",
                      opacity: bloqueada ? 0.5 : 1,
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: bloqueada ? "not-allowed" : "pointer", flex: 1 }}>
                      <input type="checkbox" checked={marcada} disabled={bloqueada} onChange={() => togglePeca(p.id)} />
                      <span style={{ fontSize: 14, color: C.ink }}>{p.nome}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>({p.quantidade} em estoque)</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {marcada && (
                        <input
                          type="number"
                          min={1}
                          max={p.quantidade}
                          value={pecas[p.id]}
                          onChange={(e) => mudarQuantidadePeca(p.id, e.target.value)}
                          style={{ ...inputStyle, width: 56, padding: "4px 6px", textAlign: "center" }}
                        />
                      )}
                      <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: C.ink, minWidth: 70, textAlign: "right" }}>
                        R$ {p.precoVenda.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </ModalSelecao>
        )}

        <Field label="sinal recebido (opcional)">
          <input style={inputStyle} placeholder="Ex: 100" value={sinal} onChange={(e) => setSinal(e.target.value)} />
        </Field>

        {/* resumo de valores */}
        <div style={{ background: C.bg, borderRadius: 6, padding: "12px 14px", marginBottom: 14, fontSize: 13 }}>
          {valorCatalogo > 0 && (
            <div style={linhaResumo}>
              <span style={{ color: C.inkSoft }}>serviços do catálogo</span>
              <span>R$ {valorCatalogo.toLocaleString("pt-BR")}</span>
            </div>
          )}
          {valorPecas > 0 && (
            <div style={linhaResumo}>
              <span style={{ color: C.inkSoft }}>peças utilizadas</span>
              <span>R$ {valorPecas.toLocaleString("pt-BR")}</span>
            </div>
          )}
          <div style={{ ...linhaResumo, fontWeight: valorSinal > 0 ? 400 : 600 }}>
            <span style={{ color: valorSinal > 0 ? C.inkSoft : C.ink }}>valor total</span>
            <span>R$ {valorTotal.toLocaleString("pt-BR")}</span>
          </div>
          {valorSinal > 0 && (
            <>
              <div style={linhaResumo}>
                <span style={{ color: C.inkSoft }}>sinal recebido</span>
                <span style={{ color: C.ok }}>− R$ {valorSinal.toLocaleString("pt-BR")}</span>
              </div>
              <div style={{ ...linhaResumo, padding: "5px 0 0", borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>restante a cobrar</span>
                <span style={{ fontWeight: 600 }}>R$ {valorRestante.toLocaleString("pt-BR")}</span>
              </div>
            </>
          )}
        </div>

        {resultado && "erro" in resultado && <div style={{ fontSize: 13, color: C.danger, marginBottom: 12 }}>{resultado.erro}</div>}

        {resultado && "os" in resultado && (
          <div
            style={{ background: C.okBg, borderRadius: 6, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ fontSize: 13, color: C.ok }}>O.S. #{resultado.os.numero} criada com sucesso.</span>
            <button style={{ ...btnBase, padding: "5px 12px", fontSize: 12 }} onClick={() => onImprimir(resultado.os)}>
              imprimir O.S.
            </button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <button style={btnBase} onClick={() => abrirOS("orcamento")} disabled={salvando}>
            salvar como orçamento
          </button>
          <button style={btnPrimary} onClick={() => abrirOS("aberta")} disabled={salvando}>
            {salvando ? "salvando..." : "abrir O.S."}
          </button>
        </div>
      </div>
    </div>
  );
}
