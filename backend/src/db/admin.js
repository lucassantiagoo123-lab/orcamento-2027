// Consultas exclusivas da tela de administração (seção 2.4: gerenciar
// usuários e permissões é admin_fpa only — reforçado pelo middleware
// exigirPerfil('admin_fpa') nas rotas, não só aqui).
import { pool } from './pool.js';

export async function listarUsuarios() {
  // senha_texto (2026-08-23, ver migração 0005_senha_texto_visivel.sql):
  // exposto aqui porque esta função só é chamada pelas rotas /api/admin/*,
  // todas atrás de exigirPerfil('admin_fpa') — nunca exposta a outro perfil.
  const { rows: usuarios } = await pool.query(
    `SELECT id, nome, email, perfil, ativo, criado_em, ultimo_login, senha_texto FROM usuarios ORDER BY nome`
  );
  const [unidades, ccs] = await Promise.all([
    pool.query(`SELECT usuario_id, unidade_id FROM usuario_unidade`),
    pool.query(`SELECT usuario_id, unidade_id, cc_codigo FROM usuario_cc_corporativo`),
  ]);
  return usuarios.map((u) => ({
    ...u,
    unidades: unidades.rows.filter((r) => r.usuario_id === u.id).map((r) => r.unidade_id),
    // ccs: [{unidadeId, codigo}] — Gestor de CC (pedido de 2026-08-16) tem
    // no máximo 1 vínculo (ver definirCcUsuario), mas o formato de lista
    // fica pronto caso essa regra mude no futuro.
    ccs: ccs.rows.filter((r) => r.usuario_id === u.id).map((r) => ({ unidadeId: r.unidade_id, codigo: r.cc_codigo })),
  }));
}

export async function criarUsuario({ nome, email, perfil }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, perfil) VALUES ($1, $2, $3) RETURNING *`,
    [nome, email.toLowerCase(), perfil]
  );
  return rows[0];
}

export async function atualizarUsuario(id, { perfil, ativo, nome, email }) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET
       perfil = COALESCE($2, perfil),
       ativo = COALESCE($3, ativo),
       nome = COALESCE($4, nome),
       email = COALESCE($5, email)
     WHERE id = $1 RETURNING *`,
    [id, perfil ?? null, ativo ?? null, nome ?? null, email ? email.toLowerCase() : null]
  );
  return rows[0];
}

export async function vincularUnidade(usuarioId, unidadeId) {
  await pool.query(
    `INSERT INTO usuario_unidade (usuario_id, unidade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [usuarioId, unidadeId]
  );
}
export async function desvincularUnidade(usuarioId, unidadeId) {
  await pool.query(`DELETE FROM usuario_unidade WHERE usuario_id = $1 AND unidade_id = $2`, [usuarioId, unidadeId]);
}

/** Vincula mais um CC ao Gestor de CC (perfil gerente_cc_corporativo) —
 * "um gestor pode ser gestor de mais de um CC" (correção de 2026-08-16 ao
 * pedido original, que tinha sido "só 1 CC"). Não substitui os anteriores. */
export async function vincularCc(usuarioId, unidadeId, ccCodigo) {
  await pool.query(
    `INSERT INTO usuario_cc_corporativo (usuario_id, unidade_id, cc_codigo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [usuarioId, unidadeId, ccCodigo]
  );
}
export async function desvincularCc(usuarioId, unidadeId, ccCodigo) {
  await pool.query(
    `DELETE FROM usuario_cc_corporativo WHERE usuario_id = $1 AND unidade_id = $2 AND cc_codigo = $3`,
    [usuarioId, unidadeId, ccCodigo]
  );
}
/** Limpa todos os CCs do usuário — usado quando a unidade do Gestor de CC
 * muda (os CCs antigos pertenciam à unidade anterior). */
export async function removerTodosCcUsuario(usuarioId) {
  await pool.query(`DELETE FROM usuario_cc_corporativo WHERE usuario_id = $1`, [usuarioId]);
}

// --- Concessões temporárias (seção 4.4) ---

export async function listarConcessoes({ apenasAtivas = false } = {}) {
  const filtro = apenasAtivas
    ? `WHERE c.revogado_em IS NULL AND now() BETWEEN c.valido_de AND c.valido_ate`
    : '';
  const { rows } = await pool.query(
    `SELECT c.*, u.nome AS usuario_nome, u.email AS usuario_email, a.nome AS concedido_por_nome
     FROM concessao_acesso_temporaria c
     JOIN usuarios u ON u.id = c.usuario_id
     JOIN usuarios a ON a.id = c.concedido_por
     ${filtro}
     ORDER BY c.valido_ate DESC`
  );
  return rows;
}

export async function criarConcessao({ usuarioId, ccCodigo, concedidoPor, motivo, validoAte }) {
  const { rows } = await pool.query(
    `INSERT INTO concessao_acesso_temporaria (usuario_id, cc_codigo, concedido_por, motivo, valido_ate)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [usuarioId, ccCodigo, concedidoPor, motivo, validoAte]
  );
  return rows[0];
}

export async function revogarConcessao(id) {
  const { rows } = await pool.query(
    `UPDATE concessao_acesso_temporaria SET revogado_em = now() WHERE id = $1 AND revogado_em IS NULL RETURNING *`,
    [id]
  );
  return rows[0];
}
