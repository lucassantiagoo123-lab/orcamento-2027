import { apiFetch } from './client.js';

// Premissas macroeconômicas do ciclo (IPCA, Câmbio, Selic, PIB) — pedido de
// 2026-08-20, antes só vivia em estado local do navegador (ver
// backend/db/migrations/0003_premissas_macro.sql pra contexto completo).
export async function listarPremissasMacro() {
  const { premissas } = await apiFetch('/api/premissas-macro');
  return premissas;
}

export async function atualizarPremissaMacro(id, valor, fonte) {
  const { premissa } = await apiFetch(`/api/premissas-macro/${id}`, {
    method: 'PUT',
    body: { valor, fonte },
  });
  return premissa;
}
