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

// Plano de contas de Pagamentos manuais do FC Direto — a aba "Fluxo de
// Caixa Direto" da planilha-fonte não tinha rótulo nenhum nas 7 linhas de
// pagamento (template em branco, só fórmulas de soma); os nomes reais
// abaixo foram confirmados pelo usuário por print em 2026-08-16.
export const PLANO_CONTAS_PAGAMENTOS_TEXTIL = [
  { id: 'rateioAdministrativo', nome: 'Rateio Administrativo' },
  { id: 'materiaPrimaFios', nome: 'Matéria-Prima Fios' },
  { id: 'materiaPrimaQuimicos', nome: 'Matéria-Prima Produtos Químicos' },
  { id: 'maoDeObra', nome: 'Mão de obra' },
  { id: 'gas', nome: 'Gás' },
  { id: 'energiaEletrica', nome: 'Energia Elétrica' },
  { id: 'assessoriasConsultorias', nome: 'Assessorias e Consultorias Int' },
  { id: 'outros', nome: 'Outros' },
];

export function pagamentosManuaisVazios() {
  const p = {};
  PLANO_CONTAS_PAGAMENTOS_TEXTIL.forEach((c) => { p[c.id] = mesesVazios(); });
  return p;
}

/** Soma mensal de todas as contas de pagamento manual. */
export function computePagamentosManuaisMes(pagamentosManuais) {
  const p = pagamentosManuais || pagamentosManuaisVazios();
  return MESES.map((_, m) =>
    PLANO_CONTAS_PAGAMENTOS_TEXTIL.reduce((acc, c) => acc + parseNum(p[c.id]?.[m]), 0)
  );
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

  // porFaixaMes: valor mensal recebido por cada faixa (à vista + cada
  // defasagem de 30 a 360 dias), individualmente — usado na UI para
  // mostrar a tabela linha a linha igual à planilha (linhas 9 a 22).
  const porFaixaMes = {};
  PREMISSAS_RECEBIMENTO_REF.forEach((r) => {
    porFaixaMes[r.id] = MESES.map((_, m) => {
      const origem = m - r.defasagemMeses;
      if (origem < 0) return 0; // antes do início do ciclo — coberto por "em carteira"/"vendas nov-dez"
      return faturamentoMes[origem] * (parseNum(p[r.id]) / 100);
    });
  });

  const pctAVista = parseNum(p.avista) / 100;
  const recebimentosAVistaMes = faturamentoMes.map((f) => f * pctAVista);

  const recebimentosAPrazoMes = MESES.map((_, m) =>
    PREMISSAS_RECEBIMENTO_REF
      .filter((r) => r.defasagemMeses > 0)
      .reduce((acc, r) => acc + porFaixaMes[r.id][m], 0)
  );

  const pctCancelamento = parseNum(p.cancelamento) / 100;
  const cancelamentoMes = recebimentosAPrazoMes.map((v) => -pctCancelamento * v);

  const totalMes = MESES.map((_, m) =>
    emCarteiraMes[m] + vendasNovDezMes[m] + recebimentosAVistaMes[m] + recebimentosAPrazoMes[m] + cancelamentoMes[m]
  );

  return { faturamentoMes, emCarteiraMes, vendasNovDezMes, porFaixaMes, recebimentosAVistaMes, recebimentosAPrazoMes, cancelamentoMes, totalMes };
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

// Saldo de partida (Dez/25) por conta — um único valor por conta, não uma
// série mensal (é o saldo de abertura do ciclo, antes de janeiro/2027).
// Decisão do usuário (2026-08-16): essa coluna some as contas do Balanço,
// digitada linha a linha, logo após a descrição da conta e antes de Jan.
export function saldosIniciaisBalancoVazio() {
  const saldos = {};
  GRUPOS_BALANCO_TEXTIL.forEach((g) => g.contas.forEach((c) => { saldos[c.id] = ''; }));
  return saldos;
}

// Deriva os saldos de abertura relevantes para os cálculos de FC (caixa,
// contas a receber, contas a pagar, estoque) a partir do plano de contas
// granular — só para Têxtil, quando data.balanco.planoContas existe.
// Decisão do usuário (2026-08-16): os campos escalares de saldo de abertura
// somem da tela do Balanço da Têxtil (retirados antes do bloco de plano de
// contas); o valor passa a vir só da coluna Dez/25, lançada por conta. Para
// as demais unidades (sem planoContas), mantém os campos escalares — nada
// muda ali.
export function saldosAberturaFc(data) {
  const bal = data.balanco || {};
  if (bal.planoContas && bal.saldosIniciais) {
    const s = bal.saldosIniciais;
    const contasEstoque = ['estoqueMateriaPrima', 'produtosAcabados', 'estoqueComTerceiros', 'estoqueAlmoxarifado', 'estoqueEmProcesso'];
    return {
      caixaInicial: parseNum(s.disponivel),
      arInicial: parseNum(s.clientes),
      apInicial: parseNum(s.contasAPagar),
      estoqueInicial: contasEstoque.reduce((acc, id) => acc + parseNum(s[id]), 0),
    };
  }
  return {
    caixaInicial: parseNum(bal.caixaInicial),
    arInicial: parseNum(bal.contasAReceberInicial),
    apInicial: parseNum(bal.contasAPagarInicial),
    estoqueInicial: parseNum(bal.estoqueInicial),
  };
}

/** Subtotais por grupo, Ativo Total, Passivo e PL Total, e o Check Balanço
 * (Ativo Total - Passivo e PL Total — zero quando bate, igual à planilha).
 * saldosIniciais (Dez/25) entram como um subtotal adicional por grupo e um
 * check inicial, só para conferência — não alimentam nenhuma fórmula de
 * projeção dos meses seguintes (a aba-fonte não tinha fórmula de
 * roll-forward real, é lançamento manual mês a mês). */
export function computeBalancoMensal(planoContas, saldosIniciais) {
  const contas = planoContas || planoContasBalancoVazio();
  const iniciais = saldosIniciais || saldosIniciaisBalancoVazio();
  const porGrupoMes = {};
  const porGrupoInicial = {};
  GRUPOS_BALANCO_TEXTIL.forEach((g) => {
    porGrupoMes[g.id] = MESES.map((_, m) => g.contas.reduce((acc, c) => acc + parseNum(contas[c.id]?.[m]), 0));
    porGrupoInicial[g.id] = g.contas.reduce((acc, c) => acc + parseNum(iniciais[c.id]), 0);
  });
  const ativoTotalMes = MESES.map((_, m) =>
    (porGrupoMes.ativoCirculante[m] || 0) + (porGrupoMes.ativoNaoCirculante[m] || 0) + (porGrupoMes.ativoPermanente[m] || 0)
  );
  const passivoPlTotalMes = MESES.map((_, m) =>
    (porGrupoMes.passivoCirculante[m] || 0) + (porGrupoMes.passivoNaoCirculante[m] || 0) + (porGrupoMes.patrimonioLiquido[m] || 0)
  );
  const checkMes = MESES.map((_, m) => ativoTotalMes[m] - passivoPlTotalMes[m]);

  const ativoInicial = (porGrupoInicial.ativoCirculante || 0) + (porGrupoInicial.ativoNaoCirculante || 0) + (porGrupoInicial.ativoPermanente || 0);
  const passivoPlInicial = (porGrupoInicial.passivoCirculante || 0) + (porGrupoInicial.passivoNaoCirculante || 0) + (porGrupoInicial.patrimonioLiquido || 0);
  const checkInicial = ativoInicial - passivoPlInicial;

  return { porGrupoMes, ativoTotalMes, passivoPlTotalMes, checkMes, porGrupoInicial, ativoInicial, passivoPlInicial, checkInicial };
}
