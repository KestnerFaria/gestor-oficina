import { useState } from "react";
import { api } from "../api";
import { Field } from "../components/ui";
import type { Sessao } from "../sessao";
import { btnBase, btnPrimary, C, FONTS, inputStyle } from "../styles/theme";
import { mensagemDeErro } from "../utils/erros";

type Modo = "equipe" | "cliente";

const MODOS: [Modo, string][] = [
  ["equipe", "sou da oficina"],
  ["cliente", "sou cliente"],
];

interface TelaLoginProps {
  onEntrar: (sessao: Sessao) => void;
  onCadastrar: () => void;
}

export function TelaLogin({ onEntrar, onCadastrar }: TelaLoginProps) {
  const [modo, setModo] = useState<Modo>("equipe");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro("");
    setCarregando(true);
    try {
      if (modo === "equipe") {
        const { token, usuario } = await api.loginEquipe({ email, senha });
        onEntrar({ tipo: "equipe", token, usuario });
      } else {
        const { token, cliente } = await api.loginCliente({ email, senha });
        onEntrar({ tipo: "cliente", token, cliente });
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  function trocarModo(novo: Modo) {
    setModo(novo);
    setErro("");
    setEmail("");
    setSenha("");
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.steel, minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 24 }}>
      <style>{FONTS}</style>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, fontWeight: 600, color: "#fff", letterSpacing: 1 }}>GESTOR DE OFICINA</div>
          <div style={{ fontSize: 13, color: "#B4B9C0", marginTop: 4 }}>acesso restrito</div>
        </div>

        <div style={{ background: C.surface, borderRadius: 10, padding: 22 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, background: C.bg, padding: 4, borderRadius: 6 }}>
            {MODOS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => trocarModo(id)}
                style={{
                  ...btnBase,
                  flex: 1,
                  padding: "7px 0",
                  fontSize: 12,
                  border: "none",
                  background: modo === id ? "#fff" : "transparent",
                  color: modo === id ? C.ink : C.inkSoft,
                  fontWeight: modo === id ? 600 : 500,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <Field label="email">
            <input
              style={inputStyle}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErro("");
              }}
              placeholder="seu@email.com"
            />
          </Field>
          <Field label="senha">
            <input
              style={inputStyle}
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro("");
              }}
              placeholder="••••••"
              onKeyDown={(e) => e.key === "Enter" && entrar()}
            />
          </Field>

          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

          <button style={{ ...btnPrimary, width: "100%" }} onClick={entrar} disabled={carregando}>
            {carregando ? "entrando..." : "entrar"}
          </button>

          {modo === "equipe" && (
            <div style={{ textAlign: "center", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.inkSoft }}>não tem conta? </span>
              <span onClick={onCadastrar} style={{ fontSize: 12, color: C.accentDark, fontWeight: 600, cursor: "pointer" }}>
                cadastre sua oficina
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
