import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireAdmin } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";
import {
  criarClienteAsaas,
  criarAssinaturaAsaas,
  cancelarAssinaturaAsaas,
  listarCobrancasAssinaturaAsaas,
} from "../asaas";
import { hojeISO, paraDataISO } from "../utils/datas";
import type { AssinaturaRow, OficinaRow, UsuarioRow } from "../types";

const router = Router();

// GET /oficinas/minha — equipe OU cliente do portal podem ver (nome,
// telefone, endereço e logo não são dados sensíveis).
router.get("/minha", requireAuth, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query<OficinaRow>("SELECT * FROM oficinas WHERE id = $1", [oficinaId]);
  res.json(resultado.rows[0] || null);
});

// GET /oficinas/minha/assinatura — status do teste grátis / cobrança
router.get("/minha/assinatura", requireAuth, requireAdmin, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const r = await db.query<AssinaturaRow>(
    "SELECT status, valor, trial_termina_em FROM assinaturas WHERE oficina_id = $1",
    [oficinaId]
  );
  res.json(r.rows[0] || null);
});

// GET /oficinas/minha/assinatura/cobrancas — lista os meses (cobranças)
// já gerados pela assinatura, com o link de pagamento (Pix/boleto/cartão)
// de cada um, direto do Asaas.
router.get("/minha/assinatura/cobrancas", requireAuth, requireAdmin, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const assinatura = await db.query<Pick<AssinaturaRow, "asaas_subscription_id">>(
    "SELECT asaas_subscription_id FROM assinaturas WHERE oficina_id = $1",
    [oficinaId]
  );
  const subscriptionId = assinatura.rows[0]?.asaas_subscription_id;

  if (!subscriptionId) return res.json([]);

  try {
    const resultado = await listarCobrancasAssinaturaAsaas(subscriptionId);
    const cobrancas = (resultado.data || [])
      .map((p) => ({
        id: p.id,
        vencimento: p.dueDate,
        valor: p.value,
        status: p.status,
        pagoEm: p.paymentDate || p.confirmedDate || null,
        formaPagamento: p.billingType,
        linkPagamento: p.invoiceUrl,
      }))
      .sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime());
    res.json(cobrancas);
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message });
  }
});

// POST /oficinas/minha/assinatura/configurar — cria (ou recria) o
// cliente/assinatura no Asaas. Usado tanto pra tentar de novo depois de
// uma falha no cadastro quanto pra reativar uma assinatura cancelada.
router.post("/minha/assinatura/configurar", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const oficina = await db.query<OficinaRow>("SELECT * FROM oficinas WHERE id = $1", [auth.oficinaId]);
  // a tabela usuarios não tem coluna de telefone — o telefone usado na
  // cobrança é o da oficina (antes esta query pedia "telefone" aqui e
  // quebrava a rota inteira)
  const usuario = await db.query<Pick<UsuarioRow, "nome" | "email">>(
    "SELECT nome, email FROM usuarios WHERE id = $1",
    [auth.id]
  );
  const of = oficina.rows[0];
  const u = usuario.rows[0];

  if (!of?.cnpj) return res.status(400).json({ erro: "cadastre o CNPJ/CPF da oficina antes de configurar a cobrança." });
  if (!u) return res.status(404).json({ erro: "usuário não encontrado." });

  try {
    const assinaturaAtual = await db.query<AssinaturaRow>(
      "SELECT status, valor, trial_termina_em FROM assinaturas WHERE oficina_id = $1",
      [auth.oficinaId]
    );
    const dados = assinaturaAtual.rows[0];

    // reativação (veio de cancelada) não ganha um novo período de teste —
    // o teste grátis já foi usado. cobra a partir de hoje.
    // (a data vira "AAAA-MM-DD" — o pg devolve DATE como objeto Date, e
    // uma data de teste já vencida não pode ir como 1ª cobrança)
    const hoje = hojeISO();
    const trialTermina = dados?.trial_termina_em ? paraDataISO(dados.trial_termina_em) : null;
    const nextDueDate =
      dados?.status === "cancelada" || !trialTermina || trialTermina < hoje ? hoje : trialTermina;

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
      [clienteAsaas.id, assinaturaAsaas.id, auth.oficinaId]
    );
    await registrarAuditoria(
      auth.oficinaId,
      auth.id,
      "configurou",
      "assinatura",
      dados?.status === "cancelada" ? "assinatura reativada" : "cobrança configurada com sucesso"
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message });
  }
});

// POST /oficinas/minha/assinatura/cancelar — cancela a assinatura no
// Asaas (para as cobranças futuras) e bloqueia o acesso da equipe.
router.post("/minha/assinatura/cancelar", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const assinatura = await db.query<Pick<AssinaturaRow, "asaas_subscription_id">>(
    "SELECT asaas_subscription_id FROM assinaturas WHERE oficina_id = $1",
    [auth.oficinaId]
  );
  const subscriptionId = assinatura.rows[0]?.asaas_subscription_id;

  try {
    if (subscriptionId) await cancelarAssinaturaAsaas(subscriptionId);
    await db.query(`UPDATE assinaturas SET status = 'cancelada', atualizado_em = NOW() WHERE oficina_id = $1`, [
      auth.oficinaId,
    ]);
    await registrarAuditoria(auth.oficinaId, auth.id, "cancelou", "assinatura", "assinatura cancelada pelo administrador");
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message });
  }
});

// PUT /oficinas/minha — só admin altera
router.put("/minha", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const { nome, cnpj, telefone, endereco, logo } = req.body as {
    nome?: string;
    cnpj?: string;
    telefone?: string;
    endereco?: string;
    logo?: string;
  };
  const resultado = await db.query<OficinaRow>(
    `UPDATE oficinas SET nome = $1, cnpj = $2, telefone = $3, endereco = $4, logo_url = $5
     WHERE id = $6 RETURNING *`,
    [nome, cnpj || null, telefone, endereco || null, logo || null, auth.oficinaId]
  );
  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", "dados da oficina", "cabeçalho de impressão atualizado");
  res.json(resultado.rows[0]);
});

export default router;
