// Resolve req.usuario a partir do cookie de sessão, consultando o banco a
// cada request (perfil, vínculos, ativo — nunca cacheado no token). Testes de
// autorização (seção 6, casos 3 e 6) dependem disto: concessão expirada e
// usuário desativado devem perder acesso imediatamente, sem precisar de novo
// login nem de token expirar.
import { lerUsuarioIdDaSessao, emitirSessao } from '../auth/session.js';
import { buscarUsuarioComEscopo } from '../db/usuarios.js';

export async function authenticate(req, res, next) {
  const usuarioId = lerUsuarioIdDaSessao(req);
  if (!usuarioId) {
    return res.status(401).json({ erro: 'nao_autenticado' });
  }

  const usuario = await buscarUsuarioComEscopo(usuarioId);
  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ erro: 'nao_autenticado' }); // sessão válida, mas usuário sumiu/foi desativado
  }

  req.usuario = usuario;
  // Renovação deslizante (2026-09-08, pedido: "o tempo de não autenticado
  // está sendo muito rápido") — sem isto, a sessão expirava num relógio
  // fixo desde o login (SESSION_TTL_MINUTES), mesmo com o usuário
  // ativamente usando a plataforma. Reemitir o cookie a cada request
  // autenticado estende o prazo pra "SESSION_TTL_MINUTES a partir de
  // agora" — só desloga depois de SESSION_TTL_MINUTES de INATIVIDADE de
  // verdade (nenhum request, nem o autosave), não mais num teto fixo.
  emitirSessao(res, usuarioId);
  next();
}
