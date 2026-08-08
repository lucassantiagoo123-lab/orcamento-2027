// Casos 4 e 5 do plano de testes (seção 6): bloqueio pós-aprovação e log de
// alterações. Os dois giram em torno da mesma rota (PUT /api/orcamentos/:id),
// então dividem o setup.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetarBanco, seedUsuario, cookieDeSessao, iniciarServidorTeste, fecharPool } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { emptyFormData } from '../src/calc/orcamento.js';

// O PUT substitui orcamentos.dados inteiro (não faz merge parcial) — é assim
// que o frontend de verdade usa a rota, sempre mandando o objeto completo do
// estado `dados` (ver frontend/src/OrcamentoARA.jsx). Testar com documentos
// parciais aqui simularia um jeito de usar a API que a aplicação real nunca
// usa, e o diff por seção (calcularDiffPorSecao) ia comparar contra `null`
// para as seções omitidas.
//
// Importante: emptyFormData() gera ids aleatórios (uid()) para os produtos de
// receita a cada chamada — duas chamadas separadas produzem `receita`
// diferente mesmo sem mudança nenhuma "de verdade". Por isso geramos UM
// documento-base por teste e só clonamos/mudamos o campo observado, em vez de
// chamar emptyFormData() de novo a cada escrita.
function documentoComContexto(base, contexto) {
  const d = JSON.parse(JSON.stringify(base));
  d.estrategicas.contexto = contexto;
  return d;
}

let baseUrl, fechar, admin, gerente;

before(async () => {
  await resetarBanco();
  ({ baseUrl, fechar } = await iniciarServidorTeste());
});

after(async () => {
  await fechar();
  await fecharPool();
});

// Cada teste principal reseta o orçamento da textil para não herdar estado
// (status/bloqueado) do teste anterior — mais simples que resetarBanco() por
// teste, que reconstruiria o schema inteiro a cada `test()`.
beforeEach(async () => {
  admin = await seedUsuario({ perfil: 'admin_fpa' });
  gerente = await seedUsuario({ perfil: 'gerente_unidade', unidades: ['textil'] });
  await pool.query(`DELETE FROM log_alteracoes`);
  await pool.query(`DELETE FROM orcamento_versoes`);
  await pool.query(`DELETE FROM orcamentos WHERE unidade_id = 'textil'`);
});

function putDados(cookie, dados, motivo) {
  return fetch(`${baseUrl}/api/orcamentos/textil`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ dados, motivo }),
  });
}

test('caso 4 — orçamento aprovado rejeita escrita de quem não é admin_fpa', async () => {
  const cookieGerente = cookieDeSessao(gerente.id);
  const cookieAdmin = cookieDeSessao(admin.id);
  const base = emptyFormData();

  // 1) gerente cria o orçamento (primeira escrita, nao_iniciado -> em_elaboracao)
  const r1 = await putDados(cookieGerente, documentoComContexto(base, 'ciclo 2027'));
  assert.equal(r1.status, 200);

  // 2) admin aprova
  const rAprova = await fetch(`${baseUrl}/api/orcamentos/textil/aprovar`, { method: 'POST', headers: { cookie: cookieAdmin } });
  assert.equal(rAprova.status, 200);
  assert.equal((await rAprova.json()).orcamento.status, 'aprovado');

  // 3) gerente tenta editar depois de aprovado — deve ser rejeitado
  const r3 = await putDados(cookieGerente, documentoComContexto(base, 'tentando editar depois de aprovado'));
  assert.equal(r3.status, 403);

  // 4) admin também precisa de motivo para editar pós-aprovação
  const r4semMotivo = await putDados(cookieAdmin, documentoComContexto(base, 'edição do admin sem motivo'));
  assert.equal(r4semMotivo.status, 400);

  // 5) admin com motivo consegue
  const r5 = await putDados(cookieAdmin, documentoComContexto(base, 'edição do admin com motivo'), 'correção solicitada pela diretoria');
  assert.equal(r5.status, 200);
});

test('caso 5 — toda escrita após em_elaboracao gera uma linha em log_alteracoes', async () => {
  const cookie = cookieDeSessao(gerente.id);
  const base = emptyFormData();

  // Primeira escrita: nao_iniciado -> em_elaboracao. Não deveria gerar log
  // (não há "antes" significativo para comparar num documento recém-criado).
  await putDados(cookie, documentoComContexto(base, 'primeira escrita'));
  const logApos1a = await pool.query(`SELECT * FROM log_alteracoes WHERE unidade_id = 'textil'`);
  assert.equal(logApos1a.rows.length, 0, 'a escrita que sai de nao_iniciado não deveria gerar log');

  // Segunda escrita: já em_elaboracao -> deveria gerar log da seção que mudou.
  const segundoDocumento = documentoComContexto(base, 'segunda escrita, contexto mudou');
  await putDados(cookie, segundoDocumento);
  const logApos2a = await pool.query(`SELECT * FROM log_alteracoes WHERE unidade_id = 'textil' ORDER BY criado_em`);
  assert.equal(logApos2a.rows.length, 1);
  assert.equal(logApos2a.rows[0].campo, 'estrategicas');
  assert.equal(logApos2a.rows[0].usuario_id, gerente.id);

  // Terceira escrita com EXATAMENTE o mesmo documento (não um novo clone com
  // ids diferentes) — não deveria adicionar log novo, porque não há diff.
  await putDados(cookie, segundoDocumento);
  const logApos3a = await pool.query(`SELECT * FROM log_alteracoes WHERE unidade_id = 'textil'`);
  assert.equal(logApos3a.rows.length, 1, 'escrita sem diff real não deveria gerar log novo');
});
