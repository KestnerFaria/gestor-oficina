import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../db";
import { getAuth, requireAuth, requireEquipe, requireAdmin } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";
import type { CountRow, PerfilUsuario, UsuarioRow } from "../types";

const router = Router();
const LIMITE_ACESSOS = 3;
const SALT_ROUNDS = 10;
const PERFIS_VALIDOS: PerfilUsuario[] = ["admin", "atendente", "mecanico"];

// GET /equipe — qualquer membro da equipe pode ver os nomes (ex: escolher
// o mecânico responsável). Só o admin pode adicionar/remover (abaixo).
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query<Pick<UsuarioRow, "id" | "nome" | "email" | "perfil">>(
    "SELECT id, nome, email, perfil FROM usuarios WHERE oficina_id = $1 AND ativo = TRUE ORDER BY id",
    [oficinaId]
  );
  res.json(resultado.rows);
});

// POST /equipe — adiciona um novo acesso, respeitando o limite
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const { nome, email, senha, perfil } = req.body as {
    nome?: string;
    email?: string;
    senha?: string;
    perfil?: PerfilUsuario;
  };
  if (!nome || !email || !senha) return res.status(400).json({ erro: "preencha nome, email e senha." });
  if (perfil && !PERFIS_VALIDOS.includes(perfil)) return res.status(400).json({ erro: "perfil inválido." });

  const contagem = await db.query<CountRow>(
    "SELECT COUNT(*) FROM usuarios WHERE oficina_id = $1 AND ativo = TRUE",
    [auth.oficinaId]
  );
  if (Number(contagem.rows[0]?.count) >= LIMITE_ACESSOS) {
    return res.status(400).json({ erro: `limite de ${LIMITE_ACESSOS} acessos por oficina atingido.` });
  }

  const existente = await db.query("SELECT id FROM usuarios WHERE email = $1", [email]);
  if (existente.rows.length > 0) return res.status(409).json({ erro: "este email já está em uso." });

  const perfilFinal = perfil || "atendente";
  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const resultado = await db.query<Pick<UsuarioRow, "id" | "nome" | "email" | "perfil">>(
    `INSERT INTO usuarios (oficina_id, nome, email, senha_hash, perfil)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, email, perfil`,
    [auth.oficinaId, nome, email, senhaHash, perfilFinal]
  );

  await registrarAuditoria(auth.oficinaId, auth.id, "cadastrou", `acesso ${nome}`, `perfil: ${perfilFinal}`);
  res.status(201).json(resultado.rows[0]);
});

// DELETE /equipe/:id — remove um acesso (não deixa remover o último admin)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const alvo = await db.query<UsuarioRow>("SELECT * FROM usuarios WHERE id = $1 AND oficina_id = $2", [
    req.params.id,
    auth.oficinaId,
  ]);
  const usuario = alvo.rows[0];
  if (!usuario) return res.status(404).json({ erro: "acesso não encontrado." });

  if (usuario.perfil === "admin") {
    const admins = await db.query<CountRow>(
      "SELECT COUNT(*) FROM usuarios WHERE oficina_id = $1 AND perfil = 'admin' AND ativo = TRUE",
      [auth.oficinaId]
    );
    if (Number(admins.rows[0]?.count) <= 1) {
      return res.status(400).json({ erro: "não é possível remover o último administrador da oficina." });
    }
  }

  await db.query("UPDATE usuarios SET ativo = FALSE WHERE id = $1 AND oficina_id = $2", [req.params.id, auth.oficinaId]);
  await registrarAuditoria(auth.oficinaId, auth.id, "excluiu", `acesso ${usuario.nome}`, `perfil: ${usuario.perfil}`);
  res.status(204).send();
});

export default router;
