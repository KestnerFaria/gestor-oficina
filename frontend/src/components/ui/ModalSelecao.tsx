import type { ReactNode } from "react";
import { btnBase, C } from "../../styles/theme";

interface ModalSelecaoProps {
  titulo: ReactNode;
  onFechar: () => void;
  children: ReactNode;
}

// Janela por cima da tela. Fecha ao clicar fora ou no botão "fechar".
export function ModalSelecao({ titulo, onFechar, children }: ModalSelecaoProps) {
  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,36,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        // impede que o clique dentro da janela "vaze" para o fundo e feche o modal
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 460,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, fontWeight: 600, color: C.ink }}>{titulo}</div>
          <button onClick={onFechar} style={{ ...btnBase, padding: "4px 10px", fontSize: 12 }}>
            fechar
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 0" }}>{children}</div>
      </div>
    </div>
  );
}
