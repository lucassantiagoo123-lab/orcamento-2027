-- Período de edição dos Gestores de CC, por unidade (2026-09-23): o Admin
-- FP&A encerra/reabre no painel de Administração. Encerrado = Gestor de CC
-- só visualiza (PUT/enviar recusados no servidor). Sem linha = aberto.
CREATE TABLE IF NOT EXISTS periodo_edicao_cc (
  unidade_id    TEXT PRIMARY KEY,
  encerrado     BOOLEAN NOT NULL DEFAULT false,
  alterado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  alterado_por  UUID REFERENCES usuarios(id)
);
