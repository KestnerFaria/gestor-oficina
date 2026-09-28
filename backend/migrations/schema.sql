-- ============================================================
-- SISTEMA DE GESTÃO DE OFICINA MECÂNICA — SCHEMA MULTI-TENANT
-- PostgreSQL — versão atualizada (substitui o schema_oficina.sql inicial)
-- ============================================================

-- ------------------------------------------------------------
-- 1. OFICINAS (cada uma é um "tenant" isolado)
-- ------------------------------------------------------------
CREATE TABLE oficinas (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(150) NOT NULL,
    cnpj            VARCHAR(18),
    telefone        VARCHAR(20) NOT NULL,
    endereco        VARCHAR(255),
    logo_url        TEXT,              -- em produção: URL de storage (S3/Supabase), não base64
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. USUÁRIOS (equipe da oficina — limite de 3 por oficina é
--    validado na aplicação, não aqui, pra poder dar mensagens
--    de erro amigáveis)
-- ------------------------------------------------------------
CREATE TYPE perfil_usuario AS ENUM ('admin', 'atendente', 'mecanico');

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    oficina_id      INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    nome            VARCHAR(120) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    senha_hash      VARCHAR(255) NOT NULL,
    perfil          perfil_usuario NOT NULL DEFAULT 'atendente',
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_oficina ON usuarios(oficina_id);

-- ------------------------------------------------------------
-- 3. CLIENTES (login opcional para o portal do cliente)
-- ------------------------------------------------------------
CREATE TABLE clientes (
    id              SERIAL PRIMARY KEY,
    oficina_id      INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    nome            VARCHAR(150) NOT NULL,
    telefone        VARCHAR(20) NOT NULL,
    cpf             VARCHAR(18),
    endereco        VARCHAR(255),
    email           VARCHAR(150),
    senha_hash      VARCHAR(255),      -- NULL = cliente sem acesso ao portal
    criado_em       TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(oficina_id, email)
);

CREATE INDEX idx_clientes_oficina ON clientes(oficina_id);

-- ------------------------------------------------------------
-- 4. VEÍCULOS
-- ------------------------------------------------------------
CREATE TABLE veiculos (
    id              SERIAL PRIMARY KEY,
    oficina_id      INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    placa           VARCHAR(10) NOT NULL,
    marca           VARCHAR(60),
    modelo          VARCHAR(80) NOT NULL,
    ano             SMALLINT,
    cor             VARCHAR(40),
    km_atual        INTEGER,
    criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_veiculos_cliente ON veiculos(cliente_id);
CREATE INDEX idx_veiculos_oficina ON veiculos(oficina_id);

-- ------------------------------------------------------------
-- 5. SERVIÇOS (catálogo de mão de obra por oficina)
-- ------------------------------------------------------------
CREATE TABLE servicos (
    id              SERIAL PRIMARY KEY,
    oficina_id      INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    nome            VARCHAR(150) NOT NULL,
    preco           NUMERIC(10,2) NOT NULL DEFAULT 0,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_servicos_oficina ON servicos(oficina_id);

-- ------------------------------------------------------------
-- 6. PRODUTOS / ESTOQUE (peças por oficina)
-- ------------------------------------------------------------
CREATE TABLE produtos (
    id                  SERIAL PRIMARY KEY,
    oficina_id          INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    nome                VARCHAR(150) NOT NULL,
    quantidade_estoque  INTEGER NOT NULL DEFAULT 0,
    estoque_minimo      INTEGER NOT NULL DEFAULT 0,
    preco_venda         NUMERIC(10,2) NOT NULL DEFAULT 0,
    preco_custo         NUMERIC(10,2) NOT NULL DEFAULT 0,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_produtos_oficina ON produtos(oficina_id);

-- ------------------------------------------------------------
-- 7. ORDENS DE SERVIÇO
-- ------------------------------------------------------------
CREATE TYPE status_os AS ENUM (
    'orcamento', 'aberta', 'em_andamento', 'aguardando_peca',
    'concluida', 'entregue', 'cancelada'
);

CREATE TABLE ordens_servico (
    id                      SERIAL PRIMARY KEY,
    oficina_id              INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    numero                  VARCHAR(20) NOT NULL,
    cliente_id              INTEGER NOT NULL REFERENCES clientes(id),
    veiculo_id              INTEGER NOT NULL REFERENCES veiculos(id),
    mecanico_id             INTEGER REFERENCES usuarios(id),
    criado_por              INTEGER REFERENCES usuarios(id),
    status                  status_os NOT NULL DEFAULT 'orcamento',
    km_entrada              VARCHAR(20),
    descricao_problema      TEXT NOT NULL,
    observacoes_mecanico    TEXT,
    sinal                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_total             NUMERIC(10,2) NOT NULL DEFAULT 0,
    data_abertura           TIMESTAMP NOT NULL DEFAULT NOW(),
    data_saida              DATE,
    criado_em               TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(oficina_id, numero)
);

CREATE INDEX idx_os_oficina ON ordens_servico(oficina_id);
CREATE INDEX idx_os_status ON ordens_servico(status);
CREATE INDEX idx_os_cliente ON ordens_servico(cliente_id);
CREATE INDEX idx_os_veiculo ON ordens_servico(veiculo_id);

-- ------------------------------------------------------------
-- 8. ITENS DA O.S. — SERVIÇOS SELECIONADOS (preço congelado)
-- ------------------------------------------------------------
CREATE TABLE os_itens_servicos (
    id              SERIAL PRIMARY KEY,
    os_id           INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    servico_id      INTEGER NOT NULL REFERENCES servicos(id),
    preco           NUMERIC(10,2) NOT NULL
);

-- ------------------------------------------------------------
-- 9. ITENS DA O.S. — PEÇAS UTILIZADAS (preço congelado)
-- ------------------------------------------------------------
CREATE TABLE os_itens_produtos (
    id              SERIAL PRIMARY KEY,
    os_id           INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    produto_id      INTEGER NOT NULL REFERENCES produtos(id),
    quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario  NUMERIC(10,2) NOT NULL
);

-- ------------------------------------------------------------
-- 10. PAGAMENTOS
-- ------------------------------------------------------------
CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'cartao', 'pix');

CREATE TABLE pagamentos (
    id                  SERIAL PRIMARY KEY,
    oficina_id          INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    os_id               INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    valor               NUMERIC(10,2) NOT NULL,
    vencimento          DATE NOT NULL,
    pago_em             DATE,
    recebido_por        INTEGER REFERENCES usuarios(id),
    registrado_por      INTEGER REFERENCES usuarios(id),
    forma               forma_pagamento,
    documento           VARCHAR(100),      -- número da nota/NSU ou ID do PIX
    comprovante_url     TEXT,              -- em produção: URL de storage, não base64
    criado_em           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagamentos_oficina ON pagamentos(oficina_id);
CREATE INDEX idx_pagamentos_os ON pagamentos(os_id);

-- ------------------------------------------------------------
-- 11. DESPESAS MENSAIS
-- ------------------------------------------------------------
CREATE TABLE despesas (
    id                  SERIAL PRIMARY KEY,
    oficina_id          INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    descricao           VARCHAR(255) NOT NULL,
    categoria           VARCHAR(40) NOT NULL DEFAULT 'outros',
    valor               NUMERIC(10,2) NOT NULL,
    data_vencimento     DATE,
    fixa                BOOLEAN NOT NULL DEFAULT FALSE,
    registrado_por      INTEGER REFERENCES usuarios(id),
    criado_em           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_despesas_oficina ON despesas(oficina_id);

-- ------------------------------------------------------------
-- 12. AUDITORIA (quem fez o quê)
-- ------------------------------------------------------------
CREATE TABLE auditoria (
    id              SERIAL PRIMARY KEY,
    oficina_id      INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    usuario_id      INTEGER REFERENCES usuarios(id),
    acao            VARCHAR(60) NOT NULL,
    entidade        VARCHAR(150) NOT NULL,
    detalhe         TEXT,
    criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_oficina ON auditoria(oficina_id);

-- ------------------------------------------------------------
-- 13. ALERTAS DE WHATSAPP ENVIADOS (registro de clique, não de entrega)
-- ------------------------------------------------------------
CREATE TABLE alertas_whatsapp (
    id              SERIAL PRIMARY KEY,
    oficina_id      INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
    veiculo_id      INTEGER NOT NULL REFERENCES veiculos(id),
    enviado_por     INTEGER REFERENCES usuarios(id),
    enviado_em      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: baixa automática de estoque ao adicionar peça na O.S.
-- ============================================================
CREATE OR REPLACE FUNCTION baixar_estoque()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE produtos
    SET quantidade_estoque = GREATEST(0, quantidade_estoque - NEW.quantidade)
    WHERE id = NEW.produto_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_baixar_estoque
AFTER INSERT ON os_itens_produtos
FOR EACH ROW EXECUTE FUNCTION baixar_estoque();

-- Ao excluir a O.S. (ou o item), devolve a peça ao estoque
CREATE OR REPLACE FUNCTION devolver_estoque()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE produtos
    SET quantidade_estoque = quantidade_estoque + OLD.quantidade
    WHERE id = OLD.produto_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_devolver_estoque
AFTER DELETE ON os_itens_produtos
FOR EACH ROW EXECUTE FUNCTION devolver_estoque();

-- ------------------------------------------------------------
-- 14. ASSINATURAS (cobrança recorrente via Asaas — SaaS)
-- ------------------------------------------------------------
CREATE TYPE status_assinatura AS ENUM ('trial', 'ativa', 'atrasada', 'cancelada', 'pendente_configuracao');

CREATE TABLE assinaturas (
    id                      SERIAL PRIMARY KEY,
    oficina_id              INTEGER NOT NULL UNIQUE REFERENCES oficinas(id) ON DELETE CASCADE,
    asaas_customer_id       VARCHAR(60),
    asaas_subscription_id   VARCHAR(60),
    status                  status_assinatura NOT NULL DEFAULT 'pendente_configuracao',
    valor                   NUMERIC(10,2) NOT NULL DEFAULT 100,
    trial_termina_em        DATE,
    atualizado_em           TIMESTAMP NOT NULL DEFAULT NOW(),
    criado_em               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assinaturas_oficina ON assinaturas(oficina_id);
CREATE INDEX idx_assinaturas_asaas_sub ON assinaturas(asaas_subscription_id);

-- ============================================================
-- VIEWS de apoio ao dashboard
-- ============================================================
CREATE VIEW vw_estoque_baixo AS
SELECT id, oficina_id, nome, quantidade_estoque, estoque_minimo
FROM produtos
WHERE quantidade_estoque <= estoque_minimo AND ativo = TRUE;

CREATE VIEW vw_faturamento_dia AS
SELECT oficina_id, DATE(pago_em) AS dia, SUM(valor) AS faturamento
FROM pagamentos
WHERE pago_em = CURRENT_DATE
GROUP BY oficina_id, DATE(pago_em);
