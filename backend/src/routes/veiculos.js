const express = require("express");
const db = require("../db");
const { requireAuth, requireEquipe } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();

// GET /veiculos?clienteId=123 — lista veículos da oficina (opcionalmente filtrado por cliente)
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { clienteId } = req.query;
  const params = [req.auth.oficinaId];
  let sql = "SELECT * FROM veiculos WHERE oficina_id = $1";
  if (clienteId) {
    params.push(clienteId);
    sql += " AND cliente_id = $2";
  }
  const resultado = await db.query(sql + " ORDER BY id", params);
  res.json(resultado.rows);
});

// POST /veiculos
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const { clienteId, placa, marca, modelo, ano, cor, kmAtual } = req.body;
  if (!clienteId || !placa || !modelo) return res.status(400).json({ erro: "cliente, placa e modelo são obrigatórios." });

  const resultado = await db.query(
    `INSERT INTO veiculos (oficina_id, cliente_id, placa, marca, modelo, ano, cor, km_atual)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [req.auth.oficinaId, clienteId, placa.toUpperCase(), marca || null, modelo, ano || null, cor || null, kmAtual || null]
  );

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "cadastrou", `veículo ${placa}`, `${marca || ""} ${modelo}`.trim());
  res.status(201).json(resultado.rows[0]);
});

// PUT /veiculos/:id
router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const { placa, marca, modelo, ano, cor, kmAtual } = req.body;
  const resultado = await db.query(
    `UPDATE veiculos SET placa = $1, marca = $2, modelo = $3, ano = $4, cor = $5, km_atual = $6
     WHERE id = $7 AND oficina_id = $8 RETURNING *`,
    [placa?.toUpperCase(), marca, modelo, ano, cor, kmAtual, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "veículo não encontrado." });

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", `veículo ${placa}`, `${marca || ""} ${modelo}`.trim());
  res.json(resultado.rows[0]);
});

// DELETE /veiculos/:id
router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const atual = await db.query("SELECT placa, marca, modelo FROM veiculos WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!atual.rows[0]) return res.status(404).json({ erro: "veículo não encontrado." });

  await db.query("DELETE FROM veiculos WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "excluiu", `veículo ${atual.rows[0].placa}`, `${atual.rows[0].marca || ""} ${atual.rows[0].modelo}`.trim());
  res.status(204).send();
});

module.exports = router;
