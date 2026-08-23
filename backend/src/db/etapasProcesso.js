// Etapas do processo orçamentário (cronograma do FP&A) — pedido de
// 2026-08-23, ver migração 0004_etapas_processo.sql pra contexto completo
// (antes vivia só em localStorage do navegador do Admin FP&A que ajustava as
// datas). Guarda só inicio/fim por id — nome/ordem continuam vindos da
// constante ETAPAS_PROCESSO_PADRAO no frontend, igual premissas_macro faz
// com PREMISSAS_MACRO_REF.
import { pool } from './pool.js';

export async function listarEtapasProcesso() {
  const { rows } = await pool.query(
    `SELECT id, inicio, fim, atualizado_em, atualizado_por FROM etapas_processo`
  );
  return rows;
}

export async function atualizarEtapaProcesso(id, inicio, fim, usuarioId) {
  const { rows } = await pool.query(
    `INSERT INTO etapas_processo (id, inicio, fim, atualizado_em, atualizado_por)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (id) DO UPDATE SET inicio = $2, fim = $3, atualizado_em = now(), atualizado_por = $4
     RETURNING id, inicio, fim, atualizado_em, atualizado_por`,
    [id, inicio || null, fim || null, usuarioId]
  );
  return rows[0];
}
