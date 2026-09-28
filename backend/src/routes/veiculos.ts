import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireEquipe } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";

const router = Router();

interface VeiculoRow {
  id: number;
  oficina_id: number;
  cliente_id: number;
  placa: string;
  marca: string | null;
  modelo: string;
  ano: number | null;
  cor: string | null;
  km_atual: number | null;
}

interface VeiculoBody {
  clienteId?: number;
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  cor?: string;
  kmAtual?: number;
}

// GET /veiculos?clienteId=123 — lista veículos da oficina (opcionalmente filtrado por cliente)
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const clienteId = typeof req.query.clienteId === "string" ? req.query.clienteId : undefined;
  const params: unknown[] = [oficinaId];
  let sql = "SELECT * FROM veiculos WHERE oficina_id = $1";
  if (clienteId) {
    params.push(clienteId);
    sql += " AND cliente_id = $2";
  }
  const resultado = await db.query<VeiculoRow>(sql + " ORDER BY id", params);
  res.json(resultado.rows);
});

// POST /veiculos
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { clienteId, placa, marca, modelo, ano, cor, kmAtual } = req.body as VeiculoBody;
  if (!clienteId || !placa || !modelo) return res.status(400).json({ erro: "cliente, placa e modelo são obrigatórios." });

  // o cliente precisa ser desta oficina — sem isso, alguém poderia
  // vincular um veículo a um cliente de outra oficina
  const cliente = await db.query("SELECT id FROM clientes WHERE id = $1 AND oficina_id = $2", [clienteId, auth.oficinaId]);
  if (!cliente.rows[0]) return res.status(404).json({ erro: "cliente não encontrado." });

  const resultado = await db.query<VeiculoRow>(
    `INSERT INTO veiculos (oficina_id, cliente_id, placa, marca, modelo, ano, cor, km_atual)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [auth.oficinaId, clienteId, placa.toUpperCase(), marca || null, modelo, ano || null, cor || null, kmAtual || null]
  );

  await registrarAuditoria(auth.oficinaId, auth.id, "cadastrou", `veículo ${placa}`, `${marca || ""} ${modelo}`.trim());
  res.status(201).json(resultado.rows[0]);
});

// PUT /veiculos/:id
router.put("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { placa, marca, modelo, ano, cor, kmAtual } = req.body as VeiculoBody;
  const resultado = await db.query<VeiculoRow>(
    `UPDATE veiculos SET placa = $1, marca = $2, modelo = $3, ano = $4, cor = $5, km_atual = $6
     WHERE id = $7 AND oficina_id = $8 RETURNING *`,
    [placa?.toUpperCase(), marca, modelo, ano, cor, kmAtual, req.params.id, auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "veículo não encontrado." });

  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", `veículo ${placa}`, `${marca || ""} ${modelo}`.trim());
  res.json(resultado.rows[0]);
});

// DELETE /veiculos/:id
router.delete("/:id", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const atual = await db.query<Pick<VeiculoRow, "placa" | "marca" | "modelo">>(
    "SELECT placa, marca, modelo FROM veiculos WHERE id = $1 AND oficina_id = $2",
    [req.params.id, auth.oficinaId]
  );
  const veiculo = atual.rows[0];
  if (!veiculo) return res.status(404).json({ erro: "veículo não encontrado." });

  await db.query("DELETE FROM veiculos WHERE id = $1 AND oficina_id = $2", [req.params.id, auth.oficinaId]);
  await registrarAuditoria(auth.oficinaId, auth.id, "excluiu", `veículo ${veiculo.placa}`, `${veiculo.marca || ""} ${veiculo.modelo}`.trim());
  res.status(204).send();
});

export default router;
