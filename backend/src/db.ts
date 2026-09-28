import { Pool, types, type QueryResultRow } from "pg";

// Por padrão, o driver "pg" devolve colunas NUMERIC/DECIMAL como TEXTO
// (ex: "120.00" em vez de 120), pra não perder precisão decimal. Isso
// quebra qualquer soma feita no front-end (0 + "120.00" vira "0120.00",
// concatenação de texto, não soma). Aqui a gente força a conversão pra
// número de verdade — o OID 1700 é o do tipo NUMERIC no Postgres.
types.setTypeParser(1700, (valor: string | null) => (valor === null ? null : parseFloat(valor)));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

// Wrapper tipado: db.query<ClienteRow>("SELECT ...") já devolve rows tipadas.
export function query<T extends QueryResultRow = QueryResultRow>(texto: string, params?: unknown[]) {
  return pool.query<T>(texto, params);
}

export default { query, pool };
