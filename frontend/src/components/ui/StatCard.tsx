import type { ReactNode } from "react";
import { C } from "../../styles/theme";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  tone?: "ok" | "danger";
}

// Cartão de número do dashboard (ex: "faturamento hoje")
export function StatCard({ label, value, tone }: StatCardProps) {
  const bg = tone === "danger" ? C.dangerBg : tone === "ok" ? C.okBg : "#fff";
  const fg = tone === "danger" ? C.danger : tone === "ok" ? C.ok : C.ink;
  return (
    <div style={{ background: bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: tone ? fg : C.inkSoft, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: fg, fontFamily: "Oswald, sans-serif" }}>{value}</div>
    </div>
  );
}
