const express = require("express");
const db = require("../db");
const { requireAuth, requireEquipe } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();

router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const resultado = await db.query(
    "SELECT * FROM produtos WHERE oficina_id = $1 AND ativo = TRUE ORDER BY nome",
    [req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const { nome, quantidadeEstoque, estoqueMinimo, precoVenda, precoCusto } = req.body;
  if (!nome) return res.status(400).json({ erro: "nome é obrigatório." });

  const resultado = await db.query(
    `INSERT INTO produtos (oficina_id, nome, quantidade_estoque, estoque_minimo, preco_venda, preco_custo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.auth.oficinaId, nome, Number(quantidadeEstoque) || 0, Number(estoqueMinimo) || 0, Number(precoVenda) || 0, Number(precoCusto) || 0]
  );
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "cadastrou", `peça ${nome}`, `estoque inicial: ${quantidadeEstoque || 0}`);
  res.status(201).json(resultado.rows[0]);
});

router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const { nome, quantidadeEstoque, estoqueMinimo, precoVenda, precoCusto } = req.body;
  const resultado = await db.query(
    `UPDATE produtos SET nome = $1, quantidade_estoque = $2, estoque_minimo = $3, preco_venda = $4, preco_custo = $5
     WHERE id = $6 AND oficina_id = $7 RETURNING *`,
    [nome, Number(quantidadeEstoque) || 0, Number(estoqueMinimo) || 0, Number(precoVenda) || 0, Number(precoCusto) || 0, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "peça não encontrada." });
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", `peça ${nome}`, `estoque ajustado para ${quantidadeEstoque}`);
  res.json(resultado.rows[0]);
});

router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const atual = await db.query("SELECT nome FROM produtos WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!atual.rows[0]) return res.status(404).json({ erro: "peça não encontrada." });

  await db.query("UPDATE produtos SET ativo = FALSE WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "excluiu", `peça ${atual.rows[0].nome}`, "removida do estoque");
  res.status(204).send();
});

module.exports = router;
