import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireEquipe } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";

const router = Router();

// GET /alertas-whatsapp — usado pro dashboard mostrar "alerta enviado em"
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const resultado = await db.query("SELECT * FROM alertas_whatsapp WHERE oficina_id = $1", [oficinaId]);
  res.json(resultado.rows);
});

// POST /alertas-whatsapp — registra o clique em "chamar no whatsapp"
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { clienteId, veiculoId } = req.body as { clienteId?: number; veiculoId?: number };

  // cliente e veículo precisam ser desta oficina (isolamento multi-tenant)
  const vinculo = await db.query<{ nome: string }>(
    `SELECT c.nome FROM veiculos v JOIN clientes c ON c.id = v.cliente_id
     WHERE v.id = $1 AND c.id = $2 AND v.oficina_id = $3`,
    [veiculoId, clienteId, auth.oficinaId]
  );
  const cliente = vinculo.rows[0];
  if (!cliente) return res.status(404).json({ erro: "cliente ou veículo não encontrado." });

  const resultado = await db.query(
    `INSERT INTO alertas_whatsapp (oficina_id, cliente_id, veiculo_id, enviado_por)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [auth.oficinaId, clienteId, veiculoId, auth.id]
  );

  await registrarAuditoria(auth.oficinaId, auth.id, "enviou alerta", cliente.nome, "lembrete de troca de óleo via whatsapp");
  res.status(201).json(resultado.rows[0]);
});

export default router;
