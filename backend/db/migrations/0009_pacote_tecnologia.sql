-- Migração 0009: move contas de TI para o novo pacote 'tecnologia'
-- Têxtil:     71102002, 34104007, 34202003  saem de 'locacao'
-- Corporativo: CORP09, CORP10              saem de 'locacao'
--              CORP11                      sai  de 'administrativo_utilidades'
-- Garante que valores já preenchidos não sejam perdidos.

DO $$
DECLARE
  rec       RECORD;
  cc_key    TEXT;
  nd        JSONB;
  conta     TEXT;
  pacote_origem TEXT;
BEGIN

  -- -----------------------------------------------------------------------
  -- TÊXTIL
  -- -----------------------------------------------------------------------
  FOR rec IN SELECT id, dados FROM orcamentos WHERE unidade_id = 'textil' LOOP
    nd := rec.dados;
    FOR cc_key IN SELECT key FROM jsonb_object_keys(COALESCE(nd->'custos', '{}'::jsonb)) key LOOP
      FOREACH conta IN ARRAY ARRAY['71102002','34104007','34202003'] LOOP
        IF (nd->'custos'->cc_key->'locacao') ? conta THEN
          nd := jsonb_set(nd, ARRAY['custos', cc_key, 'tecnologia', conta],
                nd->'custos'->cc_key->'locacao'->conta);
          nd := nd #- ARRAY['custos', cc_key, 'locacao', conta];
        END IF;
      END LOOP;
    END LOOP;
    UPDATE orcamentos SET dados = nd WHERE id = rec.id;
  END LOOP;

  -- -----------------------------------------------------------------------
  -- CORPORATIVO
  -- -----------------------------------------------------------------------
  FOR rec IN SELECT id, dados FROM orcamentos WHERE unidade_id = 'corporativo' LOOP
    nd := rec.dados;
    FOR cc_key IN SELECT key FROM jsonb_object_keys(COALESCE(nd->'custos', '{}'::jsonb)) key LOOP
      -- CORP09, CORP10 saem de locacao
      FOREACH conta IN ARRAY ARRAY['CORP09','CORP10'] LOOP
        IF (nd->'custos'->cc_key->'locacao') ? conta THEN
          nd := jsonb_set(nd, ARRAY['custos', cc_key, 'tecnologia', conta],
                nd->'custos'->cc_key->'locacao'->conta);
          nd := nd #- ARRAY['custos', cc_key, 'locacao', conta];
        END IF;
      END LOOP;
      -- CORP11 sai de administrativo_utilidades
      IF (nd->'custos'->cc_key->'administrativo_utilidades') ? 'CORP11' THEN
        nd := jsonb_set(nd, ARRAY['custos', cc_key, 'tecnologia', 'CORP11'],
              nd->'custos'->cc_key->'administrativo_utilidades'->'CORP11');
        nd := nd #- ARRAY['custos', cc_key, 'administrativo_utilidades', 'CORP11'];
      END IF;
    END LOOP;
    UPDATE orcamentos SET dados = nd WHERE id = rec.id;
  END LOOP;

END $$;
