import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../db";

// Aplica migrations/schema.sql no banco da DATABASE_URL.
// Uso: npm run migrate
async function main() {
  const sql = readFileSync(join(__dirname, "..", "..", "migrations", "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("schema aplicado");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
