import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // os testes de data rodam no fuso do Brasil, como os usuários reais
    env: { TZ: "America/Sao_Paulo" },
  },
});
