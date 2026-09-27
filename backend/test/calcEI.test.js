// ARA EI e Escritório de Investimentos (2026-09-27). O cenário do POC usa os
// saldos de ago/26 e os inputs de set–dez do "Cálculo POC.xlsx" só como
// teste: os resultados esperados são os valores que a planilha calcula
// (linhas 38, 42, 51, 73) — a plataforma não guarda nenhum desses valores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePOC } from '../src/calc/pocLaFleur.js';
import { computeDRE, computeDFC, computeFluxoIndiretoMensal, computeFluxoCaixaDiretoMensal, dreDaUnidade, emptyFormData } from '../src/calc/orcamento.js';
import { buscarReferencia } from '../src/calc/registroUnidades.js';

const arred = (v) => Math.round(v * 100) / 100;
const soma = (a) => a.reduce((x, y) => x + y, 0);
const m12 = (arr) => [...arr.map(String), ...Array(12 - arr.length).fill('')];

function pocPlanilha() {
  return {
    saldosIniciais: { vgvAApropriar: '181348744,88', avancoAcumuladoPct: '99,87', custoTotalObra: '103877212,94', m2Vendidos: '8524,77', comissoesPagas: '3990477,8' },
    premissas: { custoTerreno: '7374702,25', retPct: '4', m2PorUnidade: '95', m2AVender: '9635,86', comissaoPct: '4', valorPorUnidadeDistratada: '1400000', ccComissao: '0020101' },
    avancoAcumuladoPct: m12(['100', '100', '100', '100']),
    novasVendasValor: m12(['2319616,33', '4639232,66', '4639232,66', '4639232,66']),
    novasVendasQtd: m12(['1', '2', '2', '2']),
    unidadesDistratadas: m12(['3', '3', '0', '0']),
    desembolsoObra: m12(['1434410,50642857', '924203,85642858', '634507,29142856', '452670,83142857']),
    justificativa: '',
  };
}

test('POC reproduz as fórmulas de set–dez do Cálculo POC.xlsx', () => {
  const r = computePOC(pocPlanilha());
  // Receita Operacional Bruta (38), Deduções (42), Custos POC (51), Comissões (73) — set a dez.
  assert.deepEqual(r.robMes.slice(0, 4).map(arred), [-1635043.19, 439232.66, 4639232.66, 4639232.66]);
  assert.deepEqual(r.retMes.slice(0, 4).map(v => arred(-v)), [65785.21, -17569.31, -185569.31, -185569.31]);
  assert.deepEqual(r.cpvMes.slice(0, 4).map(v => arred(-v)), [678467.78, 247967.18, -2649847.31, -2512207.74]);
  assert.deepEqual(r.comissaoMes.slice(0, 4).map(v => arred(-v)), [-97972.27, -185569.31, -185569.31, -185569.31]);
  // Avanço em branco repete o anterior (100%): de jan a dez só a venda nova de out/nov/dez entra.
  assert.equal(r.avancoMes[11], 1);
});

test('La Fleur II: receita, RET e custo do POC na DRE; comissão dentro da despesa; 34202011 abaixo do EBITDA', () => {
  const doc = emptyFormData('ei_lafleur');
  doc.receita.poc = pocPlanilha();
  doc.custos.linhas['0010102|34202011'] = { sublinhas: [{ id: 'd', premissaTipo: 'direto', valores: Array(12).fill('50') }] };
  const ref = buscarReferencia('ei_lafleur');
  const dre = computeDRE(doc, ref, 0, {});
  const p = computePOC(doc.receita.poc);
  assert.equal(arred(dre.receitaBruta), arred(soma(p.robMes)));
  assert.equal(arred(dre.deducoes), arred(soma(p.retMes)));
  assert.equal(arred(dre.cpv), arred(soma(p.cpvMes)));
  assert.equal(arred(dre.despesasSemDA), arred(soma(p.comissaoMes)));
  assert.equal(arred(dre.depreciacao), 600);
  // FC Direto e Indireto continuam reconciliados com o POC.
  const fd = computeFluxoIndiretoMensal(doc, dre, ref, 0);
  const fcd = computeFluxoCaixaDiretoMensal(doc, dre, ref, 0);
  assert.equal(arred(soma(fd.fcOperacionalMes)), arred(soma(fcd.fcOperacionalDiretoMes)));
});

test('Consolidado da ARA EI soma as três empresas', () => {
  const holding = emptyFormData('ei_holding');
  holding.custos.linhas['0000101|34201001'] = { sublinhas: [{ id: 'h', premissaTipo: 'direto', valores: Array(12).fill('200') }] };
  const southbay = emptyFormData('ei_southbay');
  southbay.custos.linhas['0010105|34202003'] = { sublinhas: [{ id: 's', premissaTipo: 'direto', valores: Array(12).fill('10') }] };
  const lafleur = emptyFormData('ei_lafleur');
  const dre = dreDaUnidade({ _tipo: 'consolidado_ei', ei_holding: holding, ei_lafleur: lafleur, ei_southbay: southbay }, 'ei', buscarReferencia('ei'), 0, {});
  assert.equal(arred(dre.despesasSemDA), 2520);
  assert.equal(holding.receita.poc, undefined);
});

test('Escritório de Investimentos: aporte sai e dividendo entra no FC de Investimentos, sem DRE', () => {
  const d = emptyFormData('energia');
  d.capex.projetos = [{ id: 'a', categoria: 'pch_santa_luzia', nome: 'x', justificativa: 'j', aportes: m12(['1000']), dividendos: m12(['', '300']) }];
  const ref = { ccs: [], todasContas: {} };
  const dre = computeDRE(d, ref, 0, {});
  assert.equal(dre.ebitda, 0);
  assert.equal(computeDFC(d, dre, ref, 0).fluxoInvestimento, -700);
  assert.deepEqual(computeFluxoIndiretoMensal(d, dre, ref, 0).fcInvestimentoMes.slice(0, 2), [-1000, 300]);
});
