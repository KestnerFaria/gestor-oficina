import "dotenv/config";
import { createApp } from "./app";

// falha logo na subida se faltar configuração essencial, em vez de
// quebrar só no primeiro login
for (const nome of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[nome]) {
    console.error(`variável de ambiente ${nome} não configurada.`);
    process.exit(1);
  }
}
if (!process.env.ASAAS_WEBHOOK_TOKEN) {
  console.warn("ASAAS_WEBHOOK_TOKEN não configurado: o webhook do Asaas aceitará requisições sem validação.");
}

const PORTA = Number(process.env.PORT) || 3001;
createApp().listen(PORTA, () => console.log(`oficina-backend rodando na porta ${PORTA}`));
