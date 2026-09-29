import { useState } from "react";
import type { Id, RegistroAuditoria, Usuario } from "../api";
import { Badge } from "../components/ui";
import { tomDaAcao } from "../regras";
import { C, inputStyle } from "../styles/theme";
import { fmtDataHora } from "../utils/datas";

interface AuditoriaProps {
  auditoria: RegistroAuditoria[];
  equipe: Usuario[];
}

// Registro de tudo que foi alterado na oficina, e por quem (só admin vê)
export function Auditoria({ auditoria, equipe }: AuditoriaProps) {
  const [filtroUsuario, setFiltroUsuario] = useState("todos");

  const nomeUsuario = (id: Id | null) => equipe.find((u) => u.id === id)?.nome || "usuário removido";
  const filtrada = auditoria.filter((a) => filtroUsuario === "todos" || a.usuarioId === Number(filtroUsuario));

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>auditoria</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>registro de tudo que foi alterado nesta oficina, e por quem</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.inkSoft }}>filtrar por usuário:</span>
        <select style={{ ...inputStyle, width: 220 }} value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
          <option value="todos">todos</option>
          {equipe.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {filtrada.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>nenhum registro ainda.</div>}
        {filtrada.map((a, i) => (
          <div
            key={a.id}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}
          >
            <div style={{ width: 130, flexShrink: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.muted }}>{fmtDataHora(a.em)}</div>
            <div style={{ width: 140, flexShrink: 0 }}>
              <Badge tone={tomDaAcao(a.acao)}>{a.acao}</Badge>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{a.entidade}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{a.detalhe}</div>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, textAlign: "right", flexShrink: 0 }}>{nomeUsuario(a.usuarioId)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
