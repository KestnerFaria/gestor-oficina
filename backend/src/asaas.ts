// ============================================================
// INTEGRAÇÃO COM O ASAAS — cliente e assinatura recorrente
// ============================================================
// Documentação: https://docs.asaas.com
//
// Modelo escolhido: billingType "UNDEFINED" — o Asaas manda um link de
// cobrança pro email/whatsapp do cliente a cada mês, e ele escolhe se
// paga por Pix, boleto ou cartão. Isso evita ter que capturar dados de
// cartão dentro do nosso próprio formulário (bem mais simples e sem
// preocupação de PCI-DSS). Pode evoluir pra cobrança automática no
// cartão depois, se fizer sentido.

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? "";

// ------------------------------------------------------------
// Formato (parcial) das respostas do Asaas que o sistema usa
// ------------------------------------------------------------
export interface AsaasCustomer {
  id: string;
}

export interface AsaasSubscription {
  id: string;
}

export interface AsaasPayment {
  id: string;
  dueDate: string;
  value: number;
  status: string; // PENDING | RECEIVED | CONFIRMED | OVERDUE | RECEIVED_IN_CASH | ...
  paymentDate?: string | null;
  confirmedDate?: string | null;
  billingType: string; // BOLETO | CREDIT_CARD | PIX | UNDEFINED
  invoiceUrl: string;
  subscription?: string;
}

interface AsaasList<T> {
  data: T[];
}

interface AsaasErro {
  errors?: { description?: string }[];
}

async function asaasFetch<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const resposta = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      "User-Agent": "oficina-backend",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const dados = (await resposta.json()) as T & AsaasErro;
  if (!resposta.ok) {
    const msg = dados?.errors?.[0]?.description || "erro na comunicação com o Asaas";
    throw new Error(msg);
  }
  return dados;
}

// Cria o cliente no Asaas — é o "pagador" da assinatura.
export async function criarClienteAsaas({
  nome,
  email,
  cpfCnpj,
  telefone,
}: {
  nome: string;
  email: string;
  cpfCnpj: string;
  telefone?: string | null;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: {
      name: nome,
      email,
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      phone: (telefone || "").replace(/\D/g, ""),
    },
  });
}

// Cria a assinatura mensal. `nextDueDate` é a data da PRIMEIRA cobrança —
// é isso que implementa o período de teste grátis: se ela for daqui a
// 10 dias, o Asaas só cobra depois desse prazo.
export async function criarAssinaturaAsaas({
  customerId,
  valor,
  nextDueDate,
  descricao,
}: {
  customerId: string;
  valor: number;
  nextDueDate: string;
  descricao: string;
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: {
      customer: customerId,
      billingType: "UNDEFINED",
      value: valor,
      nextDueDate,
      cycle: "MONTHLY",
      description: descricao,
    },
  });
}

export async function cancelarAssinaturaAsaas(subscriptionId: string): Promise<unknown> {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

// Lista todas as cobranças (meses) já geradas por uma assinatura — cada
// uma vem com o link de pagamento (invoiceUrl), onde a oficina escolhe
// Pix, boleto ou cartão numa página só do Asaas.
export async function listarCobrancasAssinaturaAsaas(subscriptionId: string): Promise<AsaasList<AsaasPayment>> {
  return asaasFetch<AsaasList<AsaasPayment>>(`/subscriptions/${subscriptionId}/payments?limit=100`);
}
