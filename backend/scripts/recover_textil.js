// Script de recuperação pontual — restaura custos da Têxtil a partir do
// log_alteracoes (entrada id=21065, antes do dado ser zerado em 16:32:52).
// Uso: DATABASE_URL=<url_do_railway> node backend/scripts/recover_textil.js

import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Verifica o tamanho do valor a restaurar
    const check = await client.query(
      `SELECT id, criado_em, length(valor_anterior) as tam FROM log_alteracoes WHERE id = 21065`
    );
    if (!check.rows[0]) { console.error('Log id 21065 não encontrado.'); process.exit(1); }
    console.log('Recuperando de:', check.rows[0]);

    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE orcamentos
      SET dados = jsonb_set(dados, '{custos}',
            (SELECT valor_anterior::jsonb FROM log_alteracoes WHERE id = 21065)),
          atualizado_em = now()
      WHERE unidade_id = 'textil' AND ano = 2027
      RETURNING id, unidade_id, length(dados::text) as tamanho
    `);
    if (result.rows[0]) {
      console.log('Recuperado com sucesso:', result.rows[0]);
      await client.query('COMMIT');
    } else {
      console.error('Nenhuma linha atualizada — verifique unidade_id e ano.');
      await client.query('ROLLBACK');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
