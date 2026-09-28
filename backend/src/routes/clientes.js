const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { requireAuth, requireEquipe } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();
const SALT_ROUNDS = 10;

// GET /clientes — lista os clientes da oficina logada
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const resultado = await db.query(
    "SELECT id, nome, telefone, cpf, endereco, email FROM clientes WHERE oficina_id = $1 ORDER BY nome",
    [req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

// POST /clientes — cadastra cliente (email/senha são opcionais)
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const { nome, telefone, cpf, endereco, email, senha } = req.body;
  if (!nome || !telefone) return res.status(400).json({ erro: "nome e telefone são obrigatórios." });

  const senhaHash = senha ? await bcrypt.hash(senha, SALT_ROUNDS) : null;
  const resultado = await db.query(
    `INSERT INTO clientes (oficina_id, nome, telefone, cpf, endereco, email, senha_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, nome, telefone, cpf, endereco, email`,
    [req.auth.oficinaId, nome, telefone, cpf || null, endereco || null, email || null, senhaHash]
  );

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "cadastrou", `cliente ${nome}`, email ? `acesso: ${email}` : "sem acesso ao portal");
  res.status(201).json(resultado.rows[0]);
});

// PUT /clientes/:id — edita dados; senha só é alterada se enviada
router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const { nome, telefone, cpf, endereco, email, senha } = req.body;

  const atual = await db.query("SELECT * FROM clientes WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!atual.rows[0]) return res.status(404).json({ erro: "cliente não encontrado." });

  const senhaHash = senha ? await bcrypt.hash(senha, SALT_ROUNDS) : atual.rows[0].senha_hash;

  const resultado = await db.query(
    `UPDATE clientes SET nome = $1, telefone = $2, cpf = $3, endereco = $4, email = $5, senha_hash = $6
     WHERE id = $7 AND oficina_id = $8
     RETURNING id, nome, telefone, cpf, endereco, email`,
    [nome, telefone, cpf || null, endereco || null, email || null, senhaHash, req.params.id, req.auth.oficinaId]
  );

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", `cliente ${nome}`, "dados cadastrais/acesso");
  res.json(resultado.rows[0]);
});

// DELETE /clientes/:id — remove cliente e seus veículos (cascade no schema)
router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const atual = await db.query("SELECT nome FROM clientes WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!atual.rows[0]) return res.status(404).json({ erro: "cliente não encontrado." });

  await db.query("DELETE FROM clientes WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "excluiu", `cliente ${atual.rows[0].nome}`, "removido junto com seus veículos");
  res.status(204).send();
});

module.exports = router;
