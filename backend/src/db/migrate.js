// Migrador de schema — pedido de 2026-08-16 ("não quero que acumule ajustes
// por SQL [manual no Railway]"). Roda sozinho na subida do servidor
// (server.js chama rodarMigracoes() antes de app.listen): lê
// backend/db/migrations/*.sql em ordem, aplica só os que ainda não constam
// na tabela schema_migrations, e registra cada um só depois de aplicado —
// se der erro no meio, a transação daquele arquivo desfaz e o processo para
// (não sobe metade de uma migração).
//
// Por que os arquivos ficam em backend/db/migrations (não no db/ da raiz do
// repositório): o Dockerfile do backend só copia o que está dentro de
// backend/ para a imagem (WORKDIR /app, COPY src ./src) — o db/schema.sql da
// raiz nunca existiu dentro do container em produção, só é lido pelos testes
// locais (backend/test/helpers.js, contra um Postgres de teste). schema.sql
// continua sendo a referência do estado final (para banco novo/teste do
// zero); as migrações aqui são o histórico incremental aplicado num banco
// que já existe (o do Railway).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

export async function rodarMigracoes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id           TEXT PRIMARY KEY,
      aplicada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) return;
  const arquivos = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  if (arquivos.length === 0) return;

  const { rows } = await pool.query(`SELECT id FROM schema_migrations`);
  const jaAplicadas = new Set(rows.map((r) => r.id));

  for (const arquivo of arquivos) {
    const id = arquivo.replace(/\.sql$/, '');
    if (jaAplicadas.has(id)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), 'utf8');
    console.log(`[migrate] aplicando ${id}...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
      await client.query('COMMIT');
      console.log(`[migrate] ${id} aplicada com sucesso.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] FALHOU em ${id} — servidor não vai subir com o schema incompleto:`, err.message);
      client.release();
      throw err;
    }
    client.release();
  }
}
