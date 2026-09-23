// Paridade do cálculo do servidor com o frontend (2026-09-23): encargos do
// Novo HC, dois dissídios, Novo HC sem meritocracia e rateios da Resorts.
// Estes totais são os gravados em orcamento_versoes.totais no envio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDRE, computeFolhaPessoalAnual, valorSublinhaMes, emptyFormData } from '../src/calc/orcamento.js';

const REF = { ccs: [{ codigo: 'CC1', tipo: 'despesa' }], todasContas: {} };
const arred = (v) => Math.round(v * 100) / 100;

function dadosComEstagiario(premissas) {
  const d = emptyFormData('corporativo');
  d.custos.premissasPessoal = { ...d.custos.premissasPessoal, ...premissas };
  d.custos.funcionarios = [{ id: 'f1', ccCodigo: 'CC1', origem: 'novo', salario: '1000', mesAdmissao: 'Mai' }];
  return d;
}

test('Novo HC não recebe meritocracia', () => {
  const folha = computeFolhaPessoalAnual(
    [{ id: 'f1', salario: '1000', mesAdmissao: 'Mai' }],
    { meritocraciaPct: '5' }
  );
  assert.equal(folha.totalAnual, 8000);
});

test('DRE aplica encargos de 180% e dissídio sobre a folha do Novo HC (caso do estagiário)', () => {
  const dre = computeDRE(dadosComEstagiario({ encargosNovoHcPct: '180', dissidioMes: 'Ago', dissidioPct: '5', meritocraciaPct: '5' }), REF, 0, {});
  // Mai–Jul 1.000 + Ago–Dez 1.050 = 8.250; × 2,8 = 23.100
  assert.equal(arred(dre.despesasSemDA), 23100);
});

test('segundo dissídio também é aplicado', () => {
  const dre = computeDRE(dadosComEstagiario({ encargosNovoHcPct: '180', dissidioMes: 'Ago', dissidioPct: '5', dissidioMes2: 'Out', dissidioPct2: '10' }), REF, 0, {});
  // Mai–Jul 1.000 (3.000) + Ago–Set 1.050 (2.100) + Out–Dez 1.155 (3.465) = 8.565; × 2,8 = 23.982
  assert.equal(arred(dre.despesasSemDA), 23982);
});

const linhaDireta = (valor) => ({ sublinhas: [{ id: 's1', premissaTipo: 'direto', valores: Array(12).fill(String(valor)) }] });

test('Bônus PJs: valor projetado do mês × multiplicador × atingimento, e entra na DRE', () => {
  const ref = {
    ccs: [{ codigo: 'CC1', tipo: 'despesa' }],
    todasContas: { CORP01: { pacoteId: 'pessoal' }, CORP03: { pacoteId: 'pessoal' } },
    planoContas: { pessoal: [{ codigo: 'CORP01', nome: 'Headcount Existente' }, { codigo: 'CORP03', nome: 'Consultórias PJs' }] },
  };
  const d = emptyFormData('corporativo');
  d.custos.linhas = { 'CC1|CORP03': linhaDireta(1000) };
  d.custos.premissasPessoal = { ...d.custos.premissasPessoal, bonusPjMes: 'Abr', bonusPjMultiplicador: '3,5', bonusPjAtendimentoPct: '80' };
  const dre = computeDRE(d, ref, 0, {});
  // 12 × 1.000 lançados + bônus de abril 1.000 × 3,5 × 80% = 2.800
  assert.equal(arred(dre.despesasSemDA), 14800);
});

test('Bônus do HC Existente (unidades): HC do mês × multiplicador × %, e entra na DRE', () => {
  const ref = {
    ccs: [{ codigo: 'CC1', tipo: 'despesa' }],
    todasContas: { HC_EXISTENTE_D: { pacoteId: 'pessoal' } },
    planoContas: { pessoal: [{ codigo: 'HC_EXISTENTE_D', nome: 'Headcount Existente' }] },
  };
  const d = emptyFormData('textil');
  d.custos.linhas = { 'CC1|HC_EXISTENTE_D': linhaDireta(10000) };
  d.custos.premissasPessoal = { ...d.custos.premissasPessoal, bonusMes: 'Abr', bonusPct: '20', bonusMultiplicador: '3,5' };
  assert.equal(arred(computeDRE(d, ref, 0, {}).despesasSemDA), 127000);

  d.custos.premissasPessoal.bonusMultiplicador = '';
  // multiplicador vazio = 1×: 10.000 × 20% = 2.000
  assert.equal(arred(computeDRE(d, ref, 0, {}).despesasSemDA), 122000);
});

test('Resorts: rateio sobre receita de Hospedagem e de A&B', () => {
  assert.equal(valorSublinhaMes({ premissaTipo: 'rateio_hospedagem', percentuais: ['10'] }, 0, null, null, 0, null, [5000], [0]), 500);
  assert.equal(valorSublinhaMes({ premissaTipo: 'rateio_aeb', percentuais: ['20'] }, 0, null, null, 0, null, [0], [3000]), 600);
});
