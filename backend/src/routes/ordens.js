const express = require("express");
const db = require("../db");
const { requireAuth, requireEquipe, requireAdmin } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditLog");

const router = express.Router();

const STATUS_LABEL = {
  orcamento: "orçamento", aberta: "aberta", em_andamento: "em andamento",
  aguardando_peca: "aguard. peça", concluida: "concluída", entregue: "entregue", cancelada: "cancelada",
};

// GET /ordens — lista as O.S. da oficina, já com serviços e peças agregados
// (o dashboard precisa disso pra calcular "clientes sem retorno" e afins)
router.get("/", requireAuth, requireEquipe, async (req, res) => {
  const resultado = await db.query(
    `SELECT os.*, c.nome AS cliente_nome, v.modelo AS veiculo_modelo, v.placa AS veiculo_placa,
       COALESCE(array_agg(DISTINCT ois.servico_id) FILTER (WHERE ois.servico_id IS NOT NULL), '{}') AS servicos_ids,
       COALESCE(json_agg(DISTINCT jsonb_build_object('produtoId', oip.produto_id, 'quantidade', oip.quantidade))
         FILTER (WHERE oip.produto_id IS NOT NULL), '[]') AS pecas_utilizadas
     FROM ordens_servico os
     JOIN clientes c ON c.id = os.cliente_id
     JOIN veiculos v ON v.id = os.veiculo_id
     LEFT JOIN os_itens_servicos ois ON ois.os_id = os.id
     LEFT JOIN os_itens_produtos oip ON oip.os_id = os.id
     WHERE os.oficina_id = $1
     GROUP BY os.id, c.nome, v.modelo, v.placa
     ORDER BY os.criado_em DESC`,
    [req.auth.oficinaId]
  );
  res.json(resultado.rows);
});

// GET /ordens/:id — detalhe com serviços, peças e pagamentos
router.get("/:id", requireAuth, requireEquipe, async (req, res) => {
  const os = await db.query("SELECT * FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
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
// body: { clienteId, veiculoId, descricao, km, status, servicosIds: [], pecas: [{produtoId, quantidade}], sinal, mecanicoId }
router.post("/", requireAuth, requireEquipe, async (req, res) => {
  const { clienteId, veiculoId, descricao, km, status, servicosIds = [], pecas = [], sinal, mecanicoId } = req.body;
  if (!clienteId || !veiculoId || !descricao) {
    return res.status(400).json({ erro: "cliente, veículo e descrição são obrigatórios." });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // preços sempre buscados no servidor — nunca confiar em preço vindo do front-end
    let valorTotal = 0;
    let servicosComPreco = [];
    if (servicosIds.length > 0) {
      const r = await client.query(
        `SELECT id, preco FROM servicos WHERE oficina_id = $1 AND id = ANY($2::int[])`,
        [req.auth.oficinaId, servicosIds]
      );
      servicosComPreco = r.rows;
      valorTotal += r.rows.reduce((s, x) => s + Number(x.preco), 0);
    }

    let pecasComPreco = [];
    if (pecas.length > 0) {
      const ids = pecas.map((p) => p.produtoId);
      const r = await client.query(
        `SELECT id, preco_venda, quantidade_estoque FROM produtos WHERE oficina_id = $1 AND id = ANY($2::int[])`,
        [req.auth.oficinaId, ids]
      );
      pecasComPreco = pecas.map((p) => {
        const produto = r.rows.find((x) => x.id === p.produtoId);
        return { ...p, precoUnitario: produto ? Number(produto.preco_venda) : 0 };
      });
      valorTotal += pecasComPreco.reduce((s, p) => s + p.precoUnitario * p.quantidade, 0);
    }

    const contagem = await client.query("SELECT COUNT(*) FROM ordens_servico WHERE oficina_id = $1", [req.auth.oficinaId]);
    const numero = String(Number(contagem.rows[0].count) + 1).padStart(4, "0");

    const osResultado = await client.query(
      `INSERT INTO ordens_servico (oficina_id, numero, cliente_id, veiculo_id, mecanico_id, criado_por, status, km_entrada, descricao_problema, sinal, valor_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.auth.oficinaId, numero, clienteId, veiculoId, mecanicoId || null, req.auth.id, status || "orcamento", km || null, descricao, Number(sinal) || 0, valorTotal]
    );
    const osId = osResultado.rows[0].id;

    for (const s of servicosComPreco) {
      await client.query("INSERT INTO os_itens_servicos (os_id, servico_id, preco) VALUES ($1, $2, $3)", [osId, s.id, s.preco]);
    }
    // a baixa de estoque acontece sozinha via trigger do banco ao inserir aqui embaixo
    for (const p of pecasComPreco) {
      await client.query(
        "INSERT INTO os_itens_produtos (os_id, produto_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)",
        [osId, p.produtoId, p.quantidade, p.precoUnitario]
      );
    }

    await client.query("COMMIT");

    await registrarAuditoria(
      req.auth.oficinaId, req.auth.id, "criou", `O.S. #${numero}`,
      `status inicial: ${STATUS_LABEL[status || "orcamento"]}${sinal ? ` · sinal R$ ${sinal}` : ""}${pecas.length ? ` · baixa de ${pecas.length} item(ns) do estoque` : ""}`
    );

    res.status(201).json({
      ...osResultado.rows[0],
      servicos_ids: servicosComPreco.map((s) => s.id),
      pecas_utilizadas: pecasComPreco.map((p) => ({ produtoId: p.produtoId, quantidade: p.quantidade })),
    });
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
  const { status } = req.body;
  const resultado = await db.query(
    "UPDATE ordens_servico SET status = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [status, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", `O.S. #${resultado.rows[0].numero}`, `status: ${STATUS_LABEL[status]}`);
  res.json(resultado.rows[0]);
});

// PATCH /ordens/:id/mecanico  { mecanicoId }
router.patch("/:id/mecanico", requireAuth, requireEquipe, async (req, res) => {
  const { mecanicoId } = req.body;
  const resultado = await db.query(
    "UPDATE ordens_servico SET mecanico_id = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [mecanicoId || null, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", `O.S. #${resultado.rows[0].numero}`, "mecânico responsável atualizado");
  res.json(resultado.rows[0]);
});

// PATCH /ordens/:id/observacoes  { observacoesMecanico }
router.patch("/:id/observacoes", requireAuth, requireEquipe, async (req, res) => {
  const { observacoesMecanico } = req.body;
  const resultado = await db.query(
    "UPDATE ordens_servico SET observacoes_mecanico = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [observacoesMecanico, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "adicionou observação", `O.S. #${resultado.rows[0].numero}`, (observacoesMecanico || "").slice(0, 80));
  res.json(resultado.rows[0]);
});

// PATCH /ordens/:id/sinal  { sinal }
router.patch("/:id/sinal", requireAuth, requireEquipe, async (req, res) => {
  const { sinal } = req.body;
  const resultado = await db.query(
    "UPDATE ordens_servico SET sinal = $1 WHERE id = $2 AND oficina_id = $3 RETURNING *",
    [Number(sinal) || 0, req.params.id, req.auth.oficinaId]
  );
  if (!resultado.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "alterou", `O.S. #${resultado.rows[0].numero}`, `sinal atualizado para R$ ${sinal}`);
  res.json(resultado.rows[0]);
});

// POST /ordens/:id/finalizar
// body: { dataSaida, pago: boolean, forma, documento, comprovante, vencimento }
// Marca a O.S. como entregue e já dá baixa no financeiro (pago ou pendente).
router.post("/:id/finalizar", requireAuth, requireEquipe, async (req, res) => {
  const { dataSaida, pago, forma, documento, comprovante, vencimento } = req.body;
  if (!dataSaida) return res.status(400).json({ erro: "informe a data de saída." });

  const os = await db.query("SELECT * FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!os.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });

  const valorRestante = Number(os.rows[0].valor_total) - Number(os.rows[0].sinal || 0);

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE ordens_servico SET status = 'entregue', data_saida = $1 WHERE id = $2",
      [dataSaida, req.params.id]
    );

    if (valorRestante > 0) {
      await client.query(
        `INSERT INTO pagamentos (oficina_id, os_id, valor, vencimento, pago_em, recebido_por, registrado_por, forma, documento, comprovante_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          req.auth.oficinaId, req.params.id, valorRestante, vencimento || dataSaida,
          pago ? dataSaida : null, pago ? req.auth.id : null, req.auth.id,
          pago ? forma : null, pago ? documento || null : null, pago ? comprovante || null : null,
        ]
      );
    }

    await client.query("COMMIT");

    await registrarAuditoria(
      req.auth.oficinaId, req.auth.id, "finalizou", `O.S. #${os.rows[0].numero}`,
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
  const os = await db.query("SELECT numero FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  if (!os.rows[0]) return res.status(404).json({ erro: "O.S. não encontrada." });

  await db.query("DELETE FROM ordens_servico WHERE id = $1 AND oficina_id = $2", [req.params.id, req.auth.oficinaId]);
  await registrarAuditoria(req.auth.oficinaId, req.auth.id, "excluiu", `O.S. #${os.rows[0].numero}`, "ordem de serviço removida (teste/erro)");
  res.status(204).send();
});

module.exports = router;
