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
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

async function asaasFetch(path, { method = "GET", body } = {}) {
  const resposta = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      "User-Agent": "oficina-backend",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const dados = await resposta.json();
  if (!resposta.ok) {
    const msg = dados?.errors?.[0]?.description || "erro na comunicação com o Asaas";
    throw new Error(msg);
  }
  return dados;
}

// Cria (ou reaproveita) o cliente no Asaas — é o "pagador" da assinatura.
async function criarClienteAsaas({ nome, email, cpfCnpj, telefone }) {
  return asaasFetch("/customers", {
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
async function criarAssinaturaAsaas({ customerId, valor, nextDueDate, descricao }) {
  return asaasFetch("/subscriptions", {
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

async function cancelarAssinaturaAsaas(subscriptionId) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

// Lista todas as cobranças (meses) já geradas por uma assinatura — cada
// uma vem com o link de pagamento (invoiceUrl), onde a oficina escolhe
// Pix, boleto ou cartão numa página só do Asaas.
async function listarCobrancasAssinaturaAsaas(subscriptionId) {
  return asaasFetch(`/subscriptions/${subscriptionId}/payments?limit=100`);
}

module.exports = { criarClienteAsaas, criarAssinaturaAsaas, cancelarAssinaturaAsaas, listarCobrancasAssinaturaAsaas };
