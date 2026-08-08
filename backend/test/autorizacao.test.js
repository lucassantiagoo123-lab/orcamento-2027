// Casos 1, 2 e 6 do plano de testes (seção 6 da especificação).
//
// Bate via HTTP de verdade (fetch contra um app.listen efêmero), não chamada
// direta às funções de rota — é a única forma de garantir que o middleware
// de autorização está mesmo no caminho do request, e não só "existe no
// arquivo". "Mesmo manipulando o request diretamente" (como o caso 1 exige)
// significa literalmente montar a URL com o unidade_id que quisermos e ver
// se o servidor rejeita — não passar por nenhum atalho de UI.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetarBanco, seedUsuario, cookieDeSessao, iniciarServidorTeste, fecharPool } from './helpers.js';
import { podeAcessarUnidade, podeAcessarCc } from '../src/middleware/authorize.js';
import { pool } from '../src/db/pool.js';

let baseUrl, fechar;

before(async () => {
  await resetarBanco();
  ({ baseUrl, fechar } = await iniciarServidorTeste());
});

after(async () => {
  await fechar();
  await fecharPool();
});

test('caso 1 — Gerente da Unidade Têxtil não lê nem escreve dados de outra unidade, mesmo trocando o unidade_id na URL', async () => {
  const gerente = await seedUsuario({ perfil: 'gerente_unidade', unidades: ['textil'] });
  const cookie = cookieDeSessao(gerente.id);

  const leituraPropria = await fetch(`${baseUrl}/api/orcamentos/textil`, { headers: { cookie } });
  assert.equal(leituraPropria.status, 200, 'deveria conseguir ler a própria unidade');

  const leituraAlheia = await fetch(`${baseUrl}/api/orcamentos/agricola`, { headers: { cookie } });
  assert.equal(leituraAlheia.status, 403, 'não deveria conseguir ler outra unidade');

  const escritaAlheia = await fetch(`${baseUrl}/api/orcamentos/agricola`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ dados: { meta: { status: 'em_elaboracao' } } }),
  });
  assert.equal(escritaAlheia.status, 403, 'não deveria conseguir escrever em outra unidade');
});

test('caso 2 (lógica de escopo) — podeAcessarCc só autoriza CCs vinculados ao gerente_cc_corporativo', () => {
  const usuario = { perfil: 'gerente_cc_corporativo', ccsPermitidos: ['0010116', '0010118'] };
  assert.equal(podeAcessarCc(usuario, '0010116'), true);
  assert.equal(podeAcessarCc(usuario, '0010104'), false, 'CC fora da lista do gerente não deveria ser autorizado');
});

test('caso 2 (integração) — gerente_cc_corporativo não acessa rotas de orçamento por unidade (só existem rotas por unidade hoje)', async () => {
  // Nota de escopo: as rotas de orçamento hoje são por unidade_id
  // (routes/orcamentos.js), não por cc_codigo — porque o lançamento por CC do
  // Corporativo ainda não está habilitado (pendência de De/Para documentada
  // no CLAUDE.md). Por isso este teste confirma o comportamento atual (403
  // em qualquer unidade, já que gerente_cc_corporativo nunca satisfaz
  // podeAcessarUnidade) e não "escrita rejeitada num CC específico" — isso
  // só será testável quando existir uma rota /api/orcamentos-corporativo/:ccCodigo.
  const gerenteCc = await seedUsuario({ perfil: 'gerente_cc_corporativo', ccs: ['0010116'] });
  const cookie = cookieDeSessao(gerenteCc.id);

  const resp = await fetch(`${baseUrl}/api/orcamentos/textil`, { headers: { cookie } });
  assert.equal(resp.status, 403);
});

test('caso 6 — usuário desativado não autentica, mesmo com sessão ainda não expirada', async () => {
  const usuario = await seedUsuario({ perfil: 'gerente_unidade', unidades: ['textil'], ativo: true });
  const cookie = cookieDeSessao(usuario.id); // token válido, emitido enquanto o usuário ainda estava ativo

  const antes = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
  assert.equal(antes.status, 200, 'com o usuário ativo, a sessão deveria funcionar');

  await pool.query(`UPDATE usuarios SET ativo = false WHERE id = $1`, [usuario.id]);

  const depois = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
  assert.equal(depois.status, 401, 'com o usuário desativado, o MESMO token deveria parar de funcionar');
});

test('unidade_id inexistente/inválido não é tratado como acesso liberado', () => {
  const gerente = { perfil: 'gerente_unidade', unidadesPermitidas: ['textil'] };
  assert.equal(podeAcessarUnidade(gerente, 'unidade-que-nao-existe'), false);
});
