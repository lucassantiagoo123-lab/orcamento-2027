// Infra de teste — banco de testes real (não mocks), porque a regra sob
// teste (seção 4 da especificação) é exatamente "confiar no banco, não no
// que o cliente manda". Um mock do banco esconderia o próprio bug que os
// testes existem para pegar.
//
// IMPORTANTE: roda contra DATABASE_URL. Por segurança, recusa rodar se a URL
// não tiver "test" no nome — ver assertBancoDeTestes(). Configure algo como:
//   DATABASE_URL=postgresql://usuario:senha@localhost:5432/obz2027_test
// antes de `npm test`. resetarBanco() APAGA todas as tabelas da aplicação.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { criarApp } from '../src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assertBancoDeTestes() {
  if (!/test/i.test(config.databaseUrl)) {
    throw new Error(
      'DATABASE_URL não parece ser um banco de testes (precisa conter "test" no nome, ex.: ' +
      'obz2027_test). Recusando rodar — resetarBanco() apaga tabelas e isto não pode acontecer ' +
      'sem querer contra um banco real. Configure DATABASE_URL antes de rodar `npm test`.'
    );
  }
}

export async function resetarBanco() {
  assertBancoDeTestes();
  await pool.query(`
    DROP TABLE IF EXISTS
      log_alteracoes, concessao_acesso_temporaria, orcamento_versoes, orcamentos,
      contas, pacotes, centros_custo, usuario_cc_corporativo, usuario_unidade,
      sessoes, usuarios, unidades
    CASCADE;
  `);
  const schemaSql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schemaSql);
}

let contadorEmail = 0;
export async function seedUsuario({ nome = 'Usuário de Teste', perfil, ativo = true, unidades = [], ccs = [] }) {
  contadorEmail += 1;
  const email = `teste.${contadorEmail}.${Date.now()}@grupoara.com.br`;
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, perfil, ativo) VALUES ($1,$2,$3,$4) RETURNING *`,
    [nome, email, perfil, ativo]
  );
  const usuario = rows[0];
  for (const u of unidades) {
    await pool.query(`INSERT INTO usuario_unidade (usuario_id, unidade_id) VALUES ($1,$2)`, [usuario.id, u]);
  }
  for (const cc of ccs) {
    // Aceita string solta (compat — assume 'corporativo', uso histórico dos
    // testes) ou {unidadeId, codigo} (formato correto pós 2026-08-16).
    const unidadeId = typeof cc === 'string' ? 'corporativo' : cc.unidadeId;
    const codigo = typeof cc === 'string' ? cc : cc.codigo;
    await pool.query(
      `INSERT INTO usuario_cc_corporativo (usuario_id, unidade_id, cc_codigo) VALUES ($1,$2,$3)`,
      [usuario.id, unidadeId, codigo]
    );
  }
  return usuario;
}

/** Cookie de sessão válido, assinado com o mesmo segredo do app — bypassa o
 * fluxo OIDC de propósito (SSO ainda não está configurado, ver Fase 2; o que
 * estes testes verificam é autorização pós-login, não o handshake OAuth). */
export function cookieDeSessao(usuarioId) {
  const token = jwt.sign({ sub: usuarioId }, config.session.jwtSecret, { expiresIn: '30m' });
  return `obz_session=${token}`;
}

/** Sobe o app numa porta efêmera para os testes baterem via fetch de verdade
 * (não chamadas diretas às funções de rota) — é a única forma de garantir
 * que o middleware de autorização está de fato no caminho do request. */
export async function iniciarServidorTeste() {
  const app = criarApp();
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = servidor.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    fechar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

export async function fecharPool() {
  await pool.end();
}
