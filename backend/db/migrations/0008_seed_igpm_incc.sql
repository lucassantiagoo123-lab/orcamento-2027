-- Pedido de 2026-09-08: inclui IGP-M e INCC nas premissas macroeconômicas do
-- ciclo (ver PREMISSAS_MACRO_REF em OrcamentoARA.jsx), já preenchidas com o
-- valor informado/pesquisado nessa data — o Admin FP&A pode editar depois
-- como qualquer outra premissa.
-- IGP-M: 4,10% (Boletim Focus, valor informado pelo usuário).
-- INCC: 6,56% (INCC-M acumulado 12 meses até agosto/2026 — FGV/IBRE,
-- https://portal.fgv.br/noticias/incc-m-agosto-2026).
-- ON CONFLICT DO NOTHING: se o Admin FP&A já tiver preenchido esses ids na
-- mão antes desta migração rodar (ou se ela for reprocessada), não sobrescreve.
INSERT INTO premissas_macro (id, valor, fonte, atualizado_em) VALUES
  ('igpm', '4,10', 'Boletim Focus', now()),
  ('incc', '6,56', 'FGV/IBRE — INCC-M, acumulado 12 meses (ago/2026)', now())
ON CONFLICT (id) DO NOTHING;
