// O driver "pg" converte colunas DATE em objetos Date à meia-noite do
// fuso do servidor. Para mandar datas a APIs externas (Asaas) precisamos
// do formato "AAAA-MM-DD" — esta função aceita os dois formatos.
export function paraDataISO(valor: Date | string): string {
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  return valor.slice(0, 10);
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dataDaqui(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
