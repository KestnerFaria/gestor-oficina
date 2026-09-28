import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireFinanceiro } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";
import { hojeISO } from "../utils/datas";
import type { FormaPagamento, OrdemServicoRow } from "../types";

const router = Router();

interface PagamentoRow {
  id: number;
  oficina_id: number;
  os_id: number;
  valor: number;
  vencimento: Date;
  pago_em: Date | null;
  forma: FormaPagamento | null;
  os_numero?: string;
}

interface DadosRecebimento {
  forma?: FormaPagamento;
  documento?: string;
  comprovante?: string;
}

// GET /pagamentos — lista os pagamentos da oficina
router.get("/", requireAuth, requireFinanceiro, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query<PagamentoRow>(
    `SELECT pg.*, os.numero AS os_numero, c.nome AS cliente_nome
     FROM pagamentos pg
     JOIN ordens_servico os ON os.id = pg.os_id
     JOIN clientes c ON c.id = os.cliente_id
     WHERE pg.oficina_id = $1
     ORDER BY pg.vencimento DESC`,
    [oficinaId]
  );
  res.json(resultado.rows);
});

// POST /pagamentos — lançamento manual (sem passar pela finalização da O.S.)
router.post("/", requireAuth, requireFinanceiro, async (req, res) => {
  const auth = getAuth(req);
  const { osId, valor, vencimento, jaPago, forma, documento, comprovante } = req.body as DadosRecebimento & {
    osId?: number;
    valor?: number | string;
    vencimento?: string;
    jaPago?: boolean;
  };
  if (!osId || !valor || !vencimento) return res.status(400).json({ erro: "informe a O.S., o valor e o vencimento." });

  const os = await db.query<Pick<OrdemServicoRow, "numero">>(
    "SELECT numero FROM ordens_servico WHERE id = $1 AND oficina_id = $2",
    [osId, auth.oficinaId]
  );
  const ordem = os.rows[0];
  if (!ordem) return res.status(404).json({ erro: "O.S. não encontrada." });

  const hoje = hojeISO();
  const resultado = await db.query<PagamentoRow>(
    `INSERT INTO pagamentos (oficina_id, os_id, valor, vencimento, pago_em, recebido_por, registrado_por, forma, documento, comprovante_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      auth.oficinaId,
      osId,
      valor,
      vencimento,
      jaPago ? hoje : null,
      jaPago ? auth.id : null,
      auth.id,
      jaPago ? forma : null,
      jaPago ? documento || null : null,
      jaPago ? comprovante || null : null,
    ]
  );

  await registrarAuditoria(auth.oficinaId, auth.id, "lançou pagamento", `O.S. #${ordem.numero}`, `R$ ${valor} · vence ${vencimento}`);
  res.status(201).json(resultado.rows[0]);
});

// PATCH /pagamentos/:id/pagar  { forma, documento, comprovante }
router.patch("/:id/pagar", requireAuth, requireFinanceiro, async (req, res) => {
  const auth = getAuth(req);
  const { forma, documento, comprovante } = req.body as DadosRecebimento;
  const hoje = hojeISO();

  const resultado = await db.query<PagamentoRow>(
    `UPDATE pagamentos SET pago_em = $1, recebido_por = $2, forma = $3, documento = $4, comprovante_url = $5
     WHERE id = $6 AND oficina_id = $7 RETURNING *, (SELECT numero FROM ordens_servico WHERE id = pagamentos.os_id) AS os_numero`,
    [hoje, auth.id, forma, documento || null, comprovante || null, req.params.id, auth.oficinaId]
  );
  const pagamento = resultado.rows[0];
  if (!pagamento) return res.status(404).json({ erro: "pagamento não encontrado." });

  await registrarAuditoria(
    auth.oficinaId,
    auth.id,
    "recebeu pagamento",
    `O.S. #${pagamento.os_numero}`,
    `R$ ${pagamento.valor} · ${forma}${documento ? ` · doc ${documento}` : ""}`
  );
  res.json(pagamento);
});

// PATCH /pagamentos/:id/estornar
router.patch("/:id/estornar", requireAuth, requireFinanceiro, async (req, res) => {
  const auth = getAuth(req);
  const resultado = await db.query<PagamentoRow>(
    `UPDATE pagamentos SET pago_em = NULL, recebido_por = NULL, forma = NULL, documento = NULL, comprovante_url = NULL
     WHERE id = $1 AND oficina_id = $2 RETURNING *, (SELECT numero FROM ordens_servico WHERE id = pagamentos.os_id) AS os_numero`,
    [req.params.id, auth.oficinaId]
  );
  const pagamento = resultado.rows[0];
  if (!pagamento) return res.status(404).json({ erro: "pagamento não encontrado." });

  await registrarAuditoria(auth.oficinaId, auth.id, "estornou pagamento", `O.S. #${pagamento.os_numero}`, `R$ ${pagamento.valor}`);
  res.json(pagamento);
});

export default router;
