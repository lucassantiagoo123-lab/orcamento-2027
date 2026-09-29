// Referência 2026 (somente leitura) e conclusão de CC — ver migração
// 0015_referencia_2026_conclusao_cc.sql. `ccs` null = sem filtro (Admin FP&A e
// Gestor da Unidade); array = só esses CCs (Gestor de CC).
import { pool } from './pool.js';

export async function listarReferencia2026(unidadeId, ccs) {
  const { rows } = await pool.query(
    `SELECT cc_codigo, conta_codigo, valor::float8 AS valor
     FROM referencia_2026
     WHERE unidade_id = $1 AND ($2::text[] IS NULL OR cc_codigo = ANY($2))`,
    [unidadeId, ccs]
  );
  return rows.map((r) => ({ ccCodigo: r.cc_codigo, contaCodigo: r.conta_codigo, valor: r.valor }));
}

export async function listarConclusoes(unidadeId, ccs) {
  const { rows } = await pool.query(
    `SELECT c.cc_codigo, c.concluido_em, u.nome AS concluido_por_nome
     FROM conclusao_cc c LEFT JOIN usuarios u ON u.id = c.concluido_por
     WHERE c.unidade_id = $1 AND ($2::text[] IS NULL OR c.cc_codigo = ANY($2))`,
    [unidadeId, ccs]
  );
  return rows.map((r) => ({ ccCodigo: r.cc_codigo, concluidoEm: r.concluido_em, concluidoPorNome: r.concluido_por_nome }));
}

export async function ccsConcluidos(unidadeId) {
  const { rows } = await pool.query(`SELECT cc_codigo FROM conclusao_cc WHERE unidade_id = $1`, [unidadeId]);
  return new Set(rows.map((r) => r.cc_codigo));
}

export async function concluirCc(unidadeId, ccCodigo, usuarioId) {
  await pool.query(
    `INSERT INTO conclusao_cc (unidade_id, cc_codigo, concluido_por) VALUES ($1, $2, $3)
     ON CONFLICT (unidade_id, cc_codigo) DO NOTHING`,
    [unidadeId, ccCodigo, usuarioId]
  );
}

export async function liberarCc(unidadeId, ccCodigo) {
  await pool.query(`DELETE FROM conclusao_cc WHERE unidade_id = $1 AND cc_codigo = $2`, [unidadeId, ccCodigo]);
}
