import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /auditoria?usuarioId=5 — só admin vê
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const usuarioId = typeof req.query.usuarioId === "string" ? req.query.usuarioId : undefined;
  const params: unknown[] = [oficinaId];
  let sql = `SELECT a.*, u.nome AS usuario_nome FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id WHERE a.oficina_id = $1`;
  if (usuarioId) {
    params.push(usuarioId);
    sql += ` AND a.usuario_id = $2`;
  }
  const resultado = await db.query(sql + " ORDER BY a.criado_em DESC LIMIT 200", params);
  res.json(resultado.rows);
});

export default router;
