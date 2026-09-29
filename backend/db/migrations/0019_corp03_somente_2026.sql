-- Correção do ajuste gerencial de CORP03 — Consultórias PJs (0018): a migração
-- do Financeiro (0000102) para o CSC (102) vale SÓ para a referência 2026
-- (comparativo). O orçamento 2027 volta para o CC em que estava.
--
-- O que este script faz: devolve custos.linhas['102|CORP03'] para
-- custos.linhas['0000102|CORP03'] — mas SÓ se, desde a 0018, ninguém mexeu em
-- nenhum dos dois lados:
--   * a linha do CSC ainda é IDÊNTICA à linha que foi movida (guardada na nota);
--   * a posição do Financeiro está vazia (ou nem existe).
-- Se qualquer um dos dois foi alterado, NADA é movido (não sobrescreve dado
-- preenchido) e a nota avisa que a devolução precisa ser feita manualmente.
-- A referência 2026 (CSC) não é tocada. Qualquer falha desfaz o bloco e é
-- registrada na nota, sem derrubar a subida do servidor. Idempotente.
DO $$
DECLARE
  v_chave    CONSTANT TEXT := 'corp03-somente-2026';
  v_titulo   CONSTANT TEXT := 'CORP03 — ajuste vale só para 2026';
  v_nota0018 RECORD;
  v_orc      RECORD;
  v_original JSONB;
  v_csc      JSONB;
  v_fin      JSONB;
  v_fin_cheio BOOLEAN := false;
  v_devolvido BOOLEAN := false;
  v_texto    TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM notas_gerenciais WHERE chave = v_chave) THEN
    RETURN;
  END IF;

  BEGIN
    SELECT detalhe INTO v_nota0018 FROM notas_gerenciais WHERE chave = 'mover-corp03-financeiro-csc';
    IF NOT FOUND THEN
      RETURN; -- 0018 nunca rodou: nada a corrigir
    END IF;

    IF COALESCE((v_nota0018.detalhe->>'orcamentoMovido')::boolean, false) THEN
      v_original := v_nota0018.detalhe->'linhaOriginalFinanceiro';
      SELECT id, dados INTO v_orc FROM orcamentos WHERE unidade_id = 'corporativo' AND ano = 2027;
      IF FOUND THEN
        v_csc := v_orc.dados #> '{custos,linhas,102|CORP03}';
        v_fin := v_orc.dados #> '{custos,linhas,0000102|CORP03}';

        IF v_fin IS NOT NULL THEN
          SELECT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_fin->'sublinhas') = 'array' THEN v_fin->'sublinhas' ELSE '[]'::jsonb END) AS s(el)
            CROSS JOIN (VALUES ('valores'), ('quantidades'), ('valoresUnit'), ('baseManual'), ('percentuais'), ('valoresPagamento')) AS c(campo)
            CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.el->c.campo) = 'array' THEN s.el->c.campo ELSE '[]'::jsonb END) AS v(x)
            WHERE btrim(v.x) <> ''
          ) OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_fin->'sublinhas') = 'array' THEN v_fin->'sublinhas' ELSE '[]'::jsonb END) AS s(el)
            WHERE btrim(COALESCE(s.el->>'justificativa', '')) <> '' OR btrim(COALESCE(s.el->>'descricao', '')) <> ''
          ) INTO v_fin_cheio;
        END IF;

        IF v_csc IS NOT NULL AND v_original IS NOT NULL AND v_csc = v_original AND NOT v_fin_cheio THEN
          UPDATE orcamentos
          SET dados = jsonb_set(dados #- '{custos,linhas,102|CORP03}', '{custos,linhas,0000102|CORP03}', v_csc, true)
          WHERE id = v_orc.id;
          v_devolvido := true;
        END IF;
      END IF;
    END IF;

    v_texto := 'Correção: a migração de CORP03 — Consultórias PJs do Financeiro para o CSC vale somente para a referência 2026 (comparativo). '
      || CASE
           WHEN v_devolvido THEN 'O orçamento 2027 voltou para o CC Financeiro (0000102), exatamente como estava, sem alteração de valor.'
           WHEN NOT COALESCE((v_nota0018.detalhe->>'orcamentoMovido')::boolean, false) THEN 'O orçamento 2027 não havia sido movido; nada a devolver.'
           ELSE 'ATENÇÃO: o orçamento 2027 NÃO foi devolvido automaticamente porque a linha do CSC ou a do Financeiro foi alterada depois da migração — a devolução precisa ser feita manualmente.'
         END;

    INSERT INTO notas_gerenciais (chave, unidade_id, titulo, texto, detalhe)
    VALUES (v_chave, 'corporativo', v_titulo, v_texto, jsonb_build_object('orcamentoDevolvido', v_devolvido));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO notas_gerenciais (chave, unidade_id, titulo, texto, detalhe)
    VALUES (
      v_chave, 'corporativo', v_titulo,
      'ATENÇÃO: a correção automática (CORP03 somente em 2026) FALHOU e foi desfeita (nada foi alterado). Erro: ' || SQLERRM,
      jsonb_build_object('orcamentoDevolvido', false, 'erro', SQLERRM)
    );
  END;
END $$;
