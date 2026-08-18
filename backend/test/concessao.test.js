// Caso 3 do plano de testes (seção 6): concessão temporária expirada deixa
// de dar acesso automaticamente, sem ação manual (sem "revogar" explícito —
// só o relógio passar do valido_ate já basta).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetarBanco, seedUsuario, cookieDeSessao, iniciarServidorTeste, fecharPool } from './helpers.js';
import { pool } from '../src/db/pool.js';

let baseUrl, fechar, admin, gerenteCc;

before(async () => {
  await resetarBanco();
  ({ baseUrl, fechar } = await iniciarServidorTeste());
  admin = await seedUsuario({ perfil: 'admin_fpa' });
  gerenteCc = await seedUsuario({ perfil: 'gerente_cc_corporativo', ccs: [{ unidadeId: 'corporativo', codigo: '0010116' }] }); // seu CC de origem
});

after(async () => {
  await fechar();
  await fecharPool();
});

async function ccsPermitidos(usuarioId) {
  const cookie = cookieDeSessao(usuarioId);
  const r = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
  const body = await r.json();
  // ccsPermitidos agora é [{unidadeId, codigo}] (pedido de 2026-08-16) —
  // concessões continuam sem unidade própria (unidadeId: null, valem em
  // qualquer unidade), por isso os testes checam só o código aqui.
  return body.ccsPermitidos.map((c) => c.codigo);
}

test('concessão dentro da validade aparece em ccsPermitidos', async () => {
  const validoAte = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // amanhã
  await pool.query(
    `INSERT INTO concessao_acesso_temporaria (usuario_id, cc_codigo, concedido_por, motivo, valido_ate)
     VALUES ($1, $2, $3, $4, $5)`,
    [gerenteCc.id, '0010104', admin.id, 'cobertura de férias', validoAte]
  );

  const ccs = await ccsPermitidos(gerenteCc.id);
  assert.ok(ccs.includes('0010104'), 'CC concedido temporariamente deveria aparecer enquanto válido');
  assert.ok(ccs.includes('0010116'), 'CC de origem continua valendo');
});

test('concessão com valido_ate no passado NÃO aparece em ccsPermitidos — expira sozinha, sem revogação manual', async () => {
  const validoAte = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minuto atrás
  await pool.query(
    `INSERT INTO concessao_acesso_temporaria (usuario_id, cc_codigo, concedido_por, motivo, valido_ate)
     VALUES ($1, $2, $3, $4, $5)`,
    [gerenteCc.id, '0010107', admin.id, 'teste de expiração', validoAte]
  );

  const ccs = await ccsPermitidos(gerenteCc.id);
  assert.ok(!ccs.includes('0010107'), 'CC com concessão expirada não deveria mais aparecer, sem precisar revogar');
});

test('concessão revogada manualmente (revogado_em preenchido) também some, mesmo com valido_ate no futuro', async () => {
  const validoAte = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { rows } = await pool.query(
    `INSERT INTO concessao_acesso_temporaria (usuario_id, cc_codigo, concedido_por, motivo, valido_ate)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [gerenteCc.id, '0010109', admin.id, 'teste de revogação', validoAte]
  );
  await pool.query(`UPDATE concessao_acesso_temporaria SET revogado_em = now() WHERE id = $1`, [rows[0].id]);

  const ccs = await ccsPermitidos(gerenteCc.id);
  assert.ok(!ccs.includes('0010109'));
});
