-- Gestor de CC deixa de ser exclusivo do Corporativo (rebatizado de "Gerente
-- de CC — Corporativo" em 2026-08-16) — usuario_cc_corporativo ganha
-- unidade_id e a chave primária passa a incluir a unidade, para não colidir
-- quando o mesmo código de CC existe em mais de uma unidade (Agrícola e
-- Resorts reaproveitam os códigos de CC da Têxtil, decisão de 2026-08-09).
--
-- Idempotente de propósito (IF NOT EXISTS / IF EXISTS): seguro rodar mesmo
-- que a coluna/constraint já tenham sido ajustadas manualmente antes deste
-- migrador existir (foi o caso desta primeira migração — rodada à mão no
-- editor SQL do Railway em 2026-08-16, antes deste arquivo/rodarMigracoes()
-- serem criados).
ALTER TABLE usuario_cc_corporativo ADD COLUMN IF NOT EXISTS unidade_id TEXT NOT NULL DEFAULT 'corporativo';
ALTER TABLE usuario_cc_corporativo DROP CONSTRAINT IF EXISTS usuario_cc_corporativo_pkey;
ALTER TABLE usuario_cc_corporativo ADD PRIMARY KEY (usuario_id, unidade_id, cc_codigo);
