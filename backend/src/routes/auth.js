const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { registrarAuditoria } = require("../utils/auditLog");
const { criarClienteAsaas, criarAssinaturaAsaas } = require("../asaas");

const router = express.Router();
const SALT_ROUNDS = 10;
const DIAS_TESTE_GRATIS = 10;
const VALOR_MENSALIDADE = Number(process.env.VALOR_MENSALIDADE || 100);

function gerarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "12h" });
}

function dataDaqui(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// POST /auth/cadastrar-oficina
// Cria a oficina + o primeiro usuário (admin), já com 10 dias de teste
// grátis configurados no Asaas, e retorna logado.
// ------------------------------------------------------------
router.post("/cadastrar-oficina", async (req, res) => {
  const { nomeOficina, cnpj, telefone, endereco, logo, nomeUsuario, email, senha } = req.body;

  if (!nomeOficina || !telefone || !nomeUsuario || !email || !senha) {
    return res.status(400).json({ erro: "preencha todos os campos obrigatórios." });
  }
  if (!cnpj) {
    return res.status(400).json({ erro: "informe o CNPJ (ou CPF, se for MEI) — é necessário para configurar a cobrança após o período de teste." });
  }

  const existente = await db.query("SELECT id FROM usuarios WHERE email = $1", [email]);
  if (existente.rows.length > 0) {
    return res.status(409).json({ erro: "este email já está cadastrado." });
  }

  const client = await db.pool.connect();
  let oficinaId, usuarioCriado;
  try {
    await client.query("BEGIN");

    const oficina = await client.query(
      `INSERT INTO oficinas (nome, cnpj, telefone, endereco, logo_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, cnpj, telefone, endereco, logo_url`,
      [nomeOficina, cnpj, telefone, endereco || null, logo || null]
    );
    oficinaId = oficina.rows[0].id;

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    const usuario = await client.query(
      `INSERT INTO usuarios (oficina_id, nome, email, senha_hash, perfil)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id, nome, email, perfil`,
      [oficinaId, nomeUsuario, email, senhaHash]
    );
    usuarioCriado = usuario.rows[0];

    // linha de assinatura já criada, mesmo que o Asaas falhe abaixo —
    // assim dá pra tentar de novo depois pela tela "dados da oficina"
    await client.query(
      `INSERT INTO assinaturas (oficina_id, status, valor, trial_termina_em)
       VALUES ($1, 'pendente_configuracao', $2, $3)`,
      [oficinaId, VALOR_MENSALIDADE, dataDaqui(DIAS_TESTE_GRATIS)]
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ erro: "falha ao cadastrar oficina." });
  } finally {
    client.release();
  }

  await registrarAuditoria(oficinaId, usuarioCriado.id, "criou", `oficina ${nomeOficina}`, "conta criada");

  // tenta configurar a cobrança no Asaas — se falhar (ex: CNPJ inválido),
  // a oficina já foi criada e funciona normalmente; o admin pode configurar
  // de novo depois em "dados da oficina" sem perder nada.
  try {
    const clienteAsaas = await criarClienteAsaas({ nome: nomeOficina, email, cpfCnpj: cnpj, telefone });
    const assinaturaAsaas = await criarAssinaturaAsaas({
      customerId: clienteAsaas.id,
      valor: VALOR_MENSALIDADE,
      nextDueDate: dataDaqui(DIAS_TESTE_GRATIS),
      descricao: `Assinatura ${nomeOficina} — Gestor de Oficina`,
    });
    await db.query(
      `UPDATE assinaturas SET status = 'trial', asaas_customer_id = $1, asaas_subscription_id = $2, atualizado_em = NOW()
       WHERE oficina_id = $3`,
      [clienteAsaas.id, assinaturaAsaas.id, oficinaId]
    );
    await registrarAuditoria(oficinaId, usuarioCriado.id, "configurou", "assinatura", `${DIAS_TESTE_GRATIS} dias de teste grátis iniciados`);
  } catch (e) {
    console.error("falha ao configurar assinatura no Asaas:", e.message);
    // não derruba o cadastro — só fica marcado como pendente_configuracao
  }

  const token = gerarToken({ tipo: "equipe", id: usuarioCriado.id, oficinaId, perfil: "admin" });
  res.status(201).json({ token, usuario: usuarioCriado, oficina: { id: oficinaId, nome: nomeOficina, cnpj, telefone, endereco, logo_url: logo } });
});

// ------------------------------------------------------------
// POST /auth/login-equipe  { email, senha }
// ------------------------------------------------------------
router.post("/login-equipe", async (req, res) => {
  const { email, senha } = req.body;
  const resultado = await db.query(
    "SELECT id, oficina_id, nome, email, senha_hash, perfil FROM usuarios WHERE email = $1 AND ativo = TRUE",
    [email]
  );
  const usuario = resultado.rows[0];
  if (!usuario) return res.status(401).json({ erro: "email ou senha incorretos." });

  const senhaOk = await bcrypt.compare(senha || "", usuario.senha_hash);
  if (!senhaOk) return res.status(401).json({ erro: "email ou senha incorretos." });

  const token = gerarToken({ tipo: "equipe", id: usuario.id, oficinaId: usuario.oficina_id, perfil: usuario.perfil });
  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, oficinaId: usuario.oficina_id },
  });
});

// ------------------------------------------------------------
// POST /auth/login-cliente  { email, senha }
// ------------------------------------------------------------
router.post("/login-cliente", async (req, res) => {
  const { email, senha } = req.body;
  const resultado = await db.query(
    "SELECT id, oficina_id, nome, email, senha_hash FROM clientes WHERE email = $1",
    [email]
  );
  const cliente = resultado.rows[0];
  if (!cliente || !cliente.senha_hash) return res.status(401).json({ erro: "email ou senha incorretos." });

  const senhaOk = await bcrypt.compare(senha || "", cliente.senha_hash);
  if (!senhaOk) return res.status(401).json({ erro: "email ou senha incorretos." });

  const token = gerarToken({ tipo: "cliente", id: cliente.id, oficinaId: cliente.oficina_id });
  res.json({
    token,
    cliente: { id: cliente.id, nome: cliente.nome, email: cliente.email, oficinaId: cliente.oficina_id },
  });
});

module.exports = router;
