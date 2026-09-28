import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireEquipe } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";

const router = Router();

interface ServicoRow {
  id: number;
  oficina_id: number;
  nome: string;
  preco: number;
  ativo: boolean;
}

interface ServicoBody {
  nome?: string;
  preco?: number | string;
}

router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query<ServicoRow>(
    "SELECT * FROM servicos WHERE oficina_id = $1 AND ativo = TRUE ORDER BY nome",
    [oficinaId]
  );
  res.json(resultado.rows);
});

router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { nome, preco } = req.body as ServicoBody;
  if (!nome) return res.status(400).json({ erro: "nome é obrigatório." });

  const resultado = await db.query<ServicoRow>(
    "INSERT INTO servicos (oficina_id, nome, preco) VALUES ($1, $2, $3) RETURNING *",
    [auth.oficinaId, nome, Number(preco) || 0]
  );
  await registrarAuditoria(auth.oficinaId, auth.id, "cadastrou", `serviço ${nome}`, `R$ ${preco}`);
  res.status(201).json(resultado.rows[0]);
});

router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { nome, preco } = req.body as ServicoBody;
  const resultado = await db.query<ServicoRow>(
    "UPDATE servicos SET nome = $1, preco = $2 WHERE id = $3 AND oficina_id = $4 RETURNING *",
    [nome, Number(preco) || 0, req.params.id, auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "serviço não encontrado." });
  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", `serviço ${nome}`, `R$ ${preco}`);
  res.json(resultado.rows[0]);
});

router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const atual = await db.query<Pick<ServicoRow, "nome">>("SELECT nome FROM servicos WHERE id = $1 AND oficina_id = $2", [
    req.params.id,
    auth.oficinaId,
  ]);
  const servico = atual.rows[0];
  if (!servico) return res.status(404).json({ erro: "serviço não encontrado." });

  await db.query("UPDATE servicos SET ativo = FALSE WHERE id = $1 AND oficina_id = $2", [req.params.id, auth.oficinaId]);
  await registrarAuditoria(auth.oficinaId, auth.id, "excluiu", `serviço ${servico.nome}`, "removido do catálogo");
  res.status(204).send();
});

export default router;
