// Premissas macroeconômicas do ciclo (IPCA, Câmbio, Selic, PIB) — pedido de
// 2026-08-20, ver migração 0003_premissas_macro.sql pra contexto completo
// (antes vivia só em estado local do navegador do Admin FP&A).
import { pool } from './pool.js';

export async function listarPremissasMacro() {
  const { rows } = await pool.query(
    `SELECT id, valor, fonte, atualizado_em, atualizado_por FROM premissas_macro`
  );
  return rows;
}

export async function atualizarPremissaMacro(id, valor, fonte, usuarioId) {
  const { rows } = await pool.query(
    `INSERT INTO premissas_macro (id, valor, fonte, atualizado_em, atualizado_por)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (id) DO UPDATE SET valor = $2, fonte = $3, atualizado_em = now(), atualizado_por = $4
     RETURNING id, valor, fonte, atualizado_em, atualizado_por`,
    [id, valor, fonte || 'Manual', usuarioId]
  );
  return rows[0];
}
