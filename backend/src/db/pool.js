import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

/** Helper fino — mantém as queries explícitas nos módulos de domínio (sem ORM),
 * conforme o schema em db/schema.sql. */
export async function query(text, params) {
  return pool.query(text, params);
}
