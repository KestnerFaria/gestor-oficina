// ============================================================
// REGRAS DO DASHBOARD — retorno de clientes e histórico
// ============================================================
import type { Cliente, FormaPagamento, Ordem, Pagamento, Servico, Veiculo } from "../api";

// Meses completos entre uma data e "agora" (nunca negativo).
// Ex: de 10/03 a 09/09 são 5 meses; de 10/03 a 10/09 são 6.
export function mesesDesde(dataISO: string | null | undefined, agora: Date = new Date()): number | null {
  if (!dataISO) return null;
  const inicio = new Date(dataISO);
  let meses = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth());
  if (agora.getDate() < inicio.getDate()) meses -= 1;
  return Math.max(0, meses);
}

// Link do WhatsApp com a mensagem pronta. Adiciona o 55 (Brasil) se faltar.
export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string {
  const digitos = (telefone || "").replace(/\D/g, "");
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// Os serviços são identificados pelo nome, pois cada oficina cadastra
// o catálogo do seu jeito ("Troca de óleo", "TROCA OLEO 5W30"...)
function idsDeServicosComNome(servicos: Servico[], ...palavras: string[]): Id[] {
  return servicos.filter((s) => palavras.some((p) => s.nome.toLowerCase().includes(p))).map((s) => s.id);
}

type Id = Servico["id"];

const usaAlgumServico = (ordem: Ordem, ids: Id[]) => ordem.servicosIds?.some((id) => ids.includes(id)) ?? false;
const maisRecentePrimeiro = (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime();

export const MESES_SEM_TROCA_DE_OLEO = 6;

export interface ClienteParaContato {
  cliente: Cliente;
  veiculo: Veiculo;
  ultima: Ordem | undefined; // última O.S. com troca de óleo
  meses: number | null; // null = nunca fez troca de óleo aqui
}

interface DadosDaOficina {
  clientes: Cliente[];
  veiculos: Veiculo[];
  ordens: Ordem[];
  servicos: Servico[];
}

// Veículos sem troca de óleo há 6+ meses (ou nunca), para chamar no
// WhatsApp. Os que nunca trocaram aparecem primeiro, depois os mais antigos.
export function clientesSemTrocaDeOleo({ clientes, veiculos, ordens, servicos }: DadosDaOficina, agora: Date = new Date()): ClienteParaContato[] {
  const servicosOleo = idsDeServicosComNome(servicos, "óleo", "oleo");
  const resultado: ClienteParaContato[] = [];

  for (const cliente of clientes) {
    for (const veiculo of veiculos.filter((v) => v.clienteId === cliente.id)) {
      const ultima = ordens
        .filter((o) => o.veiculoId === veiculo.id && usaAlgumServico(o, servicosOleo))
        .sort((a, b) => maisRecentePrimeiro(a.criadoEm, b.criadoEm))[0];
      const meses = ultima ? mesesDesde(ultima.criadoEm, agora) : null;
      if (meses === null || meses >= MESES_SEM_TROCA_DE_OLEO) {
        resultado.push({ cliente, veiculo, ultima, meses });
      }
    }
  }

  return resultado.sort((a, b) => (b.meses ?? 999) - (a.meses ?? 999));
}

export interface RegistroMotor {
  os: Ordem;
  cliente: Cliente | undefined;
  veiculo: Veiculo | undefined;
}

// O.S. com serviço de motor, da mais recente para a mais antiga
export function historicoDeMotor({ clientes, veiculos, ordens, servicos }: DadosDaOficina): RegistroMotor[] {
  const servicosMotor = idsDeServicosComNome(servicos, "motor");
  return ordens
    .filter((o) => usaAlgumServico(o, servicosMotor))
    .map((os) => ({
      os,
      cliente: clientes.find((c) => c.id === os.clienteId),
      veiculo: veiculos.find((v) => v.id === os.veiculoId),
    }))
    .sort((a, b) => maisRecentePrimeiro(a.os.criadoEm, b.os.criadoEm));
}

const STATUS_FECHADOS = ["concluida", "entregue", "cancelada"];

// Números dos cartões do topo do dashboard
export function resumoDoDia(ordens: Ordem[], pagamentos: Pagamento[], hoje: string) {
  return {
    abertas: ordens.filter((o) => !STATUS_FECHADOS.includes(o.status)).length,
    emAndamento: ordens.filter((o) => o.status === "em_andamento").length,
    faturamentoHoje: pagamentos.filter((p) => p.pagoEm === hoje).reduce((soma, p) => soma + p.valor, 0),
    atrasados: pagamentos.filter((p) => !p.pagoEm && p.vencimento < hoje).length,
  };
}

// Total já recebido em cada forma de pagamento
export function totaisPorForma(pagamentos: Pick<Pagamento, "pagoEm" | "forma" | "valor">[]): Record<FormaPagamento, number> {
  const totais: Record<FormaPagamento, number> = { dinheiro: 0, cartao: 0, pix: 0 };
  for (const p of pagamentos) {
    if (p.pagoEm && p.forma) totais[p.forma] += p.valor;
  }
  return totais;
}
