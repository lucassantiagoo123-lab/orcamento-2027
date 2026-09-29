-- Correção do padrão de Encargos e Benefícios (2026-09-30): o percentual é 80%
-- sobre o salário (custo = salário × 1,8), não 180%. A migração 0014 gravou
-- '180' onde o campo estava vazio; aqui '180' vira '80'. Qualquer outro valor
-- já digitado (83, 0, etc.) é preservado. Ignora snapshots de Consolidado.
-- Idempotente: depois de convertido, o campo deixa de valer '180'.
UPDATE orcamentos AS o
SET dados = jsonb_set(o.dados, '{custos,premissasPessoal,encargosNovoHcPct}', '"80"')
WHERE jsonb_typeof(o.dados->'custos') = 'object'
  AND NOT (o.dados ? '_tipo')
  AND btrim(COALESCE(o.dados->'custos'->'premissasPessoal'->>'encargosNovoHcPct', '')) = '180';
