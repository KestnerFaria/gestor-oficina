import { afterAll, beforeEach, vi } from "vitest";
import { pool } from "../../src/db";

// A API do Asaas nunca é chamada de verdade nos testes. Por padrão ela
// "está fora do ar" (as funções rejeitam) — o que também testa que o
// cadastro funciona mesmo sem o Asaas. Testes de cobrança trocam esse
// comportamento com vi.mocked(...).mockResolvedValue(...).
vi.mock("../../src/asaas", () => ({
  criarClienteAsaas: vi.fn().mockRejectedValue(new Error("Asaas indisponível (mock)")),
  criarAssinaturaAsaas: vi.fn().mockRejectedValue(new Error("Asaas indisponível (mock)")),
  cancelarAssinaturaAsaas: vi.fn().mockResolvedValue({}),
  listarCobrancasAssinaturaAsaas: vi.fn().mockResolvedValue({ data: [] }),
}));

// Cada teste começa com o banco vazio. RESTART IDENTITY zera os ids.
beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const tabelas = rows.map((r) => `"${r.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${tabelas} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.end();
});
