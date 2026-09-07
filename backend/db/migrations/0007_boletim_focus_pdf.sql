-- Pedido de 2026-09-07: "ao invés de atualizar o boletim focus, troque pela
-- opção de importar o pdf do boletim focus apenas para referência" — o botão
-- antigo (buscarBoletimFocus no frontend, fetch direto na API do BCB a
-- partir do navegador) nunca funcionava de verdade neste ambiente (erro
-- "Não foi possível conectar ao Boletim Focus a partir deste ambiente").
--
-- Guarda só o PDF mais recente enviado (linha única, id fixo 1, upsert a
-- cada novo envio) — é puramente documento de referência: ninguém lê ou
-- extrai valor automaticamente dele, os campos de IPCA/Câmbio/Selic/PIB
-- continuam 100% preenchidos manualmente pelo Admin FP&A (mesmo fluxo de
-- sempre, ver PUT /api/premissas-macro/:id).
CREATE TABLE IF NOT EXISTS boletim_focus_pdf (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome_arquivo  TEXT NOT NULL,
  conteudo      BYTEA NOT NULL,
  tamanho_bytes INTEGER NOT NULL,
  enviado_por   UUID REFERENCES usuarios(id),
  enviado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
