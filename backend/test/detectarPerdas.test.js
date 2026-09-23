// Detecção de possível perda de dados — ver backend/src/db/detectarPerdas.js.
// Casos reproduzem os incidentes de 22–23/set no CapEx do Corporativo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarPerdas, totalProjeto } from '../src/db/detectarPerdas.js';

const alexander = { perfil: 'gerente_cc_corporativo', ccsPermitidos: [{ unidadeId: 'corporativo', codigo: '0010117' }] };
const gabriela = { perfil: 'gerente_cc_corporativo', ccsPermitidos: [{ unidadeId: 'corporativo', codigo: '0010105' }] };
const admin = { perfil: 'admin_fpa', ccsPermitidos: [] };

const projeto = (id, cc, valores, nome = `Projeto ${id}`) => ({ id, nome, ccCodigo: cc, categoria: 'melhoria_interna', desembolsos: valores });

test('totalProjeto soma desembolsos em formato brasileiro e o campo legado valor', () => {
  assert.equal(totalProjeto({ desembolsos: ['1.000,50', '2000', ''] }), 3000.5);
  assert.equal(totalProjeto({ valor: '25.000,00' }), 25000);
});

test('gestor de CC zera projeto de outro CC (caso Alexander x Gabriela) → alerta', () => {
  const antes = { capex: { projetos: [projeto('g1', '0010105', ['25000'])] } };
  const depois = { capex: { projetos: [projeto('g1', '0010105', ['0'])] } };
  const alertas = detectarPerdas(antes, depois, alexander, 'corporativo');
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].secao, 'capex');
  assert.match(alertas[0].descricao, /outro CC/);
});

test('gestor de CC removendo projeto de outro CC → alerta', () => {
  const antes = { capex: { projetos: [projeto('g1', '0010105', ['25000'])] } };
  const alertas = detectarPerdas(antes, { capex: { projetos: [] } }, alexander, 'corporativo');
  assert.equal(alertas.length, 1);
});

test('gestor de CC apagando dígitos do próprio projeto (digitação) → sem alerta', () => {
  const antes = { capex: { projetos: [projeto('g1', '0010105', ['50000'])] } };
  const depois = { capex: { projetos: [projeto('g1', '0010105', ['5'])] } };
  assert.deepEqual(detectarPerdas(antes, depois, gabriela, 'corporativo'), []);
});

test('admin removendo 2+ projetos com valor de uma vez (caso do save de premissas) → alerta', () => {
  const antes = { capex: { projetos: [projeto('a', '0010121', ['400000']), projeto('b', '0010121', ['401000']), projeto('c', '0010105', ['0'])] } };
  const depois = { capex: { projetos: [projeto('c', '0010105', ['0'])] } };
  const alertas = detectarPerdas(antes, depois, admin, 'corporativo');
  assert.equal(alertas.length, 1);
  assert.match(alertas[0].descricao, /2 projetos/);
});

test('admin removendo um projeto só → sem alerta', () => {
  const antes = { capex: { projetos: [projeto('a', '0010121', ['400000']), projeto('b', '0010121', ['1'])] } };
  const depois = { capex: { projetos: [projeto('b', '0010121', ['1'])] } };
  assert.deepEqual(detectarPerdas(antes, depois, admin, 'corporativo'), []);
});

test('projeto vazio sem nome removido não conta', () => {
  const antes = { capex: { projetos: [projeto('a', '', [''], ''), projeto('b', '', [''], '')] } };
  assert.deepEqual(detectarPerdas(antes, { capex: { projetos: [] } }, admin, 'corporativo'), []);
});

test('custos: 3+ funcionários removidos de uma vez → alerta', () => {
  const f = (id) => ({ id, cargo: 'Analista', ccCodigo: '0010105' });
  const antes = { custos: { funcionarios: [f('1'), f('2'), f('3'), f('4')] } };
  const depois = { custos: { funcionarios: [f('4')] } };
  const alertas = detectarPerdas(antes, depois, admin, 'corporativo');
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].secao, 'custos');
});

test('seção que encolhe mais de 40% de uma vez → alerta genérico', () => {
  const grande = { linhas: Array.from({ length: 100 }, (_, i) => ({ id: i, valores: ['123456789'] })) };
  const alertas = detectarPerdas({ receita: grande }, { receita: { linhas: [] } }, admin, 'textil');
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].secao, 'receita');
});

test('save sem perda → nenhum alerta', () => {
  const doc = { capex: { projetos: [projeto('a', '0010105', ['100'])] }, custos: { funcionarios: [{ id: '1' }] } };
  const depois = { capex: { projetos: [projeto('a', '0010105', ['200']), projeto('b', '0010105', ['5'])] }, custos: doc.custos };
  assert.deepEqual(detectarPerdas(doc, depois, gabriela, 'corporativo'), []);
});
