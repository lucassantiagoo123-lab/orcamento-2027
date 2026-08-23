-- Pedido de 2026-08-23: "ajuste os outros pontos que não dependem de mim" —
-- etapas do processo orçamentário (cronograma do FP&A) até aqui só viviam em
-- localStorage do navegador (ver frontend/src/legacyStorage.js), igual
-- premissas_macro era antes da migração 0003. inicio/fim em TEXT (não DATE)
-- de propósito: guardam o mesmo formato ISO 'AAAA-MM-DD' que o
-- <input type="date"> do frontend já usa, sem depender de como o driver do
-- Postgres serializa um tipo DATE de volta pra JS.
-- Idempotente (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS etapas_processo (
  id             TEXT PRIMARY KEY,
  inicio         TEXT,
  fim            TEXT,
  atualizado_em  TIMESTAMPTZ,
  atualizado_por UUID REFERENCES usuarios(id)
);
