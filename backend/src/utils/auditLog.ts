import db from "../db";

// Chame isso depois de qualquer ação que crie, altere ou apague dados.
// usuarioId pode ser null (ex: uma ação disparada pelo próprio cliente
// ou por um webhook).
export async function registrarAuditoria(
  oficinaId: number,
  usuarioId: number | null,
  acao: string,
  entidade: string,
  detalhe: string
): Promise<void> {
  await db.query(
    `INSERT INTO auditoria (oficina_id, usuario_id, acao, entidade, detalhe)
     VALUES ($1, $2, $3, $4, $5)`,
    [oficinaId, usuarioId, acao, entidade, detalhe]
  );
}
