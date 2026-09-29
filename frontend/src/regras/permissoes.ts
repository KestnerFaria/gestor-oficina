// ============================================================
// PERMISSÕES — o que cada perfil vê no menu
// ============================================================
import type { Usuario } from "../api";

export type Aba = "dashboard" | "nova_os" | "clientes" | "catalogo" | "financeiro" | "despesas" | "empresa" | "assinatura" | "equipe" | "auditoria";

// Abas do menu lateral conforme o perfil de quem está logado
export function abasDoPerfil(perfil: Usuario["perfil"]): { id: Aba; label: string }[] {
  const admin = perfil === "admin";
  const financeiro = admin || perfil === "atendente";
  const abas: ({ id: Aba; label: string } | false)[] = [
    { id: "dashboard", label: "dashboard" },
    { id: "nova_os", label: "nova O.S." },
    { id: "clientes", label: "clientes e veículos" },
    { id: "catalogo", label: "serviços e estoque" },
    financeiro && { id: "financeiro", label: "financeiro" },
    admin && { id: "despesas", label: "despesas mensais" },
    { id: "empresa", label: "dados da oficina" },
    admin && { id: "assinatura", label: "minha assinatura" },
    admin && { id: "equipe", label: "acessos da equipe" },
    admin && { id: "auditoria", label: "auditoria" },
  ];
  return abas.filter((a) => a !== false);
}
