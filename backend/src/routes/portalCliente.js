const express = require("express");
const db = require("../db");
const { requireAuth, requireCliente } = require("../middleware/auth");

const router = express.Router();

// GET /portal/minhas-ordens — o cliente só vê as próprias O.S.
router.get("/minhas-ordens", requireAuth, requireCliente, async (req, res) => {
  const resultado = await db.query(
    `SELECT os.*, v.modelo AS veiculo_modelo, v.ano AS veiculo_ano, v.placa AS veiculo_placa
     FROM ordens_servico os
     JOIN veiculos v ON v.id = os.veiculo_id
     WHERE os.cliente_id = $1 AND os.oficina_id = $2
     ORDER BY os.criado_em DESC`,
    [req.auth.id, req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

// GET /portal/meus-pagamentos
router.get("/meus-pagamentos", requireAuth, requireCliente, async (req, res) => {
  const resultado = await db.query(
    `SELECT pg.* FROM pagamentos pg
     JOIN ordens_servico os ON os.id = pg.os_id
     WHERE os.cliente_id = $1 AND os.oficina_id = $2
     ORDER BY pg.vencimento DESC`,
    [req.auth.id, req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

module.exports = router;
