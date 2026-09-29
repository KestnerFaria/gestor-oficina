import { useState } from "react";
import type { Cliente, Id, Veiculo } from "../api";
import { Badge, Plate } from "../components/ui";
import { btnBase, btnPrimary, C, inputStyle } from "../styles/theme";
import { mensagemDeErro } from "../utils/erros";

// ------------------------------------------------------------
// Tipos dos formulários
// ------------------------------------------------------------
interface NovoCliente {
  nome: string;
  telefone: string;
  cpf: string;
  endereco: string;
  email: string;
  senha: string;
}

// na edição, "senha" vazia significa "manter a senha atual"
type ClienteEmEdicao = Cliente & { senha?: string };

interface NovoVeiculo {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
}

type VeiculoEmEdicao = Omit<Veiculo, "ano"> & { ano: number | string | null };

const CLIENTE_VAZIO: NovoCliente = { nome: "", telefone: "", cpf: "", endereco: "", email: "", senha: "" };
const VEICULO_VAZIO: NovoVeiculo = { placa: "", marca: "", modelo: "", ano: "", cor: "" };

export interface AcoesClientes {
  criarCliente: (dados: NovoCliente) => Promise<void>;
  editarCliente: (id: Id, dados: ClienteEmEdicao) => Promise<void>;
  excluirCliente: (id: Id) => Promise<void>;
  // a tela não usa o retorno (a Nova O.S. usa o veículo criado)
  criarVeiculo: (dados: Omit<NovoVeiculo, "ano"> & { clienteId: Id; ano: number | null }) => Promise<unknown>;
  editarVeiculo: (id: Id, dados: VeiculoEmEdicao) => Promise<void>;
  excluirVeiculo: (id: Id) => Promise<void>;
}

const btnPequeno = { ...btnBase, padding: "5px 10px", fontSize: 12 };
const btnPerigo = { ...btnPequeno, color: "#fff", background: C.danger, borderColor: C.danger };
const tituloSecao = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 } as const;

// ------------------------------------------------------------
// Veículos de um cliente
// ------------------------------------------------------------
// IMPORTANTE: este componente fica FORA do ClientesVeiculos. Antes ele era
// declarado dentro do componente pai; a cada letra digitada o React criava
// um componente "novo", desmontava o antigo e o campo perdia o foco — dava
// para digitar só uma letra por vez na placa.
interface BlocoVeiculosProps {
  cliente: Cliente;
  veiculos: Veiculo[];
  actions: Pick<AcoesClientes, "criarVeiculo" | "editarVeiculo" | "excluirVeiculo">;
}

function BlocoVeiculos({ cliente, veiculos, actions }: BlocoVeiculosProps) {
  const [adicionando, setAdicionando] = useState(false);
  const [nv, setNv] = useState<NovoVeiculo>(VEICULO_VAZIO);
  const [editVeiculo, setEditVeiculo] = useState<VeiculoEmEdicao | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Id | null>(null);
  const [erro, setErro] = useState("");

  const doCliente = veiculos.filter((v) => v.clienteId === cliente.id);

  async function executar(acao: () => Promise<void>) {
    try {
      await acao();
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const addVeiculo = () =>
    executar(async () => {
      if (!nv.placa || !nv.modelo) return;
      await actions.criarVeiculo({ clienteId: cliente.id, ...nv, ano: Number(nv.ano) || null });
      setNv(VEICULO_VAZIO);
      setAdicionando(false);
    });

  const salvarEdicao = () =>
    executar(async () => {
      if (!editVeiculo) return;
      await actions.editarVeiculo(editVeiculo.id, editVeiculo);
      setEditVeiculo(null);
    });

  const remover = (v: Veiculo) =>
    executar(async () => {
      await actions.excluirVeiculo(v.id);
      setConfirmarExclusao(null);
    });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={tituloSecao}>veículos deste cliente</div>
        {!adicionando && (
          <button
            style={{ ...btnBase, padding: "4px 10px", fontSize: 12 }}
            onClick={() => {
              setAdicionando(true);
              setNv(VEICULO_VAZIO);
            }}
          >
            + adicionar veículo
          </button>
        )}
      </div>

      {adicionando && (
        <div
          style={{
            background: "#fff",
            border: `1px solid ${C.accent}`,
            borderRadius: 6,
            padding: 12,
            marginBottom: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <input style={inputStyle} placeholder="placa" value={nv.placa} onChange={(e) => setNv({ ...nv, placa: e.target.value.toUpperCase() })} />
          <input style={inputStyle} placeholder="marca" value={nv.marca} onChange={(e) => setNv({ ...nv, marca: e.target.value })} />
          <input style={inputStyle} placeholder="modelo" value={nv.modelo} onChange={(e) => setNv({ ...nv, modelo: e.target.value })} />
          <input style={inputStyle} placeholder="ano" value={nv.ano} onChange={(e) => setNv({ ...nv, ano: e.target.value })} />
          <input style={inputStyle} placeholder="cor" value={nv.cor} onChange={(e) => setNv({ ...nv, cor: e.target.value })} />
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={{ ...btnBase, padding: "6px 12px", fontSize: 12 }} onClick={() => setAdicionando(false)}>
              cancelar
            </button>
            <button style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }} onClick={addVeiculo} disabled={!nv.placa || !nv.modelo}>
              salvar veículo
            </button>
          </div>
        </div>
      )}

      {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 8 }}>{erro}</div>}

      {doCliente.length === 0 && !adicionando && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>nenhum veículo cadastrado.</div>}

      {doCliente.map((v) =>
        editVeiculo && editVeiculo.id === v.id ? (
          <div
            key={v.id}
            style={{
              background: "#fff",
              border: `1px solid ${C.accent}`,
              borderRadius: 6,
              padding: 10,
              marginBottom: 8,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 0.6fr 0.8fr",
              gap: 8,
            }}
          >
            <input style={inputStyle} value={editVeiculo.placa} onChange={(e) => setEditVeiculo({ ...editVeiculo, placa: e.target.value.toUpperCase() })} placeholder="placa" />
            <input style={inputStyle} value={editVeiculo.marca || ""} onChange={(e) => setEditVeiculo({ ...editVeiculo, marca: e.target.value })} placeholder="marca" />
            <input style={inputStyle} value={editVeiculo.modelo} onChange={(e) => setEditVeiculo({ ...editVeiculo, modelo: e.target.value })} placeholder="modelo" />
            <input style={inputStyle} value={editVeiculo.ano ?? ""} onChange={(e) => setEditVeiculo({ ...editVeiculo, ano: e.target.value })} placeholder="ano" />
            <input style={inputStyle} value={editVeiculo.cor || ""} onChange={(e) => setEditVeiculo({ ...editVeiculo, cor: e.target.value })} placeholder="cor" />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={{ ...btnBase, padding: "6px 12px", fontSize: 12 }} onClick={() => setEditVeiculo(null)}>
                cancelar
              </button>
              <button style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }} onClick={salvarEdicao}>
                salvar
              </button>
            </div>
          </div>
        ) : (
          <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Plate placa={v.placa} />
              <span style={{ fontSize: 13, color: C.ink }}>
                {v.marca} {v.modelo} · {v.ano}
                {v.cor ? ` · ${v.cor}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnPequeno} onClick={() => setEditVeiculo(v)}>
                editar
              </button>
              {confirmarExclusao === v.id ? (
                <>
                  <button style={btnPerigo} onClick={() => remover(v)}>
                    confirmar
                  </button>
                  <button style={btnPequeno} onClick={() => setConfirmarExclusao(null)}>
                    cancelar
                  </button>
                </>
              ) : (
                <button style={{ ...btnPequeno, color: C.danger }} onClick={() => setConfirmarExclusao(v.id)}>
                  excluir
                </button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Tela de clientes
// ------------------------------------------------------------
interface ClientesVeiculosProps {
  meusClientes: Cliente[];
  veiculos: Veiculo[];
  actions: AcoesClientes;
}

export function ClientesVeiculos({ meusClientes, veiculos, actions }: ClientesVeiculosProps) {
  const [expandido, setExpandido] = useState<Id | null>(null);
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState<NovoCliente>(CLIENTE_VAZIO);
  const [editCliente, setEditCliente] = useState<ClienteEmEdicao | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Id | null>(null);
  const [erro, setErro] = useState("");

  async function addCliente() {
    if (!form.nome || !form.telefone) return;
    try {
      await actions.criarCliente(form);
      setForm(CLIENTE_VAZIO);
      setShowNovo(false);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function salvarEdicaoCliente() {
    if (!editCliente) return;
    try {
      await actions.editarCliente(editCliente.id, editCliente);
      setEditCliente(null);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function excluirCliente(c: Cliente) {
    try {
      await actions.excluirCliente(c.id);
      setConfirmarExclusao(null);
      if (expandido === c.id) setExpandido(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>clientes e veículos</div>
        <button style={btnPrimary} onClick={() => setShowNovo(!showNovo)}>
          + novo cliente
        </button>
      </div>

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input style={inputStyle} placeholder="telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            <input style={inputStyle} placeholder="CPF (opcional)" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              style={inputStyle}
              placeholder="endereço · rua, número, bairro, cidade/UF"
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            />
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
              acesso ao portal do cliente (opcional)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input style={inputStyle} placeholder="email de acesso" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input style={inputStyle} placeholder="senha de acesso" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
          </div>
          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={{ ...btnPrimary, width: "100%" }} onClick={addCliente}>
            salvar cliente
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meusClientes.length === 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>
            nenhum cliente cadastrado nesta oficina. comece cadastrando o primeiro.
          </div>
        )}

        {meusClientes.map((c) => {
          const quantidadeVeiculos = veiculos.filter((v) => v.clienteId === c.id).length;
          const aberto = expandido === c.id;
          const editando = editCliente?.id === c.id;

          return (
            <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              {editando && editCliente ? (
                <div style={{ padding: 16 }}>
                  <div style={{ ...tituloSecao, marginBottom: 10 }}>dados do cliente</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <input style={inputStyle} value={editCliente.nome} onChange={(e) => setEditCliente({ ...editCliente, nome: e.target.value })} placeholder="nome" />
                    <input
                      style={inputStyle}
                      value={editCliente.telefone}
                      onChange={(e) => setEditCliente({ ...editCliente, telefone: e.target.value })}
                      placeholder="telefone"
                    />
                    <input style={inputStyle} value={editCliente.cpf || ""} onChange={(e) => setEditCliente({ ...editCliente, cpf: e.target.value })} placeholder="CPF" />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <input
                      style={inputStyle}
                      value={editCliente.endereco || ""}
                      onChange={(e) => setEditCliente({ ...editCliente, endereco: e.target.value })}
                      placeholder="endereço · rua, número, bairro, cidade/UF"
                    />
                  </div>

                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 12 }}>
                    <div style={{ ...tituloSecao, marginBottom: 8 }}>acesso ao portal</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <input
                        style={inputStyle}
                        value={editCliente.email || ""}
                        onChange={(e) => setEditCliente({ ...editCliente, email: e.target.value })}
                        placeholder="email de acesso"
                      />
                      <input
                        style={inputStyle}
                        value={editCliente.senha || ""}
                        onChange={(e) => setEditCliente({ ...editCliente, senha: e.target.value })}
                        placeholder="nova senha (deixe em branco p/ manter)"
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, margin: "0 -16px 14px", padding: "14px 16px" }}>
                    <BlocoVeiculos cliente={c} veiculos={veiculos} actions={actions} />
                  </div>

                  {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>{erro}</div>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      style={btnBase}
                      onClick={() => {
                        setEditCliente(null);
                        setErro("");
                      }}
                    >
                      fechar
                    </button>
                    <button style={btnPrimary} onClick={salvarEdicaoCliente}>
                      salvar alterações
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                  <div onClick={() => setExpandido(aberto ? null : c.id)} style={{ cursor: "pointer", flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>
                      {c.telefone}
                      {c.cpf ? ` · ${c.cpf}` : ""}
                      {c.email ? ` · acesso: ${c.email}` : " · sem acesso"}
                    </div>
                    {c.endereco && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{c.endereco}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tone="muted">
                      {quantidadeVeiculos} veículo{quantidadeVeiculos !== 1 ? "s" : ""}
                    </Badge>
                    <button
                      style={btnPequeno}
                      onClick={() => {
                        setEditCliente(c);
                        setExpandido(null);
                      }}
                    >
                      editar
                    </button>
                    {confirmarExclusao === c.id ? (
                      <>
                        <button style={btnPerigo} onClick={() => excluirCliente(c)}>
                          confirmar
                        </button>
                        <button style={btnPequeno} onClick={() => setConfirmarExclusao(null)}>
                          cancelar
                        </button>
                      </>
                    ) : (
                      <button style={{ ...btnPequeno, color: C.danger }} onClick={() => setConfirmarExclusao(c.id)}>
                        excluir
                      </button>
                    )}
                  </div>
                </div>
              )}

              {aberto && !editando && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px", background: C.bg }}>
                  <BlocoVeiculos cliente={c} veiculos={veiculos} actions={actions} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
