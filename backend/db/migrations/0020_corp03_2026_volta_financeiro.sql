-- Ajuste gerencial de CORP03 — Consultórias PJs desfeito por completo: a
-- referência 2026 volta para o CC Financeiro (0000102). O orçamento 2027 já
-- havia sido devolvido pela 0019 e não é tocado aqui.
--
-- Só mexe na tabela de REFERÊNCIA 2026 (somente leitura): o valor de CORP03 do
-- CSC (102) volta para o Financeiro. Se o Financeiro já tiver um valor em
-- CORP03 (não deveria), nada é movido e a nota avisa. Qualquer falha desfaz o
-- bloco e é registrada na nota, sem derrubar a subida do servidor. Idempotente.
DO $$
DECLARE
  v_chave   CONSTANT TEXT := 'corp03-2026-volta-financeiro';
  v_titulo  CONSTANT TEXT := 'CORP03 — Consultórias PJs: 2026 volta para o Financeiro';
  v_csc     NUMERIC;
  v_fin     NUMERIC;
  v_movido  BOOLEAN := false;
  v_texto   TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM notas_gerenciais WHERE chave = v_chave) THEN
    RETURN;
  END IF;

  BEGIN
    SELECT valor INTO v_csc FROM referencia_2026
    WHERE unidade_id = 'corporativo' AND cc_codigo = '102' AND conta_codigo = 'CORP03';
    SELECT valor INTO v_fin FROM referencia_2026
    WHERE unidade_id = 'corporativo' AND cc_codigo = '0000102' AND conta_codigo = 'CORP03';

    IF v_csc IS NOT NULL AND v_fin IS NULL THEN
      INSERT INTO referencia_2026 (unidade_id, cc_codigo, conta_codigo, valor)
      VALUES ('corporativo', '0000102', 'CORP03', v_csc);
      DELETE FROM referencia_2026
      WHERE unidade_id = 'corporativo' AND cc_codigo = '102' AND conta_codigo = 'CORP03';
      v_movido := true;
    END IF;

    v_texto := 'Ajuste gerencial desfeito: a conta analítica CORP03 — Consultórias PJs permanece no CC Financeiro (0000102), tanto no orçamento 2027 quanto na referência 2026. '
      || CASE
           WHEN v_movido THEN 'A referência 2026 de CORP03 (R$ ' || replace(to_char(v_csc, 'FM999999990.00'), '.', ',') || ') voltou do CSC para o Financeiro, sem alteração de valor.'
           WHEN v_csc IS NULL THEN 'Não havia referência 2026 de CORP03 no CSC para devolver.'
           ELSE 'ATENÇÃO: o Financeiro já tinha um valor de CORP03 na referência 2026, então nada foi movido — a devolução precisa ser feita manualmente.'
         END;

    INSERT INTO notas_gerenciais (chave, unidade_id, titulo, texto, detalhe)
    VALUES (v_chave, 'corporativo', v_titulo, v_texto, jsonb_build_object('referencia2026Devolvida', v_movido, 'valor2026', v_csc));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO notas_gerenciais (chave, unidade_id, titulo, texto, detalhe)
    VALUES (
      v_chave, 'corporativo', v_titulo,
      'ATENÇÃO: a devolução automática da referência 2026 de CORP03 ao Financeiro FALHOU e foi desfeita (nada foi alterado). Erro: ' || SQLERRM,
      jsonb_build_object('referencia2026Devolvida', false, 'erro', SQLERRM)
    );
  END;
END $$;
