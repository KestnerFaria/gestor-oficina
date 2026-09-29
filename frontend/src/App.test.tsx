import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

// Teste de fumaça: monta o app inteiro de verdade. O build confere se os
// imports existem, mas não executa nada; este teste garante que a tela
// inicial realmente abre sem erro em tempo de execução.
describe("App", () => {
  it("abre na tela de login", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("GESTOR DE OFICINA");
    expect(html).toContain("entrar");
  });
});
