import { pool } from './pool.js';

export async function listarPeriodosEdicao() {
  const { rows } = await pool.query(
    `SELECT p.unidade_id, p.encerrado, p.alterado_em, u.nome AS alterado_por_nome
     FROM periodo_edicao_cc p LEFT JOIN usuarios u ON u.id = p.alterado_por`
  );
  return rows;
}

export async function edicaoEncerrada(unidadeId) {
  const { rows } = await pool.query(`SELECT encerrado FROM periodo_edicao_cc WHERE unidade_id = $1`, [unidadeId]);
  return rows[0]?.encerrado === true;
}

export async function definirPeriodoEdicao(unidadeId, encerrado, usuarioId) {
  const { rows } = await pool.query(
    `INSERT INTO periodo_edicao_cc (unidade_id, encerrado, alterado_em, alterado_por)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (unidade_id) DO UPDATE SET encerrado = $2, alterado_em = now(), alterado_por = $3
     RETURNING unidade_id, encerrado, alterado_em`,
    [unidadeId, encerrado, usuarioId]
  );
  return rows[0];
}
