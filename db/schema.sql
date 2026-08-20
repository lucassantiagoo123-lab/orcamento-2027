-- =====================================================================================
-- Orçamento 2027 (OBZ) — Grupo ARA — Caminho B
-- Schema Postgres — Fase 1
-- Fonte: Especificacao_Caminho_B_Multiusuario.md, seção 3.
--
-- Este arquivo é o estado final do schema — usado para criar um banco novo
-- do zero (docker-compose local e os testes automatizados em
-- backend/test/helpers.js). Não é aplicado em produção diretamente: o banco
-- do Railway já existe e evolui por migrações incrementais, aplicadas
-- sozinhas a cada deploy do backend — ver backend/db/migrations/ (desde
-- 2026-08-16). Toda mudança de schema precisa ser feita nos dois lugares:
-- aqui (referência) e como uma migração nova (aplicação real).
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 3.1 Autenticação e autorização
-- ---------------------------------------------------------------------------

CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT,              -- NULL: login via SSO (Entra ID) — decisão registrada em Fase 0
  perfil        TEXT NOT NULL CHECK (perfil IN ('admin_fpa', 'gerente_unidade', 'gerente_cc_corporativo')),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_login  TIMESTAMPTZ
);

-- Vínculo Gerente de Unidade -> unidade (N:N: permite mais de 1 usuário por unidade,
-- caso real observado no lançamento — Gerente + Diretor por unidade)
CREATE TABLE usuario_unidade (
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id  TEXT NOT NULL,   -- 'textil' | 'agricola' | 'agricola_tds' | 'agricola_fds' | 'resorts' | 'ei' | 'energia' | 'corporativo'
  PRIMARY KEY (usuario_id, unidade_id)
);

-- Vínculo Gestor de CC -> CC. Rebatizado de "Gerente de CC (Corporativo)"
-- para "Gestor de CC" em 2026-08-16: deixou de ser exclusivo do Corporativo
-- e passou a valer para qualquer unidade (Têxtil, Agrícola, Resorts,
-- Corporativo etc.) — por isso ganhou unidade_id. Nome da tabela mantido
-- (usuario_cc_corporativo) para não exigir rename em produção; o
-- significado é genérico agora. Cada usuário tem no máximo 1 CC (aplicado
-- na aplicação, não aqui — ver db/admin.js definirCcUsuario).
CREATE TABLE usuario_cc_corporativo (
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id  TEXT NOT NULL DEFAULT 'corporativo',  -- unidade a que o CC pertence
  cc_codigo   TEXT NOT NULL,    -- código do CC dentro da unidade (CCS_TEXTIL / CCS_CORPORATIVO / ...)
  PRIMARY KEY (usuario_id, unidade_id, cc_codigo)
);

-- Concessões temporárias de acesso (item 9.3 — "salvo autorização do FP&A")
CREATE TABLE concessao_acesso_temporaria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES usuarios(id),
  cc_codigo         TEXT NOT NULL,
  concedido_por     UUID NOT NULL REFERENCES usuarios(id),  -- deve ser admin_fpa (checado na aplicação)
  motivo            TEXT NOT NULL,
  valido_de         TIMESTAMPTZ NOT NULL DEFAULT now(),
  valido_ate        TIMESTAMPTZ NOT NULL,
  revogado_em       TIMESTAMPTZ
);

-- Sessões (necessário apenas se a Opção A - login/senha - for usada; mantido para
-- flexibilidade caso o SSO Entra ID também precise de sessão server-side)
CREATE TABLE sessoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em     TIMESTAMPTZ NOT NULL,
  ip_origem     TEXT,
  user_agent    TEXT
);

-- ---------------------------------------------------------------------------
-- 3.2 Dados de orçamento
-- ---------------------------------------------------------------------------

CREATE TABLE orcamentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    TEXT NOT NULL,
  ano           INT NOT NULL DEFAULT 2027,
  dados         JSONB NOT NULL,      -- objeto emptyFormData() (OrcamentoARA.jsx) preenchido
  status        TEXT NOT NULL DEFAULT 'nao_iniciado'
                  CHECK (status IN ('nao_iniciado','em_elaboracao','em_revisao','em_analise','enviado','aprovado')),
  bloqueado     BOOLEAN NOT NULL DEFAULT false,  -- true após aprovação (ver seção 4.5)
  -- true logo após um envio (POST /:unidadeId/enviar) até um admin_fpa
  -- liberar (POST /:unidadeId/liberar-reenvio) — pedido de 2026-08-16, o
  -- botão "Enviar versão" fica bloqueado enquanto isto for true.
  aguardando_liberacao BOOLEAN NOT NULL DEFAULT false,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES usuarios(id)
);

CREATE TABLE orcamento_versoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  UUID NOT NULL REFERENCES orcamentos(id),
  dados         JSONB NOT NULL,       -- snapshot completo no momento do envio
  autor_id      UUID NOT NULL REFERENCES usuarios(id),
  comentario    TEXT,
  totais        JSONB,                -- { receitaLiquida, ebitda, lucroLiquido, ... } para listagem rápida
  enviado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3.3 Auditoria (log de alterações — distinto de runAuditoria, que valida
-- consistência do orçamento em si, não quem mudou o quê)
-- ---------------------------------------------------------------------------

CREATE TABLE log_alteracoes (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id),
  unidade_id    TEXT NOT NULL,
  cc_codigo     TEXT,
  conta_codigo  TEXT,
  pacote_id     TEXT,
  campo         TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo    TEXT,
  motivo        TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tabelas de referência (seção 7 — de PLANO_CONTAS / PACOTES_* / CCS_CORPORATIVO
-- do OrcamentoARA.jsx). Seed em db/seed_referencia.sql (a gerar na Fase 1b).
-- ---------------------------------------------------------------------------

CREATE TABLE unidades (
  id      TEXT PRIMARY KEY,   -- 'textil' | 'agricola' | 'agricola_tds' | 'agricola_fds' | 'resorts' | 'ei' | 'energia' | 'corporativo'
  nome    TEXT NOT NULL
);

CREATE TABLE pacotes (
  id          TEXT NOT NULL,      -- ex.: 'pessoal', 'producao'
  unidade_id  TEXT NOT NULL REFERENCES unidades(id),
  nome        TEXT NOT NULL,
  ref_fonte   TEXT,               -- ex.: 'Matriz_Governanca_OBZ_2027_4 (43 contas)'
  PRIMARY KEY (unidade_id, id)
);

CREATE TABLE contas (
  codigo      TEXT NOT NULL,
  unidade_id  TEXT NOT NULL REFERENCES unidades(id),
  pacote_id   TEXT NOT NULL,
  nome        TEXT NOT NULL,
  origem      TEXT CHECK (origem IN ('Custo','Despesa')),
  PRIMARY KEY (unidade_id, codigo),
  FOREIGN KEY (unidade_id, pacote_id) REFERENCES pacotes(unidade_id, id)
);

CREATE TABLE centros_custo (
  codigo      TEXT NOT NULL,
  unidade_id  TEXT NOT NULL REFERENCES unidades(id),
  nome        TEXT NOT NULL,
  tipo        TEXT,          -- 'producao' | 'despesa' (só populado onde a fonte traz, ex. Têxtil)
  PRIMARY KEY (unidade_id, codigo)
);

-- ---------------------------------------------------------------------------
-- Índices de apoio às consultas de autorização (seção 4)
-- ---------------------------------------------------------------------------

CREATE INDEX idx_orcamentos_unidade ON orcamentos(unidade_id, ano);
CREATE INDEX idx_orcamento_versoes_orcamento ON orcamento_versoes(orcamento_id);
CREATE INDEX idx_log_alteracoes_unidade ON log_alteracoes(unidade_id, criado_em);
CREATE INDEX idx_concessao_ativa ON concessao_acesso_temporaria(usuario_id, cc_codigo, valido_ate) WHERE revogado_em IS NULL;
