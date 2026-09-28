const jwt = require("jsonwebtoken");
const db = require("../db");

// Decodifica o token e anexa os dados do usuário logado em req.auth.
// Todo endpoint protegido usa isso — nunca confie em oficina_id vindo
// do corpo da requisição, sempre use req.auth.oficinaId.
//
// Também bloqueia o acesso da equipe (não do portal do cliente) se a
// assinatura da oficina estiver atrasada ou cancelada — é isso que
// torna o período de teste grátis "de verdade": passados os 10 dias
// sem pagamento, o sistema para de responder até regularizar.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: "token não enviado" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ erro: "token inválido ou expirado" });
  }
  req.auth = payload;

  // as rotas de "dados da oficina" (que incluem ver/cancelar/reativar a
  // assinatura) NUNCA são bloqueadas — senão uma oficina cancelada ficaria
  // presa, sem conseguir nem ver a própria tela pra reativar.
  const rotaDeGestaoDaOficina = req.originalUrl.startsWith("/oficinas/minha");

  if (payload.tipo === "equipe" && !rotaDeGestaoDaOficina) {
    try {
      const r = await db.query("SELECT status FROM assinaturas WHERE oficina_id = $1", [payload.oficinaId]);
      const status = r.rows[0]?.status;
      if (status === "atrasada" || status === "cancelada") {
        const mensagem = status === "cancelada"
          ? "a assinatura desta oficina foi cancelada. reative em \"dados da oficina\" para continuar usando o sistema."
          : "a assinatura desta oficina está atrasada. regularize o pagamento para continuar usando o sistema.";
        return res.status(402).json({ erro: "assinatura_pendente", mensagem, status });
      }
    } catch (e) {
      console.error("falha ao verificar assinatura:", e.message);
      // se der erro na checagem, deixa passar — melhor um bug de cobrança
      // temporário do que travar o sistema inteiro do cliente por engano
    }
  }

  next();
}

// Só deixa passar se for alguém da equipe (admin, atendente ou mecânico)
function requireEquipe(req, res, next) {
  if (req.auth?.tipo !== "equipe") return res.status(403).json({ erro: "acesso restrito à equipe da oficina" });
  next();
}

// Só deixa passar se for admin da oficina
function requireAdmin(req, res, next) {
  if (req.auth?.tipo !== "equipe" || req.auth?.perfil !== "admin") {
    return res.status(403).json({ erro: "ação restrita ao administrador da oficina" });
  }
  next();
}

// Admin ou atendente (usado nas rotas de financeiro)
function requireFinanceiro(req, res, next) {
  if (req.auth?.tipo !== "equipe" || !["admin", "atendente"].includes(req.auth?.perfil)) {
    return res.status(403).json({ erro: "acesso restrito a admin ou atendente" });
  }
  next();
}

// Só deixa passar se for um cliente logado no portal
function requireCliente(req, res, next) {
  if (req.auth?.tipo !== "cliente") return res.status(403).json({ erro: "acesso restrito ao portal do cliente" });
  next();
}

module.exports = { requireAuth, requireEquipe, requireAdmin, requireFinanceiro, requireCliente };
