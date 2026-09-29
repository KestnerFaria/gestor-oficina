import { useState } from "react";
import type { Id, Produto, Servico } from "../api";
import { Badge, Field } from "../components/ui";
import { estoqueBaixo } from "../regras";
import { btnBase, btnPrimary, C, inputStyle } from "../styles/theme";
import { mensagemDeErro } from "../utils/erros";

// Enquanto o usuário edita, os números ficam como texto no input
type NumeroEmEdicao = number | string;

interface ServicoEmEdicao {
  id: Id;
  nome: string;
  preco: NumeroEmEdicao;
}

interface ProdutoEmEdicao {
  id: Id;
  nome: string;
  quantidade: NumeroEmEdicao;
  precoVenda: NumeroEmEdicao;
  estoqueMinimo: NumeroEmEdicao;
}

interface DadosProduto {
  nome: string;
  quantidade: number;
  precoVenda: number;
  estoqueMinimo: number;
}

const SERVICO_VAZIO = { nome: "", preco: "" };
const PRODUTO_VAZIO = { nome: "", quantidade: "", precoVenda: "", estoqueMinimo: "" };

// Texto do input → número (vazio ou inválido vira 0)
const numero = (valor: NumeroEmEdicao) => Number(valor) || 0;

interface ServicosEstoqueProps {
  meusServicos: Servico[];
  meusProdutos: Produto[];
  actions: {
    criarServico: (dados: { nome: string; preco: number }) => Promise<void>;
    editarServico: (id: Id, dados: { nome: string; preco: number }) => Promise<void>;
    excluirServico: (id: Id) => Promise<void>;
    criarProduto: (dados: DadosProduto) => Promise<void>;
    editarProduto: (id: Id, dados: DadosProduto) => Promise<void>;
    excluirProduto: (id: Id) => Promise<void>;
  };
}

// Catálogo de serviços (aparece na abertura de O.S.) e estoque de peças
export function ServicosEstoque({ meusServicos, meusProdutos, actions }: ServicosEstoqueProps) {
  const [showServico, setShowServico] = useState(false);
  const [fServico, setFServico] = useState(SERVICO_VAZIO);
  const [editServico, setEditServico] = useState<ServicoEmEdicao | null>(null);
  const [erroServico, setErroServico] = useState("");

  const [showProduto, setShowProduto] = useState(false);
  const [fProduto, setFProduto] = useState(PRODUTO_VAZIO);
  const [editProduto, setEditProduto] = useState<ProdutoEmEdicao | null>(null);
  const [erroProduto, setErroProduto] = useState("");

  async function addServico() {
    if (!fServico.nome || !fServico.preco) return;
    try {
      await actions.criarServico({ nome: fServico.nome, preco: Number(fServico.preco) });
      setFServico(SERVICO_VAZIO);
      setShowServico(false);
      setErroServico("");
    } catch (e) {
      setErroServico(mensagemDeErro(e));
    }
  }

  async function salvarServico() {
    if (!editServico) return;
    try {
      await actions.editarServico(editServico.id, { nome: editServico.nome, preco: Number(editServico.preco) });
      setEditServico(null);
    } catch (e) {
      setErroServico(mensagemDeErro(e));
    }
  }

  async function removerServico(s: Servico) {
    try {
      await actions.excluirServico(s.id);
    } catch (e) {
      setErroServico(mensagemDeErro(e));
    }
  }

  async function addProduto() {
    if (!fProduto.nome) return;
    try {
      await actions.criarProduto({
        nome: fProduto.nome,
        quantidade: numero(fProduto.quantidade),
        precoVenda: numero(fProduto.precoVenda),
        estoqueMinimo: numero(fProduto.estoqueMinimo),
      });
      setFProduto(PRODUTO_VAZIO);
      setShowProduto(false);
      setErroProduto("");
    } catch (e) {
      setErroProduto(mensagemDeErro(e));
    }
  }

  async function salvarProduto() {
    if (!editProduto) return;
    try {
      await actions.editarProduto(editProduto.id, {
        nome: editProduto.nome,
        quantidade: numero(editProduto.quantidade),
        precoVenda: numero(editProduto.precoVenda),
        estoqueMinimo: numero(editProduto.estoqueMinimo),
      });
      setEditProduto(null);
    } catch (e) {
      setErroProduto(mensagemDeErro(e));
    }
  }

  async function removerProduto(p: Produto) {
    try {
      await actions.excluirProduto(p.id);
    } catch (e) {
      setErroProduto(mensagemDeErro(e));
    }
  }

  const caixa = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 } as const;
  const btnPequeno = { ...btnBase, padding: "4px 10px", fontSize: 12 };

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>serviços e estoque</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>os serviços cadastrados aqui aparecem para seleção na abertura de O.S.</div>
      </div>

      {/* SERVIÇOS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>catálogo de serviços</div>
        <button style={btnPrimary} onClick={() => setShowServico(!showServico)}>
          + novo serviço
        </button>
      </div>

      {showServico && (
        <div style={{ ...caixa, padding: 14, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 200px auto", gap: 10, alignItems: "end" }}>
          <div>
            <Field label="nome do serviço">
              <input
                style={inputStyle}
                value={fServico.nome}
                onChange={(e) => setFServico({ ...fServico, nome: e.target.value })}
                placeholder="Ex: Troca de óleo"
              />
            </Field>
          </div>
          <div>
            <Field label="valor (R$)">
              <input style={inputStyle} value={fServico.preco} onChange={(e) => setFServico({ ...fServico, preco: e.target.value })} placeholder="Ex: 120" />
            </Field>
          </div>
          <button style={{ ...btnPrimary, marginBottom: 14 }} onClick={addServico}>
            salvar
          </button>
          {erroServico && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.danger }}>{erroServico}</div>}
        </div>
      )}

      <div style={{ ...caixa, overflow: "hidden", marginBottom: 26 }}>
        {meusServicos.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.muted }}>nenhum serviço cadastrado ainda.</div>}
        {meusServicos.map((s, i) => {
          const borda = i === 0 ? "none" : `1px solid ${C.border}`;
          if (editServico && editServico.id === s.id) {
            return (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 160px auto", gap: 10, alignItems: "center", padding: "10px 16px", borderTop: borda }}>
                <input style={inputStyle} value={editServico.nome} onChange={(e) => setEditServico({ ...editServico, nome: e.target.value })} />
                <input style={inputStyle} value={editServico.preco} onChange={(e) => setEditServico({ ...editServico, preco: e.target.value })} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...btnBase, padding: "6px 10px", fontSize: 12 }} onClick={() => setEditServico(null)}>
                    cancelar
                  </button>
                  <button style={{ ...btnPrimary, padding: "6px 10px", fontSize: 12 }} onClick={salvarServico}>
                    salvar
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: borda }}>
              <span style={{ fontSize: 13, color: C.ink }}>{s.nome}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: C.ink }}>R$ {s.preco.toLocaleString("pt-BR")}</span>
                <button style={btnPequeno} onClick={() => setEditServico(s)}>
                  editar
                </button>
                <button style={{ ...btnPequeno, color: C.danger }} onClick={() => removerServico(s)}>
                  excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ESTOQUE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>estoque de peças</div>
        <button style={btnPrimary} onClick={() => setShowProduto(!showProduto)}>
          + novo item
        </button>
      </div>

      {showProduto && (
        <div style={{ ...caixa, padding: 14, marginBottom: 12, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 10 }}>
          <input style={inputStyle} placeholder="nome da peça" value={fProduto.nome} onChange={(e) => setFProduto({ ...fProduto, nome: e.target.value })} />
          <input style={inputStyle} placeholder="quantidade" value={fProduto.quantidade} onChange={(e) => setFProduto({ ...fProduto, quantidade: e.target.value })} />
          <input
            style={inputStyle}
            placeholder="preço de venda (R$)"
            value={fProduto.precoVenda}
            onChange={(e) => setFProduto({ ...fProduto, precoVenda: e.target.value })}
          />
          <input
            style={inputStyle}
            placeholder="estoque mínimo"
            value={fProduto.estoqueMinimo}
            onChange={(e) => setFProduto({ ...fProduto, estoqueMinimo: e.target.value })}
          />
          <button style={{ ...btnPrimary, gridColumn: "1 / -1" }} onClick={addProduto}>
            salvar item
          </button>
          {erroProduto && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.danger }}>{erroProduto}</div>}
        </div>
      )}

      <div style={{ ...caixa, overflow: "hidden" }}>
        {meusProdutos.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.muted }}>nenhum item cadastrado no estoque.</div>}
        {meusProdutos.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted, textAlign: "left", background: C.bg }}>
                <th style={{ fontWeight: 500, padding: "9px 16px" }}>item</th>
                <th style={{ fontWeight: 500 }}>quantidade</th>
                <th style={{ fontWeight: 500 }}>preço de venda</th>
                <th style={{ fontWeight: 500, padding: "9px 16px", textAlign: "right" }}>ação</th>
              </tr>
            </thead>
            <tbody>
              {meusProdutos.map((p) =>
                editProduto && editProduto.id === p.id ? (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 16px" }}>
                      <input style={inputStyle} value={editProduto.nome} onChange={(e) => setEditProduto({ ...editProduto, nome: e.target.value })} />
                    </td>
                    <td>
                      <input style={inputStyle} value={editProduto.quantidade} onChange={(e) => setEditProduto({ ...editProduto, quantidade: e.target.value })} />
                    </td>
                    <td>
                      <input style={inputStyle} value={editProduto.precoVenda} onChange={(e) => setEditProduto({ ...editProduto, precoVenda: e.target.value })} />
                    </td>
                    <td style={{ padding: "8px 16px", textAlign: "right" }}>
                      <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, marginRight: 6 }} onClick={() => setEditProduto(null)}>
                        cancelar
                      </button>
                      <button style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12 }} onClick={salvarProduto}>
                        salvar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 16px" }}>{p.nome}</td>
                    <td>
                      {p.quantidade}
                      {estoqueBaixo(p) && <Badge tone="danger"> baixo</Badge>}
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace" }}>R$ {p.precoVenda.toLocaleString("pt-BR")}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <button style={{ ...btnPequeno, marginRight: 6 }} onClick={() => setEditProduto(p)}>
                        editar
                      </button>
                      <button style={{ ...btnPequeno, color: C.danger }} onClick={() => removerProduto(p)}>
                        excluir
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
