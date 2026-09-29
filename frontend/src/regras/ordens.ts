// ============================================================
// REGRAS DA ORDEM DE SERVIÇO
// ============================================================
import type { Ordem, Produto, Servico } from "../api";

export interface ItemDaOrdem {
  chave: string;
  nome: string;
  quantidade: number;
  valor: number; // preço unitário x quantidade
}

// Serviços e peças de uma O.S. com o preço CONGELADO no dia em que ela foi
// aberta (é o que foi cobrado). Se a API ainda não mandar os itens (backend
// antigo), usa o catálogo atual como plano B, para não quebrar a tela.
export function itensDaOrdem(os: Ordem, servicos: Servico[], produtos: Produto[]): ItemDaOrdem[] {
  const itensServicos: ItemDaOrdem[] = os.itensServicos
    ? os.itensServicos.map((s, i) => ({ chave: `serv-${s.servicoId}-${i}`, nome: s.nome, quantidade: 1, valor: s.preco }))
    : servicos
        .filter((s) => os.servicosIds?.includes(s.id))
        .map((s) => ({ chave: `serv-${s.id}`, nome: s.nome, quantidade: 1, valor: s.preco }));

  const itensPecas: ItemDaOrdem[] = (os.pecasUtilizadas || []).flatMap((u, i) => {
    if (u.nome !== undefined && u.precoUnitario !== undefined) {
      return [{ chave: `peca-${u.produtoId}-${i}`, nome: u.nome, quantidade: u.quantidade, valor: u.precoUnitario * u.quantidade }];
    }
    const produto = produtos.find((p) => p.id === u.produtoId);
    return produto ? [{ chave: `peca-${produto.id}`, nome: produto.nome, quantidade: u.quantidade, valor: produto.precoVenda * u.quantidade }] : [];
  });

  return [...itensServicos, ...itensPecas];
}
