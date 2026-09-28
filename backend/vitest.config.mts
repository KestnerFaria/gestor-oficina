import { defineConfig } from "vitest/config";

// Banco usado nos testes. TODAS as tabelas dele são apagadas a cada
// teste — por isso tests/setup/global.ts só aceita bancos com "test" no
// nome. Nunca aponte para produção.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://dev:dev@localhost:5432/oficina_test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global.ts"],
    setupFiles: ["tests/setup/each-file.ts"],
    // todos os arquivos usam o mesmo banco, então rodam um de cada vez
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "segredo-apenas-para-testes",
      ASAAS_WEBHOOK_TOKEN: "token-webhook-teste",
      VALOR_MENSALIDADE: "170",
    },
  },
});
