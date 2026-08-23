import { apiFetch } from './client.js';

// Etapas do processo orçamentário e backlog de envios — pedido de
// 2026-08-23, antes só viviam em localStorage (ver
// backend/db/migrations/0004_etapas_processo.sql pra contexto completo).
export async function listarEtapasProcesso() {
  const { etapas } = await apiFetch('/api/processo/etapas');
  return etapas;
}

export async function atualizarEtapaProcesso(id, inicio, fim) {
  const { etapa } = await apiFetch(`/api/processo/etapas/${id}`, {
    method: 'PUT',
    body: { inicio, fim },
  });
  return etapa;
}

// Só admin_fpa — ver processoRouter no backend.
export async function listarBacklog() {
  const { backlog } = await apiFetch('/api/processo/backlog');
  return backlog;
}
