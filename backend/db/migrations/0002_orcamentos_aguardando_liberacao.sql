-- Pedido de 2026-08-16: "travar novo envio até FP&A liberar" — depois que o
-- gestor envia uma versão, o botão "Enviar versão" fica bloqueado até um
-- Admin FP&A liberar explicitamente (POST /:unidadeId/liberar-reenvio).
-- Idempotente (IF NOT EXISTS).
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS aguardando_liberacao BOOLEAN NOT NULL DEFAULT false;
