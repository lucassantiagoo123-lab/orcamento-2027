import { apiFetch } from './client.js';

export const loginSenha = (email, senha) =>
  apiFetch('/auth/login-senha', { method: 'POST', body: { email, senha } });

export const alterarSenha = (senhaAtual, senhaNova) =>
  apiFetch('/auth/alterar-senha', { method: 'POST', body: { senhaAtual, senhaNova } });

export const definirSenhaUsuario = (usuarioId, senha) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/senha`, { method: 'POST', body: { senha } });
