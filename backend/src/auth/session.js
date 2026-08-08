// Sessão própria da aplicação, independente do token do Entra ID.
//
// Por quê: o id_token do Entra ID prova "quem é essa pessoa" no momento do
// login, mas perfil/vínculos de unidade/CC podem mudar depois (ex.: FP&A
// revoga acesso, desativa usuário). Por isso o cookie de sessão carrega só o
// usuario_id; toda autorização é resolvida a partir do banco a cada request
// (ver middleware/authenticate.js e middleware/authorize.js), nunca a partir
// de algo assinado uma vez no login — é exatamente a regra da seção 4 da
// especificação ("a interface esconder algo não é controle de acesso").
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const COOKIE_NAME = 'obz_session';

export function emitirSessao(res, usuarioId) {
  const token = jwt.sign({ sub: usuarioId }, config.session.jwtSecret, {
    expiresIn: `${config.session.ttlMinutes}m`,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: config.session.ttlMinutes * 60 * 1000,
  });
}

export function limparSessao(res) {
  res.clearCookie(COOKIE_NAME);
}

/** Retorna o usuario_id do cookie de sessão, ou null se ausente/inválido/expirado. */
export function lerUsuarioIdDaSessao(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.session.jwtSecret);
    return payload.sub;
  } catch {
    return null; // expirado ou adulterado — trata como não autenticado
  }
}

export { COOKIE_NAME };
