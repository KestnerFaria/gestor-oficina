// No TypeScript, o erro capturado em um catch é do tipo "unknown": pode
// ser qualquer coisa, não necessariamente um Error. Esta função extrai
// uma mensagem legível de forma segura.
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "string") return erro;
  return "erro inesperado. tente novamente.";
}
