// Resolve req.usuario a partir do cookie de sessão, consultando o banco a
// cada request (perfil, vínculos, ativo — nunca cacheado no token). Testes de
// autorização (seção 6, casos 3 e 6) dependem disto: concessão expirada e
// usuário desativado devem perder acesso imediatamente, sem precisar de novo
// login nem de token expirar.
import { lerUsuarioIdDaSessao } from '../auth/session.js';
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
  next();
}
