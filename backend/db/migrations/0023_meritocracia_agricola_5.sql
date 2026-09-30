-- ARA Agrícola (2026-09-30): meritocracia padrão de 5,0% (editável, fixa para
-- todos os CCs), decisão do usuário. Preenche SOMENTE onde o campo está vazio ou
-- ausente — qualquer valor já digitado é preservado. Só agricola_tds/agricola_fds.
-- Idempotente.
UPDATE orcamentos AS o
SET dados = jsonb_set(
  o.dados,
  '{custos,premissasPessoal}',
  (CASE WHEN jsonb_typeof(o.dados->'custos'->'premissasPessoal') = 'object'
        THEN o.dados->'custos'->'premissasPessoal' ELSE '{}'::jsonb END)
  || jsonb_build_object('meritocraciaPct', '5')
)
WHERE o.unidade_id IN ('agricola_tds', 'agricola_fds')
  AND jsonb_typeof(o.dados->'custos') = 'object'
  AND btrim(COALESCE(o.dados->'custos'->'premissasPessoal'->>'meritocraciaPct', '')) = '';
