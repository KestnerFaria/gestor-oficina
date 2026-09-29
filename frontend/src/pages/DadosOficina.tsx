import { useState, type ChangeEvent } from "react";
import type { Oficina, Usuario } from "../api";
import { Field } from "../components/ui";
import { btnBase, btnPrimary, C, inputStyle } from "../styles/theme";
import { mensagemDeErro } from "../utils/erros";

const TAMANHO_MAXIMO_LOGO = 1024 * 1024; // 1MB

type CampoTexto = "nome" | "cnpj" | "telefone" | "endereco";

interface DadosOficinaProps {
  usuario: Usuario;
  oficina: Oficina;
  actions: {
    atualizarOficina: (dados: Oficina) => Promise<void>;
  };
}

// Dados que aparecem no cabeçalho de toda O.S. impressa
export function DadosOficina({ usuario, oficina, actions }: DadosOficinaProps) {
  const [f, setF] = useState<Oficina>(oficina);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const podeEditar = usuario.perfil === "admin";

  async function salvar() {
    try {
      await actions.atualizarOficina(f);
      setSalvo(true);
      setErro("");
      setTimeout(() => setSalvo(false), 2500);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const set = (campo: CampoTexto) => (e: ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [campo]: e.target.value });
    setSalvo(false);
  };

  function lerLogo(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_LOGO) return setErro("a imagem deve ter no máximo 1MB.");
    const reader = new FileReader();
    reader.onload = () => {
      setF((anterior) => ({ ...anterior, logo: reader.result as string }));
      setSalvo(false);
      setErro("");
    };
    reader.readAsDataURL(arquivo);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>dados da oficina</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>aparecem no cabeçalho de toda O.S. impressa</div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <Field label="nome da oficina">
          <input style={inputStyle} value={f.nome} onChange={set("nome")} disabled={!podeEditar} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="CNPJ">
            <input style={inputStyle} value={f.cnpj || ""} onChange={set("cnpj")} disabled={!podeEditar} />
          </Field>
          <Field label="telefone">
            <input style={inputStyle} value={f.telefone || ""} onChange={set("telefone")} disabled={!podeEditar} />
          </Field>
        </div>
        <Field label="endereço">
          <input style={inputStyle} value={f.endereco || ""} onChange={set("endereco")} disabled={!podeEditar} />
        </Field>

        <Field label="logo da oficina">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {f.logo ? (
                <img src={f.logo} alt="logo da oficina" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 8 }} />
              ) : (
                <span style={{ fontSize: 10, color: C.muted }}>sem logo</span>
              )}
            </div>
            {podeEditar && (
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => lerLogo(e.target.files?.[0])}
                  style={{ ...inputStyle, padding: "7px 8px", fontSize: 12, width: "100%" }}
                />
                {f.logo && (
                  <button
                    style={{ ...btnBase, padding: "4px 10px", fontSize: 11, marginTop: 6, color: C.danger }}
                    onClick={() => {
                      setF({ ...f, logo: null });
                      setSalvo(false);
                    }}
                  >
                    remover logo
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>aparece no cabeçalho da O.S. impressa. até 1MB.</div>
        </Field>

        {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

        {podeEditar ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
            {salvo && <span style={{ fontSize: 12, color: C.ok }}>alterações salvas</span>}
            <button style={btnPrimary} onClick={salvar}>
              salvar
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.muted }}>apenas administradores podem alterar esses dados.</div>
        )}
      </div>
    </div>
  );
}
