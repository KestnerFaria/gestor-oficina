import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../db";
import { getAuth, requireAuth, requireEquipe } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";
import type { ClienteRow } from "../types";

const router = Router();
const SALT_ROUNDS = 10;

type ClientePublico = Omit<ClienteRow, "oficina_id" | "senha_hash">;

interface ClienteBody {
  nome?: string;
  telefone?: string;
  cpf?: string;
  endereco?: string;
  email?: string;
  senha?: string;
}

// GET /clientes — lista os clientes da oficina logada
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query<ClientePublico>(
    "SELECT id, nome, telefone, cpf, endereco, email FROM clientes WHERE oficina_id = $1 ORDER BY nome",
    [oficinaId]
  );
  res.json(resultado.rows);
});

// POST /clientes — cadastra cliente (email/senha são opcionais)
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { nome, telefone, cpf, endereco, email, senha } = req.body as ClienteBody;
  if (!nome || !telefone) return res.status(400).json({ erro: "nome e telefone são obrigatórios." });

  const senhaHash = senha ? await bcrypt.hash(senha, SALT_ROUNDS) : null;
  const resultado = await db.query<ClientePublico>(
    `INSERT INTO clientes (oficina_id, nome, telefone, cpf, endereco, email, senha_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, nome, telefone, cpf, endereco, email`,
    [auth.oficinaId, nome, telefone, cpf || null, endereco || null, email || null, senhaHash]
  );

  await registrarAuditoria(auth.oficinaId, auth.id, "cadastrou", `cliente ${nome}`, email ? `acesso: ${email}` : "sem acesso ao portal");
  res.status(201).json(resultado.rows[0]);
});

// PUT /clientes/:id — edita dados; senha só é alterada se enviada
router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { nome, telefone, cpf, endereco, email, senha } = req.body as ClienteBody;

  const atual = await db.query<ClienteRow>("SELECT * FROM clientes WHERE id = $1 AND oficina_id = $2", [
    req.params.id,
    auth.oficinaId,
  ]);
  const cliente = atual.rows[0];
  if (!cliente) return res.status(404).json({ erro: "cliente não encontrado." });

  const senhaHash = senha ? await bcrypt.hash(senha, SALT_ROUNDS) : cliente.senha_hash;

  const resultado = await db.query<ClientePublico>(
    `UPDATE clientes SET nome = $1, telefone = $2, cpf = $3, endereco = $4, email = $5, senha_hash = $6
     WHERE id = $7 AND oficina_id = $8
     RETURNING id, nome, telefone, cpf, endereco, email`,
    [nome, telefone, cpf || null, endereco || null, email || null, senhaHash, req.params.id, auth.oficinaId]
  );

  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", `cliente ${nome}`, "dados cadastrais/acesso");
  res.json(resultado.rows[0]);
});

// DELETE /clientes/:id — remove cliente e seus veículos (cascade no schema)
router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const atual = await db.query<Pick<ClienteRow, "nome">>("SELECT nome FROM clientes WHERE id = $1 AND oficina_id = $2", [
    req.params.id,
    auth.oficinaId,
  ]);
  const cliente = atual.rows[0];
  if (!cliente) return res.status(404).json({ erro: "cliente não encontrado." });

  await db.query("DELETE FROM clientes WHERE id = $1 AND oficina_id = $2", [req.params.id, auth.oficinaId]);
  await registrarAuditoria(auth.oficinaId, auth.id, "excluiu", `cliente ${cliente.nome}`, "removido junto com seus veículos");
  res.status(204).send();
});

export default router;
