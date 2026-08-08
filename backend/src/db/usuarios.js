import { pool } from './pool.js';

/** Usuário completo por id, incluindo vínculos de unidade/CC e concessões
 * temporárias ativas — a fonte única de verdade para autorização (seção 4). */
export async function buscarUsuarioComEscopo(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  const usuario = rows[0];
  if (!usuario) return null;

  const [unidades, ccs, concessoes] = await Promise.all([
    pool.query(`SELECT unidade_id FROM usuario_unidade WHERE usuario_id = $1`, [usuarioId]),
    pool.query(`SELECT cc_codigo FROM usuario_cc_corporativo WHERE usuario_id = $1`, [usuarioId]),
    pool.query(
      `SELECT cc_codigo FROM concessao_acesso_temporaria
       WHERE usuario_id = $1 AND revogado_em IS NULL AND now() BETWEEN valido_de AND valido_ate`,
      [usuarioId]
    ),
  ]);

  return {
    ...usuario,
    unidadesPermitidas: unidades.rows.map((r) => r.unidade_id),
    ccsPermitidos: [
      ...new Set([...ccs.rows.map((r) => r.cc_codigo), ...concessoes.rows.map((r) => r.cc_codigo)]),
    ],
  };
}

export async function buscarUsuarioPorEmail(email) {
  const { rows } = await pool.query(`SELECT id, ativo FROM usuarios WHERE email = $1`, [
    email.toLowerCase(),
  ]);
  return rows[0] || null;
}

/** Igual a buscarUsuarioPorEmail, mas inclui senha_hash — só para o fluxo de
 * login por senha (auth/routes.js /login-senha). Mantido separado da versão
 * acima pra não vazar senha_hash em nenhum outro lugar sem querer. */
export async function buscarUsuarioComSenhaPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, ativo, senha_hash FROM usuarios WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

export async function definirSenha(usuarioId, senhaHash) {
  await pool.query(`UPDATE usuarios SET senha_hash = $2 WHERE id = $1`, [usuarioId, senhaHash]);
}

export async function registrarLogin(usuarioId) {
  await pool.query(`UPDATE usuarios SET ultimo_login = now() WHERE id = $1`, [usuarioId]);
}
