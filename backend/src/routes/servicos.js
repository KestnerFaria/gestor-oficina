const express = require("express");
const db = require("../db");
const { requireAuth, requireEquipe } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();

router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const resultado = await db.query(
    "SELECT * FROM servicos WHERE oficina_id = $1 AND ativo = TRUE ORDER BY nome",
    [req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const { nome, preco } = req.body;
  if (!nome) return res.status(400).json({ erro: "nome é obrigatório." });

  const resultado = await db.query(
    "INSERT INTO servicos (oficina_id, nome, preco) VALUES ($1, $2, $3) RETURNING *",
    [req.auth.oficinaId, nome, Number(preco) || 0]
  );
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "cadastrou", `serviço ${nome}`, `R$ ${preco}`);
  res.status(201).json(resultado.rows[0]);
});

router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const { nome, preco } = req.body;
  const resultado = await db.query(
    "UPDATE servicos SET nome = $1, preco = $2 WHERE id = $3 AND oficina_id = $4 RETURNING *",
    [nome, Number(preco) || 0, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "serviço não encontrado." });
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", `serviço ${nome}`, `R$ ${preco}`);
  res.json(resultado.rows[0]);
});

router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const atual = await db.query("SELECT nome FROM servicos WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!atual.rows[0]) return res.status(404).json({ erro: "serviço não encontrado." });

  await db.query("UPDATE servicos SET ativo = FALSE WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "excluiu", `serviço ${atual.rows[0].nome}`, "removido do catálogo");
  res.status(204).send();
});

module.exports = router;
