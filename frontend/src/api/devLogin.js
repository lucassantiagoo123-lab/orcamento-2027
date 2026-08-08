import { apiFetch } from './client.js';

/** null se o backend não expuser /health, ou se DEV_LOGIN_ENABLED estiver
 * desligado — nesse caso a tela de login não deve nem tentar mostrar o
 * formulário de login-dev. */
export async function verificarStatusBackend() {
  try {
    return await apiFetch('/health');
  } catch {
    return null;
  }
}

export function devLogin(email) {
  return apiFetch('/auth/dev-login', { method: 'POST', body: { email } });
}
