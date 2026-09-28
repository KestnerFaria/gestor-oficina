import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import oficinasRoutes from "./routes/oficinas";
import equipeRoutes from "./routes/equipe";
import clientesRoutes from "./routes/clientes";
import veiculosRoutes from "./routes/veiculos";
import servicosRoutes from "./routes/servicos";
import produtosRoutes from "./routes/produtos";
import ordensRoutes from "./routes/ordens";
import pagamentosRoutes from "./routes/pagamentos";
import despesasRoutes from "./routes/despesas";
import auditoriaRoutes from "./routes/auditoria";
import portalClienteRoutes from "./routes/portalCliente";
import alertasWhatsappRoutes from "./routes/alertasWhatsapp";
import webhookAsaasRoutes from "./routes/webhookAsaas";

// Monta o app Express sem abrir porta nenhuma. Separar isso do
// app.listen() (que fica em server.ts) permite que os testes façam
// requisições direto no app, sem subir um servidor de verdade.
export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
  app.use(express.json({ limit: "5mb" })); // limite maior por causa da logo/comprovante em base64 (MVP)

  app.get("/", (_req, res) => {
    res.json({ ok: true, servico: "oficina-backend" });
  });

  app.use("/auth", authRoutes);
  app.use("/oficinas", oficinasRoutes);
  app.use("/equipe", equipeRoutes);
  app.use("/clientes", clientesRoutes);
  app.use("/veiculos", veiculosRoutes);
  app.use("/servicos", servicosRoutes);
  app.use("/produtos", produtosRoutes);
  app.use("/ordens", ordensRoutes);
  app.use("/pagamentos", pagamentosRoutes);
  app.use("/despesas", despesasRoutes);
  app.use("/auditoria", auditoriaRoutes);
  app.use("/portal", portalClienteRoutes);
  app.use("/alertas-whatsapp", alertasWhatsappRoutes);
  app.use("/webhooks", webhookAsaasRoutes);

  // captura erros não tratados nas rotas (no Express 5 isso inclui erros
  // de funções async), pra nunca devolver HTML de erro pro front-end
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ erro: "erro interno do servidor." });
  });

  return app;
}
