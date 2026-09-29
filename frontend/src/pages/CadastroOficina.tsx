import { useState, type ChangeEvent } from "react";
import { api } from "../api";
import { Field } from "../components/ui";
import type { Sessao } from "../sessao";
import { btnBase, btnPrimary, C, FONTS, inputStyle } from "../styles/theme";
import { mensagemDeErro } from "../utils/erros";

const TAMANHO_MAXIMO_LOGO = 1024 * 1024; // 1MB

interface FormCadastro {
  nomeOficina: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  logo: string | null; // imagem em base64 (data URL)
  nomeUsuario: string;
  email: string;
  senha: string;
  senha2: string;
}

// só os campos de texto (a logo tem um input próprio)
type CampoTexto = Exclude<keyof FormCadastro, "logo">;

const FORM_VAZIO: FormCadastro = {
  nomeOficina: "",
  cnpj: "",
  telefone: "",
  endereco: "",
  logo: null,
  nomeUsuario: "",
  email: "",
  senha: "",
  senha2: "",
};

interface CadastroOficinaProps {
  onVoltar: () => void;
  onCadastrado: (sessao: Sessao) => void;
}

export function CadastroOficina({ onVoltar, onCadastrado }: CadastroOficinaProps) {
  const [f, setF] = useState<FormCadastro>(FORM_VAZIO);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // cria o onChange de cada campo: set("email") atualiza f.email
  const set = (campo: CampoTexto) => (e: ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [campo]: e.target.value });
    setErro("");
  };

  function lerLogo(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_LOGO) return setErro("a imagem deve ter no máximo 1MB.");
    const reader = new FileReader();
    reader.onload = () => {
      setF((anterior) => ({ ...anterior, logo: reader.result as string }));
      setErro("");
    };
    reader.readAsDataURL(arquivo);
  }

  async function cadastrar() {
    if (!f.nomeOficina || !f.telefone || !f.nomeUsuario || !f.email || !f.senha) {
      return setErro("preencha os campos obrigatórios.");
    }
    if (f.senha !== f.senha2) return setErro("as senhas não conferem.");

    setCarregando(true);
    try {
      const { token, usuario } = await api.cadastrarOficina({ ...f });
      onCadastrado({ tipo: "equipe", token, usuario });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  const tituloSecao = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 } as const;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.steel, minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 24 }}>
      <style>{FONTS}</style>
      <div style={{ width: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, fontWeight: 600, color: "#fff", letterSpacing: 1 }}>CADASTRAR OFICINA</div>
          <div style={{ fontSize: 13, color: "#B4B9C0", marginTop: 4 }}>esses dados aparecem no cabeçalho das O.S. impressas</div>
        </div>

        <div style={{ background: C.surface, borderRadius: 10, padding: 22 }}>
          <div style={{ ...tituloSecao, marginBottom: 12 }}>dados da empresa</div>

          <Field label="nome da oficina *">
            <input style={inputStyle} value={f.nomeOficina} onChange={set("nomeOficina")} placeholder="Ex: Oficina do João" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="CNPJ ou CPF *">
              <input style={inputStyle} value={f.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0001-00" />
            </Field>
            <Field label="telefone *">
              <input style={inputStyle} value={f.telefone} onChange={set("telefone")} placeholder="(00) 0000-0000" />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: -8, marginBottom: 12 }}>
            necessário para configurar a cobrança após os 10 dias de teste grátis.
          </div>

          <Field label="endereço">
            <input style={inputStyle} value={f.endereco} onChange={set("endereco")} placeholder="Rua, número, bairro, cidade/UF" />
          </Field>

          <Field label="logo da oficina (opcional)">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {f.logo && (
                <img
                  src={f.logo}
                  alt="logo"
                  style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff" }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => lerLogo(e.target.files?.[0])}
                style={{ ...inputStyle, padding: "7px 8px", fontSize: 12, flex: 1 }}
              />
              {f.logo && (
                <button style={{ ...btnBase, padding: "6px 10px", fontSize: 12 }} onClick={() => setF({ ...f, logo: null })}>
                  remover
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>aparece no cabeçalho da O.S. impressa. até 1MB.</div>
          </Field>

          <div style={{ ...tituloSecao, margin: "18px 0 12px", borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>seu acesso de administrador</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="seu nome *">
              <input style={inputStyle} value={f.nomeUsuario} onChange={set("nomeUsuario")} placeholder="Nome completo" />
            </Field>
            <Field label="email de acesso *">
              <input style={inputStyle} value={f.email} onChange={set("email")} placeholder="seu@email.com" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="senha *">
              <input style={inputStyle} type="password" value={f.senha} onChange={set("senha")} placeholder="••••••" />
            </Field>
            <Field label="repetir senha *">
              <input style={inputStyle} type="password" value={f.senha2} onChange={set("senha2")} placeholder="••••••" />
            </Field>
          </div>

          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...btnBase, flex: 1 }} onClick={onVoltar}>
              voltar
            </button>
            <button style={{ ...btnPrimary, flex: 2 }} onClick={cadastrar} disabled={carregando}>
              {carregando ? "criando..." : "criar conta e entrar"}
            </button>
          </div>

          <div style={{ background: C.accentBg, borderRadius: 8, padding: "12px 14px", marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.accentDark }}>10 dias de teste grátis, sem compromisso</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>depois, R$ 170/mês. cancele quando quiser.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
