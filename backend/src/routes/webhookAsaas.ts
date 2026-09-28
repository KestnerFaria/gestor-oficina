import { Router } from "express";
import db from "../db";
import { registrarAuditoria } from "../utils/auditLog";
import type { AsaasPayment } from "../asaas";
import type { StatusAssinatura } from "../types";

const router = Router();

// Eventos de cobrança que nos interessam e o status que cada um gera
// na nossa tabela de assinaturas.
const MAPA_EVENTOS: Record<string, StatusAssinatura> = {
  PAYMENT_CONFIRMED: "ativa",
  PAYMENT_RECEIVED: "ativa",
  PAYMENT_OVERDUE: "atrasada",
  PAYMENT_DELETED: "cancelada",
  PAYMENT_REFUNDED: "atrasada",
};

interface WebhookBody {
  event?: string;
  payment?: Partial<AsaasPayment>;
}

// POST /webhooks/asaas
// Valida o token configurado no painel do Asaas (header asaas-access-token)
// antes de processar qualquer coisa — sem isso, qualquer um na internet
// poderia mandar um POST fingindo ser um pagamento confirmado.
router.post("/asaas", async (req, res) => {
  const tokenRecebido = req.headers["asaas-access-token"];
  if (process.env.ASAAS_WEBHOOK_TOKEN && tokenRecebido !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return res.status(401).json({ erro: "token de webhook inválido." });
  }

  const { event, payment } = (req.body || {}) as WebhookBody;
  const novoStatus = event ? MAPA_EVENTOS[event] : undefined;

  // responde rápido — o Asaas espera 2xx e reenvia se demorar ou falhar
  res.status(200).json({ ok: true });

  if (!novoStatus || !payment?.subscription) return; // evento que não usamos, ou não veio de uma assinatura

  try {
    const resultado = await db.query<{ oficina_id: number; status: StatusAssinatura }>(
      `UPDATE assinaturas SET status = $1, atualizado_em = NOW()
       WHERE asaas_subscription_id = $2 RETURNING oficina_id, status`,
      [novoStatus, payment.subscription]
    );
    const linha = resultado.rows[0];
    if (linha) {
      await registrarAuditoria(linha.oficina_id, null, "atualizou assinatura", "cobrança", `evento ${event} · status: ${novoStatus}`);
    }
  } catch (e) {
    console.error("falha ao processar webhook do Asaas:", (e as Error).message);
  }
});

export default router;
