import type { FormaPagamento } from "../../api";
import { FORMAS } from "../../constants";
import { btnBase, C } from "../../styles/theme";

interface SeletorFormaProps {
  valor: FormaPagamento;
  onChange: (forma: FormaPagamento) => void;
}

// Botões para escolher dinheiro / cartão / PIX
export function SeletorForma({ valor, onChange }: SeletorFormaProps) {
  // Object.entries perde o tipo das chaves, então dizemos explicitamente quais são
  const formas = Object.entries(FORMAS) as [FormaPagamento, (typeof FORMAS)[FormaPagamento]][];

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.inkSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
        forma de pagamento
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {formas.map(([forma, cfg]) => {
          const selecionada = valor === forma;
          return (
            <button
              key={forma}
              onClick={() => onChange(forma)}
              style={{
                ...btnBase,
                flex: 1,
                padding: "10px 0",
                fontSize: 13,
                background: selecionada ? C.accent : "#fff",
                borderColor: selecionada ? C.accent : C.border,
                color: selecionada ? "#fff" : C.ink,
                fontWeight: selecionada ? 600 : 500,
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
