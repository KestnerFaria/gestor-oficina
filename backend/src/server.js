require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "5mb" })); // limite maior por causa da logo/comprovante em base64 (MVP)

app.get("/", (req, res) => res.json({ ok: true, servico: "oficina-backend" }));

app.use("/auth", require("./routes/auth"));
app.use("/oficinas", require("./routes/oficinas"));
app.use("/equipe", require("./routes/equipe"));
app.use("/clientes", require("./routes/clientes"));
app.use("/veiculos", require("./routes/veiculos"));
app.use("/servicos", require("./routes/servicos"));
app.use("/produtos", require("./routes/produtos"));
app.use("/ordens", require("./routes/ordens"));
app.use("/pagamentos", require("./routes/pagamentos"));
app.use("/despesas", require("./routes/despesas"));
app.use("/auditoria", require("./routes/auditoria"));
app.use("/portal", require("./routes/portalCliente"));
app.use("/alertas-whatsapp", require("./routes/alertasWhatsapp"));
app.use("/webhooks", require("./routes/webhookAsaas"));

// captura erros não tratados nas rotas, pra nunca devolver HTML de erro pro front-end
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "erro interno do servidor." });
});

const PORTA = process.env.PORT || 3001;
app.listen(PORTA, () => console.log(`oficina-backend rodando na porta ${PORTA}`));
