import { useState } from "react";
import type { Sessao } from "../sessao";

const CHAVE = "oficina_sessao";

// Lê a sessão salva no navegador. Se estiver corrompida, apaga.
function lerSessaoSalva(): Sessao | null {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return salvo ? (JSON.parse(salvo) as Sessao) : null;
  } catch {
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      // navegador sem acesso ao armazenamento (ex: aba anônima bloqueada)
    }
    return null;
  }
}

// Sessão de login lembrada entre recarregamentos da página (F5).
export function useSessao() {
  // lê na criação do estado: a primeira tela já sai certa, sem piscar o login
  const [sessao, setSessao] = useState<Sessao | null>(lerSessaoSalva);

  function entrar(nova: Sessao) {
    setSessao(nova);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(nova));
    } catch {
      // sem armazenamento, o login vale só até fechar a página
    }
  }

  function sair() {
    setSessao(null);
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      // nada a apagar
    }
  }

  return { sessao, entrar, sair };
}
