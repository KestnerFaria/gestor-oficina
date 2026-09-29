import { C } from "../../styles/theme";

interface PlateProps {
  placa: string;
}

// Placa do veículo no estilo "plaquinha"
export function Plate({ placa }: PlateProps) {
  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 12,
        fontWeight: 500,
        color: C.ink,
        background: "#fff",
        border: `1.5px solid ${C.steel}`,
        borderRadius: 3,
        padding: "2px 7px",
        letterSpacing: 1,
      }}
    >
      {placa}
    </span>
  );
}
