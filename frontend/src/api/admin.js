import { apiFetch } from './client.js';

export const listarUsuarios = () => apiFetch('/api/admin/usuarios');
export const criarUsuario = (dados) => apiFetch('/api/admin/usuarios', { method: 'POST', body: dados });
export const atualizarUsuario = (id, dados) => apiFetch(`/api/admin/usuarios/${id}`, { method: 'PATCH', body: dados });

export const vincularUnidade = (usuarioId, unidadeId) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/unidades`, { method: 'POST', body: { unidadeId } });
export const desvincularUnidade = (usuarioId, unidadeId) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/unidades/${unidadeId}`, { method: 'DELETE' });

export const vincularCc = (usuarioId, ccCodigo) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/ccs`, { method: 'POST', body: { ccCodigo } });
export const desvincularCc = (usuarioId, ccCodigo) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/ccs/${ccCodigo}`, { method: 'DELETE' });

export const listarConcessoes = (apenasAtivas = false) =>
  apiFetch(`/api/admin/concessoes${apenasAtivas ? '?ativas=true' : ''}`);
export const criarConcessao = (dados) => apiFetch('/api/admin/concessoes', { method: 'POST', body: dados });
export const revogarConcessao = (id) => apiFetch(`/api/admin/concessoes/${id}/revogar`, { method: 'POST' });
