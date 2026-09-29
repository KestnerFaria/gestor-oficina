import { describe, expect, it } from "vitest";
import { abasDoPerfil } from ".";

const ids = (perfil: Parameters<typeof abasDoPerfil>[0]) => abasDoPerfil(perfil).map((a) => a.id);

describe("abasDoPerfil", () => {
  it("admin vê tudo", () => {
    expect(ids("admin")).toEqual(["dashboard", "nova_os", "clientes", "catalogo", "financeiro", "despesas", "empresa", "assinatura", "equipe", "auditoria"]);
  });

  it("atendente vê o financeiro, mas nada de administração", () => {
    expect(ids("atendente")).toEqual(["dashboard", "nova_os", "clientes", "catalogo", "financeiro", "empresa"]);
  });

  it("mecânico vê só a operação", () => {
    expect(ids("mecanico")).toEqual(["dashboard", "nova_os", "clientes", "catalogo", "empresa"]);
  });
});
