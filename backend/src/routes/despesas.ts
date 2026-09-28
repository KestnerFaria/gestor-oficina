import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireAdmin } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";

const router = Router();

interface DespesaRow {
  id: number;
  oficina_id: number;
  descricao: string;
  categoria: string;
  valor: number;
  data_vencimento: Date | null;
  fixa: boolean;
}

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query<DespesaRow>("SELECT * FROM despesas WHERE oficina_id = $1 ORDER BY data_vencimento", [oficinaId]);
  res.json(resultado.rows);
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const { descricao, categoria, valor, dataVencimento, fixa } = req.body as {
    descricao?: string;
    categoria?: string;
    valor?: number | string;
    dataVencimento?: string;
    fixa?: boolean;
  };
  if (!descricao || !valor) return res.status(400).json({ erro: "descrição e valor são obrigatórios." });

  const categoriaFinal = categoria || "outros";
  const resultado = await db.query<DespesaRow>(
    `INSERT INTO despesas (oficina_id, descricao, categoria, valor, data_vencimento, fixa, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [auth.oficinaId, descricao, categoriaFinal, valor, dataVencimento || null, !!fixa, auth.id]
  );

  await registrarAuditoria(
    auth.oficinaId,
    auth.id,
    "lançou despesa",
    descricao,
    `R$ ${valor} · ${categoriaFinal}${fixa ? " · fixa mensal" : ""}`
  );
  res.status(201).json(resultado.rows[0]);
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const atual = await db.query<Pick<DespesaRow, "descricao" | "valor">>(
    "SELECT descricao, valor FROM despesas WHERE id = $1 AND oficina_id = $2",
    [req.params.id, auth.oficinaId]
  );
  const despesa = atual.rows[0];
  if (!despesa) return res.status(404).json({ erro: "despesa não encontrada." });

  await db.query("DELETE FROM despesas WHERE id = $1 AND oficina_id = $2", [req.params.id, auth.oficinaId]);
  await registrarAuditoria(auth.oficinaId, auth.id, "excluiu despesa", despesa.descricao, `R$ ${despesa.valor}`);
  res.status(204).send();
});

export default router;
