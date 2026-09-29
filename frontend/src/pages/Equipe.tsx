import { useState } from "react";
import type { Id, PerfilUsuario, Usuario } from "../api";
import { Badge } from "../components/ui";
import { btnBase, btnPrimary, C, inputStyle } from "../styles/theme";
import { mensagemDeErro } from "../utils/erros";

const LIMITE_ACESSOS = 3;

const PERFIS: Record<PerfilUsuario, string> = { admin: "admin", atendente: "atendente", mecanico: "mecânico" };

interface NovoAcesso {
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
}

const FORM_VAZIO: NovoAcesso = { nome: "", email: "", senha: "", perfil: "atendente" };

interface EquipeProps {
  usuario: Usuario;
  minhaEquipe: Usuario[];
  actions: {
    criarUsuario: (dados: NovoAcesso) => Promise<void>;
    removerUsuario: (id: Id) => Promise<void>;
  };
}

// Acessos da equipe (no máximo 3 por oficina)
export function Equipe({ usuario, minhaEquipe, actions }: EquipeProps) {
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState<NovoAcesso>(FORM_VAZIO);
  const [erro, setErro] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState<Id | null>(null);

  const noLimite = minhaEquipe.length >= LIMITE_ACESSOS;
  const admins = minhaEquipe.filter((u) => u.perfil === "admin");

  async function addUsuario() {
    if (!form.nome || !form.email || !form.senha) return setErro("preencha nome, email e senha.");
    if (noLimite) return setErro(`limite de ${LIMITE_ACESSOS} acessos por oficina atingido.`);
    try {
      await actions.criarUsuario(form);
      setForm(FORM_VAZIO);
      setShowNovo(false);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function removerUsuario(u: Usuario) {
    if (u.perfil === "admin" && admins.length <= 1) {
      setErro("não é possível remover o último administrador da oficina.");
      setConfirmarExclusao(null);
      return;
    }
    try {
      await actions.removerUsuario(u.id);
      setConfirmarExclusao(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const perfis = Object.entries(PERFIS) as [PerfilUsuario, string][];

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>acessos da equipe</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>
            {minhaEquipe.length} de {LIMITE_ACESSOS} acessos usados nesta oficina
          </div>
        </div>
        {!noLimite && (
          <button
            style={btnPrimary}
            onClick={() => {
              setShowNovo(!showNovo);
              setErro("");
            }}
          >
            + novo acesso
          </button>
        )}
      </div>

      {noLimite && !showNovo && (
        <div style={{ background: C.warnBg, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: C.warn }}>
          limite de {LIMITE_ACESSOS} acessos atingido. remova um acesso existente para poder cadastrar outro.
        </div>
      )}

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <select style={inputStyle} value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as PerfilUsuario })}>
              {perfis.map(([perfil, label]) => (
                <option key={perfil} value={perfil}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="email de acesso" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input style={inputStyle} type="password" placeholder="senha" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={{ ...btnPrimary, width: "100%" }} onClick={addUsuario}>
            salvar acesso
          </button>
        </div>
      )}

      {erro && !showNovo && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {minhaEquipe.map((u) => (
          <div
            key={u.id}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
                {u.nome}
                {u.id === usuario.id ? " (você)" : ""}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{u.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={u.perfil === "admin" ? "accent" : "muted"}>{PERFIS[u.perfil]}</Badge>
              {confirmarExclusao === u.id ? (
                <>
                  <button
                    style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: "#fff", background: C.danger, borderColor: C.danger }}
                    onClick={() => removerUsuario(u)}
                  >
                    confirmar
                  </button>
                  <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirmarExclusao(null)}>
                    cancelar
                  </button>
                </>
              ) : (
                <button
                  style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: C.danger }}
                  onClick={() => {
                    setConfirmarExclusao(u.id);
                    setErro("");
                  }}
                >
                  remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
