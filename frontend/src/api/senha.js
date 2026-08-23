import { apiFetch } from './client.js';

export const loginSenha = (email, senha) =>
  apiFetch('/auth/login-senha', { method: 'POST', body: { email, senha } });

export const alterarSenha = (senhaAtual, senhaNova) =>
  apiFetch('/auth/alterar-senha', { method: 'POST', body: { senhaAtual, senhaNova } });

export const definirSenhaUsuario = (usuarioId, senha) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/senha`, { method: 'POST', body: { senha } });

// Manda a senha atual (texto puro, ver senha_texto no backend) por e-mail
// pro próprio usuário via SMTP do servidor — POST /api/admin/usuarios/:id/
// enviar-acesso, pedido de 2026-08-23. Sem função chamadora na UI no
// momento: o botão "Abrir no Outlook" em AdminPanel.jsx (mailto:, não
// depende de SMTP configurado) tomou o lugar dele porque SMTP_HOST/
// SMTP_USER/SMTP_PASS ainda não estão configurados no Railway. A rota
// continua funcionando no backend — reaproveitar esta função aqui se/quando
// o SMTP for configurado e um envio em massa (sem clicar um a um) fizer
// sentido.
export const enviarAcessoUsuario = (usuarioId) =>
  apiFetch(`/api/admin/usuarios/${usuarioId}/enviar-acesso`, { method: 'POST' });
