-- ARA Têxtil virou família em 2026-09-29: 'textil' (Produção Core, orçamento
-- que já existia — nenhum dado é movido ou alterado), 'textil_bg' (Produção BG,
-- mesma estrutura) e 'textil_consolidado' (soma das duas). Quem já tinha acesso
-- à Têxtil passa a ter às duas seções novas; Gestor de CC ganha os mesmos CCs na
-- Produção BG. Só INSERT ... ON CONFLICT DO NOTHING: idempotente e sem apagar nada.
INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT usuario_id, novo.unidade_id
FROM usuario_unidade
CROSS JOIN (VALUES ('textil_bg'), ('textil_consolidado')) AS novo(unidade_id)
WHERE usuario_unidade.unidade_id = 'textil'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_cc_corporativo (usuario_id, unidade_id, cc_codigo)
SELECT usuario_id, 'textil_bg', cc_codigo
FROM usuario_cc_corporativo
WHERE unidade_id = 'textil'
ON CONFLICT DO NOTHING;
