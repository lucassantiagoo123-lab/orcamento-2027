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

test('caso 2 (lógica de escopo) — podeAcessarCc (Gestor de CC) só autoriza o CC vinculado, na unidade certa', () => {
  // Pedido de 2026-08-16: Gestor de CC agora é multi-unidade (não só
  // Corporativo) — ccsPermitidos carrega {unidadeId, codigo} por vínculo, e
  // podeAcessarCc passa a exigir os dois (evita colisão de código de CC
  // entre unidades, ex.: Agrícola/Resorts reaproveitam os códigos da Têxtil).
  const usuario = {
    perfil: 'gerente_cc_corporativo',
    ccsPermitidos: [{ unidadeId: 'corporativo', codigo: '0010116' }],
  };
  assert.equal(podeAcessarCc(usuario, 'corporativo', '0010116'), true);
  assert.equal(podeAcessarCc(usuario, 'corporativo', '0010104'), false, 'CC fora da lista do gestor não deveria ser autorizado');
  assert.equal(podeAcessarCc(usuario, 'textil', '0010116'), false, 'mesmo código de CC em outra unidade não deveria ser autorizado');
});

test('caso 2 (integração) — Gestor de CC abre a unidade do seu CC, mas não uma unidade sem vínculo nenhum', async () => {
  // Corrigido em 2026-08-16: o orçamento ainda é um único bloco JSONB por
  // unidade (não fatiado por CC), então o Gestor de CC precisa abrir a
  // unidade inteira pra editar o próprio CC — podeAcessarUnidade libera se
  // ele tiver pelo menos 1 CC vinculado ali. A barreira real contra
  // escrever num CC alheio é validarEscritaCcCustos (routes/orcamentos.js),
  // testada abaixo.
  const gerenteCc = await seedUsuario({ perfil: 'gerente_cc_corporativo', ccs: [{ unidadeId: 'textil', codigo: '00401' }] });
  const cookie = cookieDeSessao(gerenteCc.id);

  const comAcesso = await fetch(`${baseUrl}/api/orcamentos/textil`, { headers: { cookie } });
  assert.equal(comAcesso.status, 200, 'deveria conseguir abrir a unidade do seu CC');

  const semAcesso = await fetch(`${baseUrl}/api/orcamentos/agricola`, { headers: { cookie } });
  assert.equal(semAcesso.status, 403, 'não deveria conseguir abrir uma unidade sem nenhum CC vinculado');
});

test('caso 2 (escrita) — Gestor de CC não consegue gravar custos.linhas de um CC que não é o dele', async () => {
  const gerenteCc = await seedUsuario({ perfil: 'gerente_cc_corporativo', ccs: [{ unidadeId: 'textil', codigo: '00401' }] });
  const cookie = cookieDeSessao(gerenteCc.id);

  // O PUT substitui o documento inteiro (não faz merge por seção) — o
  // frontend real sempre manda o `dados` completo (buscado antes por GET),
  // então o teste precisa fazer o mesmo pra não disparar
  // validarSoCustosAlterado (que rejeitaria um payload parcial mesmo sem
  // nenhuma tentativa de mexer fora de custos).
  const atual = await (await fetch(`${baseUrl}/api/orcamentos/textil`, { headers: { cookie } })).json();

  const dadosComLinhaPropria = {
    ...atual.orcamento.dados,
    custos: { ...atual.orcamento.dados.custos, linhas: { '00401|71101001': { tipo: 'valor', valores: Array(12).fill('100') } } },
  };
  const escritaProprioCc = await fetch(`${baseUrl}/api/orcamentos/textil`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ dados: dadosComLinhaPropria }),
  });
  assert.equal(escritaProprioCc.status, 200, 'deveria conseguir gravar uma linha do próprio CC');

  const dadosComLinhaAlheia = {
    ...atual.orcamento.dados,
    custos: { ...atual.orcamento.dados.custos, linhas: { '00402|71101001': { tipo: 'valor', valores: Array(12).fill('100') } } },
  };
  const escritaCcAlheio = await fetch(`${baseUrl}/api/orcamentos/textil`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ dados: dadosComLinhaAlheia }),
  });
  assert.equal(escritaCcAlheio.status, 403, 'não deveria conseguir gravar uma linha de outro CC (00402 não é dele)');
});

test('caso 2 (escrita) — Gestor de CC não consegue alterar seção fora de Custos e Despesas', async () => {
  const gerenteCc = await seedUsuario({ perfil: 'gerente_cc_corporativo', ccs: [{ unidadeId: 'textil', codigo: '00401' }] });
  const cookie = cookieDeSessao(gerenteCc.id);
  const atual = await (await fetch(`${baseUrl}/api/orcamentos/textil`, { headers: { cookie } })).json();

  const dadosComReceitaAlterada = {
    ...atual.orcamento.dados,
    receita: { ...atual.orcamento.dados.receita, justificativaGeral: 'tentativa de mexer fora do escopo' },
  };
  const resp = await fetch(`${baseUrl}/api/orcamentos/textil`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ dados: dadosComReceitaAlterada }),
  });
  assert.equal(resp.status, 403, 'Gestor de CC só pode alterar a seção Custos e Despesas');
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
