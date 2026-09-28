import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireEquipe } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";

const router = Router();

interface ProdutoRow {
  id: number;
  oficina_id: number;
  nome: string;
  quantidade_estoque: number;
  estoque_minimo: number;
  preco_venda: number;
  preco_custo: number;
  ativo: boolean;
}

interface ProdutoBody {
  nome?: string;
  quantidadeEstoque?: number | string;
  estoqueMinimo?: number | string;
  precoVenda?: number | string;
  precoCusto?: number | string;
}

router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query<ProdutoRow>(
    "SELECT * FROM produtos WHERE oficina_id = $1 AND ativo = TRUE ORDER BY nome",
    [oficinaId]
  );
  res.json(resultado.rows);
});

router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { nome, quantidadeEstoque, estoqueMinimo, precoVenda, precoCusto } = req.body as ProdutoBody;
  if (!nome) return res.status(400).json({ erro: "nome é obrigatório." });

  const resultado = await db.query<ProdutoRow>(
    `INSERT INTO produtos (oficina_id, nome, quantidade_estoque, estoque_minimo, preco_venda, preco_custo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      auth.oficinaId,
      nome,
      Number(quantidadeEstoque) || 0,
      Number(estoqueMinimo) || 0,
      Number(precoVenda) || 0,
      Number(precoCusto) || 0,
    ]
  );
  await registrarAuditoria(auth.oficinaId, auth.id, "cadastrou", `peça ${nome}`, `estoque inicial: ${quantidadeEstoque || 0}`);
  res.status(201).json(resultado.rows[0]);
});

router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { nome, quantidadeEstoque, estoqueMinimo, precoVenda, precoCusto } = req.body as ProdutoBody;
  const resultado = await db.query<ProdutoRow>(
    `UPDATE produtos SET nome = $1, quantidade_estoque = $2, estoque_minimo = $3, preco_venda = $4, preco_custo = $5
     WHERE id = $6 AND oficina_id = $7 RETURNING *`,
    [
      nome,
      Number(quantidadeEstoque) || 0,
      Number(estoqueMinimo) || 0,
      Number(precoVenda) || 0,
      Number(precoCusto) || 0,
      req.params.id,
      auth.oficinaId,
    ]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "peça não encontrada." });
  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", `peça ${nome}`, `estoque ajustado para ${quantidadeEstoque}`);
  res.json(resultado.rows[0]);
});

router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const atual = await db.query<Pick<ProdutoRow, "nome">>("SELECT nome FROM produtos WHERE id = $1 AND oficina_id = $2", [
    req.params.id,
    auth.oficinaId,
  ]);
  const produto = atual.rows[0];
  if (!produto) return res.status(404).json({ erro: "peça não encontrada." });

  await db.query("UPDATE produtos SET ativo = FALSE WHERE id = $1 AND oficina_id = $2", [req.params.id, auth.oficinaId]);
  await registrarAuditoria(auth.oficinaId, auth.id, "excluiu", `peça ${produto.nome}`, "removida do estoque");
  res.status(204).send();
});

export default router;
