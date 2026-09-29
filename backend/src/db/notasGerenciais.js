// Notas de ajustes gerenciais (ex.: migração de conta entre CCs) — ver migração
// 0018. Visíveis só para o Admin FP&A (a rota exige o perfil).
import { pool } from './pool.js';

export async function listarNotasGerenciais(unidadeId) {
  const { rows } = await pool.query(
    `SELECT id, titulo, texto, criado_em FROM notas_gerenciais WHERE unidade_id = $1 ORDER BY criado_em DESC, id DESC`,
    [unidadeId]
  );
  return rows.map((r) => ({ id: r.id, titulo: r.titulo, texto: r.texto, criadoEm: r.criado_em }));
}
