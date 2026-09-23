import { pool } from './pool.js';

const INTERVALO_EMAIL_MINUTOS = 30;

/** Grava os alertas e diz se vale mandar e-mail — no máximo um por unidade a
 * cada INTERVALO_EMAIL_MINUTOS, pra um bug em loop não inundar a caixa do FP&A. */
export async function registrarAlertas({ unidadeId, usuarioId, alertas }) {
  if (!alertas.length) return { enviarEmail: false };
  const { rows } = await pool.query(
    `SELECT 1 FROM alertas_dados
     WHERE unidade_id = $1 AND criado_em > now() - ($2 || ' minutes')::interval LIMIT 1`,
    [unidadeId, INTERVALO_EMAIL_MINUTOS]
  );
  for (const a of alertas) {
    await pool.query(
      `INSERT INTO alertas_dados (unidade_id, usuario_id, secao, descricao, detalhes)
       VALUES ($1, $2, $3, $4, $5)`,
      [unidadeId, usuarioId, a.secao, a.descricao, JSON.stringify(a.detalhes ?? null)]
    );
  }
  return { enviarEmail: rows.length === 0 };
}

export async function listarAlertas({ pendentes = true, limite = 200 } = {}) {
  const { rows } = await pool.query(
    `SELECT a.id, a.criado_em, a.unidade_id, a.secao, a.descricao, a.detalhes, a.resolvido_em,
            u.nome AS usuario_nome, r.nome AS resolvido_por_nome
     FROM alertas_dados a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     LEFT JOIN usuarios r ON r.id = a.resolvido_por
     WHERE ($1::boolean = false OR a.resolvido_em IS NULL)
     ORDER BY a.criado_em DESC LIMIT $2`,
    [pendentes, limite]
  );
  return rows;
}

export async function contarAlertasPendentes() {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM alertas_dados WHERE resolvido_em IS NULL`);
  return rows[0].n;
}

export async function resolverAlerta(id, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE alertas_dados SET resolvido_em = now(), resolvido_por = $2
     WHERE id = $1 AND resolvido_em IS NULL RETURNING id`,
    [id, usuarioId]
  );
  return rows[0] || null;
}
