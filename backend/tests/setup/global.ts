import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

// Roda UMA vez antes de todos os testes: recria o schema do zero no
// banco de teste, usando o mesmo migrations/schema.sql da produção.
export async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL ?? "";
  const nomeDoBanco = new URL(url).pathname.slice(1);

  // trava de segurança: os testes apagam dados, então só rodam num banco
  // com "test" no nome
  if (!nomeDoBanco.includes("test")) {
    throw new Error(`recusando rodar testes no banco "${nomeDoBanco}": o nome precisa conter "test".`);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.query(readFileSync(join(__dirname, "..", "..", "migrations", "schema.sql"), "utf8"));
  await client.end();
}
