// ============================================================
// TEMA — cores, fontes e estilos base do sistema
// ============================================================
import type { CSSProperties } from "react";

// Fontes do Google + regras de impressão da O.S.
// (injetado nas telas com <style>{FONTS}</style>)
export const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area {
    position: absolute !important; top: 0 !important; left: 0 !important;
    width: 100% !important; margin: 0 !important; border: none !important;
    padding: 0 !important; background: #fff !important; box-shadow: none !important;
  }
  .no-print { display: none !important; }
  body { background: #fff !important; }
}
`;

// Paleta de cores. "as const" deixa os valores imutáveis e com tipo exato.
export const C = {
  bg: "#F1EFE8",
  surface: "#FFFFFF",
  ink: "#20242A",
  inkSoft: "#5B6169",
  muted: "#8A8F97",
  border: "#DCD8CE",
  accent: "#E0611F",
  accentDark: "#A9430F",
  accentBg: "#FCE6D6",
  ok: "#2F6E4F",
  okBg: "#E1EFE6",
  warn: "#B8862E",
  warnBg: "#FBEFD8",
  danger: "#B23A2E",
  dangerBg: "#F8E1DD",
  steel: "#3A4048",
} as const;

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 11px",
  fontSize: 14,
  fontFamily: "Inter, sans-serif",
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  background: "#fff",
  color: C.ink,
  outline: "none",
};

export const btnBase: CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  fontWeight: 500,
  padding: "9px 16px",
  borderRadius: 5,
  cursor: "pointer",
  border: `1px solid ${C.border}`,
  background: "#fff",
  color: C.ink,
};

export const btnPrimary: CSSProperties = { ...btnBase, background: C.accent, borderColor: C.accent, color: "#fff" };

// Estilo dos rótulos em maiúsculas acima dos campos
export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: C.inkSoft,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
