// =====================================================================================
// Grupo ARA — OrcamentoARA.jsx — Protótipo do formulário de Orçamento OBZ (Caminho A)
// Fonte de verdade. Editar aqui; OrcamentoARA.html é gerado a partir deste arquivo
// (ver "Como editar o protótipo" em Referencia_Projeto_Orcamento_2027.md).
// =====================================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Send, History, FileSpreadsheet, FileBarChart, CheckCircle2, AlertTriangle,
  Building2, ChevronDown, ChevronRight, Plus, Trash2, Clock, ShieldCheck,
  Users, Loader2, Info,
} from 'lucide-react';
import { getOrcamento, putOrcamento, enviarVersao as enviarVersaoApi, listarVersoes, liberarReenvio as liberarReenvioApi, buscarVersao as buscarVersaoApi } from './api/orcamentos.js';
import { logout } from './api/auth.js';
import { legacyStorage } from './legacyStorage.js';
import { ApiError } from './api/client.js';

const PERFIL_LABEL = {
  admin_fpa: 'Admin FP&A',
  gerente_unidade: 'Gestor da Unidade',
  gerente_cc_corporativo: 'Gestor de CC', // rebatizado em 2026-08-16 — não é mais só Corporativo
};

// Únicas unidades com lançamento de orçamento habilitado no backend hoje —
// espelha UNIDADES_COM_LANCAMENTO_HABILITADO em backend/src/routes/orcamentos.js.
// Agrícola e Resorts habilitadas em 2026-08-09 (CC placeholder, ver
// REFERENCIA_POR_UNIDADE). Corporativo continua painel de referência
// (pendência diferente — falta De/Para conta×CC); ARA EI segue de fora,
// sem plano de contas nenhum ainda.
const UNIDADES_COM_LANCAMENTO_HABILITADO = ['textil', 'agricola', 'resorts', 'corporativo'];

const COR = {
  azul: '#0C4391',
  laranja: '#FFA707',
  texto: '#494949',
  borda: '#D9D9D9',
  claro: '#F7F7F7',
  total: '#FFF3E0',
  branco: '#FFFFFF',
  verde: '#008000',
  vermelho: '#C00000',
};

const UNIDADES = [
  { id: 'textil', nome: 'ARA Têxtil', cor: '#0069B4', logo: '/logos/ara-textil.jpg', logoAltura: 24 },
  { id: 'agricola', nome: 'ARA Agrícola', cor: '#009640', logo: '/logos/ara-agricola.png', logoAltura: 17 },
  { id: 'resorts', nome: 'ARA Resorts', cor: '#79834F', logo: '/logos/ara-resorts.jpg', logoAltura: 24 },
  { id: 'ei', nome: 'ARA EI', cor: '#F07D00', logo: null }, // pendente: arquivo não recebido ainda
  // Renomeado de "ARA Energia" em 2026-08-09 — id interno continua 'energia'
  // (evita mexer em schema/seed/perfis), mas essa unidade não segue a mesma
  // estrutura de abas das demais: é uma Visão de Portfólio de Investimentos
  // (UFVs, PCH, Novo Cais, MCMV) e Aporte/Distribuição no Grupo, não um DRE
  // por CC — estrutura de verdade ainda não definida, ver aviso na tela.
  { id: 'energia', nome: 'Escritório de Investimentos', cor: '#FECC00', logo: null },
  { id: 'corporativo', nome: 'Corporativo', cor: '#0C4391', logo: '/logos/grupo-ara.jpg', logoAltura: 24 },
];

const FONT = "'Aptos Narrow','Aptos','Segoe UI',system-ui,sans-serif";

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const mesesVazios = () => Array(12).fill('');

// ---- Produtos (aba "1.1 DRE" / "Orçamento Receita") — referência 2026, não pré-preenchida ----
const PRODUTOS_REF = [
  { nome: 'ALGODAO PENTEADO 1,20', volumeRef: 405, precoRef: 41.70 },
  { nome: 'COTTON LIGHT', volumeRef: 495, precoRef: 47.50 },
  { nome: 'COTTON SOFT', volumeRef: 230, precoRef: 43.50 },
  { nome: 'L20', volumeRef: 201, precoRef: 27.25 },
  { nome: 'MALHA UV', volumeRef: 354, precoRef: 26.50 },
  { nome: 'PVN', volumeRef: 126, precoRef: 23.59 },
  { nome: 'SUPLEX', volumeRef: 1726, precoRef: 28.30 },
  { nome: 'UV CONFORT', volumeRef: 241, precoRef: 28.50 },
  { nome: 'BAIXO GIRO', volumeRef: 423, precoRef: 19.80 },
];

// Referência real 2026 — fonte: Premissas_por_Empresa.xlsx, aba Premissas_Têxtil
// Volume (t), Preço ponderado (R$/t) e Deduções (R$) por produto/imposto, mês a mês.
const REFERENCIA_2026_TEXTIL = {
  volume: {
    "ALGODAO PENTEADO 1,20": [40.0, 10.0, 30.0, 35.0, 35.0, 35.0, 40.0, 30.0, 35.0, 40.0, 40.0, 35.0],
    "COTTON LIGHT": [40.0, 15.0, 40.0, 30.0, 40.0, 45.0, 50.0, 49.52, 50.0, 50.0, 50.0, 35.0],
    "COTTON SOFT": [20.0, 10.0, 10.0, 20.0, 20.0, 20.0, 20.0, 20.0, 25.0, 25.0, 25.0, 15.0],
    "L20": [20.0, 10.0, 20.0, 20.08, 19.29, 22.0, 19.58, 15.44, 14.65, 10.0, 15.0, 15.0],
    "MALHA UV": [30.0, 15.0, 30.0, 30.03, 25.0, 30.0, 25.0, 19.55, 40.0, 45.0, 45.0, 18.93],
    "PVN": [20.0, 9.5, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 6.83],
    "SUPLEX": [160.0, 63.0, 145.0, 150.0, 160.0, 150.0, 150.0, 150.0, 155.0, 173.0, 170.0, 100.0],
    "UV CONFORT": [20.0, 10.0, 15.0, 20.0, 18.0, 18.0, 20.0, 30.0, 25.0, 25.0, 25.0, 15.0],
    "BAIXO GIRO": [45.0, 12.0, 18.0, 35.0, 35.0, 40.0, 40.0, 40.0, 45.0, 50.0, 45.0, 18.0],
  },
  preco: {
    "ALGODAO PENTEADO 1,20": [41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7],
    "COTTON LIGHT": [47.5, 47.5, 47.5, 47.5, 47.5, 47.5, 47.5, 47.5, 47.5, 47.5, 47.5, 47.5],
    "COTTON SOFT": [43.5, 43.5, 43.5, 43.5, 43.5, 43.5, 43.5, 43.5, 43.5, 43.5, 43.5, 43.5],
    "L20": [27.25, 27.25, 27.25, 27.25, 27.25, 27.25, 27.25, 27.25, 27.25, 27.25, 27.25, 27.25],
    "MALHA UV": [26.5, 26.5, 26.5, 26.5, 26.5, 26.5, 26.5, 26.5, 26.5, 26.5, 26.5, 26.5],
    "PVN": [23.59, 23.59, 23.59, 23.59, 23.59, 23.59, 23.59, 23.59, 23.59, 23.59, 23.59, 23.59],
    "SUPLEX": [28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3],
    "UV CONFORT": [28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5],
    "BAIXO GIRO": [19.8, 19.8, 19.8, 19.8, 19.8, 19.8, 19.8, 19.8, 19.8, 19.8, 19.8, 19.8],
  },
  deducoes: {
    "PIS": [-179.38, -69.83, -147.29, -158.89, -166.9, -170.71, -175.17, -169.13, -184.77, -196.83, -196.13, -123.99],
    "Cofins": [-826.22, -321.62, -678.41, -731.87, -768.75, -786.29, -806.85, -779.02, -851.07, -906.62, -903.4, -571.1],
    "ISS": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    "ICMS Pernambuco": [-771.04, -300.14, -633.11, -682.99, -717.42, -733.79, -752.97, -727.0, -794.24, -846.08, -843.08, -532.97],
    "ICMS Fortaleza": [-146.87, -57.17, -120.59, -130.09, -136.65, -139.77, -143.42, -138.48, -151.28, -161.16, -160.59, -101.52],
    "Cancelamentos": [-340.43, -135.8, -290.79, -304.45, -320.84, -325.66, -334.8, -322.43, -351.48, -373.19, -374.73, -243.1],
  },
  receitaLiquida: [9974.86, 3879.63, 8179.12, 8832.89, 9277.04, 9491.18, 9738.74, 9403.65, 10274.17, 10945.92, 10904.22, 6887.09],
};

// ---------------------------------------------------------------------------
// Kgiro (cascata de recebimentos) e Balanço Patrimonial — só ARA Têxtil.
// Extraído de "Premissas Têxtil.xlsx" (abas Premissas Kgiro, Fluxo de Caixa
// Direto, Balanço Patrimonial), fornecida pelo usuário em 2026-08-16.
// Decisão de 2026-08-16: uma cascata única (todos os 9 produtos somados),
// não duas separadas por Baixo Giro — por escopo.
// ---------------------------------------------------------------------------
const PREMISSAS_RECEBIMENTO_REF = [
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
function premissasRecebimentoVazias() {
  const p = {};
  PREMISSAS_RECEBIMENTO_REF.forEach((r) => { p[r.id] = ''; });
  p.cancelamento = '';
  return p;
}

// Plano de contas de Pagamentos manuais do FC Direto — a aba "Fluxo de
// Caixa Direto" da planilha-fonte não tinha rótulo nenhum nas 7 linhas de
// pagamento (template em branco, só fórmulas de soma); os nomes reais
// abaixo foram confirmados pelo usuário por print em 2026-08-16 (batem com
// contas reais do plano oficial, ex.: "MATERIA PRIMA FIO"/"MATERIA PRIMA
// PRODUTOS QUIMICOS" em PLANO_CONTAS.producao).
const PLANO_CONTAS_PAGAMENTOS_TEXTIL = [
  { id: 'rateioAdministrativo', nome: 'Rateio Administrativo' },
  { id: 'materiaPrimaFios', nome: 'Matéria-Prima Fios' },
  { id: 'materiaPrimaQuimicos', nome: 'Matéria-Prima Produtos Químicos' },
  { id: 'maoDeObra', nome: 'Mão de obra' },
  { id: 'gas', nome: 'Gás' },
  { id: 'energiaEletrica', nome: 'Energia Elétrica' },
  { id: 'assessoriasConsultorias', nome: 'Assessorias e Consultorias Int' },
  { id: 'outros', nome: 'Outros' },
];
function pagamentosManuaisVazios() {
  const p = {};
  PLANO_CONTAS_PAGAMENTOS_TEXTIL.forEach((c) => { p[c.id] = mesesVazios(); });
  return p;
}
/** Soma mensal de todas as contas de pagamento manual. */
function computePagamentosManuaisMes(pagamentosManuais) {
  const p = pagamentosManuais || pagamentosManuaisVazios();
  return MESES.map((_, m) =>
    PLANO_CONTAS_PAGAMENTOS_TEXTIL.reduce((acc, c) => acc + parseNum(p[c.id]?.[m]), 0)
  );
}

// Fórmulas conferidas na planilha (ver nota completa no arquivo espelho
// backend/src/calc/kgiroBalancoTextil.js): à vista = %avista × faturamento
// do mês; a prazo = soma das % aplicadas ao faturamento do mês de origem,
// defasado; cancelamento = -%cancelamento × recebimentos a prazo do mês.
function computeRecebimentosKgiroMensal(data, dre) {
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
      if (origem < 0) return 0;
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

// Plano de contas do Balanço Patrimonial — conferido na aba Balanço
// Patrimonial da planilha (template em branco, só os SUM() dos subtotais
// tinham fórmula real — por isso cada conta aqui é lançamento manual mês a
// mês, igual à planilha original; só os subtotais e o Check Balanço são
// calculados, ver computeBalancoMensal).
const GRUPOS_BALANCO_TEXTIL = [
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
    contas: [{ id: 'creditosDiversos', nome: 'CRÉDITOS DIVERSOS' }],
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
    contas: [{ id: 'emprestimosPassivo', nome: 'EMPRÉSTIMOS' }],
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
function planoContasBalancoVazio() {
  const contas = {};
  GRUPOS_BALANCO_TEXTIL.forEach((g) => g.contas.forEach((c) => { contas[c.id] = mesesVazios(); }));
  return contas;
}

// Saldo de partida (Dez/25) por conta — um único valor por conta, não uma
// série mensal. Decisão do usuário (2026-08-16): essa coluna soma as
// contas do Balanço, digitada linha a linha, logo após a descrição da
// conta e antes de Jan.
function saldosIniciaisBalancoVazio() {
  const saldos = {};
  GRUPOS_BALANCO_TEXTIL.forEach((g) => g.contas.forEach((c) => { saldos[c.id] = ''; }));
  return saldos;
}

/** Subtotais por grupo, Ativo Total, Passivo e PL Total, e o Check Balanço
 * (Ativo Total - Passivo e PL Total — zero quando bate, igual à planilha).
 * saldosIniciais (Dez/25) entram como um subtotal adicional por grupo e um
 * check inicial, só para conferência — não alimentam nenhuma fórmula de
 * projeção dos meses seguintes (a aba-fonte não tinha fórmula de
 * roll-forward real, é lançamento manual mês a mês). */
function computeBalancoMensal(planoContas, saldosIniciais) {
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

// Deriva os saldos de abertura relevantes para os cálculos de FC (caixa,
// contas a receber, contas a pagar, estoque) a partir do plano de contas
// granular — só para Têxtil, quando data.balanco.planoContas existe.
// Decisão do usuário (2026-08-16): os campos escalares de saldo de abertura
// somem da tela do Balanço da Têxtil; o valor passa a vir só da coluna
// Dez/25, lançada por conta. Demais unidades (sem planoContas): inalterado.
function saldosAberturaFc(data) {
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


// ---- Deduções sobre receita — referência 2026 (aba 1.1 DRE), editável ----
const DEDUCOES_REF = [
  { id: 'pis', nome: 'PIS', pctRef: 1.47 },
  { id: 'cofins', nome: 'Cofins', pctRef: 6.75 },
  { id: 'icms_pe', nome: 'ICMS Pernambuco', pctRef: 7.00 },
  { id: 'icms_for', nome: 'ICMS Fortaleza', pctRef: 12.00 },
  { id: 'cancelamentos', nome: 'Cancelamentos', pctRef: 3.00 },
];

// ---- Premissas macroeconômicas de referência para o ciclo 2027 (campo aberto, sem valor pré-definido) ----
const PREMISSAS_MACRO_REF = [
  { id: 'ipca', nome: 'Inflação — IPCA', unidade: '% a.a.' },
  { id: 'cambio', nome: 'Câmbio — USD/BRL médio', unidade: 'R$' },
  { id: 'selic', nome: 'Taxa Selic média', unidade: '% a.a.' },
  { id: 'pib', nome: 'Crescimento do PIB', unidade: '% a.a.' },
  { id: 'reajuste_salarial', nome: 'Reajuste salarial/dissídio', unidade: '% a.a.' },
];

// ---- Centros de Custo — Consulta CTT010 (colunas B/E), nível de área ----
// PROPOSTO — a confirmar: granularidade (área vs subárea) e classificação Custo x Despesa
export const CCS_TEXTIL = [
  { codigo: '00401', nome: 'Malharia', tipo: 'producao' },
  { codigo: '00402', nome: 'Beneficiamento', tipo: 'producao' },
  { codigo: '00403', nome: 'Produção', tipo: 'producao' },
  { codigo: '00001', nome: 'Diretoria', tipo: 'despesa' },
  { codigo: '00101', nome: 'Administração', tipo: 'despesa' },
  { codigo: '00201', nome: 'Comercial', tipo: 'despesa' },
  { codigo: '00301', nome: 'Logística', tipo: 'despesa', obs: 'inativo no Protheus — confirmar' },
  { codigo: '00999', nome: 'Apoio Geral', tipo: 'despesa' },
];

// Pacotes orçamentários — fonte oficial: Matriz_Governanca_OBZ_2027_4.xlsx, aba Têxtil_Contas_x_Pacote (167 contas, 100% classificadas)
const PACOTES_TEXTIL = [
  { id: 'pessoal', nome: "Pessoal", ref: 'Matriz_Governanca_OBZ_2027_4 (43 contas)' },
  { id: 'producao', nome: "Produção", ref: 'Matriz_Governanca_OBZ_2027_4 (12 contas)' },
  { id: 'manutencao', nome: "Manutenção", ref: 'Matriz_Governanca_OBZ_2027_4 (13 contas)' },
  { id: 'fretes', nome: "Fretes e Logística", ref: 'Matriz_Governanca_OBZ_2027_4 (8 contas)' },
  { id: 'servicos', nome: "Serviços de Terceiros", ref: 'Matriz_Governanca_OBZ_2027_4 (11 contas)' },
  { id: 'comercial', nome: "Comercial e Marketing", ref: 'Matriz_Governanca_OBZ_2027_4 (2 contas)' },
  { id: 'viagens', nome: "Viagens", ref: 'Matriz_Governanca_OBZ_2027_4 (3 contas)' },
  { id: 'locacao_utilidades', nome: "Locação, Ocupação e Utilidades", ref: 'Matriz_Governanca_OBZ_2027_4 (17 contas)' },
  { id: 'depreciacao', nome: "Depreciação e Amortização", ref: 'Matriz_Governanca_OBZ_2027_4 (10 contas)' },
  { id: 'administrativo', nome: "Administrativo", ref: 'Matriz_Governanca_OBZ_2027_4 (43 contas)' },
  { id: 'impostos', nome: "Impostos Indiretos e Diretos", ref: 'Matriz_Governanca_OBZ_2027_4 (5 contas)' },
];

// De-para oficial conta contábil -> Pacote (Matriz_Governanca_OBZ_2027_4)
const PLANO_CONTAS = {
  pessoal: [
    { codigo: '71101001', nome: "SALARIOS E ORDENADOS", origem: 'Custo' },
    { codigo: '71101002', nome: "PREMIOS E GRATIFICACOES", origem: 'Custo' },
    { codigo: '71101003', nome: "HORAS EXTRAS", origem: 'Custo' },
    { codigo: '71101004', nome: "FERIAS E ABONO", origem: 'Custo' },
    { codigo: '71101005', nome: "13º SALARIO", origem: 'Custo' },
    { codigo: '71101006', nome: "INSS (GPS)", origem: 'Custo' },
    { codigo: '71101007', nome: "FGTS (GFIP)", origem: 'Custo' },
    { codigo: '71101008', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Custo' },
    { codigo: '71101009', nome: "VALE ELETRONICO (VEM)", origem: 'Custo' },
    { codigo: '71101010', nome: "CESTAS BASICAS", origem: 'Custo' },
    { codigo: '71101011', nome: "FARDAMENTOS - EPI", origem: 'Custo' },
    { codigo: '71101012', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Custo' },
    { codigo: '71101013', nome: "DESPESAS COM TREINAMENTO DE PESSOAL", origem: 'Custo' },
    { codigo: '71101014', nome: "PENSAO ALIMENTICIA", origem: 'Custo' },
    { codigo: '71102098', nome: "RATEIO - MAO DE OBRA", origem: 'Custo' },
    { codigo: '34101001', nome: "ORDENADOS E SALARIOS", origem: 'Despesa' },
    { codigo: '34101002', nome: "PREMIOS E GRATIFICACOES", origem: 'Despesa' },
    { codigo: '34101003', nome: "13º SALARIO", origem: 'Despesa' },
    { codigo: '34101004', nome: "FERIAS", origem: 'Despesa' },
    { codigo: '34101005', nome: "INSS (GPS)", origem: 'Despesa' },
    { codigo: '34101006', nome: "FGTS (GFIP)", origem: 'Despesa' },
    { codigo: '34101007', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Despesa' },
    { codigo: '34101008', nome: "VALE ELETRONICO (VEM)", origem: 'Despesa' },
    { codigo: '34101009', nome: "CESTAS BASICAS", origem: 'Despesa' },
    { codigo: '34101010', nome: "FARDAMENTOS - EPI", origem: 'Despesa' },
    { codigo: '34101011', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Despesa' },
    { codigo: '34101012', nome: "DESPESAS COM TREINAMENTO DE PESSOAL", origem: 'Despesa' },
    { codigo: '34101014', nome: "HORAS EXTRAS", origem: 'Despesa' },
    { codigo: '34201001', nome: "ORDENADOS E SALARIOS", origem: 'Despesa' },
    { codigo: '34201002', nome: "PREMIOS E GRATIFICACOES", origem: 'Despesa' },
    { codigo: '34201003', nome: "13º SALARIO", origem: 'Despesa' },
    { codigo: '34201004', nome: "FERIAS", origem: 'Despesa' },
    { codigo: '34201005', nome: "INSS (GPS)", origem: 'Despesa' },
    { codigo: '34201006', nome: "FGTS (GFIP)", origem: 'Despesa' },
    { codigo: '34201007', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Despesa' },
    { codigo: '34201008', nome: "VALE ELETRONICO (VEM)", origem: 'Despesa' },
    { codigo: '34201009', nome: "CESTAS BASICAS", origem: 'Despesa' },
    { codigo: '34201010', nome: "FARDAMENTOS - EPI", origem: 'Despesa' },
    { codigo: '34201011', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Despesa' },
    { codigo: '34201012', nome: "DESPESA COM TREINAMENTO DE PESSOAL", origem: 'Despesa' },
    { codigo: '34201013', nome: "PENSAO ALIMENTICIA", origem: 'Despesa' },
    { codigo: '34201014', nome: "PRO-LABORE", origem: 'Despesa' },
    { codigo: '34201015', nome: "HORAS EXTRAS", origem: 'Despesa' },
  ],
  producao: [
    { codigo: '71102010', nome: "MATERIA PRIMA FIO", origem: 'Custo' },
    { codigo: '71102011', nome: "MATERIA PRIMA PRODUTOS QUIMICOS", origem: 'Custo' },
    { codigo: '71102012', nome: "MATERIAL DE EMBALAGENS", origem: 'Custo' },
    { codigo: '71102037', nome: "MALHA CRUA", origem: 'Custo' },
    { codigo: '72102101', nome: "CUSTOS DIRETOS", origem: 'Custo' },
    { codigo: '72102102', nome: "MALHARIA", origem: 'Custo' },
    { codigo: '72102103', nome: "MOD - MAO OBRA DIRETA", origem: 'Custo' },
    { codigo: '72102104', nome: "MATERIA PRIMA", origem: 'Custo' },
    { codigo: '72102105', nome: "BENEFICIAMENTO", origem: 'Custo' },
    { codigo: '72102106', nome: "MOD - MAO DE OBRA DIRETA", origem: 'Custo' },
    { codigo: '72102107', nome: "MATERIA PRIMA", origem: 'Custo' },
    { codigo: '72102108', nome: "EMBALAGEM", origem: 'Custo' },
  ],
  manutencao: [
    { codigo: '71102004', nome: "MANUTENCAO, CONSERVACAO E LIMPEZA", origem: 'Custo' },
    { codigo: '71102022', nome: "MANUTENCAO PREDIAL", origem: 'Custo' },
    { codigo: '71102033', nome: "MANUTENCAO DE MAQ E EQUIPAMENTOS", origem: 'Custo' },
    { codigo: '34104002', nome: "MANUTENCAO DE VEICULOS", origem: 'Despesa' },
    { codigo: '34104010', nome: "MANUTENCAO - CONSERVACAO E LIMPEZA", origem: 'Despesa' },
    { codigo: '34104028', nome: "MANUTENCAO DE MAQUINAS E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34104031', nome: "DESPESAS COM COMBUSTIVEIS", origem: 'Despesa' },
    { codigo: '34104032', nome: "MANUTENCAO PREDIAL", origem: 'Despesa' },
    { codigo: '34202004', nome: "MANUTENCAO DE VEICULOS", origem: 'Despesa' },
    { codigo: '34202007', nome: "CONSERVACAO E LIMPEZA", origem: 'Despesa' },
    { codigo: '34202026', nome: "MANUTENCAO DE MAQ E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34202029', nome: "DESPESAS COM COMBUSTIVEL", origem: 'Despesa' },
    { codigo: '34202030', nome: "MANUTENCAO PREDIAL", origem: 'Despesa' },
  ],
  fretes: [
    { codigo: '71102009', nome: "FRETES E CARRETOS", origem: 'Custo' },
    { codigo: '71102030', nome: "DESPACHANTE", origem: 'Custo' },
    { codigo: '34104001', nome: "FRETES E CARRETOS", origem: 'Despesa' },
    { codigo: '34104003', nome: "SERVICOS ADUANEIROS", origem: 'Despesa' },
    { codigo: '34104004', nome: "DESPACHANTE", origem: 'Despesa' },
    { codigo: '34202015', nome: "FRETES E CARRETOS", origem: 'Despesa' },
    { codigo: '34202032', nome: "DESPACHANTE", origem: 'Despesa' },
    { codigo: '34202040', nome: "DESPESAS COM ARMAZENAGEM", origem: 'Despesa' },
  ],
  servicos: [
    { codigo: '71102003', nome: "SERVICOS DE TERCEIROS - PJ", origem: 'Custo' },
    { codigo: '71102016', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Custo' },
    { codigo: '71102017', nome: "SERVICOS DE TERCEIROS - PESSOA FISICA", origem: 'Custo' },
    { codigo: '71102031', nome: "SEGURANCA E VIGILANCIA", origem: 'Custo' },
    { codigo: '34104013', nome: "SERVICOS DE TERCEIROS PESSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34104025', nome: "SEGURANCA - VIGILANCIA", origem: 'Despesa' },
    { codigo: '34104029', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Despesa' },
    { codigo: '34202010', nome: "SERVICOS DE TERCEIROS - PJ", origem: 'Despesa' },
    { codigo: '34202017', nome: "SERVICOS DE TERCEIROS - PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202023', nome: "SEGURANCA E VIGILANCIA", origem: 'Despesa' },
    { codigo: '34202027', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Despesa' },
  ],
  comercial: [
    { codigo: '34102001', nome: "COMISSOES", origem: 'Despesa' },
    { codigo: '34103001', nome: "PROPAGANDA E PUBLICIDADE", origem: 'Despesa' },
  ],
  viagens: [
    { codigo: '71102026', nome: "DESPESAS COM VIAGENS", origem: 'Custo' },
    { codigo: '34104020', nome: "DESPESAS COM VIAGENS", origem: 'Despesa' },
    { codigo: '34202018', nome: "DESPESAS COM VIAGENS", origem: 'Despesa' },
  ],
  locacao_utilidades: [
    { codigo: '71102027', nome: "ALUGUEL", origem: 'Custo' },
    { codigo: '71102032', nome: "LOCACAO DE MAQUINAS E EQUIPAMENTOS", origem: 'Custo' },
    { codigo: '34104019', nome: "LOCACAO DE PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34104021', nome: "LOCACOES E CONDOMINIOS", origem: 'Despesa' },
    { codigo: '34104027', nome: "LOCACAO DE MAQUINAS E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34104035', nome: "LOCACAO DE PESSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34202019', nome: "ALUGUEL A PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202025', nome: "LOCACAO DE MAQ E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '71102001', nome: "ENERGIA ELETRICA", origem: 'Custo' },
    { codigo: '71102002', nome: "TELEFONE", origem: 'Custo' },
    { codigo: '71102034', nome: "DESPESAS COM GAS", origem: 'Custo' },
    { codigo: '34104005', nome: "ENERGIA ELETRICA", origem: 'Despesa' },
    { codigo: '34104006', nome: "AGUA E ESGOTO", origem: 'Despesa' },
    { codigo: '34104007', nome: "TELEFONE E INTERNET", origem: 'Despesa' },
    { codigo: '34202001', nome: "ENERGIA ELETRICA", origem: 'Despesa' },
    { codigo: '34202002', nome: "AGUA E ESGOTO", origem: 'Despesa' },
    { codigo: '34202003', nome: "TELEFONE E INTERNET", origem: 'Despesa' },
  ],
  depreciacao: [
    { codigo: '71102008', nome: "ENCARGOS COM DEPRECIACAO", origem: 'Custo' },
    { codigo: '71102015', nome: "ENCARGOS DE DEPRECIACAO -CUSTO ATRIBUIDO", origem: 'Custo' },
    { codigo: '71102023', nome: "PIS-COFINS SOBRE DEPRECIACAO", origem: 'Custo' },
    { codigo: '34104014', nome: "ENCARGOS DE DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34104022', nome: "PIS - COFINS SOBRE DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34104026', nome: "DEPRECIACAO - CUSTO ATRIBUIDO", origem: 'Despesa' },
    { codigo: '34104034', nome: "DEPRECIACAO NAO DEDUTIVEL", origem: 'Despesa' },
    { codigo: '34202011', nome: "ENCARGOS COM DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34202020', nome: "PIS / COFINS SOBRE A DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34202024', nome: "ENCARGOS DE DEPRECIACAO -CUSTO ATRIBUIDO", origem: 'Despesa' },
  ],
  administrativo: [
    { codigo: '71101018', nome: "ALIMENTACAO", origem: 'Custo' },
    { codigo: '71102005', nome: "MATERIAL DE USO E CONSUMO", origem: 'Custo' },
    { codigo: '71102006', nome: "REFEICOES", origem: 'Custo' },
    { codigo: '71102021', nome: "CAIXA FUNDO FIXO", origem: 'Custo' },
    { codigo: '71102024', nome: "MATERIAL DE EXPEDIENTE", origem: 'Custo' },
    { codigo: '71102025', nome: "BENS DE PEQUENO VALOR", origem: 'Custo' },
    { codigo: '71102028', nome: "LIVROS JORNAIS E REVISTAS", origem: 'Custo' },
    { codigo: '71102029', nome: "CORREIOS E MALOTES", origem: 'Custo' },
    { codigo: '71102036', nome: "DESPESAS COM FESTAS E BRINDES", origem: 'Custo' },
    { codigo: '71102096', nome: "RATEIO - ENERGIA", origem: 'Custo' },
    { codigo: '71102097', nome: "RATEIO  - GAS", origem: 'Custo' },
    { codigo: '71102099', nome: "RATEIO DEMAIS PARTES", origem: 'Custo' },
    { codigo: '71102100', nome: "RATEIO PARA BENEFICIAMENTO", origem: 'Custo' },
    { codigo: '34101015', nome: "ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34104008', nome: "CORREIOS E MALOTES", origem: 'Despesa' },
    { codigo: '34104009', nome: "MATERIAL DE EXPEDIENTE", origem: 'Despesa' },
    { codigo: '34104011', nome: "LIVROS - JORNAIS E REVISTAS", origem: 'Despesa' },
    { codigo: '34104012', nome: "DESPESAS COM ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34104015', nome: "BENS DE PEQUENO VALOR", origem: 'Despesa' },
    { codigo: '34104016', nome: "DESPESAS COM FESTAS E BRINDES", origem: 'Despesa' },
    { codigo: '34104023', nome: "REFEICOES", origem: 'Despesa' },
    { codigo: '34104024', nome: "CAIXA FUNDO FIXO", origem: 'Despesa' },
    { codigo: '34104033', nome: "MATERIAL DE USO E CONSUMO", origem: 'Despesa' },
    { codigo: '34104036', nome: "PERDA DE RECEBIVEIS", origem: 'Despesa' },
    { codigo: '34104090', nome: "DIVERSOS", origem: 'Despesa' },
    { codigo: '34201016', nome: "ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34202005', nome: "CORREIOS E MALOTES", origem: 'Despesa' },
    { codigo: '34202006', nome: "MATERIAL DE EXPEDIENTE", origem: 'Despesa' },
    { codigo: '34202008', nome: "LIVROS, JORNAIS E REVISTAS", origem: 'Despesa' },
    { codigo: '34202009', nome: "DESPESA  ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34202012', nome: "BENS DE PEQUENO VALOR", origem: 'Despesa' },
    { codigo: '34202013', nome: "DESPESAS COM FESTAS E BRINDES", origem: 'Despesa' },
    { codigo: '34202021', nome: "REFEICOES", origem: 'Despesa' },
    { codigo: '34202022', nome: "CAIXA FUNDO FIXO", origem: 'Despesa' },
    { codigo: '34202031', nome: "MATERIAL DE USO E CONSUMO", origem: 'Despesa' },
    { codigo: '34202034', nome: "DESPESAS ADMINISTRATIVAS RATEADAS", origem: 'Despesa' },
    { codigo: '34202035', nome: "DOACOES", origem: 'Despesa' },
    { codigo: '34202037', nome: "OUTRAS DESPESAS NAO DEDUTIVEIS", origem: 'Despesa' },
    { codigo: '34202038', nome: "OUTRAS DESPESAS OPERACIONAIS", origem: 'Despesa' },
    { codigo: '34202042', nome: "PERDAS COM FORNECEDOR", origem: 'Despesa' },
    { codigo: '71102035', nome: "DESPESAS COM SEGUROS", origem: 'Custo' },
    { codigo: '34104030', nome: "DESPESAS COM SEGUROS", origem: 'Despesa' },
    { codigo: '34202028', nome: "DESPESAS COM SEGUROS", origem: 'Despesa' },
  ],
  impostos: [
    { codigo: '71102007', nome: "IMPOSTOS E TAXAS DIVERSAS", origem: 'Custo' },
    { codigo: '34104017', nome: "IMPOSTOS E TAXAS", origem: 'Despesa' },
    { codigo: '34104018', nome: "CONTRIBUICAO SINDICAL", origem: 'Despesa' },
    { codigo: '34202014', nome: "IMPOSTOS E TAXAS", origem: 'Despesa' },
    { codigo: '34202016', nome: "CONTRIBUICAO SINDICAL", origem: 'Despesa' },
  ],
};


// Agricola_Contas_x_Pacote: 153 contas classificadas (OK), 48 fora do escopo (CAPEX/obra, conta sintética, despesa financeira, ou sem pacote) — excluídas
const PACOTES_AGRICOLA = [
  { id: 'pessoal', nome: "Pessoal", ref: 'Matriz_Governanca_OBZ_2027_4 (62 contas)' },
  { id: 'administrativo_utilidades', nome: "Administrativo e Utilidades", ref: 'Matriz_Governanca_OBZ_2027_4 (29 contas)' },
  { id: 'servicos', nome: "Serviços de Terceiros", ref: 'Matriz_Governanca_OBZ_2027_4 (9 contas)' },
  { id: 'manutencao', nome: "Manutenção", ref: 'Matriz_Governanca_OBZ_2027_4 (9 contas)' },
  { id: 'impostos', nome: "Impostos Indiretos e Diretos", ref: 'Matriz_Governanca_OBZ_2027_4 (4 contas)' },
  { id: 'depreciacao', nome: "Depreciação e Amortização", ref: 'Matriz_Governanca_OBZ_2027_4 (3 contas)' },
  { id: 'fretes', nome: "Fretes e Logística", ref: 'Matriz_Governanca_OBZ_2027_4 (10 contas)' },
  { id: 'producao', nome: "Produção", ref: 'Matriz_Governanca_OBZ_2027_4 (15 contas)' },
  { id: 'comercial', nome: "Comercial e Marketing", ref: 'Matriz_Governanca_OBZ_2027_4 (4 contas)' },
  { id: 'viagens', nome: "Viagens", ref: 'Matriz_Governanca_OBZ_2027_4 (2 contas)' },
  { id: 'locacao', nome: "Locação e Ocupação", ref: 'Matriz_Governanca_OBZ_2027_4 (4 contas)' },
  { id: 'tecnologia', nome: "Tecnologia e Inovação", ref: 'Matriz_Governanca_OBZ_2027_4 (2 contas)' },
];

const PLANO_CONTAS_AGRICOLA = {
  pessoal: [
    { codigo: '71101001', nome: "SALARIOS", origem: 'Custo' },
    { codigo: '71101002', nome: "PREMIOS E GRATIFICACOES", origem: 'Custo' },
    { codigo: '71101003', nome: "HORAS EXTRAS", origem: 'Custo' },
    { codigo: '71101004', nome: "FERIAS E ABONO", origem: 'Custo' },
    { codigo: '71101005', nome: "13º SALARIO", origem: 'Custo' },
    { codigo: '71101006', nome: "INSS (GPS)", origem: 'Custo' },
    { codigo: '71101007', nome: "FGTS (GFIP)", origem: 'Custo' },
    { codigo: '71101008', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Custo' },
    { codigo: '71101009', nome: "VALE ELETRONICO (VEM)", origem: 'Custo' },
    { codigo: '71101010', nome: "CESTAS BASICAS", origem: 'Custo' },
    { codigo: '71101011', nome: "FARDAMENTOS", origem: 'Custo' },
    { codigo: '71101012', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Custo' },
    { codigo: '71101013', nome: "DESPESAS COM TREINAMENTO DE PESSOAL", origem: 'Custo' },
    { codigo: '71101014', nome: "PENSAO ALIMENTICIA", origem: 'Custo' },
    { codigo: '71101015', nome: "SEGURANCA DO TRABALHO", origem: 'Custo' },
    { codigo: '71101016', nome: "CURSOS E TREINAMENTOS", origem: 'Custo' },
    { codigo: '71101017', nome: "TRANSPORTE DE PESSOAL", origem: 'Custo' },
    { codigo: '71101018', nome: "ALIMENTACAO", origem: 'Custo' },
    { codigo: '71101019', nome: "OUTRAS DESPESAS COM PESSOAL", origem: 'Custo' },
    { codigo: '71101020', nome: "EMPRESTIMOS A FUNCIONARIOS", origem: 'Custo' },
    { codigo: '71101021', nome: "RETIRADAS", origem: 'Custo' },
    { codigo: '71101022', nome: "INSALUBRIDADE", origem: 'Custo' },
    { codigo: '71101098', nome: "RATEIO - MAO DE OBRA", origem: 'Custo' },
    { codigo: '71102006', nome: "REFEITORIO", origem: 'Custo' },
    { codigo: '71102018', nome: "MATERIAL DE EPI", origem: 'Custo' },
    { codigo: '71102044', nome: "PRODUTOS DE ENFERMARIA", origem: 'Custo' },
    { codigo: '34101001', nome: "SALARIOS", origem: 'Despesa' },
    { codigo: '34101002', nome: "PREMIOS E GRATIFICACOES", origem: 'Despesa' },
    { codigo: '34101003', nome: "13º SALARIO", origem: 'Despesa' },
    { codigo: '34101004', nome: "FERIAS", origem: 'Despesa' },
    { codigo: '34101005', nome: "INSS (GPS)", origem: 'Despesa' },
    { codigo: '34101006', nome: "FGTS (GFIP)", origem: 'Despesa' },
    { codigo: '34101007', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Despesa' },
    { codigo: '34101008', nome: "VALE ELETRONICO (VEM)", origem: 'Despesa' },
    { codigo: '34101009', nome: "CESTAS BASICAS", origem: 'Despesa' },
    { codigo: '34101010', nome: "FARDAMENTOS", origem: 'Despesa' },
    { codigo: '34101011', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Despesa' },
    { codigo: '34101012', nome: "TREINAMENTO DE PESSOAL", origem: 'Despesa' },
    { codigo: '34101014', nome: "HORAS EXTRAS", origem: 'Despesa' },
    { codigo: '34101015', nome: "ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34201001', nome: "SALARIOS", origem: 'Despesa' },
    { codigo: '34201002', nome: "PREMIOS E GRATIFICACOES", origem: 'Despesa' },
    { codigo: '34201003', nome: "13º SALARIO", origem: 'Despesa' },
    { codigo: '34201004', nome: "FERIAS", origem: 'Despesa' },
    { codigo: '34201005', nome: "INSS (GPS)", origem: 'Despesa' },
    { codigo: '34201006', nome: "FGTS (GFIP)", origem: 'Despesa' },
    { codigo: '34201007', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Despesa' },
    { codigo: '34201008', nome: "VALE ELETRONICO (VEM)", origem: 'Despesa' },
    { codigo: '34201009', nome: "CESTAS BASICAS", origem: 'Despesa' },
    { codigo: '34201010', nome: "FARDAMENTOS - EPI", origem: 'Despesa' },
    { codigo: '34201011', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Despesa' },
    { codigo: '34201012', nome: "DESPESA COM TREINAMENTO DE PESSOAL", origem: 'Despesa' },
    { codigo: '34201013', nome: "PENSAO ALIMENTICIA", origem: 'Despesa' },
    { codigo: '34201014', nome: "HORAS EXTRAS", origem: 'Despesa' },
    { codigo: '34201015', nome: "ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34201019', nome: "OUTRAS DESP COM FUNCIONARIOS", origem: 'Despesa' },
    { codigo: '34201022', nome: "INSALUBRIDADE", origem: 'Despesa' },
    { codigo: '34202009', nome: "DESPESA  ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34202013', nome: "DESPESAS COM FESTAS E COMEMORACOES", origem: 'Despesa' },
    { codigo: '34202021', nome: "REFEICOES", origem: 'Despesa' },
    { codigo: '34203001', nome: "PROLABORE", origem: 'Despesa' },
    { codigo: '34203002', nome: "INSS - PROLABORE", origem: 'Despesa' },
  ],
  administrativo_utilidades: [
    { codigo: '71102001', nome: "ENERGIA", origem: 'Custo' },
    { codigo: '71102002', nome: "TELEFONE - INTERNET", origem: 'Custo' },
    { codigo: '71102005', nome: "MATERIAL DE USO E CONSUMO", origem: 'Custo' },
    { codigo: '71102021', nome: "CAIXA FUNDO FIXO", origem: 'Custo' },
    { codigo: '71102024', nome: "MATERIAL DE EXPEDIENTE", origem: 'Custo' },
    { codigo: '71102035', nome: "DESPESAS COM SEGUROS", origem: 'Custo' },
    { codigo: '71102043', nome: "AGUA", origem: 'Custo' },
    { codigo: '71102045', nome: "MATERIAL ELETRICO", origem: 'Custo' },
    { codigo: '71102047', nome: "MATERIAL DIVERSOS", origem: 'Custo' },
    { codigo: '71102090', nome: "DIVERSOS", origem: 'Custo' },
    { codigo: '71102098', nome: "RATEIO - DESPESAS GERAIS", origem: 'Custo' },
    { codigo: '71102102', nome: "COPIAS E PLOTAGENS", origem: 'Custo' },
    { codigo: '71102104', nome: "SEGURO DE OBRAS", origem: 'Custo' },
    { codigo: '71104009', nome: "MATERIAL ELETRICO", origem: 'Custo' },
    { codigo: '34104009', nome: "MATERIAL DE EXPEDIENTE", origem: 'Despesa' },
    { codigo: '34104033', nome: "MATERIAIS DIVERSOS", origem: 'Despesa' },
    { codigo: '34202001', nome: "ENERGIA", origem: 'Despesa' },
    { codigo: '34202002', nome: "AGUA E ESGOTO", origem: 'Despesa' },
    { codigo: '34202003', nome: "TELEFONE - INTERNET", origem: 'Despesa' },
    { codigo: '34202005', nome: "CORREIOS E MALOTES", origem: 'Despesa' },
    { codigo: '34202006', nome: "MATERIAL DE EXPEDIENTE", origem: 'Despesa' },
    { codigo: '34202008', nome: "LIVROS, JORNAIS E REVISTAS", origem: 'Despesa' },
    { codigo: '34202012', nome: "BENS DE PEQUENO VALOR", origem: 'Despesa' },
    { codigo: '34202022', nome: "CAIXA FUNDO FIXO", origem: 'Despesa' },
    { codigo: '34202028', nome: "DESPESAS COM SEGUROS", origem: 'Despesa' },
    { codigo: '34202034', nome: "DESPESAS ADMINISTRATIVAS RATEADAS", origem: 'Despesa' },
    { codigo: '34202037', nome: "CERTIFICACOES", origem: 'Despesa' },
    { codigo: '34202090', nome: "DIVERSOS", origem: 'Despesa' },
    { codigo: '34202091', nome: "DESPESA COM CARTAO DE CREDITO", origem: 'Despesa' },
  ],
  servicos: [
    { codigo: '71102003', nome: "SERVICOS DE TERCEIROS", origem: 'Custo' },
    { codigo: '71102016', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Custo' },
    { codigo: '71102017', nome: "SERVICO PRESTADO PESSOA FISICA", origem: 'Custo' },
    { codigo: '71102031', nome: "SEGURANCA E VIGILANCIA", origem: 'Custo' },
    { codigo: '34104013', nome: "SERVICOS PRESTADOS PESSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34104019', nome: "SERVICO PRESTADO PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202010', nome: "SERVICOS DE TERCEIROS - PESSSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34202017', nome: "SERVICOS DE TERCEIRO PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202023', nome: "SEGURANCA E VIGILANCIA", origem: 'Despesa' },
  ],
  manutencao: [
    { codigo: '71102004', nome: "MANUTENCAO, CONSERVACAO E LIMPEZA", origem: 'Custo' },
    { codigo: '71102033', nome: "MATERIAL DE MANUT - VEICULOS-MOTOS", origem: 'Custo' },
    { codigo: '71102046', nome: "MATERIAL DE OFICINA", origem: 'Custo' },
    { codigo: '71102103', nome: "MANUTENCAO DE EQUIPAMENTOS MECANICOS", origem: 'Custo' },
    { codigo: '34104002', nome: "MANUTENCAO DE VEICULOS", origem: 'Despesa' },
    { codigo: '34104010', nome: "MATERIAL DE MANUTENCAO", origem: 'Despesa' },
    { codigo: '34202004', nome: "MANUTENCAO DE VEICULOS", origem: 'Despesa' },
    { codigo: '34202007', nome: "MANUTENCAO, CONSERVACAO E LIMPEZA", origem: 'Despesa' },
    { codigo: '34202026', nome: "MANUTENCAO DE MAQ E EQUIPAMENTOS", origem: 'Despesa' },
  ],
  impostos: [
    { codigo: '71102007', nome: "IPVA - IMPOSTOS E TAXAS", origem: 'Custo' },
    { codigo: '34202014', nome: "IPVA - IMPOSTOS E TAXAS", origem: 'Despesa' },
    { codigo: '34202016', nome: "CONTRIBUICAO SINDICAL", origem: 'Despesa' },
    { codigo: '34202036', nome: "ROYALTIES", origem: 'Despesa' },
  ],
  depreciacao: [
    { codigo: '71102008', nome: "ENCARGOS COM DEPRECIACAO", origem: 'Custo' },
    { codigo: '34202011', nome: "ENCARGOS COM DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34202020', nome: "PIS - COFINS SOBRE A DEPRECIACAO", origem: 'Despesa' },
  ],
  fretes: [
    { codigo: '71102009', nome: "FRETES E CARRETOS", origem: 'Custo' },
    { codigo: '71102012', nome: "COMBUSTIVEIS E LUBRIFICANTES", origem: 'Custo' },
    { codigo: '71102038', nome: "LOGISTICA EXPORTACAO", origem: 'Custo' },
    { codigo: '71102039', nome: "LOGISTICA IMPORTACAO", origem: 'Custo' },
    { codigo: '34104001', nome: "FRETES E CARRETOS", origem: 'Despesa' },
    { codigo: '34104003', nome: "SERVICOS ADUANEIROS", origem: 'Despesa' },
    { codigo: '34104004', nome: "DESPACHANTE", origem: 'Despesa' },
    { codigo: '34104031', nome: "COMBUSTIVEIS E LUBRIFICANTES", origem: 'Despesa' },
    { codigo: '34202015', nome: "FRETES E CARRETOS", origem: 'Despesa' },
    { codigo: '34202029', nome: "DESPESAS COM COMBUSTIVEL", origem: 'Despesa' },
  ],
  producao: [
    { codigo: '71102010', nome: "MATERIA PRIMA", origem: 'Custo' },
    { codigo: '71102011', nome: "METERIA ORGANICA", origem: 'Custo' },
    { codigo: '71102013', nome: "MATERIAL DE EMBALAGEM", origem: 'Custo' },
    { codigo: '71102014', nome: "FERTILIZANTES", origem: 'Custo' },
    { codigo: '71102015', nome: "DEFENSIVOS", origem: 'Custo' },
    { codigo: '71102019', nome: "FERRAMENTAS DE PRODUCAO", origem: 'Custo' },
    { codigo: '71102022', nome: "MATERIAL DE CONSTRUCAO", origem: 'Custo' },
    { codigo: '71102037', nome: "ANALISES LABORATORIAIS", origem: 'Custo' },
    { codigo: '71102040', nome: "MONITORAMENTO DE PRAGAS", origem: 'Custo' },
    { codigo: '71102042', nome: "DESPESAS COM AQUISICOES DE UVA", origem: 'Custo' },
    { codigo: '71102048', nome: "MATERIAL PARA MANUT DE PARREIRA", origem: 'Custo' },
    { codigo: '71102095', nome: "RATEIO - PACKING HOUSE", origem: 'Custo' },
    { codigo: '71102096', nome: "RATEIO - INDIRETO FAZENDA", origem: 'Custo' },
    { codigo: '71102097', nome: "RATEIO DA PRODUCAO", origem: 'Custo' },
    { codigo: '34202030', nome: "MATERIAL DE CONSTRUCAO", origem: 'Despesa' },
  ],
  comercial: [
    { codigo: '71102020', nome: "STAND DE VENDAS", origem: 'Custo' },
    { codigo: '34102001', nome: "COMISSOES", origem: 'Despesa' },
    { codigo: '34103001', nome: "DESPESAS COM MARKETING", origem: 'Despesa' },
    { codigo: '34202035', nome: "BRINDES E DONATIVOS", origem: 'Despesa' },
  ],
  viagens: [
    { codigo: '71102026', nome: "DESPESAS COM VIAGENS", origem: 'Custo' },
    { codigo: '34202018', nome: "DESPESAS COM VIAGENS", origem: 'Despesa' },
  ],
  locacao: [
    { codigo: '71102032', nome: "LOCACAO DE MAQUINAS E EQUIPAMENTOS", origem: 'Custo' },
    { codigo: '34202019', nome: "ALUGUEL A PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202025', nome: "LOCACAO DE MAQ E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34202033', nome: "CONDOMINIOS DE IMOVEIS PROPRIOS", origem: 'Despesa' },
  ],
  tecnologia: [
    { codigo: '34202027', nome: "CONSULTORIAS DE SISTEMAS", origem: 'Despesa' },
    { codigo: '34202031', nome: "MATERIAL DE TI E COMUNICACAO", origem: 'Despesa' },
  ],
};

// Resorts_Contas_x_Pacote: 260 contas classificadas (OK), 16 fora do escopo (CAPEX/obra, conta sintética, despesa financeira, ou sem pacote) — excluídas
const PACOTES_RESORTS = [
  { id: 'producao', nome: "Produção", ref: 'Matriz_Governanca_OBZ_2027_4 (6 contas)' },
  { id: 'pessoal', nome: "Pessoal", ref: 'Matriz_Governanca_OBZ_2027_4 (83 contas)' },
  { id: 'administrativo_utilidades', nome: "Administrativo e Utilidades", ref: 'Matriz_Governanca_OBZ_2027_4 (54 contas)' },
  { id: 'tecnologia', nome: "Tecnologia e Inovação", ref: 'Matriz_Governanca_OBZ_2027_4 (2 contas)' },
  { id: 'comercial', nome: "Comercial e Marketing", ref: 'Matriz_Governanca_OBZ_2027_4 (9 contas)' },
  { id: 'manutencao', nome: "Manutenção", ref: 'Matriz_Governanca_OBZ_2027_4 (25 contas)' },
  { id: 'fretes', nome: "Fretes e Logística", ref: 'Matriz_Governanca_OBZ_2027_4 (16 contas)' },
  { id: 'servicos', nome: "Serviços de Terceiros", ref: 'Matriz_Governanca_OBZ_2027_4 (22 contas)' },
  { id: 'locacao', nome: "Locação e Ocupação", ref: 'Matriz_Governanca_OBZ_2027_4 (14 contas)' },
  { id: 'impostos', nome: "Impostos Indiretos e Diretos", ref: 'Matriz_Governanca_OBZ_2027_4 (12 contas)' },
  { id: 'viagens', nome: "Viagens", ref: 'Matriz_Governanca_OBZ_2027_4 (6 contas)' },
  { id: 'depreciacao', nome: "Depreciação e Amortização", ref: 'Matriz_Governanca_OBZ_2027_4 (11 contas)' },
];

const PLANO_CONTAS_RESORTS = {
  producao: [
    { codigo: '410101010', nome: "ALIMENTOS", origem: 'Custo' },
    { codigo: '410101020', nome: "BEBIDAS", origem: 'Custo' },
    { codigo: '71102010', nome: "MATERIA PRIMA FIO", origem: 'Custo' },
    { codigo: '71102011', nome: "MATERIA PRIMA PRODUTOS QUIMICOS", origem: 'Custo' },
    { codigo: '71102099', nome: "RATEIO PARA MALHARIA", origem: 'Custo' },
    { codigo: '71102100', nome: "RATEIO PARA BENEFICIAMENTO", origem: 'Custo' },
  ],
  pessoal: [
    { codigo: '410201010', nome: "SALARIOS", origem: 'Custo' },
    { codigo: '410201020', nome: "PRO-LABORE", origem: 'Custo' },
    { codigo: '410201030', nome: "HORAS EXTRAS", origem: 'Custo' },
    { codigo: '410201035', nome: "INSS (GPS)", origem: 'Custo' },
    { codigo: '410201040', nome: "INDENIZACOES TRABALHISTAS", origem: 'Custo' },
    { codigo: '410201045', nome: "FGTS (SEFIP)", origem: 'Custo' },
    { codigo: '410201050', nome: "FERIAS", origem: 'Custo' },
    { codigo: '410201060', nome: "13º SALARIO", origem: 'Custo' },
    { codigo: '410201070', nome: "PENSAO ALIMENTICIA", origem: 'Custo' },
    { codigo: '410201080', nome: "QUINQUENIO", origem: 'Custo' },
    { codigo: '410201090', nome: "ACORDOS TRABALHISTAS", origem: 'Custo' },
    { codigo: '410201100', nome: "RECISOES", origem: 'Custo' },
    { codigo: '410201110', nome: "GRATIFICACOES", origem: 'Custo' },
    { codigo: '410201120', nome: "EXAMES MEDICOS", origem: 'Custo' },
    { codigo: '410201130', nome: "BOLSA-ESTAGIO", origem: 'Custo' },
    { codigo: '410201140', nome: "TRANSPORTE DE PESSOAL", origem: 'Custo' },
    { codigo: '410202010', nome: "CONVENIO MEDICO", origem: 'Custo' },
    { codigo: '410202020', nome: "CONVENIO ODONTOLOGICO", origem: 'Custo' },
    { codigo: '410202030', nome: "CESTA BASICA", origem: 'Custo' },
    { codigo: '410203010', nome: "CLIMA ORGANIZACIONAL (RH)", origem: 'Custo' },
    { codigo: '410301110', nome: "EPI", origem: 'Custo' },
    { codigo: '410307080', nome: "LANCHES E REFEICOES", origem: 'Custo' },
    { codigo: '410307090', nome: "MEDICAMENTOS", origem: 'Custo' },
    { codigo: '410307190', nome: "CURSOS/SEMINARIOS", origem: 'Custo' },
    { codigo: '410307250', nome: "UNIFORMES", origem: 'Custo' },
    { codigo: '71101001', nome: "SALARIOS E ORDENADOS", origem: 'Custo' },
    { codigo: '71101002', nome: "PREMIOS E GRATIFICACOES", origem: 'Custo' },
    { codigo: '71101003', nome: "HORAS EXTRAS", origem: 'Custo' },
    { codigo: '71101004', nome: "FERIAS E ABONO", origem: 'Custo' },
    { codigo: '71101005', nome: "13º SALARIO", origem: 'Custo' },
    { codigo: '71101006', nome: "INSS (GPS)", origem: 'Custo' },
    { codigo: '71101007', nome: "FGTS (GFIP)", origem: 'Custo' },
    { codigo: '71101008', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Custo' },
    { codigo: '71101009', nome: "VALE ELETRONICO (VEM)", origem: 'Custo' },
    { codigo: '71101010', nome: "CESTAS BASICAS", origem: 'Custo' },
    { codigo: '71101011', nome: "FARDAMENTOS", origem: 'Custo' },
    { codigo: '71101012', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Custo' },
    { codigo: '71101013', nome: "DESPESAS COM TREINAMENTO DE PESSOAL", origem: 'Custo' },
    { codigo: '71101014', nome: "PENSAO ALIMENTICIA", origem: 'Custo' },
    { codigo: '71101018', nome: "ALIMENTACAO", origem: 'Custo' },
    { codigo: '71102006', nome: "REFEICOES", origem: 'Custo' },
    { codigo: '71102036', nome: "DESPESAS COM FESTAS E BRINDES", origem: 'Custo' },
    { codigo: '34101001', nome: "ORDENADOS E SALARIOS", origem: 'Despesa' },
    { codigo: '34101002', nome: "PREMIOS E GRATIFICACOES", origem: 'Despesa' },
    { codigo: '34101003', nome: "13º SALARIO", origem: 'Despesa' },
    { codigo: '34101004', nome: "FERIAS", origem: 'Despesa' },
    { codigo: '34101005', nome: "INSS (GPS)", origem: 'Despesa' },
    { codigo: '34101006', nome: "FGTS (GFIP)", origem: 'Despesa' },
    { codigo: '34101007', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Despesa' },
    { codigo: '34101008', nome: "VALE ELETRONICO (VEM)", origem: 'Despesa' },
    { codigo: '34101009', nome: "CESTAS BASICAS", origem: 'Despesa' },
    { codigo: '34101010', nome: "FARDAMENTOS", origem: 'Despesa' },
    { codigo: '34101011', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Despesa' },
    { codigo: '34101012', nome: "DESPESAS COM TREINAMENTO DE PESSOAL", origem: 'Despesa' },
    { codigo: '34101014', nome: "HORAS EXTRAS", origem: 'Despesa' },
    { codigo: '34101015', nome: "ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34104012', nome: "DESPESAS COM ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34104016', nome: "DESPESAS COM FESTAS E BRINDES", origem: 'Despesa' },
    { codigo: '34104023', nome: "REFEICOES", origem: 'Despesa' },
    { codigo: '34201001', nome: "ORDENADOS E SALARIOS", origem: 'Despesa' },
    { codigo: '34201002', nome: "PREMIOS E GRATIFICACOES", origem: 'Despesa' },
    { codigo: '34201003', nome: "13º SALARIO", origem: 'Despesa' },
    { codigo: '34201004', nome: "FERIAS", origem: 'Despesa' },
    { codigo: '34201005', nome: "INSS (GPS)", origem: 'Despesa' },
    { codigo: '34201006', nome: "FGTS (GFIP)", origem: 'Despesa' },
    { codigo: '34201007', nome: "INDENIZACOES E AVISO PREVIO", origem: 'Despesa' },
    { codigo: '34201008', nome: "VALE ELETRONICO (VEM)", origem: 'Despesa' },
    { codigo: '34201009', nome: "CESTAS BASICAS", origem: 'Despesa' },
    { codigo: '34201010', nome: "FARDAMENTOS", origem: 'Despesa' },
    { codigo: '34201011', nome: "ASSISTENCIA MEDICA E SOCIAL", origem: 'Despesa' },
    { codigo: '34201012', nome: "DESPESA COM TREINAMENTO DE PESSOAL", origem: 'Despesa' },
    { codigo: '34201013', nome: "PENSAO ALIMENTICIA", origem: 'Despesa' },
    { codigo: '34201014', nome: "PRO-LABORE", origem: 'Despesa' },
    { codigo: '34201015', nome: "HORAS EXTRAS", origem: 'Despesa' },
    { codigo: '34201016', nome: "ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34201017', nome: "SEGURANCA DO TRABALHO", origem: 'Despesa' },
    { codigo: '34201019', nome: "OUTRAS DESPESAS COM FUNCIONARIOS", origem: 'Despesa' },
    { codigo: '34201022', nome: "INSALUBRIDADE", origem: 'Despesa' },
    { codigo: '34202009', nome: "DESPESA  ALIMENTACAO", origem: 'Despesa' },
    { codigo: '34202013', nome: "DESPESAS COM FESTAS E BRINDES", origem: 'Despesa' },
    { codigo: '34202021', nome: "REFEICOES", origem: 'Despesa' },
    { codigo: '34203001', nome: "PRO LABORE", origem: 'Despesa' },
    { codigo: '34203002', nome: "PRO LABORE", origem: 'Despesa' },
  ],
  administrativo_utilidades: [
    { codigo: '410301010', nome: "MATERIAL DE ESCRITORIO", origem: 'Custo' },
    { codigo: '410301030', nome: "MATERIAL DE LIMPEZA", origem: 'Custo' },
    { codigo: '410301050', nome: "MATERIAL DE LAVANDERIA", origem: 'Custo' },
    { codigo: '410301060', nome: "MATERIAL DE HOSPEDAGEM", origem: 'Custo' },
    { codigo: '410301080', nome: "ALMOXARIFADO", origem: 'Custo' },
    { codigo: '410301090', nome: "MATERIAL DESCARTAVEL", origem: 'Custo' },
    { codigo: '410301100', nome: "MATERIAL DE EXPERIENCIA", origem: 'Custo' },
    { codigo: '410301120', nome: "UTENSILIOS", origem: 'Custo' },
    { codigo: '410301220', nome: "ENXOVAIS", origem: 'Custo' },
    { codigo: '410303010', nome: "AGUA E ESGOTO", origem: 'Custo' },
    { codigo: '410303020', nome: "ENERGIA ELETRICA", origem: 'Custo' },
    { codigo: '410303030', nome: "GAS", origem: 'Custo' },
    { codigo: '410303040', nome: "TELEFONIA", origem: 'Custo' },
    { codigo: '410304060', nome: "SEGUROS DE VEICULOS", origem: 'Custo' },
    { codigo: '410307040', nome: "CORREIOS E MALOTES", origem: 'Custo' },
    { codigo: '410307110', nome: "INTERNET", origem: 'Custo' },
    { codigo: '410307210', nome: "SEGURO", origem: 'Custo' },
    { codigo: '410307270', nome: "CAIXA FUNDO FIXO", origem: 'Custo' },
    { codigo: '410307280', nome: "DIVERSOS", origem: 'Custo' },
    { codigo: '410307300', nome: "DESPESAS ADMINISTRATIVAS RATEADA", origem: 'Custo' },
    { codigo: '410307310', nome: "BENS DE PEQUENO VALOR", origem: 'Custo' },
    { codigo: '410307320', nome: "REEMBOLSO DIVERSOS", origem: 'Custo' },
    { codigo: '71102001', nome: "ENERGIA ELETRICA", origem: 'Custo' },
    { codigo: '71102002', nome: "TELEFONE", origem: 'Custo' },
    { codigo: '71102005', nome: "MATERIAL DE USO E CONSUMO", origem: 'Custo' },
    { codigo: '71102021', nome: "CAIXA FUNDO FIXO", origem: 'Custo' },
    { codigo: '71102024', nome: "MATERIAL DE EXPEDIENTE", origem: 'Custo' },
    { codigo: '71102025', nome: "BENS DE PEQUENO VALOR", origem: 'Custo' },
    { codigo: '71102028', nome: "LIVROS JORNAIS E REVISTAS", origem: 'Custo' },
    { codigo: '71102029', nome: "CORREIOS E MALOTES", origem: 'Custo' },
    { codigo: '71102035', nome: "DESPESAS COM SEGUROS", origem: 'Custo' },
    { codigo: '34104005', nome: "ENERGIA ELETRICA", origem: 'Despesa' },
    { codigo: '34104006', nome: "AGUA E ESGOTO", origem: 'Despesa' },
    { codigo: '34104007', nome: "TELEFONE E INTERNET", origem: 'Despesa' },
    { codigo: '34104008', nome: "CORREIOS E MALOTES", origem: 'Despesa' },
    { codigo: '34104009', nome: "MATERIAL DE EXPEDIENTE", origem: 'Despesa' },
    { codigo: '34104011', nome: "LIVROS - JORNAIS E REVISTAS", origem: 'Despesa' },
    { codigo: '34104015', nome: "BENS DE PEQUENO VALOR", origem: 'Despesa' },
    { codigo: '34104024', nome: "CAIXA FUNDO FIXO", origem: 'Despesa' },
    { codigo: '34104030', nome: "DESPESAS COM SEGUROS", origem: 'Despesa' },
    { codigo: '34104033', nome: "MATERIAL DE USO E CONSUMO", origem: 'Despesa' },
    { codigo: '34104090', nome: "DIVERSOS", origem: 'Despesa' },
    { codigo: '34202001', nome: "ENERGIA ELETRICA", origem: 'Despesa' },
    { codigo: '34202002', nome: "AGUA E ESGOTO", origem: 'Despesa' },
    { codigo: '34202003', nome: "TELEFONE E INTERNET", origem: 'Despesa' },
    { codigo: '34202005', nome: "CORREIOS E MALOTES", origem: 'Despesa' },
    { codigo: '34202006', nome: "MATERIAL DE EXPEDIENTE", origem: 'Despesa' },
    { codigo: '34202008', nome: "LIVROS, JORNAIS E REVISTAS", origem: 'Despesa' },
    { codigo: '34202012', nome: "BENS DE PEQUENO VALOR", origem: 'Despesa' },
    { codigo: '34202022', nome: "CAIXA FUNDO FIXO", origem: 'Despesa' },
    { codigo: '34202028', nome: "DESPESAS COM SEGUROS", origem: 'Despesa' },
    { codigo: '34202031', nome: "MATERIAL DE USO E CONSUMO", origem: 'Despesa' },
    { codigo: '34202034', nome: "DESPESAS ADMINISTRATIVAS RATEADAS", origem: 'Despesa' },
    { codigo: '34202090', nome: "DIVERSOS", origem: 'Despesa' },
  ],
  tecnologia: [
    { codigo: '410301020', nome: "MATERIAL DE INFORMATICA", origem: 'Custo' },
    { codigo: '410307130', nome: "MANUTENCAO DE SOFTWARE", origem: 'Custo' },
  ],
  comercial: [
    { codigo: '410301040', nome: "MATERIAL DE PROMOCAO E PUBLICIDADE", origem: 'Custo' },
    { codigo: '410305050', nome: "PROPAGANDA E PUBLICIDADE", origem: 'Custo' },
    { codigo: '410306010', nome: "COMISSAO DE CARTAO DE CREDITO", origem: 'Custo' },
    { codigo: '410306020', nome: "COMISSAO DE AGENTES", origem: 'Custo' },
    { codigo: '410307140', nome: "BRINDES E PROMOCOES", origem: 'Custo' },
    { codigo: '410307150', nome: "DECORACAO", origem: 'Custo' },
    { codigo: '34102001', nome: "COMISSOES", origem: 'Despesa' },
    { codigo: '34103001', nome: "PROPAGANDA E PUBLICIDADE", origem: 'Despesa' },
    { codigo: '34202035', nome: "DOACOES", origem: 'Despesa' },
  ],
  manutencao: [
    { codigo: '410301070', nome: "MATERIAL DE MANUT./CONSERV.", origem: 'Custo' },
    { codigo: '410301130', nome: "MATERIAL MANUTENCAO ELETRICA", origem: 'Custo' },
    { codigo: '410301140', nome: "MATERIAL MANUTENCAO HIDRAULICA", origem: 'Custo' },
    { codigo: '410301150', nome: "MANUTENCAO LAMPADAS E REFRIGERACAO", origem: 'Custo' },
    { codigo: '410301160', nome: "MANUTENCAO CAMARAS E REFRIGERACAO", origem: 'Custo' },
    { codigo: '410301170', nome: "MANUTENCAO PISCINA", origem: 'Custo' },
    { codigo: '410301180', nome: "MANUTENCAO JARDIM", origem: 'Custo' },
    { codigo: '410301190', nome: "MANUTENCAO LAVANDERIA", origem: 'Custo' },
    { codigo: '410301200', nome: "MANUTENCAO EQUIPAMENTOS", origem: 'Custo' },
    { codigo: '410301210', nome: "MANUTENCAO PINTURA", origem: 'Custo' },
    { codigo: '410304010', nome: "MANUTENCAO DE VEICULOS", origem: 'Custo' },
    { codigo: '410307160', nome: "DEDETIZACAO", origem: 'Custo' },
    { codigo: '410307200', nome: "JARDINAGEM", origem: 'Custo' },
    { codigo: '410307230', nome: "ASSIST. TECNICA/REPAROS", origem: 'Custo' },
    { codigo: '71102004', nome: "MANUTENCAO, CONSERVACAO E LIMPEZA", origem: 'Custo' },
    { codigo: '71102022', nome: "MANUTENCAO PREDIAL", origem: 'Custo' },
    { codigo: '71102033', nome: "MANUTENCAO DE MAQ E EQUIPAMENTOS", origem: 'Custo' },
    { codigo: '34104002', nome: "MANUTENCAO DE VEICULOS", origem: 'Despesa' },
    { codigo: '34104010', nome: "MANUTENCAO - CONSERVACAO E LIMPEZA", origem: 'Despesa' },
    { codigo: '34104028', nome: "MANUTENCAO DE MAQUINAS E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34104032', nome: "MANUTENCAO PREDIAL", origem: 'Despesa' },
    { codigo: '34202004', nome: "MANUTENCAO DE VEICULOS", origem: 'Despesa' },
    { codigo: '34202007', nome: "CONSERVACAO E LIMPEZA", origem: 'Despesa' },
    { codigo: '34202026', nome: "MANUTENCAO DE MAQ E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34202030', nome: "MANUTENCAO PREDIAL", origem: 'Despesa' },
  ],
  fretes: [
    { codigo: '410301230', nome: "COMBUSTIVEIS E LUBRIFICANTES", origem: 'Custo' },
    { codigo: '410304020', nome: "DESPESAS COM COMBUSTIVEL", origem: 'Custo' },
    { codigo: '410304040', nome: "MULTAS DE TRANSITO", origem: 'Custo' },
    { codigo: '410304050', nome: "ESTACIONAMENTO E PEDAGIO", origem: 'Custo' },
    { codigo: '410307060', nome: "FRETES E CARRETOS", origem: 'Custo' },
    { codigo: '410307070', nome: "TRANSPORTE LOCAL", origem: 'Custo' },
    { codigo: '71102009', nome: "FRETES E CARRETOS", origem: 'Custo' },
    { codigo: '71102030', nome: "DESPACHANTE", origem: 'Custo' },
    { codigo: '71102034', nome: "DESPESAS COM COMBUSTIVEL", origem: 'Custo' },
    { codigo: '34104001', nome: "FRETES E CARRETOS", origem: 'Despesa' },
    { codigo: '34104003', nome: "SERVICOS ADUANEIROS", origem: 'Despesa' },
    { codigo: '34104004', nome: "DESPACHANTE", origem: 'Despesa' },
    { codigo: '34104031', nome: "DESPESAS COM COMBUSTIVEIS", origem: 'Despesa' },
    { codigo: '34202015', nome: "FRETES E CARRETOS", origem: 'Despesa' },
    { codigo: '34202029', nome: "DESPESAS COM COMBUSTIVEL", origem: 'Despesa' },
    { codigo: '34202032', nome: "DESPACHANTE", origem: 'Despesa' },
  ],
  servicos: [
    { codigo: '410302010', nome: "SERVICOS PRESTADOS PJ", origem: 'Custo' },
    { codigo: '410302020', nome: "SERVICOS PRESTADOS PF", origem: 'Custo' },
    { codigo: '410302030', nome: "SERVICO CONSULTORIA E ASSESSORIA", origem: 'Custo' },
    { codigo: '410305030', nome: "REPRESENTANTE COMERCIAL", origem: 'Custo' },
    { codigo: '410307010', nome: "ASSINATURAS", origem: 'Custo' },
    { codigo: '410307020', nome: "ANUNCIOS E EDITAIS", origem: 'Custo' },
    { codigo: '410307030', nome: "XEROX E ENCADERNACOES", origem: 'Custo' },
    { codigo: '410307050', nome: "CARTORIOS", origem: 'Custo' },
    { codigo: '410307120', nome: "SEGURANCA", origem: 'Custo' },
    { codigo: '410307240', nome: "ENTRETENIMENTO/LAZER", origem: 'Custo' },
    { codigo: '71102003', nome: "SERVICOS DE TERCEIROS - PJ", origem: 'Custo' },
    { codigo: '71102016', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Custo' },
    { codigo: '71102017', nome: "SERVICOS DE TERCEIROS - PESSOA FISICA", origem: 'Custo' },
    { codigo: '71102031', nome: "SEGURANCA E VIGILANCIA", origem: 'Custo' },
    { codigo: '34104013', nome: "SERVICOS DE TERCEIROS PESSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34104019', nome: "SERVICO DE TERCEIRO PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34104025', nome: "SEGURANCA - VIGILANCIA", origem: 'Despesa' },
    { codigo: '34104029', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Despesa' },
    { codigo: '34202010', nome: "SERVICOS DE TERCEIROS - PJ", origem: 'Despesa' },
    { codigo: '34202017', nome: "SERVICOS DE TERCEIROS - PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202023', nome: "SEGURANCA E VIGILANCIA", origem: 'Despesa' },
    { codigo: '34202027', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Despesa' },
  ],
  locacao: [
    { codigo: '410303050', nome: "TAXA DE CONDOMINIO", origem: 'Custo' },
    { codigo: '410304070', nome: "LEASING DE VEICULOS", origem: 'Custo' },
    { codigo: '410304080', nome: "ALUGUEL DE VEICULOS", origem: 'Custo' },
    { codigo: '410307100', nome: "LOCACOES", origem: 'Custo' },
    { codigo: '410307220', nome: "LEASING", origem: 'Custo' },
    { codigo: '410307350', nome: "DESP.COM CONDOMINIO", origem: 'Custo' },
    { codigo: '71102027', nome: "ALUGUEL", origem: 'Custo' },
    { codigo: '71102032', nome: "LOCACAO DE MAQUINAS E EQUIPAMENTOS", origem: 'Custo' },
    { codigo: '34104021', nome: "ALUGUEL A PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34104027', nome: "LOCACAO DE MAQUINAS E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34104035', nome: "LOCACAO DE PESSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34202019', nome: "ALUGUEL A PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202025', nome: "LOCACAO DE MAQ E EQUIPAMENTOS", origem: 'Despesa' },
    { codigo: '34202033', nome: "CONDOMINIOS DE IMOVEIS PROPRIOS", origem: 'Despesa' },
  ],
  impostos: [
    { codigo: '410304030', nome: "IPVA E LICENCIAMENTO", origem: 'Custo' },
    { codigo: '410307170', nome: "ASSOCIACAO DE CLASSE", origem: 'Custo' },
    { codigo: '410307180', nome: "CONTRIBUICAO INSTITUCIONAL", origem: 'Custo' },
    { codigo: '410307260', nome: "IMPOSTOS E TAXAS", origem: 'Custo' },
    { codigo: '410307330', nome: "IPTU", origem: 'Custo' },
    { codigo: '71102007', nome: "IMPOSTOS E TAXAS DIVERSAS", origem: 'Custo' },
    { codigo: '34104017', nome: "IMPOSTOS E TAXAS", origem: 'Despesa' },
    { codigo: '34104018', nome: "CONTRIBUICAO SINDICAL", origem: 'Despesa' },
    { codigo: '34202014', nome: "IMPOSTOS E TAXAS", origem: 'Despesa' },
    { codigo: '34202016', nome: "CONTRIBUICAO SINDICAL", origem: 'Despesa' },
    { codigo: '34202036', nome: "ROYALTIES", origem: 'Despesa' },
    { codigo: '34203006', nome: "IMPOSTOS E TAXAS", origem: 'Despesa' },
  ],
  viagens: [
    { codigo: '410305010', nome: "HOSPEDAGEM EM VIAGEM", origem: 'Custo' },
    { codigo: '410305020', nome: "DESPESA COM PASSAGEM", origem: 'Custo' },
    { codigo: '410305040', nome: "DESPESAS C/OVEBCOK", origem: 'Custo' },
    { codigo: '71102026', nome: "DESPESAS COM VIAGENS", origem: 'Custo' },
    { codigo: '34104020', nome: "DESPESAS COM VIAGENS", origem: 'Despesa' },
    { codigo: '34202018', nome: "DESPESAS COM VIAGENS", origem: 'Despesa' },
  ],
  depreciacao: [
    { codigo: '410307290', nome: "ENCARGOS COM DEPRECIACAO", origem: 'Custo' },
    { codigo: '71102008', nome: "ENCARGOS COM DEPRECIACAO", origem: 'Custo' },
    { codigo: '71102015', nome: "ENCARGOS DE DEPRECIACAO -CUSTO ATRIBUIDO", origem: 'Custo' },
    { codigo: '71102023', nome: "PIS-COFINS SOBRE DEPRECIACAO", origem: 'Custo' },
    { codigo: '34104014', nome: "ENCARGOS DE DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34104022', nome: "PIS - COFINS SOBRE DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34104026', nome: "DEPRECIACAO - CUSTO ATRIBUIDO", origem: 'Despesa' },
    { codigo: '34104034', nome: "DEPRECIACAO NAO DEDUTIVEL", origem: 'Despesa' },
    { codigo: '34202011', nome: "ENCARGOS COM DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34202020', nome: "PIS / COFINS SOBRE A DEPRECIACAO", origem: 'Despesa' },
    { codigo: '34202024', nome: "ENCARGOS DE DEPRECIACAO -CUSTO ATRIBUIDO", origem: 'Despesa' },
  ],
};


// Fonte oficial: Base_Corporativo.xlsx. A coluna de Centros de Custo é confiável (20 CCs).
// A coluna de Contas Analíticas NÃO vem pareada por CC no arquivo-fonte (mesmo código de conta
// repetido em todas as linhas, enquanto os nomes de despesa mudam) — tratada aqui como uma lista
// de referência geral de despesas do Corporativo, não uma classificação C.C. × Conta. Pendência
// sinalizada na tela; segue sujeita à correção do FP&A quando o De/Para oficial existir.
// tipo: 'despesa' em todos — Corporativo é 100% back-office, sem CC de
// produção (não existe CPV aqui, só Despesas Operacionais), decisão de
// 2026-08-16 ao habilitar o lançamento completo desta unidade.
export const CCS_CORPORATIVO = [
  { codigo: "0000102", nome: "Financeiro", tipo: 'despesa' },
  { codigo: "02", nome: "GSC (Arthur)", tipo: 'despesa' },
  { codigo: "0000104", nome: "Riscos, Auditoria e Compliance", tipo: 'despesa' },
  { codigo: "0000199", nome: "Conselho", tipo: 'despesa' },
  { codigo: "0010103", nome: "Contabilidade/Fiscal", tipo: 'despesa' },
  { codigo: "0010104", nome: "Departamento Pessoal", tipo: 'despesa' },
  { codigo: "0010105", nome: "TI GSP (SISTEMAS)", tipo: 'despesa' },
  { codigo: "0010107", nome: "COMPRAS", tipo: 'despesa' },
  { codigo: "0010109", nome: "NOVOS NEGÓCIOS", tipo: 'despesa' },
  { codigo: "0010110", nome: "AUDITORIA INTERNA", tipo: 'despesa' },
  { codigo: "0010111", nome: "Gestão de Pessoas", tipo: 'despesa' },
  { codigo: "0010112", nome: "Estratégia e Projetos", tipo: 'despesa' },
  { codigo: "0010114", nome: "Jurídico", tipo: 'despesa' },
  { codigo: "0010115", nome: "Escritório", tipo: 'despesa' },
  { codigo: "0010116", nome: "Controladoria", tipo: 'despesa' },
  { codigo: "0010117", nome: "TI GSI INFRA", tipo: 'despesa' },
  { codigo: "0010118", nome: "FP&A", tipo: 'despesa' },
  { codigo: "0010119", nome: "SECRETARIA DE GOVERNANÇA", tipo: 'despesa' },
  { codigo: "0010120", nome: "INOVAÇÃO E TECNOLOGIA", tipo: 'despesa' },
  { codigo: "0020102", nome: "MARKETING", tipo: 'despesa' },
];

const CONTAS_REFERENCIA_CORPORATIVO = [
  "Salários /Despesas com o pessoal",
  "Assessorias e Consultorias",
  "Consultórias PJs",
  "Projetos",
  "Aluguel e Condomínio",
  "Material de expediente",
  "Reformas e Manutenção",
  "Honorários Advocatícios",
  "Telefonia e Internet",
  "Locação de Software",
  "Material de Informática",
  "Propaganda e Publicidade",
  "Cursos e treinamentos",
  "Combustível/Alimentação/Transporte",
  "Eventos e Confraternizações",
  "Caixa Fundo fixo",
  "Despesas Diversas",
  "Passagem e Hospedagem",
  "Material de Copa/Cozinha e limpeza",
  "Locação de equipamentos",
  "Impostos e taxas",
];

// Plano de contas do Corporativo para lançamento de orçamento — decisão de
// 2026-08-16: "cada CC precisa conter todas as contas analíticas [...]
// mesma visão e layout da Têxtil, interpretando e separando a conta
// analítica por pacote". Como a planilha-fonte (Base_Corporativo.xlsx) não
// pareia conta × CC (mesmo código de conta repetido em toda linha — ver
// nota acima de CCS_CORPORATIVO), a solução aqui é literal ao pedido: as 21
// contas de CONTAS_REFERENCIA_CORPORATIVO (as únicas 21 reais, nenhuma
// inventada) valem para todos os 20 CCs igualmente, agrupadas por pacote
// (agrupamento interpretado por mim — não vem da planilha, que não separa
// por pacote). Códigos CORP01..CORP21 são sintéticos (a fonte não trazia
// código de conta nenhum, só o nome) — servem só de identificador estável
// para a chave CC|Conta do formulário, mesmo padrão do resto do app.
export const PACOTES_CORPORATIVO = [
  { id: 'pessoal', nome: "Pessoal", ref: 'Base_Corporativo.xlsx (2 contas)' },
  { id: 'servicos', nome: "Serviços de Terceiros", ref: 'Base_Corporativo.xlsx (4 contas)' },
  { id: 'locacao_utilidades', nome: "Locação, Ocupação e Utilidades", ref: 'Base_Corporativo.xlsx (4 contas)' },
  { id: 'administrativo', nome: "Administrativo", ref: 'Base_Corporativo.xlsx (6 contas)' },
  { id: 'manutencao', nome: "Manutenção", ref: 'Base_Corporativo.xlsx (1 conta)' },
  { id: 'comercial', nome: "Comercial e Marketing", ref: 'Base_Corporativo.xlsx (1 conta)' },
  { id: 'viagens', nome: "Viagens", ref: 'Base_Corporativo.xlsx (2 contas)' },
  { id: 'impostos', nome: "Impostos Indiretos e Diretos", ref: 'Base_Corporativo.xlsx (1 conta)' },
];

export const PLANO_CONTAS_CORPORATIVO = {
  pessoal: [
    { codigo: 'CORP01', nome: "Salários /Despesas com o pessoal", origem: 'Despesa' },
    { codigo: 'CORP13', nome: "Cursos e treinamentos", origem: 'Despesa' },
  ],
  servicos: [
    { codigo: 'CORP02', nome: "Assessorias e Consultorias", origem: 'Despesa' },
    { codigo: 'CORP03', nome: "Consultórias PJs", origem: 'Despesa' },
    { codigo: 'CORP04', nome: "Projetos", origem: 'Despesa' },
    { codigo: 'CORP08', nome: "Honorários Advocatícios", origem: 'Despesa' },
  ],
  locacao_utilidades: [
    { codigo: 'CORP05', nome: "Aluguel e Condomínio", origem: 'Despesa' },
    { codigo: 'CORP09', nome: "Telefonia e Internet", origem: 'Despesa' },
    { codigo: 'CORP10', nome: "Locação de Software", origem: 'Despesa' },
    { codigo: 'CORP20', nome: "Locação de equipamentos", origem: 'Despesa' },
  ],
  administrativo: [
    { codigo: 'CORP06', nome: "Material de expediente", origem: 'Despesa' },
    { codigo: 'CORP11', nome: "Material de Informática", origem: 'Despesa' },
    { codigo: 'CORP15', nome: "Eventos e Confraternizações", origem: 'Despesa' },
    { codigo: 'CORP16', nome: "Caixa Fundo fixo", origem: 'Despesa' },
    { codigo: 'CORP17', nome: "Despesas Diversas", origem: 'Despesa' },
    { codigo: 'CORP19', nome: "Material de Copa/Cozinha e limpeza", origem: 'Despesa' },
  ],
  manutencao: [
    { codigo: 'CORP07', nome: "Reformas e Manutenção", origem: 'Despesa' },
  ],
  comercial: [
    { codigo: 'CORP12', nome: "Propaganda e Publicidade", origem: 'Despesa' },
  ],
  viagens: [
    { codigo: 'CORP14', nome: "Combustível/Alimentação/Transporte", origem: 'Despesa' },
    { codigo: 'CORP18', nome: "Passagem e Hospedagem", origem: 'Despesa' },
  ],
  impostos: [
    { codigo: 'CORP21', nome: "Impostos e taxas", origem: 'Despesa' },
  ],
};

const TODAS_CONTAS_CORPORATIVO = {};
Object.entries(PLANO_CONTAS_CORPORATIVO).forEach(([pacoteId, contas]) => {
  contas.forEach(c => { TODAS_CONTAS_CORPORATIVO[c.codigo] = { ...c, pacoteId }; });
});

const NIVEIS_SERVICO = ['Essencial', 'Padrão', 'Redutível'];

// Etapas propostas do ciclo orçamentário 2027 — datas calculadas com calendário real
// a partir do início do ciclo (ago/2026), como ponto de partida ajustável pelo FP&A.
// Não são datas confirmadas pela Diretoria — ajustáveis diretamente na tela de Gestão.
const ETAPAS_PROCESSO_PADRAO = [
  { id: 'kickoff', nome: 'Kickoff e diretrizes', inicio: '2026-08-03', fim: '2026-08-07' },
  { id: 'treinamento', nome: 'Treinamento e abertura do formulário', inicio: '2026-08-10', fim: '2026-08-14' },
  { id: 'coleta', nome: 'Coleta de premissas pelas unidades', inicio: '2026-08-17', fim: '2026-09-30' },
  { id: 'consolidacao', nome: 'Consolidação e validação FP&A', inicio: '2026-10-01', fim: '2026-10-21' },
  { id: 'revisao_diretoria', nome: 'Revisão com a Diretoria', inicio: '2026-10-22', fim: '2026-11-06' },
  { id: 'aprovacao', nome: 'Aprovação final e fechamento', inicio: '2026-11-09', fim: '2026-11-30' },
];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];

// ---- Mapa reverso conta -> pacote, para localizar cada conta a partir da sua chave ----
const TODAS_CONTAS = {};
Object.entries(PLANO_CONTAS).forEach(([pacoteId, contas]) => {
  contas.forEach(c => { TODAS_CONTAS[c.codigo] = { ...c, pacoteId }; });
});

const TODAS_CONTAS_AGRICOLA = {};
Object.entries(PLANO_CONTAS_AGRICOLA).forEach(([pacoteId, contas]) => {
  contas.forEach(c => { TODAS_CONTAS_AGRICOLA[c.codigo] = { ...c, pacoteId }; });
});

const TODAS_CONTAS_RESORTS = {};
Object.entries(PLANO_CONTAS_RESORTS).forEach(([pacoteId, contas]) => {
  contas.forEach(c => { TODAS_CONTAS_RESORTS[c.codigo] = { ...c, pacoteId }; });
});

// Decisão de 2026-08-09: Agrícola e Resorts habilitadas com lançamento
// completo, usando os mesmos 8 CCs genéricos da Têxtil como PLACEHOLDER —
// a matriz de governança não traz CC oficial pra essas duas ainda. Trocar
// por CCS_TEXTIL.slice() próprio de cada unidade quando a planilha real
// chegar (por enquanto compartilham a mesma referência, então editar uma
// mudaria as duas — cuidado se for editar isto à mão antes de separar).
const REFERENCIA_POR_UNIDADE = {
  textil: { ccs: CCS_TEXTIL, planoContas: PLANO_CONTAS, todasContas: TODAS_CONTAS, pacotes: PACOTES_TEXTIL },
  agricola: { ccs: CCS_TEXTIL, planoContas: PLANO_CONTAS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, pacotes: PACOTES_AGRICOLA },
  resorts: { ccs: CCS_TEXTIL, planoContas: PLANO_CONTAS_RESORTS, todasContas: TODAS_CONTAS_RESORTS, pacotes: PACOTES_RESORTS },
  // Decisão de 2026-08-16: Corporativo usa os 20 CCs reais (CCS_CORPORATIVO,
  // fonte confiável) — diferente de Agrícola/Resorts, que usam CC
  // placeholder. Todo CC recebe o mesmo plano de contas completo, ver nota
  // em PLANO_CONTAS_CORPORATIVO.
  corporativo: { ccs: CCS_CORPORATIVO, planoContas: PLANO_CONTAS_CORPORATIVO, todasContas: TODAS_CONTAS_CORPORATIVO, pacotes: PACOTES_CORPORATIVO },
};
// ---------------------------------------------------------------------------
// Estrutura de Receita de Agrícola e Resorts — extraída de
// "Premissas por Empresa.xlsx" (abas Premissas_Agrícola/Premissas_Resorts),
// fornecida pelo usuário em 2026-08-09. Ver nota extensa no arquivo espelho
// backend/src/calc/receitaAgricolaResorts.js — mesma lógica, duplicada aqui
// porque o frontend ainda não importa do backend (protótipo de arquivo único).
// ---------------------------------------------------------------------------
const PRODUTOS_REF_AGRICOLA = [
  { nome: 'Vendas Internas', volumeRef: 7570, precoRef: 11.01 },
  { nome: 'Vendas Externas', volumeRef: 3930, precoRef: 12.13 },
];
const DEDUCOES_REF_AGRICOLA = [
  { id: 'pis', nome: 'PIS', pctRef: 0 },
  { id: 'cofins', nome: 'Cofins', pctRef: 0 },
  { id: 'iss', nome: 'ISS', pctRef: 0 },
  { id: 'devolucoes', nome: 'Devoluções', pctRef: 1.6 },
  { id: 'inss', nome: 'INSS', pctRef: 2.05 },
];

const LINHAS_RECEITA_RESORTS = [
  { id: 'hospedagem', nome: '1.1 Hospedagem', tipo: 'qtd_valor', rotuloQtd: 'Acomodações ocupadas (#)', rotuloValor: 'Tarifa média (R$/acomodação)' },
  { id: 'aeb', nome: '1.2.1 Alimentação e Bebidas', tipo: 'qtd_valor', rotuloQtd: 'Nº de adultos', rotuloValor: 'Consumo médio de A&B (R$)' },
  { id: 'cafePensao', nome: '1.2.2 Café e Pensão', tipo: 'qtd_valor', rotuloQtd: 'Nº de adultos', rotuloValor: 'Consumo médio (R$)' },
  { id: 'moorea', nome: '1.3 Receita Moorea', tipo: 'direto' },
  { id: 'alugueis', nome: '1.4 Outras Receitas — Aluguéis', tipo: 'direto' },
  { id: 'outrasIss', nome: '1.4 Outras Receitas — ISS', tipo: 'direto' },
  { id: 'arrumacao', nome: '1.4 Outras Receitas — Arrumação (LFCVH)', tipo: 'direto' },
];
// baseLinhaIds: quais linhas de receita somadas formam a base do percentual
// ("A&B" na planilha = Alimentação e Bebidas + Café e Pensão somados).
// Bases conferidas direto nas fórmulas da planilha (não aproximação — ver
// nota completa no arquivo espelho backend/src/calc/receitaAgricolaResorts.js).
// Café e Pensão não entra em nenhuma base de dedução.
const DEDUCOES_REF_RESORTS = [
  { id: 'pis_hospedagem', nome: 'PIS — % Receita Hospedagem', pctRef: 0.65, baseLinhaIds: ['hospedagem', 'outrasIss'] },
  { id: 'cofins_hospedagem', nome: 'Cofins — % Receita Hospedagem', pctRef: 3, baseLinhaIds: ['hospedagem', 'outrasIss'] },
  { id: 'iss_hospedagem', nome: 'ISS — % Receita Hospedagem', pctRef: 5, baseLinhaIds: ['hospedagem', 'arrumacao'] },
  { id: 'pis_aeb', nome: 'PIS — % Receita A&B', pctRef: 1.65, baseLinhaIds: ['aeb', 'alugueis', 'arrumacao'] },
  { id: 'cofins_aeb', nome: 'Cofins — % Receita A&B', pctRef: 7.6, baseLinhaIds: ['aeb', 'alugueis', 'arrumacao'] },
  { id: 'icms_aeb', nome: 'ICMS — % A&B', pctRef: 2.12, baseLinhaIds: ['aeb'] },
  { id: 'descontos_servicos', nome: 'Descontos sobre serviços — % Receita A&B', pctRef: 0, baseLinhaIds: ['hospedagem', 'moorea', 'alugueis', 'outrasIss', 'arrumacao'] },
  { id: 'descontos_aeb', nome: 'Descontos A&B — % A&B', pctRef: 0, baseLinhaIds: ['aeb'] },
];

const REF_VAZIA = { ccs: [], todasContas: {} };
function referenciaDaUnidade(unidadeId) {
  return REFERENCIA_POR_UNIDADE[unidadeId] || REF_VAZIA;
}

const TIPOS_PREMISSA = [
  { id: 'direto', nome: 'Valor direto' },
  { id: 'qtd_valor', nome: 'Quantidade × Valor unit.' },
  { id: 'rateio', nome: 'Base × %' },
];
const BASES_RATEIO = [
  { id: 'receita_bruta', nome: 'Receita Bruta do mês' },
  { id: 'receita_liquida', nome: 'Receita Líquida do mês' },
  { id: 'manual', nome: 'Valor de referência manual' },
];

function novaLinhaFinanciamento() {
  return {
    id: uid(), banco: '', linha: '', moeda: 'BRL', saldoInicial: '',
    captacoes: mesesVazios(), amortizacoes: mesesVazios(), jurosPagos: mesesVazios(),
    variacaoCambial: mesesVazios(), provisaoDespesaFinanceira: mesesVazios(),
    justificativa: '',
  };
}

function novaLinhaVazia() {
  return {
    premissaTipo: 'direto',
    classificacao: 'fixo',
    valores: mesesVazios(),
    quantidades: mesesVazios(),
    valoresUnit: mesesVazios(),
    unidadeMedida: '',
    baseTipo: 'receita_bruta',
    baseManual: mesesVazios(),
    percentuais: mesesVazios(),
    justificativa: '',
  };
}

// Calculadora de viagens — só a conta "Passagem e Hospedagem" (CORP18) do
// Corporativo, decisão de 2026-08-19 ("tela dedicada só para essa conta",
// não um tipo de premissa geral). Fonte: Viagens.xlsx (aba "1.18 Passagem e
// Hospedagem"), fórmula da linha 6 conferida célula a célula:
//   Total = ((Dias × Diária Hospedagem) + (Dias × Alimentação/dia) +
//            Valor Passagem + Outros Transportes + Outros1+Outros2+Outros3)
//           × Quantidade de Pessoas
// Cada bloco da planilha é uma viagem nomeada (destino) com esses 7 campos
// mês a mês — o formulário replica isso como uma lista de viagens por CC.
// O total calculado é sincronizado de volta em custos.linhas['CC|CORP18']
// (premissaTipo 'direto') a cada edição — assim o resto do motor de
// cálculo (DRE, auditoria, log de alteração) não precisa saber que essa
// conta específica tem uma tela diferente por trás; só backend/frontend
// da DRE continuam lendo custos.linhas normalmente, sem duplicar lógica
// no backend.
const CONTA_VIAGENS_CALCULADORA = 'CORP18';
function novaViagem() {
  return {
    id: uid(), nome: '',
    pessoas: mesesVazios(), dias: mesesVazios(),
    diariaHospedagem: mesesVazios(), valorPassagem: mesesVazios(), outrosTransportes: mesesVazios(),
    alimentacaoPorDia: mesesVazios(),
    outros1: mesesVazios(), outros2: mesesVazios(), outros3: mesesVazios(),
  };
}
function computeViagemMes(viagem, m) {
  const dias = parseNum(viagem.dias?.[m]);
  const pessoas = parseNum(viagem.pessoas?.[m]);
  const outros = parseNum(viagem.outros1?.[m]) + parseNum(viagem.outros2?.[m]) + parseNum(viagem.outros3?.[m]);
  return ((dias * parseNum(viagem.diariaHospedagem?.[m])) + (dias * parseNum(viagem.alimentacaoPorDia?.[m])) + parseNum(viagem.valorPassagem?.[m]) + parseNum(viagem.outrosTransportes?.[m]) + outros) * pessoas;
}
function computeViagensMes(viagensCC) {
  return MESES.map((_, m) => (viagensCC || []).reduce((acc, v) => acc + computeViagemMes(v, m), 0));
}

// Valor de uma linha (chave CC|Conta) em um mês, de acordo com o tipo de premissa.
// receitaBrutaMes/receitaLiquidaMes são arrays de 12 posições, vindos do computeDRE.
function valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes) {
  if (!linha) return 0;
  if (linha.premissaTipo === 'qtd_valor') {
    return parseNum(linha.quantidades?.[m]) * parseNum(linha.valoresUnit?.[m]);
  }
  if (linha.premissaTipo === 'rateio') {
    const pct = parseNum(linha.percentuais?.[m]) / 100;
    let base = 0;
    if (linha.baseTipo === 'receita_bruta') base = receitaBrutaMes?.[m] || 0;
    else if (linha.baseTipo === 'receita_liquida') base = receitaLiquidaMes?.[m] || 0;
    else base = parseNum(linha.baseManual?.[m]);
    return base * pct;
  }
  return parseNum(linha.valores?.[m]);
}
function valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes) {
  return MESES.reduce((acc, _, m) => acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes), 0);
}
// Checagem de coerência: premissa qtd_valor/rateio com apenas um dos dois campos preenchido em algum mês.
function linhaIncoerente(linha) {
  if (!linha) return false;
  if (linha.premissaTipo === 'qtd_valor') {
    return MESES.some((_, m) => {
      const q = linha.quantidades?.[m] !== '' && linha.quantidades?.[m] != null;
      const v = linha.valoresUnit?.[m] !== '' && linha.valoresUnit?.[m] != null;
      return q !== v;
    });
  }
  if (linha.premissaTipo === 'rateio' && linha.baseTipo === 'manual') {
    return MESES.some((_, m) => {
      const b = linha.baseManual?.[m] !== '' && linha.baseManual?.[m] != null;
      const p = linha.percentuais?.[m] !== '' && linha.percentuais?.[m] != null;
      return b !== p;
    });
  }
  return false;
}
function linhaTemNegativo(linha) {
  if (!linha) return false;
  const campos = linha.premissaTipo === 'qtd_valor' ? [linha.quantidades, linha.valoresUnit]
    : linha.premissaTipo === 'rateio' ? [linha.baseManual, linha.percentuais]
    : [linha.valores];
  return campos.some(arr => (arr || []).some(v => parseNum(v) < 0));
}

// Pedido de 2026-08-09: a entrega do gestor da unidade se restringe ao DRE
// (Receita, Custos e Despesas, Provisões, Kgiro e FC Operacional, CAPEX) —
// as 3 marcadas "(opcional)" são responsabilidade do FP&A, não bloqueiam
// o envio (ver runAuditoria: obrigatorio:false no check de Balanço).
const ABAS = [
  { id: 'estrategicas', label: '1. Premissas Estratégicas' },
  { id: 'receita', label: '2. Receita' },
  { id: 'custos', label: '3. Custos e Despesas' },
  { id: 'provisoes', label: '4. Provisões' },
  { id: 'giro', label: '5. Kgiro e FC Operacional' },
  { id: 'capex', label: '6. CAPEX' },
  { id: 'fcfinanciamentos', label: '7. FC Financiamentos (FP&A)' },
  { id: 'balanco', label: '8. Balanço Patrimonial (FP&A)' },
  { id: 'plano5y', label: '9. Plano 5Y (opcional)' },
  { id: 'revisao', label: 'Revisão, Análise e Envio' },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

function formatBRL(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(R$ ${s})` : `R$ ${s}`;
}
function formatPct(v, casas = 1) {
  const n = Number(v) || 0;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}
function formatData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// unidadeId só muda os produtos de referência: PRODUTOS_REF (têxteis) só faz
// sentido para a Têxtil. Agrícola/Resorts começam com lista vazia — sem uma
// lista de referência oficial de produtos/serviços pra essas duas ainda.
// Monta o objeto `receita` certo por unidade — três modelos diferentes (ver
// nota no topo do arquivo, junto de PRODUTOS_REF_AGRICOLA): produtos com
// referência pré-carregada (Têxtil), produtos genéricos (Agrícola), ou
// linhas de hotelaria (Resorts).
function receitaVazia(unidadeId) {
  if (unidadeId === 'textil') {
    return {
      produtos: PRODUTOS_REF.map(p => ({ id: uid(), nome: p.nome, volumes: mesesVazios(), precos: mesesVazios() })),
      deducoes: DEDUCOES_REF.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios() })),
    };
  }
  if (unidadeId === 'agricola') {
    return {
      // "Vendas Externas" ganha o racional Volume × Preço(USD) × Câmbio —
      // pedido explícito de 2026-08-09: a planilha 2026 só trazia o preço
      // já consolidado em R$/t, mas o formulário 2027 expõe a composição
      // real (preço em USD, que o mercado externo referencia, × câmbio).
      produtos: PRODUTOS_REF_AGRICOLA.map(p => ({
        id: uid(), nome: p.nome, volumes: mesesVazios(), precos: mesesVazios(),
        ...(p.nome === 'Vendas Externas' ? { precoUsd: mesesVazios(), cambio: mesesVazios() } : {}),
      })),
      deducoes: DEDUCOES_REF_AGRICOLA.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios(), baseLinhaIds: d.baseLinhaIds })),
    };
  }
  if (unidadeId === 'resorts') {
    const linhas = {};
    LINHAS_RECEITA_RESORTS.forEach((l) => { linhas[l.id] = novaLinhaVazia(); });
    // Hospedagem ganha o racional Total de Acomodações × Taxa de Ocupação =
    // Acomodações Ocupadas — pedido explícito de 2026-08-09: a "quantidade"
    // não é um número solto, é derivada da taxa de ocupação sobre a
    // capacidade total (mesma relação da planilha: linha 16 = 17 × 18).
    linhas.hospedagem = { ...linhas.hospedagem, taxaOcupacao: mesesVazios(), totalAcomodacoes: mesesVazios() };
    return {
      linhas,
      deducoes: DEDUCOES_REF_RESORTS.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios(), baseLinhaIds: d.baseLinhaIds })),
    };
  }
  return { produtos: [], deducoes: [] };
}

function emptyFormData(unidadeId = 'textil') {
  return {
    estrategicas: {
      contexto: '',
      objetivos: [],
      iniciativas: [],
      swot: { forcas: '', fraquezas: '', oportunidades: '', ameacas: '' },
    },
    receita: {
      ...receitaVazia(unidadeId),
      deducoesJustificativa: '',
      justificativaGeral: '',
    },
    custos: {
      linhas: {}, detalhes: [], funcionarios: [],
      premissasPessoal: { inssPct: '', fgtsPct: '', feriasPct: '', decimoTerceiroPct: '', valeTransporteValor: '', cestaBasicaValor: '', planoSaudeValor: '', outrosBeneficiosValor: '' },
      // Só Corporativo, conta CORP18 "Passagem e Hospedagem" (decisão de
      // 2026-08-19) — { [ccCodigo]: [viagem, ...] }, ver
      // CONTA_VIAGENS_CALCULADORA/novaViagem/computeViagensMes.
      viagens: {},
    },
    capex: { projetos: [] },
    capitalGiro: {
      prazoRecebimento: mesesVazios(), prazoPagamento: mesesVazios(), giroEstoque: mesesVazios(), justificativa: '',
      // Só ARA Têxtil — ver PREMISSAS_RECEBIMENTO_REF e nota de 2026-08-16.
      ...(unidadeId === 'textil' ? {
        recebimentosEmCarteira: mesesVazios(),
        recebimentosVendasNovDez: mesesVazios(),
        premissasRecebimento: premissasRecebimentoVazias(),
        // Plano de contas fixo (ver PLANO_CONTAS_PAGAMENTOS_TEXTIL), não
        // mais lista livre — decisão de 2026-08-16.
        pagamentosManuais: pagamentosManuaisVazios(),
      } : {}),
    },
    provisoes: {
      inadimplencia: mesesVazios(), contingencias: mesesVazios(), perdas: mesesVazios(), justificativa: '',
    },
    resultado: {
      receitaFinanceira: mesesVazios(), despesaFinanceira: mesesVazios(), outrasReceitasDespesas: mesesVazios(),
      aliquotaIR: '34', justificativa: '',
    },
    fcFinanciamentos: {
      linhas: [],
      movimentacoesAcionistas: [
        { id: 'aportes', nome: 'Aportes', valores: mesesVazios() },
        { id: 'dist_minoritarios', nome: 'Distribuição a Minoritários', valores: mesesVazios() },
        { id: 'dist_socios', nome: 'Distribuição a Sócios', valores: mesesVazios() },
        { id: 'emprestimos_acionistas', nome: 'Empréstimos', valores: mesesVazios() },
        { id: 'devolucao_emprestimos', nome: 'Devoluções de Empréstimos', valores: mesesVazios() },
      ],
      justificativa: '',
    },
    balanco: {
      caixaInicial: '', imobilizadoInicial: '', depreciacaoAcumuladaInicial: '',
      contasAReceberInicial: '', estoqueInicial: '', contasAPagarInicial: '',
      emprestimos: { saldoInicial: '', taxaJurosAnual: '', justificativa: '' },
      justificativa: '',
      // Só ARA Têxtil — plano de contas completo, ver GRUPOS_BALANCO_TEXTIL.
      // saldosIniciais = coluna Dez/25 (saldo de partida por conta) —
      // substitui os campos escalares acima como fonte dos cálculos de FC
      // para Têxtil (ver saldosAberturaFc).
      ...(unidadeId === 'textil' ? { planoContas: planoContasBalancoVazio(), saldosIniciais: saldosIniciaisBalancoVazio() } : {}),
    },
    plano5y: {
      anos: {
        2028: { crescimentoReceita: '', inflacaoCustos: '', inflacaoDespesas: '', depreciacaoAnual: '', aliquotaIR: '', justificativa: '' },
        2029: { crescimentoReceita: '', inflacaoCustos: '', inflacaoDespesas: '', depreciacaoAnual: '', aliquotaIR: '', justificativa: '' },
        2030: { crescimentoReceita: '', inflacaoCustos: '', inflacaoDespesas: '', depreciacaoAnual: '', aliquotaIR: '', justificativa: '' },
        2031: { crescimentoReceita: '', inflacaoCustos: '', inflacaoDespesas: '', depreciacaoAnual: '', aliquotaIR: '', justificativa: '' },
      },
    },
    sensibilidades: {
      cenarios: {
        otimista: novoCenarioSensibilidadeVazio(),
        pessimista: novoCenarioSensibilidadeVazio(),
      },
    },
    meta: { status: 'nao_iniciado', atualizadoEm: null, autor: null },
  };
}

function somaMes(arr) { return (arr || []).reduce((a, v) => a + parseNum(v), 0); }

// ---------------------------------------------------------------------------
// Cálculo da cascata de DRE — segue a estrutura da aba "1.1 DRE" e o modelo
// de referência (Receita Líquida → Lucro Bruto → EBITDA → Lucro Líquido)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Folha de Pessoal — a partir da lista de funcionários (nome + salário atual,
// por CC) e das premissas de encargos/benefícios padronizadas da unidade.
// 13º salário é provisionado mês a mês por competência (1/12 do salário);
// o pagamento em caixa (metade nov, metade dez) é tratado à parte, no fluxo
// de caixa direto (aba Revisão, Análise e Envio), não aqui na DRE.
// ---------------------------------------------------------------------------
function computeFolhaPessoalMes(funcionariosCC, premissas, mIdx) {
  const ativos = (funcionariosCC || []).filter(f => {
    if (!f.mesAdmissao) return true;
    const idxAdm = MESES.indexOf(f.mesAdmissao);
    return idxAdm === -1 || idxAdm <= mIdx;
  });
  const salarios = ativos.reduce((acc, f) => acc + parseNum(f.salario), 0);
  const inss = salarios * (parseNum(premissas?.inssPct) / 100);
  const fgts = salarios * (parseNum(premissas?.fgtsPct) / 100);
  const ferias = salarios * (parseNum(premissas?.feriasPct) / 100);
  const decimoTerceiro = salarios * (parseNum(premissas?.decimoTerceiroPct) / 100);
  const beneficiosPorFuncionario = parseNum(premissas?.valeTransporteValor) + parseNum(premissas?.cestaBasicaValor) + parseNum(premissas?.planoSaudeValor) + parseNum(premissas?.outrosBeneficiosValor);
  const beneficios = ativos.length * beneficiosPorFuncionario;
  const encargos = inss + fgts + ferias;
  const total = salarios + encargos + decimoTerceiro + beneficios;
  return { qtdFuncionarios: ativos.length, salarios, inss, fgts, ferias, encargos, decimoTerceiro, beneficios, total };
}
function computeFolhaPessoalAnual(funcionariosCC, premissas) {
  const mensal = MESES.map((_, m) => computeFolhaPessoalMes(funcionariosCC, premissas, m));
  return {
    mensal,
    totalAnual: mensal.reduce((acc, m) => acc + m.total, 0),
    decimoTerceiroAnual: mensal.reduce((acc, m) => acc + m.decimoTerceiro, 0),
    salariosMes: mensal.map(m => m.salarios),
    totalMes: mensal.map(m => m.total),
  };
}
function folhaAnualPorCC(data, ccCodigo) {
  const funcs = (data.custos.funcionarios || []).filter(f => f.ccCodigo === ccCodigo);
  return computeFolhaPessoalAnual(funcs, data.custos.premissasPessoal);
}

// Duas formas de modelar receita, conforme a unidade: `receita.produtos`
// (Volume × Preço por produto — Têxtil e Agrícola) ou `receita.linhas`
// (quantidade × valor unitário ou valor direto por linha — Resorts, modelo
// de hotelaria). Uma exclui a outra.
function receitaBrutaPorMes(data) {
  if (data.receita.linhas) {
    const linhasMes = {};
    Object.entries(data.receita.linhas).forEach(([id, linha]) => {
      linhasMes[id] = MESES.map((_, m) => valorLinhaMes(linha, m, null, null));
    });
    const totalMes = MESES.map((_, m) => Object.values(linhasMes).reduce((acc, arr) => acc + arr[m], 0));
    return { receitaBrutaMes: totalMes, linhasReceitaMes: linhasMes };
  }
  const totalMes = MESES.map((_, m) =>
    (data.receita.produtos || []).reduce((acc, p) => acc + parseNum(p.volumes?.[m]) * parseNum(p.precos?.[m]), 0)
  );
  return { receitaBrutaMes: totalMes, linhasReceitaMes: null };
}

function computeDRE(data, ref) {
  // Receita bruta por mês, para aplicar deduções percentuais mês a mês
  const { receitaBrutaMes, linhasReceitaMes } = receitaBrutaPorMes(data);
  const receitaBruta = receitaBrutaMes.reduce((a, v) => a + v, 0);

  // Base do percentual de dedução: normalmente a receita bruta total
  // (Têxtil/Agrícola), mas uma linha pode apontar `baseLinhaIds` — soma só
  // das linhas referenciadas (Resorts).
  const deducoesMes = MESES.map((_, m) =>
    (data.receita.deducoes || []).reduce((a, d) => {
      const base = (d.baseLinhaIds && linhasReceitaMes)
        ? d.baseLinhaIds.reduce((s, id) => s + (linhasReceitaMes[id]?.[m] || 0), 0)
        : receitaBrutaMes[m];
      return a + base * (parseNum(d.pcts?.[m]) / 100);
    }, 0)
  );
  const deducoes = deducoesMes.reduce((a, v) => a + v, 0);
  const receitaLiquidaMes = MESES.map((_, m) => receitaBrutaMes[m] - deducoesMes[m]);
  const receitaLiquida = receitaBruta - deducoes;

  const linhasCustos = Object.entries(data.custos.linhas || {});

  const cpv = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    if (!cc || cc.tipo !== 'producao') return acc;
    if (ref.todasContas[contaCodigo]?.pacoteId === 'pessoal') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes);
  }, 0) + ref.ccs.filter(cc => cc.tipo === 'producao').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).totalAnual, 0);
  const lucroBruto = receitaLiquida - cpv;
  const margemBruta = receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0;

  const despesasSemDA = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || cc.tipo !== 'despesa' || pacoteId === 'depreciacao' || pacoteId === 'pessoal') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes);
  }, 0) + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).totalAnual, 0);
  const ebitda = lucroBruto - despesasSemDA;
  const margemEbitda = receitaLiquida ? (ebitda / receitaLiquida) * 100 : 0;

  const depreciacao = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || cc.tipo !== 'despesa' || pacoteId !== 'depreciacao') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes);
  }, 0);

  const resultadoFinanceiro = somaMes(data.resultado.receitaFinanceira) - somaMes(data.resultado.despesaFinanceira);
  const outras = somaMes(data.resultado.outrasReceitasDespesas);

  const ebt = ebitda - depreciacao + resultadoFinanceiro + outras;
  const ircsl = ebt > 0 ? ebt * (parseNum(data.resultado.aliquotaIR) / 100) : 0;
  const lucroLiquido = ebt - ircsl;
  const margemLiquida = receitaLiquida ? (lucroLiquido / receitaLiquida) * 100 : 0;

  const capexTotal = (data.capex.projetos || []).reduce((acc, p) => acc + parseNum(p.valor), 0);

  return {
    receitaBruta, deducoes, receitaLiquida, cpv, lucroBruto, margemBruta,
    despesasSemDA, ebitda, margemEbitda, depreciacao, resultadoFinanceiro, outras,
    ebt, ircsl, lucroLiquido, margemLiquida, capexTotal,
    receitaBrutaMes, receitaLiquidaMes,
    totalGeral: lucroLiquido,
  };
}

// ---------------------------------------------------------------------------
// Cálculo do Fluxo de Caixa (método indireto) — a partir do Lucro Líquido da
// DRE, add-back de D&A, CAPEX e eventos do Balanço (empréstimos, aportes,
// dividendos). Variação de Capital de Giro fica como pendência: os dados do
// formulário (prazos de recebimento/pagamento, giro de estoque) são premissas
// em dias, sem saldo inicial de contas a receber/pagar/estoque para calcular
// o delta em R$ — não inventamos esse número.
// ---------------------------------------------------------------------------
function computeDFC(data, dre) {
  const capexTotal = (data.capex.projetos || []).reduce((acc, p) => acc + parseNum(p.valor), 0);

  const linhasFin = data.fcFinanciamentos?.linhas || [];
  const captacoes = linhasFin.reduce((acc, l) => acc + somaMes(l.captacoes), 0);
  const amortizacoes = linhasFin.reduce((acc, l) => acc + somaMes(l.amortizacoes), 0);
  const jurosPagos = linhasFin.reduce((acc, l) => acc + somaMes(l.jurosPagos), 0);

  const movs = data.fcFinanciamentos?.movimentacoesAcionistas || [];
  const buscaMov = id => somaMes(movs.find(m => m.id === id)?.valores);
  const aportes = buscaMov('aportes');
  const distMinoritarios = buscaMov('dist_minoritarios');
  const distSocios = buscaMov('dist_socios');
  const emprestimosAcionistas = buscaMov('emprestimos_acionistas');
  const devolucaoEmprestimos = buscaMov('devolucao_emprestimos');

  const geracaoOperacionalAntesGiro = dre.lucroLiquido + dre.depreciacao;
  const variacaoCapitalGiro = 0; // pendência — ver nota acima
  const fluxoOperacional = geracaoOperacionalAntesGiro + variacaoCapitalGiro;

  const fluxoInvestimento = -capexTotal;
  const fluxoFinanciamento = captacoes - amortizacoes - jurosPagos + aportes - distMinoritarios - distSocios + emprestimosAcionistas - devolucaoEmprestimos;

  const variacaoCaixa = fluxoOperacional + fluxoInvestimento + fluxoFinanciamento;
  const caixaInicial = saldosAberturaFc(data).caixaInicial; // computeDFC (anual, legado/dashboard consolidado)
  const caixaFinal = caixaInicial + variacaoCaixa;

  return {
    lucroLiquido: dre.lucroLiquido, depreciacao: dre.depreciacao, geracaoOperacionalAntesGiro,
    variacaoCapitalGiro, fluxoOperacional,
    capexTotal, fluxoInvestimento,
    captacoes, amortizacoes, jurosPagos, aportes, distMinoritarios, distSocios, emprestimosAcionistas, devolucaoEmprestimos,
    fluxoFinanciamento,
    variacaoCaixa, caixaInicial, caixaFinal,
  };
}

// ---------------------------------------------------------------------------
// Fluxo de Caixa Indireto mensal, partindo do EBITDA — para a Revisão, Análise e Envio.
// FC Operacional: EBITDA mensal - IRCSL proporcional + variação de capital de
//   giro (DSO/DPO/DIO sobre os saldos de abertura do Balanço e os prazos da
//   aba 5) + ajuste de competência x caixa do 13º (provisionado mês a mês,
//   pago metade em novembro e metade em dezembro).
// FC Investimentos: atrelado ao mês de cada projeto de CAPEX.
// FC Financiamentos: atrelado às linhas por banco e às movimentações de
//   acionistas da aba 7.
// ---------------------------------------------------------------------------
function computeFluxoIndiretoMensal(data, dre, ref) {
  const receitaLiquidaMes = dre.receitaLiquidaMes;
  const receitaBrutaMes = dre.receitaBrutaMes;
  const linhasCustos = Object.entries(data.custos.linhas || {});

  function totalLinhasMes(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || cc.tipo !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes);
    }, 0);
  }
  const cpvSemPessoalMes = MESES.map((_, m) => totalLinhasMes('producao', ['pessoal'], m));
  const cpvMes = MESES.map((_, m) => cpvSemPessoalMes[m]
    + ref.ccs.filter(cc => cc.tipo === 'producao').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].total, 0));
  const despesasSemDAmes = MESES.map((_, m) => totalLinhasMes('despesa', ['depreciacao', 'pessoal'], m)
    + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].total, 0));
  const ebitdaMes = MESES.map((_, m) => receitaLiquidaMes[m] - cpvMes[m] - despesasSemDAmes[m]);

  const ircslMes = MESES.map(() => dre.ircsl / 12);

  const decimoTerceiroMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].decimoTerceiro, 0));
  const decimoTerceiroAnualTotal = decimoTerceiroMes.reduce((a, v) => a + v, 0);
  const pagamento13Mes = MESES.map((_, m) => (m === 10 || m === 11) ? decimoTerceiroAnualTotal / 2 : 0);
  const ajuste13Mes = MESES.map((_, m) => decimoTerceiroMes[m] - pagamento13Mes[m]);

  const cg = data.capitalGiro;
  const arMes = MESES.map((_, m) => receitaLiquidaMes[m] * (parseNum(cg.prazoRecebimento?.[m]) / 30));
  const apMes = MESES.map((_, m) => cpvSemPessoalMes[m] * (parseNum(cg.prazoPagamento?.[m]) / 30));
  const estoqueMes = MESES.map((_, m) => cpvSemPessoalMes[m] * (parseNum(cg.giroEstoque?.[m]) / 30));
  const { arInicial, apInicial, estoqueInicial } = saldosAberturaFc(data);
  const variacaoGiroMes = MESES.map((_, m) => {
    const arAnt = m === 0 ? arInicial : arMes[m - 1];
    const apAnt = m === 0 ? apInicial : apMes[m - 1];
    const estAnt = m === 0 ? estoqueInicial : estoqueMes[m - 1];
    return -(arMes[m] - arAnt) - (estoqueMes[m] - estAnt) + (apMes[m] - apAnt);
  });

  const fcOperacionalMes = MESES.map((_, m) => ebitdaMes[m] - ircslMes[m] + ajuste13Mes[m] + variacaoGiroMes[m]);

  const capexMes = MESES.map((_, m) => (data.capex.projetos || []).reduce((acc, p) => acc + (p.mes === MESES[m] ? parseNum(p.valor) : 0), 0));
  const fcInvestimentoMes = capexMes.map(v => -v);

  const linhasFin = data.fcFinanciamentos?.linhas || [];
  const capMes = MESES.map((_, m) => linhasFin.reduce((acc, l) => acc + parseNum(l.captacoes?.[m]), 0));
  const amortMes = MESES.map((_, m) => linhasFin.reduce((acc, l) => acc + parseNum(l.amortizacoes?.[m]), 0));
  const jurosMes = MESES.map((_, m) => linhasFin.reduce((acc, l) => acc + parseNum(l.jurosPagos?.[m]), 0));
  const movs = data.fcFinanciamentos?.movimentacoesAcionistas || [];
  const movMes = id => MESES.map((_, m) => parseNum(movs.find(x => x.id === id)?.valores?.[m]));
  const aportesMes = movMes('aportes');
  const distMinMes = movMes('dist_minoritarios');
  const distSocMes = movMes('dist_socios');
  const empAcMes = movMes('emprestimos_acionistas');
  const devolMes = movMes('devolucao_emprestimos');
  const fcFinanciamentoMes = MESES.map((_, m) => capMes[m] - amortMes[m] - jurosMes[m] + aportesMes[m] - distMinMes[m] - distSocMes[m] + empAcMes[m] - devolMes[m]);

  const lucroBrutoMes = MESES.map((_, m) => receitaLiquidaMes[m] - cpvMes[m]);
  const deducoesMes = MESES.map((_, m) => receitaBrutaMes[m] - receitaLiquidaMes[m]);
  const depreciacaoMes = MESES.map((_, m) => linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || cc.tipo !== 'despesa' || pacoteId !== 'depreciacao') return acc;
    return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes);
  }, 0));
  const resultadoFinanceiroMes = MESES.map((_, m) => parseNum(data.resultado.receitaFinanceira?.[m]) - parseNum(data.resultado.despesaFinanceira?.[m]));
  const outrasMes = MESES.map((_, m) => parseNum(data.resultado.outrasReceitasDespesas?.[m]));
  const ebtMes = MESES.map((_, m) => ebitdaMes[m] - depreciacaoMes[m] + resultadoFinanceiroMes[m] + outrasMes[m]);
  const lucroLiquidoMes = MESES.map((_, m) => ebtMes[m] - ircslMes[m]);

  const variacaoCaixaMes = MESES.map((_, m) => fcOperacionalMes[m] + fcInvestimentoMes[m] + fcFinanciamentoMes[m]);
  const caixaInicial = saldosAberturaFc(data).caixaInicial;
  const caixaAcumuladoMes = [];
  let acumulado = caixaInicial;
  MESES.forEach((_, m) => { acumulado += variacaoCaixaMes[m]; caixaAcumuladoMes.push(acumulado); });

  return {
    receitaBrutaMes, receitaLiquidaMes, deducoesMes, cpvMes, lucroBrutoMes, despesasSemDAmes,
    ebitdaMes, depreciacaoMes, resultadoFinanceiroMes, outrasMes, ircslMes, lucroLiquidoMes,
    ajuste13Mes, variacaoGiroMes, fcOperacionalMes,
    fcInvestimentoMes, fcFinanciamentoMes, variacaoCaixaMes, caixaInicial, caixaAcumuladoMes,
  };
}

// ---------------------------------------------------------------------------
// Plano 5Y — 2027 vem do orçamento detalhado (dre). 2028-2031 são uma
// projeção top-down: crescimento de receita, inflação de custos e de
// despesas aplicados ano a ano sobre a base anterior. Depreciação e
// alíquota de IR são editáveis por ano (dependem do ciclo de CAPEX e de
// decisões tributárias que não seguem uma regra simples de crescimento).
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Fluxo de Caixa Direto mensal — recebimentos e pagamentos por categoria
// (não parte do EBITDA; é uma decomposição por natureza de caixa). Construído
// com os mesmos componentes do método indireto (receita, CPV, despesas,
// folha, capital de giro, 13º), então reconcilia matematicamente com o
// FC Operacional do método indireto — são duas leituras do mesmo número.
// ---------------------------------------------------------------------------
function computeFluxoCaixaDiretoMensal(data, dre, ref) {
  const receitaLiquidaMes = dre.receitaLiquidaMes;
  const receitaBrutaMes = dre.receitaBrutaMes;
  const linhasCustos = Object.entries(data.custos.linhas || {});

  function totalLinhasMes(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || cc.tipo !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes);
    }, 0);
  }
  const cpvSemPessoalMes = MESES.map((_, m) => totalLinhasMes('producao', ['pessoal'], m));
  const despesasSemPessoalMes = MESES.map((_, m) => totalLinhasMes('despesa', ['depreciacao', 'pessoal'], m));
  const folhaTotalMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].total, 0));
  const decimoTerceiroMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].decimoTerceiro, 0));
  const decimoTerceiroAnualTotal = decimoTerceiroMes.reduce((a, v) => a + v, 0);
  const pagamento13Mes = MESES.map((_, m) => (m === 10 || m === 11) ? decimoTerceiroAnualTotal / 2 : 0);
  const pessoalEmCaixaMes = MESES.map((_, m) => folhaTotalMes[m] - decimoTerceiroMes[m] + pagamento13Mes[m]);

  const cg = data.capitalGiro;
  const arMes = MESES.map((_, m) => receitaLiquidaMes[m] * (parseNum(cg.prazoRecebimento?.[m]) / 30));
  const apMes = MESES.map((_, m) => cpvSemPessoalMes[m] * (parseNum(cg.prazoPagamento?.[m]) / 30));
  const estoqueMes = MESES.map((_, m) => cpvSemPessoalMes[m] * (parseNum(cg.giroEstoque?.[m]) / 30));
  const { arInicial, apInicial, estoqueInicial } = saldosAberturaFc(data);

  // ARA Têxtil (única unidade com cg.premissasRecebimento — ver
  // emptyFormData): recebimentos vêm da cascata de aging real (Premissas
  // Têxtil.xlsx, aba Premissas Kgiro), não da aproximação genérica de
  // "prazo médio em dias". Pendência conhecida: isso quebra um pouco a
  // reconciliação exata com o método Indireto, que ainda usa a aproximação
  // genérica — ver aviso na tela de Revisão.
  let recebimentosClientesMes = MESES.map((_, m) => {
    const arAnt = m === 0 ? arInicial : arMes[m - 1];
    return receitaLiquidaMes[m] - (arMes[m] - arAnt);
  });
  if (cg.premissasRecebimento) {
    recebimentosClientesMes = computeRecebimentosKgiroMensal(data, dre).totalMes;
  }

  const pagamentosFornecedoresMes = MESES.map((_, m) => {
    const apAnt = m === 0 ? apInicial : apMes[m - 1];
    const estAnt = m === 0 ? estoqueInicial : estoqueMes[m - 1];
    return cpvSemPessoalMes[m] + (estoqueMes[m] - estAnt) - (apMes[m] - apAnt);
  });
  const pagamentosDespesasMes = despesasSemPessoalMes;
  const ircslMes = MESES.map(() => dre.ircsl / 12);

  // "Deixe a opção de incluir manualmente algum pagamento" (pedido de
  // 2026-08-16) — plano de contas fixo (ver PLANO_CONTAS_PAGAMENTOS_TEXTIL,
  // confirmado pelo usuário por print), somado às saídas do FC Direto sem
  // duplicar o que já vem de Custos e Despesas.
  const pagamentosManuaisMes = computePagamentosManuaisMes(cg.pagamentosManuais);

  const fcOperacionalDiretoMes = MESES.map((_, m) =>
    recebimentosClientesMes[m] - pagamentosFornecedoresMes[m] - pessoalEmCaixaMes[m] - pagamentosDespesasMes[m] - ircslMes[m] - pagamentosManuaisMes[m]
  );

  return {
    recebimentosClientesMes, pagamentosFornecedoresMes, pessoalEmCaixaMes, pagamentosDespesasMes, ircslMes, pagamentosManuaisMes,
    fcOperacionalDiretoMes,
  };
}



// ---------------------------------------------------------------------------
// Análise de Sensibilidades — modelo simplificado, sobre os totais anuais já
// calculados (não re-executa o motor mensal completo). Cenário Base é sempre
// o orçamento tal como está (todos os deltas = 0); Otimista e Pessimista são
// premissas do usuário — nenhum valor é pré-preenchido por mim.
// Metodologia de referência não encontrada no histórico do projeto (o pedido
// citava uma "matriz PAAI" que não localizei); usei uma abordagem padrão de
// FP&A (deltas percentuais/dias sobre as principais linhas), deixada explícita
// na tela.
// ---------------------------------------------------------------------------
const VARIAVEIS_SENSIBILIDADE = [
  { campo: 'deltaVolume', label: 'Volume', sufixo: '%' },
  { campo: 'deltaPreco', label: 'Preço médio', sufixo: '%' },
  { campo: 'deltaCustos', label: 'Custos (CPV)', sufixo: '%' },
  { campo: 'deltaDespesas', label: 'Despesas operacionais', sufixo: '%' },
  { campo: 'deltaHeadcount', label: 'Headcount', sufixo: '%' },
  { campo: 'deltaCapex', label: 'CAPEX', sufixo: '%' },
  { campo: 'deltaPMR', label: 'PMR — prazo médio de recebimento', sufixo: 'dias' },
  { campo: 'deltaPMP', label: 'PMP — prazo médio de pagamento', sufixo: 'dias' },
  { campo: 'deltaEstoque', label: 'Estoques (giro)', sufixo: 'dias' },
  { campo: 'deltaTaxas', label: 'Taxas e índices de reajuste (financeiro)', sufixo: '%' },
];

function novoCenarioSensibilidadeVazio() {
  const c = {};
  VARIAVEIS_SENSIBILIDADE.forEach(v => { c[v.campo] = ''; });
  c.justificativa = '';
  return c;
}

function computeSensibilidade(dados, dre, ajustes) {
  const fV = 1 + parseNum(ajustes.deltaVolume) / 100;
  const fP = 1 + parseNum(ajustes.deltaPreco) / 100;
  const fC = 1 + parseNum(ajustes.deltaCustos) / 100;
  const fD = 1 + parseNum(ajustes.deltaDespesas) / 100;
  const fH = 1 + parseNum(ajustes.deltaHeadcount) / 100;
  const fCapex = 1 + parseNum(ajustes.deltaCapex) / 100;
  const fTaxas = 1 + parseNum(ajustes.deltaTaxas) / 100;

  const receita = dre.receitaLiquida * fV * fP;
  const cpv = dre.cpv * fV * fC;
  const lucroBruto = receita - cpv;
  const despesas = dre.despesasSemDA * fD * fH;
  const ebitda = lucroBruto - despesas;
  const margemEbitda = receita ? (ebitda / receita) * 100 : 0;
  const resultadoFinanceiro = dre.resultadoFinanceiro * fTaxas;
  const ebt = ebitda - dre.depreciacao + resultadoFinanceiro + dre.outras;
  const aliquotaEfetiva = dre.ebt > 0 ? (dre.ircsl / dre.ebt) : 0;
  const ircsl = ebt > 0 ? ebt * aliquotaEfetiva : 0;
  const lucroLiquido = ebt - ircsl;
  const margemLiquida = receita ? (lucroLiquido / receita) * 100 : 0;

  const capex = dre.capexTotal * fCapex;

  const cg = dados.capitalGiro || {};
  const mediaPrazo = arr => (arr || []).reduce((a, v) => a + parseNum(v), 0) / 12;
  const prazoRecebimento = mediaPrazo(cg.prazoRecebimento) + parseNum(ajustes.deltaPMR);
  const prazoPagamento = mediaPrazo(cg.prazoPagamento) + parseNum(ajustes.deltaPMP);
  const giroEstoque = mediaPrazo(cg.giroEstoque) + parseNum(ajustes.deltaEstoque);
  const capitalGiroLiquido = receita * (prazoRecebimento / 365) + cpv * (giroEstoque / 365) - cpv * (prazoPagamento / 365);

  const prazoRecebimentoAtual = mediaPrazo(cg.prazoRecebimento);
  const prazoPagamentoAtual = mediaPrazo(cg.prazoPagamento);
  const giroEstoqueAtual = mediaPrazo(cg.giroEstoque);
  const capitalGiroAtual = dre.receitaLiquida * (prazoRecebimentoAtual / 365) + dre.cpv * (giroEstoqueAtual / 365) - dre.cpv * (prazoPagamentoAtual / 365);
  const variacaoGiro = -(capitalGiroLiquido - capitalGiroAtual);

  const fco = ebitda - ircsl + variacaoGiro;
  const fcl = fco - capex;
  const caixaInicial = parseNum(dados.balanco?.caixaInicial);
  const caixaProjetado = caixaInicial + fcl;
  const necessidadeCaixa = caixaProjetado < 0 ? -caixaProjetado : 0;

  return { receita, cpv, lucroBruto, despesas, ebitda, margemEbitda, resultadoFinanceiro, ebt, ircsl, lucroLiquido, margemLiquida, capex, capitalGiroLiquido, variacaoGiro, fco, fcl, caixaProjetado, necessidadeCaixa };
}

const ANOS_PLANO_5Y = [2028, 2029, 2030, 2031];

function computePlano5Y(dre, anos) {
  let receitaAnt = dre.receitaLiquida, cpvAnt = dre.cpv, despAnt = dre.despesasSemDA;
  const resultado = {
    2027: { receitaLiquida: dre.receitaLiquida, cpv: dre.cpv, lucroBruto: dre.lucroBruto, despesasSemDA: dre.despesasSemDA, ebitda: dre.ebitda, depreciacao: dre.depreciacao, lucroLiquido: dre.lucroLiquido },
  };
  ANOS_PLANO_5Y.forEach(ano => {
    const p = anos[ano] || {};
    const gReceita = 1 + parseNum(p.crescimentoReceita) / 100;
    const gCustos = 1 + parseNum(p.inflacaoCustos) / 100;
    const gDespesas = 1 + parseNum(p.inflacaoDespesas) / 100;
    const receita = receitaAnt * gReceita;
    const cpv = cpvAnt * gReceita * gCustos;
    const despesasSemDA = despAnt * gDespesas;
    const lucroBruto = receita - cpv;
    const ebitda = lucroBruto - despesasSemDA;
    const depreciacao = parseNum(p.depreciacaoAnual);
    const ebt = ebitda - depreciacao;
    const ircsl = ebt > 0 ? ebt * (parseNum(p.aliquotaIR) / 100) : 0;
    const lucroLiquido = ebt - ircsl;
    resultado[ano] = { receitaLiquida: receita, cpv, lucroBruto, despesasSemDA, ebitda, depreciacao, lucroLiquido };
    receitaAnt = receita; cpvAnt = cpv; despAnt = despesasSemDA;
  });
  return resultado;
}

// unidadeId opcional (default undefined = comportamento antigo, todas as
// checagens) — usado pra excluir checagens estruturalmente inaplicáveis ao
// Corporativo (pedido de 2026-08-19: "os check de auditoria não
// funcionam... não precisa de pendências de estrutura"). Corporativo não
// tem Receita (unidade de back-office, ver aviso na aba 2) nem CC de
// produção (só 'despesa', ver CCS_CORPORATIVO) — as checagens de Receita e
// de CPV nunca teriam como passar ali, então em vez de aparecer
// permanentemente vermelhas (dando a impressão de "auditoria quebrada"),
// somem da lista pra essa unidade.
function runAuditoria(data, dre, ref, unidadeId) {
  const checks = [];
  const temReceita = unidadeId !== 'corporativo';
  const temCcProducao = ref.ccs.some(c => c.tipo === 'producao');

  if (temReceita) {
    if (data.receita.linhas) {
      const linhasReceitaValidas = Object.values(data.receita.linhas).filter(l => valorLinhaAnual(l, null, null) > 0);
      checks.push({
        label: 'Receita: ao menos uma linha (Hospedagem, A&B, etc.) com valor lançado',
        ok: linhasReceitaValidas.length > 0,
        detalhe: `${linhasReceitaValidas.length} de ${Object.keys(data.receita.linhas).length} linha(s) preenchida(s)`,
      });
    } else {
      const produtosValidos = (data.receita.produtos || []).filter(p => somaMes(p.volumes) > 0 && somaMes(p.precos) > 0);
      checks.push({
        label: 'Receita: ao menos um produto com volume e preço em algum mês',
        ok: produtosValidos.length > 0,
        detalhe: `${produtosValidos.length} de ${(data.receita.produtos || []).length} produto(s) preenchido(s)`,
      });
    }
  }

  const justContextoOk = !!(data.estrategicas?.contexto || '').trim();
  checks.push({
    label: 'Contexto estratégico do ciclo preenchido (campo obrigatório)',
    ok: justContextoOk,
    detalhe: justContextoOk ? 'Preenchido' : 'Pendente de preenchimento',
  });

  if (temReceita) {
    const justReceitaOk = !!(data.receita.justificativaGeral || '').trim();
    checks.push({
      label: 'Justificativa geral da receita preenchida (campo obrigatório)',
      ok: justReceitaOk,
      detalhe: justReceitaOk ? 'Preenchida' : 'Pendente de preenchimento',
    });

    const justDeducoesOk = !!(data.receita.deducoesJustificativa || '').trim();
    checks.push({
      label: 'Justificativa das deduções preenchida (campo obrigatório)',
      ok: justDeducoesOk,
      detalhe: justDeducoesOk ? 'Preenchida' : 'Pendente de preenchimento',
    });
  }

  const linhasCustos = Object.entries(data.custos.linhas || {});

  if (temCcProducao) {
    const linhasProducao = linhasCustos.filter(([chave]) => {
      const cc = ref.ccs.find(c => c.codigo === chave.split('|')[0]);
      return cc?.tipo === 'producao';
    }).filter(([, linha]) => valorLinhaAnual(linha, dre.receitaBrutaMes, dre.receitaLiquidaMes) > 0);
    checks.push({
      label: 'CPV: ao menos uma linha analítica lançada em CC de produção',
      ok: linhasProducao.length > 0,
      detalhe: `${linhasProducao.length} linha(s) analítica(s) com valor em CC de produção`,
    });
  }

  // Pedido de 2026-08-16: retirada do quadro de auditoria (não é mais nem
  // pendência informativa, nem bloqueio de envio).

  const linhasIncoerentes = linhasCustos.filter(([, linha]) => linhaIncoerente(linha));
  checks.push({
    label: 'Linhas Qtd × Valor unit. ou Rateio (base manual) sem campo incompleto',
    ok: linhasIncoerentes.length === 0,
    detalhe: linhasIncoerentes.length === 0 ? 'Nenhuma linha com apenas um dos dois campos preenchido' : `${linhasIncoerentes.length} linha(s) com quantidade/valor unit. ou base/percentual incompletos em algum mês`,
  });

  const linhasComValorSemJustificativa = linhasCustos.filter(([, linha]) =>
    valorLinhaAnual(linha, dre.receitaBrutaMes, dre.receitaLiquidaMes) > 0 && !(linha.justificativa || '').trim()
  );
  checks.push({
    label: 'Toda linha analítica com valor lançado tem justificativa preenchida',
    ok: linhasComValorSemJustificativa.length === 0,
    detalhe: linhasComValorSemJustificativa.length === 0 ? 'Justificativa preenchida em todas as linhas com valor' : `${linhasComValorSemJustificativa.length} linha(s) com valor e sem justificativa`,
  });

  const inadMensal = (data.provisoes.inadimplencia || []).map(parseNum);
  const inadForaFaixa = inadMensal.some(v => v < 0 || v > 100);
  checks.push({
    label: 'Inadimplência dentro da faixa 0% a 100% em todos os meses',
    ok: !inadForaFaixa,
    detalhe: inadForaFaixa ? 'Há mês com inadimplência fora da faixa' : 'Todos os meses dentro da faixa',
  });

  if (temReceita) {
    const somaDeducoesMensal = MESES.map((_, m) => (data.receita.deducoes || []).reduce((acc, d) => acc + parseNum(d.pcts?.[m]), 0));
    const deducaoForaFaixa = somaDeducoesMensal.some(v => v < 0 || v > 40);
    checks.push({
      label: 'Deduções sobre receita dentro de faixa plausível (0% a 40%) em todos os meses',
      ok: !deducaoForaFaixa,
      detalhe: deducaoForaFaixa ? 'Há mês com soma de deduções fora da faixa' : 'Todos os meses dentro da faixa',
    });
  }

  // Pedido de 2026-08-16: deixou de bloquear o envio — aparece como
  // pendência informativa na Auditoria, mas obrigatorio:false (mesmo padrão
  // do Balanço/FC Financiamentos abaixo).
  const cg = data.capitalGiro;
  const cgCompleto = ['prazoRecebimento', 'prazoPagamento', 'giroEstoque'].every(k => (cg[k] || []).some(v => v !== ''));
  checks.push({
    label: 'Capital de giro: três prazos com ao menos um mês preenchido (dias corridos)',
    ok: cgCompleto,
    detalhe: cgCompleto ? 'Recebimento, pagamento e giro de estoque informados' : 'Faltam prazos a preencher',
    obrigatorio: false,
  });

  const valoresNegativos = (data.receita.produtos || []).some(p => (p.volumes || []).some(v => parseNum(v) < 0) || (p.precos || []).some(v => parseNum(v) < 0))
    || Object.values(data.custos.linhas || {}).some(linha => linhaTemNegativo(linha));
  checks.push({
    label: 'Nenhum valor negativo em receita ou custos/despesas',
    ok: !valoresNegativos,
    detalhe: valoresNegativos ? 'Há valor negativo lançado — revisar' : 'Sem valores negativos',
  });

  // Pedido de 2026-08-09: a entrega de cada unidade se restringe ao DRE
  // (Receita, Custos e Despesas, Provisões, Kgiro e FC Operacional, CAPEX).
  // Balanço Patrimonial e FC Financiamentos são responsabilidade do FP&A,
  // não do gestor da unidade — por isso obrigatorio:false aqui: aparece como
  // pendência informativa na Auditoria, mas NÃO bloqueia o botão de Enviar
  // (ver tudoOk no componente principal, que filtra por obrigatorio !== false).
  // Corporativo (pedido de 2026-08-19, "não precisa de pendências de
  // estrutura"): nem aparece — some da lista, não só obrigatorio:false.
  if (unidadeId !== 'corporativo') {
    const bal = data.balanco;
    const balancoBaseOk = bal.caixaInicial !== '' && bal.imobilizadoInicial !== '';
    checks.push({
      label: 'Balanço Patrimonial: caixa e imobilizado iniciais informados',
      ok: balancoBaseOk,
      detalhe: balancoBaseOk ? 'Saldos de abertura informados' : 'Faltam saldos de abertura (caixa e/ou imobilizado) — responsabilidade do FP&A, não bloqueia envio',
      obrigatorio: false,
    });
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Componentes visuais utilitários
// ---------------------------------------------------------------------------

function CampoJustificativa({ value, onChange, placeholder, obrigatorio }) {
  const vazio = obrigatorio && !(value || '').trim();
  return (
    <div>
      <textarea
        value={value} placeholder={placeholder || 'Justificativa da premissa (por que este valor, o que mudou vs. 2026)'}
        onChange={e => onChange(e.target.value)} rows={2}
        style={{ width: '100%', border: `1.5px solid ${vazio ? COR.vermelho : COR.borda}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 12, color: COR.texto, boxSizing: 'border-box', resize: 'vertical' }}
      />
      {vazio && <div style={{ fontSize: 10, color: COR.vermelho, marginTop: 3 }}>Campo obrigatório — preencher antes do envio.</div>}
    </div>
  );
}

// Tabela mensal genérica: uma linha por item, 12 colunas de mês + total
// colunaExtra: { titulo, chave, sufixo } — coluna opcional entre a
// descrição e Jan (ex.: % de premissa da cascata de Kgiro, ou o saldo de
// partida Dez/25 do Balanço). Cada linha (de `linhas` ou `linhasCalculadas`)
// carrega opcionalmente `[chave]: { valor, onChange, placeholder }`; quando
// ausente, a célula mostra um traço.
function TabelaMensal({ linhas, onChangeCelula, corTotal, sufixo, formatarTotal, linhasCalculadas, colunaExtra }) {
  function celulaExtra(linha, i) {
    const dado = colunaExtra && linha[colunaExtra.chave];
    return (
      <td style={{ padding: 3, border: `1px solid ${COR.borda}`, background: i % 2 ? COR.claro : COR.branco }}>
        {dado ? (
          <input
            type="text" inputMode="decimal" value={dado.valor} placeholder={dado.placeholder}
            onChange={e => dado.onChange(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', padding: '5px 4px', fontFamily: FONT, fontSize: 11, color: COR.laranja, fontWeight: 700, background: 'transparent', boxSizing: 'border-box', textAlign: 'right' }}
          />
        ) : (
          <div style={{ textAlign: 'right', padding: '5px 4px', color: '#C7CBD1', fontSize: 11 }}>—</div>
        )}
      </td>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', textAlign: 'left', minWidth: 150, position: 'sticky', left: 0 }}>Linha</th>
            {colunaExtra && (
              <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '7px 6px', minWidth: 70 }}>{colunaExtra.titulo}</th>
            )}
            {MESES.map(m => (
              <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '7px 4px', minWidth: 62 }}>{m}</th>
            ))}
            <th style={{ background: COR.laranja, color: COR.branco, fontSize: 10.5, padding: '7px 8px', minWidth: 90 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => {
            const total = somaMes(linha.valores);
            return (
              <tr key={linha.key} style={{ background: i % 2 ? COR.claro : COR.branco }}>
                <td style={{ fontWeight: 700, fontSize: 11.5, padding: '6px 10px', border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: i % 2 ? COR.claro : COR.branco }}>{linha.label}</td>
                {colunaExtra && celulaExtra(linha, i)}
                {MESES.map((m, mi) => (
                  <td key={m} style={{ padding: 3, border: `1px solid ${COR.borda}` }}>
                    <input
                      type="text" inputMode="decimal" value={linha.valores[mi]}
                      onChange={e => onChangeCelula(linha.key, mi, e.target.value)}
                      style={{ width: '100%', border: 'none', outline: 'none', padding: '5px 4px', fontFamily: FONT, fontSize: 11, color: COR.texto, background: 'transparent', boxSizing: 'border-box', textAlign: 'right' }}
                    />
                  </td>
                ))}
                <td style={{ padding: '6px 8px', border: `1px solid ${COR.borda}`, fontWeight: 700, fontSize: 11, color: corTotal || COR.azul, textAlign: 'right' }}>
                  {formatarTotal ? formatarTotal(total) : `${total.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${sufixo || ''}`}
                </td>
              </tr>
            );
          })}
          {(linhasCalculadas || []).map(linha => (
            <tr key={linha.key} style={{ background: COR.branco }}>
              <td style={{ fontWeight: 700, fontSize: 11.5, padding: '6px 10px', border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: COR.branco, color: linha.cor || COR.azul }}>{linha.label}</td>
              {colunaExtra && celulaExtra(linha, 0)}
              {linha.valoresMensal.map((v, mi) => (
                <td key={mi} style={{ padding: '6px 6px', border: `1px solid ${COR.borda}`, fontSize: 10.5, textAlign: 'right', color: linha.cor || COR.texto, fontWeight: 700 }}>
                  {(linha.formatarCelula || formatBRL)(v)}
                </td>
              ))}
              <td style={{ padding: '6px 8px', border: `1px solid ${COR.borda}`, fontWeight: 700, fontSize: 11, color: linha.cor || COR.azul, textAlign: 'right' }}>
                {(linha.formatarTotal || formatBRL)(linha.totalValor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rotulo({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: COR.texto, marginBottom: 4 }}>{children}</div>;
}

function CampoNumero({ value, onChange, placeholder, prefixo, sufixo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${COR.borda}`, borderRadius: 6, background: COR.branco }}>
      {prefixo && <span style={{ padding: '0 8px', color: '#8A8F96', fontSize: 12 }}>{prefixo}</span>}
      <input
        type="text" inputMode="decimal" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 10px', fontFamily: FONT, fontSize: 13, color: COR.texto, background: 'transparent', minWidth: 0 }}
      />
      {sufixo && <span style={{ padding: '0 8px', color: '#8A8F96', fontSize: 12 }}>{sufixo}</span>}
    </div>
  );
}

function CampoTexto({ value, onChange, placeholder }) {
  return (
    <input
      type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', border: `1px solid ${COR.borda}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 13, color: COR.texto, boxSizing: 'border-box' }}
    />
  );
}

function Selecao({ value, onChange, opcoes }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', border: `1px solid ${COR.borda}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 13, color: COR.texto, background: COR.branco }}
    >
      <option value="">Selecionar</option>
      {opcoes.map(o => <option key={o.id || o} value={o.id || o}>{o.nome || o}</option>)}
    </select>
  );
}

function Botao({ children, onClick, variante = 'primario', icone: Icone, disabled }) {
  const estilos = {
    primario: { background: disabled ? '#9AAFCF' : COR.azul, color: COR.branco, border: 'none' },
    laranja: { background: disabled ? '#F7D9A0' : COR.laranja, color: COR.branco, border: 'none' },
    secundario: { background: COR.branco, color: COR.azul, border: `1px solid ${COR.azul}` },
    fantasma: { background: 'transparent', color: COR.texto, border: `1px solid ${COR.borda}` },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...estilos[variante], fontFamily: FONT, fontSize: 13, fontWeight: 700, padding: '9px 16px',
        borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex',
        alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
      }}
    >
      {Icone && <Icone size={15} />}
      {children}
    </button>
  );
}

function CardTotal({ label, valor, cor }) {
  return (
    <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: '12px 16px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COR.texto, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: cor || COR.azul, marginTop: 2 }}>{formatBRL(valor)}</div>
    </div>
  );
}

// Medidor semicircular — mesmo padrão visual do painel_executivo_ara_v2
function formatBRLCompacto(v) {
  const abs = Math.abs(v);
  const sinal = v < 0 ? '-' : '';
  if (abs >= 1000000) return `${sinal}${(abs / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mi`;
  if (abs >= 1000) return `${sinal}${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}mil`;
  return formatBRL(v);
}

// Gráfico Bridge/Waterfall — etapas: [{ label, valor, tipo: 'inicio'|'incremento'|'total' }]
// 'inicio'/'total' desenham a barra cheia do zero; os demais flutuam a partir do acumulado anterior.
function GraficoBridge({ etapas }) {
  const W = 560, H = 230, padL = 8, padR = 8, padT = 26, padB = 44;
  let acumulado = 0;
  const barras = etapas.map(e => {
    let y0, y1;
    if (e.tipo === 'inicio' || e.tipo === 'total') { y0 = 0; y1 = e.valor; acumulado = e.valor; }
    else { y0 = acumulado; y1 = acumulado + e.valor; acumulado = y1; }
    return { ...e, y0, y1 };
  });
  const todosValores = barras.flatMap(b => [b.y0, b.y1]);
  const maxVal = Math.max(...todosValores, 0);
  const minVal = Math.min(...todosValores, 0);
  const range = (maxVal - minVal) || 1;
  const altura = H - padT - padB;
  const yPos = v => padT + altura * (1 - (v - minVal) / range);
  const passo = (W - padL - padR) / etapas.length;
  const largura = passo * 0.56;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 560 }}>
      <line x1={padL} x2={W - padR} y1={yPos(0)} y2={yPos(0)} stroke={COR.borda} strokeWidth="1" />
      {barras.slice(0, -1).map((b, i) => {
        const xEnd = padL + i * passo + (passo - largura) / 2 + largura;
        const xStart2 = padL + (i + 1) * passo + (passo - largura) / 2;
        const y = yPos(b.y1);
        return <line key={`l${i}`} x1={xEnd} x2={xStart2} y1={y} y2={y} stroke={COR.borda} strokeDasharray="2,2" />;
      })}
      {barras.map((b, i) => {
        const x = padL + i * passo + (passo - largura) / 2;
        const yTop = yPos(Math.max(b.y0, b.y1));
        const yBot = yPos(Math.min(b.y0, b.y1));
        const cor = (b.tipo === 'inicio' || b.tipo === 'total') ? COR.azul : (b.valor >= 0 ? COR.verde : COR.vermelho);
        return (
          <g key={i}>
            <rect x={x} y={yTop} width={largura} height={Math.max(2, yBot - yTop)} fill={cor} rx="3" />
            <text x={x + largura / 2} y={yTop - 6} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={COR.texto} fontFamily={FONT}>
              {b.valor >= 0 && b.tipo !== 'inicio' && b.tipo !== 'total' ? '+' : ''}{formatBRLCompacto(b.valor)}
            </text>
            <text x={x + largura / 2} y={H - padB + 15} textAnchor="middle" fontSize="9" fill={COR.texto} fontFamily={FONT}>
              <tspan>{b.label}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Gauge({ pct, label, sub, cor }) {
  const W = 150, H = 92, cx = W / 2, cy = 80, R = 58;
  const max = Math.max(30, Math.abs(pct) + 8);
  const pol = (deg, rr = R) => [cx + rr * Math.cos((deg * Math.PI) / 180), cy - rr * Math.sin((deg * Math.PI) / 180)];
  const arc = (a, b) => {
    const pts = []; const n = 40;
    for (let i = 0; i <= n; i++) { const d = a + (b - a) * (i / n); const [x, y] = pol(d); pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
    return pts.join(' ');
  };
  const valAng = 180 - (Math.min(Math.max(pct, 0), max) / max) * 180;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 150 }}>
        <polyline points={arc(180, 0)} fill="none" stroke="#E9E9E9" strokeWidth="11" strokeLinecap="round" />
        <polyline points={arc(180, valAng)} fill="none" stroke={cor} strokeWidth="11" strokeLinecap="round" />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize="18" fontWeight="700" fill={COR.texto} fontFamily={FONT}>{formatPct(pct)}</text>
      </svg>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.texto, marginTop: -4 }}>{label}</div>
      {sub && <div style={{ fontSize: 9.5, color: '#8A8F96' }}>{sub}</div>}
    </div>
  );
}

function formatDataCurta(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR');
}

function GanttEtapas({ etapas, onChangeEtapa }) {
  const datasValidas = etapas.flatMap(e => [e.inicio, e.fim]).filter(Boolean).map(s => new Date(s + 'T00:00:00'));
  const minData = datasValidas.length ? new Date(Math.min(...datasValidas)) : new Date();
  const maxData = datasValidas.length ? new Date(Math.max(...datasValidas)) : new Date();
  const totalDias = Math.max(1, (maxData - minData) / 86400000);

  function pos(iso) {
    if (!iso) return 0;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return 0;
    return Math.min(100, Math.max(0, ((d - minData) / 86400000 / totalDias) * 100));
  }
  function largura(inicio, fim) {
    if (!inicio || !fim) return 0;
    const di = new Date(inicio + 'T00:00:00'), df = new Date(fim + 'T00:00:00');
    if (isNaN(di) || isNaN(df)) return 0;
    return Math.max(1.5, ((df - di) / 86400000 / totalDias) * 100);
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 12 }}>
        Período do cronograma: {formatDataCurta(etapas[0]?.inicio)} a {formatDataCurta(etapas[etapas.length - 1]?.fim)}.
        Datas propostas — ajustáveis abaixo, conforme alinhamento com a Diretoria.
      </p>
      {etapas.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 220, flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: COR.texto }}>{e.nome}</div>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160, height: 20, background: COR.claro, borderRadius: 4 }}>
            <div style={{
              position: 'absolute', left: `${pos(e.inicio)}%`, width: `${largura(e.inicio, e.fim)}%`,
              height: '100%', background: COR.azul, borderRadius: 4,
            }} title={`${formatDataCurta(e.inicio)} — ${formatDataCurta(e.fim)}`} />
          </div>
          <input
            type="date" value={e.inicio} onChange={ev => onChangeEtapa(e.id, 'inicio', ev.target.value)}
            style={{ fontFamily: FONT, fontSize: 10.5, color: COR.texto, border: `1px solid ${COR.borda}`, borderRadius: 4, padding: '3px 4px', width: 122 }}
          />
          <input
            type="date" value={e.fim} onChange={ev => onChangeEtapa(e.id, 'fim', ev.target.value)}
            style={{ fontFamily: FONT, fontSize: 10.5, color: COR.texto, border: `1px solid ${COR.borda}`, borderRadius: 4, padding: '3px 4px', width: 122 }}
          />
        </div>
      ))}
    </div>
  );
}

function PainelAuditoria({ checks }) {
  return (
    <div style={{ background: COR.claro, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <ShieldCheck size={16} color={COR.azul} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul }}>Auditoria — checagens de integridade</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5 }}>
            {c.ok
              ? <CheckCircle2 size={15} color={COR.verde} style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertTriangle size={15} color={COR.vermelho} style={{ flexShrink: 0, marginTop: 1 }} />}
            <div>
              <div style={{ color: COR.texto, fontWeight: 600 }}>{c.label}</div>
              <div style={{ color: '#7A8088' }}>{c.detalhe}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PainelPendencias() {
  const itens = [
    'Granularidade do CC: usando nível de área (8 CCs). Confirmar se deve descer ao nível de subárea.',
    'Classificação Custo × Despesa por CC é proposta — validar com a Controladoria.',
    'De-para de contas e Pacotes (11, ARA Têxtil) atualizado com a fonte oficial Matriz_Governanca_OBZ_2027_4 — 167 contas, 100% classificadas.',
    'CC Logística aparece bloqueado no Protheus — confirmar se está ativo para o ciclo 2027.',
    'CC Investimentos não entra nesta matriz — direcionado à aba de CAPEX.',
    'Despesas Financeiras: por decisão do FP&A, seguem fora da matriz de pacotes — tratadas somente na aba FC Financiamentos.',
  ];
  return (
    <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Info size={16} color={COR.laranja} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul }}>Pendências de estrutura</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {itens.map((t, i) => (
          <div key={i} style={{ fontSize: 11, color: COR.texto, display: 'flex', gap: 6 }}>
            <span style={{ color: COR.laranja }}>•</span><span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plano de Contas — de-para conta contábil × pacote (referência, somente leitura)
// ---------------------------------------------------------------------------

function PainelPlanoContas({ refUnidade }) {
  const [aberto, setAberto] = useState(false);
  const totalContas = Object.values(refUnidade.planoContas).reduce((a, l) => a + l.length, 0);

  return (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden', marginTop: 22 }}>
      <button
        onClick={() => setAberto(!aberto)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: COR.claro, border: 'none', cursor: 'pointer',
          fontFamily: FONT, fontSize: 13, fontWeight: 700, color: COR.azul,
        }}
      >
        <span>Plano de Contas — de-para conta × pacote ({totalContas} contas, referência)</span>
        {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {aberto && (
        <div style={{ padding: 14, maxHeight: 480, overflowY: 'auto' }}>
          <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 12 }}>
            Fonte: Matriz_Governanca_OBZ_2027_4.xlsx — {totalContas} contas classificadas em {refUnidade.pacotes.length} pacotes.
            Este painel é somente leitura — o lançamento acontece por conta, dentro do CC selecionado na aba acima.
          </p>
          {refUnidade.pacotes.map(p => {
            const contas = refUnidade.planoContas[p.id] || [];
            if (contas.length === 0) return null;
            return (
              <div key={p.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>
                  {p.nome} <span style={{ fontWeight: 400, color: '#8A8F96' }}>({contas.length} contas)</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {contas.map(c => (
                    <span key={c.origem + c.codigo} title={c.codigo}
                      style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 10,
                        background: c.origem === 'Custo' ? '#E8F0FA' : COR.total,
                        color: COR.texto, border: `1px solid ${COR.borda}`,
                      }}>
                      {c.nome.toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function OrcamentoARA({ usuario }) {
  // Antes: role era um toggle livre, qualquer um virava "FP&A" na interface.
  // Agora: deriva do perfil real da sessão (seção 2 da especificação).
  // - admin_fpa: pode alternar entre as duas visões (drill numa unidade ou
  //   consolidado do Grupo) — por isso ainda precisa de um estado próprio.
  // - gerente_unidade / gerente_cc_corporativo: sempre 'gerente', sem opção
  //   de ver o consolidado (matriz da seção 2.4: "Consolidar informações —
  //   Sim admin_fpa / Não os demais"). O botão de alternar nem aparece.
  const podeAlternarParaFpa = usuario.perfil === 'admin_fpa';
  const [role, setRole] = useState(podeAlternarParaFpa ? 'fpa' : 'gerente');

  // Unidades que este usuário pode ver/editar. admin_fpa vê todas; os demais
  // só as suas (usuario.unidadesPermitidas, vindo de /auth/me). Isto é só
  // UX — a proteção de verdade é no backend (exigirUnidade em toda rota),
  // então nem uma manipulação do estado aqui abriria acesso real.
  // Gestor de CC (rebatizado de "Gerente de CC — Corporativo" em
  // 2026-08-16) agora pode estar vinculado a qualquer unidade, não só
  // Corporativo — usa a mesma unidadesPermitidas dos demais perfis. Só vê o
  // painel/formulário inteiro da unidade (a granularidade por CC dentro
  // dela ainda não existe na interface — ver nota em VisaoGerente); a
  // proteção real por CC específico é a de podeAcessarCc no backend, que
  // ainda não tem rota de orçamento por CC para aplicar de verdade.
  const unidadesVisiveis = podeAlternarParaFpa
    ? UNIDADES
    : UNIDADES.filter(u => usuario.unidadesPermitidas.includes(u.id));

  const [unidadeAtual, setUnidadeAtual] = useState(unidadesVisiveis[0]?.id || UNIDADES[0].id);
  // Gestor de CC (pedido de 2026-08-16): "acesso apenas à seção Custos e
  // Despesas [...] a visão completa das seções é só do Gestor da Unidade e
  // do Admin". Trava a aba inicial em 'custos' — a barra de abas abaixo
  // (VisaoGerente) já nem mostra as outras pra este perfil, então não tem
  // como setAba sair daqui através da UI.
  const [aba, setAba] = useState(usuario.perfil === 'gerente_cc_corporativo' ? 'custos' : 'estrategicas');
  const [dados, setDados] = useState(emptyFormData());
  const [versoes, setVersoes] = useState([]);
  const [statusUnidades, setStatusUnidades] = useState({});
  const [aguardandoLiberacaoPorUnidade, setAguardandoLiberacaoPorUnidade] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [comentarioEnvio, setComentarioEnvio] = useState('');
  // Antes era um campo livre (sem autenticação real, qualquer nome servia).
  // Agora pré-preenche com o nome da sessão — o backend já usa req.usuario.id
  // como autor de verdade em registrarEnvio (db/orcamentos.js), este campo é
  // só exibição/comentário, não é o que decide quem é o autor no banco.
  const [autorNome, setAutorNome] = useState(usuario.nome);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  // "Abrir a versão enviada e salva" (pedido de 2026-08-17) — modal de
  // leitura por cima de tudo, não mexe no `dados` que está sendo editado.
  const [versaoAberta, setVersaoAberta] = useState(null); // { unidadeId, versaoId } | null
  function abrirVersao(unidadeId, versaoId) { setVersaoAberta({ unidadeId, versaoId }); }
  const [backlog, setBacklog] = useState([]);
  const [unidadeDrill, setUnidadeDrill] = useState(null);
  const [versoesDrill, setVersoesDrill] = useState([]);
  const [statusPptx, setStatusPptx] = useState(null); // { mensagem, erro? }
  const [etapasProcesso, setEtapasProcesso] = useState(ETAPAS_PROCESSO_PADRAO);
  const [premissasMacro, setPremissasMacro] = useState(PREMISSAS_MACRO_REF.map(p => ({ id: p.id, nome: p.nome, unidade: p.unidade, valor: '', fonte: null, atualizadoEm: null })));
  const [buscandoFocus, setBuscandoFocus] = useState(false);
  const [erroFocus, setErroFocus] = useState(null);

  const unidadeObj = UNIDADES.find(u => u.id === unidadeAtual);

  // Pedido de 2026-08-16: "travar novo envio até FP&A liberar" — vem do
  // banco (orcamentos.aguardando_liberacao), separado de dados.meta.status
  // (que fica dentro do JSONB e o gestor controla).
  const [aguardandoLiberacao, setAguardandoLiberacao] = useState(false);

  const carregarUnidade = useCallback(async (idUnidade) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await getOrcamento(idUnidade);
      setDados(r.orcamento.dados);
      setAguardandoLiberacao(r.orcamento.aguardando_liberacao || false);
    } catch (e) {
      setDados(emptyFormData());
      setAguardandoLiberacao(false);
    }
    try {
      setVersoes(await listarVersoes(idUnidade));
    } catch (e) {
      setVersoes([]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { if (role === 'gerente') carregarUnidade(unidadeAtual); }, [role, unidadeAtual, carregarUnidade]);

  const carregarFPA = useCallback(async () => {
    setCarregando(true);
    const mapa = {};
    const mapaAguardando = {};
    for (const u of UNIDADES) {
      try {
        const r = await getOrcamento(u.id);
        mapa[u.id] = r.orcamento.dados;
        mapaAguardando[u.id] = r.orcamento.aguardando_liberacao || false;
      } catch (e) {
        mapa[u.id] = emptyFormData();
        mapaAguardando[u.id] = false;
      }
    }
    setStatusUnidades(mapa);
    setAguardandoLiberacaoPorUnidade(mapaAguardando);
    // backlog/etapas: ver legacyStorage.js — pendência real, não sincroniza
    // entre usuários ainda (não têm tabela no schema da especificação).
    try {
      const rb = await legacyStorage.get('ara-orc:backlog');
      setBacklog(rb ? JSON.parse(rb.value) : []);
    } catch (e) {
      setBacklog([]);
    }
    try {
      const re = await legacyStorage.get('ara-orc:etapas');
      setEtapasProcesso(re ? JSON.parse(re.value) : ETAPAS_PROCESSO_PADRAO);
    } catch (e) {
      setEtapasProcesso(ETAPAS_PROCESSO_PADRAO);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { if (role === 'fpa') carregarFPA(); }, [role, carregarFPA]);

  useEffect(() => {
    (async () => {
      try {
        const r = await legacyStorage.get('ara-orc:premissas-macro');
        if (r) setPremissasMacro(JSON.parse(r.value));
      } catch (e) {
        // mantém os valores padrão (vazios) se ainda não houver nada salvo
      }
    })();
  }, []);

  async function updatePremissaMacroGlobal(id, valor) {
    const novas = premissasMacro.map(p => p.id === id ? { ...p, valor, fonte: 'Manual', atualizadoEm: new Date().toISOString() } : p);
    setPremissasMacro(novas);
    try {
      await legacyStorage.set('ara-orc:premissas-macro', JSON.stringify(novas));
    } catch (e) {
      // silencioso — próxima gravação tenta novamente
    }
  }

  // Busca as expectativas anuais mais recentes do Boletim Focus (BCB, API Olinda/Expectativas —
  // dados públicos). Só atualiza IPCA, Câmbio, Selic e PIB, que têm indicador direto no Focus;
  // "Reajuste salarial/dissídio" não é coberto pelo Focus e continua manual.
  async function buscarBoletimFocus() {
    setBuscandoFocus(true);
    setErroFocus(null);
    const anoRef = new Date().getFullYear() + 1;
    const mapaIndicadores = { ipca: 'IPCA', cambio: 'Câmbio', selic: 'Selic', pib: 'PIB Total' };
    try {
      const atualizadas = [...premissasMacro];
      for (const [id, indicador] of Object.entries(mapaIndicadores)) {
        const url = `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=1&$filter=Indicador eq '${indicador}' and Data eq '${anoRef}' and baseCalculo eq 0&$orderby=Data desc&$format=json`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Falha ao consultar ${indicador} (HTTP ${resp.status})`);
        const json = await resp.json();
        const registro = json?.value?.[0];
        if (registro) {
          const idx = atualizadas.findIndex(p => p.id === id);
          if (idx >= 0) {
            atualizadas[idx] = { ...atualizadas[idx], valor: String(registro.Mediana ?? registro.Media ?? ''), fonte: 'Boletim Focus (BCB)', atualizadoEm: new Date().toISOString() };
          }
        }
      }
      setPremissasMacro(atualizadas);
      try {
        await legacyStorage.set('ara-orc:premissas-macro', JSON.stringify(atualizadas));
      } catch (e) {
        // silencioso
      }
    } catch (e) {
      setErroFocus('Não foi possível conectar ao Boletim Focus a partir deste ambiente. Atualize os valores manualmente ou tente novamente com o arquivo aberto diretamente no navegador (fora do Claude.ai).');
    }
    setBuscandoFocus(false);
  }

  useEffect(() => {
    if (role !== 'gerente' || carregando) return;
    // Agrícola/Resorts/Corporativo: painel de referência, sem escrita — o
    // backend rejeitaria (409) mesmo se tentássemos, então nem tentamos.
    if (!UNIDADES_COM_LANCAMENTO_HABILITADO.includes(unidadeAtual)) return;
    const t = setTimeout(async () => {
      try {
        const status = dados.meta?.status === 'enviado' ? 'enviado' : 'em_preenchimento';
        await putOrcamento(unidadeAtual, { ...dados, meta: { ...dados.meta, status, atualizadoEm: new Date().toISOString() } });
        setUltimoSalvoEm(new Date());
      } catch (e) {
        setErro('Não foi possível salvar o rascunho automaticamente. Verifique a conexão.');
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, unidadeAtual, role, carregando]);

  // Botão explícito de "Salvar rascunho" — o autosave acima já salva sozinho
  // (debounced, 900ms depois da última mudança), mas alguns usuários querem
  // a confirmação visual de "salvei agora" em vez de confiar no automático.
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [ultimoSalvoEm, setUltimoSalvoEm] = useState(null);
  async function salvarRascunhoAgora() {
    setSalvandoRascunho(true);
    setErro(null);
    try {
      const status = dados.meta?.status === 'enviado' ? 'enviado' : 'em_preenchimento';
      await putOrcamento(unidadeAtual, { ...dados, meta: { ...dados.meta, status, atualizadoEm: new Date().toISOString() } });
      setUltimoSalvoEm(new Date());
    } catch (e) {
      setErro('Não foi possível salvar o rascunho. Verifique a conexão.');
    }
    setSalvandoRascunho(false);
  }

  const refUnidadeAtual = referenciaDaUnidade(unidadeAtual);
  const dre = useMemo(() => computeDRE(dados, refUnidadeAtual), [dados, refUnidadeAtual]);
  const checks = useMemo(() => runAuditoria(dados, dre, refUnidadeAtual, unidadeAtual), [dados, dre, refUnidadeAtual, unidadeAtual]);
  // Só checks obrigatorio !== false bloqueiam o envio — Balanço Patrimonial
  // é responsabilidade do FP&A, aparece na auditoria mas não trava o gestor.
  const tudoOk = checks.filter(c => c.obrigatorio !== false).every(c => c.ok);

  function atualizar(caminho, valor) {
    setDados(prev => {
      const novo = { ...prev };
      let ref = novo;
      for (let i = 0; i < caminho.length - 1; i++) {
        ref[caminho[i]] = Array.isArray(ref[caminho[i]]) ? [...ref[caminho[i]]] : { ...ref[caminho[i]] };
        ref = ref[caminho[i]];
      }
      ref[caminho[caminho.length - 1]] = valor;
      return novo;
    });
  }

  function updateProduto(id, campo, valor) {
    atualizar(['receita', 'produtos'], dados.receita.produtos.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  }
  function updateDeducao(id, valor) {
    atualizar(['receita', 'deducoes'], dados.receita.deducoes.map(d => d.id === id ? { ...d, pcts: valor } : d));
  }

  function addObjetivo() {
    atualizar(['estrategicas', 'objetivos'], [...dados.estrategicas.objetivos, { id: uid(), objetivo: '', indicador: '', meta: '' }]);
  }
  function updateObjetivo(id, campo, valor) {
    atualizar(['estrategicas', 'objetivos'], dados.estrategicas.objetivos.map(o => o.id === id ? { ...o, [campo]: valor } : o));
  }
  function removeObjetivo(id) {
    atualizar(['estrategicas', 'objetivos'], dados.estrategicas.objetivos.filter(o => o.id !== id));
  }
  function addIniciativa() {
    atualizar(['estrategicas', 'iniciativas'], [...dados.estrategicas.iniciativas, { id: uid(), nome: '', descricao: '', investimentoAssociado: '', prioridade: 'Média' }]);
  }
  function updateIniciativa(id, campo, valor) {
    atualizar(['estrategicas', 'iniciativas'], dados.estrategicas.iniciativas.map(i => i.id === id ? { ...i, [campo]: valor } : i));
  }
  function removeIniciativa(id) {
    atualizar(['estrategicas', 'iniciativas'], dados.estrategicas.iniciativas.filter(i => i.id !== id));
  }

  function updateLinha(chave, campo, valor) {
    const atual = dados.custos.linhas[chave] || novaLinhaVazia();
    atualizar(['custos', 'linhas'], { ...dados.custos.linhas, [chave]: { ...atual, [campo]: valor } });
  }
  // origem: 'novo' — pedido de 2026-08-17, "Novo Headcount a ser inserido
  // manualmente" (ver QuadroPessoal/ehExistente).
  function addFuncionario(ccCodigo) {
    atualizar(['custos', 'funcionarios'], [...dados.custos.funcionarios, { id: uid(), nome: '', cargo: '', salario: '', ccCodigo, mesAdmissao: '', origem: 'novo' }]);
  }
  function updateFuncionario(id, campo, valor) {
    atualizar(['custos', 'funcionarios'], dados.custos.funcionarios.map(f => f.id === id ? { ...f, [campo]: valor } : f));
  }
  function removeFuncionario(id) {
    atualizar(['custos', 'funcionarios'], dados.custos.funcionarios.filter(f => f.id !== id));
  }
  function updatePremissaPessoal(campo, valor) {
    atualizar(['custos', 'premissasPessoal'], { ...dados.custos.premissasPessoal, [campo]: valor });
  }
  // origem: 'existente' — pedido de 2026-08-17, "Headcount Existente
  // [...] calculado com base no template importado".
  function importarFuncionariosLote(ccCodigo, lista) {
    const novos = lista.map(f => ({ id: uid(), nome: f.nome, cargo: f.cargo || '', salario: f.salario, ccCodigo, mesAdmissao: f.mesAdmissao || '', origem: 'existente' }));
    atualizar(['custos', 'funcionarios'], [...dados.custos.funcionarios, ...novos]);
  }
  function addLinhaFinanciamento() {
    atualizar(['fcFinanciamentos', 'linhas'], [...dados.fcFinanciamentos.linhas, novaLinhaFinanciamento()]);
  }
  function updateLinhaFinanciamento(id, campo, valor) {
    atualizar(['fcFinanciamentos', 'linhas'], dados.fcFinanciamentos.linhas.map(l => l.id === id ? { ...l, [campo]: valor } : l));
  }
  function removeLinhaFinanciamento(id) {
    atualizar(['fcFinanciamentos', 'linhas'], dados.fcFinanciamentos.linhas.filter(l => l.id !== id));
  }
  function updateMovimentacaoAcionista(id, valores) {
    atualizar(['fcFinanciamentos', 'movimentacoesAcionistas'], dados.fcFinanciamentos.movimentacoesAcionistas.map(m => m.id === id ? { ...m, valores } : m));
  }
  function updatePremissa5Y(ano, campo, valor) {
    atualizar(['plano5y', 'anos', ano], { ...dados.plano5y.anos[ano], [campo]: valor });
  }
  function updateCenarioSensibilidade(cenarioId, campo, valor) {
    atualizar(['sensibilidades', 'cenarios', cenarioId], { ...dados.sensibilidades.cenarios[cenarioId], [campo]: valor });
  }
  function addDetalhe() {
    const novo = { id: uid(), cc: '', pacote: '', dono: '', nivelServico: '', prioridade: '', justificativa: '' };
    atualizar(['custos', 'detalhes'], [...dados.custos.detalhes, novo]);
  }
  function updateDetalhe(id, campo, valor) {
    atualizar(['custos', 'detalhes'], dados.custos.detalhes.map(d => d.id === id ? { ...d, [campo]: valor } : d));
  }
  function removeDetalhe(id) {
    atualizar(['custos', 'detalhes'], dados.custos.detalhes.filter(d => d.id !== id));
  }

  function addProjeto(categoria) {
    atualizar(['capex', 'projetos'], [...dados.capex.projetos, { id: uid(), nome: '', valor: '', mes: '', justificativa: '', categoria: categoria || 'melhoria_interna' }]);
  }
  function updateProjeto(id, campo, valor) {
    atualizar(['capex', 'projetos'], dados.capex.projetos.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  }
  function removeProjeto(id) {
    atualizar(['capex', 'projetos'], dados.capex.projetos.filter(p => p.id !== id));
  }

  async function enviarVersao() {
    if (!tudoOk || !autorNome.trim()) {
      if (!autorNome.trim()) setErro('Informe seu nome antes de enviar.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      // Backend cria o snapshot em orcamento_versoes e move o status para
      // 'enviado' numa transação só (ver db/orcamentos.js registrarEnvio) —
      // não montamos mais o snapshot aqui no cliente.
      const { orcamento, versao } = await enviarVersaoApi(unidadeAtual, comentarioEnvio.trim());
      setDados(orcamento.dados);
      setAguardandoLiberacao(orcamento.aguardando_liberacao || false);
      setVersoes(await listarVersoes(unidadeAtual));

      // Backlog (histórico consolidado do FP&A entre unidades) ainda é
      // legacyStorage — ver nota no arquivo. totalGeral aqui é o lucroLiquido
      // do subconjunto de totais que o backend grava (não o objeto DRE
      // completo que o protótipo produzia local).
      try {
        const rb = await legacyStorage.get('ara-orc:backlog');
        const backlogAtual = rb ? JSON.parse(rb.value) : [];
        const entrada = {
          id: uid(), unidadeId: unidadeAtual, timestamp: versao.enviado_em,
          autor: autorNome.trim(), comentario: comentarioEnvio.trim(),
          totalGeral: versao.totais?.lucroLiquido,
        };
        await legacyStorage.set('ara-orc:backlog', JSON.stringify([entrada, ...backlogAtual].slice(0, 200)));
      } catch (e) {
        // silencioso — backlog é conveniência de listagem, não a fonte de verdade
      }

      setComentarioEnvio('');
    } catch (e) {
      // 409 aguardando_liberacao_fpa vem com mensagem específica do backend
      // (ApiError.message já traz body.mensagem) — as outras falhas caem no
      // texto genérico de sempre.
      setErro(e instanceof ApiError && e.status === 409 ? e.message : 'Falha ao enviar a versão. Tente novamente em instantes.');
      if (e instanceof ApiError && e.status === 409) setAguardandoLiberacao(true);
    }
    setEnviando(false);
  }

  // Admin FP&A libera o botão "Enviar versão" de uma unidade (pedido de
  // 2026-08-16) — usado em VisaoFPA, dentro do drill de cada unidade.
  async function liberarReenvioUnidade(idUnidade) {
    try {
      const { orcamento } = await liberarReenvioApi(idUnidade);
      setAguardandoLiberacaoPorUnidade(prev => ({ ...prev, [idUnidade]: orcamento.aguardando_liberacao || false }));
    } catch (e) {
      setErro('Não foi possível liberar o reenvio. Tente novamente.');
    }
  }

  async function abrirDrill(idUnidade) {
    if (unidadeDrill === idUnidade) { setUnidadeDrill(null); return; }
    setUnidadeDrill(idUnidade);
    try {
      setVersoesDrill(await listarVersoes(idUnidade));
    } catch (e) {
      setVersoesDrill([]);
    }
  }

  async function atualizarEtapa(id, campo, valor) {
    const novasEtapas = etapasProcesso.map(e => e.id === id ? { ...e, [campo]: valor } : e);
    setEtapasProcesso(novasEtapas);
    try {
      await legacyStorage.set('ara-orc:etapas', JSON.stringify(novasEtapas));
    } catch (e) {
      // silencioso — próxima gravação tenta novamente
    }
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new();
    const unidadesParaExportar = role === 'fpa' ? UNIDADES : [unidadeObj];

    const linhasCustosExport = [['Unidade', 'Centro de Custo', 'Tipo', 'Pacote', 'Conta', 'Descrição da Conta', 'Tipo de Premissa', 'Mês', 'Valor Calculado', 'Justificativa', 'Status', 'Última Atualização', 'Autor']];
    unidadesParaExportar.forEach(u => {
      const d = role === 'fpa' ? statusUnidades[u.id] : dados;
      if (!d) return;
      const refU = referenciaDaUnidade(u.id);
      const dreU = computeDRE(d, refU);
      Object.entries(d.custos.linhas || {}).forEach(([chave, linha]) => {
        const [ccCodigo, contaCodigo] = chave.split('|');
        const cc = refU.ccs.find(c => c.codigo === ccCodigo);
        const conta = refU.todasContas[contaCodigo];
        const pacote = (refU.pacotes || []).find(p => p.id === conta?.pacoteId);
        const premissa = TIPOS_PREMISSA.find(t => t.id === linha.premissaTipo);
        MESES.forEach((m, mi) => {
          const valor = valorLinhaMes(linha, mi, dreU.receitaBrutaMes, dreU.receitaLiquidaMes);
          if (valor === 0) return;
          linhasCustosExport.push([u.nome, cc?.nome || ccCodigo, cc?.tipo === 'producao' ? 'Custo' : 'Despesa', pacote?.nome || 'Sem pacote', contaCodigo, conta?.nome || '', premissa?.nome || linha.premissaTipo, m, valor, linha.justificativa || '', d.meta?.status || 'nao_iniciado', formatData(d.meta?.atualizadoEm), d.meta?.autor || '']);
        });
      });
    });
    const wsC = XLSX.utils.aoa_to_sheet(linhasCustosExport);
    wsC['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 26 }, { wch: 10 }, { wch: 30 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsC, 'Custos_Despesas');

    const linhasReceita = [['Unidade', 'Produto', 'Mês', 'Volume (t)', 'Preço (R$/t)', 'Receita Bruta', 'Justificativa Geral da Receita']];
    unidadesParaExportar.forEach(u => {
      const d = role === 'fpa' ? statusUnidades[u.id] : dados;
      if (!d) return;
      (d.receita.produtos || []).forEach(p => {
        MESES.forEach((m, mi) => {
          const vol = parseNum(p.volumes?.[mi]);
          if (vol === 0) return;
          linhasReceita.push([u.nome, p.nome, m, vol, parseNum(p.precos?.[mi]), vol * parseNum(p.precos?.[mi]), d.receita.justificativaGeral || '']);
        });
      });
    });
    const wsR = XLSX.utils.aoa_to_sheet(linhasReceita);
    wsR['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsR, 'Receita');

    const linhasBalanco = [['Unidade', 'Item', 'Valor/Mês', 'Justificativa']];
    unidadesParaExportar.forEach(u => {
      const d = role === 'fpa' ? statusUnidades[u.id] : dados;
      if (!d) return;
      const b = d.balanco;
      linhasBalanco.push([u.nome, 'Caixa inicial', formatBRL(parseNum(b.caixaInicial)), '']);
      linhasBalanco.push([u.nome, 'Imobilizado inicial', formatBRL(parseNum(b.imobilizadoInicial)), '']);
      linhasBalanco.push([u.nome, 'Depreciação acumulada inicial', formatBRL(parseNum(b.depreciacaoAcumuladaInicial)), '']);
      linhasBalanco.push([u.nome, 'Contas a receber inicial', formatBRL(parseNum(b.contasAReceberInicial)), '']);
      linhasBalanco.push([u.nome, 'Estoque inicial', formatBRL(parseNum(b.estoqueInicial)), '']);
      linhasBalanco.push([u.nome, 'Contas a pagar inicial', formatBRL(parseNum(b.contasAPagarInicial)), '']);
      linhasBalanco.push([u.nome, 'Saldo inicial de dívida', formatBRL(parseNum(b.emprestimos.saldoInicial)), b.emprestimos.justificativa || '']);
    });
    const wsB = XLSX.utils.aoa_to_sheet(linhasBalanco);
    wsB['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsB, 'Balanco_Patrimonial');

    const linhasFinExport = [['Unidade', 'Banco', 'Linha', 'Moeda', 'Mês', 'Captações', 'Amortizações', 'Juros Pagos', 'Variação Cambial', 'Provisão Desp. Financeira', 'Justificativa']];
    unidadesParaExportar.forEach(u => {
      const d = role === 'fpa' ? statusUnidades[u.id] : dados;
      if (!d) return;
      (d.fcFinanciamentos?.linhas || []).forEach(l => {
        MESES.forEach((m, mi) => {
          const vals = [l.captacoes?.[mi], l.amortizacoes?.[mi], l.jurosPagos?.[mi], l.variacaoCambial?.[mi], l.provisaoDespesaFinanceira?.[mi]].map(parseNum);
          if (vals.every(v => v === 0)) return;
          linhasFinExport.push([u.nome, l.banco || '', l.linha || '', l.moeda || '', m, ...vals, l.justificativa || '']);
        });
      });
      (d.fcFinanciamentos?.movimentacoesAcionistas || []).forEach(mv => {
        MESES.forEach((m, mi) => {
          const v = parseNum(mv.valores?.[mi]);
          if (v === 0) return;
          linhasFinExport.push([u.nome, 'Movimentação de acionistas', mv.nome, '', m, '', '', '', '', v, '']);
        });
      });
    });
    const wsF = XLSX.utils.aoa_to_sheet(linhasFinExport);
    wsF['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsF, 'FC_Financiamentos');

    const linhasDRE = [['Unidade', 'Receita Bruta', 'Deduções', 'Receita Líquida', 'CPV', 'Lucro Bruto', 'Margem Bruta %', 'Despesas Op.', 'EBITDA', 'Margem EBITDA %', 'D&A', 'Result. Financeiro', 'Outras', 'IRCSL', 'Lucro Líquido', 'Margem Líquida %']];
    unidadesParaExportar.forEach(u => {
      const d = role === 'fpa' ? statusUnidades[u.id] : dados;
      if (!d) return;
      const t = computeDRE(d, referenciaDaUnidade(u.id));
      linhasDRE.push([u.nome, t.receitaBruta, -t.deducoes, t.receitaLiquida, -t.cpv, t.lucroBruto, t.margemBruta, -t.despesasSemDA, t.ebitda, t.margemEbitda, -t.depreciacao, t.resultadoFinanceiro, t.outras, -t.ircsl, t.lucroLiquido, t.margemLiquida]);
    });
    const wsD = XLSX.utils.aoa_to_sheet(linhasDRE);
    XLSX.utils.book_append_sheet(wb, wsD, 'DRE_Resumo');

    XLSX.writeFile(wb, `Orcamento_2027_${role === 'fpa' ? 'Consolidado' : unidadeObj.nome.replace(/\s/g, '_')}.xlsx`);
  }

  // Resumo Executivo em PPT de verdade (3 slides, para apresentação ao
  // Conselho de Administração — CAD), gerado no navegador com pptxgenjs.
  // Antes disto, a função só copiava um texto pra área de transferência
  // pedindo pra colar numa conversa com o Claude — fazia sentido dentro do
  // protótipo (Caminho A), mas não faz mais sentido numa aplicação real.
  async function solicitarResumoExecutivo() {
    setStatusPptx({ mensagem: 'Gerando o PPT…' });
    try {
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      const AZUL = '0C4391', LARANJA = 'FFA707', TEXTO = '494949', CLARO = 'F7F7F7';

      const tituloUnidade = role === 'fpa' ? 'Grupo ARA — Consolidado' : unidadeObj.nome;
      const dataGeracao = new Date().toLocaleDateString('pt-BR');

      if (role === 'fpa') {
        // -------------------- Slide 1 — Capa e resumo executivo (consolidado) --------------------
        const s1 = pptx.addSlide();
        s1.background = { color: AZUL };
        s1.addText('ORÇAMENTO 2027', { x: 0.6, y: 0.5, w: 9, h: 0.5, fontSize: 13, bold: true, color: LARANJA, charSpacing: 2 });
        s1.addText(tituloUnidade, { x: 0.6, y: 0.9, w: 9, h: 0.8, fontSize: 30, bold: true, color: 'FFFFFF' });
        s1.addText(`Resumo Executivo — Apresentação ao Conselho de Administração · ${dataGeracao}`, { x: 0.6, y: 1.55, w: 9, h: 0.4, fontSize: 12, color: 'D9E4F5' });

        const totais = UNIDADES.reduce((acc, u) => {
          const d = statusUnidades[u.id];
          const t = d ? computeDRE(d, referenciaDaUnidade(u.id)) : computeDRE(emptyFormData(u.id), referenciaDaUnidade(u.id));
          acc.receitaLiquida += t.receitaLiquida; acc.ebitda += t.ebitda; acc.lucroLiquido += t.lucroLiquido;
          return acc;
        }, { receitaLiquida: 0, ebitda: 0, lucroLiquido: 0 });
        const kpis = [
          { label: 'Receita Líquida', valor: formatBRL(totais.receitaLiquida) },
          { label: 'EBITDA', valor: `${formatBRL(totais.ebitda)}  (${formatPct(totais.receitaLiquida ? totais.ebitda / totais.receitaLiquida * 100 : 0)})` },
          { label: 'Lucro Líquido', valor: `${formatBRL(totais.lucroLiquido)}  (${formatPct(totais.receitaLiquida ? totais.lucroLiquido / totais.receitaLiquida * 100 : 0)})` },
        ];
        kpis.forEach((k, i) => {
          const x = 0.6 + i * 3.13;
          s1.addShape('roundRect', { x, y: 2.4, w: 2.9, h: 1.7, fill: { color: 'FFFFFF' }, rectRadius: 0.08, line: { color: 'FFFFFF' } });
          s1.addText(k.label.toUpperCase(), { x: x + 0.15, y: 2.55, w: 2.6, h: 0.4, fontSize: 10.5, bold: true, color: '7A8088', charSpacing: 1 });
          s1.addText(k.valor, { x: x + 0.15, y: 2.9, w: 2.6, h: 1.0, fontSize: 17, bold: true, color: AZUL, valign: 'top' });
        });

        // -------------------- Slide 2 — Comparativo de DRE por unidade --------------------
        const s2 = pptx.addSlide();
        s2.addText('Cascata de DRE', { x: 0.5, y: 0.35, w: 9, h: 0.5, fontSize: 20, bold: true, color: AZUL });
        const linhas2 = [[
          { text: 'Unidade', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
          { text: 'Receita Líquida', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
          { text: 'EBITDA', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
          { text: 'Margem EBITDA', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
          { text: 'Lucro Líquido', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
          { text: 'Status', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
        ]];
        UNIDADES.forEach((u) => {
          const d = statusUnidades[u.id];
          const t = d ? computeDRE(d, referenciaDaUnidade(u.id)) : computeDRE(emptyFormData(u.id), referenciaDaUnidade(u.id));
          linhas2.push([u.nome, formatBRL(t.receitaLiquida), formatBRL(t.ebitda), formatPct(t.margemEbitda), formatBRL(t.lucroLiquido), d?.meta?.status || 'nao_iniciado']);
        });
        s2.addTable(linhas2, { x: 0.5, y: 1.0, w: 9, fontSize: 10.5, color: TEXTO, border: { type: 'solid', color: 'D9D9D9', pt: 0.5 }, autoPage: false });

        // -------------------- Slide 3 — Status do processo por unidade --------------------
        const s3 = pptx.addSlide();
        s3.addText('Status do Processo Orçamentário', { x: 0.5, y: 0.35, w: 9, h: 0.5, fontSize: 20, bold: true, color: AZUL });
        const linhas3 = [[
          { text: 'Unidade', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
          { text: 'Status', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
          { text: 'Última atualização', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF' } },
        ]];
        UNIDADES.forEach((u) => {
          const d = statusUnidades[u.id];
          linhas3.push([u.nome, d?.meta?.status || 'nao_iniciado', d?.meta?.atualizadoEm ? formatData(d.meta.atualizadoEm) : '—']);
        });
        s3.addTable(linhas3, { x: 0.5, y: 1.0, w: 9, fontSize: 11, color: TEXTO, border: { type: 'solid', color: 'D9D9D9', pt: 0.5 }, autoPage: false });
      } else {
        // Pedido de 2026-08-16: sem capa — reflete a mesma estrutura da tela
        // de Revisão, Análise e Envio (DRE + gráficos Bridge, DRE mensal, FC
        // Indireto mensal, FC Direto mensal), por unidade.
        const fd = computeFluxoIndiretoMensal(dados, dre, refUnidadeAtual);
        const fcd = computeFluxoCaixaDiretoMensal(dados, dre, refUnidadeAtual);
        const totalFcOperacional = fd.fcOperacionalMes.reduce((a, v) => a + v, 0);
        const totalIrcslAno = fd.ircslMes.reduce((a, v) => a + v, 0);
        const totalGiroAno = fd.variacaoGiroMes.reduce((a, v) => a + v, 0);
        const totalAjuste13Ano = fd.ajuste13Mes.reduce((a, v) => a + v, 0);

        function cumulativo(etapas) {
          let acumulado = 0;
          return etapas.map(e => {
            if (e.tipo === 'inicio' || e.tipo === 'total') { acumulado = e.valor; } else { acumulado += e.valor; }
            return acumulado;
          });
        }
        function corPonto(e) {
          if (e.tipo === 'inicio' || e.tipo === 'total') return AZUL;
          return e.valor >= 0 ? '3AA65C' : 'C0392B';
        }
        function addBridgeChart(slide, etapas, x, y, w, h) {
          slide.addChart(pptx.ChartType.bar, [{ name: 'Valor', labels: etapas.map(e => e.label), values: cumulativo(etapas) }], {
            x, y, w, h, barDir: 'col', showLegend: false, showValue: true, dataLabelFontSize: 8, dataLabelFormatCode: '#,##0',
            catAxisLabelFontSize: 8, valAxisHidden: true, chartColors: etapas.map(corPonto), barGapWidthPct: 40,
          });
        }
        const bridgeReceitaEbitda = [
          { label: 'Receita Bruta', valor: dre.receitaBruta, tipo: 'inicio' },
          { label: 'Deduções/Impostos', valor: -dre.deducoes, tipo: 'incremento' },
          { label: 'Custos (CPV)', valor: -dre.cpv, tipo: 'incremento' },
          { label: 'Despesas', valor: -dre.despesasSemDA, tipo: 'incremento' },
          { label: 'EBITDA', valor: dre.ebitda, tipo: 'total' },
        ];
        const bridgeEbitdaFco = [
          { label: 'EBITDA', valor: dre.ebitda, tipo: 'inicio' },
          { label: 'Impostos', valor: -totalIrcslAno, tipo: 'incremento' },
          { label: 'Var. Capital de Giro', valor: totalGiroAno, tipo: 'incremento' },
          { label: 'Outros Ajustes', valor: totalAjuste13Ano, tipo: 'incremento' },
          { label: 'FCO', valor: totalFcOperacional, tipo: 'total' },
        ];

        // -------------------- Slide 1 — DRE Consolidada + Bridge --------------------
        const s1 = pptx.addSlide();
        s1.addText(`DRE Consolidada — ${tituloUnidade}`, { x: 0.4, y: 0.3, w: 9.2, h: 0.5, fontSize: 18, bold: true, color: AZUL });
        const linha = (label, valor, destaque) => ([
          { text: label, options: { bold: !!destaque, fill: destaque ? { color: CLARO } : undefined, fontSize: 10.5 } },
          { text: valor, options: { align: 'right', bold: !!destaque, fill: destaque ? { color: CLARO } : undefined, fontSize: 10.5 } },
        ]);
        const linhasDreCascata = [
          linha('Receita Operacional Líquida', formatBRL(dre.receitaLiquida), true),
          linha('(–) CPV', formatBRL(-dre.cpv)),
          linha(`Lucro Bruto (${formatPct(dre.margemBruta)})`, formatBRL(dre.lucroBruto), true),
          linha('(–) Despesas Operacionais', formatBRL(-dre.despesasSemDA)),
          linha(`EBITDA (${formatPct(dre.margemEbitda)})`, formatBRL(dre.ebitda), true),
          linha('(–) Depreciação e Amortização', formatBRL(-dre.depreciacao)),
          linha('(+/–) Resultado Financeiro', formatBRL(dre.resultadoFinanceiro)),
          linha('(+/–) Outras Receitas/Despesas', formatBRL(dre.outras)),
          linha('(–) IRCSL', formatBRL(-dre.ircsl)),
          linha(`Lucro Líquido (${formatPct(dre.margemLiquida)})`, formatBRL(dre.lucroLiquido), true),
        ];
        s1.addTable(linhasDreCascata, { x: 0.4, y: 0.9, w: 4.6, fontSize: 10.5, color: TEXTO, border: { type: 'solid', color: 'D9D9D9', pt: 0.5 }, autoPage: false });
        s1.addText('Bridge — Receita até EBITDA', { x: 5.2, y: 0.85, w: 4.4, h: 0.3, fontSize: 11, bold: true, color: AZUL });
        addBridgeChart(s1, bridgeReceitaEbitda, 5.2, 1.1, 4.4, 2.3);
        s1.addText('Bridge — EBITDA até FCO', { x: 5.2, y: 3.5, w: 4.4, h: 0.3, fontSize: 11, bold: true, color: AZUL });
        addBridgeChart(s1, bridgeEbitdaFco, 5.2, 3.75, 4.4, 2.3);

        // -------------------- Slides 2-4 — tabelas mensais --------------------
        const colW = [1.9, ...Array(12).fill(0.53), 0.7];
        function addTabelaMensal(titulo, linhasCalc) {
          const s = pptx.addSlide();
          s.addText(titulo, { x: 0.3, y: 0.25, w: 9.4, h: 0.4, fontSize: 15, bold: true, color: AZUL });
          const header = [
            { text: 'Linha', options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF', fontSize: 7.5 } },
            ...MESES.map(m => ({ text: m, options: { bold: true, fill: { color: AZUL }, color: 'FFFFFF', fontSize: 7 } })),
            { text: 'Total', options: { bold: true, fill: { color: LARANJA }, color: 'FFFFFF', fontSize: 7.5 } },
          ];
          const corpo = linhasCalc.map(l => ([
            { text: l.label, options: { fontSize: 7, bold: true, fontFace: FONT } },
            ...l.valoresMensal.map(v => ({ text: formatBRLCompacto(v), options: { fontSize: 6.5, align: 'right' } })),
            { text: formatBRLCompacto(l.totalValor), options: { fontSize: 7, bold: true, align: 'right' } },
          ]));
          s.addTable([header, ...corpo], { x: 0.3, y: 0.75, w: 9.4, colW, border: { type: 'solid', color: 'D9D9D9', pt: 0.5 }, autoPage: false, valign: 'middle' });
        }
        addTabelaMensal('DRE Consolidada — mensal', [
          { label: 'Receita Bruta', valoresMensal: fd.receitaBrutaMes, totalValor: fd.receitaBrutaMes.reduce((a, v) => a + v, 0) },
          { label: '(-) Deduções', valoresMensal: fd.deducoesMes.map(v => -v), totalValor: -fd.deducoesMes.reduce((a, v) => a + v, 0) },
          { label: '(=) Receita Líquida', valoresMensal: fd.receitaLiquidaMes, totalValor: fd.receitaLiquidaMes.reduce((a, v) => a + v, 0) },
          { label: '(-) CPV', valoresMensal: fd.cpvMes.map(v => -v), totalValor: -fd.cpvMes.reduce((a, v) => a + v, 0) },
          { label: '(=) Lucro Bruto', valoresMensal: fd.lucroBrutoMes, totalValor: fd.lucroBrutoMes.reduce((a, v) => a + v, 0) },
          { label: '(-) Despesas Operacionais', valoresMensal: fd.despesasSemDAmes.map(v => -v), totalValor: -fd.despesasSemDAmes.reduce((a, v) => a + v, 0) },
          { label: '(=) EBITDA', valoresMensal: fd.ebitdaMes, totalValor: fd.ebitdaMes.reduce((a, v) => a + v, 0) },
          { label: '(-) Depreciação e Amortização', valoresMensal: fd.depreciacaoMes.map(v => -v), totalValor: -fd.depreciacaoMes.reduce((a, v) => a + v, 0) },
          { label: '(+/-) Resultado Financeiro', valoresMensal: fd.resultadoFinanceiroMes, totalValor: fd.resultadoFinanceiroMes.reduce((a, v) => a + v, 0) },
          { label: '(+/-) Outras Receitas e Despesas', valoresMensal: fd.outrasMes, totalValor: fd.outrasMes.reduce((a, v) => a + v, 0) },
          { label: '(-) IRCSL', valoresMensal: fd.ircslMes.map(v => -v), totalValor: -fd.ircslMes.reduce((a, v) => a + v, 0) },
          { label: '(=) Lucro Líquido', valoresMensal: fd.lucroLiquidoMes, totalValor: fd.lucroLiquidoMes.reduce((a, v) => a + v, 0) },
        ]);
        addTabelaMensal('Fluxo de Caixa Indireto — mensal, a partir do EBITDA', [
          { label: 'EBITDA', valoresMensal: fd.ebitdaMes, totalValor: fd.ebitdaMes.reduce((a, v) => a + v, 0) },
          { label: '(-) IRCSL proporcional', valoresMensal: fd.ircslMes.map(v => -v), totalValor: -fd.ircslMes.reduce((a, v) => a + v, 0) },
          { label: '(+/-) Ajuste 13º (competência × caixa)', valoresMensal: fd.ajuste13Mes, totalValor: fd.ajuste13Mes.reduce((a, v) => a + v, 0) },
          { label: '(+/-) Variação de Capital de Giro', valoresMensal: fd.variacaoGiroMes, totalValor: fd.variacaoGiroMes.reduce((a, v) => a + v, 0) },
          { label: '(=) FC Operacional', valoresMensal: fd.fcOperacionalMes, totalValor: totalFcOperacional },
          { label: '(=) FC Investimentos', valoresMensal: fd.fcInvestimentoMes, totalValor: fd.fcInvestimentoMes.reduce((a, v) => a + v, 0) },
          { label: '(=) FC Financiamentos', valoresMensal: fd.fcFinanciamentoMes, totalValor: fd.fcFinanciamentoMes.reduce((a, v) => a + v, 0) },
          { label: '(=) Variação de Caixa no Mês', valoresMensal: fd.variacaoCaixaMes, totalValor: fd.variacaoCaixaMes.reduce((a, v) => a + v, 0) },
          { label: 'Caixa Acumulado', valoresMensal: fd.caixaAcumuladoMes, totalValor: fd.caixaAcumuladoMes[11] },
        ]);
        addTabelaMensal('Fluxo de Caixa Direto — mensal, por natureza de recebimento e pagamento', linhasFcDireto(fcd).map(l => ({ label: l.label, valoresMensal: l.valoresMensal, totalValor: l.totalValor })));
      }

      const nomeArquivo = `Orcamento_2027_ResumoExecutivo_${role === 'fpa' ? 'Consolidado' : unidadeObj.nome.replace(/\s/g, '_')}.pptx`;
      pptx.writeFile({ fileName: nomeArquivo });
      setStatusPptx({ mensagem: `PPT gerado: ${nomeArquivo}` });
    } catch (e) {
      setStatusPptx({ mensagem: 'Não foi possível gerar o PPT. Tente novamente.', erro: true });
    }
  }

  return (
    <div style={{ fontFamily: FONT, color: COR.texto, background: COR.branco, minHeight: '100%', padding: 0 }}>
      <div style={{ background: COR.azul, padding: '16px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logos/grupo-ara.jpg" alt="Grupo ARA" style={{ height: 52, borderRadius: 4, background: '#fff', padding: '4px 8px' }} />
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: COR.laranja, letterSpacing: 1.2 }}>GRUPO ARA · FP&amp;A</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: COR.branco }}>Orçamento 2027 — Grupo ARA</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Antes, qualquer um clicava aqui e virava "FP&A" — agora o
                toggle só existe para quem realmente é admin_fpa na sessão. */}
            {podeAlternarParaFpa && (
              <>
                <button
                  onClick={() => setRole('gerente')}
                  style={{
                    fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 7, cursor: 'pointer',
                    border: role === 'gerente' ? 'none' : '1px solid #3E63A8',
                    background: role === 'gerente' ? COR.laranja : 'transparent', color: COR.branco,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                ><Building2 size={14} /> Orçamento Unidades</button>
                <button
                  onClick={() => setRole('fpa')}
                  style={{
                    fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 7, cursor: 'pointer',
                    border: role === 'fpa' ? 'none' : '1px solid #3E63A8',
                    background: role === 'fpa' ? COR.laranja : 'transparent', color: COR.branco,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                ><Users size={14} /> FP&amp;A Corporativo</button>
              </>
            )}
            <div style={{ marginLeft: 8, textAlign: 'right', color: COR.branco }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{usuario.nome}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{PERFIL_LABEL[usuario.perfil] || usuario.perfil}</div>
            </div>
            <button
              onClick={() => logout().then(() => window.location.reload())}
              style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid #3E63A8', background: 'transparent', color: COR.branco }}
            >Sair</button>
          </div>
        </div>
      </div>


      {statusPptx && (
        <div style={{ background: statusPptx.erro ? '#FDECEC' : '#E8F0FA', borderBottom: `1px solid ${statusPptx.erro ? '#C00000' : COR.azul}`, padding: '10px 22px', fontSize: 11.5, color: COR.texto, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>{statusPptx.mensagem}</span>
          <button onClick={() => setStatusPptx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.azul, fontSize: 11, fontWeight: 700 }}>Fechar</button>
        </div>
      )}

      {carregando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 40, justifyContent: 'center', color: '#7A8088' }}>
          <Loader2 size={18} className="girando" /> Carregando dados…
        </div>
      ) : role === 'gerente' ? (
        <VisaoGerente
          usuario={usuario}
          unidadesVisiveis={unidadesVisiveis}
          salvarRascunhoAgora={salvarRascunhoAgora} salvandoRascunho={salvandoRascunho} ultimoSalvoEm={ultimoSalvoEm}
          unidadeAtual={unidadeAtual} setUnidadeAtual={setUnidadeAtual} unidadeObj={unidadeObj}
          aba={aba} setAba={setAba} dados={dados} dre={dre} checks={checks} tudoOk={tudoOk} aguardandoLiberacao={aguardandoLiberacao}
          updateProduto={updateProduto} updateDeducao={updateDeducao}
          premissasMacro={premissasMacro}
          addObjetivo={addObjetivo} updateObjetivo={updateObjetivo} removeObjetivo={removeObjetivo}
          addIniciativa={addIniciativa} updateIniciativa={updateIniciativa} removeIniciativa={removeIniciativa}
          updateLinha={updateLinha} addDetalhe={addDetalhe} updateDetalhe={updateDetalhe} removeDetalhe={removeDetalhe}
          addFuncionario={addFuncionario} updateFuncionario={updateFuncionario} removeFuncionario={removeFuncionario}
          importarFuncionariosLote={importarFuncionariosLote}
          updatePremissaPessoal={updatePremissaPessoal}
          addProjeto={addProjeto} updateProjeto={updateProjeto} removeProjeto={removeProjeto}
          addLinhaFinanciamento={addLinhaFinanciamento} updateLinhaFinanciamento={updateLinhaFinanciamento}
          removeLinhaFinanciamento={removeLinhaFinanciamento} updateMovimentacaoAcionista={updateMovimentacaoAcionista}
          updatePremissa5Y={updatePremissa5Y}
          updateCenarioSensibilidade={updateCenarioSensibilidade}
          atualizar={atualizar} autorNome={autorNome} setAutorNome={setAutorNome}
          comentarioEnvio={comentarioEnvio} setComentarioEnvio={setComentarioEnvio}
          enviarVersao={enviarVersao} enviando={enviando} erro={erro}
          versoes={versoes} mostrarHistorico={mostrarHistorico} setMostrarHistorico={setMostrarHistorico}
          exportarExcel={exportarExcel} solicitarResumoExecutivo={solicitarResumoExecutivo}
          abrirVersao={abrirVersao}
        />
      ) : (
        <VisaoFPA
          statusUnidades={statusUnidades} aguardandoLiberacaoPorUnidade={aguardandoLiberacaoPorUnidade} liberarReenvioUnidade={liberarReenvioUnidade}
          backlog={backlog} unidadeDrill={unidadeDrill} abrirDrill={abrirDrill}
          versoesDrill={versoesDrill} exportarExcel={exportarExcel} solicitarResumoExecutivo={solicitarResumoExecutivo}
          etapasProcesso={etapasProcesso} atualizarEtapa={atualizarEtapa}
          premissasMacro={premissasMacro} updatePremissaMacroGlobal={updatePremissaMacroGlobal}
          buscarBoletimFocus={buscarBoletimFocus} buscandoFocus={buscandoFocus} erroFocus={erroFocus}
          abrirVersao={abrirVersao}
        />
      )}
      {versaoAberta && (
        <ModalVersao
          unidadeId={versaoAberta.unidadeId} versaoId={versaoAberta.versaoId}
          onClose={() => setVersaoAberta(null)}
        />
      )}

      <style>{`
        .girando { animation: girar 1s linear infinite; }
        @keyframes girar { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${COR.laranja}; outline-offset: 1px; }
        table { border-collapse: collapse; width: 100%; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão do Gerente
// ---------------------------------------------------------------------------

const GOVERNANCA_POR_UNIDADE = {
  agricola: { pacotes: PACOTES_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA, fonte: 'Matriz_Governanca_OBZ_2027_4.xlsx — aba Agricola_Contas_x_Pacote' },
  resorts: { pacotes: PACOTES_RESORTS, planoContas: PLANO_CONTAS_RESORTS, fonte: 'Matriz_Governanca_OBZ_2027_4.xlsx — aba Resorts_Contas_x_Pacote' },
};

function PainelGovernancaReferencia({ unidadeId, unidadeNome }) {
  const [pacoteAberto, setPacoteAberto] = useState(null);
  const info = GOVERNANCA_POR_UNIDADE[unidadeId];
  if (!info) return null;
  const totalContas = Object.values(info.planoContas).reduce((a, l) => a + l.length, 0);

  return (
    <div>
      <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 14, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} color={COR.laranja} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>Lançamento de orçamento ainda não disponível para {unidadeNome}</div>
          <div style={{ fontSize: 11.5, color: COR.texto }}>
            A classificação oficial de conta × pacote já existe (abaixo) e vem de {info.fonte}, mas a planilha não traz Centro de Custo para esta unidade —
            e o orçamento base zero deste sistema é lançado por Unidade × Centro de Custo × Conta. Sem essa camada, não é possível abrir aqui o mesmo fluxo de
            preenchimento (Receita, Custos e Despesas, CAPEX etc.) usado na ARA Têxtil, para não sugerir uma estrutura que não existe de fato.
            Assim que o CC estiver disponível, o restante das abas é habilitado para {unidadeNome}.
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Governança de Contas e Pacotes — referência</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>{totalContas} contas classificadas, fonte oficial: {info.fonte}.</p>

      {info.pacotes.map(p => {
        const contas = info.planoContas[p.id] || [];
        const aberto = pacoteAberto === p.id;
        return (
          <div key={p.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setPacoteAberto(aberto ? null : p.id)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 12px', background: COR.claro, border: 'none', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: COR.azul }}>
                {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {p.nome} <span style={{ fontWeight: 400, color: '#8A8F96' }}>({contas.length} contas)</span>
              </span>
            </button>
            {aberto && (
              <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {contas.map(c => (
                  <span key={c.origem + c.codigo} title={c.codigo}
                    style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 10,
                      background: c.origem === 'Custo' ? '#E8F0FA' : COR.total,
                      color: COR.texto, border: `1px solid ${COR.borda}`,
                    }}>
                    {c.nome.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PainelGovernancaCorporativo() {
  const [ccBusca, setCcBusca] = useState('');
  const termoBusca = ccBusca.trim().toLowerCase();
  const ccsFiltrados = CCS_CORPORATIVO.filter(cc => !termoBusca || cc.nome.toLowerCase().includes(termoBusca) || (cc.codigo || '').includes(termoBusca));

  return (
    <div>
      <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 14, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} color={COR.laranja} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>Lançamento de orçamento ainda não disponível para o Corporativo</div>
          <div style={{ fontSize: 11.5, color: COR.texto }}>
            Fonte oficial: Base_Corporativo.xlsx. A lista de Centros de Custo abaixo (20 CCs) é confiável e é a única fonte válida de CC para o Corporativo —
            o sistema não deve aceitar CC fora desta lista. A lista de contas analíticas do arquivo, porém, não vem pareada por CC (o mesmo código de conta se repete
            em todas as linhas enquanto os nomes de despesa mudam), então trato-a apenas como uma referência geral de despesas do Corporativo, não como uma
            classificação CC × Conta. Sem esse De/Para, o fluxo completo de orçamento (como o da ARA Têxtil) fica pendente — evitando lançar dados como se a
            classificação existisse de fato. Assim que o FP&A confirmar o pareamento correto, o restante das abas é habilitado.
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Centros de Custo — oficial (referência)</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 10 }}>{CCS_CORPORATIVO.length} CCs — única fonte válida para o Corporativo.</p>
      <div style={{ maxWidth: 320, marginBottom: 10 }}>
        <CampoTexto value={ccBusca} onChange={setCcBusca} placeholder="Buscar CC por nome ou código…" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
        {ccsFiltrados.map((cc, i) => (
          <span key={i} title={cc.codigo || ''} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 14, background: COR.branco, border: `1px solid ${COR.borda}`, color: COR.texto }}>
            {cc.codigo ? <b style={{ color: COR.azul }}>{cc.codigo}</b> : null} {cc.nome}
          </span>
        ))}
        {ccsFiltrados.length === 0 && <span style={{ fontSize: 11.5, color: '#8A8F96' }}>Nenhum CC encontrado.</span>}
      </div>

      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Contas de referência (não pareadas por CC)</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 10 }}>{CONTAS_REFERENCIA_CORPORATIVO.length} contas — lista geral de despesas do Corporativo, pendente de vínculo com CC específico.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CONTAS_REFERENCIA_CORPORATIVO.map((c, i) => (
          <span key={i} style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 12, background: COR.claro, border: `1px solid ${COR.borda}`, color: COR.texto }}>{c}</span>
        ))}
      </div>
    </div>
  );
}

function VisaoGerente(props) {
  const {
    usuario,
    unidadesVisiveis, salvarRascunhoAgora, salvandoRascunho, ultimoSalvoEm,
    unidadeAtual, setUnidadeAtual, unidadeObj, aba, setAba, dados, dre, checks, tudoOk, aguardandoLiberacao,
    updateProduto, updateDeducao, premissasMacro,
    addObjetivo, updateObjetivo, removeObjetivo, addIniciativa, updateIniciativa, removeIniciativa,
    updateLinha, addDetalhe, updateDetalhe, removeDetalhe,
    addFuncionario, updateFuncionario, removeFuncionario, updatePremissaPessoal, importarFuncionariosLote,
    addProjeto, updateProjeto, removeProjeto,
    addLinhaFinanciamento, updateLinhaFinanciamento, removeLinhaFinanciamento, updateMovimentacaoAcionista,
    updatePremissa5Y, updateCenarioSensibilidade,
    atualizar, autorNome, setAutorNome,
    comentarioEnvio, setComentarioEnvio, enviarVersao, enviando, erro,
    versoes, mostrarHistorico, setMostrarHistorico, exportarExcel, solicitarResumoExecutivo,
    abrirVersao,
  } = props;

  return (
    <div style={{ padding: 22, maxWidth: 1520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Antes: UNIDADES (todas, para qualquer um). Agora: só as que este
              usuário tem vínculo real — proteção de verdade é no backend
              (exigirUnidade em toda rota), isto é só não oferecer na UI o
              que o servidor rejeitaria de qualquer forma. */}
          {unidadesVisiveis.map(u => (
            <button
              key={u.id} onClick={() => setUnidadeAtual(u.id)}
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 22, cursor: 'pointer',
                border: `1.5px solid ${u.id === unidadeAtual ? u.cor : COR.borda}`,
                background: u.id === unidadeAtual ? u.cor : COR.branco,
                color: u.id === unidadeAtual ? COR.branco : COR.texto,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {u.logo && (
                <img
                  src={u.logo} alt=""
                  style={{ height: u.logoAltura || 24, borderRadius: 3, background: '#fff', padding: u.id === unidadeAtual ? '2px 5px' : '1px 3px' }}
                />
              )}
              {u.nome}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {UNIDADES_COM_LANCAMENTO_HABILITADO.includes(unidadeAtual) && (
            <>
              {ultimoSalvoEm && (
                <span style={{ fontSize: 10.5, color: '#7A8088' }}>
                  Salvo às {ultimoSalvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={salvarRascunhoAgora} disabled={salvandoRascunho}
                style={{
                  fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '7px 12px', borderRadius: 7,
                  border: `1px solid ${COR.azul}`, background: '#fff', color: COR.azul, cursor: salvandoRascunho ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {salvandoRascunho ? 'Salvando…' : '💾 Salvar rascunho'}
              </button>
            </>
          )}
          <StatusBadge status={dados.meta?.status} />
        </div>
      </div>

      {/* Decisão de 2026-08-09: Agrícola e Resorts saíram do painel de
          referência e ganharam o formulário completo, com CC placeholder
          (ver REFERENCIA_POR_UNIDADE). Corporativo seguiu o mesmo caminho em
          2026-08-16: usa os 20 CCs reais (CCS_CORPORATIVO, fonte confiável),
          mas como as contas analíticas não vêm pareadas por CC na planilha-
          fonte (pendência de dado documentada), cada CC recebe o mesmo plano
          de contas completo (PLANO_CONTAS_CORPORATIVO/PACOTES_CORPORATIVO) —
          decisão explícita do usuário, não suposição. ARA EI nem aparece
          aqui — sem plano de contas nenhum, não está em
          UNIDADES_COM_LANCAMENTO_HABILITADO no backend. */}
      {unidadeAtual === 'ei' ? (
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} color={COR.laranja} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>ARA EI ainda sem dado-fonte</div>
            <div style={{ fontSize: 11.5, color: COR.texto }}>
              Diferente de Agrícola e Resorts, a ARA EI não tem nem plano de contas nem pacotes classificados ainda —
              não há de onde derivar a estrutura de lançamento sem inventar contas que não existem de fato.
              Assim que houver uma matriz de governança (ou equivalente) para esta unidade, o formulário completo é habilitado.
            </div>
          </div>
        </div>
      ) : unidadeAtual === 'energia' ? (
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} color={COR.laranja} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>Escritório de Investimentos — estrutura diferente das demais unidades</div>
            <div style={{ fontSize: 11.5, color: COR.texto }}>
              Esse segmento do Grupo ARA não segue o mesmo formulário de DRE por CC das outras unidades — é uma
              Visão de Portfólio de Investimentos (UFVs, PCH, Novo Cais, MCMV) e Aporte/Distribuição no Grupo.
              Essa tela ainda não foi construída (pendência de 2026-08-09, aguardando você detalhar a estrutura real).
            </div>
          </div>
        </div>
      ) : (
        <>
      <div style={{ display: 'flex', gap: 2, borderBottom: `2px solid ${COR.borda}`, marginBottom: 18, flexWrap: 'wrap' }}>
        {/* Gestor de CC (pedido de 2026-08-16): só Custos e Despesas — a
            visão completa das seções é exclusiva de Gestor da Unidade e
            Admin FP&A. */}
        {(usuario.perfil === 'gerente_cc_corporativo' ? ABAS.filter(a => a.id === 'custos') : ABAS).map(a => (
          <button
            key={a.id} onClick={() => setAba(a.id)}
            style={{
              fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '10px 14px', cursor: 'pointer',
              border: 'none', borderBottom: aba === a.id ? `3px solid ${COR.laranja}` : '3px solid transparent',
              background: 'transparent', color: aba === a.id ? COR.azul : '#8A8F96', marginBottom: -2,
            }}
          >{a.label}</button>
        ))}
      </div>

      {/* Projeção — largura total, sem coluna lateral disputando espaço */}
      <div style={{ marginBottom: 26 }}>
        {aba === 'estrategicas' && (
          <AbaEstrategicas
            estrategicas={dados.estrategicas} atualizar={atualizar} premissasMacro={premissasMacro}
            addObjetivo={addObjetivo} updateObjetivo={updateObjetivo} removeObjetivo={removeObjetivo}
            addIniciativa={addIniciativa} updateIniciativa={updateIniciativa} removeIniciativa={removeIniciativa}
          />
        )}
        {aba === 'receita' && (
          // Pedido de 2026-08-19: Corporativo mantém a aba (mesma
          // estrutura das demais unidades), mas com um aviso em vez do
          // formulário — não é omissão de dado, é escopo mesmo: unidade de
          // back-office não fatura.
          unidadeAtual === 'corporativo' ? (
            <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Info size={18} color={COR.laranja} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>Orçamento do Corporativo não contempla Receitas</div>
                <div style={{ fontSize: 11.5, color: COR.texto }}>
                  O Corporativo é uma unidade de back-office (Financeiro, RH, TI, Jurídico, FP&amp;A etc.) — não fatura, então esta seção fica sem
                  lançamento. O orçamento do Corporativo é só Custos e Despesas.
                </div>
              </div>
            </div>
          ) : dados.receita.linhas ? (
            <AbaReceitaResorts
              linhas={dados.receita.linhas} deducoes={dados.receita.deducoes}
              deducoesJustificativa={dados.receita.deducoesJustificativa} justificativaGeral={dados.receita.justificativaGeral}
              atualizar={atualizar} dre={dre}
            />
          ) : (
            <AbaReceita
              unidadeId={unidadeAtual}
              produtos={dados.receita.produtos} deducoes={dados.receita.deducoes}
              deducoesJustificativa={dados.receita.deducoesJustificativa} justificativaGeral={dados.receita.justificativaGeral}
              updateProduto={updateProduto} updateDeducao={updateDeducao} atualizar={atualizar} dre={dre}
            />
          )
        )}
        {aba === 'custos' && (
          <AbaCustos
            refUnidade={referenciaDaUnidade(unidadeAtual)}
            unidadeId={unidadeAtual} usuario={usuario}
            linhas={dados.custos.linhas} updateLinha={updateLinha} dre={dre}
            detalhes={dados.custos.detalhes} addDetalhe={addDetalhe} updateDetalhe={updateDetalhe} removeDetalhe={removeDetalhe}
            funcionarios={dados.custos.funcionarios} addFuncionario={addFuncionario} updateFuncionario={updateFuncionario} removeFuncionario={removeFuncionario}
            premissasPessoal={dados.custos.premissasPessoal} updatePremissaPessoal={updatePremissaPessoal}
            importarFuncionariosLote={importarFuncionariosLote}
            viagens={dados.custos.viagens} atualizar={atualizar}
          />
        )}
        {aba === 'capex' && (
          <AbaCapex projetos={dados.capex.projetos} addProjeto={addProjeto} updateProjeto={updateProjeto} removeProjeto={removeProjeto} />
        )}
        {aba === 'giro' && <AbaGiro capitalGiro={dados.capitalGiro} atualizar={atualizar} dre={dre} dados={dados} refUnidade={referenciaDaUnidade(unidadeAtual)} />}
        {aba === 'provisoes' && <AbaProvisoes provisoes={dados.provisoes} resultado={dados.resultado} atualizar={atualizar} />}
        {aba === 'fcfinanciamentos' && (
          <AbaFcFinanciamentos
            fcFinanciamentos={dados.fcFinanciamentos}
            addLinhaFinanciamento={addLinhaFinanciamento} updateLinhaFinanciamento={updateLinhaFinanciamento} removeLinhaFinanciamento={removeLinhaFinanciamento}
            updateMovimentacaoAcionista={updateMovimentacaoAcionista} atualizar={atualizar}
          />
        )}
        {aba === 'balanco' && <AbaBalanco balanco={dados.balanco} atualizar={atualizar} />}
        {aba === 'plano5y' && <AbaPlano5Y dre={dre} plano5y={dados.plano5y} updatePremissa5Y={updatePremissa5Y} atualizar={atualizar} />}
        {aba === 'revisao' && (
          <AbaRevisao
            refUnidade={referenciaDaUnidade(unidadeAtual)}
            dados={dados} dre={dre} autorNome={autorNome} setAutorNome={setAutorNome}
            comentarioEnvio={comentarioEnvio} setComentarioEnvio={setComentarioEnvio}
            enviarVersao={enviarVersao} enviando={enviando} tudoOk={tudoOk} erro={erro}
            aguardandoLiberacao={aguardandoLiberacao}
            sensibilidades={dados.sensibilidades} updateCenarioSensibilidade={updateCenarioSensibilidade}
          />
        )}
      </div>

      {/* Auditoria, pendências, exportações e histórico — abaixo da projeção */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: `2px solid ${COR.borda}`, paddingTop: 18 }}>
        <div style={{ flex: '1 1 360px', minWidth: 300 }}>
          <PainelAuditoria checks={checks} />
        </div>
        {/* Pedido de 2026-08-19: Corporativo não precisa deste painel — o
            conteúdo é fixo (texto sobre CC/pacotes/Protheus da Têxtil),
            sem sentido nenhum pra outra unidade. */}
        {unidadeAtual !== 'corporativo' && (
          <div style={{ flex: '1 1 360px', minWidth: 300 }}>
            <PainelPendencias />
          </div>
        )}
        <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Botao variante="secundario" icone={FileSpreadsheet} onClick={exportarExcel}>Excel</Botao>
            <Botao variante="secundario" icone={FileBarChart} onClick={solicitarResumoExecutivo}>PPT</Botao>
          </div>
          <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setMostrarHistorico(!mostrarHistorico)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', background: COR.claro, border: 'none', cursor: 'pointer',
                fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: COR.azul,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><History size={15} /> Histórico de versões ({versoes.length})</span>
              {mostrarHistorico ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            {mostrarHistorico && (
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {versoes.length === 0 && <div style={{ fontSize: 11.5, color: '#8A8F96' }}>Nenhuma versão enviada ainda.</div>}
                {versoes.map(v => (
                  <div key={v.id} style={{ borderLeft: `3px solid ${COR.laranja}`, paddingLeft: 8, fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontWeight: 700, color: COR.texto }}>{v.autor}</div>
                      <button
                        onClick={() => abrirVersao(unidadeAtual, v.id)}
                        style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 700, color: COR.azul, background: 'none', border: `1px solid ${COR.azul}`, borderRadius: 12, padding: '2px 8px', cursor: 'pointer' }}
                      >Abrir</button>
                    </div>
                    <div style={{ color: '#7A8088', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {formatData(v.timestamp)}</div>
                    {v.comentario && <div style={{ color: COR.texto, marginTop: 2 }}>{v.comentario}</div>}
                    <div style={{ color: COR.azul, marginTop: 2 }}>Lucro líquido: {formatBRL(v.totais?.lucroLiquido)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// Cabeçalho de tabela mensal reaproveitado por todas as visões de leitura
// abaixo (12 meses + total) — mesmo visual do resto do app.
function CabecalhoMensalLeitura({ rotuloPrimeiraColuna = 'Linha' }) {
  return (
    <thead>
      <tr>
        <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', textAlign: 'left', position: 'sticky', left: 0 }}>{rotuloPrimeiraColuna}</th>
        {MESES.map(m => (
          <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 4px', minWidth: 58 }}>{m}</th>
        ))}
        <th style={{ background: COR.laranja, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 78 }}>Total</th>
      </tr>
    </thead>
  );
}
const formatarPctLeitura = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const formatarQtdLeitura = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// Folha de pessoal, versão leitura — lista de funcionários (nome, salário,
// admissão) + a folha calculada mês a mês (mesma fórmula do editor).
// Espelho leitura de QuadroPessoal (pedido de 2026-08-17) — separa Headcount
// Existente (Data-base 31/08/2026, importado) e Novo Headcount (manual),
// cada um com nome/cargo/salário e a folha calculada mês a mês.
function FolhaPessoalLeitura({ funcionarios, premissasPessoal }) {
  const existentes = funcionarios.filter(ehExistente);
  const novos = funcionarios.filter(f => !ehExistente(f));
  const folhaExistente = computeFolhaPessoalAnual(existentes, premissasPessoal);
  const folhaNovo = computeFolhaPessoalAnual(novos, premissasPessoal);

  function ListaLeitura(lista, mostrarAdmissao) {
    if (lista.length === 0) return <div style={{ fontSize: 11, color: '#8A8F96', marginBottom: 8 }}>Nenhum registro.</div>;
    return (
      <div style={{ marginBottom: 10 }}>
        {lista.map(f => (
          <div key={f.id} style={{ fontSize: 11, padding: '4px 2px', borderBottom: `1px solid ${COR.borda}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{f.nome || '(sem nome)'}{f.cargo ? ` — ${f.cargo}` : ''}{mostrarAdmissao && f.mesAdmissao ? ` — admissão ${f.mesAdmissao}` : ''}</span>
            <span style={{ fontWeight: 700, color: COR.azul, flexShrink: 0 }}>{formatBRL(parseNum(f.salario))}/mês</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>Headcount Existente (Data-base 31/08/2026)</div>
      {ListaLeitura(existentes, false)}
      <div style={{ fontSize: 11, fontWeight: 700, color: COR.azul, marginTop: 10, marginBottom: 4 }}>Novo Headcount</div>
      {ListaLeitura(novos, true)}
      <div style={{ overflowX: 'auto', marginTop: 6 }}>
        <table>
          <CabecalhoMensalLeitura />
          <tbody>
            <LinhaCalculadaMensal label="Folha — Headcount Existente" valoresMensal={folhaExistente.mensal.map(m => m.total)} />
            <LinhaCalculadaMensal label="Folha — Novo Headcount" valoresMensal={folhaNovo.mensal.map(m => m.total)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Custos e Despesas, versão leitura — mesmo agrupamento CC → Pacote → Conta
// analítica do editor (AbaCustos/LinhaConta), só que sem nenhum campo
// editável. É a peça central do pedido de 2026-08-17 ("detalhe até a conta
// analítica e por premissas").
// Espelho leitura de LinhaViagem/LinhaContaViagens (pedido de 2026-08-19)
// — usado só quando a conta é CONTA_VIAGENS_CALCULADORA no Corporativo.
function LinhaContaViagensLeitura({ conta, viagens, total }) {
  return (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 6, marginBottom: 6, padding: 10, background: COR.branco }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: COR.texto }}>{conta.nome} <span style={{ fontWeight: 400, color: '#8A8F96' }}>({viagens.length} viagem{viagens.length === 1 ? '' : 'ns'})</span></span>
        <span style={{ fontSize: 11, fontWeight: 700, color: COR.azul }}>{formatBRL(total)}</span>
      </div>
      {viagens.length === 0 && <div style={{ fontSize: 11, color: '#8A8F96' }}>Nenhuma viagem lançada.</div>}
      {viagens.map(v => {
        const valoresMensaisCalc = MESES.map((_, m) => computeViagemMes(v, m));
        return (
          <div key={v.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COR.texto, marginBottom: 4 }}>{v.nome || '(sem nome)'} — {formatBRL(somaMes(valoresMensaisCalc))}</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <CabecalhoMensalLeitura rotuloPrimeiraColuna="Premissa" />
                <tbody>
                  <LinhaCalculadaMensal label="# Pessoas" valoresMensal={(v.pessoas || mesesVazios()).map(parseNum)} formatarCelula={formatarQtdLeitura} />
                  <LinhaCalculadaMensal label="Dias de viagem" valoresMensal={(v.dias || mesesVazios()).map(parseNum)} formatarCelula={formatarQtdLeitura} />
                  <LinhaCalculadaMensal label="Diária Hospedagem (R$)" valoresMensal={(v.diariaHospedagem || mesesVazios()).map(parseNum)} />
                  <LinhaCalculadaMensal label="Alimentação/dia (R$)" valoresMensal={(v.alimentacaoPorDia || mesesVazios()).map(parseNum)} />
                  <LinhaCalculadaMensal label="Valor da Passagem (R$)" valoresMensal={(v.valorPassagem || mesesVazios()).map(parseNum)} />
                  <LinhaCalculadaMensal label="Outros Transportes (R$)" valoresMensal={(v.outrosTransportes || mesesVazios()).map(parseNum)} />
                  <LinhaCalculadaMensal label="Outros 1+2+3 (R$)" valoresMensal={MESES.map((_, m) => parseNum(v.outros1?.[m]) + parseNum(v.outros2?.[m]) + parseNum(v.outros3?.[m]))} />
                  <LinhaCalculadaMensal label="Total da viagem (R$)" valoresMensal={valoresMensaisCalc} />
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustosLeituraVersao({ refUnidade, unidadeId, dados, dre }) {
  const [ccSel, setCcSel] = useState(refUnidade.ccs?.[0]?.codigo);
  const [pacotesAbertos, setPacotesAbertos] = useState({});
  const [contaAberta, setContaAberta] = useState(null);
  const linhas = dados.custos?.linhas || {};
  const funcionarios = dados.custos?.funcionarios || [];
  const premissasPessoal = dados.custos?.premissasPessoal;

  if (!refUnidade.ccs || refUnidade.ccs.length === 0) {
    return <p style={{ fontSize: 12.5, color: '#7A8088' }}>Sem Centros de Custo cadastrados para esta unidade.</p>;
  }
  const ccAtual = refUnidade.ccs.find(c => c.codigo === ccSel) || refUnidade.ccs[0];
  const origemAlvo = ccAtual.tipo === 'producao' ? 'Custo' : 'Despesa';
  function chaveLinha(contaCodigo) { return `${ccSel}|${contaCodigo}`; }
  function totalConta(contaCodigo) { return valorLinhaAnual(linhas[chaveLinha(contaCodigo)], dre.receitaBrutaMes, dre.receitaLiquidaMes); }
  const gruposPacote = (refUnidade.pacotes || [])
    .map(p => ({ ...p, contas: (refUnidade.planoContas?.[p.id] || []).filter(c => c.origem === origemAlvo) }))
    .filter(g => g.contas.length > 0);
  const funcionariosCC = funcionarios.filter(f => f.ccCodigo === ccSel);
  const folhaAtual = computeFolhaPessoalAnual(funcionariosCC, premissasPessoal);
  const totalCC = gruposPacote.filter(g => g.id !== 'pessoal').reduce((acc, g) => acc + g.contas.reduce((a, c) => a + totalConta(c.codigo), 0), 0) + folhaAtual.totalAnual;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {refUnidade.ccs.map(cc => (
          <button key={cc.codigo} onClick={() => { setCcSel(cc.codigo); setContaAberta(null); }}
            style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '6px 11px', borderRadius: 14, cursor: 'pointer',
              border: `1.5px solid ${cc.codigo === ccSel ? COR.azul : COR.borda}`,
              background: cc.codigo === ccSel ? COR.azul : COR.branco, color: cc.codigo === ccSel ? COR.branco : COR.texto,
            }}
          >{cc.nome}</button>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: COR.azul, marginBottom: 10 }}>Total anual — {ccAtual.nome}: {formatBRL(totalCC)}</div>
      {gruposPacote.map(g => {
        const pacoteAberto = !!pacotesAbertos[g.id];
        const totalPacote = g.id === 'pessoal' ? folhaAtual.totalAnual : g.contas.reduce((acc, c) => acc + totalConta(c.codigo), 0);
        return (
          <div key={g.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setPacotesAbertos(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: COR.claro, border: 'none', cursor: 'pointer', fontFamily: FONT }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: COR.azul }}>
                {pacoteAberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {g.nome} <span style={{ fontWeight: 400, color: '#8A8F96' }}>{g.id === 'pessoal' ? `(${funcionariosCC.length} funcionários)` : `(${g.contas.length} contas)`}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: totalPacote > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(totalPacote)}</span>
            </button>
            {pacoteAberto && (
              <div style={{ padding: 8 }}>
                {g.id === 'pessoal' ? (
                  <FolhaPessoalLeitura funcionarios={funcionariosCC} premissasPessoal={premissasPessoal} />
                ) : (
                  g.contas.map(c => (
                    c.codigo === CONTA_VIAGENS_CALCULADORA && unidadeId === 'corporativo' ? (
                      <LinhaContaViagensLeitura key={c.codigo} conta={c} viagens={dados.custos?.viagens?.[ccSel] || []} total={totalConta(c.codigo)} />
                    ) : (
                      <LinhaContaLeitura
                        key={c.codigo} conta={c}
                        linha={linhas[chaveLinha(c.codigo)] || novaLinhaVazia()}
                        aberta={contaAberta === chaveLinha(c.codigo)}
                        onToggle={() => setContaAberta(prev => prev === chaveLinha(c.codigo) ? null : chaveLinha(c.codigo))}
                        total={totalConta(c.codigo)}
                        receitaBrutaMes={dre.receitaBrutaMes} receitaLiquidaMes={dre.receitaLiquidaMes}
                        ocultarClassificacao={unidadeId === 'corporativo'}
                      />
                    )
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Receita, versão leitura — cobre o formato "produtos" (Têxtil/Agrícola) e
// o formato "linhas" (Resorts), este último de forma genérica (mostra os
// campos mensais crus de cada linha) já que a nomenclatura de cada campo é
// específica da aba de edição (AbaReceitaResorts) e reconstruí-la aqui só
// pra leitura não valeria o risco de divergir do cálculo real.
function ReceitaLeituraVersao({ dados }) {
  const receita = dados.receita || {};
  if (Array.isArray(receita.produtos) && receita.produtos.length > 0) {
    return (
      <div>
        <h4 style={{ fontSize: 12.5, color: COR.azul, marginBottom: 8 }}>Produtos — volume, preço e receita</h4>
        {receita.produtos.map(p => (
          <div key={p.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COR.texto, marginBottom: 4 }}>{p.nome}</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <CabecalhoMensalLeitura />
                <tbody>
                  <LinhaCalculadaMensal label="Volume" valoresMensal={(p.volumes || mesesVazios()).map(parseNum)} formatarCelula={formatarQtdLeitura} />
                  {p.precoUsd ? (
                    <>
                      <LinhaCalculadaMensal label="Preço (USD/t)" valoresMensal={(p.precoUsd || mesesVazios()).map(parseNum)} formatarCelula={v => `US$ ${formatarQtdLeitura(v)}`} />
                      <LinhaCalculadaMensal label="Câmbio (R$/USD)" valoresMensal={(p.cambio || mesesVazios()).map(parseNum)} formatarCelula={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} />
                    </>
                  ) : (
                    <LinhaCalculadaMensal label="Preço (R$)" valoresMensal={(p.precos || mesesVazios()).map(parseNum)} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {(receita.deducoes || []).length > 0 && (
          <>
            <h4 style={{ fontSize: 12.5, color: COR.azul, marginTop: 4, marginBottom: 8 }}>Deduções sobre a receita</h4>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <CabecalhoMensalLeitura />
                <tbody>
                  {receita.deducoes.map(d => (
                    <LinhaCalculadaMensal key={d.id} label={d.nome} valoresMensal={(d.pcts || mesesVazios()).map(parseNum)} formatarCelula={formatarPctLeitura} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }
  if (receita.linhas && Object.keys(receita.linhas).length > 0) {
    return (
      <div>
        <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 12 }}>
          Campos mensais de cada linha de receita, como lançados no formulário (formato específico desta unidade).
        </p>
        {Object.entries(receita.linhas).map(([id, linha]) => (
          <div key={id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COR.texto, marginBottom: 4 }}>{id}</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <CabecalhoMensalLeitura />
                <tbody>
                  {Object.entries(linha).filter(([, v]) => Array.isArray(v)).map(([campo, valores]) => (
                    <LinhaCalculadaMensal key={campo} label={campo} valoresMensal={valores.map(parseNum)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p style={{ fontSize: 12.5, color: '#7A8088' }}>Sem dados de receita nesta unidade.</p>;
}

// CAPEX, versão leitura — lista simples (cada projeto é um valor único num
// mês específico, não uma série mensal, mesmo formato do editor AbaCapex).
function CapexLeituraVersao({ dados }) {
  const projetos = dados.capex?.projetos || [];
  const CATEGORIA_LABEL = { carryover: 'Carryover / Comprometido', melhoria_interna: 'Melhoria Interna', desenvolvimento_expansao: 'Desenvolvimento e Expansão' };
  if (projetos.length === 0) return <p style={{ fontSize: 12.5, color: '#7A8088' }}>Nenhum projeto de CAPEX lançado.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {projetos.map(p => (
        <div key={p.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 6, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: COR.texto }}>{p.nome || '(sem nome)'}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: COR.azul }}>{formatBRL(parseNum(p.valor))}</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#7A8088' }}>{CATEGORIA_LABEL[p.categoria] || p.categoria || 'Sem categoria'} · {p.mes || 'sem mês'}</div>
          {p.justificativa && <div style={{ fontSize: 10.5, color: COR.texto, marginTop: 4 }}>{p.justificativa}</div>}
        </div>
      ))}
    </div>
  );
}

// Provisões e resultado financeiro, versão leitura.
function ProvisoesLeituraVersao({ dados }) {
  const provisoes = dados.provisoes || {};
  const resultado = dados.resultado || {};
  return (
    <div>
      <h4 style={{ fontSize: 12.5, color: COR.azul, marginBottom: 8 }}>Provisões</h4>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table>
          <CabecalhoMensalLeitura />
          <tbody>
            <LinhaCalculadaMensal label="Inadimplência (%)" valoresMensal={(provisoes.inadimplencia || mesesVazios()).map(parseNum)} formatarCelula={formatarPctLeitura} />
            <LinhaCalculadaMensal label="Provisão contingências" valoresMensal={(provisoes.contingencias || mesesVazios()).map(parseNum)} />
            <LinhaCalculadaMensal label="Provisão perdas" valoresMensal={(provisoes.perdas || mesesVazios()).map(parseNum)} />
          </tbody>
        </table>
      </div>
      <h4 style={{ fontSize: 12.5, color: COR.azul, marginBottom: 8 }}>Resultado financeiro e outras receitas/despesas</h4>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <CabecalhoMensalLeitura />
          <tbody>
            <LinhaCalculadaMensal label="Receita financeira" valoresMensal={(resultado.receitaFinanceira || mesesVazios()).map(parseNum)} />
            <LinhaCalculadaMensal label="Despesa financeira" valoresMensal={(resultado.despesaFinanceira || mesesVazios()).map(parseNum)} />
            <LinhaCalculadaMensal label="Outras receitas/despesas" valoresMensal={(resultado.outrasReceitasDespesas || mesesVazios()).map(parseNum)} />
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: '#7A8088', marginTop: 8 }}>Alíquota IRCSL sobre EBT (anual): <b style={{ color: COR.texto }}>{resultado.aliquotaIR || '—'}%</b></div>
    </div>
  );
}

const ABAS_DETALHE_VERSAO = [
  { id: 'dre', label: 'DRE' },
  { id: 'receita', label: 'Receita' },
  { id: 'custos', label: 'Custos e Despesas' },
  { id: 'capex', label: 'CAPEX' },
  { id: 'provisoes', label: 'Provisões' },
];

// "Abrir a versão enviada e salva" (pedido de 2026-08-17) — modal de
// leitura por cima da tela, busca o snapshot completo sob demanda (só
// quando o usuário clica "Abrir"; listarVersoes não traz `dados`, ficaria
// pesado numa lista). Não mexe no `dados` que está sendo editado.
//
// Correção de 2026-08-17: a primeira versão só mostrava a Cascata de DRE —
// pedido explícito foi "detalhe até a conta analítica e por premissas, para
// possível comparação" — por isso ganhou abas internas, com destaque pra
// Custos e Despesas (CC → Pacote → Conta, com a premissa por trás de cada
// valor, igual ao editor, só que sem nenhum campo editável).
function ModalVersao({ unidadeId, versaoId, onClose }) {
  const [versao, setVersao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [ifrs18, setIfrs18] = useState(false);
  const [abaDetalhe, setAbaDetalhe] = useState('dre');

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    setVersao(null);
    setAbaDetalhe('dre');
    buscarVersaoApi(unidadeId, versaoId)
      .then(v => { if (!cancelado) setVersao(v); })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar esta versão. Tente novamente.'); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [unidadeId, versaoId]);

  const ref = referenciaDaUnidade(unidadeId);
  const dre = versao ? computeDRE(versao.dados, ref) : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: COR.branco, borderRadius: 10, maxWidth: 900, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h3 style={{ fontSize: 15, color: COR.azul }}>Versão enviada — visualização (somente leitura)</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: '#8A8F96' }}>×</button>
        </div>

        {carregando && <p style={{ fontSize: 12.5, color: '#7A8088' }}>Carregando…</p>}
        {erro && <p style={{ fontSize: 12.5, color: COR.vermelho }}>{erro}</p>}

        {versao && dre && (
          <>
            <div style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
              Autor: <b style={{ color: COR.texto }}>{versao.autor_nome}</b> · Enviado em {formatData(versao.enviado_em)}
              {versao.comentario && <> · {versao.comentario}</>}
            </div>

            <div style={{ display: 'flex', gap: 2, borderBottom: `2px solid ${COR.borda}`, marginBottom: 16, flexWrap: 'wrap' }}>
              {ABAS_DETALHE_VERSAO.map(a => (
                <button
                  key={a.id} onClick={() => setAbaDetalhe(a.id)}
                  style={{
                    fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '8px 12px', cursor: 'pointer',
                    border: 'none', borderBottom: abaDetalhe === a.id ? `3px solid ${COR.laranja}` : '3px solid transparent',
                    background: 'transparent', color: abaDetalhe === a.id ? COR.azul : '#8A8F96', marginBottom: -2,
                  }}
                >{a.label}</button>
              ))}
            </div>

            {abaDetalhe === 'dre' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button
                    onClick={() => setIfrs18(false)}
                    style={{
                      fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
                      border: `1.5px solid ${COR.azul}`, background: !ifrs18 ? COR.azul : COR.branco, color: !ifrs18 ? COR.branco : COR.azul,
                    }}
                  >DRE sem IFRS 18</button>
                  <button
                    onClick={() => setIfrs18(true)}
                    style={{
                      fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
                      border: `1.5px solid ${COR.azul}`, background: ifrs18 ? COR.azul : COR.branco, color: ifrs18 ? COR.branco : COR.azul,
                    }}
                  >DRE com IFRS 18</button>
                </div>
                <CascataDRE dre={dre} ifrs18={ifrs18} />
              </>
            )}
            {abaDetalhe === 'receita' && <ReceitaLeituraVersao dados={versao.dados} />}
            {abaDetalhe === 'custos' && <CustosLeituraVersao refUnidade={ref} unidadeId={unidadeId} dados={versao.dados} dre={dre} />}
            {abaDetalhe === 'capex' && <CapexLeituraVersao dados={versao.dados} />}
            {abaDetalhe === 'provisoes' && <ProvisoesLeituraVersao dados={versao.dados} />}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    nao_iniciado: { texto: 'Não iniciado', bg: COR.claro, cor: '#8A8F96' },
    em_preenchimento: { texto: 'Em preenchimento', bg: COR.total, cor: COR.laranja },
    enviado: { texto: 'Enviado', bg: '#E6F4E6', cor: COR.verde },
  };
  const s = map[status] || map.nao_iniciado;
  return (
    <span style={{ background: s.bg, color: s.cor, fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1px solid ${s.cor}` }}>
      {s.texto}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Abas do formulário
// ---------------------------------------------------------------------------

function AbaEstrategicas({ estrategicas, atualizar, premissasMacro, addObjetivo, updateObjetivo, removeObjetivo, addIniciativa, updateIniciativa, removeIniciativa }) {
  const totalInvestimentoIniciativas = estrategicas.iniciativas.reduce((acc, i) => acc + parseNum(i.investimentoAssociado), 0);

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>1. Premissas Estratégicas</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Ponto de partida do orçamento base zero: contexto, premissas macroeconômicas, objetivos e iniciativas que orientam as escolhas nas próximas etapas (Receita, Custos e Despesas, CAPEX). Estrutura de planejamento estratégico conectado ao orçamento — premissas macro, objetivos no formato OKR, iniciativas com investimento associado e análise SWOT.
      </p>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Contexto estratégico do ciclo</h4>
      <CampoJustificativa
        value={estrategicas.contexto}
        onChange={v => atualizar(['estrategicas', 'contexto'], v)}
        placeholder="Diretrizes da Diretoria para o ciclo 2027: prioridades do Grupo, movimentos de mercado, decisões que mudam o orçamento em relação a 2026"
        obrigatorio
      />

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Premissas macroeconômicas</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Fixadas pelo FP&A Corporativo a partir do Boletim Focus (BCB) — somente leitura nesta visão. Referências para calibrar reajustes de preço, custo e taxas ao longo do formulário; não alimentam o cálculo automaticamente das próximas abas.</p>
      <div style={{ overflowX: 'auto', marginBottom: 22 }}>
        <table>
          <thead>
            <tr>
              <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', textAlign: 'left' }}>Premissa</th>
              <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', textAlign: 'right', minWidth: 100 }}>Valor</th>
              <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', minWidth: 70 }}>Unidade</th>
              <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', minWidth: 140 }}>Fonte / atualização</th>
            </tr>
          </thead>
          <tbody>
            {premissasMacro.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 ? COR.claro : COR.branco }}>
                <td style={{ fontSize: 12, color: COR.texto, padding: '6px 10px', border: `1px solid ${COR.borda}` }}>{p.nome}</td>
                <td style={{ fontSize: 12, fontWeight: 700, color: COR.azul, padding: '6px 10px', border: `1px solid ${COR.borda}`, textAlign: 'right' }}>{p.valor || '—'}</td>
                <td style={{ fontSize: 11, color: '#8A8F96', padding: '6px 10px', border: `1px solid ${COR.borda}` }}>{p.unidade}</td>
                <td style={{ fontSize: 10.5, color: '#8A8F96', padding: '6px 10px', border: `1px solid ${COR.borda}` }}>{p.fonte ? `${p.fonte} — ${formatData(p.atualizadoEm)}` : 'Pendente de definição'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Objetivos estratégicos (OKR)</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Objetivo qualitativo, indicador de acompanhamento e meta numérica para o ciclo.</p>
      {estrategicas.objetivos.map(o => (
        <div key={o.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 10, marginBottom: 8, background: COR.claro, display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr auto', gap: 8, alignItems: 'center' }}>
          <CampoTexto value={o.objetivo} onChange={v => updateObjetivo(o.id, 'objetivo', v)} placeholder="Objetivo (ex.: Aumentar margem EBITDA)" />
          <CampoTexto value={o.indicador} onChange={v => updateObjetivo(o.id, 'indicador', v)} placeholder="Indicador (ex.: Margem EBITDA %)" />
          <CampoTexto value={o.meta} onChange={v => updateObjetivo(o.id, 'meta', v)} placeholder="Meta (ex.: 18%)" />
          <button onClick={() => removeObjetivo(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho }}><Trash2 size={14} /></button>
        </div>
      ))}
      <Botao variante="fantasma" icone={Plus} onClick={addObjetivo}>Adicionar objetivo</Botao>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Iniciativas estratégicas prioritárias</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Iniciativas que conectam a estratégia ao orçamento — o investimento associado orienta o que será detalhado em CAPEX e em Custos e Despesas.</p>
      {estrategicas.iniciativas.map(it => (
        <div key={it.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 10, marginBottom: 8, background: COR.claro }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <CampoTexto value={it.nome} onChange={v => updateIniciativa(it.id, 'nome', v)} placeholder="Nome da iniciativa" />
            <CampoNumero value={it.investimentoAssociado} onChange={v => updateIniciativa(it.id, 'investimentoAssociado', v)} placeholder="Investimento (R$)" />
            <Selecao value={it.prioridade} onChange={v => updateIniciativa(it.id, 'prioridade', v)} opcoes={PRIORIDADES} />
            <button onClick={() => removeIniciativa(it.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho }}><Trash2 size={14} /></button>
          </div>
          <CampoTexto value={it.descricao} onChange={v => updateIniciativa(it.id, 'descricao', v)} placeholder="Descrição breve da iniciativa" />
        </div>
      ))}
      <Botao variante="fantasma" icone={Plus} onClick={addIniciativa}>Adicionar iniciativa</Botao>
      {estrategicas.iniciativas.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 6, padding: '7px 12px' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul }}>Investimento total associado às iniciativas</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: COR.azul }}>{formatBRL(totalInvestimentoIniciativas)}</span>
        </div>
      )}

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Análise SWOT</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <Rotulo>Forças</Rotulo>
          <textarea
            value={estrategicas.swot.forcas} onChange={e => atualizar(['estrategicas', 'swot', 'forcas'], e.target.value)} rows={3}
            placeholder="Vantagens internas do negócio hoje"
            style={{ width: '100%', border: `1px solid ${COR.verde}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 12, color: COR.texto, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
        <div>
          <Rotulo>Fraquezas</Rotulo>
          <textarea
            value={estrategicas.swot.fraquezas} onChange={e => atualizar(['estrategicas', 'swot', 'fraquezas'], e.target.value)} rows={3}
            placeholder="Limitações internas a endereçar no ciclo"
            style={{ width: '100%', border: `1px solid ${COR.vermelho}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 12, color: COR.texto, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
        <div>
          <Rotulo>Oportunidades</Rotulo>
          <textarea
            value={estrategicas.swot.oportunidades} onChange={e => atualizar(['estrategicas', 'swot', 'oportunidades'], e.target.value)} rows={3}
            placeholder="Fatores externos favoráveis"
            style={{ width: '100%', border: `1px solid ${COR.azul}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 12, color: COR.texto, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
        <div>
          <Rotulo>Ameaças</Rotulo>
          <textarea
            value={estrategicas.swot.ameacas} onChange={e => atualizar(['estrategicas', 'swot', 'ameacas'], e.target.value)} rows={3}
            placeholder="Fatores externos de risco"
            style={{ width: '100%', border: `1px solid ${COR.laranja}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 12, color: COR.texto, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
}

function AbaReceita({ unidadeId, produtos, deducoes, deducoesJustificativa, justificativaGeral, updateProduto, updateDeducao, atualizar, dre }) {
  const mostrarReferenciaTextil = unidadeId === 'textil';
  const volumeTotalMes = MESES.map((_, m) => produtos.reduce((acc, p) => acc + parseNum(p.volumes?.[m]), 0));
  const volumeTotalAnual = volumeTotalMes.reduce((a, v) => a + v, 0);
  const precoPonderadoMes = MESES.map((_, m) => (volumeTotalMes[m] > 0 ? dre.receitaBrutaMes[m] / volumeTotalMes[m] : 0));
  const precoPonderadoAnual = volumeTotalAnual > 0 ? dre.receitaBruta / volumeTotalAnual : 0;

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>2. Premissas de receita</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>Volume e preço por produto, mês a mês (aba "1.1 DRE"). O orçamento é base zero — projete do zero, mês a mês. Linhas cinzas "referência" trazem o realizado/orçado 2026 (fonte: Premissas_por_Empresa.xlsx) só para contexto — não alimentam o cálculo de 2027.</p>

      {produtos.map((p, i) => {
        const ref = PRODUTOS_REF.find(r => r.nome === p.nome);
        const receitaMensal = MESES.map((_, m) => parseNum(p.volumes[m]) * parseNum(p.precos[m]));
        const totalProduto = receitaMensal.reduce((a, v) => a + v, 0);
        const temCambio = p.precoUsd !== undefined; // "Vendas Externas" da Agrícola — ver receitaVazia()
        return (
          <div key={p.id} style={{ marginBottom: 18, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 12, background: i % 2 ? COR.claro : COR.branco }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul }}>{p.nome}</span>
              <span style={{ fontSize: 10.5, color: '#8A8F96' }}>
                {ref ? `Referência 2026: ${ref.volumeRef} t · R$ ${ref.precoRef.toFixed(2)}/t` : '—'}
              </span>
            </div>
            {temCambio && (
              <p style={{ fontSize: 10.5, color: '#7A8088', marginBottom: 8 }}>
                Racional: Volume × Preço (USD/t) × Câmbio (R$/USD) — preço em reais é derivado, não digitado direto.
              </p>
            )}
            <TabelaMensal
              linhas={temCambio ? [
                { key: 'volume', label: 'Volume (t)', valores: p.volumes },
                { key: 'precoUsd', label: 'Preço (USD/t)', valores: p.precoUsd },
                { key: 'cambio', label: 'Câmbio (R$/USD)', valores: p.cambio },
              ] : [
                { key: 'volume', label: 'Volume (t)', valores: p.volumes },
                { key: 'preco', label: 'Preço (R$/t)', valores: p.precos },
              ]}
              onChangeCelula={(linhaKey, mesIdx, valor) => {
                if (!temCambio) {
                  const campo = linhaKey === 'volume' ? 'volumes' : 'precos';
                  const novoArray = p[campo].map((v, idx) => idx === mesIdx ? valor : v);
                  updateProduto(p.id, campo, novoArray);
                  return;
                }
                if (linhaKey === 'volume') {
                  updateProduto(p.id, 'volumes', p.volumes.map((v, idx) => idx === mesIdx ? valor : v));
                  return;
                }
                const campo = linhaKey === 'precoUsd' ? 'precoUsd' : 'cambio';
                const novoArray = p[campo].map((v, idx) => idx === mesIdx ? valor : v);
                const precoUsdAtual = campo === 'precoUsd' ? novoArray : p.precoUsd;
                const cambioAtual = campo === 'cambio' ? novoArray : p.cambio;
                const novosPrecos = precoUsdAtual.map((v, idx) => parseNum(v) * parseNum(cambioAtual[idx]));
                atualizar(['receita', 'produtos'], produtos.map(x => x.id === p.id
                  ? { ...x, [campo]: novoArray, precos: novosPrecos }
                  : x
                ));
              }}
              corTotal={COR.azul}
              linhasCalculadas={[
                ...(temCambio ? [
                  { key: 'precoRs', label: 'Preço derivado (R$/t)', valoresMensal: p.precos.map(parseNum), totalValor: somaMes(p.precos) / 12, cor: COR.texto, formatarCelula: v => formatBRL(v), formatarTotal: v => formatBRL(v) },
                ] : []),
                { key: 'receita', label: 'Receita (R$)', valoresMensal: receitaMensal, totalValor: totalProduto, cor: COR.verde },
                ...(REFERENCIA_2026_TEXTIL.volume[p.nome] ? [
                  { key: 'volume2026', label: 'Volume 2026 (referência, t)', valoresMensal: REFERENCIA_2026_TEXTIL.volume[p.nome], totalValor: REFERENCIA_2026_TEXTIL.volume[p.nome].reduce((a, v) => a + v, 0), cor: '#8A8F96', formatarCelula: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), formatarTotal: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
                  { key: 'preco2026', label: 'Preço 2026 (referência, R$/t)', valoresMensal: REFERENCIA_2026_TEXTIL.preco[p.nome], totalValor: REFERENCIA_2026_TEXTIL.preco[p.nome].reduce((a, v) => a + v, 0) / 12, cor: '#8A8F96', formatarCelula: v => formatBRL(v), formatarTotal: v => formatBRL(v) },
                ] : []),
              ]}
            />
          </div>
        );
      })}

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Receita Operacional Bruta — consolidado</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Volume total, preço médio ponderado e receita bruta, mês a mês, somando todos os produtos.</p>
      <TabelaMensal
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={[
          { key: 'volumeTotal', label: 'Volume total (t)', valoresMensal: volumeTotalMes, totalValor: volumeTotalAnual, cor: COR.azul, formatarCelula: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), formatarTotal: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
          { key: 'precoPonderado', label: 'Preço ponderado (R$/t)', valoresMensal: precoPonderadoMes, totalValor: precoPonderadoAnual, cor: COR.texto, formatarCelula: v => formatBRL(v), formatarTotal: v => formatBRL(v) },
          { key: 'receitaBruta', label: 'Receita Operacional Bruta (R$)', valoresMensal: dre.receitaBrutaMes, totalValor: dre.receitaBruta, cor: COR.verde },
        ]}
      />

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Justificativas sobre a projeção de receita</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>O porquê do zero da receita como um todo — não é necessário justificar cada produto individualmente.</p>
      <CampoJustificativa
        value={justificativaGeral}
        onChange={v => atualizar(['receita', 'justificativaGeral'], v)}
        placeholder="Justificativa geral da premissa de receita (ex.: novos clientes, sazonalidade, reajustes de preço, mix de produtos)"
        obrigatorio
      />

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Deduções sobre a receita</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Percentual sobre a receita bruta, mês a mês. Linhas em laranja mostram o valor absoluto (R$) correspondente e o total geral das deduções.</p>
      <TabelaMensal
        linhas={deducoes.map(d => ({ key: d.id, label: d.nome, valores: d.pcts }))}
        onChangeCelula={(dedId, mesIdx, valor) => {
          const d = deducoes.find(x => x.id === dedId);
          const novoArray = d.pcts.map((v, idx) => idx === mesIdx ? valor : v);
          updateDeducao(dedId, novoArray);
        }}
        corTotal={COR.vermelho}
        sufixo="%"
        linhasCalculadas={[
          ...deducoes.map(d => {
            const valoresMensal = MESES.map((_, m) => (dre.receitaBrutaMes?.[m] || 0) * (parseNum(d.pcts?.[m]) / 100));
            return { key: `${d.id}_abs`, label: `${d.nome} (R$)`, valoresMensal, totalValor: valoresMensal.reduce((a, v) => a + v, 0), cor: COR.vermelho };
          }),
          {
            key: 'total_deducoes',
            label: 'Total de deduções (R$)',
            valoresMensal: MESES.map((_, m) => (dre.receitaBrutaMes?.[m] || 0) * (deducoes.reduce((acc, d) => acc + parseNum(d.pcts?.[m]), 0) / 100)),
            totalValor: dre.deducoes,
            cor: COR.azul,
          },
          ...deducoes.filter(d => mostrarReferenciaTextil && REFERENCIA_2026_TEXTIL.deducoes[d.nome]).map(d => {
            const valoresMensal = REFERENCIA_2026_TEXTIL.deducoes[d.nome].map(v => Math.abs(v));
            return { key: `${d.id}_2026`, label: `${d.nome} 2026 (referência, R$)`, valoresMensal, totalValor: valoresMensal.reduce((a, v) => a + v, 0), cor: '#8A8F96' };
          }),
        ]}
      />
      <div style={{ marginTop: 8 }}>
        <CampoJustificativa
          value={deducoesJustificativa}
          onChange={v => atualizar(['receita', 'deducoesJustificativa'], v)}
          placeholder="Justificativa geral das deduções (ex.: mudança de alíquota, novo estado de destino)"
          obrigatorio
        />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Receita Operacional Líquida — mensal</h4>
      <TabelaMensal
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={[
          { key: 'receitaLiquida', label: 'Receita Operacional Líquida (R$)', valoresMensal: dre.receitaLiquidaMes, totalValor: dre.receitaLiquida, cor: COR.verde },
          ...(mostrarReferenciaTextil ? [
            { key: 'receitaLiquida2026', label: 'Receita Líquida 2026 (referência, R$)', valoresMensal: REFERENCIA_2026_TEXTIL.receitaLiquida, totalValor: REFERENCIA_2026_TEXTIL.receitaLiquida.reduce((a, v) => a + v, 0), cor: '#8A8F96' },
          ] : []),
        ]}
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        <CardTotal label="Receita bruta" valor={dre.receitaBruta} cor={COR.azul} />
        <CardTotal label="Deduções" valor={-dre.deducoes} cor={COR.vermelho} />
        <CardTotal label="Receita líquida" valor={dre.receitaLiquida} cor={COR.verde} />
      </div>
    </div>
  );
}

// Modelo de receita de hotelaria (ARA Resorts) — estruturalmente diferente
// de Volume × Preço por produto (Têxtil/Agrícola): cada linha é
// quantidade × valor unitário (Hospedagem, A&B, Café e Pensão) ou valor
// direto por mês (Moorea, Outras Receitas). Estrutura e valores de
// referência vêm de "Premissas por Empresa.xlsx" (fornecida em 2026-08-09).
// Reaproveita valorLinhaMes/valorLinhaAnual — a mesma mecânica já usada em
// Custos — em vez de inventar um cálculo novo.
function AbaReceitaResorts({ linhas, deducoes, deducoesJustificativa, justificativaGeral, atualizar, dre }) {
  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>2. Premissas de receita — ARA Resorts</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Modelo de hotelaria: Hospedagem, Alimentação &amp; Bebidas e Café e Pensão são calculados por
        quantidade × valor unitário (acomodações ocupadas × tarifa, adultos × consumo médio); as demais
        linhas são valor direto por mês. Estrutura vinda de Premissas_por_Empresa.xlsx (aba Premissas_Resorts).
      </p>

      {LINHAS_RECEITA_RESORTS.map((def, i) => {
        const linha = linhas[def.id] || novaLinhaVazia();
        const receitaMensal = MESES.map((_, m) => valorLinhaMes(linha, m, null, null));
        const totalLinha = receitaMensal.reduce((a, v) => a + v, 0);
        // Hospedagem: a "quantidade" (acomodações ocupadas) não é digitada
        // direto — é derivada de Total de Acomodações × Taxa de Ocupação
        // (mesmo racional da planilha: linha 16 = linha 17 × linha 18).
        // Pedido explícito de 2026-08-09.
        const ehHospedagem = def.id === 'hospedagem';
        const camposEditaveis = ehHospedagem
          ? [
              { key: 'totalAcomodacoes', label: 'Total de Acomodações (#) — UH × dias do mês', valores: linha.totalAcomodacoes || mesesVazios() },
              { key: 'taxaOcupacao', label: 'Taxa de Ocupação (%)', valores: linha.taxaOcupacao || mesesVazios() },
              { key: 'valorUnit', label: def.rotuloValor, valores: linha.valoresUnit },
            ]
          : def.tipo === 'qtd_valor'
          ? [
              { key: 'quantidade', label: def.rotuloQtd, valores: linha.quantidades },
              { key: 'valorUnit', label: def.rotuloValor, valores: linha.valoresUnit },
            ]
          : [
              { key: 'valor', label: 'Valor (R$)', valores: linha.valores },
            ];
        return (
          <div key={def.id} style={{ marginBottom: 18, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 12, background: i % 2 ? COR.claro : COR.branco }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 8 }}>{def.nome}</div>
            {ehHospedagem && (
              <p style={{ fontSize: 10.5, color: '#7A8088', marginBottom: 8 }}>
                Racional: Total de Acomodações × Taxa de Ocupação = Acomodações Ocupadas; × Tarifa Média = Receita.
              </p>
            )}
            <TabelaMensal
              linhas={camposEditaveis}
              onChangeCelula={(campoKey, mesIdx, valor) => {
                if (ehHospedagem && (campoKey === 'totalAcomodacoes' || campoKey === 'taxaOcupacao')) {
                  const totalAtual = (linha.totalAcomodacoes || mesesVazios()).map((v, idx) => (campoKey === 'totalAcomodacoes' && idx === mesIdx) ? valor : v);
                  const taxaAtual = (linha.taxaOcupacao || mesesVazios()).map((v, idx) => (campoKey === 'taxaOcupacao' && idx === mesIdx) ? valor : v);
                  const novasQuantidades = totalAtual.map((v, idx) => parseNum(v) * (parseNum(taxaAtual[idx]) / 100));
                  atualizar(['receita', 'linhas', def.id], {
                    ...linha, totalAcomodacoes: totalAtual, taxaOcupacao: taxaAtual, quantidades: novasQuantidades,
                  });
                  return;
                }
                const campo = campoKey === 'quantidade' ? 'quantidades' : campoKey === 'valorUnit' ? 'valoresUnit' : 'valores';
                const base = campo === 'quantidades' ? linha.quantidades : campo === 'valoresUnit' ? linha.valoresUnit : linha.valores;
                const novoArray = (base || mesesVazios()).map((v, idx) => idx === mesIdx ? valor : v);
                atualizar(['receita', 'linhas', def.id], { ...linha, [campo]: novoArray });
              }}
              corTotal={COR.azul}
              linhasCalculadas={[
                ...(ehHospedagem ? [
                  { key: 'ocupadas', label: 'Acomodações Ocupadas (#, derivado)', valoresMensal: (linha.quantidades || mesesVazios()).map(parseNum), totalValor: somaMes(linha.quantidades) / 12, cor: COR.texto, formatarCelula: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), formatarTotal: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
                ] : []),
                { key: 'receita', label: 'Receita (R$)', valoresMensal: receitaMensal, totalValor: totalLinha, cor: COR.verde },
              ]}
            />
            <div style={{ marginTop: 8 }}>
              <CampoJustificativa
                value={linha.justificativa}
                onChange={v => atualizar(['receita', 'linhas', def.id], { ...linha, justificativa: v })}
                placeholder={`Justificativa da premissa de ${def.nome}`}
              />
            </div>
          </div>
        );
      })}

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Receita Operacional Bruta — consolidado</h4>
      <TabelaMensal
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={[
          { key: 'receitaBruta', label: 'Receita Operacional Bruta (R$)', valoresMensal: dre.receitaBrutaMes, totalValor: dre.receitaBruta, cor: COR.verde },
        ]}
      />

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Justificativas sobre a projeção de receita</h4>
      <CampoJustificativa
        value={justificativaGeral}
        onChange={v => atualizar(['receita', 'justificativaGeral'], v)}
        placeholder="Justificativa geral da premissa de receita (ex.: taxa de ocupação esperada, tarifa média, sazonalidade)"
        obrigatorio
      />

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 22, marginBottom: 8 }}>Deduções sobre a receita</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>
        Cada dedução incide sobre a receita da linha específica que ela referencia (ex.: PIS sobre Hospedagem
        incide só sobre a receita de Hospedagem, não sobre o total) — não sobre a receita bruta total.
      </p>
      <TabelaMensal
        linhas={deducoes.map(d => ({ key: d.id, label: d.nome, valores: d.pcts }))}
        onChangeCelula={(dedId, mesIdx, valor) => {
          const d = deducoes.find(x => x.id === dedId);
          const novoArray = d.pcts.map((v, idx) => idx === mesIdx ? valor : v);
          atualizar(['receita', 'deducoes'], deducoes.map(x => x.id === dedId ? { ...x, pcts: novoArray } : x));
        }}
        corTotal={COR.vermelho}
        sufixo="%"
        linhasCalculadas={deducoes.map(d => {
          const baseMes = MESES.map((_, m) =>
            (d.baseLinhaIds || []).reduce((s, id) => s + valorLinhaMes(linhas[id] || novaLinhaVazia(), m, null, null), 0)
          );
          const valoresMensal = MESES.map((_, m) => baseMes[m] * (parseNum(d.pcts?.[m]) / 100));
          return { key: `${d.id}_abs`, label: `${d.nome} (R$)`, valoresMensal, totalValor: valoresMensal.reduce((a, v) => a + v, 0), cor: COR.vermelho };
        })}
      />
      <div style={{ marginTop: 8 }}>
        <CampoJustificativa
          value={deducoesJustificativa}
          onChange={v => atualizar(['receita', 'deducoesJustificativa'], v)}
          placeholder="Justificativa geral das deduções"
          obrigatorio
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        <CardTotal label="Receita bruta" valor={dre.receitaBruta} cor={COR.azul} />
        <CardTotal label="Deduções" valor={-dre.deducoes} cor={COR.vermelho} />
        <CardTotal label="Receita líquida" valor={dre.receitaLiquida} cor={COR.verde} />
      </div>
    </div>
  );
}

function atualizarArray(arr, idx, valor) {
  const novo = [...(arr || mesesVazios())];
  novo[idx] = valor;
  return novo;
}

// Uma linha de 12 células editáveis (mês a mês) dentro da grade de premissa de uma conta.
function GradeMensalLinha({ label, valores, onChange, formatarTotal }) {
  const vals = valores || mesesVazios();
  const total = somaMes(vals);
  return (
    <tr>
      <td style={{ fontSize: 10.5, color: COR.texto, padding: '4px 8px', border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: COR.branco, whiteSpace: 'nowrap' }}>{label}</td>
      {MESES.map((m, mi) => (
        <td key={m} style={{ padding: 2, border: `1px solid ${COR.borda}` }}>
          <input
            type="text" inputMode="decimal" value={vals[mi]}
            onChange={e => onChange(mi, e.target.value)}
            style={{ width: '100%', minWidth: 56, border: 'none', outline: 'none', padding: '5px 4px', fontFamily: FONT, fontSize: 10.5, color: COR.texto, background: 'transparent', boxSizing: 'border-box', textAlign: 'right' }}
          />
        </td>
      ))}
      <td style={{ padding: '4px 8px', border: `1px solid ${COR.borda}`, background: COR.claro, fontSize: 10.5, fontWeight: 700, textAlign: 'right', color: COR.azul }}>
        {formatarTotal ? formatarTotal(total) : total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
      </td>
    </tr>
  );
}

// Linha somente leitura com o valor calculado mês a mês (resultado da
// premissa). formatarCelula/formatarTotal opcionais — usados pra reaproveitar
// este componente em linhas somente-leitura de % ou quantidade (não só R$),
// ver LinhaContaLeitura e a visualização de versão do histórico.
function LinhaCalculadaMensal({ label, valoresMensal, formatarCelula, formatarTotal }) {
  const total = valoresMensal.reduce((a, v) => a + (v || 0), 0);
  const fCelula = formatarCelula || formatBRL;
  const fTotal = formatarTotal || formatarCelula || formatBRL;
  return (
    <tr>
      <td style={{ fontSize: 10.5, fontWeight: 700, color: COR.azul, padding: '4px 8px', border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: COR.total, whiteSpace: 'nowrap' }}>{label}</td>
      {valoresMensal.map((v, mi) => (
        <td key={mi} style={{ padding: '4px 6px', border: `1px solid ${COR.borda}`, background: COR.total, fontSize: 10, textAlign: 'right', color: COR.texto }}>
          {v ? fCelula(v) : '—'}
        </td>
      ))}
      <td style={{ padding: '4px 8px', border: `1px solid ${COR.borda}`, background: COR.laranja, fontSize: 10.5, fontWeight: 700, textAlign: 'right', color: COR.branco }}>
        {fTotal(total)}
      </td>
    </tr>
  );
}

function LinhaConta({ conta, linha, aberta, onToggle, onUpdate, total, receitaBrutaMes, receitaLiquidaMes, ocultarClassificacao }) {
  const valoresMensaisCalc = MESES.map((_, m) => valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes));
  const incoerente = linhaIncoerente(linha);

  return (
    <div style={{ border: `1px solid ${incoerente ? COR.vermelho : COR.borda}`, borderRadius: 6, marginBottom: 6, background: COR.branco, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '8px 10px', background: aberta ? COR.claro : COR.branco, border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span style={{ fontSize: 10.5, color: '#8A8F96', flexShrink: 0 }}>{conta.codigo}</span>
          <span style={{ fontSize: 11.5, color: COR.texto, fontWeight: aberta ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conta.nome.toLowerCase()}</span>
          {incoerente && <AlertTriangle size={13} color={COR.vermelho} style={{ flexShrink: 0 }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!ocultarClassificacao && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ display: 'flex', border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}
            >
              <button
                onClick={() => onUpdate('classificacao', 'fixo')}
                style={{
                  fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '2px 8px', border: 'none', cursor: 'pointer',
                  background: linha.classificacao === 'fixo' ? COR.azul : COR.branco,
                  color: linha.classificacao === 'fixo' ? COR.branco : '#8A8F96',
                }}
              >Fixo</button>
              <button
                onClick={() => onUpdate('classificacao', 'variavel')}
                style={{
                  fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '2px 8px', border: 'none', cursor: 'pointer',
                  background: linha.classificacao === 'variavel' ? COR.laranja : COR.branco,
                  color: linha.classificacao === 'variavel' ? COR.branco : '#8A8F96',
                }}
              >Variável</button>
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: total > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(total)}</span>
        </div>
      </button>
      {aberta && (
        <div style={{ padding: '10px 10px 12px', borderTop: `1px solid ${COR.borda}` }}>
          <div style={{ marginBottom: 8, maxWidth: 260 }}>
            <Selecao value={linha.premissaTipo} onChange={v => onUpdate('premissaTipo', v)} opcoes={TIPOS_PREMISSA} />
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 8 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', textAlign: 'left', position: 'sticky', left: 0 }}>Premissa</th>
                  {MESES.map(m => (
                    <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 4px', minWidth: 58 }}>{m}</th>
                  ))}
                  <th style={{ background: COR.laranja, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 78 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {linha.premissaTipo === 'direto' && (
                  <GradeMensalLinha label="Valor (R$)" valores={linha.valores} onChange={(mi, v) => onUpdate('valores', atualizarArray(linha.valores, mi, v))} />
                )}
                {linha.premissaTipo === 'qtd_valor' && (
                  <>
                    <GradeMensalLinha label={`Quantidade${linha.unidadeMedida ? ` (${linha.unidadeMedida})` : ''}`} valores={linha.quantidades} onChange={(mi, v) => onUpdate('quantidades', atualizarArray(linha.quantidades, mi, v))} />
                    <GradeMensalLinha label="Valor unit. (R$)" valores={linha.valoresUnit} onChange={(mi, v) => onUpdate('valoresUnit', atualizarArray(linha.valoresUnit, mi, v))} />
                    <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
                  </>
                )}
                {linha.premissaTipo === 'rateio' && (
                  <>
                    {linha.baseTipo === 'manual' && (
                      <GradeMensalLinha label="Base manual (R$)" valores={linha.baseManual} onChange={(mi, v) => onUpdate('baseManual', atualizarArray(linha.baseManual, mi, v))} />
                    )}
                    <GradeMensalLinha label="Percentual (%)" valores={linha.percentuais} onChange={(mi, v) => onUpdate('percentuais', atualizarArray(linha.percentuais, mi, v))} />
                    <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {linha.premissaTipo === 'qtd_valor' && (
              <div style={{ maxWidth: 260, flex: 1 }}>
                <CampoTexto value={linha.unidadeMedida} onChange={v => onUpdate('unidadeMedida', v)} placeholder="Unidade de medida (ex.: kg, kWh, viagens)" />
              </div>
            )}
            {linha.premissaTipo === 'rateio' && (
              <div style={{ maxWidth: 260, flex: 1 }}>
                <Selecao value={linha.baseTipo} onChange={v => onUpdate('baseTipo', v)} opcoes={BASES_RATEIO} />
              </div>
            )}
          </div>
          {incoerente && (
            <div style={{ fontSize: 10.5, color: COR.vermelho, marginBottom: 6 }}>
              Há mês com apenas um dos dois campos da premissa preenchido — revisar antes de enviar.
            </div>
          )}
          <CampoJustificativa value={linha.justificativa} onChange={v => onUpdate('justificativa', v)} />
        </div>
      )}
    </div>
  );
}

// Uma viagem nomeada dentro da calculadora de "Passagem e Hospedagem" —
// pedido de 2026-08-19, ver CONTA_VIAGENS_CALCULADORA/computeViagemMes. Os
// 7 campos e a fórmula da linha 6 batem exatamente com Viagens.xlsx.
function LinhaViagem({ viagem, aberta, onToggle, onUpdate, onRemove }) {
  const valoresMensaisCalc = MESES.map((_, m) => computeViagemMes(viagem, m));
  const total = somaMes(valoresMensaisCalc);
  return (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 6, marginBottom: 6, background: COR.branco, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '8px 10px', background: aberta ? COR.claro : COR.branco, border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span style={{ fontSize: 11.5, color: COR.texto, fontWeight: aberta ? 700 : 400 }}>{viagem.nome || '(sem nome — clique para nomear a viagem/destino)'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: total > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(total)}</span>
          <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ color: COR.vermelho, cursor: 'pointer', display: 'flex' }}><Trash2 size={13} /></span>
        </div>
      </button>
      {aberta && (
        <div style={{ padding: '10px 10px 12px', borderTop: `1px solid ${COR.borda}` }}>
          <div style={{ marginBottom: 8, maxWidth: 320 }}>
            <CampoTexto value={viagem.nome} onChange={v => onUpdate('nome', v)} placeholder="Nome da viagem (destino)" />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', textAlign: 'left', position: 'sticky', left: 0 }}>Premissa</th>
                  {MESES.map(m => (
                    <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 4px', minWidth: 58 }}>{m}</th>
                  ))}
                  <th style={{ background: COR.laranja, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 78 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <GradeMensalLinha label="# Pessoas" valores={viagem.pessoas} onChange={(mi, v) => onUpdate('pessoas', atualizarArray(viagem.pessoas, mi, v))} />
                <GradeMensalLinha label="Dias de viagem (# diárias)" valores={viagem.dias} onChange={(mi, v) => onUpdate('dias', atualizarArray(viagem.dias, mi, v))} />
                <GradeMensalLinha label="Diária da Hospedagem (R$)" valores={viagem.diariaHospedagem} onChange={(mi, v) => onUpdate('diariaHospedagem', atualizarArray(viagem.diariaHospedagem, mi, v))} />
                <GradeMensalLinha label="Alimentação por dia (R$)" valores={viagem.alimentacaoPorDia} onChange={(mi, v) => onUpdate('alimentacaoPorDia', atualizarArray(viagem.alimentacaoPorDia, mi, v))} />
                <GradeMensalLinha label="Valor da Passagem (R$)" valores={viagem.valorPassagem} onChange={(mi, v) => onUpdate('valorPassagem', atualizarArray(viagem.valorPassagem, mi, v))} />
                <GradeMensalLinha label="Outros Transportes (R$)" valores={viagem.outrosTransportes} onChange={(mi, v) => onUpdate('outrosTransportes', atualizarArray(viagem.outrosTransportes, mi, v))} />
                <GradeMensalLinha label="Outros 1 (R$)" valores={viagem.outros1} onChange={(mi, v) => onUpdate('outros1', atualizarArray(viagem.outros1, mi, v))} />
                <GradeMensalLinha label="Outros 2 (R$)" valores={viagem.outros2} onChange={(mi, v) => onUpdate('outros2', atualizarArray(viagem.outros2, mi, v))} />
                <GradeMensalLinha label="Outros 3 (R$)" valores={viagem.outros3} onChange={(mi, v) => onUpdate('outros3', atualizarArray(viagem.outros3, mi, v))} />
                <LinhaCalculadaMensal label="Total da viagem (R$)" valoresMensal={valoresMensaisCalc} />
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 10, color: '#8A8F96', marginTop: 6 }}>
            Total = (Dias × Diária Hospedagem + Dias × Alimentação/dia + Passagem + Outros Transportes + Outros 1+2+3) × Pessoas — mesma fórmula da planilha Viagens.xlsx (linha 6).
          </p>
        </div>
      )}
    </div>
  );
}

// Tela dedicada — pedido de 2026-08-19 ("tela dedicada só para essa conta",
// não um tipo de premissa geral) — substitui LinhaConta só pra
// CONTA_VIAGENS_CALCULADORA. Lista de viagens nomeadas (LinhaViagem), soma
// tudo e sincroniza o total em custos.linhas via onUpdateViagens (ver
// AbaCustos).
function LinhaContaViagens({ conta, viagens, aberta, onToggle, onUpdateViagens, total }) {
  const [viagemAberta, setViagemAberta] = useState(null);

  function addViagem() {
    const nova = novaViagem();
    onUpdateViagens([...viagens, nova]);
    setViagemAberta(nova.id);
  }
  function updateViagem(id, campo, valor) {
    onUpdateViagens(viagens.map(v => v.id === id ? { ...v, [campo]: valor } : v));
  }
  function removeViagem(id) {
    onUpdateViagens(viagens.filter(v => v.id !== id));
  }

  return (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 6, marginBottom: 6, background: COR.branco, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '8px 10px', background: aberta ? COR.claro : COR.branco, border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span style={{ fontSize: 10.5, color: '#8A8F96', flexShrink: 0 }}>{conta.codigo}</span>
          <span style={{ fontSize: 11.5, color: COR.texto, fontWeight: aberta ? 700 : 400 }}>{conta.nome.toLowerCase()} <span style={{ color: '#8A8F96', fontWeight: 400 }}>({viagens.length} viagem{viagens.length === 1 ? '' : 'ns'})</span></span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: total > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(total)}</span>
      </button>
      {aberta && (
        <div style={{ padding: '10px 10px 12px', borderTop: `1px solid ${COR.borda}` }}>
          <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 8 }}>
            Uma linha por viagem (destino) — quantidade de pessoas, dias, hospedagem, passagem, transporte, alimentação e outros custos, mês a mês.
            O total de cada viagem soma no total da conta.
          </p>
          {viagens.map(v => (
            <LinhaViagem
              key={v.id} viagem={v}
              aberta={viagemAberta === v.id}
              onToggle={() => setViagemAberta(prev => prev === v.id ? null : v.id)}
              onUpdate={(campo, valor) => updateViagem(v.id, campo, valor)}
              onRemove={() => removeViagem(v.id)}
            />
          ))}
          <Botao variante="fantasma" icone={Plus} onClick={addViagem}>Adicionar viagem</Botao>
        </div>
      )}
    </div>
  );
}

// Espelho somente-leitura de LinhaConta — usado na visualização detalhada de
// versões do histórico (pedido de 2026-08-17: "detalhe até a conta
// analítica e por premissas"). Mostra as mesmas linhas de premissa que o
// editor mostra (quantidade/valor unit., ou base/%, ou valor direto), só
// que via LinhaCalculadaMensal (sem <input>) em vez de GradeMensalLinha.
function LinhaContaLeitura({ conta, linha, aberta, onToggle, total, receitaBrutaMes, receitaLiquidaMes, ocultarClassificacao }) {
  const valoresMensaisCalc = MESES.map((_, m) => valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes));
  const formatarPct = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  return (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 6, marginBottom: 6, background: COR.branco, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '8px 10px', background: aberta ? COR.claro : COR.branco, border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span style={{ fontSize: 10.5, color: '#8A8F96', flexShrink: 0 }}>{conta.codigo}</span>
          <span style={{ fontSize: 11.5, color: COR.texto, fontWeight: aberta ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conta.nome.toLowerCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!ocultarClassificacao && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8A8F96' }}>{linha.classificacao === 'variavel' ? 'Variável' : 'Fixo'}</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color: total > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(total)}</span>
        </div>
      </button>
      {aberta && (
        <div style={{ padding: '10px 10px 12px', borderTop: `1px solid ${COR.borda}` }}>
          <div style={{ fontSize: 10.5, color: '#7A8088', marginBottom: 8 }}>
            Premissa: <b style={{ color: COR.texto }}>{TIPOS_PREMISSA.find(t => t.id === linha.premissaTipo)?.nome || linha.premissaTipo}</b>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 8 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', textAlign: 'left', position: 'sticky', left: 0 }}>Premissa</th>
                  {MESES.map(m => (
                    <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 4px', minWidth: 58 }}>{m}</th>
                  ))}
                  <th style={{ background: COR.laranja, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 78 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {linha.premissaTipo === 'direto' && (
                  <LinhaCalculadaMensal label="Valor (R$)" valoresMensal={(linha.valores || mesesVazios()).map(parseNum)} />
                )}
                {linha.premissaTipo === 'qtd_valor' && (
                  <>
                    <LinhaCalculadaMensal label={`Quantidade${linha.unidadeMedida ? ` (${linha.unidadeMedida})` : ''}`} valoresMensal={(linha.quantidades || mesesVazios()).map(parseNum)} formatarCelula={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} />
                    <LinhaCalculadaMensal label="Valor unit. (R$)" valoresMensal={(linha.valoresUnit || mesesVazios()).map(parseNum)} />
                    <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
                  </>
                )}
                {linha.premissaTipo === 'rateio' && (
                  <>
                    {linha.baseTipo === 'manual' && (
                      <LinhaCalculadaMensal label="Base manual (R$)" valoresMensal={(linha.baseManual || mesesVazios()).map(parseNum)} />
                    )}
                    <LinhaCalculadaMensal label={`Percentual — base: ${BASES_RATEIO.find(b => b.id === linha.baseTipo)?.nome || linha.baseTipo}`} valoresMensal={(linha.percentuais || mesesVazios()).map(parseNum)} formatarCelula={formatarPct} />
                    <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
                  </>
                )}
              </tbody>
            </table>
          </div>
          {linha.justificativa && (
            <div style={{ fontSize: 10.5, color: COR.texto, background: COR.claro, borderRadius: 6, padding: 8 }}>
              <b>Justificativa:</b> {linha.justificativa}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Pedido de 2026-08-17: template passa a alimentar só o Headcount Existente
// (Data-base 31/08/2026) — sem Data de Admissão, porque quem já está na
// base é ativo o ano inteiro de 2027 por definição (não "admite" de novo).
// Ganhou a coluna Cargo.
function baixarTemplateFuncionarios() {
  const dadosTemplate = [
    ['Nome', 'Cargo', 'Salário'],
    ['João da Silva (exemplo)', 'Analista Financeiro', 3500],
    ['Maria Souza (exemplo)', 'Coordenadora de RH', 4200],
  ];
  const ws = XLSX.utils.aoa_to_sheet(dadosTemplate);
  ws['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios');
  XLSX.writeFile(wb, 'template_importacao_funcionarios.xlsx');
}

function ImportarFuncionariosExcel({ onImportarLote }) {
  const [erros, setErros] = useState([]);
  const [preview, setPreview] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');

  function handleArquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setPreview(null);
    setErros([]);
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const linhasBrutas = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const novosErros = [];
        const validos = [];
        linhasBrutas.forEach((linha, idx) => {
          const numLinha = idx + 2; // linha 1 é o cabeçalho
          const nome = String(linha['Nome'] || '').trim();
          const cargo = String(linha['Cargo'] || '').trim();
          const salario = parseNum(linha['Salário']);

          if (!nome) novosErros.push({ linha: numLinha, campo: 'Nome', erro: 'Vazio' });
          if (!salario || salario <= 0) novosErros.push({ linha: numLinha, campo: 'Salário', erro: 'Vazio, zero ou inválido' });

          // Pedido de 2026-08-17: importação alimenta o Headcount Existente
          // (Data-base 31/08/2026) — ativo o ano inteiro de 2027 por
          // definição, sem coluna de Data de Admissão no template.
          if (nome && salario > 0) {
            validos.push({ nome, cargo, salario: String(salario), mesAdmissao: '' });
          }
        });
        setErros(novosErros);
        setPreview({ totalLinhas: linhasBrutas.length, funcionarios: validos });
      } catch (err) {
        setErros([{ linha: '—', campo: 'Arquivo', erro: 'Não foi possível ler o arquivo. Confirme que é um .xlsx válido, no formato do template.' }]);
        setPreview(null);
      }
    };
    reader.readAsBinaryString(file);
  }

  function confirmar() {
    if (!preview || preview.funcionarios.length === 0) return;
    onImportarLote(preview.funcionarios);
    setPreview(null);
    setErros([]);
    setNomeArquivo('');
  }

  return (
    <div style={{ border: `1px dashed ${COR.borda}`, borderRadius: 8, padding: 10, marginBottom: 12, background: COR.claro }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COR.azul, marginBottom: 6 }}>Importar funcionários via Excel</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <Botao variante="fantasma" icone={FileSpreadsheet} onClick={baixarTemplateFuncionarios}>Baixar template</Botao>
        <label style={{
          fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
          border: `1px solid ${COR.azul}`, color: COR.azul, background: COR.branco, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          Selecionar arquivo .xlsx
          <input type="file" accept=".xlsx,.xls" onChange={handleArquivo} style={{ display: 'none' }} />
        </label>
        {nomeArquivo && <span style={{ fontSize: 10.5, color: '#7A8088' }}>{nomeArquivo}</span>}
      </div>

      {erros.length > 0 && (
        <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, borderRadius: 6, padding: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: COR.vermelho, marginBottom: 4 }}>{erros.length} inconsistência(s) encontrada(s) — corrija no arquivo e importe novamente</div>
          {erros.slice(0, 12).map((e, i) => (
            <div key={i} style={{ fontSize: 10, color: COR.texto }}>Linha {e.linha} — {e.campo}: {e.erro}</div>
          ))}
          {erros.length > 12 && <div style={{ fontSize: 10, color: '#8A8F96' }}>+ {erros.length - 12} outra(s)…</div>}
        </div>
      )}

      {preview && (
        <div style={{ background: preview.funcionarios.length > 0 ? '#E8F5E9' : '#FBE9E9', border: `1px solid ${preview.funcionarios.length > 0 ? COR.verde : COR.vermelho}`, borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 10.5, color: COR.texto, marginBottom: 6 }}>
            {preview.funcionarios.length} de {preview.totalLinhas} linha(s) válida(s) para importação.
          </div>
          {preview.funcionarios.length > 0 && (
            <Botao variante="laranja" icone={CheckCircle2} onClick={confirmar}>Confirmar importação de {preview.funcionarios.length} funcionário(s)</Botao>
          )}
        </div>
      )}
    </div>
  );
}

// Pedido de 2026-08-17: "separe Headcount Existente (Data-base 31/08/2026)
// calculado com base no template importado e Novo Headcount a ser inserido
// manualmente [...] Os percentuais de encargos e benefícios incidirão sob
// os dois grupos". A separação é só de composição/origem do headcount — as
// premissas de encargos/benefícios continuam um conjunto só (abaixo),
// aplicadas por igual aos dois grupos (computeFolhaPessoalMes já soma todos
// os funcionários do CC antes de aplicar % — nenhuma mudança de cálculo
// necessária, só de agrupamento/exibição).
// origem: 'existente' (importado via template) | 'novo' (Adicionar
// funcionário manual). Registros de antes desta mudança não têm o campo —
// tratados como 'existente' por padrão (a composição herdada da base atual,
// não uma contratação nova planejada).
function ehExistente(f) { return f.origem !== 'novo'; }

function QuadroPessoal({ ccCodigo, funcionarios, addFuncionario, updateFuncionario, removeFuncionario, premissasPessoal, updatePremissaPessoal, folha, onImportarLote }) {
  const existentes = funcionarios.filter(ehExistente);
  const novos = funcionarios.filter(f => !ehExistente(f));
  const folhaExistente = computeFolhaPessoalAnual(existentes, premissasPessoal);
  const folhaNovo = computeFolhaPessoalAnual(novos, premissasPessoal);

  function LinhaFuncionario(f, i, mostrarAdmissao) {
    return (
      <tr key={f.id} style={{ background: i % 2 ? COR.claro : COR.branco }}>
        <td style={{ padding: 3, border: `1px solid ${COR.borda}` }}>
          <CampoTexto value={f.nome} onChange={v => updateFuncionario(f.id, 'nome', v)} placeholder="Nome do funcionário" />
        </td>
        <td style={{ padding: 3, border: `1px solid ${COR.borda}` }}>
          <CampoTexto value={f.cargo || ''} onChange={v => updateFuncionario(f.id, 'cargo', v)} placeholder="Cargo" />
        </td>
        <td style={{ padding: 3, border: `1px solid ${COR.borda}` }}>
          <CampoNumero value={f.salario} onChange={v => updateFuncionario(f.id, 'salario', v)} prefixo="R$" placeholder="0,00" />
        </td>
        {mostrarAdmissao && (
          <td style={{ padding: 3, border: `1px solid ${COR.borda}` }}>
            <Selecao value={f.mesAdmissao} onChange={v => updateFuncionario(f.id, 'mesAdmissao', v)} opcoes={MESES.map(m => ({ id: m, nome: m }))} />
          </td>
        )}
        <td style={{ padding: 3, border: `1px solid ${COR.borda}`, textAlign: 'center' }}>
          <button onClick={() => removeFuncionario(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho }}><Trash2 size={13} /></button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <h5 style={{ fontSize: 11.5, color: COR.azul, marginBottom: 4 }}>Headcount Existente (Data-base 31/08/2026)</h5>
      <div style={{ fontSize: 11, color: '#7A8088', marginBottom: 8 }}>
        Composição atual do quadro, importada via template — ativos o ano inteiro de 2027 (sem mês de admissão; quem já está na base não "admite" de novo).
        Nome/cargo/salário continuam editáveis aqui depois da importação, se precisar corrigir algo.
      </div>
      <table style={{ width: '100%', marginBottom: 8 }}>
        <thead>
          <tr>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', textAlign: 'left' }}>Funcionário</th>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 110 }}>Cargo</th>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 110 }}>Salário atual</th>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {existentes.length === 0 ? (
            <tr><td colSpan={4} style={{ padding: '8px', border: `1px solid ${COR.borda}`, fontSize: 11, color: '#8A8F96' }}>Nenhum funcionário importado ainda.</td></tr>
          ) : existentes.map((f, i) => LinhaFuncionario(f, i, false))}
        </tbody>
      </table>
      <ImportarFuncionariosExcel onImportarLote={onImportarLote} />

      <h5 style={{ fontSize: 11.5, color: COR.azul, marginTop: 18, marginBottom: 4 }}>Novo Headcount</h5>
      <div style={{ fontSize: 11, color: '#7A8088', marginBottom: 8 }}>
        Contratações planejadas para 2027, lançadas manualmente — com mês de admissão (define os meses em que entram na folha).
      </div>
      <table style={{ width: '100%', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', textAlign: 'left' }}>Funcionário</th>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 110 }}>Cargo</th>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 110 }}>Salário previsto</th>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 110 }}>Mês de admissão</th>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {novos.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: '8px', border: `1px solid ${COR.borda}`, fontSize: 11, color: '#8A8F96' }}>Nenhuma contratação planejada ainda.</td></tr>
          ) : novos.map((f, i) => LinhaFuncionario(f, i, true))}
        </tbody>
      </table>
      <Botao variante="fantasma" icone={Plus} onClick={addFuncionario}>Adicionar funcionário (Novo Headcount)</Botao>

      <div style={{ marginTop: 16 }}>
        <TabelaMensal
          linhas={[]}
          onChangeCelula={() => {}}
          linhasCalculadas={[
            { key: 'existente', label: 'Folha — Headcount Existente', valoresMensal: folhaExistente.mensal.map(m => m.total), totalValor: folhaExistente.totalAnual, cor: COR.texto },
            { key: 'novo', label: 'Folha — Novo Headcount', valoresMensal: folhaNovo.mensal.map(m => m.total), totalValor: folhaNovo.totalAnual, cor: COR.texto },
          ]}
        />
      </div>

      <h5 style={{ fontSize: 11.5, color: COR.azul, marginTop: 18, marginBottom: 8 }}>Premissas de encargos e benefícios — padronizadas para a unidade</h5>
      <p style={{ fontSize: 10.5, color: '#8A8F96', marginBottom: 8 }}>
        Valem para todos os CCs desta unidade, e incidem sobre os dois grupos acima (Headcount Existente e Novo Headcount) — não há premissa
        separada por grupo. Sem valor pré-definido — preencher conforme definição de RH/Controladoria.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
        <div>
          <Rotulo>INSS</Rotulo>
          <CampoNumero value={premissasPessoal.inssPct} onChange={v => updatePremissaPessoal('inssPct', v)} sufixo="%" placeholder="0,0" />
        </div>
        <div>
          <Rotulo>FGTS</Rotulo>
          <CampoNumero value={premissasPessoal.fgtsPct} onChange={v => updatePremissaPessoal('fgtsPct', v)} sufixo="%" placeholder="0,0" />
        </div>
        <div>
          <Rotulo>Férias + 1/3</Rotulo>
          <CampoNumero value={premissasPessoal.feriasPct} onChange={v => updatePremissaPessoal('feriasPct', v)} sufixo="%" placeholder="0,0" />
        </div>
        <div>
          <Rotulo>13º salário</Rotulo>
          <CampoNumero value={premissasPessoal.decimoTerceiroPct} onChange={v => updatePremissaPessoal('decimoTerceiroPct', v)} sufixo="%" placeholder="0,0" />
        </div>
        <div>
          <Rotulo>Vale eletrônico (por func.)</Rotulo>
          <CampoNumero value={premissasPessoal.valeTransporteValor} onChange={v => updatePremissaPessoal('valeTransporteValor', v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Cesta básica (por func.)</Rotulo>
          <CampoNumero value={premissasPessoal.cestaBasicaValor} onChange={v => updatePremissaPessoal('cestaBasicaValor', v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Assistência médica (por func.)</Rotulo>
          <CampoNumero value={premissasPessoal.planoSaudeValor} onChange={v => updatePremissaPessoal('planoSaudeValor', v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Outros benefícios (por func.)</Rotulo>
          <CampoNumero value={premissasPessoal.outrosBeneficiosValor} onChange={v => updatePremissaPessoal('outrosBeneficiosValor', v)} prefixo="R$" placeholder="0,00" />
        </div>
      </div>
      <p style={{ fontSize: 10.5, color: '#8A8F96', marginBottom: 12 }}>
        13º salário é provisionado mês a mês por competência (1/12 do salário, acima). No fluxo de caixa (aba Revisão, Análise e Envio), o pagamento é reconhecido metade em novembro e metade em dezembro.
      </p>

      <h5 style={{ fontSize: 11.5, color: COR.azul, marginBottom: 8 }}>Folha calculada — {ccCodigo}, mês a mês (Existente + Novo Headcount)</h5>
      <TabelaMensal
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={[
          { key: 'salarios', label: 'Salários', valoresMensal: folha.mensal.map(m => m.salarios), totalValor: folha.mensal.reduce((a, m) => a + m.salarios, 0), cor: COR.texto },
          { key: 'encargos', label: 'Encargos (INSS+FGTS+Férias)', valoresMensal: folha.mensal.map(m => m.encargos), totalValor: folha.mensal.reduce((a, m) => a + m.encargos, 0), cor: COR.texto },
          { key: 'decimo', label: '13º salário (provisão mensal)', valoresMensal: folha.mensal.map(m => m.decimoTerceiro), totalValor: folha.decimoTerceiroAnual, cor: COR.texto },
          { key: 'beneficios', label: 'Benefícios', valoresMensal: folha.mensal.map(m => m.beneficios), totalValor: folha.mensal.reduce((a, m) => a + m.beneficios, 0), cor: COR.texto },
          { key: 'total', label: 'Total da folha', valoresMensal: folha.mensal.map(m => m.total), totalValor: folha.totalAnual, cor: COR.azul },
        ]}
      />
    </div>
  );
}

function AbaCustos({ refUnidade, unidadeId, usuario, linhas, updateLinha, dre, detalhes, addDetalhe, updateDetalhe, removeDetalhe, funcionarios, addFuncionario, updateFuncionario, removeFuncionario, premissasPessoal, updatePremissaPessoal, importarFuncionariosLote, viagens, atualizar }) {
  // Gestor de CC (perfil gerente_cc_corporativo) só vê/edita os CCs que
  // lhe foram atribuídos nesta unidade (usuario.ccsPermitidos, de
  // /auth/me) — pedido de 2026-08-16 ("os CCs ainda estão aparecendo
  // quando não selecionados"). Gestor da Unidade e Admin FP&A continuam
  // vendo todos os CCs da unidade, sem filtro (isto é só UX; a proteção de
  // verdade contra escrita fora do escopo é no backend, ver
  // routes/orcamentos.js).
  const ccsVisiveis = usuario?.perfil === 'gerente_cc_corporativo'
    ? refUnidade.ccs.filter(cc => (usuario.ccsPermitidos || []).some(p => p.unidadeId === unidadeId && p.codigo === cc.codigo))
    : refUnidade.ccs;

  const [ccSel, setCcSel] = useState(ccsVisiveis[0]?.codigo);
  const [pacotesAbertos, setPacotesAbertos] = useState({});
  const [contaAberta, setContaAberta] = useState(null);
  const [filtroConta, setFiltroConta] = useState('');
  const [filtroPacoteId, setFiltroPacoteId] = useState('todos');

  if (ccsVisiveis.length === 0) {
    return (
      <div>
        <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>3. Custos e Despesas — por conta analítica (OBZ)</h3>
        <p style={{ fontSize: 12.5, color: '#7A8088' }}>
          Nenhum Centro de Custo atribuído a você nesta unidade ainda. Fale com o Admin FP&A para vincular seu(s) CC(s)
          na tela de Administração.
        </p>
      </div>
    );
  }

  const ccAtual = ccsVisiveis.find(c => c.codigo === ccSel) || ccsVisiveis[0];
  const origemAlvo = ccAtual.tipo === 'producao' ? 'Custo' : 'Despesa';

  function chaveLinha(contaCodigo) { return `${ccSel}|${contaCodigo}`; }
  function totalConta(contaCodigo) {
    return valorLinhaAnual(linhas[chaveLinha(contaCodigo)], dre.receitaBrutaMes, dre.receitaLiquidaMes);
  }
  function totalContaMes(contaCodigo, m) {
    return valorLinhaMes(linhas[chaveLinha(contaCodigo)], m, dre.receitaBrutaMes, dre.receitaLiquidaMes);
  }
  function totalPacoteMes(contas, m) {
    return contas.reduce((acc, c) => acc + totalContaMes(c.codigo, m), 0);
  }
  function folhaCC(ccCodigo) {
    const funcs = (funcionarios || []).filter(f => f.ccCodigo === ccCodigo);
    return computeFolhaPessoalAnual(funcs, premissasPessoal);
  }
  // Pedido de 2026-08-19 — só Corporativo, conta CONTA_VIAGENS_CALCULADORA:
  // grava a lista de viagens do CC e sincroniza o total calculado (mesma
  // fórmula da linha 6 de Viagens.xlsx) direto em custos.linhas, como uma
  // linha 'direto' comum — o resto do motor de cálculo (DRE, auditoria,
  // log de alteração) não precisa saber que essa conta tem tela própria.
  function updateViagensCC(novoArray) {
    atualizar(['custos', 'viagens', ccSel], novoArray);
    const chave = chaveLinha(CONTA_VIAGENS_CALCULADORA);
    const atual = linhas[chave] || novaLinhaVazia();
    atualizar(['custos', 'linhas', chave], { ...atual, premissaTipo: 'direto', valores: computeViagensMes(novoArray) });
  }
  function togglePacote(pacoteId) {
    setPacotesAbertos(prev => ({ ...prev, [pacoteId]: !prev[pacoteId] }));
  }
  function toggleConta(contaCodigo) {
    const chave = chaveLinha(contaCodigo);
    setContaAberta(prev => (prev === chave ? null : chave));
  }

  const gruposPacote = refUnidade.pacotes
    .map(p => ({ ...p, contas: (refUnidade.planoContas[p.id] || []).filter(c => c.origem === origemAlvo) }))
    .filter(g => g.contas.length > 0);
  const contasSemPacote = []; // Matriz_Governanca_OBZ_2027_4: 100% das contas Têxtil classificadas
  const todasContasCC = [...gruposPacote.flatMap(g => g.contas), ...contasSemPacote];
  const folhaAtual = folhaCC(ccSel);
  const totalCC = todasContasCC.reduce((acc, c) => acc + totalConta(c.codigo), 0) + folhaAtual.totalAnual;

  const termoBusca = filtroConta.trim().toLowerCase();
  const gruposPacoteExibidos = gruposPacote
    .filter(g => filtroPacoteId === 'todos' || g.id === filtroPacoteId)
    .map(g => ({
      ...g,
      contas: g.contas.filter(c => !termoBusca || c.nome.toLowerCase().includes(termoBusca) || c.codigo.includes(termoBusca)),
    }))
    .filter(g => g.contas.length > 0 || filtroPacoteId === g.id);

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>3. Custos e Despesas — por conta analítica (OBZ)</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Selecione o Centro de Custo. Cada linha abaixo é uma conta real do plano de contas — todas partem de zero.
        Escolha a premissa (valor direto, quantidade × valor unitário, ou rateio por base × percentual) e justifique.
        CC de produção formam o CPV; CC de despesa formam as Despesas Operacionais e a Depreciação (após EBITDA).
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ccsVisiveis.map(cc => (
          <button key={cc.codigo} onClick={() => { setCcSel(cc.codigo); setContaAberta(null); }}
            style={{
              fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '7px 12px', borderRadius: 16, cursor: 'pointer',
              border: `1.5px solid ${cc.codigo === ccSel ? COR.azul : COR.borda}`,
              background: cc.codigo === ccSel ? COR.azul : COR.branco, color: cc.codigo === ccSel ? COR.branco : COR.texto,
            }}
          >{cc.nome}{cc.tipo === 'producao' ? ' · CPV' : ' · Despesa'}</button>
        ))}
      </div>

      {ccAtual.obs && (
        <div style={{ fontSize: 11, color: COR.vermelho, marginBottom: 10 }}>{ccAtual.nome}: {ccAtual.obs}.</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul }}>Total anual — {ccAtual.nome}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {unidadeId !== 'corporativo' && (
            <>
              <span style={{ fontSize: 11, color: '#7A8088' }}>Fixo: <b style={{ color: COR.azul }}>{formatBRL(todasContasCC.filter(c => (linhas[chaveLinha(c.codigo)]?.classificacao || 'fixo') === 'fixo').reduce((acc, c) => acc + totalConta(c.codigo), 0))}</b></span>
              <span style={{ fontSize: 11, color: '#7A8088' }}>Variável: <b style={{ color: COR.laranja }}>{formatBRL(todasContasCC.filter(c => linhas[chaveLinha(c.codigo)]?.classificacao === 'variavel').reduce((acc, c) => acc + totalConta(c.codigo), 0))}</b></span>
            </>
          )}
          <span style={{ fontSize: 15, fontWeight: 700, color: COR.azul }}>{formatBRL(totalCC)}</span>
        </div>
      </div>

      <h4 style={{ fontSize: 12.5, color: COR.azul, marginBottom: 8 }}>Totais sintéticos — {ccAtual.nome}, por pacote, mês a mês</h4>
      <div style={{ marginBottom: 18 }}>
        <TabelaMensal
          linhas={[]}
          onChangeCelula={() => {}}
          linhasCalculadas={[
            ...gruposPacote.map(g => g.id === 'pessoal' ? {
              key: g.id,
              label: `${g.nome} (folha calculada)`,
              valoresMensal: folhaAtual.mensal.map(m => m.total),
              totalValor: folhaAtual.totalAnual,
              cor: COR.azul,
            } : {
              key: g.id,
              label: g.nome,
              valoresMensal: MESES.map((_, m) => totalPacoteMes(g.contas, m)),
              totalValor: g.contas.reduce((acc, c) => acc + totalConta(c.codigo), 0),
              cor: COR.azul,
            }),
            ...(contasSemPacote.length > 0 ? [{
              key: '__sem_pacote__',
              label: 'Sem pacote (pendência)',
              valoresMensal: MESES.map((_, m) => totalPacoteMes(contasSemPacote, m)),
              totalValor: contasSemPacote.reduce((acc, c) => acc + totalConta(c.codigo), 0),
              cor: COR.vermelho,
            }] : []),
            {
              key: '__total_cc__',
              label: `Total ${ccAtual.nome}`,
              valoresMensal: MESES.map((_, m) => todasContasCC.reduce((acc, c) => acc + totalContaMes(c.codigo, m), 0) + folhaAtual.mensal[m].total),
              totalValor: totalCC,
              cor: COR.laranja,
            },
          ]}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: '1 1 220px', maxWidth: 320 }}>
          <CampoTexto value={filtroConta} onChange={setFiltroConta} placeholder="Buscar conta por nome ou código…" />
        </div>
        <div style={{ flex: '0 1 240px' }}>
          <Selecao
            value={filtroPacoteId} onChange={setFiltroPacoteId}
            opcoes={[{ id: 'todos', nome: 'Todos os pacotes' }, ...gruposPacote.map(g => ({ id: g.id, nome: g.nome }))]}
          />
        </div>
        {(filtroConta || filtroPacoteId !== 'todos') && (
          <button onClick={() => { setFiltroConta(''); setFiltroPacoteId('todos'); }} style={{ background: 'none', border: 'none', color: COR.vermelho, fontSize: 11, cursor: 'pointer' }}>Limpar filtros</button>
        )}
      </div>

      {gruposPacoteExibidos.map(g => {
        const totalPacote = g.id === 'pessoal' ? folhaAtual.totalAnual : g.contas.reduce((acc, c) => acc + totalConta(c.codigo), 0);
        const pacoteAberto = !!pacotesAbertos[g.id];
        return (
          <div key={g.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <button
              onClick={() => togglePacote(g.id)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 12px', background: COR.claro, border: 'none', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: COR.azul }}>
                {pacoteAberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {g.nome} <span style={{ fontWeight: 400, color: '#8A8F96' }}>{g.id === 'pessoal' ? `(${(funcionarios || []).filter(f => f.ccCodigo === ccSel).length} funcionários)` : `(${g.contas.length} contas)`}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: totalPacote > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(totalPacote)}</span>
            </button>
            {pacoteAberto && (
              <div style={{ padding: 8 }}>
                {g.id === 'pessoal' ? (
                  <QuadroPessoal
                    ccCodigo={ccSel}
                    funcionarios={(funcionarios || []).filter(f => f.ccCodigo === ccSel)}
                    addFuncionario={() => addFuncionario(ccSel)}
                    updateFuncionario={updateFuncionario}
                    removeFuncionario={removeFuncionario}
                    premissasPessoal={premissasPessoal}
                    updatePremissaPessoal={updatePremissaPessoal}
                    folha={folhaAtual}
                    onImportarLote={lista => importarFuncionariosLote(ccSel, lista)}
                  />
                ) : g.contas.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: '#8A8F96', padding: '6px 2px' }}>Nenhuma conta encontrada para o filtro atual.</div>
                ) : (
                  g.contas.map(c => (
                    c.codigo === CONTA_VIAGENS_CALCULADORA && unidadeId === 'corporativo' ? (
                      <LinhaContaViagens
                        key={c.codigo} conta={c}
                        viagens={viagens?.[ccSel] || []}
                        aberta={contaAberta === chaveLinha(c.codigo)}
                        onToggle={() => toggleConta(c.codigo)}
                        onUpdateViagens={updateViagensCC}
                        total={totalConta(c.codigo)}
                      />
                    ) : (
                      <LinhaConta
                        key={c.codigo} conta={c}
                        linha={linhas[chaveLinha(c.codigo)] || novaLinhaVazia()}
                        aberta={contaAberta === chaveLinha(c.codigo)}
                        onToggle={() => toggleConta(c.codigo)}
                        onUpdate={(campo, valor) => updateLinha(chaveLinha(c.codigo), campo, valor)}
                        total={totalConta(c.codigo)}
                        receitaBrutaMes={dre.receitaBrutaMes} receitaLiquidaMes={dre.receitaLiquidaMes}
                        ocultarClassificacao={unidadeId === 'corporativo'}
                      />
                    )
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {contasSemPacote.length > 0 && (
        <div style={{ border: `1px dashed ${COR.vermelho}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
          <button
            onClick={() => togglePacote('__sem_pacote__')}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 12px', background: COR.total, border: 'none', cursor: 'pointer', fontFamily: FONT,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: COR.vermelho }}>
              {pacotesAbertos['__sem_pacote__'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Sem pacote — pendência de classificação <span style={{ fontWeight: 400, color: '#8A8F96' }}>({contasSemPacote.length} contas)</span>
            </span>
          </button>
          {pacotesAbertos['__sem_pacote__'] && (
            <div style={{ padding: 8 }}>
              {contasSemPacote.map(c => (
                <LinhaConta
                  key={c.codigo} conta={c}
                  linha={linhas[chaveLinha(c.codigo)] || novaLinhaVazia()}
                  aberta={contaAberta === chaveLinha(c.codigo)}
                  onToggle={() => toggleConta(c.codigo)}
                  onUpdate={(campo, valor) => updateLinha(chaveLinha(c.codigo), campo, valor)}
                  total={totalConta(c.codigo)}
                  receitaBrutaMes={dre.receitaBrutaMes} receitaLiquidaMes={dre.receitaLiquidaMes}
                  ocultarClassificacao={unidadeId === 'corporativo'}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 16, marginBottom: 8 }}>Detalhamento dos pacotes de decisão</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Dono, nível de serviço, prioridade e justificativa — o porquê do zero de cada pacote, agregando as contas lançadas acima.</p>
      {detalhes.map(d => (
        <div key={d.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 10, marginBottom: 10, background: COR.claro }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Selecao value={d.cc} onChange={v => updateDetalhe(d.id, 'cc', v)} opcoes={ccsVisiveis.map(c => ({ id: c.codigo, nome: c.nome }))} />
            <Selecao value={d.pacote} onChange={v => updateDetalhe(d.id, 'pacote', v)} opcoes={refUnidade.pacotes} />
            <CampoTexto value={d.dono} onChange={v => updateDetalhe(d.id, 'dono', v)} placeholder="Dono do pacote" />
            <Selecao value={d.nivelServico} onChange={v => updateDetalhe(d.id, 'nivelServico', v)} opcoes={NIVEIS_SERVICO} />
            <Selecao value={d.prioridade} onChange={v => updateDetalhe(d.id, 'prioridade', v)} opcoes={PRIORIDADES} />
            <button onClick={() => removeDetalhe(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho }}><Trash2 size={14} /></button>
          </div>
          <CampoJustificativa value={d.justificativa} onChange={v => updateDetalhe(d.id, 'justificativa', v)} />
        </div>
      ))}
      <Botao variante="fantasma" icone={Plus} onClick={addDetalhe}>Adicionar pacote de decisão</Botao>

      <PainelPlanoContas refUnidade={refUnidade} />
    </div>
  );
}

// Pedido de 2026-08-09: CAPEX separado em 3 grupos.
const CATEGORIAS_CAPEX = [
  { id: 'carryover', nome: '1. Carryover / Comprometido', descricao: 'Investimento realizado em anos anteriores, a pagar em 2027' },
  { id: 'melhoria_interna', nome: '2. Melhoria Interna', descricao: 'Regulatório / Manutenção' },
  { id: 'desenvolvimento_expansao', nome: '3. Desenvolvimento e Expansão', descricao: '' },
];

function AbaCapex({ projetos, addProjeto, updateProjeto, removeProjeto }) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>6. CAPEX</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>Investimentos por projeto (inclui o CC Investimentos do Protheus), com mês previsto e justificativa — agrupados por categoria.</p>

      {CATEGORIAS_CAPEX.map(cat => {
        // Projetos criados antes desta categorização caem em 'melhoria_interna'
        // por padrão (mesmo fallback do addProjeto) — nada some da lista.
        const projetosCategoria = projetos.filter(p => (p.categoria || 'melhoria_interna') === cat.id);
        const totalCategoria = projetosCategoria.reduce((acc, p) => acc + parseNum(p.valor), 0);
        return (
          <div key={cat.id} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <h4 style={{ fontSize: 13, color: COR.azul }}>{cat.nome}</h4>
              <span style={{ fontSize: 12, fontWeight: 700, color: COR.azul }}>{formatBRL(totalCategoria)}</span>
            </div>
            {cat.descricao && <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 8 }}>{cat.descricao}</p>}

            {projetosCategoria.map(p => (
              <div key={p.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 12, marginBottom: 10, background: COR.claro }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <CampoTexto value={p.nome} onChange={v => updateProjeto(p.id, 'nome', v)} placeholder="Nome do projeto" />
                  <CampoNumero value={p.valor} onChange={v => updateProjeto(p.id, 'valor', v)} prefixo="R$" placeholder="0,00" />
                  <Selecao value={p.mes} onChange={v => updateProjeto(p.id, 'mes', v)} opcoes={meses} />
                  <button onClick={() => removeProjeto(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho }}><Trash2 size={14} /></button>
                </div>
                <CampoTexto value={p.justificativa} onChange={v => updateProjeto(p.id, 'justificativa', v)} placeholder="Justificativa de viabilidade" />
              </div>
            ))}
            <Botao variante="fantasma" icone={Plus} onClick={() => addProjeto(cat.id)}>Adicionar projeto — {cat.nome}</Botao>
          </div>
        );
      })}
    </div>
  );
}

function AbaGiro({ capitalGiro, atualizar, dre, dados, refUnidade }) {
  if (capitalGiro.premissasRecebimento) {
    return <AbaGiroTextil capitalGiro={capitalGiro} atualizar={atualizar} dre={dre} dados={dados} refUnidade={refUnidade} />;
  }
  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>5. Kgiro e FC Operacional</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Descasamento entre competência e caixa, mês a mês. Prazos em dias corridos.
        Pendência (2026-08-09): cada unidade terá sua própria estrutura de Kgiro e fluxo de caixa direto —
        os campos abaixo são os mesmos de antes até essa estrutura ser compartilhada.
      </p>
      <TabelaMensal
        linhas={[
          { key: 'prazoRecebimento', label: 'Prazo recebimento (dias)', valores: capitalGiro.prazoRecebimento },
          { key: 'prazoPagamento', label: 'Prazo pagamento (dias)', valores: capitalGiro.prazoPagamento },
          { key: 'giroEstoque', label: 'Giro de estoque (dias)', valores: capitalGiro.giroEstoque },
        ]}
        onChangeCelula={(chave, mesIdx, valor) => {
          const novoArray = capitalGiro[chave].map((v, idx) => idx === mesIdx ? valor : v);
          atualizar(['capitalGiro', chave], novoArray);
        }}
        formatarTotal={(t) => `${(t / 12).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} méd.`}
      />
      <div style={{ marginTop: 10 }}>
        <CampoJustificativa value={capitalGiro.justificativa} onChange={v => atualizar(['capitalGiro', 'justificativa'], v)}
          placeholder="Justificativa dos prazos (ex.: renegociação com fornecedor, mudança de política de crédito)" />
      </div>
    </div>
  );
}

// Linhas do FC Direto por natureza de recebimento/pagamento — usado tanto
// na aba 5 (Kgiro) quanto na Revisão, Análise e Envio, para os dois serem
// exatamente a mesma tabela (pedido de 2026-08-16), construídas a partir do
// mesmo `fcd = computeFluxoCaixaDiretoMensal(...)`.
function linhasFcDireto(fcd) {
  return [
    { key: 'recebimentos', label: '(+) Recebimentos de clientes', valoresMensal: fcd.recebimentosClientesMes, totalValor: fcd.recebimentosClientesMes.reduce((a, v) => a + v, 0), cor: COR.verde },
    { key: 'fornecedores', label: '(-) Pagamentos a fornecedores e insumos', valoresMensal: fcd.pagamentosFornecedoresMes.map(v => -v), totalValor: -fcd.pagamentosFornecedoresMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
    { key: 'pessoal', label: '(-) Pagamentos de pessoal', valoresMensal: fcd.pessoalEmCaixaMes.map(v => -v), totalValor: -fcd.pessoalEmCaixaMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
    { key: 'despesas', label: '(-) Pagamentos de despesas operacionais', valoresMensal: fcd.pagamentosDespesasMes.map(v => -v), totalValor: -fcd.pagamentosDespesasMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
    { key: 'ircslDireto', label: '(-) Pagamento de IRCSL', valoresMensal: fcd.ircslMes.map(v => -v), totalValor: -fcd.ircslMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
    { key: 'manuais', label: '(-) Pagamentos manuais', valoresMensal: fcd.pagamentosManuaisMes.map(v => -v), totalValor: -fcd.pagamentosManuaisMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
    { key: 'fcopDireto', label: '(=) FC Operacional (Direto)', valoresMensal: fcd.fcOperacionalDiretoMes, totalValor: fcd.fcOperacionalDiretoMes.reduce((a, v) => a + v, 0), cor: COR.azul },
  ];
}

// Só ARA Têxtil — cascata de recebimentos real (Premissas Têxtil.xlsx, aba
// Premissas Kgiro), plano de contas de pagamentos manuais (aba Fluxo de
// Caixa Direto) e o próprio FC Direto — igual ao da Revisão (pedido de
// 2026-08-16). Ver nota completa em PREMISSAS_RECEBIMENTO_REF /
// computeRecebimentosKgiroMensal / PLANO_CONTAS_PAGAMENTOS_TEXTIL.
function AbaGiroTextil({ capitalGiro, atualizar, dre, dados, refUnidade }) {
  const kgiro = computeRecebimentosKgiroMensal({ capitalGiro }, dre);
  const fcd = computeFluxoCaixaDiretoMensal(dados, dre, refUnidade);
  const p = capitalGiro.premissasRecebimento;
  const pagamentos = capitalGiro.pagamentosManuais || pagamentosManuaisVazios();

  function updatePremissa(id, valor) {
    atualizar(['capitalGiro', 'premissasRecebimento'], { ...p, [id]: valor });
  }
  function updatePagamento(contaId, mesIdx, valor) {
    // Defensivo: se o orçamento foi criado antes desta migração (formato
    // antigo, lista livre), pagamentos[contaId] pode não existir ainda.
    const novoArray = (pagamentos[contaId] || mesesVazios()).map((v, idx) => idx === mesIdx ? valor : v);
    atualizar(['capitalGiro', 'pagamentosManuais'], { ...pagamentos, [contaId]: novoArray });
  }

  // Linha "à vista" (defasagem 0) e as 12 linhas de aging (30 a 360 dias),
  // cada uma com sua própria % de premissa editável e valor mensal
  // calculado — mesma disposição da planilha (coluna D = premissa, colunas
  // H em diante = meses).
  const linhaAVista = PREMISSAS_RECEBIMENTO_REF[0];
  const faixasAging = PREMISSAS_RECEBIMENTO_REF.slice(1);

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>5. Kgiro e FC Operacional — ARA Têxtil</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Cascata de recebimentos real (fonte: Premissas Têxtil.xlsx, aba Premissas Kgiro — fornecida em 2026-08-16).
        Carteira e Vendas Nov-Dez são digitadas mês a mês; da linha "Faturamento" pra baixo é tudo calculado
        automaticamente a partir da Receita Líquida (após cancelamento) — só a coluna de % de premissa é editável.
      </p>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Premissas e cascata de recebimentos</h4>
      <TabelaMensal
        colunaExtra={{ titulo: 'Premissa', chave: 'premissa' }}
        linhas={[
          { key: 'recebimentosEmCarteira', label: 'Recebimentos em carteira', valores: capitalGiro.recebimentosEmCarteira },
          { key: 'recebimentosVendasNovDez', label: 'Recebimentos Vendas Nov a Dez', valores: capitalGiro.recebimentosVendasNovDez },
        ]}
        onChangeCelula={(chave, mesIdx, valor) => {
          const novoArray = capitalGiro[chave].map((v, idx) => idx === mesIdx ? valor : v);
          atualizar(['capitalGiro', chave], novoArray);
        }}
        corTotal={COR.azul}
        linhasCalculadas={[
          { key: 'faturamento', label: 'Faturamento Líquido de Cancelamentos', valoresMensal: kgiro.faturamentoMes, totalValor: somaMes(kgiro.faturamentoMes), cor: COR.texto },
          {
            key: 'avista', label: 'Recebimentos à vista', valoresMensal: kgiro.porFaixaMes[linhaAVista.id], totalValor: somaMes(kgiro.porFaixaMes[linhaAVista.id]), cor: COR.texto,
            premissa: { valor: p[linhaAVista.id], onChange: v => updatePremissa(linhaAVista.id, v), placeholder: `ref. ${linhaAVista.pctRef}%` },
          },
          { key: 'aprazo', label: 'Recebimentos à prazo (subtotal)', valoresMensal: kgiro.recebimentosAPrazoMes, totalValor: somaMes(kgiro.recebimentosAPrazoMes), cor: COR.texto },
          ...faixasAging.map(r => ({
            key: r.id, label: r.nome, valoresMensal: kgiro.porFaixaMes[r.id], totalValor: somaMes(kgiro.porFaixaMes[r.id]), cor: COR.texto,
            premissa: { valor: p[r.id], onChange: v => updatePremissa(r.id, v), placeholder: `ref. ${r.pctRef}%` },
          })),
          {
            key: 'cancelamento', label: '(-) Cancelamento', valoresMensal: kgiro.cancelamentoMes, totalValor: somaMes(kgiro.cancelamentoMes), cor: COR.vermelho,
            premissa: { valor: p.cancelamento, onChange: v => updatePremissa('cancelamento', v), placeholder: '0%' },
          },
          { key: 'total', label: '(=) Total de Recebimentos', valoresMensal: kgiro.totalMes, totalValor: somaMes(kgiro.totalMes), cor: COR.verde },
        ]}
      />
      <div style={{ marginTop: 10 }}>
        <CampoJustificativa value={capitalGiro.justificativa} onChange={v => atualizar(['capitalGiro', 'justificativa'], v)}
          placeholder="Justificativa das premissas de recebimento (ex.: mudança de prazo médio, renegociação com clientes)" />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 26, marginBottom: 8 }}>Pagamentos manuais (FC Direto)</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>
        Plano de contas da aba Fluxo de Caixa Direto (fonte: Premissas Têxtil.xlsx). Lançamento manual mês a mês —
        essas contas somam às saídas do FC Direto abaixo, sem duplicar o que já vem de Custos e Despesas.
      </p>
      <TabelaMensal
        linhas={PLANO_CONTAS_PAGAMENTOS_TEXTIL.map(c => ({ key: c.id, label: c.nome, valores: pagamentos[c.id] || mesesVazios() }))}
        onChangeCelula={updatePagamento}
        corTotal={COR.vermelho}
      />

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 26, marginBottom: 4 }}>Fluxo de Caixa Direto — mensal, por natureza de recebimento e pagamento</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>
        Mesma tabela apresentada na Revisão, Análise e Envio — recebimentos vêm da cascata acima, pagamentos somam
        Custos e Despesas + a lista manual acima.
      </p>
      <TabelaMensal
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={linhasFcDireto(fcd)}
      />
    </div>
  );
}

function AbaProvisoes({ provisoes, resultado, atualizar }) {
  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>4. Provisões, resultado financeiro e outras receitas/despesas</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>Completa os blocos da DRE entre EBITDA e Lucro Líquido, mês a mês.</p>

      <TabelaMensal
        linhas={[
          { key: 'inadimplencia', label: 'Inadimplência (%)', valores: provisoes.inadimplencia },
          { key: 'contingencias', label: 'Provisão contingências', valores: provisoes.contingencias },
          { key: 'perdas', label: 'Provisão perdas', valores: provisoes.perdas },
        ]}
        onChangeCelula={(chave, mesIdx, valor) => {
          const novoArray = provisoes[chave].map((v, idx) => idx === mesIdx ? valor : v);
          atualizar(['provisoes', chave], novoArray);
        }}
      />
      <div style={{ marginTop: 10, marginBottom: 20 }}>
        <CampoJustificativa value={provisoes.justificativa} onChange={v => atualizar(['provisoes', 'justificativa'], v)}
          placeholder="Justificativa das provisões (ex.: histórico de inadimplência, processo em curso)" />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Resultado financeiro e outras receitas/despesas</h4>
      <TabelaMensal
        linhas={[
          { key: 'receitaFinanceira', label: 'Receita financeira', valores: resultado.receitaFinanceira },
          { key: 'despesaFinanceira', label: 'Despesa financeira', valores: resultado.despesaFinanceira },
          { key: 'outrasReceitasDespesas', label: 'Outras receitas/despesas', valores: resultado.outrasReceitasDespesas },
        ]}
        onChangeCelula={(chave, mesIdx, valor) => {
          const novoArray = resultado[chave].map((v, idx) => idx === mesIdx ? valor : v);
          atualizar(['resultado', chave], novoArray);
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 14, marginTop: 12, alignItems: 'start' }}>
        <div>
          <Rotulo>Alíquota IRCSL sobre EBT (anual)</Rotulo>
          <CampoNumero value={resultado.aliquotaIR} onChange={v => atualizar(['resultado', 'aliquotaIR'], v)} sufixo="%" placeholder="34" />
        </div>
        <div>
          <Rotulo>Justificativa</Rotulo>
          <CampoJustificativa value={resultado.justificativa} onChange={v => atualizar(['resultado', 'justificativa'], v)}
            placeholder="Justificativa do resultado financeiro (ex.: nova linha de crédito, aplicação financeira)" />
        </div>
      </div>
    </div>
  );
}

function ListaEventosFinanceiros({ itens, onAdd, onUpdate, onRemove, rotuloValor, placeholderJust }) {
  return (
    <div>
      {itens.map(it => (
        <div key={it.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 10, marginBottom: 8, background: COR.claro }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 6 }}>
            <CampoNumero value={it.valor} onChange={v => onUpdate(it.id, 'valor', v)} prefixo="R$" placeholder={rotuloValor} />
            <Selecao value={it.mes} onChange={v => onUpdate(it.id, 'mes', v)} opcoes={MESES} />
            <button onClick={() => onRemove(it.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho }}><Trash2 size={14} /></button>
          </div>
          <CampoJustificativa value={it.justificativa} onChange={v => onUpdate(it.id, 'justificativa', v)} placeholder={placeholderJust} />
        </div>
      ))}
      <Botao variante="fantasma" icone={Plus} onClick={onAdd}>Adicionar</Botao>
    </div>
  );
}

function LinhaFinanciamento({ linha, aberta, onToggle, onUpdate, onRemove }) {
  const totalCaptacoes = somaMes(linha.captacoes);
  const totalAmortizacoes = somaMes(linha.amortizacoes);
  const totalJuros = somaMes(linha.jurosPagos);

  return (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 6, marginBottom: 6, background: COR.branco, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          padding: '8px 10px', background: aberta ? COR.claro : COR.branco, border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}>
          {aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span style={{ fontSize: 11.5, fontWeight: 700, color: COR.texto }}>{linha.banco || 'Banco (a definir)'} — {linha.linha || 'linha a definir'}</span>
          <span style={{ fontSize: 10, color: '#8A8F96' }}>{linha.moeda}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: '#7A8088' }}>Captações: <b style={{ color: COR.verde }}>{formatBRL(totalCaptacoes)}</b></span>
          <span style={{ fontSize: 10.5, color: '#7A8088' }}>Amort.+Juros: <b style={{ color: COR.vermelho }}>{formatBRL(totalAmortizacoes + totalJuros)}</b></span>
        </div>
      </button>
      {aberta && (
        <div style={{ padding: '10px 10px 12px', borderTop: `1px solid ${COR.borda}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <Rotulo>Banco</Rotulo>
              <CampoTexto value={linha.banco} onChange={v => onUpdate('banco', v)} placeholder="Ex.: Banco do Brasil" />
            </div>
            <div>
              <Rotulo>Linha</Rotulo>
              <CampoTexto value={linha.linha} onChange={v => onUpdate('linha', v)} placeholder="Ex.: BNDES Finame" />
            </div>
            <div>
              <Rotulo>Moeda</Rotulo>
              <Selecao value={linha.moeda} onChange={v => onUpdate('moeda', v)} opcoes={[{ id: 'BRL', nome: 'BRL' }, { id: 'USD', nome: 'USD' }, { id: 'EUR', nome: 'EUR' }]} />
            </div>
            <div>
              <Rotulo>Saldo inicial</Rotulo>
              <CampoNumero value={linha.saldoInicial} onChange={v => onUpdate('saldoInicial', v)} prefixo="R$" placeholder="0,00" />
            </div>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 8 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 8px', textAlign: 'left', position: 'sticky', left: 0 }}>Linha</th>
                  {MESES.map(m => (
                    <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '5px 4px', minWidth: 58 }}>{m}</th>
                  ))}
                  <th style={{ background: COR.laranja, color: COR.branco, fontSize: 9.5, padding: '5px 8px', minWidth: 78 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <GradeMensalLinha label="Captações (R$)" valores={linha.captacoes} onChange={(mi, v) => onUpdate('captacoes', atualizarArray(linha.captacoes, mi, v))} formatarTotal={formatBRL} />
                <GradeMensalLinha label="Amortizações (R$)" valores={linha.amortizacoes} onChange={(mi, v) => onUpdate('amortizacoes', atualizarArray(linha.amortizacoes, mi, v))} formatarTotal={formatBRL} />
                <GradeMensalLinha label="Juros pagos (R$)" valores={linha.jurosPagos} onChange={(mi, v) => onUpdate('jurosPagos', atualizarArray(linha.jurosPagos, mi, v))} formatarTotal={formatBRL} />
                <GradeMensalLinha label="Variação cambial (R$)" valores={linha.variacaoCambial} onChange={(mi, v) => onUpdate('variacaoCambial', atualizarArray(linha.variacaoCambial, mi, v))} formatarTotal={formatBRL} />
                <GradeMensalLinha label="Provisão desp. financeira p/ Resultado (R$)" valores={linha.provisaoDespesaFinanceira} onChange={(mi, v) => onUpdate('provisaoDespesaFinanceira', atualizarArray(linha.provisaoDespesaFinanceira, mi, v))} formatarTotal={formatBRL} />
              </tbody>
            </table>
          </div>
          <CampoJustificativa value={linha.justificativa} onChange={v => onUpdate('justificativa', v)} placeholder="Justificativa da linha (finalidade, garantias, condições)" />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={13} /> Remover linha
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AbaFcFinanciamentos({ fcFinanciamentos, addLinhaFinanciamento, updateLinhaFinanciamento, removeLinhaFinanciamento, updateMovimentacaoAcionista, atualizar }) {
  const [linhaAberta, setLinhaAberta] = useState(null);

  const totalCaptacoes = fcFinanciamentos.linhas.reduce((acc, l) => acc + somaMes(l.captacoes), 0);
  const totalAmortizacoes = fcFinanciamentos.linhas.reduce((acc, l) => acc + somaMes(l.amortizacoes), 0);
  const totalJuros = fcFinanciamentos.linhas.reduce((acc, l) => acc + somaMes(l.jurosPagos), 0);
  const totalProvisao = fcFinanciamentos.linhas.reduce((acc, l) => acc + somaMes(l.provisaoDespesaFinanceira), 0);

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>7. FC Financiamentos</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Projeção mensal de captações, amortizações, juros pagos, variação cambial e provisão da despesa financeira, por banco e linha de financiamento.
        A provisão da despesa financeira aqui é referência para calibrar o campo "Despesa financeira" da aba 4 (Provisões) — não substitui aquele lançamento automaticamente.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <CardTotal label="Captações no ano" valor={totalCaptacoes} cor={COR.verde} />
        <CardTotal label="Amortizações no ano" valor={totalAmortizacoes} cor={COR.vermelho} />
        <CardTotal label="Juros pagos no ano" valor={totalJuros} cor={COR.vermelho} />
        <CardTotal label="Provisão desp. financeira no ano" valor={totalProvisao} cor={COR.laranja} />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Linhas de financiamento por banco</h4>
      {fcFinanciamentos.linhas.map(l => (
        <LinhaFinanciamento
          key={l.id} linha={l}
          aberta={linhaAberta === l.id}
          onToggle={() => setLinhaAberta(prev => prev === l.id ? null : l.id)}
          onUpdate={(campo, valor) => updateLinhaFinanciamento(l.id, campo, valor)}
          onRemove={() => removeLinhaFinanciamento(l.id)}
        />
      ))}
      <Botao variante="fantasma" icone={Plus} onClick={addLinhaFinanciamento}>Adicionar linha de financiamento</Botao>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 24, marginBottom: 8 }}>Movimentações de acionistas</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Projeção mensal, R$.</p>
      <TabelaMensal
        linhas={fcFinanciamentos.movimentacoesAcionistas.map(m => ({ key: m.id, label: m.nome, valores: m.valores }))}
        onChangeCelula={(movId, mesIdx, valor) => {
          const m = fcFinanciamentos.movimentacoesAcionistas.find(x => x.id === movId);
          updateMovimentacaoAcionista(movId, atualizarArray(m.valores, mesIdx, valor));
        }}
        corTotal={COR.azul}
      />

      <div style={{ marginTop: 14 }}>
        <Rotulo>Justificativa geral do bloco</Rotulo>
        <CampoJustificativa value={fcFinanciamentos.justificativa} onChange={v => atualizar(['fcFinanciamentos', 'justificativa'], v)}
          placeholder="Observações sobre a estratégia de financiamento e movimentações de acionistas do ciclo" />
      </div>
    </div>
  );
}

function AbaBalanco({ balanco, atualizar }) {
  // ARA Têxtil (pedido de 2026-08-16): retirados os campos escalares de
  // saldo de abertura — a coluna Dez/25 do plano de contas abaixo é agora a
  // única fonte desses saldos (ver saldosAberturaFc). As demais unidades
  // continuam com os campos escalares, sem plano de contas.
  if (balanco.planoContas) {
    return (
      <div>
        <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>8. Balanço Patrimonial — ARA Têxtil</h3>
        <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
          Plano de contas completo (fonte: Premissas Têxtil.xlsx, aba Balanço Patrimonial). O saldo de partida
          (Dez/25) de cada conta é lançado na primeira coluna; os meses seguintes são lançamento manual mês a mês,
          igual à planilha original.
        </p>
        <AbaBalancoPlanoContasTextil planoContas={balanco.planoContas} saldosIniciais={balanco.saldosIniciais} atualizar={atualizar} />
        <div style={{ marginTop: 18 }}>
          <Rotulo>Justificativa geral do bloco</Rotulo>
          <CampoJustificativa value={balanco.justificativa} onChange={v => atualizar(['balanco', 'justificativa'], v)}
            placeholder="Observações gerais sobre o Balanço Patrimonial projetado" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>8. Balanço Patrimonial</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>Saldos de abertura que a DRE sozinha não cobre — base para o Balanço projetado. Captações, amortizações, aportes e distribuições estão na aba 7 (FC Financiamentos).</p>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Saldos de abertura (início do ciclo)</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 10 }}>
        <div>
          <Rotulo>Caixa inicial</Rotulo>
          <CampoNumero value={balanco.caixaInicial} onChange={v => atualizar(['balanco', 'caixaInicial'], v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Ativo imobilizado inicial (bruto)</Rotulo>
          <CampoNumero value={balanco.imobilizadoInicial} onChange={v => atualizar(['balanco', 'imobilizadoInicial'], v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Depreciação acumulada inicial</Rotulo>
          <CampoNumero value={balanco.depreciacaoAcumuladaInicial} onChange={v => atualizar(['balanco', 'depreciacaoAcumuladaInicial'], v)} prefixo="R$" placeholder="0,00" />
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 18, marginBottom: 8 }}>Capital de giro — saldos de abertura</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 8 }}>Base para calcular a variação de capital de giro mês a mês no fluxo de caixa direto (aba Revisão, Análise e Envio), junto com os prazos da aba 5.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 10 }}>
        <div>
          <Rotulo>Contas a receber inicial</Rotulo>
          <CampoNumero value={balanco.contasAReceberInicial} onChange={v => atualizar(['balanco', 'contasAReceberInicial'], v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Estoque inicial</Rotulo>
          <CampoNumero value={balanco.estoqueInicial} onChange={v => atualizar(['balanco', 'estoqueInicial'], v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Contas a pagar inicial</Rotulo>
          <CampoNumero value={balanco.contasAPagarInicial} onChange={v => atualizar(['balanco', 'contasAPagarInicial'], v)} prefixo="R$" placeholder="0,00" />
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 18, marginBottom: 8 }}>Posição de dívida na abertura</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 8 }}>
        <div>
          <Rotulo>Saldo inicial de dívida (todas as linhas)</Rotulo>
          <CampoNumero value={balanco.emprestimos.saldoInicial} onChange={v => atualizar(['balanco', 'emprestimos', 'saldoInicial'], v)} prefixo="R$" placeholder="0,00" />
        </div>
        <div>
          <Rotulo>Taxa de juros anual média de referência</Rotulo>
          <CampoNumero value={balanco.emprestimos.taxaJurosAnual} onChange={v => atualizar(['balanco', 'emprestimos', 'taxaJurosAnual'], v)} sufixo="%" placeholder="0,0" />
        </div>
      </div>
      <CampoJustificativa value={balanco.emprestimos.justificativa} onChange={v => atualizar(['balanco', 'emprestimos', 'justificativa'], v)}
        placeholder="Justificativa da dívida atual (linha, banco, garantias). O detalhamento por banco/linha está em FC Financiamentos" />

      <div style={{ marginTop: 18 }}>
        <Rotulo>Justificativa geral do bloco</Rotulo>
        <CampoJustificativa value={balanco.justificativa} onChange={v => atualizar(['balanco', 'justificativa'], v)}
          placeholder="Observações gerais sobre o Balanço Patrimonial projetado" />
      </div>
    </div>
  );
}

// Só ARA Têxtil — plano de contas do Balanço Patrimonial completo, mês a mês
// (fonte: Premissas Têxtil.xlsx, aba Balanço Patrimonial, fornecida em
// 2026-08-16). A aba original não trazia fórmulas de projeção reais — só o
// template de contas e os SUM() dos subtotais — então aqui é lançamento
// manual por conta/mês, igual à planilha; só os subtotais por grupo, Ativo
// Total, Passivo e PL Total e o Check Balanço são calculados automaticamente.
// saldosIniciais = coluna Dez/25 (pedido de 2026-08-16): um valor por conta,
// logo após a descrição e antes de Jan — substitui os campos escalares
// antigos como fonte de caixa/AR/AP/estoque inicial (ver saldosAberturaFc).
function AbaBalancoPlanoContasTextil({ planoContas, saldosIniciais, atualizar }) {
  const calc = computeBalancoMensal(planoContas, saldosIniciais);
  const iniciais = saldosIniciais || saldosIniciaisBalancoVazio();

  function updateInicial(contaId, valor) {
    atualizar(['balanco', 'saldosIniciais', contaId], valor);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 4 }}>Plano de contas do Balanço Patrimonial — ARA Têxtil</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 12 }}>
        Lançamento manual mês a mês por conta (igual à planilha-fonte, que não trazia fórmula de projeção nessas
        contas). Subtotais por grupo, Ativo Total, Passivo e PL Total e o Check Balanço são calculados automaticamente.
      </p>
      {GRUPOS_BALANCO_TEXTIL.map(g => (
        <div key={g.id} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: g.ladoBalanco === 'ativo' ? COR.azul : COR.laranja, marginBottom: 6 }}>{g.nome}</div>
          <TabelaMensal
            colunaExtra={{ titulo: 'Dez/25', chave: 'inicial' }}
            linhas={g.contas.map(c => ({
              key: c.id, label: c.nome, valores: planoContas[c.id],
              inicial: { valor: iniciais[c.id], onChange: v => updateInicial(c.id, v), placeholder: '0,00' },
            }))}
            onChangeCelula={(contaId, mesIdx, valor) => {
              const novoArray = planoContas[contaId].map((v, idx) => idx === mesIdx ? valor : v);
              atualizar(['balanco', 'planoContas', contaId], novoArray);
            }}
            linhasCalculadas={[
              {
                key: `subtotal-${g.id}`, label: `(=) ${g.nome}`, valoresMensal: calc.porGrupoMes[g.id], totalValor: somaMes(calc.porGrupoMes[g.id]), cor: g.ladoBalanco === 'ativo' ? COR.azul : COR.laranja,
                inicial: { valor: calc.porGrupoInicial[g.id], onChange: () => {}, placeholder: '' },
              },
            ]}
          />
        </div>
      ))}
      <TabelaMensal
        colunaExtra={{ titulo: 'Dez/25', chave: 'inicial' }}
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={[
          { key: 'ativoTotal', label: 'ATIVO TOTAL', valoresMensal: calc.ativoTotalMes, totalValor: somaMes(calc.ativoTotalMes), cor: COR.azul, inicial: { valor: calc.ativoInicial, onChange: () => {}, placeholder: '' } },
          { key: 'passivoPlTotal', label: 'PASSIVO E PL TOTAL', valoresMensal: calc.passivoPlTotalMes, totalValor: somaMes(calc.passivoPlTotalMes), cor: COR.laranja, inicial: { valor: calc.passivoPlInicial, onChange: () => {}, placeholder: '' } },
          { key: 'check', label: 'Check Balanço (Ativo − Passivo e PL)', valoresMensal: calc.checkMes, totalValor: somaMes(calc.checkMes), cor: COR.verde, inicial: { valor: calc.checkInicial, onChange: () => {}, placeholder: '' } },
        ]}
      />
    </div>
  );
}

function CascataDRE({ dre, ifrs18 }) {
  const linhasLegado = [
    { label: 'Receita Operacional Líquida', valor: dre.receitaLiquida, tipo: 'base' },
    { label: '(-) Custos dos Produtos Vendidos', valor: -dre.cpv, tipo: 'neg' },
    { label: '(=) Lucro Bruto', valor: dre.lucroBruto, tipo: 'subtotal' },
    { label: 'Margem Bruta (%)', valor: dre.margemBruta, tipo: 'margem' },
    { label: '(-) Despesas Operacionais', valor: -dre.despesasSemDA, tipo: 'neg' },
    { label: '(=) EBITDA', valor: dre.ebitda, tipo: 'subtotal' },
    { label: 'Margem EBITDA (%)', valor: dre.margemEbitda, tipo: 'margem' },
    { label: '(-) Depreciação e Amortização', valor: -dre.depreciacao, tipo: 'neg' },
    { label: '(+/-) Resultado Financeiro', valor: dre.resultadoFinanceiro, tipo: 'flex' },
    { label: '(+/-) Outras Receitas e Despesas', valor: dre.outras, tipo: 'flex' },
    { label: '(-) IRCSL', valor: -dre.ircsl, tipo: 'neg' },
    { label: '(=) Lucro Líquido', valor: dre.lucroLiquido, tipo: 'total' },
    { label: 'Margem Líquida (%)', valor: dre.margemLiquida, tipo: 'margem' },
  ];

  const lucroOperacional = dre.ebitda - dre.depreciacao;
  const linhasIfrs18 = [
    { label: 'Receita Operacional Líquida', valor: dre.receitaLiquida, tipo: 'base', categoria: 'Operacional' },
    { label: '(-) Custos dos Produtos Vendidos', valor: -dre.cpv, tipo: 'neg', categoria: 'Operacional' },
    { label: '(=) Lucro Bruto', valor: dre.lucroBruto, tipo: 'subtotal', categoria: 'Operacional' },
    { label: '(-) Despesas Operacionais', valor: -dre.despesasSemDA, tipo: 'neg', categoria: 'Operacional' },
    { label: '(-) Depreciação e Amortização', valor: -dre.depreciacao, tipo: 'neg', categoria: 'Operacional' },
    { label: '(=) Lucro Operacional', valor: lucroOperacional, tipo: 'total_ifrs', categoria: 'Operacional' },
    { label: '(=) Lucro antes de Financiamento e Impostos', valor: lucroOperacional, tipo: 'total_ifrs', categoria: '— (sem investimentos)' },
    { label: '(+/-) Resultado Financeiro', valor: dre.resultadoFinanceiro, tipo: 'flex', categoria: 'Financiamento' },
    { label: '(+/-) Outras Receitas e Despesas', valor: dre.outras, tipo: 'flex', categoria: 'A reclassificar' },
    { label: '(=) Lucro Antes dos Impostos', valor: lucroOperacional + dre.resultadoFinanceiro + dre.outras, tipo: 'subtotal', categoria: '—' },
    { label: '(-) Impostos sobre o Lucro', valor: -dre.ircsl, tipo: 'neg', categoria: 'Impostos' },
    { label: '(=) Lucro Líquido', valor: dre.lucroLiquido, tipo: 'total', categoria: '—' },
  ];

  const linhas = ifrs18 ? linhasIfrs18 : linhasLegado;

  return (
    <div>
      {ifrs18 && (
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 10.5, color: COR.texto }}>
          IFRS 18 (vigente para exercícios iniciados em 1º/jan/2027): EBITDA deixa de ser subtotal padrão e passa a MPM (medida definida pela administração) —
          reconciliação: EBITDA {formatBRL(dre.ebitda)} (-) Depreciação e Amortização {formatBRL(dre.depreciacao)} = Lucro Operacional {formatBRL(lucroOperacional)}.
          Este modelo não tem resultado de equivalência patrimonial/investidas — categoria "Investimento" fica vazia.
        </div>
      )}
      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden' }}>
      {linhas.map((l, i) => {
        const isMargem = l.tipo === 'margem';
        const isSubtotalForte = l.tipo === 'subtotal' || l.tipo === 'total' || l.tipo === 'total_ifrs';
        return (
          <div
            key={i}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', fontSize: isMargem ? 10.5 : 12.5,
              background: isSubtotalForte ? COR.total : (i % 2 ? COR.claro : COR.branco),
              borderBottom: `1px solid ${COR.borda}`,
              fontWeight: isSubtotalForte ? 700 : (isMargem ? 400 : 500),
              fontStyle: isMargem ? 'italic' : 'normal',
              color: isMargem ? '#8A8F96' : COR.texto,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {l.label}
              {ifrs18 && l.categoria && (
                <span style={{ fontSize: 9, fontWeight: 700, color: COR.azul, background: COR.branco, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: '1px 6px' }}>{l.categoria}</span>
              )}
            </span>
            <span style={{ color: l.valor < 0 && l.tipo !== 'margem' ? COR.vermelho : (isSubtotalForte ? COR.azul : COR.texto) }}>
              {isMargem ? formatPct(l.valor) : formatBRL(l.valor)}
            </span>
          </div>
        );
      })}
    </div>
    </div>
  );
}

function CascataDFC({ dfc }) {
  const linhas = [
    { label: 'Lucro Líquido', valor: dfc.lucroLiquido, tipo: 'base' },
    { label: '(+) Depreciação e Amortização', valor: dfc.depreciacao, tipo: 'pos' },
    { label: '(=) Geração de Caixa Operacional (antes do giro)', valor: dfc.geracaoOperacionalAntesGiro, tipo: 'subtotal' },
    { label: '(+/-) Variação de Capital de Giro', valor: dfc.variacaoCapitalGiro, tipo: 'pendencia' },
    { label: '(=) Fluxo de Caixa das Operações', valor: dfc.fluxoOperacional, tipo: 'subtotal' },
    { label: '(-) CAPEX (Investimentos)', valor: dfc.fluxoInvestimento, tipo: 'neg' },
    { label: '(=) Fluxo de Caixa de Investimentos', valor: dfc.fluxoInvestimento, tipo: 'subtotal' },
    { label: '(+) Captações de empréstimos', valor: dfc.captacoes, tipo: 'pos' },
    { label: '(-) Amortizações de empréstimos', valor: -dfc.amortizacoes, tipo: 'neg' },
    { label: '(-) Juros pagos', valor: -dfc.jurosPagos, tipo: 'neg' },
    { label: '(+) Aportes de capital', valor: dfc.aportes, tipo: 'pos' },
    { label: '(-) Distribuição a minoritários', valor: -dfc.distMinoritarios, tipo: 'neg' },
    { label: '(-) Distribuição a sócios', valor: -dfc.distSocios, tipo: 'neg' },
    { label: '(+) Empréstimos de acionistas', valor: dfc.emprestimosAcionistas, tipo: 'pos' },
    { label: '(-) Devolução de empréstimos de acionistas', valor: -dfc.devolucaoEmprestimos, tipo: 'neg' },
    { label: '(=) Fluxo de Caixa de Financiamentos', valor: dfc.fluxoFinanciamento, tipo: 'subtotal' },
    { label: '(=) Variação de Caixa no Período', valor: dfc.variacaoCaixa, tipo: 'total' },
    { label: '(+) Caixa Inicial', valor: dfc.caixaInicial, tipo: 'pos' },
    { label: '(=) Caixa Final Projetado', valor: dfc.caixaFinal, tipo: 'total' },
  ];
  return (
    <div>
      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden' }}>
        {linhas.map((l, i) => {
          const isPendencia = l.tipo === 'pendencia';
          const isSubtotalForte = l.tipo === 'subtotal' || l.tipo === 'total';
          return (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', fontSize: 12.5,
                background: isSubtotalForte ? COR.total : (i % 2 ? COR.claro : COR.branco),
                borderBottom: `1px solid ${COR.borda}`,
                fontWeight: isSubtotalForte ? 700 : 500,
                color: COR.texto,
              }}
            >
              <span>{l.label}{isPendencia && <AlertTriangle size={11} color={COR.vermelho} style={{ marginLeft: 5, verticalAlign: 'middle' }} />}</span>
              <span style={{ color: isPendencia ? '#8A8F96' : (l.valor < 0 ? COR.vermelho : (isSubtotalForte ? COR.azul : COR.texto)) }}>
                {formatBRL(l.valor)}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 10.5, color: '#8A8F96', marginTop: 6 }}>
        Variação de Capital de Giro não calculada — os prazos de recebimento/pagamento e giro de estoque (aba 5) são premissas em dias; falta saldo inicial de contas a receber, contas a pagar e estoque para converter em R$. Pendência de estrutura.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agregação por grupo (soma das unidades) — mesmo formato de um dre/dfc de
// unidade, para reaproveitar a mesma lógica de leitura linha a linha.
// ---------------------------------------------------------------------------
function agregarDRE(dres) {
  const soma = k => dres.reduce((a, d) => a + (d[k] || 0), 0);
  const receitaBruta = soma('receitaBruta'), deducoes = soma('deducoes'), receitaLiquida = soma('receitaLiquida');
  const cpv = soma('cpv'), lucroBruto = soma('lucroBruto'), despesasSemDA = soma('despesasSemDA'), ebitda = soma('ebitda');
  const depreciacao = soma('depreciacao'), resultadoFinanceiro = soma('resultadoFinanceiro'), outras = soma('outras');
  const ircsl = soma('ircsl'), lucroLiquido = soma('lucroLiquido');
  return {
    receitaBruta, deducoes, receitaLiquida, cpv, lucroBruto,
    margemBruta: receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0,
    despesasSemDA, ebitda,
    margemEbitda: receitaLiquida ? (ebitda / receitaLiquida) * 100 : 0,
    depreciacao, resultadoFinanceiro, outras, ircsl, lucroLiquido,
    margemLiquida: receitaLiquida ? (lucroLiquido / receitaLiquida) * 100 : 0,
  };
}

function agregarDFC(dfcs) {
  const soma = k => dfcs.reduce((a, d) => a + (d[k] || 0), 0);
  return {
    lucroLiquido: soma('lucroLiquido'), depreciacao: soma('depreciacao'),
    geracaoOperacionalAntesGiro: soma('geracaoOperacionalAntesGiro'),
    variacaoCapitalGiro: soma('variacaoCapitalGiro'), fluxoOperacional: soma('fluxoOperacional'),
    capexTotal: soma('capexTotal'), fluxoInvestimento: soma('fluxoInvestimento'),
    captacoes: soma('captacoes'), amortizacoes: soma('amortizacoes'), jurosPagos: soma('jurosPagos'), aportes: soma('aportes'),
    distMinoritarios: soma('distMinoritarios'), distSocios: soma('distSocios'),
    emprestimosAcionistas: soma('emprestimosAcionistas'), devolucaoEmprestimos: soma('devolucaoEmprestimos'),
    fluxoFinanciamento: soma('fluxoFinanciamento'),
    variacaoCaixa: soma('variacaoCaixa'), caixaInicial: soma('caixaInicial'), caixaFinal: soma('caixaFinal'),
  };
}

const CONTAS_SINTETICAS_DRE = [
  { id: 'receitaLiquida', campo: 'receitaLiquida', label: 'Receita Operacional Líquida', tipo: 'base' },
  { id: 'cpv', campo: 'cpv', label: '(-) Custos dos Produtos Vendidos', tipo: 'neg', inverter: true },
  { id: 'lucroBruto', campo: 'lucroBruto', label: '(=) Lucro Bruto', tipo: 'subtotal' },
  { id: 'margemBruta', campo: 'margemBruta', label: 'Margem Bruta (%)', tipo: 'margem' },
  { id: 'despesasSemDA', campo: 'despesasSemDA', label: '(-) Despesas Operacionais', tipo: 'neg', inverter: true },
  { id: 'ebitda', campo: 'ebitda', label: '(=) EBITDA', tipo: 'subtotal' },
  { id: 'margemEbitda', campo: 'margemEbitda', label: 'Margem EBITDA (%)', tipo: 'margem' },
  { id: 'depreciacao', campo: 'depreciacao', label: '(-) Depreciação e Amortização', tipo: 'neg', inverter: true },
  { id: 'resultadoFinanceiro', campo: 'resultadoFinanceiro', label: '(+/-) Resultado Financeiro', tipo: 'flex' },
  { id: 'outras', campo: 'outras', label: '(+/-) Outras Receitas e Despesas', tipo: 'flex' },
  { id: 'ircsl', campo: 'ircsl', label: '(-) IRCSL', tipo: 'neg', inverter: true },
  { id: 'lucroLiquido', campo: 'lucroLiquido', label: '(=) Lucro Líquido', tipo: 'total' },
  { id: 'margemLiquida', campo: 'margemLiquida', label: 'Margem Líquida (%)', tipo: 'margem' },
];

const CONTAS_SINTETICAS_DFC = [
  { id: 'dfc_lucroLiquido', campo: 'lucroLiquido', label: 'Lucro Líquido', tipo: 'base' },
  { id: 'dfc_depreciacao', campo: 'depreciacao', label: '(+) Depreciação e Amortização', tipo: 'pos' },
  { id: 'dfc_geracaoOp', campo: 'geracaoOperacionalAntesGiro', label: '(=) Geração de Caixa Operacional (antes do giro)', tipo: 'subtotal' },
  { id: 'dfc_giro', campo: 'variacaoCapitalGiro', label: '(+/-) Variação de Capital de Giro', tipo: 'pendencia' },
  { id: 'dfc_fluxoOp', campo: 'fluxoOperacional', label: '(=) Fluxo de Caixa das Operações', tipo: 'subtotal' },
  { id: 'dfc_capex', campo: 'fluxoInvestimento', label: '(-) CAPEX (Investimentos)', tipo: 'neg' },
  { id: 'dfc_fluxoInv', campo: 'fluxoInvestimento', label: '(=) Fluxo de Caixa de Investimentos', tipo: 'subtotal' },
  { id: 'dfc_captacoes', campo: 'captacoes', label: '(+) Captações de empréstimos', tipo: 'pos' },
  { id: 'dfc_amortizacoes', campo: 'amortizacoes', label: '(-) Amortizações de empréstimos', tipo: 'neg', inverter: true },
  { id: 'dfc_jurosPagos', campo: 'jurosPagos', label: '(-) Juros pagos', tipo: 'neg', inverter: true },
  { id: 'dfc_aportes', campo: 'aportes', label: '(+) Aportes de capital', tipo: 'pos' },
  { id: 'dfc_distMinoritarios', campo: 'distMinoritarios', label: '(-) Distribuição a minoritários', tipo: 'neg', inverter: true },
  { id: 'dfc_distSocios', campo: 'distSocios', label: '(-) Distribuição a sócios', tipo: 'neg', inverter: true },
  { id: 'dfc_emprestimosAcionistas', campo: 'emprestimosAcionistas', label: '(+) Empréstimos de acionistas', tipo: 'pos' },
  { id: 'dfc_devolucaoEmprestimos', campo: 'devolucaoEmprestimos', label: '(-) Devolução de empréstimos de acionistas', tipo: 'neg', inverter: true },
  { id: 'dfc_fluxoFin', campo: 'fluxoFinanciamento', label: '(=) Fluxo de Caixa de Financiamentos', tipo: 'subtotal' },
  { id: 'dfc_variacaoCaixa', campo: 'variacaoCaixa', label: '(=) Variação de Caixa no Período', tipo: 'total' },
  { id: 'dfc_caixaInicial', campo: 'caixaInicial', label: '(+) Caixa Inicial', tipo: 'pos' },
  { id: 'dfc_caixaFinal', campo: 'caixaFinal', label: '(=) Caixa Final Projetado', tipo: 'total' },
];

function valorConta(conta, objeto) {
  const bruto = (objeto && objeto[conta.campo]) || 0;
  return conta.inverter ? -bruto : bruto;
}

// Uma linha de conta sintética consolidada do Grupo, com drill-down por unidade
// ao expandir (padrão "Conta | Unidade" da referência do usuário).
function LinhaContaConsolidada({ conta, grupoObjeto, porUnidade, aberto, onToggle }) {
  const isMargem = conta.tipo === 'margem';
  const isPendencia = conta.tipo === 'pendencia';
  const isForte = conta.tipo === 'subtotal' || conta.tipo === 'total';
  const valorGrupo = valorConta(conta, grupoObjeto);
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', background: isForte ? COR.total : COR.branco, border: 'none',
          borderBottom: `1px solid ${COR.borda}`, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: isMargem ? 10.5 : 12.5,
          fontWeight: isForte ? 700 : (isMargem ? 400 : 500), fontStyle: isMargem ? 'italic' : 'normal',
          color: isMargem ? '#8A8F96' : COR.texto,
        }}>
          {aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {conta.label}
          {isPendencia && <AlertTriangle size={11} color={COR.vermelho} />}
        </span>
        <span style={{
          fontSize: isMargem ? 10.5 : 12.5, fontWeight: isForte ? 700 : 400,
          color: isPendencia ? '#8A8F96' : (valorGrupo < 0 && !isMargem ? COR.vermelho : (isForte ? COR.azul : COR.texto)),
        }}>
          {isMargem ? formatPct(valorGrupo) : formatBRL(valorGrupo)}
        </span>
      </button>
      {aberto && (
        <div style={{ background: COR.claro }}>
          {UNIDADES.map(u => {
            const v = valorConta(conta, porUnidade[u.id]);
            return (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px 6px 30px', fontSize: 11.5, borderBottom: `1px solid ${COR.borda}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: COR.texto }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.cor, display: 'inline-block', flexShrink: 0 }} />
                  {conta.label} | {u.nome}
                </span>
                <span style={{ color: isMargem ? '#8A8F96' : (v < 0 ? COR.vermelho : COR.texto) }}>
                  {isMargem ? formatPct(v) : formatBRL(v)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AbaPlano5Y({ dre, plano5y, updatePremissa5Y, atualizar }) {
  const resultados = computePlano5Y(dre, plano5y.anos);
  const TODOS_ANOS = [2027, ...ANOS_PLANO_5Y];

  const linhaEstilo = (i, forte) => ({
    display: 'grid', gridTemplateColumns: '220px repeat(5, 1fr)', alignItems: 'center',
    padding: '6px 10px', fontSize: forte ? 12 : 11.5, fontWeight: forte ? 700 : 400,
    background: forte ? COR.total : (i % 2 ? COR.claro : COR.branco), borderBottom: `1px solid ${COR.borda}`,
  });

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>9. Plano 5Y</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        2027 é extraído do orçamento detalhado nas seções anteriores. 2028 a 2031 são uma projeção anual consolidada: crescimento de receita e inflação de custos/despesas aplicados ano a ano sobre a base anterior — não é o mesmo nível de detalhe do orçamento 2027.
      </p>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Premissas por ano (2028-2031)</h4>
      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ ...linhaEstilo(0, true), background: COR.azul, color: COR.branco }}>
          <div>Premissa</div>
          {TODOS_ANOS.map(a => <div key={a} style={{ textAlign: 'center' }}>{a}</div>)}
        </div>
        {[
          { campo: 'crescimentoReceita', label: 'Crescimento de receita (%)', sufixo: '%' },
          { campo: 'inflacaoCustos', label: 'Inflação de custos — CPV (%)', sufixo: '%' },
          { campo: 'inflacaoDespesas', label: 'Inflação de despesas (%)', sufixo: '%' },
          { campo: 'depreciacaoAnual', label: 'Depreciação anual (R$)', prefixo: 'R$' },
          { campo: 'aliquotaIR', label: 'Alíquota de IR/CSLL (%)', sufixo: '%' },
        ].map((linha, i) => (
          <div key={linha.campo} style={linhaEstilo(i, false)}>
            <div style={{ color: COR.texto }}>{linha.label}</div>
            <div style={{ textAlign: 'center', color: '#B5B9BE', fontSize: 10.5 }}>extraído</div>
            {ANOS_PLANO_5Y.map(ano => (
              <div key={ano} style={{ padding: '0 4px' }}>
                <CampoNumero
                  value={plano5y.anos[ano][linha.campo]}
                  onChange={v => updatePremissa5Y(ano, linha.campo, v)}
                  sufixo={linha.sufixo} prefixo={linha.prefixo} placeholder="0,0"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Cascata consolidada</h4>
      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ ...linhaEstilo(0, true), background: COR.azul, color: COR.branco }}>
          <div>Conta sintética</div>
          {TODOS_ANOS.map(a => <div key={a} style={{ textAlign: 'center' }}>{a}</div>)}
        </div>
        {[
          { campo: 'receitaLiquida', label: 'Receita Operacional Líquida' },
          { campo: 'cpv', label: '(-) CPV', inverter: true },
          { campo: 'lucroBruto', label: '(=) Lucro Bruto', forte: true },
          { campo: 'despesasSemDA', label: '(-) Despesas Operacionais', inverter: true },
          { campo: 'ebitda', label: '(=) EBITDA', forte: true },
          { campo: 'depreciacao', label: '(-) Depreciação', inverter: true },
          { campo: 'lucroLiquido', label: '(=) Lucro Líquido', forte: true },
        ].map((linha, i) => (
          <div key={linha.campo} style={linhaEstilo(i, linha.forte)}>
            <div style={{ color: linha.forte ? COR.azul : COR.texto }}>{linha.label}</div>
            {TODOS_ANOS.map(ano => {
              const v = resultados[ano][linha.campo] * (linha.inverter ? -1 : 1);
              return (
                <div key={ano} style={{ textAlign: 'center', color: v < 0 ? COR.vermelho : (linha.forte ? COR.azul : COR.texto) }}>
                  {formatBRL(v)}
                </div>
              );
            })}
          </div>
        ))}
        <div style={linhaEstilo(0, false)}>
          <div style={{ fontStyle: 'italic', color: '#8A8F96', fontSize: 10.5 }}>Margem EBITDA (%)</div>
          {TODOS_ANOS.map(ano => (
            <div key={ano} style={{ textAlign: 'center', fontStyle: 'italic', color: '#8A8F96', fontSize: 10.5 }}>
              {formatPct(resultados[ano].receitaLiquida ? (resultados[ano].ebitda / resultados[ano].receitaLiquida) * 100 : 0)}
            </div>
          ))}
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 8 }}>Justificativas por ano</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {ANOS_PLANO_5Y.map(ano => (
          <div key={ano}>
            <Rotulo>{ano}</Rotulo>
            <CampoJustificativa value={plano5y.anos[ano].justificativa} onChange={v => updatePremissa5Y(ano, 'justificativa', v)} placeholder={`Premissas de ${ano} (mercado, capacidade, contratos)`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AnaliseSensibilidades({ dados, dre, sensibilidades, updateCenarioSensibilidade }) {
  const zerado = novoCenarioSensibilidadeVazio();
  const resultadoBase = computeSensibilidade(dados, dre, zerado);
  const resultadoOtimista = computeSensibilidade(dados, dre, sensibilidades.cenarios.otimista);
  const resultadoPessimista = computeSensibilidade(dados, dre, sensibilidades.cenarios.pessimista);

  const linhaEstilo = (i, forte) => ({
    display: 'grid', gridTemplateColumns: '230px repeat(3, 1fr)', alignItems: 'center',
    padding: '6px 10px', fontSize: forte ? 12 : 11.5, fontWeight: forte ? 700 : 400,
    background: forte ? COR.total : (i % 2 ? COR.claro : COR.branco), borderBottom: `1px solid ${COR.borda}`,
  });

  const indicadores = [
    { campo: 'receita', label: 'Receita', formatar: formatBRL },
    { campo: 'ebitda', label: 'EBITDA', formatar: formatBRL, forte: true },
    { campo: 'margemEbitda', label: 'Margem EBITDA', formatar: formatPct },
    { campo: 'lucroLiquido', label: 'Resultado (Lucro Líquido)', formatar: formatBRL, forte: true },
    { campo: 'fco', label: 'Fluxo de Caixa Operacional', formatar: formatBRL },
    { campo: 'fcl', label: 'Fluxo de Caixa Livre (FCO - CAPEX)', formatar: formatBRL, forte: true },
    { campo: 'capitalGiroLiquido', label: 'Capital de Giro (AR + Estoque - AP)', formatar: formatBRL },
    { campo: 'necessidadeCaixa', label: 'Necessidade de Caixa', formatar: formatBRL },
  ];

  return (
    <div style={{ marginBottom: 26 }}>
      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 4 }}>Análise de Sensibilidades</h4>
      <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 10 }}>
        Modelo simplificado sobre os totais anuais já calculados — não repete o motor de cálculo mensal completo. Cenário Base é sempre o orçamento tal como está.
        Otimista e Pessimista são premissas suas; nenhum valor vem pré-preenchido. Recalcula automaticamente ao alterar qualquer variável abaixo.
      </p>

      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ ...linhaEstilo(0, true), background: COR.azul, color: COR.branco }}>
          <div>Variável</div>
          <div style={{ textAlign: 'center' }}>Base</div>
          <div style={{ textAlign: 'center' }}>Otimista</div>
          <div style={{ textAlign: 'center' }}>Pessimista</div>
        </div>
        {VARIAVEIS_SENSIBILIDADE.map((v, i) => (
          <div key={v.campo} style={linhaEstilo(i, false)}>
            <div style={{ color: COR.texto }}>{v.label} ({v.sufixo})</div>
            <div style={{ textAlign: 'center', color: '#B5B9BE', fontSize: 10.5 }}>0</div>
            <div style={{ padding: '0 6px' }}>
              <CampoNumero value={sensibilidades.cenarios.otimista[v.campo]} onChange={val => updateCenarioSensibilidade('otimista', v.campo, val)} placeholder="0" />
            </div>
            <div style={{ padding: '0 6px' }}>
              <CampoNumero value={sensibilidades.cenarios.pessimista[v.campo]} onChange={val => updateCenarioSensibilidade('pessimista', v.campo, val)} placeholder="0" />
            </div>
          </div>
        ))}
      </div>

      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ ...linhaEstilo(0, true), background: COR.laranja, color: COR.branco }}>
          <div>Impacto nos indicadores</div>
          <div style={{ textAlign: 'center' }}>Base</div>
          <div style={{ textAlign: 'center' }}>Otimista</div>
          <div style={{ textAlign: 'center' }}>Pessimista</div>
        </div>
        {indicadores.map((ind, i) => (
          <div key={ind.campo} style={linhaEstilo(i, ind.forte)}>
            <div style={{ color: ind.forte ? COR.azul : COR.texto }}>{ind.label}</div>
            <div style={{ textAlign: 'center', color: COR.texto }}>{ind.formatar(resultadoBase[ind.campo])}</div>
            <div style={{ textAlign: 'center', color: COR.verde, fontWeight: 700 }}>{ind.formatar(resultadoOtimista[ind.campo])}</div>
            <div style={{ textAlign: 'center', color: COR.vermelho, fontWeight: 700 }}>{ind.formatar(resultadoPessimista[ind.campo])}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <Rotulo>Justificativa — cenário Otimista</Rotulo>
          <CampoJustificativa value={sensibilidades.cenarios.otimista.justificativa} onChange={v => updateCenarioSensibilidade('otimista', 'justificativa', v)} placeholder="O que precisa acontecer para este cenário se realizar" />
        </div>
        <div>
          <Rotulo>Justificativa — cenário Pessimista</Rotulo>
          <CampoJustificativa value={sensibilidades.cenarios.pessimista.justificativa} onChange={v => updateCenarioSensibilidade('pessimista', 'justificativa', v)} placeholder="Principais riscos que levariam a este cenário" />
        </div>
      </div>
    </div>
  );
}

function AbaRevisao({ refUnidade, dados, dre, autorNome, setAutorNome, comentarioEnvio, setComentarioEnvio, enviarVersao, enviando, tudoOk, erro, aguardandoLiberacao, sensibilidades, updateCenarioSensibilidade }) {
  const [ifrs18, setIfrs18] = useState(false);
  const fd = computeFluxoIndiretoMensal(dados, dre, refUnidade);
  const fcd = computeFluxoCaixaDiretoMensal(dados, dre, refUnidade);
  const totalFcOperacional = fd.fcOperacionalMes.reduce((a, v) => a + v, 0);
  const totalFcInvestimento = fd.fcInvestimentoMes.reduce((a, v) => a + v, 0);
  const totalFcFinanciamento = fd.fcFinanciamentoMes.reduce((a, v) => a + v, 0);
  const totalVariacaoCaixa = fd.variacaoCaixaMes.reduce((a, v) => a + v, 0);

  const bridgeReceitaEbitda = [
    { label: 'Receita Bruta', valor: dre.receitaBruta, tipo: 'inicio' },
    { label: 'Deduções/Impostos', valor: -dre.deducoes, tipo: 'incremento' },
    { label: 'Custos (CPV)', valor: -dre.cpv, tipo: 'incremento' },
    { label: 'Despesas', valor: -dre.despesasSemDA, tipo: 'incremento' },
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'total' },
  ];
  const totalIrcslAno = fd.ircslMes.reduce((a, v) => a + v, 0);
  const totalGiroAno = fd.variacaoGiroMes.reduce((a, v) => a + v, 0);
  const totalAjuste13Ano = fd.ajuste13Mes.reduce((a, v) => a + v, 0);
  const bridgeEbitdaFco = [
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'inicio' },
    { label: 'Impostos', valor: -totalIrcslAno, tipo: 'incremento' },
    { label: 'Var. Capital de Giro', valor: totalGiroAno, tipo: 'incremento' },
    { label: 'Outros Ajustes', valor: totalAjuste13Ano, tipo: 'incremento' },
    { label: 'FCO', valor: totalFcOperacional, tipo: 'total' },
  ];

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Revisão, Análise e Envio — DRE consolidada</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 10 }}>Cascata no formato de referência do Grupo ARA. O envio grava a versão no histórico e no backlog do FP&amp;A.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setIfrs18(false)}
          style={{
            fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
            border: `1.5px solid ${COR.azul}`, background: !ifrs18 ? COR.azul : COR.branco, color: !ifrs18 ? COR.branco : COR.azul,
          }}
        >DRE sem IFRS 18</button>
        <button
          onClick={() => setIfrs18(true)}
          style={{
            fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
            border: `1.5px solid ${COR.azul}`, background: ifrs18 ? COR.azul : COR.branco, color: ifrs18 ? COR.branco : COR.azul,
          }}
        >DRE com IFRS 18</button>
      </div>

      {/* Ordem de 2026-08-09: DRE+gráficos -> DRE mensal -> FC Indireto mensal
          -> FC Direto mensal -> Análise de Sensibilidades -> envio. */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 380px' }}>
          <CascataDRE dre={dre} ifrs18={ifrs18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: '1 1 340px' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul, marginBottom: 2 }}>Bridge — Receita até EBITDA</div>
            <GraficoBridge etapas={bridgeReceitaEbitda} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul, marginBottom: 2 }}>Bridge — EBITDA até FCO</div>
            <GraficoBridge etapas={bridgeEbitdaFco} />
          </div>
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 4 }}>DRE Consolidada — mensal</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Todas as contas sintéticas, mês a mês, com o total do ano na última coluna.</p>
      <div style={{ marginBottom: 24 }}>
        <TabelaMensal
          linhas={[]}
          onChangeCelula={() => {}}
          linhasCalculadas={[
            { key: 'receitaBruta', label: 'Receita Bruta', valoresMensal: fd.receitaBrutaMes, totalValor: fd.receitaBrutaMes.reduce((a, v) => a + v, 0), cor: COR.texto },
            { key: 'deducoes', label: '(-) Deduções', valoresMensal: fd.deducoesMes.map(v => -v), totalValor: -fd.deducoesMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
            { key: 'receitaLiquida', label: '(=) Receita Líquida', valoresMensal: fd.receitaLiquidaMes, totalValor: fd.receitaLiquidaMes.reduce((a, v) => a + v, 0), cor: COR.azul },
            { key: 'cpv', label: '(-) CPV', valoresMensal: fd.cpvMes.map(v => -v), totalValor: -fd.cpvMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
            { key: 'lucroBruto', label: '(=) Lucro Bruto', valoresMensal: fd.lucroBrutoMes, totalValor: fd.lucroBrutoMes.reduce((a, v) => a + v, 0), cor: COR.azul },
            { key: 'despesas', label: '(-) Despesas Operacionais', valoresMensal: fd.despesasSemDAmes.map(v => -v), totalValor: -fd.despesasSemDAmes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
            { key: 'ebitdaDRE', label: '(=) EBITDA', valoresMensal: fd.ebitdaMes, totalValor: fd.ebitdaMes.reduce((a, v) => a + v, 0), cor: COR.laranja },
            { key: 'depreciacaoDRE', label: '(-) Depreciação e Amortização', valoresMensal: fd.depreciacaoMes.map(v => -v), totalValor: -fd.depreciacaoMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
            { key: 'resultadoFin', label: '(+/-) Resultado Financeiro', valoresMensal: fd.resultadoFinanceiroMes, totalValor: fd.resultadoFinanceiroMes.reduce((a, v) => a + v, 0), cor: COR.texto },
            { key: 'outrasDRE', label: '(+/-) Outras Receitas e Despesas', valoresMensal: fd.outrasMes, totalValor: fd.outrasMes.reduce((a, v) => a + v, 0), cor: COR.texto },
            { key: 'ircslDRE', label: '(-) IRCSL', valoresMensal: fd.ircslMes.map(v => -v), totalValor: -fd.ircslMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
            { key: 'lucroLiquidoDRE', label: '(=) Lucro Líquido', valoresMensal: fd.lucroLiquidoMes, totalValor: fd.lucroLiquidoMes.reduce((a, v) => a + v, 0), cor: COR.verde },
          ]}
        />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 4 }}>Fluxo de Caixa Indireto — mensal, a partir do EBITDA</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>
        FC Operacional: EBITDA menos IRCSL proporcional, mais variação de capital de giro (prazos da aba 5 sobre os saldos de abertura da aba 8) e o ajuste de competência × caixa do 13º salário (provisionado mês a mês, pago metade em novembro e metade em dezembro).
        FC Investimentos: mês de cada projeto de CAPEX (aba 6). FC Financiamentos: linhas por banco e movimentações de acionistas (aba 7).
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <CardTotal label="FC Operacional" valor={totalFcOperacional} cor={COR.verde} />
        <CardTotal label="FC Investimentos" valor={totalFcInvestimento} cor={COR.vermelho} />
        <CardTotal label="FC Financiamentos" valor={totalFcFinanciamento} cor={COR.azul} />
        <CardTotal label="Variação de caixa no ano" valor={totalVariacaoCaixa} cor={COR.laranja} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <TabelaMensal
          linhas={[]}
          onChangeCelula={() => {}}
          linhasCalculadas={[
            { key: 'ebitda', label: 'EBITDA', valoresMensal: fd.ebitdaMes, totalValor: fd.ebitdaMes.reduce((a, v) => a + v, 0), cor: COR.texto },
            { key: 'ircsl', label: '(-) IRCSL proporcional', valoresMensal: fd.ircslMes.map(v => -v), totalValor: -fd.ircslMes.reduce((a, v) => a + v, 0), cor: COR.vermelho },
            { key: 'ajuste13', label: '(+/-) Ajuste 13º (competência × caixa)', valoresMensal: fd.ajuste13Mes, totalValor: fd.ajuste13Mes.reduce((a, v) => a + v, 0), cor: COR.texto },
            { key: 'giro', label: '(+/-) Variação de Capital de Giro', valoresMensal: fd.variacaoGiroMes, totalValor: fd.variacaoGiroMes.reduce((a, v) => a + v, 0), cor: COR.texto },
            { key: 'fcop', label: '(=) FC Operacional', valoresMensal: fd.fcOperacionalMes, totalValor: totalFcOperacional, cor: COR.verde },
            { key: 'fcinv', label: '(=) FC Investimentos', valoresMensal: fd.fcInvestimentoMes, totalValor: totalFcInvestimento, cor: COR.vermelho },
            { key: 'fcfin', label: '(=) FC Financiamentos', valoresMensal: fd.fcFinanciamentoMes, totalValor: totalFcFinanciamento, cor: COR.azul },
            { key: 'varcaixa', label: '(=) Variação de Caixa no Mês', valoresMensal: fd.variacaoCaixaMes, totalValor: totalVariacaoCaixa, cor: COR.laranja },
            { key: 'caixaacum', label: 'Caixa Acumulado', valoresMensal: fd.caixaAcumuladoMes, totalValor: fd.caixaAcumuladoMes[11], cor: COR.azul, formatarTotal: v => formatBRL(fd.caixaAcumuladoMes[11]) },
          ]}
        />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 4 }}>Fluxo de Caixa Direto — mensal, por natureza de recebimento e pagamento</h4>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>
        Recebimentos e pagamentos por categoria (e não a partir do EBITDA). Construído com os mesmos componentes do Indireto acima — os dois métodos chegam ao mesmo FC Operacional, só organizam a informação de forma diferente.
      </p>
      <div style={{ marginBottom: 24 }}>
        <TabelaMensal
          linhas={[]}
          onChangeCelula={() => {}}
          linhasCalculadas={linhasFcDireto(fcd)}
        />
      </div>

      <AnaliseSensibilidades dados={dados} dre={dre} sensibilidades={sensibilidades} updateCenarioSensibilidade={updateCenarioSensibilidade} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <Rotulo>Seu nome (autor da versão)</Rotulo>
          <CampoTexto value={autorNome} onChange={setAutorNome} placeholder="Nome do gerente" />
        </div>
        <div>
          <Rotulo>Comentário da versão (opcional)</Rotulo>
          <CampoTexto value={comentarioEnvio} onChange={setComentarioEnvio} placeholder="Ex.: revisão de premissas de CAPEX" />
        </div>
      </div>

      {erro && (
        <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>
          {erro}
        </div>
      )}
      {!tudoOk && (
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, color: COR.texto, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>
          Existem checagens de Auditoria pendentes. Corrija-as antes de enviar (painel à direita).
        </div>
      )}
      {/* Pedido de 2026-08-16: trava reenvio até o FP&A liberar. */}
      {aguardandoLiberacao && (
        <div style={{ background: '#E9F0FB', border: `1px solid ${COR.azul}`, color: COR.azul, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>
          Este orçamento já foi enviado e está aguardando liberação do FP&A para permitir um novo envio.
        </div>
      )}

      <Botao variante="laranja" icone={Send} onClick={enviarVersao} disabled={!tudoOk || enviando || aguardandoLiberacao}>
        {enviando ? 'Enviando…' : aguardandoLiberacao ? 'Aguardando liberação do FP&A' : 'Enviar versão'}
      </Botao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão FP&A Corporativo
// ---------------------------------------------------------------------------

function VisaoFPA({ statusUnidades, aguardandoLiberacaoPorUnidade, liberarReenvioUnidade, backlog, unidadeDrill, abrirDrill, versoesDrill, exportarExcel, solicitarResumoExecutivo, etapasProcesso, atualizarEtapa, premissasMacro, updatePremissaMacroGlobal, buscarBoletimFocus, buscandoFocus, erroFocus, abrirVersao }) {
  const [subVisao, setSubVisao] = useState('gestao');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const totalGrupo = UNIDADES.reduce((acc, u) => {
    const d = statusUnidades[u.id];
    if (!d) return acc;
    const t = computeDRE(d, referenciaDaUnidade(u.id));
    return {
      receitaLiquida: acc.receitaLiquida + t.receitaLiquida,
      ebitda: acc.ebitda + t.ebitda,
      lucroLiquido: acc.lucroLiquido + t.lucroLiquido,
    };
  }, { receitaLiquida: 0, ebitda: 0, lucroLiquido: 0 });

  return (
    <div style={{ padding: 22, maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 17, color: COR.azul, margin: 0 }}>Visão consolidada do Grupo</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Botao variante="secundario" icone={FileSpreadsheet} onClick={exportarExcel}>Exportar Excel consolidado</Botao>
          <Botao variante="secundario" icone={FileBarChart} onClick={solicitarResumoExecutivo}>Resumo executivo (PPT)</Botao>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSubVisao('gestao')}
          style={{
            fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1.5px solid ${COR.azul}`,
            background: subVisao === 'gestao' ? COR.azul : COR.branco, color: subVisao === 'gestao' ? COR.branco : COR.azul,
          }}
        >Gestão do Orçamento</button>
        <button
          onClick={() => setSubVisao('resultados')}
          style={{
            fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1.5px solid ${COR.azul}`,
            background: subVisao === 'resultados' ? COR.azul : COR.branco, color: subVisao === 'resultados' ? COR.branco : COR.azul,
          }}
        >Resultados Consolidados por Unidade</button>
      </div>

      {subVisao === 'gestao' && (
        <>
          <h3 style={{ fontSize: 14, color: COR.azul, marginBottom: 4 }}>Premissas macroeconômicas do ciclo</h3>
          <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Editáveis apenas aqui — as unidades enxergam esses valores como referência, sem poder alterá-los.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <Botao variante="secundario" icone={buscandoFocus ? Loader2 : Info} onClick={buscarBoletimFocus} disabled={buscandoFocus}>
              {buscandoFocus ? 'Consultando Boletim Focus…' : 'Atualizar do Boletim Focus (BCB)'}
            </Botao>
          </div>
          {erroFocus && (
            <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, borderRadius: 6, padding: 10, fontSize: 11.5, marginBottom: 12 }}>
              {erroFocus}
            </div>
          )}
          <div style={{ overflowX: 'auto', marginBottom: 26 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', textAlign: 'left' }}>Premissa</th>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', minWidth: 130 }}>Valor</th>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', minWidth: 70 }}>Unidade</th>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 10.5, padding: '7px 10px', minWidth: 160 }}>Fonte / atualização</th>
                </tr>
              </thead>
              <tbody>
                {premissasMacro.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 ? COR.claro : COR.branco }}>
                    <td style={{ fontSize: 12, color: COR.texto, padding: '6px 10px', border: `1px solid ${COR.borda}` }}>{p.nome}</td>
                    <td style={{ padding: 3, border: `1px solid ${COR.borda}` }}>
                      <CampoNumero value={p.valor} onChange={v => updatePremissaMacroGlobal(p.id, v)} placeholder="0,00" />
                    </td>
                    <td style={{ fontSize: 11, color: '#8A8F96', padding: '6px 10px', border: `1px solid ${COR.borda}` }}>{p.unidade}</td>
                    <td style={{ fontSize: 10.5, color: '#8A8F96', padding: '6px 10px', border: `1px solid ${COR.borda}` }}>{p.fonte ? `${p.fonte} — ${formatData(p.atualizadoEm)}` : 'Pendente de definição'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 14, color: COR.azul, marginBottom: 10 }}>Cronograma do processo orçamentário</h3>
          <div style={{ marginBottom: 26 }}>
            <GanttEtapas etapas={etapasProcesso} onChangeEtapa={atualizarEtapa} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 14, color: COR.azul, margin: 0 }}>Status por unidade</h3>
            <div style={{ width: 200 }}>
              <Selecao
                value={filtroStatus} onChange={setFiltroStatus}
                opcoes={[
                  { id: 'todos', nome: 'Todos os status' },
                  { id: 'nao_iniciado', nome: 'Não iniciado' },
                  { id: 'em_preenchimento', nome: 'Em preenchimento' },
                  { id: 'enviado', nome: 'Enviado' },
                ]}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 26 }}>
            {UNIDADES.filter(u => filtroStatus === 'todos' || (statusUnidades[u.id]?.meta?.status || 'nao_iniciado') === filtroStatus).map(u => {
              const d = statusUnidades[u.id];
              const t = d ? computeDRE(d, referenciaDaUnidade(u.id)) : computeDRE(emptyFormData(u.id), referenciaDaUnidade(u.id));
              const aberto = unidadeDrill === u.id;
              return (
                <div key={u.id} style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => abrirDrill(u.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', background: COR.branco, border: 'none', cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: u.cor, display: 'inline-block' }} />
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: COR.texto }}>{u.nome}</span>
                      <StatusBadge status={d?.meta?.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <span style={{ fontSize: 12.5, color: '#7A8088' }}>Autor: {d?.meta?.autor || '—'}</span>
                      <span style={{ fontSize: 12.5, color: '#7A8088' }}>Atualizado: {formatData(d?.meta?.atualizadoEm)}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: COR.azul }}>{formatBRL(t.lucroLiquido)}</span>
                      {/* Pedido de 2026-08-16: não é <button> aninhado de
                          propósito — a linha inteira já é um <button> (abre
                          o drill), então isto é um span clicável com
                          stopPropagation em vez de outro <button>. */}
                      {aguardandoLiberacaoPorUnidade?.[u.id] && (
                        <span
                          role="button" tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); liberarReenvioUnidade(u.id); }}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 14, cursor: 'pointer',
                            border: `1.5px solid ${COR.azul}`, color: COR.azul, background: '#E9F0FB',
                          }}
                        >Liberar novo envio</span>
                      )}
                      {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>
                  {aberto && (
                    <div style={{ padding: 14, background: COR.claro, borderTop: `1px solid ${COR.borda}` }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                        <CardTotal label="Receita líquida" valor={t.receitaLiquida} cor={COR.verde} />
                        <CardTotal label="Lucro bruto" valor={t.lucroBruto} cor={COR.azul} />
                        <CardTotal label="EBITDA" valor={t.ebitda} cor={COR.laranja} />
                        <CardTotal label="Lucro líquido" valor={t.lucroLiquido} cor={u.cor} />
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 6 }}>Últimas versões</div>
                      {versoesDrill.length === 0 && <div style={{ fontSize: 11.5, color: '#8A8F96' }}>Nenhuma versão enviada por esta unidade.</div>}
                      {versoesDrill.slice(0, 5).map(v => (
                        <div key={v.id} style={{ fontSize: 11.5, padding: '4px 0', borderBottom: `1px solid ${COR.borda}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span><b>{v.autor}</b> — {formatData(v.timestamp)} — Lucro líquido {formatBRL(v.totais?.lucroLiquido)} {v.comentario ? `— ${v.comentario}` : ''}</span>
                          <button
                            onClick={() => abrirVersao(u.id, v.id)}
                            style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 700, color: COR.azul, background: 'none', border: `1px solid ${COR.azul}`, borderRadius: 12, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}
                          >Abrir</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize: 14, color: COR.azul, marginBottom: 10 }}>Backlog de alterações</h3>
          <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, maxHeight: 360, overflowY: 'auto' }}>
            {backlog.length === 0 && <div style={{ padding: 14, fontSize: 12, color: '#8A8F96' }}>Nenhuma alteração registrada ainda.</div>}
            {backlog.map((b, i) => {
              const u = UNIDADES.find(x => x.id === b.unidadeId);
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: i % 2 ? COR.claro : COR.branco, borderBottom: `1px solid ${COR.borda}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: u?.cor || COR.borda, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: COR.texto, minWidth: 110 }}>{u?.nome || b.unidadeId}</span>
                  <span style={{ fontSize: 11.5, color: '#7A8088', minWidth: 140 }}>{formatData(b.timestamp)}</span>
                  <span style={{ fontSize: 11.5, color: COR.texto, flex: 1 }}>{b.autor}{b.comentario ? ` — ${b.comentario}` : ''}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COR.azul }}>{formatBRL(b.totalGeral)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {subVisao === 'resultados' && (
        <VisaoResultadosConsolidados statusUnidades={statusUnidades} totalGrupo={totalGrupo} />
      )}
    </div>
  );
}

function VisaoResultadosConsolidados({ statusUnidades, totalGrupo }) {
  const [linhasAbertasDRE, setLinhasAbertasDRE] = useState({});
  const [linhasAbertasDFC, setLinhasAbertasDFC] = useState({});

  const porUnidadeDRE = {};
  const porUnidadeDFC = {};
  UNIDADES.forEach(u => {
    const d = statusUnidades[u.id] || emptyFormData(u.id);
    const t = computeDRE(d, referenciaDaUnidade(u.id));
    porUnidadeDRE[u.id] = t;
    porUnidadeDFC[u.id] = computeDFC(d, t);
  });
  const grupoDRE = agregarDRE(Object.values(porUnidadeDRE));
  const grupoDFC = agregarDFC(Object.values(porUnidadeDFC));

  function toggleDRE(id) { setLinhasAbertasDRE(prev => ({ ...prev, [id]: !prev[id] })); }
  function toggleDFC(id) { setLinhasAbertasDFC(prev => ({ ...prev, [id]: !prev[id] })); }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <CardTotal label="Receita líquida do Grupo" valor={totalGrupo.receitaLiquida} cor={COR.verde} />
        <CardTotal label="EBITDA do Grupo" valor={totalGrupo.ebitda} cor={COR.laranja} />
        <CardTotal label="Lucro líquido do Grupo" valor={totalGrupo.lucroLiquido} cor={COR.azul} />
      </div>

      <h3 style={{ fontSize: 14, color: COR.azul, marginBottom: 4 }}>DRE Consolidada do Grupo — por conta sintética</h3>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Clique em uma conta para abrir o drill-down por unidade.</p>
      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden', marginBottom: 26 }}>
        {CONTAS_SINTETICAS_DRE.map(conta => (
          <LinhaContaConsolidada
            key={conta.id} conta={conta} grupoObjeto={grupoDRE} porUnidade={porUnidadeDRE}
            aberto={!!linhasAbertasDRE[conta.id]} onToggle={() => toggleDRE(conta.id)}
          />
        ))}
      </div>

      <h3 style={{ fontSize: 14, color: COR.azul, marginBottom: 4 }}>Fluxo de Caixa Consolidado do Grupo — por conta sintética</h3>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>Método indireto. Clique em uma conta para abrir o drill-down por unidade.</p>
      <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, overflow: 'hidden' }}>
        {CONTAS_SINTETICAS_DFC.map(conta => (
          <LinhaContaConsolidada
            key={conta.id} conta={conta} grupoObjeto={grupoDFC} porUnidade={porUnidadeDFC}
            aberto={!!linhasAbertasDFC[conta.id]} onToggle={() => toggleDFC(conta.id)}
          />
        ))}
      </div>
      <p style={{ fontSize: 10.5, color: '#8A8F96', marginTop: 6 }}>
        Variação de Capital de Giro não calculada — pendência de estrutura (ver nota na Revisão do gerente).
      </p>
    </>
  );
}



