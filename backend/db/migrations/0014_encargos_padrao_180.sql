-- Encargos e Benefícios (encargosNovoHcPct): padrão geral de 180% do salário
-- (decisão de 2026-09-29), continua editável por unidade. Preenche SOMENTE onde
-- o campo está vazio ou ausente — qualquer valor já digitado é preservado.
-- Ignora snapshots de Consolidado (têm `_tipo`) e documentos sem `custos`.
-- Idempotente: depois de preenchido, o campo deixa de estar vazio.
UPDATE orcamentos AS o
SET dados = jsonb_set(
  o.dados,
  '{custos,premissasPessoal}',
  (CASE WHEN jsonb_typeof(o.dados->'custos'->'premissasPessoal') = 'object'
        THEN o.dados->'custos'->'premissasPessoal' ELSE '{}'::jsonb END)
  || jsonb_build_object('encargosNovoHcPct', '180')
)
WHERE jsonb_typeof(o.dados->'custos') = 'object'
  AND NOT (o.dados ? '_tipo')
  AND btrim(COALESCE(o.dados->'custos'->'premissasPessoal'->>'encargosNovoHcPct', '')) = '';
