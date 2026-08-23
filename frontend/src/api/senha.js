import { apiFetch } from './client.js';

export const loginSenha = (email, senha) =>
  apiFetch('/auth/login-senha', { method: 'POST', body: { email, senha } });

export const alterarSenha = (senhaAtual, senhaNova) =>
  apiFetch('/auth/alterar-senha', { method: 'POST', body: { senhaAtual, senhaNova } });

export const definirSenhaUsuario = (usuarioId, senha) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/senha`, { method: 'POST', body: { senha } });

// Pedido de 2026-08-23: manda a senha atual (texto puro, ver senha_texto no
// backend) por e-mail pro próprio usuário — botão "Enviar acesso por
// e-mail" no Painel de Administração.
export const enviarAcessoUsuario = (usuarioId) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/enviar-acesso`, { method: 'POST' });
