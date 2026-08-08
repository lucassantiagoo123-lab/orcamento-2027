import { apiFetch, ApiError } from './client.js';

/** Usuário da sessão atual, ou null se não autenticado. Não lança em 401 —
 * essa é a resposta esperada de "ninguém logado", não um erro de rede. */
export async function getMe() {
  try {
    return await apiFetch('/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/** Redireciona o browser inteiro para o fluxo OIDC — não é uma chamada
 * fetch, é navegação (o backend responde com um redirect para o Entra ID). */
export function irParaLogin() {
  window.location.href = '/auth/login';
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' });
}
