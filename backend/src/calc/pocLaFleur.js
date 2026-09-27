// Receita, deduções (RET), custo e comissões da La Fleur II pelo POC
// (percentual de conclusão de obra) — 2026-09-27, "Cálculo POC.xlsx", aba
// "DRE Projeção". Espelho em frontend/src/OrcamentoARA.jsx (computePOC).
//
// Só as fórmulas da projeção (colunas O–R, set–dez), aplicadas aos 12 meses
// de 2027; nenhum valor da planilha é usado. Mês anterior de Jan = saldos em
// 31/12/2026 (poc.saldosIniciais). Célula sem fórmula ou com link externo =
// input. Linha da planilha entre parênteses.
//
//   VGV a apropriar (22)       = anterior + Novas vendas R$ (25) + Distratos R$ (28)
//   Distratos R$ (28)          = − valor por unidade distratada × unidades distratadas (27)
//                                (set/out: 1.400.000 × unidades; nov/dez vinham de link
//                                externo — valor por unidade virou premissa editável)
//   Avanço acumulado (23)      = input; avanço do mês (24) = acumulado − anterior
//   Receita reconhecida (31)   = VGV a apropriar × avanço acumulado
//   Receita apropriada (32)    = reconhecida − reconhecida anterior
//   Terreno apropriado (34)    = custo do terreno (D36) × avanço acumulado
//   Receita — Espólio (35)     = terreno apropriado − anterior
//   Receita Op. Bruta (38)     = (32) + (35)
//   RET (43)                   = RET% (D43) × receita reconhecida; dedução (42) = RET − anterior
//   Custo total da obra (52)   = anterior + desembolso de obra do mês (link externo → input)
//   m² vendidos (53)           = anterior + m² por unidade (D53) × (vendas # (26) − distratadas (27))
//   Custo reconhecido (58)     = custo da obra ÷ m² a vender (D60) × m² vendidos × avanço
//   Custo apropriado (59)      = reconhecido − anterior
//   Custos POC (51)            = −(59) − (63), (63) = (35)
//   Comissões pagas (74)       = anterior + Novas vendas R$ × comissão% (−D74)
//   Comissões apropriadas (75) = pagas × avanço acumulado
//   Comissões (73)             = apropriada anterior − apropriada
//
// Convenção de sinais na plataforma: percentuais digitados positivos (RET 4 =
// 4% de dedução; comissão 4 = 4% sobre vendas), unidades distratadas
// digitadas positivas (a fórmula subtrai). Saídas: robMes (receita), retMes
// (dedução, positiva), cpvMes (custo, positivo) e comissaoMes (despesa,
// positiva) — o mesmo sinal de cada linha na DRE da plataforma.
//
// Avanço acumulado em branco num mês = repete o do mês anterior (acumulado
// não regride; sem isso um mês vazio "desreconheceria" toda a receita).
import { MESES, mesesVazios } from './constantesTextil.js';
import { CC_COMISSAO_POC_PADRAO } from './constantesEI.js';

function num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
const vazio = (v) => v === '' || v === null || v === undefined || String(v).trim() === '';

export function pocVazio() {
  return {
    saldosIniciais: { vgvAApropriar: '', avancoAcumuladoPct: '', custoTotalObra: '', m2Vendidos: '', comissoesPagas: '' },
    premissas: { custoTerreno: '', retPct: '', m2PorUnidade: '', m2AVender: '', comissaoPct: '', valorPorUnidadeDistratada: '', ccComissao: CC_COMISSAO_POC_PADRAO },
    avancoAcumuladoPct: mesesVazios(),
    novasVendasValor: mesesVazios(),
    novasVendasQtd: mesesVazios(),
    unidadesDistratadas: mesesVazios(),
    desembolsoObra: mesesVazios(),
    justificativa: '',
  };
}

export function computePOC(poc) {
  const si = poc?.saldosIniciais || {};
  const pr = poc?.premissas || {};
  const custoTerreno = num(pr.custoTerreno);
  const retPct = num(pr.retPct) / 100;
  const m2PorUnidade = num(pr.m2PorUnidade);
  const m2AVender = num(pr.m2AVender);
  const comissaoPct = num(pr.comissaoPct) / 100;
  const valorDistrato = num(pr.valorPorUnidadeDistratada);

  const vgvIni = num(si.vgvAApropriar);
  const avancoIni = num(si.avancoAcumuladoPct) / 100;
  const custoObraIni = num(si.custoTotalObra);
  const m2Ini = num(si.m2Vendidos);
  const comissoesPagasIni = num(si.comissoesPagas);
  const custoRecIni = m2AVender ? (custoObraIni / m2AVender) * m2Ini * avancoIni : 0;

  const out = {
    distratosValorMes: [], vgvMes: [], avancoMes: [], avancoMensalMes: [],
    receitaReconhecidaMes: [], receitaApropriadaMes: [], terrenoApropriadoMes: [], espolioMes: [],
    robMes: [], retAcumuladoMes: [], retMes: [],
    custoTotalObraMes: [], m2VendidosMes: [], custoReconhecidoMes: [], custoApropriadoMes: [], cpvMes: [],
    comissoesPagasMes: [], comissoesApropriadasMes: [], comissaoMes: [],
  };
  let vgvAnt = vgvIni;
  let avancoAnt = avancoIni;
  let recAnt = vgvIni * avancoIni;
  let terrenoAnt = custoTerreno * avancoIni;
  let retAnt = retPct * recAnt;
  let custoObraAnt = custoObraIni;
  let m2Ant = m2Ini;
  let custoRecAnt = custoRecIni;
  let comPagasAnt = comissoesPagasIni;
  let comAproAnt = comissoesPagasIni * avancoIni;

  MESES.forEach((_, m) => {
    const novasVendas = num(poc?.novasVendasValor?.[m]);
    const distratadas = num(poc?.unidadesDistratadas?.[m]);
    const distratos = -valorDistrato * distratadas;
    const vgv = vgvAnt + novasVendas + distratos;
    const avanco = vazio(poc?.avancoAcumuladoPct?.[m]) ? avancoAnt : num(poc.avancoAcumuladoPct[m]) / 100;
    const rec = vgv * avanco;
    const terreno = custoTerreno * avanco;
    const espolio = terreno - terrenoAnt;
    const receitaApropriada = rec - recAnt;
    const retAcum = retPct * rec;
    const custoObra = custoObraAnt + num(poc?.desembolsoObra?.[m]);
    const m2 = m2Ant + m2PorUnidade * (num(poc?.novasVendasQtd?.[m]) - distratadas);
    const custoRec = m2AVender ? (custoObra / m2AVender) * m2 * avanco : 0;
    const custoApropriado = custoRec - custoRecAnt;
    const comPagas = comPagasAnt + novasVendas * comissaoPct;
    const comApro = comPagas * avanco;

    out.distratosValorMes.push(distratos);
    out.vgvMes.push(vgv);
    out.avancoMes.push(avanco);
    out.avancoMensalMes.push(avanco - avancoAnt);
    out.receitaReconhecidaMes.push(rec);
    out.receitaApropriadaMes.push(receitaApropriada);
    out.terrenoApropriadoMes.push(terreno);
    out.espolioMes.push(espolio);
    out.robMes.push(receitaApropriada + espolio);
    out.retAcumuladoMes.push(retAcum);
    out.retMes.push(retAcum - retAnt);
    out.custoTotalObraMes.push(custoObra);
    out.m2VendidosMes.push(m2);
    out.custoReconhecidoMes.push(custoRec);
    out.custoApropriadoMes.push(custoApropriado);
    out.cpvMes.push(custoApropriado + espolio);
    out.comissoesPagasMes.push(comPagas);
    out.comissoesApropriadasMes.push(comApro);
    out.comissaoMes.push(comApro - comAproAnt);

    vgvAnt = vgv; avancoAnt = avanco; recAnt = rec; terrenoAnt = terreno; retAnt = retAcum;
    custoObraAnt = custoObra; m2Ant = m2; custoRecAnt = custoRec; comPagasAnt = comPagas; comAproAnt = comApro;
  });
  return out;
}

// POC do documento, ou null se a unidade não usa POC (só La Fleur II usa).
export function pocDoDocumento(data) {
  return data?.receita?.poc ? computePOC(data.receita.poc) : null;
}
