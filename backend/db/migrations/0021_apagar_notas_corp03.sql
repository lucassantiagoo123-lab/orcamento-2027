-- Apaga as três notas gerenciais do ajuste (já desfeito) de CORP03 —
-- Consultórias PJs, a pedido do usuário (2026-09-29). Só remove essas notas
-- pela chave; nenhum dado de orçamento ou de referência 2026 é tocado.
DELETE FROM notas_gerenciais
WHERE chave IN ('mover-corp03-financeiro-csc', 'corp03-somente-2026', 'corp03-2026-volta-financeiro');
