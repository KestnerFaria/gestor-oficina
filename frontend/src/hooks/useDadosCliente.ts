import { useEffect, useState } from "react";
import { api, type Oficina, type Ordem, type Pagamento } from "../api";
import type { Sessao } from "../sessao";
import { mensagemDeErro } from "../utils/erros";

type SessaoCliente = Extract<Sessao, { tipo: "cliente" }>;

// Dados do portal do cliente: só as O.S. e pagamentos dele.
// Como no useDadosOficina, o componente é recriado a cada login.
export function useDadosCliente(sessao: SessaoCliente, aoSessaoInvalida: () => void) {
  const [oficina, setOficina] = useState<Oficina | null>(null);
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const [of, os, pg] = await Promise.all([
          api.minhaOficina(sessao.token),
          api.minhasOrdensCliente(sessao.token),
          api.meusPagamentosCliente(sessao.token),
        ]);
        setOficina(of);
        setOrdens(os);
        setPagamentos(pg);
      } catch (e) {
        console.error("falha ao carregar o portal do cliente:", mensagemDeErro(e));
        aoSessaoInvalida();
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { oficina, ordens, pagamentos, carregando };
}
