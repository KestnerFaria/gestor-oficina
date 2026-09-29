import { describe, expect, it } from "vitest";
import type { Ordem, Produto, Servico } from "../api";
import { itensDaOrdem } from ".";

const catalogo = [{ id: 1, nome: "Troca de óleo", preco: 100 }] as Servico[];
const estoque = [{ id: 5, nome: "Filtro", precoVenda: 45 }] as Produto[];

describe("itensDaOrdem", () => {
  it("usa o nome e o preço gravados na O.S.", () => {
    const os = {
      itensServicos: [{ servicoId: 1, nome: "Troca de óleo", preco: 80 }],
      pecasUtilizadas: [{ produtoId: 5, nome: "Filtro", quantidade: 2, precoUnitario: 30 }],
    } as unknown as Ordem;

    expect(itensDaOrdem(os, catalogo, estoque).map(({ nome, quantidade, valor }) => ({ nome, quantidade, valor }))).toEqual([
      { nome: "Troca de óleo", quantidade: 1, valor: 80 },
      { nome: "Filtro", quantidade: 2, valor: 60 },
    ]);
  });

  it("cai para o catálogo quando a API ainda não manda os itens", () => {
    const os = { servicosIds: [1], pecasUtilizadas: [{ produtoId: 5, quantidade: 1 }] } as unknown as Ordem;

    expect(itensDaOrdem(os, catalogo, estoque).map((i) => i.valor)).toEqual([100, 45]);
  });

  it("devolve lista vazia para O.S. sem itens", () => {
    expect(itensDaOrdem({} as Ordem, catalogo, estoque)).toEqual([]);
  });
});
