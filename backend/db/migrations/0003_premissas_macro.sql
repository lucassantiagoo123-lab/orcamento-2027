-- Pedido de 2026-08-20: premissas macroeconômicas do ciclo (IPCA, Câmbio,
-- Selic, PIB — ver PREMISSAS_MACRO_REF em OrcamentoARA.jsx) até aqui só
-- viviam em estado local do navegador do Admin FP&A que preenchia (perdiam
-- ao recarregar, nunca chegavam a nenhum gestor) — vira uma pendência real
-- com a chegada do "Reajuste Inflação" (tipo de premissa de Custos e
-- Despesas que usa o IPCA anual pra calcular o valor projetado mês a mês):
-- sem persistir, cada gestor veria o IPCA em branco. Uma linha por
-- premissa (id = 'ipca'/'cambio'/'selic'/'pib'), valor em texto (mesmo
-- formato livre digitado no campo — parseNum interpreta na leitura).
-- Idempotente (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS premissas_macro (
  id             TEXT PRIMARY KEY,
  valor          TEXT,
  fonte          TEXT,
  atualizado_em  TIMESTAMPTZ,
  atualizado_por UUID REFERENCES usuarios(id)
);
