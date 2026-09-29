import type { Comprovante, FormaPagamento } from "../../api";
import { FORMAS } from "../../constants";
import { C, inputStyle, labelStyle } from "../../styles/theme";

interface CamposComprovanteProps {
  forma: FormaPagamento;
  documento: string;
  comprovante: Comprovante | null;
  onDocumento: (valor: string) => void;
  onArquivo: (arquivo: File | undefined) => void;
}

// Número do documento (NSU / ID do PIX) + anexo do comprovante
export function CamposComprovante({ forma, documento, comprovante, onDocumento, onArquivo }: CamposComprovanteProps) {
  const cfg = FORMAS[forma];
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>{cfg.rotuloDoc}</label>
          <input
            style={inputStyle}
            value={documento}
            onChange={(e) => onDocumento(e.target.value)}
            placeholder={forma === "pix" ? "Ex: E1234567820260810" : "Ex: 004512"}
          />
        </div>
        <div>
          <label style={labelStyle}>anexar comprovante</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onArquivo(e.target.files?.[0])}
            style={{ ...inputStyle, padding: "7px 8px", fontSize: 12 }}
          />
        </div>
      </div>
      {comprovante && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.ok, display: "flex", alignItems: "center", gap: 8 }}>
          <span>anexado: {comprovante.nome}</span>
          <a href={comprovante.dados} download={comprovante.nome} style={{ color: C.accentDark, textDecoration: "underline" }}>
            ver
          </a>
        </div>
      )}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
        informe o {cfg.rotuloDoc} ou anexe o comprovante — pelo menos um dos dois.
      </div>
    </div>
  );
}
