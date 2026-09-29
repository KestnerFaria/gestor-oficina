import type { ReactNode } from "react";
import { labelStyle } from "../../styles/theme";

interface FieldProps {
  label: ReactNode;
  children: ReactNode;
}

// Rótulo + campo de formulário
export function Field({ label, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
