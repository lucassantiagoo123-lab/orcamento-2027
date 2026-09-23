-- Alertas de possível perda de dados (2026-09-23): em 22 e 23/set projetos de
-- CapEx do Corporativo foram apagados/revertidos por saves com cópia
-- desatualizada e só se soube quando os gestores reclamaram. Cada save que
-- remove ou reduz dado "suspeito" (ver backend/src/db/detectarPerdas.js)
-- grava uma linha aqui e avisa o Admin FP&A.
CREATE TABLE IF NOT EXISTS alertas_dados (
  id            BIGSERIAL PRIMARY KEY,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  unidade_id    TEXT NOT NULL,
  usuario_id    UUID REFERENCES usuarios(id),
  secao         TEXT NOT NULL,
  descricao     TEXT NOT NULL,
  detalhes      JSONB,
  resolvido_em  TIMESTAMPTZ,
  resolvido_por UUID REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS alertas_dados_pendentes_idx ON alertas_dados (criado_em DESC) WHERE resolvido_em IS NULL;
