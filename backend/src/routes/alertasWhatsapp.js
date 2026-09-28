const express = require("express");
const db = require("../db");
const { requireAuth, requireEquipe } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();

// GET /alertas-whatsapp — usado pro dashboard mostrar "alerta enviado em"
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const resultado = await db.query("SELECT * FROM alertas_whatsapp WHERE oficina_id = $1", [req.auth.oficinaId]);
  res.json(resultado.rows);
});

// POST /alertas-whatsapp — registra o clique em "chamar no whatsapp"
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const { clienteId, veiculoId } = req.body;
  const resultado = await db.query(
    `INSERT INTO alertas_whatsapp (oficina_id, cliente_id, veiculo_id, enviado_por)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.auth.oficinaId, clienteId, veiculoId, req.auth.id]
  );

  const cliente = await db.query("SELECT nome FROM clientes WHERE id = $1", [clienteId]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "enviou alerta", cliente.rows[0]?.nome || "cliente", "lembrete de troca de óleo via whatsapp");
  res.status(201).json(resultado.rows[0]);
});

module.exports = router;
