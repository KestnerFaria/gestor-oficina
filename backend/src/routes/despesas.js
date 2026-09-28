const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const resultado = await db.query("SELECT * FROM despesas WHERE oficina_id = $1 ORDER BY data_vencimento", [req.auth.oficinaId]);
  res.json(resultado.rows);
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { descricao, categoria, valor, dataVencimento, fixa } = req.body;
  if (!descricao || !valor) return res.status(400).json({ erro: "descrição e valor são obrigatórios." });

  const resultado = await db.query(
    `INSERT INTO despesas (oficina_id, descricao, categoria, valor, data_vencimento, fixa, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.auth.oficinaId, descricao, categoria || "outros", valor, dataVencimento || null, !!fixa, req.auth.id]
  );

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "lançou despesa", descricao, `R$ ${valor} · ${categoria}${fixa ? " · fixa mensal" : ""}`);
  res.status(201).json(resultado.rows[0]);
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const atual = await db.query("SELECT descricao, valor FROM despesas WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!atual.rows[0]) return res.status(404).json({ erro: "despesa não encontrada." });

  await db.query("DELETE FROM despesas WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "excluiu despesa", atual.rows[0].descricao, `R$ ${atual.rows[0].valor}`);
  res.status(204).send();
});

module.exports = router;
