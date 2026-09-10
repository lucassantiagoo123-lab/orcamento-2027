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

// Sessão expirada (2026-09-10, pedido: "pop-up central independente...
// indicando que é necessário fazer login novamente") — apiFetch é o único
// lugar por onde toda chamada à API passa, então é o único jeito de pegar um
// 401 nao_autenticado não importa qual tela/ação disparou a requisição (o
// autosave, por exemplo, roda em segundo plano sem o usuário clicar em
// nada). Quem quiser reagir (AppGate) registra um callback aqui — sem
// import circular, client.js não conhece AppGate. AppGate decide se isso é
// de fato "sessão expirou no meio do uso" (ignora o 401 esperado da
// primeira checagem /auth/me, antes de logar — ver getMe em api/auth.js).
let onSessaoExpirada = null;
export function definirCallbackSessaoExpirada(fn) {
  onSessaoExpirada = fn;
}

// Última vez que uma requisição autenticada teve sucesso (2026-09-10) — usa
// pra estimar no cliente quando a sessão deve expirar por inatividade
// (renovação deslizante, ver backend/src/middleware/authenticate.js: todo
// request autenticado reemite o cookie com mais SESSION_TTL_MINUTES pela
// frente). Não é "mexeu o mouse" — é a mesma coisa que o servidor usa (um
// request de verdade), então o aviso do cliente bate com o momento real em
// que o backend vai deslogar.
let ultimaAtividadeEm = Date.now();
export function obterUltimaAtividade() {
  return ultimaAtividadeEm;
}

// comRetentativa (2026-09-10, pedido: "como faço pra evitar isso" — falha de
// rede genuína, ex.: backend reiniciando alguns segundos durante um deploy
// no Railway, mostrava erro já na primeira tentativa) — tenta de novo
// sozinho só quando o erro NÃO é um ApiError (o servidor respondeu de
// verdade; retentar não ajudaria, e numa escrita não-idempotente tipo
// enviar versão poderia até duplicar). Usar só em escritas idempotentes
// (PUT de rascunho — reenviar o mesmo `dados` é seguro), nunca em
// enviarVersao/POST.
export async function comRetentativa(fn, tentativas = 2, esperaMs = 1200) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError || tentativas <= 0) throw e;
    await new Promise((r) => setTimeout(r, esperaMs));
    return comRetentativa(fn, tentativas - 1, esperaMs * 1.5);
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

  // Qualquer resposta que não seja 401 passou pelo `authenticate` do backend
  // com sucesso (mesmo um 403/404 de uma rota específica) — a sessão acabou
  // de ser renovada lá (ver renovação deslizante), então conta como
  // atividade aqui também, não só nos 2xx.
  if (res.status !== 401) ultimaAtividadeEm = Date.now();

  if (!res.ok) {
    if (res.status === 401 && body?.erro === 'nao_autenticado') onSessaoExpirada?.();
    throw new ApiError(res.status, body);
  }
  return body;
}
