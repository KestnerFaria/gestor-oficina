import type { ReactNode } from "react";
import type { Tom } from "../../constants";
import { C } from "../../styles/theme";

const CORES: Record<Tom, { bg: string; fg: string }> = {
  ok: { bg: C.okBg, fg: C.ok },
  warn: { bg: C.warnBg, fg: C.warn },
  danger: { bg: C.dangerBg, fg: C.danger },
  accent: { bg: C.accentBg, fg: C.accentDark },
  muted: { bg: "#ECEAE3", fg: C.inkSoft },
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tom;
}

// Selo colorido (ex: status da O.S.)
export function Badge({ children, tone = "muted" }: BadgeProps) {
  const cor = CORES[tone];
  return (
    <span
      style={{
        background: cor.bg,
        color: cor.fg,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 3,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}
