import { Router } from "express";
import db from "../db";
import { getAuth, requireAuth, requireEquipe, requireAdmin } from "../middleware/auth";
import { registrarAuditoria } from "../utils/auditLog";
import type { FormaPagamento, OrdemServicoRow, StatusOS } from "../types";

const router = Router();

const STATUS_LABEL: Record<StatusOS, string> = {
  orcamento: "orçamento",
  aberta: "aberta",
  em_andamento: "em andamento",
  aguardando_peca: "aguard. peça",
  concluida: "concluída",
  entregue: "entregue",
  cancelada: "cancelada",
};

function statusValido(status: unknown): status is StatusOS {
  return typeof status === "string" && status in STATUS_LABEL;
}

interface PecaEntrada {
  produtoId: number | string;
  quantidade: number | string;
}

interface NovaOrdemBody {
  clienteId?: number;
  veiculoId?: number;
  descricao?: string;
  km?: string;
  status?: StatusOS;
  servicosIds?: number[];
  pecas?: PecaEntrada[];
  sinal?: number | string;
  mecanicoId?: number | null;
}

interface FinalizarBody {
  dataSaida?: string;
  pago?: boolean;
  forma?: FormaPagamento;
  documento?: string;
  comprovante?: string;
  vencimento?: string;
}

// Busca as O.S. da oficina (ou uma só, se osId for informado) já com os
// itens. Nome e preço de cada serviço/peça vêm das tabelas de itens da
// O.S., que guardam o preço CONGELADO no dia em que a O.S. foi aberta —
// assim um reajuste no catálogo não muda O.S. antigas.
async function buscarOrdens(oficinaId: number, osId?: number | string) {
  const params: unknown[] = [oficinaId];
  let filtro = "";
  if (osId !== undefined) {
    params.push(osId);
    filtro = "AND os.id = $2";
  }
  const resultado = await db.query(
    `SELECT os.*, c.nome AS cliente_nome, v.modelo AS veiculo_modelo, v.placa AS veiculo_placa,
       COALESCE(
         (SELECT array_agg(ois.servico_id ORDER BY ois.id) FROM os_itens_servicos ois WHERE ois.os_id = os.id),
         '{}') AS servicos_ids,
       COALESCE(
         (SELECT json_agg(json_build_object('servicoId', ois.servico_id, 'nome', s.nome, 'preco', ois.preco) ORDER BY ois.id)
            FROM os_itens_servicos ois JOIN servicos s ON s.id = ois.servico_id
           WHERE ois.os_id = os.id),
         '[]') AS itens_servicos,
       COALESCE(
         (SELECT json_agg(json_build_object('produtoId', oip.produto_id, 'nome', p.nome, 'quantidade', oip.quantidade,
                                            'precoUnitario', oip.preco_unitario) ORDER BY oip.id)
            FROM os_itens_produtos oip JOIN produtos p ON p.id = oip.produto_id
           WHERE oip.os_id = os.id),
         '[]') AS pecas_utilizadas
     FROM ordens_servico os
     JOIN clientes c ON c.id = os.cliente_id
     JOIN veiculos v ON v.id = os.veiculo_id
     WHERE os.oficina_id = $1 ${filtro}
     ORDER BY os.criado_em DESC`,
    params
  );
  return resultado.rows;
}

// GET /ordens — lista as O.S. da oficina, já com serviços e peças
// (o dashboard precisa disso pra calcular "clientes sem retorno" e afins)
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  res.json(await buscarOrdens(oficinaId));
});

// GET /ordens/:id — detalhe com serviços, peças e pagamentos
router.get("/:id", requireAuth, requireEquipe, async (req, res) => {
  const { oficinaId } = getAuth(req);
  const os = await db.query<OrdemServicoRow>("SELECT * FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [
    req.params.id,
    oficinaId,
  ]);
  if (!os.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });

  const itensServicos = await db.query(
    `SELECT s.nome, ois.preco FROM os_itens_servicos ois JOIN servicos s ON s.id = ois.servico_id WHERE ois.os_id = $1`,
    [req.params.id]
  );
  const itensProdutos = await db.query(
    `SELECT p.nome, oip.quantidade, oip.preco_unitario FROM os_itens_produtos oip JOIN produtos p ON p.id = oip.produto_id WHERE oip.os_id = $1`,
    [req.params.id]
  );
  const pagamentos = await db.query("SELECT * FROM pagamentos WHERE os_id = $1 ORDER BY vencimento", [req.params.id]);

  res.json({ ...os.rows[0], servicos: itensServicos.rows, pecas: itensProdutos.rows, pagamentos: pagamentos.rows });
});

// POST /ordens — cria uma nova O.S.
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const {
    clienteId,
    veiculoId,
    descricao,
    km,
    status,
    servicosIds = [],
    pecas = [],
    sinal,
    mecanicoId,
  } = req.body as NovaOrdemBody;
  if (!clienteId || !veiculoId || !descricao) {
    return res.status(400).json({ erro: "cliente, veículo e descrição são obrigatórios." });
  }
  if (status !== undefined && !statusValido(status)) {
    return res.status(400).json({ erro: "status inválido." });
  }
  const statusInicial: StatusOS = status || "orcamento";

  // cliente e veículo precisam ser desta oficina (isolamento multi-tenant)
  const vinculo = await db.query(
    "SELECT v.id FROM veiculos v WHERE v.id = $1 AND v.cliente_id = $2 AND v.oficina_id = $3",
    [veiculoId, clienteId, auth.oficinaId]
  );
  if (!vinculo.rows[0]) return res.status(400).json({ erro: "veículo não encontrado para este cliente." });

  // normaliza as peças: ids e quantidades sempre numéricos
  const pecasNormalizadas = pecas
    .map((p) => ({ produtoId: Number(p.produtoId), quantidade: Number(p.quantidade) }))
    .filter((p) => Number.isInteger(p.produtoId) && p.quantidade > 0);

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // preços sempre buscados no servidor — nunca confiar em preço vindo do front-end
    let valorTotal = 0;
    let servicosComPreco: { id: number; preco: number }[] = [];
    if (servicosIds.length > 0) {
      const r = await client.query<{ id: number; preco: number }>(
        `SELECT id, preco FROM servicos WHERE oficina_id = $1 AND id = ANY($2::int[])`,
        [auth.oficinaId, servicosIds]
      );
      servicosComPreco = r.rows;
      valorTotal += r.rows.reduce((s, x) => s + Number(x.preco), 0);
    }

    let pecasComPreco: { produtoId: number; quantidade: number; precoUnitario: number }[] = [];
    if (pecasNormalizadas.length > 0) {
      const ids = pecasNormalizadas.map((p) => p.produtoId);
      const r = await client.query<{ id: number; preco_venda: number }>(
        `SELECT id, preco_venda FROM produtos WHERE oficina_id = $1 AND id = ANY($2::int[])`,
        [auth.oficinaId, ids]
      );
      // peças de outra oficina (ou inexistentes) são descartadas
      pecasComPreco = pecasNormalizadas.flatMap((p) => {
        const produto = r.rows.find((x) => x.id === p.produtoId);
        return produto ? [{ ...p, precoUnitario: Number(produto.preco_venda) }] : [];
      });
      valorTotal += pecasComPreco.reduce((s, p) => s + p.precoUnitario * p.quantidade, 0);
    }

    // próximo número = maior número já usado + 1. (antes era COUNT(*) + 1,
    // o que repetia um número existente depois de excluir uma O.S. e
    // travava a criação por causa do UNIQUE(oficina_id, numero))
    // O advisory lock serializa a numeração por oficina dentro da transação.
    await client.query("SELECT pg_advisory_xact_lock($1)", [auth.oficinaId]);
    const maior = await client.query<{ maior: number }>(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '\\D', '', 'g'), '')::int), 0) AS maior
       FROM ordens_servico WHERE oficina_id = $1`,
      [auth.oficinaId]
    );
    const numero = String(Number(maior.rows[0]?.maior ?? 0) + 1).padStart(4, "0");

    const osResultado = await client.query<OrdemServicoRow>(
      `INSERT INTO ordens_servico (oficina_id, numero, cliente_id, veiculo_id, mecanico_id, criado_por, status, km_entrada, descricao_problema, sinal, valor_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        auth.oficinaId,
        numero,
        clienteId,
        veiculoId,
        mecanicoId || null,
        auth.id,
        statusInicial,
        km || null,
        descricao,
        Number(sinal) || 0,
        valorTotal,
      ]
    );
    const osCriada = osResultado.rows[0]!;

    for (const s of servicosComPreco) {
      await client.query("INSERT INTO os_itens_servicos (os_id, servico_id, preco) VALUES ($1, $2, $3)", [osCriada.id, s.id, s.preco]);
    }
    // a baixa de estoque acontece sozinha via trigger do banco ao inserir aqui embaixo
    for (const p of pecasComPreco) {
      await client.query(
        "INSERT INTO os_itens_produtos (os_id, produto_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)",
        [osCriada.id, p.produtoId, p.quantidade, p.precoUnitario]
      );
    }

    await client.query("COMMIT");

    await registrarAuditoria(
      auth.oficinaId,
      auth.id,
      "criou",
      `O.S. #${numero}`,
      `status inicial: ${STATUS_LABEL[statusInicial]}${sinal ? ` · sinal R$ ${sinal}` : ""}${
        pecasComPreco.length ? ` · baixa de ${pecasComPreco.length} item(ns) do estoque` : ""
      }`
    );

    // devolve no mesmo formato da listagem (com nome e preço dos itens)
    const [criada] = await buscarOrdens(auth.oficinaId, osCriada.id);
    res.status(201).json(criada);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ erro: "falha ao criar a O.S." });
  } finally {
    client.release();
  }
});

// PATCH /ordens/:id/status  { status }
router.patch("/:id/status", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { status } = req.body as { status?: unknown };
  if (!statusValido(status)) return res.status(400).json({ erro: "status inválido." });

  const resultado = await db.query<OrdemServicoRow>(
    "UPDATE ordens_servico SET status = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [status, req.params.id, auth.oficinaId]
  );
  const os = resultado.rows[0];
  if (!os) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", `O.S. #${os.numero}`, `status: ${STATUS_LABEL[status]}`);
  res.json(os);
});

// PATCH /ordens/:id/mecanico  { mecanicoId }
router.patch("/:id/mecanico", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { mecanicoId } = req.body as { mecanicoId?: number | null };
  const resultado = await db.query<OrdemServicoRow>(
    "UPDATE ordens_servico SET mecanico_id = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [mecanicoId || null, req.params.id, auth.oficinaId]
  );
  const os = resultado.rows[0];
  if (!os) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", `O.S. #${os.numero}`, "mecânico responsável atualizado");
  res.json(os);
});

// PATCH /ordens/:id/observacoes  { observacoesMecanico }
router.patch("/:id/observacoes", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { observacoesMecanico } = req.body as { observacoesMecanico?: string };
  const resultado = await db.query<OrdemServicoRow>(
    "UPDATE ordens_servico SET observacoes_mecanico = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [observacoesMecanico, req.params.id, auth.oficinaId]
  );
  const os = resultado.rows[0];
  if (!os) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(
    auth.oficinaId,
    auth.id,
    "adicionou observação",
    `O.S. #${os.numero}`,
    (observacoesMecanico || "").slice(0, 80)
  );
  res.json(os);
});

// PATCH /ordens/:id/sinal  { sinal }
router.patch("/:id/sinal", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { sinal } = req.body as { sinal?: number | string };
  const resultado = await db.query<OrdemServicoRow>(
    "UPDATE ordens_servico SET sinal = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [Number(sinal) || 0, req.params.id, auth.oficinaId]
  );
  const os = resultado.rows[0];
  if (!os) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(auth.oficinaId, auth.id, "alterou", `O.S. #${os.numero}`, `sinal atualizado para R$ ${sinal}`);
  res.json(os);
});

// POST /ordens/:id/finalizar
// Marca a O.S. como entregue e já dá baixa no financeiro (pago ou pendente).
router.post("/:id/finalizar", requireAuth, requireEquipe, async (req, res) => {
  const auth = getAuth(req);
  const { dataSaida, pago, forma, documento, comprovante, vencimento } = req.body as FinalizarBody;
  if (!dataSaida) return res.status(400).json({ erro: "informe a data de saída." });

  const resultado = await db.query<OrdemServicoRow>("SELECT * FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [
    req.params.id,
    auth.oficinaId,
  ]);
  const os = resultado.rows[0];
  if (!os) return res.status(404).json({ erro: "O.S. não encontrada." });

  const valorRestante = Number(os.valor_total) - Number(os.sinal || 0);

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("UPDATE ordens_servico SET status = 'entregue', data_saida = $1 WHERE id = $2 AND oficina_id = $3", [
      dataSaida,
      req.params.id,
      auth.oficinaId,
    ]);

    if (valorRestante > 0) {
      await client.query(
        `INSERT INTO pagamentos (oficina_id, os_id, valor, vencimento, pago_em, recebido_por, registrado_por, forma, documento, comprovante_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          auth.oficinaId,
          req.params.id,
          valorRestante,
          vencimento || dataSaida,
          pago ? dataSaida : null,
          pago ? auth.id : null,
          auth.id,
          pago ? forma : null,
          pago ? documento || null : null,
          pago ? comprovante || null : null,
        ]
      );
    }

    await client.query("COMMIT");

    await registrarAuditoria(
      auth.oficinaId,
      auth.id,
      "finalizou",
      `O.S. #${os.numero}`,
      `saída em ${dataSaida}${valorRestante > 0 ? ` · restante R$ ${valorRestante} (${pago ? "pago" : "pendente"})` : ""}`
    );

    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ erro: "falha ao finalizar a O.S." });
  } finally {
    client.release();
  }
});

// DELETE /ordens/:id — só admin. Peças voltam ao estoque sozinhas (trigger do banco).
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const auth = getAuth(req);
  const resultado = await db.query<Pick<OrdemServicoRow, "numero">>(
    "SELECT numero FROM ordens_servico WHERE id = $1 AND oficina_id = $2",
    [req.params.id, auth.oficinaId]
  );
  const os = resultado.rows[0];
  if (!os) return res.status(404).json({ erro: "O.S. não encontrada." });

  await db.query("DELETE FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [req.params.id, auth.oficinaId]);
  await registrarAuditoria(auth.oficinaId, auth.id, "excluiu", `O.S. #${os.numero}`, "ordem de serviço removida (teste/erro)");
  res.status(204).send();
});

export default router;
