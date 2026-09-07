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
  // Upload de arquivo (2026-09-07, ver api/premissasMacro.js): quando o body
  // já é um FormData (multipart), manda como está — sem JSON.stringify e
  // sem forçar Content-Type: application/json (o browser define o
  // Content-Type multipart/form-data com o boundary certo sozinho; setar na
  // mão quebraria o upload).
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const res = await fetch(BASE + path, {
    ...options,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    body: isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
  });

  if (res.status === 204) return null;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}
