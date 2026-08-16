// Kgiro (cascata de recebimentos) e Balanço Patrimonial da ARA Têxtil —
// extraído de "Premissas Têxtil.xlsx" (abas Premissas Kgiro, Fluxo de Caixa
// Direto, Balanço Patrimonial), fornecida pelo usuário em 2026-08-16.
// Decisão de 2026-08-16: uma cascata única (todos os 9 produtos somados),
// não duas separadas por Baixo Giro — por escopo.
//
// Só usado por ARA Têxtil (ver decisão "tudo junto agora" — Agrícola/Resorts
// continuam no modelo simples de prazos em dias de capitalGiro).
import { MESES, mesesVazios } from './constantesTextil.js';

// Duplicado (não importado de orcamento.js) de propósito — evita import
// circular, já que orcamento.js importa funções deste arquivo.
function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Ordem = defasagem em meses entre o mês de origem do faturamento e o mês em
// que aquele % é recebido. 'avista' = 0 (mesmo mês); 'd30' = 1 mês depois
// (a "campainha" de 30 dias corridos, arredondada a mês — mesma aproximação
// da planilha original, que também trabalha em colunas mensais).
export const PREMISSAS_RECEBIMENTO_REF = [
  { id: 'avista', nome: 'À vista', pctRef: 10, defasagemMeses: 0 },
  { id: 'd30', nome: '30 dias', pctRef: 4, defasagemMeses: 1 },
  { id: 'd60', nome: '60 dias', pctRef: 14, defasagemMeses: 2 },
  { id: 'd90', nome: '90 dias', pctRef: 45, defasagemMeses: 3 },
  { id: 'd120', nome: '120 dias', pctRef: 19, defasagemMeses: 4 },
  { id: 'd150', nome: '150 dias', pctRef: 8, defasagemMeses: 5 },
  { id: 'd180', nome: '180 dias', pctRef: 0, defasagemMeses: 6 },
  { id: 'd210', nome: '210 dias', pctRef: 0, defasagemMeses: 7 },
  { id: 'd240', nome: '240 dias', pctRef: 0, defasagemMeses: 8 },
  { id: 'd270', nome: '270 dias', pctRef: 0, defasagemMeses: 9 },
  { id: 'd300', nome: '300 dias', pctRef: 0, defasagemMeses: 10 },
  { id: 'd330', nome: '330 dias', pctRef: 0, defasagemMeses: 11 },
  { id: 'd360', nome: '360 dias', pctRef: 0, defasagemMeses: 12 },
];

export function premissasRecebimentoVazias() {
  const p = {};
  PREMISSAS_RECEBIMENTO_REF.forEach((r) => { p[r.id] = ''; });
  p.cancelamento = '';
  return p;
}

// ---------------------------------------------------------------------------
// Cascata de recebimentos — fórmulas conferidas na planilha (Premissas
// Kgiro): linhas 6-7 são digitadas mês a mês (carryover do ano anterior);
// linha 8 (Faturamento Líquido de Cancelamentos) é a Receita Líquida já
// calculada na aba Receita — não digitada de novo aqui; linhas 9-23 são
// só as % (coluna "Premissa"), aplicadas em cascata:
//   à vista[m]  = %avista × faturamento[m]
//   a prazo[m]  = Σ %prazo[k] × faturamento[m - defasagem(k)]  (só origem >= mês 0 —
//                 origem anterior a jan/2027 é o que "em carteira" e "vendas
//                 nov-dez" cobrem manualmente, por isso não entram aqui)
//   cancelamento[m] = -%cancelamento × (a prazo[m])  (sobre o total do mês, não por origem)
// ---------------------------------------------------------------------------
export function computeRecebimentosKgiroMensal(data, dre) {
  const cg = data.capitalGiro;
  const p = cg.premissasRecebimento || premissasRecebimentoVazias();
  const faturamentoMes = dre.receitaLiquidaMes;
  const emCarteiraMes = (cg.recebimentosEmCarteira || mesesVazios()).map(parseNum);
  const vendasNovDezMes = (cg.recebimentosVendasNovDez || mesesVazios()).map(parseNum);

  const pctAVista = parseNum(p.avista) / 100;
  const recebimentosAVistaMes = faturamentoMes.map((f) => f * pctAVista);

  const recebimentosAPrazoMes = MESES.map((_, m) =>
    PREMISSAS_RECEBIMENTO_REF
      .filter((r) => r.defasagemMeses > 0)
      .reduce((acc, r) => {
        const origem = m - r.defasagemMeses;
        if (origem < 0) return acc; // antes do início do ciclo — coberto por "em carteira"/"vendas nov-dez"
        return acc + faturamentoMes[origem] * (parseNum(p[r.id]) / 100);
      }, 0)
  );

  const pctCancelamento = parseNum(p.cancelamento) / 100;
  const cancelamentoMes = recebimentosAPrazoMes.map((v) => -pctCancelamento * v);

  const totalMes = MESES.map((_, m) =>
    emCarteiraMes[m] + vendasNovDezMes[m] + recebimentosAVistaMes[m] + recebimentosAPrazoMes[m] + cancelamentoMes[m]
  );

  return { faturamentoMes, emCarteiraMes, vendasNovDezMes, recebimentosAVistaMes, recebimentosAPrazoMes, cancelamentoMes, totalMes };
}

export function novoPagamentoManual() {
  return { id: `pgto-${Math.random().toString(36).slice(2, 9)}`, nome: '', valores: mesesVazios() };
}

// ---------------------------------------------------------------------------
// Plano de contas do Balanço Patrimonial — conferido na aba Balanço
// Patrimonial da planilha. Diferente da cascata de recebimentos, essa aba
// não trazia fórmulas de projeção reais (template em branco, só os SUM()
// dos subtotais) — por isso cada conta aqui é lançamento manual mês a mês,
// igual a planilha original é de fato; só os subtotais e o "Check Balanço"
// são calculados (ver computeBalancoMensal).
// ---------------------------------------------------------------------------
export const GRUPOS_BALANCO_TEXTIL = [
  {
    id: 'ativoCirculante', nome: 'ATIVO CIRCULANTE', ladoBalanco: 'ativo',
    contas: [
      { id: 'disponivel', nome: 'DISPONÍVEL' },
      { id: 'clientes', nome: 'CLIENTES' },
      { id: 'outrosCreditos', nome: 'OUTROS CRÉDITOS' },
      { id: 'estoqueMateriaPrima', nome: 'ESTOQUE DE MATÉRIA PRIMA' },
      { id: 'produtosAcabados', nome: 'PRODUTOS ACABADOS' },
      { id: 'estoqueComTerceiros', nome: 'ESTOQUE COM TERCEIROS' },
      { id: 'estoqueAlmoxarifado', nome: 'ESTOQUE ALMOXARIFADO' },
      { id: 'estoqueEmProcesso', nome: 'ESTOQUE EM PROCESSO' },
      { id: 'outrosCustosAtivo', nome: 'OUTROS CUSTOS' },
    ],
  },
  {
    id: 'ativoNaoCirculante', nome: 'ATIVO NÃO CIRCULANTE', ladoBalanco: 'ativo',
    contas: [
      { id: 'creditosDiversos', nome: 'CRÉDITOS DIVERSOS' },
    ],
  },
  {
    id: 'ativoPermanente', nome: 'ATIVO PERMANENTE', ladoBalanco: 'ativo',
    contas: [
      { id: 'investimentos', nome: 'INVESTIMENTOS' },
      { id: 'imobilizadoExistente', nome: 'IMOBILIZADO E INTANGÍVEL EXISTENTE' },
      { id: 'capexNovosInvestimentos', nome: 'CAPEX NOVOS INVESTIMENTOS' },
      { id: 'depreciacaoAcumulada', nome: 'DEPRECIAÇÃO ACUMULADA' },
      { id: 'depreciacaoPeriodo', nome: 'DEPRECIAÇÃO DO PERÍODO' },
    ],
  },
  {
    id: 'passivoCirculante', nome: 'PASSIVO CIRCULANTE', ladoBalanco: 'passivo',
    contas: [
      { id: 'contasAPagar', nome: 'CONTAS A PAGAR' },
      { id: 'obrigacoesComTerceiros', nome: 'OBRIGAÇÕES COM TERCEIROS' },
      { id: 'obrigacoesTrabalhistas', nome: 'OBRIGAÇÕES TRABALHISTAS/SOCIAIS' },
      { id: 'obrigacoesTributarias', nome: 'OBRIGAÇÕES TRIBUTÁRIAS' },
    ],
  },
  {
    id: 'passivoNaoCirculante', nome: 'PASSIVO NÃO CIRCULANTE', ladoBalanco: 'passivo',
    contas: [
      { id: 'emprestimosPassivo', nome: 'EMPRÉSTIMOS' },
    ],
  },
  {
    id: 'patrimonioLiquido', nome: 'PATRIMÔNIO LÍQUIDO', ladoBalanco: 'passivo',
    contas: [
      { id: 'capitalSocialReservas', nome: 'CAPITAL SOCIAL E RESERVAS' },
      { id: 'reservaIncentivoFiscal', nome: 'RESERVA DE INCENTIVO FISCAL - PRODEPE' },
      { id: 'lucroPrejuizoAcumulados', nome: 'LUCRO OU PREJUÍZO ACUMULADOS' },
      { id: 'resultadoPeriodo', nome: 'RESULTADO DO PERÍODO' },
    ],
  },
];

export function planoContasBalancoVazio() {
  const contas = {};
  GRUPOS_BALANCO_TEXTIL.forEach((g) => g.contas.forEach((c) => { contas[c.id] = mesesVazios(); }));
  return contas;
}

/** Subtotais por grupo, Ativo Total, Passivo e PL Total, e o Check Balanço
 * (Ativo Total - Passivo e PL Total — zero quando bate, igual à planilha). */
export function computeBalancoMensal(planoContas) {
  const contas = planoContas || planoContasBalancoVazio();
  const porGrupoMes = {};
  GRUPOS_BALANCO_TEXTIL.forEach((g) => {
    porGrupoMes[g.id] = MESES.map((_, m) => g.contas.reduce((acc, c) => acc + parseNum(contas[c.id]?.[m]), 0));
  });
  const ativoTotalMes = MESES.map((_, m) =>
    (porGrupoMes.ativoCirculante[m] || 0) + (porGrupoMes.ativoNaoCirculante[m] || 0) + (porGrupoMes.ativoPermanente[m] || 0)
  );
  const passivoPlTotalMes = MESES.map((_, m) =>
    (porGrupoMes.passivoCirculante[m] || 0) + (porGrupoMes.passivoNaoCirculante[m] || 0) + (porGrupoMes.patrimonioLiquido[m] || 0)
  );
  const checkMes = MESES.map((_, m) => ativoTotalMes[m] - passivoPlTotalMes[m]);
  return { porGrupoMes, ativoTotalMes, passivoPlTotalMes, checkMes };
}
