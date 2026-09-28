# Backend — Sistema de Gestão de Oficina Mecânica

API que substitui o `useState` do front-end por persistência real em
PostgreSQL, com autenticação de verdade (senha com hash, não texto puro)
e isolamento correto entre oficinas (multi-tenant).

## Rodando localmente

1. Instale o PostgreSQL (ou use um banco gratuito de teste no
   [Railway](https://railway.app) ou [Render](https://render.com) — ambos
   têm plano free para começar).

2. Copie o arquivo de ambiente e preencha:
   ```
   cp .env.example .env
   ```
   Edite `.env` com a `DATABASE_URL` do seu banco e um `JWT_SECRET`
   aleatório (qualquer string longa e única serve).

3. Instale as dependências:
   ```
   npm install
   ```

4. Aplique o schema no banco (cria todas as tabelas):
   ```
   npm run migrate
   ```

5. Suba o servidor:
   ```
   npm run dev
   ```
   A API sobe em `http://localhost:3001`.

## Testando rapidamente

```bash
# cadastrar uma oficina de teste
curl -X POST http://localhost:3001/auth/cadastrar-oficina \
  -H "Content-Type: application/json" \
  -d '{"nomeOficina":"Oficina Teste","telefone":"11999990000","nomeUsuario":"Admin","email":"admin@teste.com","senha":"123456"}'

# fazer login (o token retornado vai no header Authorization: Bearer <token> das próximas chamadas)
curl -X POST http://localhost:3001/auth/login-equipe \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","senha":"123456"}'
```

## Conectando o front-end (OficinaApp.jsx)

Hoje o front-end guarda tudo em `useState`. Para conectar de verdade,
cada `useState` de dados (clientes, veiculos, ordens, etc.) precisa virar
uma chamada `fetch` para os endpoints correspondentes, e o token do
login precisa ser guardado (ex: em uma variável de estado no componente
raiz) e enviado em todo `fetch` no header:

```js
fetch("http://localhost:3001/clientes", {
  headers: { Authorization: `Bearer ${token}` }
})
```

Essa etapa de conectar o front-end às rotas reais é o próximo passo —
posso fazer isso a seguir, endpoint por endpoint.

## Deploy (colocar no ar de verdade)

- **Backend**: Railway ou Render. Os dois detectam o `package.json`
  sozinhos, só precisa configurar as variáveis de ambiente (`DATABASE_URL`,
  `JWT_SECRET`, `FRONTEND_URL`) no painel deles.
- **Banco**: os dois também oferecem PostgreSQL gerenciado — clique
  para criar, copie a `DATABASE_URL` gerada, cole nas variáveis de
  ambiente do backend.
- **Front-end**: Vercel ou Netlify (fora do escopo deste backend).

## O que ainda é MVP (evoluir antes de vender pra valer)

- **Logo e comprovantes em base64**: hoje aceitos como texto direto no
  banco (`logo_url`, `comprovante_url` guardam a string base64 inteira).
  Funciona, mas deixa o banco pesado. Trocar por upload real para um
  storage (S3, Cloudflare R2, Supabase Storage) e guardar só a URL.
- **Geração do número da O.S.**: usa contagem simples por oficina.
  Em uso concorrente pesado (duas O.S. criadas no mesmíssimo instante)
  pode colidir. Resolver com uma sequence dedicada por oficina se isso
  virar problema real.
- **Rate limiting e validação de entrada mais rígida**: ainda não têm
  proteção contra abuso (ex: `express-rate-limit`) nem validação de
  schema no corpo das requisições (ex: `zod`).
