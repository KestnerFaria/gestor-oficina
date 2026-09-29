// ============================================================
// FUNÇÕES DE DATA
// ============================================================
// O backend manda datas como texto "AAAA-MM-DD" (ex: "2026-09-28") e
// data/hora como "AAAA-MM-DDTHH:MM:SS". Estas funções geram e formatam
// esses textos no fuso horário de quem está usando o sistema.

// Completa com zero à esquerda: 9 → "09"
function doisDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

// Data de hoje no fuso LOCAL, no formato "AAAA-MM-DD".
// Não use toISOString() aqui: ele converte para UTC, e no Brasil (UTC-3)
// isso faz o sistema achar que já é amanhã depois das 21h.
export function hojeISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = doisDigitos(agora.getMonth() + 1); // getMonth() começa em 0 (janeiro = 0)
  const dia = doisDigitos(agora.getDate());
  return `${ano}-${mes}-${dia}`;
}

// Data e hora de agora no fuso LOCAL, no formato "AAAA-MM-DDTHH:MM:SS".
export function agoraISO(): string {
  const agora = new Date();
  const hora = doisDigitos(agora.getHours());
  const minuto = doisDigitos(agora.getMinutes());
  const segundo = doisDigitos(agora.getSeconds());
  return `${hojeISO()}T${hora}:${minuto}:${segundo}`;
}

// "2026-09-28" → "28/09/2026". Sem data, devolve "-".
// Se vier data e hora ("2026-09-28T00:00:00.000Z"), usa só a data —
// sem isso a tela mostrava "28T00:00:00.000Z/09/2026".
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "-";
  return iso.slice(0, 10).split("-").reverse().join("/");
}

// "2026-09-28T14:35:10" → "28/09/2026 14:35". Só a data → "28/09/2026".
export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [data = "", hora] = iso.split("T");
  const dataFormatada = fmtData(data);
  return hora ? `${dataFormatada} ${hora.slice(0, 5)}` : dataFormatada;
}
