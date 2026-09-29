-- Ajuste gerencial (Corporativo): a conta analítica CORP03 — Consultórias PJs
-- passa do CC Financeiro (0000102) para o CC CSC (102).
--
-- O que é movido (nenhum valor é alterado, só a chave CC|conta):
--   * orçamento 2027: a linha custos.linhas['0000102|CORP03'] (premissa, valores
--     e justificativa) vira custos.linhas['102|CORP03'];
--   * referência 2026 (somente leitura): o valor anual de CORP03 do Financeiro
--     vai para o CSC, para o comparativo 2026 × 2027 continuar coerente.
-- Segurança: se o CSC já tiver algo preenchido em CORP03, NADA do orçamento é
-- movido (não sobrescreve dado preenchido) e a nota registra o conflito. Se
-- qualquer passo der erro, o bloco inteiro é desfeito e a nota registra a falha
-- (a migração nunca derruba a subida do servidor). A linha original fica
-- guardada em notas_gerenciais.detalhe (reversível). Idempotente: a nota tem
-- chave única; reexecutar não repete a mudança.
CREATE TABLE IF NOT EXISTS notas_gerenciais (
  id         SERIAL PRIMARY KEY,
  chave      TEXT UNIQUE NOT NULL,
  unidade_id TEXT NOT NULL,
  titulo     TEXT NOT NULL,
  texto      TEXT NOT NULL,
  detalhe    JSONB,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_chave    CONSTANT TEXT := 'mover-corp03-financeiro-csc';
  v_titulo   CONSTANT TEXT := 'CORP03 — Consultórias PJs: Financeiro → CSC';
  v_orc      RECORD;
  v_origem   JSONB;
  v_destino  JSONB;
  v_tem_dest BOOLEAN := false;
  v_movido   BOOLEAN := false;
  v_ref_ok   BOOLEAN := false;
  v_valor26  NUMERIC;
  v_texto    TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM notas_gerenciais WHERE chave = v_chave) THEN
    RETURN;
  END IF;

  BEGIN
    SELECT id, dados INTO v_orc FROM orcamentos WHERE unidade_id = 'corporativo' AND ano = 2027;
    IF FOUND THEN
      v_origem  := v_orc.dados #> '{custos,linhas,0000102|CORP03}';
      v_destino := v_orc.dados #> '{custos,linhas,102|CORP03}';

      -- "Preenchido" = algum valor/quantidade/percentual/base digitado, ou texto.
      IF v_destino IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_destino->'sublinhas') = 'array' THEN v_destino->'sublinhas' ELSE '[]'::jsonb END) AS s(el)
          CROSS JOIN (VALUES ('valores'), ('quantidades'), ('valoresUnit'), ('baseManual'), ('percentuais'), ('valoresPagamento')) AS c(campo)
          CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.el->c.campo) = 'array' THEN s.el->c.campo ELSE '[]'::jsonb END) AS v(x)
          WHERE btrim(v.x) <> ''
        ) OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_destino->'sublinhas') = 'array' THEN v_destino->'sublinhas' ELSE '[]'::jsonb END) AS s(el)
          WHERE btrim(COALESCE(s.el->>'justificativa', '')) <> '' OR btrim(COALESCE(s.el->>'descricao', '')) <> ''
        ) INTO v_tem_dest;
      END IF;

      IF v_origem IS NOT NULL AND NOT v_tem_dest THEN
        UPDATE orcamentos
        SET dados = jsonb_set(dados #- '{custos,linhas,0000102|CORP03}', '{custos,linhas,102|CORP03}', v_origem, true)
        WHERE id = v_orc.id;
        v_movido := true;
      END IF;
    END IF;

    -- Referência 2026: só acompanha se o orçamento foi movido (ou não havia linha).
    IF v_movido OR v_origem IS NULL THEN
      SELECT valor INTO v_valor26 FROM referencia_2026
      WHERE unidade_id = 'corporativo' AND cc_codigo = '0000102' AND conta_codigo = 'CORP03';
      IF v_valor26 IS NOT NULL THEN
        INSERT INTO referencia_2026 (unidade_id, cc_codigo, conta_codigo, valor)
        VALUES ('corporativo', '102', 'CORP03', v_valor26)
        ON CONFLICT DO NOTHING;
        DELETE FROM referencia_2026
        WHERE unidade_id = 'corporativo' AND cc_codigo = '0000102' AND conta_codigo = 'CORP03';
        v_ref_ok := true;
      END IF;
    END IF;

    v_texto := 'Ajuste gerencial: migração da conta analítica CORP03 — Consultórias PJs do CC Financeiro (0000102) para o CC CSC (102). '
      || CASE
           WHEN v_movido THEN 'Os lançamentos de 2027 (premissa, valores e justificativa da linha) mudaram de CC sem qualquer alteração de valor'
           WHEN v_origem IS NULL THEN 'Não havia lançamento de 2027 em CORP03 no Financeiro para migrar'
           ELSE 'ATENÇÃO: o CSC já tinha CORP03 preenchida em 2027, então o orçamento NÃO foi movido para não sobrescrever dado preenchido — a migração precisa ser feita manualmente'
         END
      || CASE
           WHEN v_ref_ok THEN '; a referência 2026 de CORP03 (R$ ' || replace(to_char(v_valor26, 'FM999999990.00'), '.', ',') || ') acompanhou a migração, para o comparativo 2026 × 2027 continuar coerente.'
           ELSE '.'
         END
      || ' O bônus de PJs (calculado sobre CORP03) passa a ser apropriado no CSC.';

    INSERT INTO notas_gerenciais (chave, unidade_id, titulo, texto, detalhe)
    VALUES (
      v_chave, 'corporativo', v_titulo, v_texto,
      jsonb_build_object('orcamentoMovido', v_movido, 'referencia2026Movida', v_ref_ok, 'valor2026', v_valor26, 'linhaOriginalFinanceiro', v_origem)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Desfaz tudo o que este bloco fez e registra a falha, sem travar o deploy.
    INSERT INTO notas_gerenciais (chave, unidade_id, titulo, texto, detalhe)
    VALUES (
      v_chave, 'corporativo', v_titulo,
      'ATENÇÃO: a migração automática de CORP03 do Financeiro para o CSC FALHOU e foi desfeita (nada foi alterado). Erro: ' || SQLERRM,
      jsonb_build_object('orcamentoMovido', false, 'erro', SQLERRM)
    );
  END;
END $$;
