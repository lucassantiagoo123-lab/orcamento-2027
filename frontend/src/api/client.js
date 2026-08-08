// Wrapper fino de fetch — sempre manda o cookie de sessão (httpOnly, emitido
// pelo backend em /auth/callback) e trata 401/403 de um jeito só.
const BASE = ''; // mesmo host em dev (proxy do vite.config.js) e em produção (mesmo domínio)

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.mensagem || body?.erro || `Erro HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return null;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}
