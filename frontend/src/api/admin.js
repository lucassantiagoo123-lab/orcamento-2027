import { apiFetch } from './client.js';

export const listarUsuarios = () => apiFetch('/api/admin/usuarios');
export const criarUsuario = (dados) => apiFetch('/api/admin/usuarios', { method: 'POST', body: dados });
export const atualizarUsuario = (id, dados) => apiFetch(`/api/admin/usuarios/${id}`, { method: 'PATCH', body: dados });

export const vincularUnidade = (usuarioId, unidadeId) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/unidades`, { method: 'POST', body: { unidadeId } });
export const desvincularUnidade = (usuarioId, unidadeId) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/unidades/${unidadeId}`, { method: 'DELETE' });

// Gestor de CC (pedido de 2026-08-16): 1 CC só — definirCcUsuario substitui
// qualquer vínculo anterior em vez de acumular.
export const definirCcUsuario = (usuarioId, unidadeId, ccCodigo) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/ccs`, { method: 'POST', body: { unidadeId, ccCodigo } });
export const removerCcUsuario = (usuarioId) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/ccs`, { method: 'DELETE' });

export const listarConcessoes = (apenasAtivas = false) =>
  apiFetch(`/api/admin/concessoes${apenasAtivas ? '?ativas=true' : ''}`);
export const criarConcessao = (dados) => apiFetch('/api/admin/concessoes', { method: 'POST', body: dados });
export const revogarConcessao = (id) => apiFetch(`/api/admin/concessoes/${id}/revogar`, { method: 'POST' });
