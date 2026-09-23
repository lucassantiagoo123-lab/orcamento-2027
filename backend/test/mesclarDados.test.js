// Merge 3-way do documento inteiro — ver backend/src/db/mesclarDados.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesclarDados } from '../src/db/mesclarDados.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

test('receita: edição de outro usuário sobrevive a um save com cópia antiga', () => {
  const base = { receita: { volumes: ['0', '0', '0'] }, custos: { linhas: {} } };
  const banco = clone(base); banco.receita.volumes[0] = '500';
  const novo = clone(base); novo.custos.linhas['cc1|c1'] = { valores: ['10'] };

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.receita.volumes, ['500', '0', '0']);
  assert.deepEqual(r.custos.linhas['cc1|c1'], { valores: ['10'] });
});

test('grade mensal: meses diferentes editados por dois usuários, os dois ficam', () => {
  const base = { capitalGiro: { prazoRecebimento: ['30', '30', '30'] } };
  const banco = clone(base); banco.capitalGiro.prazoRecebimento[0] = '45';
  const novo = clone(base); novo.capitalGiro.prazoRecebimento[2] = '60';

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.capitalGiro.prazoRecebimento, ['45', '30', '60']);
});

test('mesma célula editada pelos dois: vale quem salvou por último', () => {
  const base = { receita: { preco: '10' } };
  const r = mesclarDados(base, { receita: { preco: '20' } }, { receita: { preco: '30' } });
  assert.equal(r.receita.preco, '30');
});

test('capex: valores preenchidos por outro gestor não são revertidos', () => {
  const p1 = { id: 'p1', nome: 'Projeto G', desembolsos: ['0', '0'] };
  const base = { capex: { projetos: [p1] } };
  const banco = { capex: { projetos: [{ ...p1, desembolsos: ['50000', '0'] }] } };
  const novo = { capex: { projetos: [p1, { id: 'p2', nome: 'Novo', desembolsos: ['1', '0'] }] } };

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.capex.projetos.find((p) => p.id === 'p1').desembolsos, ['50000', '0']);
  assert.ok(r.capex.projetos.some((p) => p.id === 'p2'));
});

test('capex: dois usuários editam campos diferentes do mesmo projeto', () => {
  const p1 = { id: 'p1', nome: '', desembolsos: ['0'] };
  const base = { capex: { projetos: [p1] } };
  const banco = { capex: { projetos: [{ ...p1, nome: 'IA' }] } };
  const novo = { capex: { projetos: [{ ...p1, desembolsos: ['25000'] }] } };

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.capex.projetos[0], { id: 'p1', nome: 'IA', desembolsos: ['25000'] });
});

test('remoção: cliente apaga o próprio item; item de outro usuário continua', () => {
  const base = { custos: { funcionarios: [{ id: 'f1' }] } };
  const banco = { custos: { funcionarios: [{ id: 'f1' }, { id: 'f2' }] } };
  const novo = { custos: { funcionarios: [] } };

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.custos.funcionarios.map((f) => f.id), ['f2']);
});

test('remoção x edição: se outro usuário editou o item, a remoção não apaga a edição', () => {
  const base = { capex: { projetos: [{ id: 'p1', nome: 'A' }] } };
  const banco = { capex: { projetos: [{ id: 'p1', nome: 'A editado' }] } };
  const novo = { capex: { projetos: [] } };

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.capex.projetos, [{ id: 'p1', nome: 'A editado' }]);
});

test('item apagado por outro usuário não volta se este cliente não mexeu nele', () => {
  const base = { capex: { projetos: [{ id: 'p1' }, { id: 'p2' }] } };
  const banco = { capex: { projetos: [{ id: 'p2' }] } };
  const novo = clone(base);

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.capex.projetos.map((p) => p.id), ['p2']);
});

test('seção ausente do payload não é apagada', () => {
  const base = { receita: { a: '1' }, custos: {} };
  const banco = { receita: { a: '1' }, custos: {}, balanco: { x: '9' } };
  const novo = { custos: { linhas: { k: 1 } } };

  const r = mesclarDados(base, banco, novo);

  assert.deepEqual(r.receita, { a: '1' });
  assert.deepEqual(r.balanco, { x: '9' });
  assert.deepEqual(r.custos.linhas, { k: 1 });
});

test('sem mudança de ninguém: resultado igual ao banco', () => {
  const doc = { receita: { a: ['1', '2'] }, capex: { projetos: [{ id: 'p1' }] } };
  assert.deepEqual(mesclarDados(clone(doc), clone(doc), clone(doc)), doc);
});
