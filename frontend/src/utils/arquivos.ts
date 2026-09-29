import type { Comprovante } from "../api";

// Lê um arquivo escolhido no <input type="file"> e devolve o conteúdo em
// base64 (data URL), no formato de comprovante que a API espera.
export function lerArquivo(arquivo: File | undefined): Promise<Comprovante | null> {
  if (!arquivo) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ nome: arquivo.name, tipo: arquivo.type, dados: reader.result as string });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(arquivo);
  });
}
