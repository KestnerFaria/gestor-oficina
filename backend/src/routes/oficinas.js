const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");
const { criarClienteAsaas, criarAssinaturaAsaas, cancelarAssinaturaAsaas, listarCobrancasAssinaturaAsaas } = require("../asaas");

const router = express.Router();

// GET /oficinas/minha — equipe OU cliente do portal podem ver (nome,
// telefone, endereço e logo não são dados sensíveis).
router.get("/minha", requireAuth, async (req, res) => {
  const resultado = await db.query("SELECT * FROM oficinas WHERE id = $1", [req.auth.oficinaId]);
  res.json(resultado.rows[0] || null);
});

// GET /oficinas/minha/assinatura — status do teste grátis / cobrança
router.get("/minha/assinatura", requireAuth, requireAdmin, async (req, res) => {
  const r = await db.query("SELECT status, valor, trial_termina_em FROM assinaturas WHERE oficina_id = $1", [req.auth.oficinaId]);
  res.json(r.rows[0] || null);
});

// GET /oficinas/minha/assinatura/cobrancas — lista os meses (cobranças)
// já gerados pela assinatura, com o link de pagamento (Pix/boleto/cartão)
// de cada um, direto do Asaas.
router.get("/minha/assinatura/cobrancas", requireAuth, requireAdmin, async (req, res) => {
  const assinatura = await db.query("SELECT asaas_subscription_id FROM assinaturas WHERE oficina_id = $1", [req.auth.oficinaId]);
  const subscriptionId = assinatura.rows[0]?.asaas_subscription_id;

  if (!subscriptionId) return res.json([]);

  try {
    const resultado = await listarCobrancasAssinaturaAsaas(subscriptionId);
    const cobrancas = (resultado.data || []).map((p) => ({
      id: p.id,
      vencimento: p.dueDate,
      valor: p.value,
      status: p.status, // PENDING | RECEIVED | CONFIRMED | OVERDUE | RECEIVED_IN_CASH | ...
      pagoEm: p.paymentDate || p.confirmedDate || null,
      formaPagamento: p.billingType, // BOLETO | CREDIT_CARD | PIX | UNDEFINED
      linkPagamento: p.invoiceUrl,
    })).sort((a, b) => new Date(b.vencimento) - new Date(a.vencimento));
    res.json(cobrancas);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// POST /oficinas/minha/assinatura/configurar — cria (ou recria) o
// cliente/assinatura no Asaas. Usado tanto pra tentar de novo depois de
// uma falha no cadastro quanto pra reativar uma assinatura cancelada.
router.post("/minha/assinatura/configurar", requireAuth, requireAdmin, async (req, res) => {
  const oficina = await db.query("SELECT * FROM oficinas WHERE id = $1", [req.auth.oficinaId]);
  const usuario = await db.query("SELECT nome, email, telefone FROM usuarios WHERE id = $1", [req.auth.id]);
  const of = oficina.rows[0];
  const u = usuario.rows[0];

  if (!of?.cnpj) return res.status(400).json({ erro: "cadastre o CNPJ/CPF da oficina antes de configurar a cobrança." });

  try {
    const assinaturaAtual = await db.query("SELECT status, valor, trial_termina_em FROM assinaturas WHERE oficina_id = $1", [req.auth.oficinaId]);
    const dados = assinaturaAtual.rows[0];

    // reativação (veio de cancelada) não ganha um novo período de teste —
    // o teste grátis já foi usado. cobra a partir de hoje.
    const hoje = new Date().toISOString().slice(0, 10);
    const nextDueDate = dados?.status === "cancelada" ? hoje : (dados?.trial_termina_em || hoje);

    const clienteAsaas = await criarClienteAsaas({ nome: of.nome, email: u.email, cpfCnpj: of.cnpj, telefone: of.telefone });
    const assinaturaAsaas = await criarAssinaturaAsaas({
      customerId: clienteAsaas.id,
      valor: dados?.valor || 100,
      nextDueDate,
      descricao: `Assinatura ${of.nome} — Gestor de Oficina`,
    });
    await db.query(
      `UPDATE assinaturas SET status = 'trial', asaas_customer_id = $1, asaas_subscription_id = $2, atualizado_em = NOW()
       WHERE oficina_id = $3`,
      [clienteAsaas.id, assinaturaAsaas.id, req.auth.oficinaId]
    );
    await registrarAuditoria(req.auth.oficinaId, req.auth.id, "configurou", "assinatura", dados?.status === "cancelada" ? "assinatura reativada" : "cobrança configurada com sucesso");
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// POST /oficinas/minha/assinatura/cancelar — cancela a assinatura no
// Asaas (para as cobranças futuras) e bloqueia o acesso da equipe.
router.post("/minha/assinatura/cancelar", requireAuth, requireAdmin, async (req, res) => {
  const assinatura = await db.query("SELECT asaas_subscription_id FROM assinaturas WHERE oficina_id = $1", [req.auth.oficinaId]);
  const subscriptionId = assinatura.rows[0]?.asaas_subscription_id;

  try {
    if (subscriptionId) await cancelarAssinaturaAsaas(subscriptionId);
    await db.query(
      `UPDATE assinaturas SET status = 'cancelada', atualizado_em = NOW() WHERE oficina_id = $1`,
      [req.auth.oficinaId]
    );
    await registrarAuditoria(req.auth.oficinaId, req.auth.id, "cancelou", "assinatura", "assinatura cancelada pelo administrador");
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// PUT /oficinas/minha — só admin altera
router.put("/minha", requireAuth, requireAdmin, async (req, res) => {
  const { nome, cnpj, telefone, endereco, logo } = req.body;
  const resultado = await db.query(
    `UPDATE oficinas SET nome = $1, cnpj = $2, telefone = $3, endereco = $4, logo_url = $5
     WHERE id = $6 RETURNING *`,
    [nome, cnpj || null, telefone, endereco || null, logo || null, req.auth.oficinaId]
  );
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", "dados da oficina", "cabeçalho de impressão atualizado");
  res.json(resultado.rows[0]);
});

module.exports = router;
