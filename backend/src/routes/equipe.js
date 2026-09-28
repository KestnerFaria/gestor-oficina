const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { requireAuth, requireEquipe, requireAdmin } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();
const LIMITE_ACESSOS = 3;
const SALT_ROUNDS = 10;

// GET /equipe — qualquer membro da equipe pode ver os nomes (ex: escolher
// o mecânico responsável). Só o admin pode adicionar/remover (abaixo).
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const resultado = await db.query(
    "SELECT id, nome, email, perfil FROM usuarios WHERE oficina_id = $1 AND ativo = TRUE ORDER BY id",
    [req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

// POST /equipe — adiciona um novo acesso, respeitando o limite
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: "preencha nome, email e senha." });

  const contagem = await db.query(
    "SELECT COUNT(*) FROM usuarios WHERE oficina_id = $1 AND ativo = TRUE",
    [req.auth.oficinaId]
  );
  if (Number(contagem.rows[0].count) >= LIMITE_ACESSOS) {
    return res.status(400).json({ erro: `limite de ${LIMITE_ACESSOS} acessos por oficina atingido.` });
  }

  const existente = await db.query("SELECT id FROM usuarios WHERE email = $1", [email]);
  if (existente.rows.length > 0) return res.status(409).json({ erro: "este email já está em uso." });

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const resultado = await db.query(
    `INSERT INTO usuarios (oficina_id, nome, email, senha_hash, perfil)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, email, perfil`,
    [req.auth.oficinaId, nome, email, senhaHash, perfil || "atendente"]
  );

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "cadastrou", `acesso ${nome}`, `perfil: ${perfil}`);
  res.status(201).json(resultado.rows[0]);
});

// DELETE /equipe/:id — remove um acesso (não deixa remover o último admin)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const alvo = await db.query("SELECT * FROM usuarios WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!alvo.rows[0]) return res.status(404).json({ erro: "acesso não encontrado." });

  if (alvo.rows[0].perfil === "admin") {
    const admins = await db.query(
      "SELECT COUNT(*) FROM usuarios WHERE oficina_id = $1 AND perfil = 'admin' AND ativo = TRUE",
      [req.auth.oficinaId]
    );
    if (Number(admins.rows[0].count) <= 1) {
      return res.status(400).json({ erro: "não é possível remover o último administrador da oficina." });
    }
  }

  await db.query("UPDATE usuarios SET ativo = FALSE WHERE id = $1", [req.params.id]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "excluiu", `acesso ${alvo.rows[0].nome}`, `perfil: ${alvo.rows[0].perfil}`);
  res.status(204).send();
});

module.exports = router;
