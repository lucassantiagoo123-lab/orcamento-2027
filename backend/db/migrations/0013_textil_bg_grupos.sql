-- Produção BG (2026-09-29): a receita passa a ter só dois grupos — BAIXO GIRO
-- ANTIGO e BAIXO GIRO NOVO. Documentos 'textil_bg' que já tenham sido criados
-- com os 9 produtos padrão da Produção Core são convertidos SOMENTE se nenhum
-- deles tiver volume ou preço preenchido (nada digitado é alterado ou
-- descartado). Idempotente: depois de convertido, deixa de ter 9 produtos.
-- Defensiva: `arr` é sempre um array (mesmo se o documento estiver fora do
-- formato), para nenhuma função de array falhar e travar a subida do servidor.
UPDATE orcamentos AS o
SET dados = jsonb_set(
  o.dados,
  '{receita,produtos}',
  jsonb_build_array(
    jsonb_build_object('id', 'bgantigo', 'nome', 'BAIXO GIRO ANTIGO',
      'volumes', to_jsonb(array_fill(''::text, ARRAY[12])), 'precos', to_jsonb(array_fill(''::text, ARRAY[12]))),
    jsonb_build_object('id', 'bgnovo01', 'nome', 'BAIXO GIRO NOVO',
      'volumes', to_jsonb(array_fill(''::text, ARRAY[12])), 'precos', to_jsonb(array_fill(''::text, ARRAY[12])))
  )
)
FROM (
  SELECT id,
         CASE WHEN jsonb_typeof(dados->'receita'->'produtos') = 'array'
              THEN dados->'receita'->'produtos' ELSE '[]'::jsonb END AS arr
  FROM orcamentos
  WHERE unidade_id = 'textil_bg'
) AS s
WHERE o.id = s.id
  AND jsonb_array_length(s.arr) = 9
  AND s.arr->0->>'nome' = 'ALGODAO PENTEADO 1,20'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(s.arr) AS p
    CROSS JOIN LATERAL (VALUES
      (CASE WHEN jsonb_typeof(p->'volumes') = 'array' THEN p->'volumes' ELSE '[]'::jsonb END),
      (CASE WHEN jsonb_typeof(p->'precos') = 'array' THEN p->'precos' ELSE '[]'::jsonb END),
      (CASE WHEN jsonb_typeof(p->'precoMoeda') = 'array' THEN p->'precoMoeda' ELSE '[]'::jsonb END)
    ) AS campos(lista)
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(campos.lista) AS v WHERE btrim(v) <> '')
  );
