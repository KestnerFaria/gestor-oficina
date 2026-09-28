import { describe, expect, it } from "vitest";
import { api, auth, criarCliente, criarOficina } from "./helpers";

describe("cadastro de oficina", () => {
  it("cria oficina e admin e já devolve um token", async () => {
    const res = await api.post("/auth/cadastrar-oficina").send({
      nomeOficina: "Oficina do Zé",
      cnpj: "11222333000181",
      telefone: "11999990000",
      nomeUsuario: "Zé",
      email: "ze@oficina.com",
      senha: "senha123",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ nome: "Zé", email: "ze@oficina.com", perfil: "admin" });
    // a senha (nem o hash) nunca volta na resposta
    expect(JSON.stringify(res.body)).not.toContain("senha");
  });

  it("continua funcionando quando o Asaas está fora do ar", async () => {
    const { token } = await criarOficina();

    const res = await api.get("/oficinas/minha/assinatura").set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pendente_configuracao");
    expect(res.body.valor).toBe(170);
  });

  it("exige os campos obrigatórios", async () => {
    const res = await api.post("/auth/cadastrar-oficina").send({ nomeOficina: "Sem dados" });
    expect(res.status).toBe(400);
  });

  it("exige CNPJ ou CPF para a cobrança", async () => {
    const res = await api.post("/auth/cadastrar-oficina").send({
      nomeOficina: "Sem CNPJ",
      telefone: "11999990000",
      nomeUsuario: "Admin",
      email: "semcnpj@teste.com",
      senha: "senha123",
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toContain("CNPJ");
  });

  it("não permite email duplicado", async () => {
    const { email } = await criarOficina();
    const res = await api.post("/auth/cadastrar-oficina").send({
      nomeOficina: "Outra",
      cnpj: "11222333000181",
      telefone: "11999990000",
      nomeUsuario: "Outro",
      email,
      senha: "senha123",
    });
    expect(res.status).toBe(409);
  });
});

describe("login da equipe", () => {
  it("entra com email e senha corretos", async () => {
    const { email } = await criarOficina();
    const res = await api.post("/auth/login-equipe").send({ email, senha: "senha123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario.perfil).toBe("admin");
  });

  it("recusa senha errada com a mesma mensagem de email inexistente", async () => {
    const { email } = await criarOficina();
    const senhaErrada = await api.post("/auth/login-equipe").send({ email, senha: "errada" });
    const emailInexistente = await api.post("/auth/login-equipe").send({ email: "ninguem@x.com", senha: "x" });

    expect(senhaErrada.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    // mensagem igual: não revela quais emails existem no sistema
    expect(senhaErrada.body.erro).toBe(emailInexistente.body.erro);
  });

  it("bloqueia usuário desativado", async () => {
    const { token } = await criarOficina();
    const novo = await api
      .post("/equipe")
      .set(auth(token))
      .send({ nome: "Temp", email: "temp@x.com", senha: "123", perfil: "atendente" });
    await api.delete(`/equipe/${novo.body.id}`).set(auth(token));

    const res = await api.post("/auth/login-equipe").send({ email: "temp@x.com", senha: "123" });
    expect(res.status).toBe(401);
  });
});

describe("login do cliente (portal)", () => {
  it("cliente com senha consegue entrar no portal", async () => {
    const { token } = await criarOficina();
    await criarCliente(token, { email: "cliente@x.com", senha: "abc123" });

    const res = await api.post("/auth/login-cliente").send({ email: "cliente@x.com", senha: "abc123" });

    expect(res.status).toBe(200);
    expect(res.body.cliente.email).toBe("cliente@x.com");
  });

  it("cliente cadastrado sem senha não tem acesso", async () => {
    const { token } = await criarOficina();
    await criarCliente(token, { email: "semacesso@x.com" });

    const res = await api.post("/auth/login-cliente").send({ email: "semacesso@x.com", senha: "" });
    expect(res.status).toBe(401);
  });
});

describe("proteção das rotas", () => {
  it("recusa requisição sem token", async () => {
    const res = await api.get("/clientes");
    expect(res.status).toBe(401);
  });

  it("recusa token falsificado", async () => {
    const res = await api.get("/clientes").set(auth("token.qualquer.inventado"));
    expect(res.status).toBe(401);
  });
});
