import { pool } from './pool.js';

/** Usuário completo por id, incluindo vínculos de unidade/CC e concessões
 * temporárias ativas — a fonte única de verdade para autorização (seção 4). */
export async function buscarUsuarioComEscopo(usuarioId) {
  // acesso_expira_em/acesso_expirado (2026-08-23, ver migração
  // 0006_acesso_expira_em.sql): "expirado" já calculado no Postgres
  // (CURRENT_DATE), não em JS — exigirAcessoNaoExpirado (middleware/
  // authorize.js) só lê o boolean pronto. TO_CHAR formata a data como texto
  // simples ('AAAA-MM-DD'), sem depender de como o driver serializa DATE.
  const { rows } = await pool.query(
    `SELECT id, nome, email, perfil, ativo,
       TO_CHAR(acesso_expira_em, 'YYYY-MM-DD') AS acesso_expira_em,
       (acesso_expira_em IS NOT NULL AND acesso_expira_em < CURRENT_DATE) AS acesso_expirado
     FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  const usuario = rows[0];
  if (!usuario) return null;

  const [unidades, ccs, concessoes] = await Promise.all([
    pool.query(`SELECT unidade_id FROM usuario_unidade WHERE usuario_id = $1`, [usuarioId]),
    pool.query(`SELECT unidade_id, cc_codigo FROM usuario_cc_corporativo WHERE usuario_id = $1`, [usuarioId]),
    pool.query(
      `SELECT cc_codigo FROM concessao_acesso_temporaria
       WHERE usuario_id = $1 AND revogado_em IS NULL AND now() BETWEEN valido_de AND valido_ate`,
      [usuarioId]
    ),
  ]);

  return {
    ...usuario,
    unidadesPermitidas: unidades.rows.map((r) => r.unidade_id),
    // ccsPermitidos: [{unidadeId, codigo}] — Gestor de CC (pedido de
    // 2026-08-16, antes "Gerente de CC — Corporativo") agora vale para
    // qualquer unidade, então o CC sozinho não basta mais para identificar o
    // vínculo (Agrícola/Resorts reaproveitam os mesmos códigos da Têxtil).
    // Concessões temporárias (seção 4.4) continuam sem unidade própria —
    // unidadeId: null aqui significa "vale em qualquer unidade" (ver
    // podeAcessarCc em middleware/authorize.js).
    ccsPermitidos: [
      ...ccs.rows.map((r) => ({ unidadeId: r.unidade_id, codigo: r.cc_codigo })),
      ...concessoes.rows.map((r) => ({ unidadeId: null, codigo: r.cc_codigo })),
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

// senhaTexto (2026-08-23, pedido explícito — ver migração
// 0005_senha_texto_visivel.sql para o trade-off completo): guardado sempre
// junto com o hash, nunca sozinho, pra nunca ficar dessincronizado do que o
// login de verdade usa (senha_hash).
export async function definirSenha(usuarioId, senhaHash, senhaTexto) {
  await pool.query(
    `UPDATE usuarios SET senha_hash = $2, senha_texto = $3 WHERE id = $1`,
    [usuarioId, senhaHash, senhaTexto]
  );
}

/** Só para POST /api/admin/usuarios/:id/enviar-acesso (2026-08-23) — busca
 * o que o e-mail de acesso precisa (nome, e-mail, senha atual em texto). */
export async function buscarUsuarioParaEnvioAcesso(usuarioId) {
  const { rows } = await pool.query(
    `SELECT nome, email, senha_texto, ativo FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  return rows[0] || null;
}

/** Define o tempo de acesso do usuário (2026-08-23) — null = Indefinido
 * (comportamento de sempre); uma data 'AAAA-MM-DD' = Definido, a partir do
 * dia seguinte o usuário continua vendo o orçamento mas perde a escrita
 * (ver exigirAcessoNaoExpirado em middleware/authorize.js). Sempre um SET
 * explícito (nunca COALESCE) — é a única forma de também poder voltar pra
 * Indefinido (gravando null de propósito). */
export async function definirAcessoExpiracao(usuarioId, acessoExpiraEm) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET acesso_expira_em = $2
     WHERE id = $1
     RETURNING id, TO_CHAR(acesso_expira_em, 'YYYY-MM-DD') AS acesso_expira_em`,
    [usuarioId, acessoExpiraEm]
  );
  return rows[0];
}

export async function registrarLogin(usuarioId) {
  await pool.query(`UPDATE usuarios SET ultimo_login = now() WHERE id = $1`, [usuarioId]);
}

/** E-mails de todos os admin_fpa ativos — usado pela notificação de envio
 * (pedido de 2026-08-16, ver src/email/notificacoes.js). */
export async function listarEmailsAdminFpa() {
  const { rows } = await pool.query(
    `SELECT email FROM usuarios WHERE perfil = 'admin_fpa' AND ativo = true`
  );
  return rows.map((r) => r.email);
}
