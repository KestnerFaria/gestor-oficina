import type { LoginClienteResposta, Usuario } from "./api";

// Quem está logado. Existem dois tipos de acesso:
// a equipe da oficina e o cliente do portal.
export type Sessao =
  | { tipo: "equipe"; token: string; usuario: Usuario }
  | { tipo: "cliente"; token: string; cliente: LoginClienteResposta["cliente"] };
