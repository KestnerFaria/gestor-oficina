import request from "supertest";
import { createApp } from "../src/app";

// Cliente HTTP apontando para o app, sem subir servidor.
export const api = request(createApp());

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let contador = 0;
const unico = () => ++contador;

// Cria uma oficina com um admin logado. Cada chamada gera um email novo.
export async function criarOficina(nome = "Oficina Teste") {
  const n = unico();
  const email = `admin${n}@teste.com`;
  const res = await api.post("/auth/cadastrar-oficina").send({
    nomeOficina: `${nome} ${n}`,
    cnpj: "11222333000181",
    telefone: "11999990000",
    nomeUsuario: "Admin",
    email,
    senha: "senha123",
  });
  if (res.status !== 201) throw new Error(`falha ao criar oficina: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, oficinaId: res.body.oficina.id as number, email };
}

export async function criarCliente(token: string, dados: Record<string, unknown> = {}) {
  const res = await api
    .post("/clientes")
    .set(auth(token))
    .send({ nome: "João da Silva", telefone: "11988887777", ...dados });
  if (res.status !== 201) throw new Error(`falha ao criar cliente: ${res.status}`);
  return res.body as { id: number; nome: string };
}

export async function criarVeiculo(token: string, clienteId: number) {
  const res = await api
    .post("/veiculos")
    .set(auth(token))
    .send({ clienteId, placa: `abc${unico()}`, modelo: "Gol", marca: "VW" });
  if (res.status !== 201) throw new Error(`falha ao criar veículo: ${res.status}`);
  return res.body as { id: number; placa: string };
}

export async function criarProduto(token: string, dados: Record<string, unknown> = {}) {
  const res = await api
    .post("/produtos")
    .set(auth(token))
    .send({ nome: "Filtro de óleo", quantidadeEstoque: 10, precoVenda: 30, ...dados });
  if (res.status !== 201) throw new Error(`falha ao criar produto: ${res.status}`);
  return res.body as { id: number; quantidade_estoque: number };
}

export async function criarServico(token: string, dados: Record<string, unknown> = {}) {
  const res = await api
    .post("/servicos")
    .set(auth(token))
    .send({ nome: "Troca de óleo", preco: 80, ...dados });
  if (res.status !== 201) throw new Error(`falha ao criar serviço: ${res.status}`);
  return res.body as { id: number; preco: number };
}

// Monta o cenário mais comum: oficina + cliente + veículo
export async function cenarioBasico() {
  const oficina = await criarOficina();
  const cliente = await criarCliente(oficina.token);
  const veiculo = await criarVeiculo(oficina.token, cliente.id);
  return { ...oficina, cliente, veiculo };
}
