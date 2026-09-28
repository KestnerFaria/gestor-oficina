const express = require("express");
const db = require("../db");
const { requireAuth, requireFinanceiro } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();

// GET /pagamentos — lista os pagamentos da oficina
router.get("/", requireAuth, requireFinanceiro, async (req, res) => {
  const resultado = await db.query(
    `SELECT pg.*, os.numero AS os_numero, c.nome AS cliente_nome
     FROM pagamentos pg
     JOIN ordens_servico os ON os.id = pg.os_id
     JOIN clientes c ON c.id = os.cliente_id
     WHERE pg.oficina_id = $1
     ORDER BY pg.vencimento DESC`,
    [req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

// POST /pagamentos — lançamento manual (sem passar pela finalização da O.S.)
router.post("/", requireAuth, requireFinanceiro, async (req, res) => {
  const { osId, valor, vencimento, jaPago, forma, documento, comprovante } = req.body;
  if (!osId || !valor || !vencimento) return res.status(400).json({ erro: "informe a O.S., o valor e o vencimento." });

  const os = await db.query("SELECT numero FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [osId, req.auth.oficinaId]);
  if (!os.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });

  const hoje = new Date().toISOString().slice(0, 10);
  const resultado = await db.query(
    `INSERT INTO pagamentos (oficina_id, os_id, valor, vencimento, pago_em, recebido_por, registrado_por, forma, documento, comprovante_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      req.auth.oficinaId, osId, valor, vencimento,
      jaPago ? hoje : null, jaPago ? req.auth.id : null, req.auth.id,
      jaPago ? forma : null, jaPago ? documento || null : null, jaPago ? comprovante || null : null,
    ]
  );

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "lançou pagamento", `O.S. #${os.rows[0].numero}`, `R$ ${valor} · vence ${vencimento}`);
  res.status(201).json(resultado.rows[0]);
});

// PATCH /pagamentos/:id/pagar  { forma, documento, comprovante }
router.patch("/:id/pagar", requireAuth, requireFinanceiro, async (req, res) => {
  const { forma, documento, comprovante } = req.body;
  const hoje = new Date().toISOString().slice(0, 10);

  const resultado = await db.query(
    `UPDATE pagamentos SET pago_em = $1, recebido_por = $2, forma = $3, documento = $4, comprovante_url = $5
     WHERE id = $6 AND oficina_id = $7 RETURNING *, (SELECT numero FROM ordens_servico WHERE id = pagamentos.os_id) AS os_numero`,
    [hoje, req.auth.id, forma, documento || null, comprovante || null, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "pagamento não encontrado." });

  await registrarAuditoria(
    req.auth.oficinaId, req.auth.id, "recebeu pagamento", `O.S. #${resultado.rows[0].os_numero}`,
    `R$ ${resultado.rows[0].valor} · ${forma}${documento ? ` · doc ${documento}` : ""}`
  );
  res.json(resultado.rows[0]);
});

// PATCH /pagamentos/:id/estornar
router.patch("/:id/estornar", requireAuth, requireFinanceiro, async (req, res) => {
  const resultado = await db.query(
    `UPDATE pagamentos SET pago_em = NULL, recebido_por = NULL, forma = NULL, documento = NULL, comprovante_url = NULL
     WHERE id = $1 AND oficina_id = $2 RETURNING *, (SELECT numero FROM ordens_servico WHERE id = pagamentos.os_id) AS os_numero`,
    [req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "pagamento não encontrado." });

  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "estornou pagamento", `O.S. #${resultado.rows[0].os_numero}`, `R$ ${resultado.rows[0].valor}`);
  res.json(resultado.rows[0]);
});

module.exports = router;
