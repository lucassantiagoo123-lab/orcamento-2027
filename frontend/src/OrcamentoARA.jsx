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
import { listarPremissasMacro as listarPremissasMacroApi, atualizarPremissaMacro as atualizarPremissaMacroApi } from './api/premissasMacro.js';
import { listarEtapasProcesso as listarEtapasProcessoApi, atualizarEtapaProcesso as atualizarEtapaProcessoApi, listarBacklog as listarBacklogApi } from './api/processo.js';
import { logout } from './api/auth.js';
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
// 2026-08-20: Agrícola e Resorts viraram Família (2 sites + Consolidado —
// ver FAMILIAS_MULTISITE). Os sites (agricola_tds/agricola_fds/samoa_beach/
// samoa_villa) têm lançamento próprio; 'agricola'/'resorts' (Consolidado)
// continuam na lista só porque o envio/histórico deles reaproveita o mesmo
// PUT/POST de qualquer unidade (ver ConsolidadoAgricola/ConsolidadoResorts)
// — não têm formulário de premissa próprio (a tela não deixa editar `dados`
// neles).
const UNIDADES_COM_LANCAMENTO_HABILITADO = ['textil', 'agricola', 'agricola_tds', 'agricola_fds', 'resorts', 'samoa_beach', 'samoa_villa', 'corporativo'];

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
  // ARA Agrícola virou 3 "unidades" em 2026-08-20 (duas fazendas + o
  // consolidado das duas) — ver FAMILIA_AGRICOLA/ConsolidadoAgricola. O
  // nav agrupa as 3 sob um único botão "ARA Agrícola"; escolher a fazenda
  // acontece na subfaixa de botões que aparece embaixo.
  { id: 'agricola', nome: 'ARA Agrícola — Consolidado', cor: '#009640', logo: '/logos/ara-agricola.png', logoAltura: 17 },
  { id: 'agricola_tds', nome: 'ARA Agrícola — Terra do Sol', cor: '#009640', logo: '/logos/ara-agricola.png', logoAltura: 17 },
  { id: 'agricola_fds', nome: 'ARA Agrícola — Frutos do Sol', cor: '#009640', logo: '/logos/ara-agricola.png', logoAltura: 17 },
  // Mesmo padrão da Agrícola, aplicado ao Resorts em 2026-08-20: Samoa
  // Beach e Samoa Villa são as unidades editáveis, 'resorts' é o
  // Consolidado — ver FAMILIA_RESORTS/ConsolidadoResorts.
  { id: 'resorts', nome: 'ARA Resorts — Consolidado', cor: '#79834F', logo: '/logos/ara-resorts.jpg', logoAltura: 24 },
  { id: 'samoa_beach', nome: 'ARA Resorts — Samoa Beach', cor: '#79834F', logo: '/logos/ara-resorts.jpg', logoAltura: 24 },
  { id: 'samoa_villa', nome: 'ARA Resorts — Samoa Villa', cor: '#79834F', logo: '/logos/ara-resorts.jpg', logoAltura: 24 },
  { id: 'ei', nome: 'ARA EI', cor: '#F07D00', logo: null }, // pendente: arquivo não recebido ainda
  // Renomeado de "ARA Energia" em 2026-08-09 — id interno continua 'energia'
  // (evita mexer em schema/seed/perfis), mas essa unidade não segue a mesma
  // estrutura de abas das demais: é uma Visão de Portfólio de Investimentos
  // (UFVs, PCH, Novo Cais, MCMV) e Aporte/Distribuição no Grupo, não um DRE
  // por CC — estrutura de verdade ainda não definida, ver aviso na tela.
  { id: 'energia', nome: 'Escritório de Investimentos', cor: '#FECC00', logo: null },
  { id: 'corporativo', nome: 'Corporativo', cor: '#0C4391', logo: '/logos/grupo-ara.jpg', logoAltura: 24 },
];

// As 3 "unidades" da Agrícola (2026-08-20) — agrupadas visualmente sob um
// único botão "ARA Agrícola" na barra de navegação (ver VisaoGerente).
// Exportado (2026-08-30) pra AdminPanel.jsx vincular a família inteira de
// uma vez ao marcar um Gestor da Unidade — ver nota em toggleUnidade lá.
export const FAMILIA_AGRICOLA = ['agricola_tds', 'agricola_fds', 'agricola'];
const SUBUNIDADES_AGRICOLA = [
  { id: 'agricola_tds', nome: 'Terra do Sol (TDS)' },
  { id: 'agricola_fds', nome: 'Frutos do Sol (FDS)' },
  { id: 'agricola', nome: 'Consolidado' },
];
// Mesmo padrão, aplicado ao Resorts em 2026-08-20 (ver ConsolidadoResorts).
export const FAMILIA_RESORTS = ['samoa_beach', 'samoa_villa', 'resorts'];
const SUBUNIDADES_RESORTS = [
  { id: 'samoa_beach', nome: 'Samoa Beach' },
  { id: 'samoa_villa', nome: 'Samoa Villa' },
  { id: 'resorts', nome: 'Consolidado' },
];
// Toda "família" de unidades multi-site (fazendas, resorts) — usada pra
// agrupar a barra de navegação genericamente (ver VisaoGerente) sem
// precisar de um bloco de código separado por família.
const FAMILIAS_MULTISITE = [
  { ids: FAMILIA_AGRICOLA, subunidades: SUBUNIDADES_AGRICOLA, nome: 'ARA Agrícola', cor: '#009640', logo: '/logos/ara-agricola.png', logoAltura: 17 },
  { ids: FAMILIA_RESORTS, subunidades: SUBUNIDADES_RESORTS, nome: 'ARA Resorts', cor: '#79834F', logo: '/logos/ara-resorts.jpg', logoAltura: 24 },
];
// Pra somar "o Grupo inteiro" (dashboard do FP&A, PPT, Resultados
// Consolidados) sem contar Agrícola/Resorts em dobro — 'agricola'/'resorts'
// (Consolidado) já são as duas fazendas/resorts somados (ver
// dreDaUnidade/somarDRE), então os sites individuais ficam de fora dessa
// lista específica. Listagens que mostram cada "unidade" como linha
// própria (Status por unidade, por exemplo) continuam usando UNIDADES sem
// filtro — lá não tem soma, então não tem risco de duplicar.
const IDS_MULTISITE_FILHOS = FAMILIAS_MULTISITE.flatMap(f => f.ids.slice(0, -1)); // tudo, menos o Consolidado (último da lista) de cada família
const UNIDADES_PARA_TOTAL_GRUPO = UNIDADES.filter(u => !IDS_MULTISITE_FILHOS.includes(u.id));

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
  // cambio_eur/cambio_gbp (2026-08-23, pedido: "adicione o câmbio de forma
  // estática mensal previsto no FP&A Corporativo, incluindo como parte do
  // cálculo da receita com Mercado Externo") — mesmo racional do câmbio
  // USD acima: um valor único pro ciclo inteiro, usado pela Receita de
  // Mercado Externo da Agrícola (ver receitaVazia/receitaBrutaPorMes,
  // produto com mercado==='externo').
  { id: 'cambio_eur', nome: 'Câmbio — EUR/BRL médio', unidade: 'R$' },
  { id: 'cambio_gbp', nome: 'Câmbio — GBP/BRL médio', unidade: 'R$' },
  { id: 'selic', nome: 'Taxa Selic média', unidade: '% a.a.' },
  { id: 'pib', nome: 'Crescimento do PIB', unidade: '% a.a.' },
  { id: 'reajuste_salarial', nome: 'Reajuste salarial/dissídio', unidade: '% a.a.' },
];

// ---- Centros de Custo — Consulta CTT010, nível de subárea (14 CCs) ----
// Fonte: extrato CTT010 fornecido pelo usuário em 2026-08-19 (código,
// descrição, responsável) — resolve a pendência registrada desde a Fase 1
// ("granularidade do CC: usando nível de área — confirmar se deve descer ao
// nível de subárea"). Substitui o nível de área anterior (8 CCs, códigos
// 00401/00402/... — ver CCS_PLACEHOLDER_AGRICOLA_RESORTS logo abaixo, que
// preserva essa lista antiga como placeholder pra Agrícola/Resorts, já que
// elas apontavam pra este mesmo array antes desta mudança).
// tipo: prefixo 001./002. = despesa (apoio/comercial), 004. = produção.
export const CCS_TEXTIL = [
  { codigo: '001.0101', nome: 'Administração - Apoio', tipo: 'despesa' },
  { codigo: '001.0105', nome: 'Tecnologia da Informação', tipo: 'despesa' },
  { codigo: '001.0109', nome: 'Logística', tipo: 'despesa' },
  { codigo: '002.0101', nome: 'Vendas', tipo: 'despesa' },
  { codigo: '002.0102', nome: 'Marketing', tipo: 'despesa' },
  { codigo: '002.0103', nome: 'Fashion', tipo: 'despesa' },
  { codigo: '004.0101', nome: 'Malharia', tipo: 'producao' },
  { codigo: '004.0199', nome: 'Manutenção Malharia', tipo: 'producao' },
  { codigo: '004.0201', nome: 'Beneficiamento', tipo: 'producao' },
  { codigo: '004.0299', nome: 'Manutenção Beneficiamento', tipo: 'producao' },
  { codigo: '004.0301', nome: 'Apoio Produção', tipo: 'producao' },
  { codigo: '004.0302', nome: 'Qualidade Processo & Produto', tipo: 'producao' },
  { codigo: '004.0303', nome: 'Infra Estrutura', tipo: 'producao' },
  { codigo: '004.0304', nome: 'ETE', tipo: 'producao' },
];

// Decisão de 2026-08-09 (Agrícola/Resorts sem CC oficial — ver nota no
// arquivo espelho backend/src/calc/constantesAgricolaResorts.js): antes,
// Agrícola/Resorts apontavam direto pra CCS_TEXTIL (mesma referência!) —
// agora que CCS_TEXTIL virou o nível de subárea real da Têxtil (2026-08-19),
// essa lista antiga (nível de área, 8 CCs) precisou virar um array próprio
// pra não vazar CC da Têxtil pra Agrícola/Resorts.
export const CCS_PLACEHOLDER_AGRICOLA_RESORTS = [
  { codigo: '00401', nome: 'Malharia', tipo: 'producao' }, // nome herdado da Têxtil — ajustar ao subir a planilha real
  { codigo: '00402', nome: 'Beneficiamento', tipo: 'producao' },
  { codigo: '00403', nome: 'Produção', tipo: 'producao' },
  { codigo: '00001', nome: 'Diretoria', tipo: 'despesa' },
  { codigo: '00101', nome: 'Administração', tipo: 'despesa' },
  { codigo: '00201', nome: 'Comercial', tipo: 'despesa' },
  { codigo: '00301', nome: 'Logística', tipo: 'despesa' },
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


// Agricola_Contas_x_Pacote: 153 contas classificadas na Matriz de Governança
// (OK), 48 fora do escopo (CAPEX/obra, conta sintética, despesa financeira,
// ou sem pacote) — excluídas. Em 2026-08-20, o De/Para com Camadas.xlsx (CCs
// da área Fazenda × conta analítica, ver CONTAS_POR_CC_AGRICOLA) revelou 4
// contas reais em uso que não estavam na Matriz — adicionadas (71102034,
// 71102036 em manutencao; 71102049 em producao; 71103001 em servicos),
// mantendo o resto do plano intacto. Total agora: 157 contas.
const PACOTES_AGRICOLA = [
  { id: 'pessoal', nome: "Pessoal", ref: 'Matriz_Governanca_OBZ_2027_4 (62 contas)' },
  { id: 'administrativo_utilidades', nome: "Administrativo e Utilidades", ref: 'Matriz_Governanca_OBZ_2027_4 (29 contas)' },
  { id: 'servicos', nome: "Serviços de Terceiros", ref: 'Matriz_Governanca_OBZ_2027_4 (9 contas) + Camadas.xlsx (1 conta)' },
  { id: 'manutencao', nome: "Manutenção", ref: 'Matriz_Governanca_OBZ_2027_4 (9 contas) + Camadas.xlsx (2 contas)' },
  { id: 'impostos', nome: "Impostos Indiretos e Diretos", ref: 'Matriz_Governanca_OBZ_2027_4 (4 contas)' },
  { id: 'depreciacao', nome: "Depreciação e Amortização", ref: 'Matriz_Governanca_OBZ_2027_4 (3 contas)' },
  { id: 'fretes', nome: "Fretes e Logística", ref: 'Matriz_Governanca_OBZ_2027_4 (10 contas)' },
  { id: 'producao', nome: "Produção", ref: 'Matriz_Governanca_OBZ_2027_4 (15 contas) + Camadas.xlsx (1 conta)' },
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
    { codigo: '34202093', nome: "MEDICAMENTO E FARMACIA", origem: 'Despesa' }, // Base orçamento 2026.xlsx 2026-08-24 — não existia na Matriz de Governança, conta real do CC DP e SESTR
  ],
  servicos: [
    { codigo: '71102003', nome: "SERVICOS DE TERCEIROS", origem: 'Custo' },
    { codigo: '71102016', nome: "ASSESSORIAS E CONSULTORIAS", origem: 'Custo' },
    { codigo: '71102017', nome: "SERVICO PRESTADO PESSOA FISICA", origem: 'Custo' },
    { codigo: '71102031', nome: "SEGURANCA E VIGILANCIA", origem: 'Custo' },
    { codigo: '71103001', nome: "SERVICOS TECNICOS", origem: 'Custo' }, // De/Para Camadas.xlsx 2026-08-20 — não existia na Matriz de Governança, conta real do CC Adm Fazenda
    { codigo: '71103099', nome: "SERVICOS DIVERSOS", origem: 'Custo' }, // Base orçamento 2026.xlsx 2026-08-24 — não existia na Matriz de Governança, conta real do CC Adm PH
    { codigo: '71105002', nome: "CERTIFICADO DE QUALIDADE", origem: 'Custo' }, // Base orçamento 2026.xlsx 2026-08-24 — idem, conta real do CC Certificações
    { codigo: '34104013', nome: "SERVICOS PRESTADOS PESSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34104019', nome: "SERVICO PRESTADO PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202010', nome: "SERVICOS DE TERCEIROS - PESSSOA JURIDICA", origem: 'Despesa' },
    { codigo: '34202017', nome: "SERVICOS DE TERCEIRO PESSOA FISICA", origem: 'Despesa' },
    { codigo: '34202023', nome: "SEGURANCA E VIGILANCIA", origem: 'Despesa' },
  ],
  manutencao: [
    { codigo: '71102004', nome: "MANUTENCAO, CONSERVACAO E LIMPEZA", origem: 'Custo' },
    { codigo: '71102033', nome: "MATERIAL DE MANUT - VEICULOS-MOTOS", origem: 'Custo' },
    { codigo: '71102034', nome: "PECAS E SERV - TRATORES-IMPLEMENTOS", origem: 'Custo' }, // De/Para Camadas.xlsx 2026-08-20 — não existia na Matriz de Governança, conta real usada pelos CCs da área Fazenda (Cabeçal 1/2, Adm Fazenda, Irrigação)
    { codigo: '71102036', nome: "MANUTENCAO DA COMUNICACAO", origem: 'Custo' }, // De/Para Camadas.xlsx 2026-08-20 — idem
    { codigo: '71102046', nome: "MATERIAL DE OFICINA", origem: 'Custo' },
    { codigo: '71102050', nome: "PECAS E SERV", origem: 'Custo' }, // Base orçamento 2026.xlsx 2026-08-24 — não existia na Matriz de Governança, conta real do CC Adm PH
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
    { codigo: '71102049', nome: "MATERIAL DE IRRIGACAO", origem: 'Custo' }, // De/Para Camadas.xlsx 2026-08-20 — não existia na Matriz de Governança, conta real do CC Irrigação
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

// ---------------------------------------------------------------------------
// CCs reais da ARA Agrícola (Plano Centro de Custo.xlsx, fornecida em
// 2026-08-20) — 9 áreas (nível sintético/consolidador, nivel:2) e seus CCs
// analíticos (nivel:3, areaCodigo aponta pro código da área-mãe). Mesma
// estrutura de CC para as duas fazendas (Terra do Sol/TDS e Frutos do
// Sol/FDS) — ver AbaRevisao/unidades 'agricola_tds'/'agricola_fds'.
// tipo: 'producao' quando a coluna TIPO DE CUSTEIO da planilha é 'Custo'
// (inclusive quando isso diverge do tipo geral da área — ex.: Transporte de
// Pessoal e Câmara Fria são 'Custo' dentro de áreas majoritariamente 'Adm'/
// 'Comercial'), 'despesa' quando é 'Adm' ou 'Comercial'.
// Responsáveis (nomes completos confirmados pelo usuário em 2026-08-20,
// já que a planilha só trazia o primeiro nome de 4 dos 7): Luiz Lima,
// Leodivan Bagagi, Ivan Lopes, Emanuela Pereira, Maicon Silva, Janyne
// Miranda, Edivania Parente.
export const CCS_AGRICOLA = [
  { codigo: '501', nome: 'Administrativo Financeiro', tipo: 'despesa', nivel: 2, areaCodigo: null },
  { codigo: '50101', nome: 'Adm. Financeiro', tipo: 'despesa', nivel: 3, areaCodigo: '501' },
  { codigo: '50102', nome: 'DP e SESTR', tipo: 'despesa', nivel: 3, areaCodigo: '501' },
  { codigo: '50103', nome: 'TI Software', tipo: 'despesa', nivel: 3, areaCodigo: '501' },
  { codigo: '50105', nome: 'Fiscal', tipo: 'despesa', nivel: 3, areaCodigo: '501' },

  { codigo: '502', nome: 'Operação', tipo: 'despesa', nivel: 2, areaCodigo: null },
  { codigo: '50201', nome: 'Segurança e Portaria', tipo: 'despesa', nivel: 3, areaCodigo: '502' },
  { codigo: '50202', nome: 'Oficina e Manutenção', tipo: 'despesa', nivel: 3, areaCodigo: '502' },
  { codigo: '50203', nome: 'Infra Estrutura', tipo: 'despesa', nivel: 3, areaCodigo: '502' },
  { codigo: '50204', nome: 'Transporte de Pessoal', tipo: 'producao', nivel: 3, areaCodigo: '502' },
  { codigo: '50205', nome: 'Cantina', tipo: 'despesa', nivel: 3, areaCodigo: '502' },
  { codigo: '50206', nome: 'Adm. Operação', tipo: 'despesa', nivel: 3, areaCodigo: '502' },
  { codigo: '50207', nome: 'Almoxarifado', tipo: 'despesa', nivel: 3, areaCodigo: '502' },

  { codigo: '503', nome: 'Produção', tipo: 'producao', nivel: 2, areaCodigo: null },
  { codigo: '50301', nome: 'Cabeçal 1', tipo: 'producao', nivel: 3, areaCodigo: '503' },
  { codigo: '50302', nome: 'Cabeçal 2', tipo: 'producao', nivel: 3, areaCodigo: '503' },
  { codigo: '50303', nome: 'Cabeçal 3', tipo: 'producao', nivel: 3, areaCodigo: '503' },

  { codigo: '504', nome: 'Fazenda', tipo: 'producao', nivel: 2, areaCodigo: null },
  { codigo: '50402', nome: 'Adm Fazenda', tipo: 'producao', nivel: 3, areaCodigo: '504' },
  { codigo: '50403', nome: 'Irrigação', tipo: 'producao', nivel: 3, areaCodigo: '504' },
  { codigo: '50404', nome: 'Bloco Teste Uva', tipo: 'producao', nivel: 3, areaCodigo: '504' },
  { codigo: '50405', nome: 'Bloco Teste Mirtilo', tipo: 'producao', nivel: 3, areaCodigo: '504' },

  { codigo: '505', nome: 'Packing House', tipo: 'producao', nivel: 2, areaCodigo: null },
  { codigo: '50501', nome: 'Certificações', tipo: 'producao', nivel: 3, areaCodigo: '505' },
  { codigo: '50502', nome: 'Adm PH', tipo: 'producao', nivel: 3, areaCodigo: '505' },
  { codigo: '50503', nome: 'Operações PH', tipo: 'producao', nivel: 3, areaCodigo: '505' },
  { codigo: '50504', nome: 'Embalagem', tipo: 'producao', nivel: 3, areaCodigo: '505' },

  { codigo: '506', nome: 'Comercial', tipo: 'despesa', nivel: 2, areaCodigo: null },
  { codigo: '50601', nome: 'Vendas', tipo: 'despesa', nivel: 3, areaCodigo: '506' },
  { codigo: '50602', nome: 'Marketing', tipo: 'despesa', nivel: 3, areaCodigo: '506' },
  { codigo: '50605', nome: 'Logística', tipo: 'despesa', nivel: 3, areaCodigo: '506' },
  { codigo: '50606', nome: 'Câmara Fria', tipo: 'producao', nivel: 3, areaCodigo: '506' },

  { codigo: '507', nome: 'Planejamento e Gestão', tipo: 'despesa', nivel: 2, areaCodigo: null },
  { codigo: '50701', nome: 'Invest Máquinas-Equipamentos', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50702', nome: 'Invest Edificações', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50703', nome: 'Invest Mudas', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50704', nome: 'Invest Diversos', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50705', nome: 'Projeto Pessoas', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50706', nome: 'Projeto Replantio', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50710', nome: 'Suprimentos', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50711', nome: 'Gente e Gestão', tipo: 'despesa', nivel: 3, areaCodigo: '507' },
  { codigo: '50712', nome: 'Adm. Planejamento e Gestão', tipo: 'despesa', nivel: 3, areaCodigo: '507' },

  // Uva Terceiros: sub-CCs nomeados por fornecedor/fazenda terceira (não são
  // funcionários do Grupo ARA) — decisão de 2026-08-20: ficam todos sob a
  // titularidade da Emanuela (responsável da área 508 inteira), sem usuário
  // próprio por sub-CC.
  { codigo: '508', nome: 'Uva Terceiros', tipo: 'producao', nivel: 2, areaCodigo: null },
  { codigo: '50801', nome: 'Roberto Hirai', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50802', nome: 'Marcos Luiz Loureiro Alves', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50803', nome: 'Latitude 9', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50804', nome: 'Fruticultura Maria Martins Ltda', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50805', nome: 'Cooperativa Agrícola', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50806', nome: 'Frutos do Sol', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50807', nome: 'Aldemir de Araújo', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50808', nome: 'Ibatuba', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50809', nome: 'Nova Neruda', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50810', nome: 'Ednilson', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50811', nome: 'Marcus Vinícius Furtado Santos', tipo: 'producao', nivel: 3, areaCodigo: '508' },
  { codigo: '50812', nome: 'Colinas do Vale', tipo: 'producao', nivel: 3, areaCodigo: '508' },

  { codigo: '511', nome: 'Custo Mercadoria Vendida', tipo: 'producao', nivel: 2, areaCodigo: null },
  { codigo: '51101', nome: 'Custo da Mercadoria Vendida', tipo: 'producao', nivel: 3, areaCodigo: '511' },
];

// Responsável de cada área (código sintético de 3 dígitos) — usado só de
// referência/documentação aqui; o vínculo de acesso de verdade é feito na
// Administração (usuario_cc_corporativo), não lido daqui.
export const RESPONSAVEIS_AREA_AGRICOLA = {
  '501': 'Luiz Lima', '502': 'Leodivan Bagagi', '503': 'Ivan Lopes', '504': 'Ivan Lopes',
  '505': 'Emanuela Pereira', '506': 'Maicon Silva', '507': 'Janyne Miranda',
  '508': 'Emanuela Pereira', '511': 'Edivania Parente',
};

// De/Para conta analítica × CC — Camadas.xlsx (2026-08-20, só as 5 áreas da
// Fazenda) mais Base orçamento 2026.xlsx (fornecida em 2026-08-24, cobre 30
// dos 44 CCs — as 9 áreas exceto Uva Terceiros (508, 12 sub-CCs de
// fornecedores terceiros), Investimentos/Projetos (507xx CAPEX-like, exceto
// Suprimentos/Gente e Gestão) e CMV (511), que continuam sem planilha de
// origem própria e ficam como painel de referência, sem lançamento).
//
// A planilha-fonte tem uma FAZENDA por linha (TDS/FDS) e as duas usam
// contas ligeiramente diferentes por CC (conferido linha a linha, ver
// scripts de importação da sessão de 2026-08-24) — como CONTAS_POR_CC_AGRICOLA
// é uma estrutura única compartilhada pelas duas fazendas (mesmo CC
// analítico nas duas, ver CCS_AGRICOLA), cada lista abaixo é a UNIÃO
// TDS ∪ FDS: nenhuma conta real de nenhuma das duas fica de fora, ao custo
// de um gestor eventualmente ver 1-2 contas a mais do que usa na prática
// (nunca a menos). Só entram linhas de Custo/Despesa (prefixo 71/34) — as
// linhas de Receita (31xxx) da mesma planilha não pertencem a este módulo
// (ver receita.produtos). Todos os códigos abaixo já existem em
// PLANO_CONTAS_AGRICOLA (4 deles foram adicionados agora — ver notas "Base
// orçamento 2026.xlsx" acima — os demais já vinham da Matriz de Governança
// ou do De/Para Camadas.xlsx) — aqui só se decide QUAIS valem para QUAL CC.
export const CONTAS_POR_CC_AGRICOLA = {
  '50101': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201010', '34201014', '34201019', '34202003', '34202004', '34202006', '34202007', '34202010', '34202011', '34202014', '34202015', '34202016', '34202017', '34202021', '34202022', '34202025', '34202026', '34202028', '34202029', '34202030', '34202031', '34202090', '71102008'], // Adm. Financeiro
  '50102': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201010', '34201014', '34202004', '34202006', '34202007', '34202010', '34202011', '34202021', '34202026', '34202029', '34202031', '34202090', '34202093', '71102008'], // DP e SESTR
  '50103': ['34202011', '34202027', '71102008'], // TI Software
  '50105': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201010', '34201014', '71102008'], // Fiscal
  '50201': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201008', '34201010', '34202011', '71102008'], // Segurança e Portaria
  '50202': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201010', '34201014', '34201022', '34202011', '34202026', '71102008'], // Oficina e Manutenção
  '50203': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201010', '34201014', '34201022', '34202004', '34202006', '34202007', '34202011', '34202023', '34202029', '34202030', '34202031', '71102008'], // Infra Estrutura
  '50204': ['71101017'], // Transporte de Pessoal
  '50205': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201011', '34201014', '34202006', '34202007', '34202010', '34202011', '34202021', '34202026', '71102008'], // Cantina
  '50206': ['34201001'], // Adm. Operação
  '50207': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201010', '34201014', '34201022', '34202006'], // Almoxarifado
  '50301': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71101009', '71101010', '71101011', '71101022', '71102001', '71102003', '71102004', '71102005', '71102007', '71102008', '71102009', '71102011', '71102012', '71102014', '71102015', '71102018', '71102019', '71102022', '71102024', '71102033', '71102034', '71102036', '71102037', '71102045', '71102046', '71102047', '71102048', '71102049'], // Cabeçal 1 — idêntico ao Cabeçal 2
  '50302': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71101009', '71101010', '71101011', '71101022', '71102001', '71102003', '71102004', '71102005', '71102007', '71102008', '71102009', '71102011', '71102012', '71102014', '71102015', '71102018', '71102019', '71102022', '71102024', '71102033', '71102034', '71102036', '71102037', '71102045', '71102046', '71102047', '71102048', '71102049'], // Cabeçal 2
  '50303': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71101009', '71101010', '71101011', '71101022', '71102003', '71102004', '71102005', '71102007', '71102008', '71102009', '71102011', '71102012', '71102014', '71102015', '71102018', '71102019', '71102022', '71102024', '71102033', '71102034', '71102036', '71102037', '71102045', '71102046', '71102047', '71102048', '71102049'], // Cabeçal 3
  '50402': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71101009', '71101011', '71101022', '71102003', '71102004', '71102005', '71102007', '71102008', '71102009', '71102012', '71102016', '71102018', '71102019', '71102022', '71102024', '71102032', '71102033', '71102034', '71102036', '71102037', '71102045', '71103001'], // Adm Fazenda
  '50403': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71101009', '71101011', '71102001', '71102003', '71102004', '71102005', '71102007', '71102008', '71102012', '71102018', '71102022', '71102024', '71102033', '71102034', '71102036', '71102043', '71102045', '71102046', '71102049'], // Irrigação
  '50404': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71102004', '71102014', '71102015', '71102018', '71102019', '71102022', '71102024', '71102037', '71102047', '71102048'], // Bloco Teste Uva
  '50405': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71102004', '71102014', '71102015', '71102018', '71102019', '71102022', '71102024', '71102037', '71102047', '71102048'], // Bloco Teste Mirtilo
  '50501': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71102008', '71102037', '71105002'], // Certificações
  '50502': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71101011', '71101015', '71102001', '71102003', '71102004', '71102007', '71102008', '71102009', '71102012', '71102018', '71102019', '71102022', '71102024', '71102026', '71102032', '71102033', '71102034', '71102036', '71102040', '71102045', '71102046', '71102049', '71102050', '71102090', '71103099'], // Adm PH
  '50503': ['71101001', '71101002', '71101003', '71101004', '71101005', '71101006', '71101007', '71101008', '71101010', '71102008'], // Operações PH
  '50504': ['71102013'], // Embalagem
  '50505': ['34101001', '34101003', '34101004', '34101005', '34101006', '34101014', '34101015', '34104009', '34104031', '34202010', '34202011', '34202015', '34202036', '71102038', '71102039'], // Logística
  '50506': ['71101001', '71101002', '71101004', '71101005', '71101006', '71101007'], // Câmara Fria
  '50601': ['34102001', '34104003', '34202034', '71102042'], // Vendas
  '50602': ['34103001', '34202010'], // Marketing
  '50605': ['34202006', '34202010', '34202036', '71102009', '71102026', '71102038', '71102039', '71103001'], // Logística (Comercial)
  '50606': ['71101001', '71101002', '71101004', '71101005', '71101006', '71101007', '71102008'], // Câmara Fria (Comercial)
  '50710': ['34201001', '34201003', '34201004', '34201005', '34201006', '34201010', '34201012', '34202006', '34202018', '34202031', '34202035'], // Suprimentos
  '50711': ['34202035'], // Gente e Gestão
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
  { id: 'pessoal', nome: "Pessoal", ref: 'Base_Corporativo.xlsx (3 contas)' },
  { id: 'servicos', nome: "Serviços de Terceiros", ref: 'Base_Corporativo.xlsx (3 contas)' },
  { id: 'locacao_utilidades', nome: "Locação, Ocupação e Utilidades", ref: 'Base_Corporativo.xlsx (4 contas)' },
  { id: 'administrativo', nome: "Administrativo", ref: 'Base_Corporativo.xlsx (6 contas)' },
  { id: 'manutencao', nome: "Manutenção", ref: 'Base_Corporativo.xlsx (1 conta)' },
  { id: 'comercial', nome: "Comercial e Marketing", ref: 'Base_Corporativo.xlsx (1 conta)' },
  { id: 'viagens', nome: "Viagens", ref: 'Base_Corporativo.xlsx (2 contas)' },
  { id: 'impostos', nome: "Impostos Indiretos e Diretos", ref: 'Base_Corporativo.xlsx (1 conta)' },
];

export const PLANO_CONTAS_CORPORATIVO = {
  // Consultorias PJs (2026-08-23, pedido: "desconsidere essa conta
  // analítica do pacote de Serviços de Terceiros e inclua no pacote
  // Pessoal como uma nova linha analítica adicional a linha de CLT")
  // — CORP03 sai de 'servicos' e vira a 2ª conta analítica editável de
  // Pessoal, só no Corporativo (ver AbaCustos/CustosLeituraVersao, gate
  // por UNIDADES_COM_PJ_PESSOAL/CONTA_CONSULTORIA_PJ). CORP01/CORP13
  // continuam aqui só como referência do plano de contas — nunca viram
  // LinhaConta editável (a folha CLT é sempre calculada via
  // QuadroPessoal/funcionários, nunca lançada direto numa conta).
  pessoal: [
    { codigo: 'CORP01', nome: "Salários /Despesas com o pessoal", origem: 'Despesa' },
    { codigo: 'CORP13', nome: "Cursos e treinamentos", origem: 'Despesa' },
    { codigo: 'CORP03', nome: "Consultórias PJs", origem: 'Despesa' },
  ],
  servicos: [
    { codigo: 'CORP02', nome: "Assessorias e Consultorias", origem: 'Despesa' },
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

// ---------------------------------------------------------------------------
// CCs reais da ARA Resorts (Centros de Custos - ARA Resorts 1.xlsx,
// fornecida em 2026-08-20) — 12 áreas (nivel:2, sintético/consolidador) e
// seus CCs analíticos (nivel:3, areaCodigo aponta pro código da área-mãe).
// Coluna "Status" da planilha: S = sintético, A = analítico. Coluna
// "Unidade" virou `resorts: ['beach'|'villa']` — a maioria dos CCs existe
// nos dois resorts (Samoa Beach e Samoa Villa), mas "AT Ampliação Beach"
// (94) só existe no Beach, "Villa Muro Alto" (95) e "AT Ampliação Villa"
// (96) só na Villa — ver samoa_beach/samoa_villa em REFERENCIA_POR_UNIDADE
// (cada uma filtra CCS_RESORTS pelo próprio resort).
// tipo: 'producao' pras áreas que geram o CPV do hotel (Hospedagem, A&B,
// Villa Muro Alto — que é outra operação de hospedagem); 'despesa' pras
// demais (Administração, Serviços, Comercial, Manutenção, Ampliação/obras,
// Condomínio, Bloco 3) — classificação interpretada por mim a partir do
// nome de cada área, a planilha-fonte não trazia essa coluna.
// Sem De/Para de conta analítica × CC pro Resorts ainda (diferente da
// Agrícola, que tinha a Camadas.xlsx pra 5 CCs) — decisão de 2026-08-20:
// todo CC analítico recebe o plano de contas completo (PLANO_CONTAS_RESORTS,
// sem alteração), mesmo critério já usado no Corporativo.
export const CCS_RESORTS = [
  { codigo: '00', nome: 'Diretoria', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '0002', nome: 'Conselho', tipo: 'despesa', nivel: 3, areaCodigo: '00', resorts: ['beach', 'villa'] },

  { codigo: '01', nome: 'Hospedagem', tipo: 'producao', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '0101', nome: 'Apartamentos', tipo: 'producao', nivel: 3, areaCodigo: '01', resorts: ['beach', 'villa'] },
  { codigo: '0102', nome: 'Recepção', tipo: 'producao', nivel: 3, areaCodigo: '01', resorts: ['beach', 'villa'] },
  { codigo: '0103', nome: 'Reservas', tipo: 'producao', nivel: 3, areaCodigo: '01', resorts: ['beach', 'villa'] },
  { codigo: '0105', nome: 'Esporte e Lazer', tipo: 'producao', nivel: 3, areaCodigo: '01', resorts: ['beach', 'villa'] },
  { codigo: '0106', nome: 'Governança', tipo: 'producao', nivel: 3, areaCodigo: '01', resorts: ['beach', 'villa'] },
  { codigo: '0107', nome: 'Experiências', tipo: 'producao', nivel: 3, areaCodigo: '01', resorts: ['beach', 'villa'] },

  { codigo: '02', nome: 'Alimentos e Bebidas', tipo: 'producao', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '0201', nome: 'Restaurante', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0202', nome: 'Room Service', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0203', nome: 'Cozinha', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0204', nome: 'Frigobar', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0205', nome: 'Café da Manhã', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0206', nome: 'Refeitório', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0207', nome: 'Bar Piscina', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0208', nome: 'Bar Praia', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0209', nome: 'Eventos A&B', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0210', nome: 'Produção de Alimentos', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0212', nome: 'Padaria', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0213', nome: 'Confeitaria', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0214', nome: 'Deck Praia', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0215', nome: 'Praia Polinésia', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0216', nome: 'Piscina Polinésia', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['beach', 'villa'] },
  { codigo: '0217', nome: 'Lobby Bar', tipo: 'producao', nivel: 3, areaCodigo: '02', resorts: ['villa'] },

  { codigo: '03', nome: 'Administração', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '0301', nome: 'Diretoria', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },
  { codigo: '0302', nome: 'Apoio Administrativo', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },
  { codigo: '0303', nome: 'Almoxarifado', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },
  { codigo: '0304', nome: 'RH/Departamento Pessoal', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },
  { codigo: '0306', nome: 'Financeiro', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },
  { codigo: '0307', nome: 'Compras', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },
  { codigo: '0308', nome: 'Tecnologia da Informação', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },
  { codigo: '0310', nome: 'Portaria/Segurança', tipo: 'despesa', nivel: 3, areaCodigo: '03', resorts: ['beach', 'villa'] },

  { codigo: '04', nome: 'Serviços', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '0402', nome: 'Lavanderia', tipo: 'despesa', nivel: 3, areaCodigo: '04', resorts: ['beach', 'villa'] },

  { codigo: '05', nome: 'Comercial', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '0502', nome: 'Propaganda e Marketing', tipo: 'despesa', nivel: 3, areaCodigo: '05', resorts: ['beach', 'villa'] },

  { codigo: '06', nome: 'Manutenção', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '0601', nome: 'Manutenção Predial Adm', tipo: 'despesa', nivel: 3, areaCodigo: '06', resorts: ['beach', 'villa'] },
  { codigo: '0602', nome: 'Obras e Reformas', tipo: 'despesa', nivel: 3, areaCodigo: '06', resorts: ['beach', 'villa'] },

  { codigo: '94', nome: 'AT Ampliação Beach', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach'] },
  { codigo: '9401', nome: 'Ampliação Construção', tipo: 'despesa', nivel: 3, areaCodigo: '94', resorts: ['beach'] },
  { codigo: '9402', nome: 'Ampliação Montagem', tipo: 'despesa', nivel: 3, areaCodigo: '94', resorts: ['beach'] },

  { codigo: '95', nome: 'Villa Muro Alto', tipo: 'producao', nivel: 2, areaCodigo: null, resorts: ['villa'] },
  { codigo: '9501', nome: 'Operação Villa Muro Alto', tipo: 'producao', nivel: 3, areaCodigo: '95', resorts: ['villa'] },

  { codigo: '96', nome: 'AT Ampliação Villa', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['villa'] },
  { codigo: '9601', nome: 'Ampliação Construção', tipo: 'despesa', nivel: 3, areaCodigo: '96', resorts: ['villa'] },
  { codigo: '9602', nome: 'Ampliação Montagem', tipo: 'despesa', nivel: 3, areaCodigo: '96', resorts: ['villa'] },

  { codigo: '97', nome: 'Condomínio Polinésia', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '9701', nome: 'Condomínio Polinésia', tipo: 'despesa', nivel: 3, areaCodigo: '97', resorts: ['beach', 'villa'] },
  { codigo: '9702', nome: 'La Fleur Collection', tipo: 'despesa', nivel: 3, areaCodigo: '97', resorts: ['beach', 'villa'] },

  { codigo: '99', nome: 'Bloco 3', tipo: 'despesa', nivel: 2, areaCodigo: null, resorts: ['beach', 'villa'] },
  { codigo: '9901', nome: 'Bloco 3', tipo: 'despesa', nivel: 3, areaCodigo: '99', resorts: ['beach', 'villa'] },
];

// Decisão de 2026-08-09: Agrícola e Resorts habilitadas com lançamento
// completo, usando 8 CCs genéricos como PLACEHOLDER (CCS_PLACEHOLDER_
// AGRICOLA_RESORTS, ver definição acima) — a matriz de governança não traz
// CC oficial pra essas duas ainda. Trocar por uma lista própria de cada
// unidade quando a planilha real chegar. Até 2026-08-19 esse placeholder
// era uma referência direta a CCS_TEXTIL (editar uma mudava as duas); agora
// é um array separado, já que CCS_TEXTIL virou o CC real (nível de
// subárea) da própria Têxtil.
const REFERENCIA_POR_UNIDADE = {
  textil: { ccs: CCS_TEXTIL, planoContas: PLANO_CONTAS, todasContas: TODAS_CONTAS, pacotes: PACOTES_TEXTIL },
  // Agrícola ganhou CC real em 2026-08-20 (Plano Centro de Custo.xlsx) — as
  // duas fazendas (agricola_tds/agricola_fds, unidades próprias, cada uma
  // com orçamento editável) usam a mesma estrutura de CC e plano de contas.
  // 'agricola' (sem sufixo) é o Consolidado: não é editado diretamente (ver
  // ConsolidadoAgricola), mas usa a mesma referência pra ler/exibir.
  agricola: { ccs: CCS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, pacotes: PACOTES_AGRICOLA },
  agricola_tds: { ccs: CCS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, pacotes: PACOTES_AGRICOLA },
  agricola_fds: { ccs: CCS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, pacotes: PACOTES_AGRICOLA },
  // Resorts ganhou CC real em 2026-08-20 (Centros de Custos - ARA Resorts
  // 1.xlsx) — mesmo padrão da Agrícola: Samoa Beach e Samoa Villa são as
  // unidades editáveis (cada uma só com os CCs que existem naquele resort —
  // ver `resorts` em CCS_RESORTS), 'resorts' é o Consolidado (soma das
  // duas, nunca editado direto — ver ConsolidadoResorts).
  resorts: { ccs: CCS_RESORTS, planoContas: PLANO_CONTAS_RESORTS, todasContas: TODAS_CONTAS_RESORTS, pacotes: PACOTES_RESORTS },
  samoa_beach: { ccs: CCS_RESORTS.filter(cc => cc.resorts.includes('beach')), planoContas: PLANO_CONTAS_RESORTS, todasContas: TODAS_CONTAS_RESORTS, pacotes: PACOTES_RESORTS },
  samoa_villa: { ccs: CCS_RESORTS.filter(cc => cc.resorts.includes('villa')), planoContas: PLANO_CONTAS_RESORTS, todasContas: TODAS_CONTAS_RESORTS, pacotes: PACOTES_RESORTS },
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
// O tipo de premissa de cada linha de receita.linhas (Resorts) é fixo pela
// definição acima — não existe seletor de premissaTipo nesta tela, diferente
// de Custos (AbaReceitaResorts não usa <Selecao>). Documentos criados antes
// da linha existir, ou reidratados a partir de novaLinhaVazia(), carregam
// premissaTipo:'direto' por padrão (bug encontrado em 2026-08-30: Hospedagem/
// A&B/Café e Pensão somavam R$0,00 mesmo com quantidade/valor unitário
// preenchidos, porque valorLinhaMes caía no branch 'direto' e lia
// `linha.valores`, que essas 3 linhas nunca preenchem). Nunca confiar no
// premissaTipo armazenado pra essas linhas — sempre normalizar com esta
// função antes de calcular. Espelho exato de backend/src/calc/receitaAgricolaResorts.js.
function tipoLinhaReceitaResorts(id) {
  return LINHAS_RECEITA_RESORTS.find(d => d.id === id)?.tipo;
}
// Café e Pensão NÃO soma na Receita Operacional Bruta (conferido célula a
// célula em Premissa Resorts.xlsx, aba "1.1 DRE"): a linha 42 "Receita
// Operacional Bruta" é a soma de Hospedagem(43) + A&B(44) + Moorea(45) +
// Outras Receitas(46) — e a fórmula da linha 44 ("1.2 Receita Total com
// A&B" dentro da ROB) puxa só a célula de Alimentação e Bebidas (=G25),
// não a soma de A&B com Café e Pensão que aparece no subtotal informativo
// da linha 23. Café e Pensão já está embutido na Tarifa Média da
// Hospedagem — é por isso que a planilha tem uma linha só informativa,
// "Receita com Hospedagem sem Pensão" = Hospedagem − Café e Pensão (linha
// 21), que só faz sentido se a Hospedagem contabilizada alhures já a
// inclui. Somar Café e Pensão de novo na ROB duplicaria essa receita.
const LINHA_RECEITA_INFORMATIVA_RESORTS = 'cafePensao';
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

// reajuste_inflacao (2026-08-20, todas as unidades): o gestor digita o
// valor-base mensal (sem reajuste, mesmo campo `valores` do tipo 'direto')
// — o valor projetado é calculado automaticamente aplicando o IPCA anual
// do FP&A (premissas macro), composto mês a mês a partir de Janeiro
// (IPCA mensal = (1+IPCA anual)^(1/12)-1). Sem IPCA preenchido, o valor
// projetado = valor-base (reajuste de 0%), nunca quebra o cálculo.
// custo_por_kg (2026-08-20, só Têxtil e Agrícola — únicas com Volume em
// toneladas na Receita, ver PRODUTOS_REF/PRODUTOS_REF_AGRICOLA): o gestor
// digita R$/kg (mesmo campo `valoresUnit` do tipo 'qtd_valor') — a
// "quantidade" não é digitada, vem do Volume total da Receita (toneladas
// × 1000 = kg). Ver TODAS_CONTAS_AGRICOLA/computeDRE/AbaCustos.
const TIPOS_PREMISSA = [
  { id: 'direto', nome: 'Valor direto' },
  { id: 'qtd_valor', nome: 'Quantidade × Valor unit.' },
  { id: 'rateio', nome: 'Base × %' },
  { id: 'reajuste_inflacao', nome: 'Reajuste Inflação (IPCA)' },
  { id: 'custo_por_kg', nome: 'Custo/Despesa por kg' },
];
// Unidades onde "Custo/Despesa por kg" aparece nas opções — só onde a
// Receita tem Volume em toneladas por produto (Têxtil/Agrícola usam o
// modelo `produtos`; Resorts/Corporativo não têm essa noção de volume).
const UNIDADES_COM_CUSTO_POR_KG = ['textil', 'agricola_tds', 'agricola_fds'];
// Unidades onde a pergunta "competência × caixa" aparece em toda conta
// analítica (pedido de 2026-08-23: "precisamos ter a visão de DRE e FC" do
// Corporativo). Só Corporativo por enquanto — é a única unidade 100%
// back-office (sem CPV/produção, sem Kgiro próprio de cliente), onde o
// descasamento entre o mês do fato gerador (competência, usado na DRE) e o
// mês do pagamento de fato (caixa, usado no FC) é a regra, não a exceção
// (ex.: nota fiscal de consultoria emitida em dezembro, paga em janeiro).
// Mesmo racional do ajuste do 13º salário (ver ajuste13Mes em
// computeFluxoIndiretoMensal), generalizado aqui pra qualquer conta.
const UNIDADES_COM_COMPETENCIA_CAIXA = ['corporativo'];
// Consultoria PJ como conta analítica de Pessoal (2026-08-23, revisão do
// pedido original de 2026-08-23: "não é para incluir no quadro de folha,
// desconsidere essa conta analítica do pacote de Serviços de Terceiros e
// inclua no pacote Pessoal como uma nova linha analítica adicional a
// linha de CLT [...] apenas para o Corporativo") — CORP03 "Consultórias
// PJs" (ver PLANO_CONTAS_CORPORATIVO, pacote 'pessoal') passa a ser uma
// LinhaConta normal (premissa/grade mensal como qualquer outra conta),
// exibida ao lado da folha CLT calculada — não mais uma linha na tabela
// de funcionários. Só o Corporativo tem essa conta no plano de contas.
const UNIDADES_COM_PJ_PESSOAL = ['corporativo'];
const CONTA_CONSULTORIA_PJ = 'CORP03';
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

// Uma SUBLINHA dentro de uma conta analítica (2026-08-23, ver
// normalizarConta/novaContaVazia logo abaixo — "se o gestor quiser incluir
// mais de uma linha dentro de cada despesa, ex.: por fornecedor"). `id`
// identifica a sublinha dentro do array `sublinhas` da conta (pra
// update/remove mirarem a certa); `descricao` é o rótulo livre que o
// gestor usa pra diferenciar ("Fornecedor A", "Contrato X"...), opcional.
function novaLinhaVazia() {
  return {
    id: uid(),
    descricao: '',
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
    // Competência × caixa (2026-08-23, ver UNIDADES_COM_COMPETENCIA_CAIXA):
    // por padrão o fato gerador e o pagamento ocorrem no mesmo mês
    // (pagamentoDiferente false — comportamento de sempre, DRE e FC usam o
    // mesmo valor de valorLinhaMes). Quando o gestor marca que não, o FC usa
    // valoresPagamento (mês a mês, digitado à parte) em vez do valor de
    // competência — a DRE nunca muda, só a leitura de caixa no FC.
    pagamentoDiferente: false,
    valoresPagamento: mesesVazios(),
    // Reajuste Inflação — único × mensal (2026-08-23): 'mensal' (padrão,
    // comportamento de sempre) composta o IPCA mês a mês desde Janeiro.
    // 'unico' aplica o IPCA anual inteiro de uma vez só a partir do mês
    // escolhido (reajusteInflacaoMes) — antes dele, sem reajuste nenhum.
    reajusteInflacaoTipo: 'mensal',
    reajusteInflacaoMes: '',
  };
}

// Múltiplas linhas por conta analítica (2026-08-23, "se o gestor quiser
// incluir mais de uma linha dentro de cada despesa, ex.: por fornecedor —
// avalie e ajuste para todas as empresas"): custos.linhas['CC|Conta'] passa
// a ser uma CONTA — { classificacao, sublinhas: [linha, ...] } — em vez de
// uma linha só. Compatibilidade com dados já salvos (formato antigo, uma
// linha plana sem `.sublinhas`): normalizarConta trata o objeto inteiro
// como a única sublinha, sem precisar de migração de banco nenhuma — id
// 'legacy' fixo porque só existe uma por conta nesse caso (nunca colide).
// valorLinhaMes/valorLinhaAnual (abaixo) chamam isto por dentro, então TODO
// o resto do código (computeDRE, runAuditoria, exportarExcel, etc.) continua
// passando `linhas[chave]` do jeito que sempre passou, sem precisar saber
// que agora pode ter mais de uma linha — só quem edita/lê a UI precisa.
function normalizarConta(contaRaw) {
  if (!contaRaw) return { classificacao: 'fixo', sublinhas: [novaLinhaVazia()] };
  if (Array.isArray(contaRaw.sublinhas)) return contaRaw;
  return { classificacao: contaRaw.classificacao || 'fixo', sublinhas: [{ ...contaRaw, id: contaRaw.id || 'legacy' }] };
}
function novaContaVazia() {
  return { classificacao: 'fixo', sublinhas: [novaLinhaVazia()] };
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

// IPCA mensal composto a partir de um IPCA anual (%) — usado só pelo tipo
// de premissa 'reajuste_inflacao'. (1+ipcaAnual/100)^(1/12) - 1.
function ipcaMensalDe(ipcaAnualPct) {
  const anual = parseNum(ipcaAnualPct);
  if (!anual) return 0;
  return Math.pow(1 + anual / 100, 1 / 12) - 1;
}

// Valor de UMA SUBLINHA em um mês, de acordo com o tipo de premissa dela —
// a lógica "de verdade" de cada tipo de premissa mora aqui. Uma conta
// analítica pode ter mais de uma sublinha (2026-08-23, ver
// normalizarConta/novaContaVazia); valorLinhaMes/valorLinhaAnual (abaixo)
// somam todas as sublinhas de uma conta — é isso que o resto do código
// chama, nunca esta função diretamente.
// receitaBrutaMes/receitaLiquidaMes são arrays de 12 posições, vindos do computeDRE.
// ipcaAnualPct (2026-08-20, tipo 'reajuste_inflacao') e volumeTotalKgMes
// (tipo 'custo_por_kg') são opcionais — quando quem chama não os informa
// (telas secundárias que ainda não foram atualizadas: exportações,
// comparação de versões), o cálculo degrada sem quebrar: reajuste_inflacao
// cai pro valor-base sem reajuste (equivalente a IPCA 0%) e custo_por_kg
// cai pra zero (sem volume, não tem como multiplicar).
function valorSublinhaMes(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes) {
  if (!sublinha) return 0;
  if (sublinha.premissaTipo === 'qtd_valor') {
    return parseNum(sublinha.quantidades?.[m]) * parseNum(sublinha.valoresUnit?.[m]);
  }
  if (sublinha.premissaTipo === 'rateio') {
    const pct = parseNum(sublinha.percentuais?.[m]) / 100;
    let base = 0;
    if (sublinha.baseTipo === 'receita_bruta') base = receitaBrutaMes?.[m] || 0;
    else if (sublinha.baseTipo === 'receita_liquida') base = receitaLiquidaMes?.[m] || 0;
    else base = parseNum(sublinha.baseManual?.[m]);
    return base * pct;
  }
  if (sublinha.premissaTipo === 'reajuste_inflacao') {
    const base = parseNum(sublinha.valores?.[m]);
    // Único (2026-08-23): o IPCA anual inteiro entra de uma vez só a partir
    // do mês escolhido (reajusteInflacaoMes) — sem composição mensal. Sem
    // mês escolhido, cai no mesmo degrade de sempre (sem reajuste).
    if (sublinha.reajusteInflacaoTipo === 'unico') {
      const idxReajuste = sublinha.reajusteInflacaoMes ? MESES.indexOf(sublinha.reajusteInflacaoMes) : -1;
      const fatorUnico = (idxReajuste >= 0 && m >= idxReajuste) ? (1 + parseNum(ipcaAnualPct) / 100) : 1;
      return base * fatorUnico;
    }
    const fatorAcumulado = Math.pow(1 + ipcaMensalDe(ipcaAnualPct), m + 1);
    return base * fatorAcumulado;
  }
  if (sublinha.premissaTipo === 'custo_por_kg') {
    const kg = parseNum(volumeTotalKgMes?.[m]);
    return kg * parseNum(sublinha.valoresUnit?.[m]);
  }
  return parseNum(sublinha.valores?.[m]);
}
// Valor de uma CONTA analítica (chave CC|Conta) em um mês — soma o valor de
// todas as sublinhas dela (normalmente só 1). Aceita tanto o formato novo
// ({classificacao, sublinhas}) quanto dado já salvo no formato antigo (uma
// linha só, sem `.sublinhas`) via normalizarConta — é por isso que todo o
// resto do código (computeDRE, runAuditoria, exportarExcel...) continua
// chamando esta função exatamente como sempre chamou, sem precisar saber
// que agora pode ter mais de uma linha por trás.
function valorLinhaMes(contaRaw, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes) {
  if (!contaRaw) return 0;
  const conta = normalizarConta(contaRaw);
  return conta.sublinhas.reduce((acc, sub) => acc + valorSublinhaMes(sub, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes), 0);
}
function valorLinhaAnual(contaRaw, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes) {
  return MESES.reduce((acc, _, m) => acc + valorLinhaMes(contaRaw, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes), 0);
}
// Valor de CAIXA (pagamento) de uma sublinha num mês — usado só pelo Fluxo
// de Caixa (Indireto e Direto), nunca pela DRE (que continua 100% em
// competência, sem mudança nenhuma). Pedido de 2026-08-23 ("o fato gerador
// [competência] ocorre no mesmo mês do pagamento?"): por padrão (linha
// .pagamentoDiferente false) o caixa é igual à competência — mesmo
// valorSublinhaMes de sempre. Quando o gestor marca que não, usa o valor
// digitado à parte em linha.valoresPagamento (mês a mês, independente do
// valor de competência — o total pago no ano pode até ser diferente do
// total incorrido, ex.: parte fica a pagar em janeiro do ano seguinte).
function valorSublinhaMesCaixa(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes) {
  if (!sublinha) return 0;
  if (sublinha.pagamentoDiferente) return parseNum(sublinha.valoresPagamento?.[m]);
  return valorSublinhaMes(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes);
}
// Idem valorLinhaMes acima, mas em caixa — soma valorSublinhaMesCaixa de
// todas as sublinhas da conta.
function valorLinhaMesCaixa(contaRaw, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes) {
  if (!contaRaw) return 0;
  const conta = normalizarConta(contaRaw);
  return conta.sublinhas.reduce((acc, sub) => acc + valorSublinhaMesCaixa(sub, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes), 0);
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
    : linha.premissaTipo === 'custo_por_kg' ? [linha.valoresUnit]
    : [linha.valores]; // 'direto' e 'reajuste_inflacao' usam `valores` (base, no caso do reajuste)
  return campos.some(arr => (arr || []).some(v => parseNum(v) < 0));
}
// Versões conta-inteira (2026-08-23, ver normalizarConta) de
// linhaIncoerente/linhaTemNegativo — "verdadeiro se QUALQUER sublinha
// tiver o problema". runAuditoria e LinhaConta chamam estas, nunca as de
// sublinha diretamente (que continuam existindo pra checar uma sublinha só).
function contaIncoerente(contaRaw) {
  return normalizarConta(contaRaw).sublinhas.some(sub => linhaIncoerente(sub));
}
function contaTemNegativo(contaRaw) {
  return normalizarConta(contaRaw).sublinhas.some(sub => linhaTemNegativo(sub));
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
  if (unidadeId === 'agricola' || unidadeId === 'agricola_tds' || unidadeId === 'agricola_fds') {
    return {
      // Mercado Interno × Mercado Externo (2026-08-23, pedido: reconstruir o
      // racional da aba "PREVISÃO DE RECEITA AJUSTADA" — separar MI/ME e,
      // no ME, aplicar o câmbio da premissa do FP&A Corporativo como parte
      // do cálculo). Todo produto nasce 'interno' (Volume × Preço em R$,
      // como sempre foi); o gestor alterna pra 'externo' quando o produto é
      // vendido em moeda estrangeira — aí o Preço passa a ser digitado na
      // moeda (USD/EUR/GBP) e o câmbio (mesmo valor o ano inteiro, vindo da
      // premissa macro) entra automaticamente no cálculo — ver
      // receitaBrutaPorMes/AbaReceita. "Vendas Externas" (PRODUTOS_REF_
      // AGRICOLA) já nasce em USD/externo, mantendo o comportamento actual.
      produtos: PRODUTOS_REF_AGRICOLA.map(p => ({
        id: uid(), nome: p.nome, volumes: mesesVazios(), precos: mesesVazios(),
        mercado: p.nome === 'Vendas Externas' ? 'externo' : 'interno',
        moeda: 'usd', precoMoeda: mesesVazios(),
      })),
      deducoes: DEDUCOES_REF_AGRICOLA.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios(), baseLinhaIds: d.baseLinhaIds })),
    };
  }
  if (unidadeId === 'resorts' || unidadeId === 'samoa_beach' || unidadeId === 'samoa_villa') {
    const linhas = {};
    // premissaTipo já nasce correto por linha (ver tipoLinhaReceitaResorts) —
    // não é escolha do usuário, é fixo pela definição. Cálculo (computeDRE/
    // runAuditoria) normaliza de novo por segurança, mas documento novo já
    // sai certo.
    LINHAS_RECEITA_RESORTS.forEach((l) => { linhas[l.id] = { ...novaLinhaVazia(), premissaTipo: l.tipo }; });
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
      // meritocraciaPct (2026-08-23): % sobre o total de salários, mesmo
      // racional dos demais percentuais desta premissa. dissidioMes/
      // dissidioPct (2026-08-23): a partir do mês escolhido, o salário de
      // todo mundo na unidade sobe por esse % — ver computeFolhaPessoalMes.
      premissasPessoal: {
        inssPct: '', fgtsPct: '', feriasPct: '', decimoTerceiroPct: '', meritocraciaPct: '',
        valeTransporteValor: '', cestaBasicaValor: '', planoSaudeValor: '', outrosBeneficiosValor: '',
        dissidioMes: '', dissidioPct: '',
      },
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
//
// Meritocracia (2026-08-23): % sobre o total de salários CLT do mês,
// mesmo racional dos demais percentuais (INSS/FGTS/Férias/13º).
//
// Dissídio (2026-08-23): mês + % de reajuste, padronizados pra unidade
// inteira. A partir do mês escolhido (inclusive), o salário de cada
// funcionário sobe por esse % — INSS/FGTS/Férias/13º/meritocracia (todos %
// sobre `salarios`) já refletem o valor reajustado automaticamente, sem
// precisar de lógica própria.
//
// Consultoria PJ (revisado em 2026-08-23, ver CONTA_CONSULTORIA_PJ/
// UNIDADES_COM_PJ_PESSOAL — só Corporativo): NÃO entra mais nesta função —
// desde 2026-08-23 é uma conta analítica normal do pacote Pessoal (CORP03
// "Consultórias PJs"), somada como qualquer outra conta em custos.linhas
// (ver computeDRE), não mais uma linha na tabela de funcionários.
// ---------------------------------------------------------------------------
function computeFolhaPessoalMes(funcionariosCC, premissas, mIdx) {
  const ativos = (funcionariosCC || []).filter(f => {
    if (!f.mesAdmissao) return true;
    const idxAdm = MESES.indexOf(f.mesAdmissao);
    return idxAdm === -1 || idxAdm <= mIdx;
  });

  const idxDissidio = premissas?.dissidioMes ? MESES.indexOf(premissas.dissidioMes) : -1;
  const fatorDissidio = (idxDissidio >= 0 && mIdx >= idxDissidio) ? (1 + parseNum(premissas?.dissidioPct) / 100) : 1;
  const salarios = ativos.reduce((acc, f) => acc + parseNum(f.salario) * fatorDissidio, 0);
  const inss = salarios * (parseNum(premissas?.inssPct) / 100);
  const fgts = salarios * (parseNum(premissas?.fgtsPct) / 100);
  const ferias = salarios * (parseNum(premissas?.feriasPct) / 100);
  const decimoTerceiro = salarios * (parseNum(premissas?.decimoTerceiroPct) / 100);
  const meritocracia = salarios * (parseNum(premissas?.meritocraciaPct) / 100);
  const beneficiosPorFuncionario = parseNum(premissas?.valeTransporteValor) + parseNum(premissas?.cestaBasicaValor) + parseNum(premissas?.planoSaudeValor) + parseNum(premissas?.outrosBeneficiosValor);
  const beneficios = ativos.length * beneficiosPorFuncionario;
  const encargos = inss + fgts + ferias;
  const total = salarios + encargos + decimoTerceiro + meritocracia + beneficios;
  return { qtdFuncionarios: ativos.length, salarios, inss, fgts, ferias, encargos, decimoTerceiro, meritocracia, beneficios, total };
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
// cambios ({ usd, eur, gbp }, 2026-08-23) — câmbio estático (mesmo valor o
// ano inteiro) da premissa macro do FP&A Corporativo, usado só por produtos
// de Mercado Externo (mercado==='externo') do modelo `produtos` (Agrícola —
// ver receitaVazia). Sem premissa preenchida, degrada pra câmbio 0 (receita
// ME sai zerada até o FP&A preencher), nunca quebra — mesmo racional do
// ipcaAnualPct em valorLinhaMes.
function receitaBrutaPorMes(data, cambios) {
  if (data.receita.linhas) {
    const linhasMes = {};
    Object.entries(data.receita.linhas).forEach(([id, linha]) => {
      // Bug de 2026-08-30: nunca confiar no premissaTipo armazenado nessas
      // linhas — ver nota em tipoLinhaReceitaResorts.
      const linhaTipada = { ...linha, premissaTipo: tipoLinhaReceitaResorts(id) || linha.premissaTipo };
      linhasMes[id] = MESES.map((_, m) => valorLinhaMes(linhaTipada, m, null, null));
    });
    // Café e Pensão não soma na ROB — ver LINHA_RECEITA_INFORMATIVA_RESORTS.
    // Continua em linhasMes (ex.: pra exibir ou usar como base de dedução,
    // se algum dia alguma passar a referenciá-la).
    const totalMes = MESES.map((_, m) =>
      Object.entries(linhasMes).reduce((acc, [id, arr]) => id === LINHA_RECEITA_INFORMATIVA_RESORTS ? acc : acc + arr[m], 0)
    );
    return { receitaBrutaMes: totalMes, linhasReceitaMes: linhasMes };
  }
  const totalMes = MESES.map((_, m) =>
    (data.receita.produtos || []).reduce((acc, p) => {
      if (p.mercado === 'externo') {
        const taxa = parseNum(cambios?.[p.moeda || 'usd']);
        return acc + parseNum(p.volumes?.[m]) * parseNum(p.precoMoeda?.[m]) * taxa;
      }
      return acc + parseNum(p.volumes?.[m]) * parseNum(p.precos?.[m]);
    }, 0)
  );
  return { receitaBrutaMes: totalMes, linhasReceitaMes: null };
}

function computeDRE(data, ref, ipcaAnualPct, cambios) {
  // Receita bruta por mês, para aplicar deduções percentuais mês a mês
  const { receitaBrutaMes, linhasReceitaMes } = receitaBrutaPorMes(data, cambios);
  const receitaBruta = receitaBrutaMes.reduce((a, v) => a + v, 0);

  // Volume total (kg) por mês — só pra contas com premissaTipo
  // 'custo_por_kg' (2026-08-20). Só o modelo `produtos` (Têxtil/Agrícola)
  // tem Volume; unidades com `receita.linhas` (Resorts) ou sem receita
  // (Corporativo) caem em [] e o reduce dá 0 — nunca quebra, essas
  // unidades nem oferecem 'custo_por_kg' como opção (ver
  // UNIDADES_COM_CUSTO_POR_KG). Volume vem em toneladas — ×1000 pra kg.
  const volumeTotalKgMes = MESES.map((_, m) =>
    (data.receita.produtos || []).reduce((acc, p) => acc + parseNum(p.volumes?.[m]), 0) * 1000
  );

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

  // pacote 'pessoal' (2026-08-23): não exclui mais da soma — desde que
  // CORP03 "Consultórias PJs" virou LinhaConta normal do pacote Pessoal
  // (só Corporativo, ver CONTA_CONSULTORIA_PJ), a pacote pode ter
  // lançamento de verdade em custos.linhas além da folha. Nas demais
  // unidades, o pacote 'pessoal' nunca tem conta editável (só referência
  // — ver AbaCustos), então soma sempre 0 ali, sem risco de duplicar a
  // folha calculada.
  const cpv = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    if (!cc || cc.tipo !== 'producao') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes);
  }, 0) + ref.ccs.filter(cc => cc.tipo === 'producao').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).totalAnual, 0);
  const lucroBruto = receitaLiquida - cpv;
  const margemBruta = receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0;

  const despesasSemDA = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || cc.tipo !== 'despesa' || pacoteId === 'depreciacao') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes);
  }, 0) + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).totalAnual, 0);
  const ebitda = lucroBruto - despesasSemDA;
  const margemEbitda = receitaLiquida ? (ebitda / receitaLiquida) * 100 : 0;

  const depreciacao = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || cc.tipo !== 'despesa' || pacoteId !== 'depreciacao') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes);
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
    // Exposto pra quem precisa recalcular valorLinhaMes/valorLinhaAnual de
    // uma linha específica fora daqui (AbaCustos, LinhaConta) sem duplicar
    // o cálculo de volume — mesmo racional de receitaBrutaMes/receitaLiquidaMes.
    volumeTotalKgMes,
    totalGeral: lucroLiquido,
  };
}

// Soma dois DREs já calculados (não dois `dados` brutos) — usado pelo
// Consolidado da Agrícola (2026-08-20) pra somar Terra do Sol + Frutos do
// Sol sem precisar mesclar os documentos de premissa das duas fazendas
// (que têm os mesmos códigos de CC — mesclar arriscaria colisão de chave
// CC|Conta). Percentuais de margem são recalculados sobre as bases já
// somadas, nunca somados diretamente (média de percentual estaria errada).
function somarDRE(a, b) {
  const receitaBruta = a.receitaBruta + b.receitaBruta;
  const deducoes = a.deducoes + b.deducoes;
  const receitaLiquida = a.receitaLiquida + b.receitaLiquida;
  const cpv = a.cpv + b.cpv;
  const lucroBruto = a.lucroBruto + b.lucroBruto;
  const despesasSemDA = a.despesasSemDA + b.despesasSemDA;
  const ebitda = a.ebitda + b.ebitda;
  const depreciacao = a.depreciacao + b.depreciacao;
  const resultadoFinanceiro = a.resultadoFinanceiro + b.resultadoFinanceiro;
  const outras = a.outras + b.outras;
  const ebt = a.ebt + b.ebt;
  const ircsl = a.ircsl + b.ircsl;
  const lucroLiquido = a.lucroLiquido + b.lucroLiquido;
  const capexTotal = a.capexTotal + b.capexTotal;
  const receitaBrutaMes = MESES.map((_, m) => a.receitaBrutaMes[m] + b.receitaBrutaMes[m]);
  const receitaLiquidaMes = MESES.map((_, m) => a.receitaLiquidaMes[m] + b.receitaLiquidaMes[m]);
  return {
    receitaBruta, deducoes, receitaLiquida, cpv, lucroBruto,
    margemBruta: receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0,
    despesasSemDA, ebitda,
    margemEbitda: receitaLiquida ? (ebitda / receitaLiquida) * 100 : 0,
    depreciacao, resultadoFinanceiro, outras, ebt, ircsl, lucroLiquido,
    margemLiquida: receitaLiquida ? (lucroLiquido / receitaLiquida) * 100 : 0,
    capexTotal, receitaBrutaMes, receitaLiquidaMes,
    totalGeral: lucroLiquido,
  };
}

// ---------------------------------------------------------------------------
// DRE Mensal Consolidada com sublinhas (2026-08-23, pedido: "a DRE precisa
// ser mensal (com total do ano no final) e precisa contemplar sublinhas
// (agrupadas) por tipo de Receita e dentro do tipo de receita, incluir por
// Resort/Fazenda. Depois Custos por tipo e por empresa. Nas despesas
// operacionais considere Despesas com Pessoal, Despesas com Vendas e
// Despesas Gerais, com abertura por empresa"). Usado só pelo Consolidado
// (ARA Resorts e ARA Agrícola) — ver DREMensalConsolidada/ConsolidadoAgricola/
// ConsolidadoResorts. `lados` é sempre [{ nome, dados, dre, ref }] — um item
// por site editável (as duas fazendas ou os dois resorts); `dre`/`ref` de
// cada lado já vêm de computeDRE/referenciaDaUnidade (mesma referência que a
// tela de cada site usa).
// CCs de nível 2 (área/consolidador — só existem hoje em CCS_AGRICOLA/
// CCS_RESORTS) nunca guardam lançamento próprio (ver AbaCustos, nivel===2) —
// por isso todo somatório aqui filtra só os CCs-folha (nível 3 ou sem nível).
function ccsFolhaDoLado(ref) {
  return ref.ccs.filter(cc => !cc.nivel || cc.nivel === 3);
}
// Receita por tipo (agrupada) e, dentro do tipo, por empresa. Resorts já tem
// uma lista fixa de tipos de receita (LINHAS_RECEITA_RESORTS, mesmo id nos
// dois resorts) — usa o id como chave de agrupamento. Agrícola não tem tipo
// fixo (cada fazenda cadastra os próprios produtos, com nome livre) — usa o
// nome do produto (normalizado) como chave, assim "Milho" de uma fazenda
// agrupa com "Milho" da outra.
function computeGruposReceitaTipo(lados, unidadeKind, cambios) {
  const mapa = new Map();
  lados.forEach(lado => {
    const tipos = unidadeKind === 'resorts'
      ? LINHAS_RECEITA_RESORTS.filter(def => def.id !== LINHA_RECEITA_INFORMATIVA_RESORTS).map(def => {
          // Bug de 2026-08-30 (ver nota em tipoLinhaReceitaResorts): nunca
          // confiar no premissaTipo armazenado nessas linhas — esta função
          // ficou de fora da correção original (só cobriu
          // receitaBrutaPorMes/runAuditoria/AbaReceitaResorts) e a quebra
          // por tipo de receita do Consolidado (DREMensalConsolidada)
          // continuava somando 0 pra Hospedagem/A&B/Café e Pensão.
          const linha = lado.dados.receita.linhas?.[def.id];
          const linhaTipada = linha ? { ...linha, premissaTipo: tipoLinhaReceitaResorts(def.id) || linha.premissaTipo } : linha;
          return {
            chave: def.id,
            nome: def.nome,
            valoresMensal: MESES.map((_, m) => valorLinhaMes(linhaTipada, m, null, null)),
          };
        })
      // Mercado Externo (2026-08-23): mesmo racional de receitaBrutaPorMes —
      // preço na moeda × câmbio, não `p.precos` direto (que fica vazio pra
      // produto externo).
      : (lado.dados.receita.produtos || []).map(p => ({
          chave: (p.nome || '').trim().toLowerCase() || p.id,
          nome: p.nome || '(sem nome)',
          valoresMensal: MESES.map((_, m) => p.mercado === 'externo'
            ? parseNum(p.volumes?.[m]) * parseNum(p.precoMoeda?.[m]) * parseNum(cambios?.[p.moeda || 'usd'])
            : parseNum(p.volumes?.[m]) * parseNum(p.precos?.[m])),
        }));
    tipos.forEach(t => {
      if (!mapa.has(t.chave)) mapa.set(t.chave, { chave: t.chave, nome: t.nome, porLado: [] });
      mapa.get(t.chave).porLado.push({ nome: lado.nome, valoresMensal: t.valoresMensal });
    });
  });
  return [...mapa.values()]
    .map(g => ({ ...g, valoresMensal: MESES.map((_, m) => g.porLado.reduce((acc, pl) => acc + pl.valoresMensal[m], 0)) }))
    .filter(g => g.valoresMensal.some(v => v !== 0));
}
// Custos (CPV) por tipo (pacote do plano de contas dos CC de produção) e,
// dentro do tipo, por empresa. A folha de CCs de produção (mão de obra
// direta) entra como um "tipo" sintético — o pacote 'pessoal' nunca tem
// lançamento em custos.linhas (é sempre calculado, ver computeFolhaPessoalMes)
// e o pacote 'depreciacao' fica de fora do CPV (some depois do EBITDA,
// mesmo racional de computeDRE).
function computeGruposCustosMensal(lados, ipcaAnualPct) {
  const grupos = [];
  grupos.push({
    chave: '__pessoal_producao__',
    nome: 'Mão de obra direta (Pessoal)',
    porLado: lados.map(lado => ({
      nome: lado.nome,
      valoresMensal: MESES.map((_, m) => ccsFolhaDoLado(lado.ref).filter(cc => cc.tipo === 'producao')
        .reduce((acc, cc) => acc + (folhaAnualPorCC(lado.dados, cc.codigo).totalMes[m] || 0), 0)),
    })),
  });
  const pacoteIds = new Map();
  lados.forEach(lado => lado.ref.pacotes.forEach(p => { if (p.id !== 'pessoal' && p.id !== 'depreciacao') pacoteIds.set(p.id, p.nome); }));
  pacoteIds.forEach((nome, pid) => {
    grupos.push({
      chave: pid,
      nome,
      porLado: lados.map(lado => {
        const contas = (lado.ref.planoContas[pid] || []).filter(c => c.origem === 'Custo');
        const ccs = ccsFolhaDoLado(lado.ref).filter(cc => cc.tipo === 'producao');
        const valoresMensal = MESES.map((_, m) => ccs.reduce((acc, cc) => acc + contas.reduce((a2, c) =>
          a2 + valorLinhaMes(lado.dados.custos.linhas?.[`${cc.codigo}|${c.codigo}`], m, lado.dre.receitaBrutaMes, lado.dre.receitaLiquidaMes, ipcaAnualPct, lado.dre.volumeTotalKgMes), 0), 0));
        return { nome: lado.nome, valoresMensal };
      }),
    });
  });
  return grupos
    .map(g => ({ ...g, valoresMensal: MESES.map((_, m) => g.porLado.reduce((acc, pl) => acc + pl.valoresMensal[m], 0)) }))
    .filter(g => g.valoresMensal.some(v => v !== 0));
}
// Despesas Operacionais — sempre nos 3 baldes pedidos (Pessoal/Vendas/
// Gerais), cada um aberto por empresa. Pessoal = folha dos CCs de despesa;
// Vendas = pacote 'comercial' (Comercial e Marketing); Gerais = todo o
// resto (exceto 'pessoal', 'comercial' e 'depreciacao' — esta última segue
// como linha própria abaixo do EBITDA, fora das Despesas Operacionais).
function computeDespesasOperacionaisPorGrupo(lados, ipcaAnualPct) {
  function porPacotes(pacoteIds) {
    return lados.map(lado => {
      const ccs = ccsFolhaDoLado(lado.ref).filter(cc => cc.tipo === 'despesa');
      const contas = pacoteIds.flatMap(pid => (lado.ref.planoContas[pid] || []).filter(c => c.origem === 'Despesa'));
      const valoresMensal = MESES.map((_, m) => ccs.reduce((acc, cc) => acc + contas.reduce((a2, c) =>
        a2 + valorLinhaMes(lado.dados.custos.linhas?.[`${cc.codigo}|${c.codigo}`], m, lado.dre.receitaBrutaMes, lado.dre.receitaLiquidaMes, ipcaAnualPct, lado.dre.volumeTotalKgMes), 0), 0));
      return { nome: lado.nome, valoresMensal };
    });
  }
  const pessoal = lados.map(lado => ({
    nome: lado.nome,
    valoresMensal: MESES.map((_, m) => ccsFolhaDoLado(lado.ref).filter(cc => cc.tipo === 'despesa')
      .reduce((acc, cc) => acc + (folhaAnualPorCC(lado.dados, cc.codigo).totalMes[m] || 0), 0)),
  }));
  const vendas = porPacotes(['comercial']);
  const idsGerais = new Set();
  lados.forEach(lado => lado.ref.pacotes.forEach(p => { if (!['pessoal', 'comercial', 'depreciacao'].includes(p.id)) idsGerais.add(p.id); }));
  const gerais = porPacotes([...idsGerais]);
  return { pessoal, vendas, gerais };
}
function somarPorLado(porLado) {
  return MESES.map((_, m) => porLado.reduce((acc, pl) => acc + pl.valoresMensal[m], 0));
}

// Consolidados multi-site (2026-08-20): cada família (Agrícola, Resorts —
// ver FAMILIAS_MULTISITE) grava, no envio do Consolidado, um wrapper
// { _tipo, [idSiteA]: dadosSiteA, [idSiteB]: dadosSiteB } em vez de um
// `dados` normal — a chave de cada site é o próprio unidadeId dele (ex.:
// { _tipo: 'consolidado_agricola', agricola_tds: {...}, agricola_fds: {...} })
// — ver ConsolidadoAgricola/ConsolidadoResorts. Isto mapeia cada _tipo pros
// sites reais por trás, usado por dreDaUnidade/dfcDaUnidade pra saber como
// desmontar o wrapper. Cada família resolve a referência (CCs/plano de
// contas) pelo próprio site — Resorts precisa disso de verdade, já que
// Beach e Villa não têm exatamente os mesmos CCs ("AT Ampliação Beach" só
// existe no Beach, por exemplo); a Agrícola só coincide por TDS/FDS
// compartilharem a mesma estrutura.
const CONSOLIDADOS_MULTISITE = {
  agricola: { tipo: 'consolidado_agricola', sites: ['agricola_tds', 'agricola_fds'], labels: ['Terra do Sol', 'Frutos do Sol'] },
  resorts: { tipo: 'consolidado_resorts', sites: ['samoa_beach', 'samoa_villa'], labels: ['Samoa Beach', 'Samoa Villa'] },
};
// true se `d` é um dos wrappers acima (qualquer família) — usado pra pular
// (não crashar) em painéis que assumem o formato normal de `dados`
// (exportarExcel, runAuditoria) e não sabem nada sobre Consolidados.
function ehSnapshotConsolidado(d) {
  return !!(d && Object.values(CONSOLIDADOS_MULTISITE).some(c => c.tipo === d._tipo));
}

// computeDRE "unidade-aware" — usado nos painéis que iteram todas as
// UNIDADES (dashboard do FP&A). Pra qualquer unidade normal é idêntico a
// computeDRE(dadosUnidade, referenciaDaUnidade(unidadeId)); só desvia pra
// 'agricola'/'resorts' (Consolidado) quando o documento salvo já é o
// snapshot combinado gravado no envio (ver CONSOLIDADOS_MULTISITE), caso
// em que soma os DREs dos sites em vez de tentar interpretar o wrapper
// como se fosse um `dados` normal (ia quebrar: não tem `dados.receita`/
// `dados.custos` no formato esperado). Antes do primeiro envio do
// Consolidado, `dadosUnidade` é só um emptyFormData comum — cai no caminho
// normal, mostra zero, não quebra nada.
// cambios ({ usd, eur, gbp }, 2026-08-23) — ver nota completa em
// receitaBrutaPorMes. Espelha ipcaAnualPct em todo prop-drilling deste
// arquivo: deriva-se de premissasMacro uma vez em App/VisaoGerente/VisaoFPA
// (ver cambiosDePremissas) e viaja junto com ipcaAnualPct até computeDRE.
function cambiosDePremissas(premissasMacro) {
  return {
    usd: premissasMacro.find(p => p.id === 'cambio')?.valor,
    eur: premissasMacro.find(p => p.id === 'cambio_eur')?.valor,
    gbp: premissasMacro.find(p => p.id === 'cambio_gbp')?.valor,
  };
}
function dreDaUnidade(dadosUnidade, unidadeId, ipcaAnualPct, cambios) {
  const consolidado = CONSOLIDADOS_MULTISITE[unidadeId];
  if (consolidado && dadosUnidade && dadosUnidade._tipo === consolidado.tipo) {
    const [dreA, dreB] = consolidado.sites.map(siteId =>
      computeDRE(dadosUnidade[siteId] || emptyFormData(siteId), referenciaDaUnidade(siteId), ipcaAnualPct, cambios)
    );
    return somarDRE(dreA, dreB);
  }
  return computeDRE(dadosUnidade, referenciaDaUnidade(unidadeId), ipcaAnualPct, cambios);
}

// ---------------------------------------------------------------------------
// Cálculo do Fluxo de Caixa (método indireto) — a partir do Lucro Líquido da
// DRE, add-back de D&A, CAPEX e eventos do Balanço (empréstimos, aportes,
// dividendos). Variação de Capital de Giro (2026-08-23, antes fixada em 0
// aqui — a lacuna real nunca foi falta de dado, era esta função "anual,
// legado" não reaproveitar o cálculo que computeFluxoIndiretoMensal já faz
// mês a mês, a partir dos saldos iniciais de aba 8/Balanço via
// saldosAberturaFc): soma o variacaoGiroMes do método mensal, garantindo o
// mesmo número em ambos — nunca diverge por manutenção em duplicado.
// ---------------------------------------------------------------------------
function computeDFC(data, dre, ref, ipcaAnualPct) {
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
  // `ref` opcional (default REF_VAZIA nos call sites) — sem CCs (unidades
  // sem registro, ex. EI/Energia) o reduce por CC não acha nada e o giro
  // sai 0 mesmo, sem quebrar.
  const variacaoCapitalGiro = ref
    ? computeFluxoIndiretoMensal(data, dre, ref, ipcaAnualPct).variacaoGiroMes.reduce((a, v) => a + v, 0)
    : 0;
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

// Soma dois DFCs já calculados — mesmo racional de somarDRE. Todos os campos
// de computeDFC são valores anuais simples (nenhum percentual), soma direta
// em cada um funciona sem precisar recalcular nada.
function somarDFC(a, b) {
  const out = {};
  Object.keys(a).forEach(k => { out[k] = a[k] + b[k]; });
  return out;
}

// computeDFC "unidade-aware" — mesmo racional de dreDaUnidade, pro dashboard
// do FP&A (VisaoResultadosConsolidados) que itera todas as UNIDADES
// chamando computeDFC(d, dre) direto. `d` de 'agricola'/'resorts' pode ser
// o wrapper (ver CONSOLIDADOS_MULTISITE) depois do primeiro envio do
// Consolidado — computeDFC quebraria em `data.capex.projetos`.
function dfcDaUnidade(dadosUnidade, dreUnidade, unidadeId, ipcaAnualPct, cambios) {
  const consolidado = CONSOLIDADOS_MULTISITE[unidadeId];
  if (consolidado && dadosUnidade && dadosUnidade._tipo === consolidado.tipo) {
    const [dfcA, dfcB] = consolidado.sites.map(siteId => {
      const d = dadosUnidade[siteId] || emptyFormData(siteId);
      const refSite = referenciaDaUnidade(siteId);
      return computeDFC(d, computeDRE(d, refSite, ipcaAnualPct, cambios), refSite, ipcaAnualPct);
    });
    return somarDFC(dfcA, dfcB);
  }
  return computeDFC(dadosUnidade, dreUnidade, referenciaDaUnidade(unidadeId), ipcaAnualPct);
}

// Bug corrigido em 2026-08-30 ("na Visão Grupo do FP&A, o consolidador da
// ARA Resorts e ARA Agrícola não está sendo vinculado, não apresentando
// valores"): dreDaUnidade/dfcDaUnidade só somam TDS+FDS (ou Beach+Villa)
// quando o documento salvo em 'agricola'/'resorts' já é o wrapper gravado
// no envio do Consolidado (ver CONSOLIDADOS_MULTISITE) — antes do
// primeiro "Enviar versão consolidada", esse documento é só um
// emptyFormData comum (às vezes com lixo de antes da unidade virar
// multi-site), então a Visão Grupo do FP&A (VisaoFPA/
// VisaoResultadosConsolidados, que usa dreDaUnidade/dfcDaUnidade direto
// sobre statusUnidades['agricola']/['resorts']) mostrava 0 (ou um valor
// errado) mesmo com TDS/FDS/Beach/Villa cheios de dado — inconsistente
// com ConsolidadoAgricola/ConsolidadoResorts, que sempre somam TDS+FDS
// "ao vivo" direto dos dois sites, nunca dependem desse envio. Esta
// função replica esse mesmo racional "ao vivo": para 'agricola'/'resorts'
// soma sempre statusUnidades['agricola_tds']+['agricola_fds'] (ou
// samoa_beach+samoa_villa), ignorando o documento wrapper por completo;
// para qualquer outra unidade, cai no caminho normal de sempre.
function dreEDfcGrupoUnidade(statusUnidades, unidadeId, ipcaAnualPct, cambios) {
  const consolidado = CONSOLIDADOS_MULTISITE[unidadeId];
  if (consolidado) {
    const dres = consolidado.sites.map(siteId =>
      computeDRE(statusUnidades[siteId] || emptyFormData(siteId), referenciaDaUnidade(siteId), ipcaAnualPct, cambios)
    );
    const dfcs = consolidado.sites.map((siteId, i) =>
      computeDFC(statusUnidades[siteId] || emptyFormData(siteId), dres[i], referenciaDaUnidade(siteId), ipcaAnualPct)
    );
    return { dre: somarDRE(dres[0], dres[1]), dfc: somarDFC(dfcs[0], dfcs[1]) };
  }
  const d = statusUnidades[unidadeId] || emptyFormData(unidadeId);
  const dre = dreDaUnidade(d, unidadeId, ipcaAnualPct, cambios);
  const dfc = dfcDaUnidade(d, dre, unidadeId, ipcaAnualPct, cambios);
  return { dre, dfc };
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
function computeFluxoIndiretoMensal(data, dre, ref, ipcaAnualPct) {
  const receitaLiquidaMes = dre.receitaLiquidaMes;
  const receitaBrutaMes = dre.receitaBrutaMes;
  const linhasCustos = Object.entries(data.custos.linhas || {});

  function totalLinhasMes(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || cc.tipo !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
    }, 0);
  }
  // Versão em caixa (pagamento) do mesmo total — só difere de totalLinhasMes
  // nas linhas marcadas pelo gestor como "competência ≠ pagamento" (ver
  // UNIDADES_COM_COMPETENCIA_CAIXA/valorLinhaMesCaixa). Escopo restrito à
  // 'despesa' (é onde a pergunta aparece hoje — Corporativo não tem CC de
  // produção) — 'producao' continua só na competência aqui.
  function totalLinhasMesCaixa(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || cc.tipo !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMesCaixa(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
    }, 0);
  }
  // pacote 'pessoal' (2026-08-23): não exclui mais de totalLinhasMes — ver
  // nota completa em computeDRE. Nome da variável mantido (cpvSemPessoalMes)
  // porque também alimenta o capital de giro abaixo, mas não exclui nada
  // "de pessoal" de verdade — só não soma a folha calculada duas vezes.
  const cpvSemPessoalMes = MESES.map((_, m) => totalLinhasMes('producao', [], m));
  const cpvMes = MESES.map((_, m) => cpvSemPessoalMes[m]
    + ref.ccs.filter(cc => cc.tipo === 'producao').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].total, 0));
  const despesasSemDAmes = MESES.map((_, m) => totalLinhasMes('despesa', ['depreciacao'], m)
    + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].total, 0));
  const ebitdaMes = MESES.map((_, m) => receitaLiquidaMes[m] - cpvMes[m] - despesasSemDAmes[m]);

  // depreciacaoMes/resultadoFinanceiroMes/outrasMes/ebtMes precisam vir
  // antes de ircslMes (movidos pra cá em 2026-08-30 — antes ficavam lá
  // embaixo, depois de fcOperacionalMes já ter usado ircslMes, então o
  // IRCSL nunca tinha como saber o EBT de cada mês).
  const depreciacaoMes = MESES.map((_, m) => linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || cc.tipo !== 'despesa' || pacoteId !== 'depreciacao') return acc;
    return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
  }, 0));
  const resultadoFinanceiroMes = MESES.map((_, m) => parseNum(data.resultado.receitaFinanceira?.[m]) - parseNum(data.resultado.despesaFinanceira?.[m]));
  const outrasMes = MESES.map((_, m) => parseNum(data.resultado.outrasReceitasDespesas?.[m]));
  const ebtMes = MESES.map((_, m) => ebitdaMes[m] - depreciacaoMes[m] + resultadoFinanceiroMes[m] + outrasMes[m]);

  // Bug corrigido em 2026-08-30 ("IRCSL calculado mesmo sem apresentar
  // receita"): antes, dre.ircsl (o total anual — calculado sobre o EBT
  // ANUAL, ver computeDRE) era simplesmente dividido por 12 e aplicado
  // igual em todo mês, aparecendo até em meses com EBT zero ou negativo
  // (ex.: toda a receita do ano concentrada em Janeiro). Agora o mesmo
  // total anual é distribuído só pelos meses com EBT positivo,
  // proporcionalmente ao EBT de cada um — mês sem lucro não carrega
  // IRCSL, e a soma do ano continua batendo exatamente com dre.ircsl
  // (nenhuma tela que só lê o total anual muda de valor).
  const somaEbtPositivoMes = ebtMes.reduce((acc, v) => acc + Math.max(v, 0), 0);
  const ircslMes = MESES.map((_, m) => somaEbtPositivoMes > 0 ? dre.ircsl * (Math.max(ebtMes[m], 0) / somaEbtPositivoMes) : 0);

  const decimoTerceiroMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].decimoTerceiro, 0));
  const decimoTerceiroAnualTotal = decimoTerceiroMes.reduce((a, v) => a + v, 0);
  const pagamento13Mes = MESES.map((_, m) => (m === 10 || m === 11) ? decimoTerceiroAnualTotal / 2 : 0);
  const ajuste13Mes = MESES.map((_, m) => decimoTerceiroMes[m] - pagamento13Mes[m]);

  // Ajuste competência × caixa (2026-08-23, ver UNIDADES_COM_COMPETENCIA_CAIXA):
  // mesmo racional do ajuste13Mes acima — "acrual menos caixa", somado ao FC
  // Operacional pra desfazer o efeito de competência do EBITDA (que já
  // subtraiu despesasSemDAmes) e refletir a saída de caixa real do mês.
  // Zero em qualquer linha sem o descasamento marcado (comportamento de
  // sempre, sem mudança).
  const despesasCaixaMes = MESES.map((_, m) => totalLinhasMesCaixa('despesa', ['depreciacao'], m)
    + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].total, 0));
  const ajustePagamentoMes = MESES.map((_, m) => despesasSemDAmes[m] - despesasCaixaMes[m]);

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

  const fcOperacionalMes = MESES.map((_, m) => ebitdaMes[m] - ircslMes[m] + ajuste13Mes[m] + variacaoGiroMes[m] + ajustePagamentoMes[m]);

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
  const lucroLiquidoMes = MESES.map((_, m) => ebtMes[m] - ircslMes[m]);

  const variacaoCaixaMes = MESES.map((_, m) => fcOperacionalMes[m] + fcInvestimentoMes[m] + fcFinanciamentoMes[m]);
  const caixaInicial = saldosAberturaFc(data).caixaInicial;
  const caixaAcumuladoMes = [];
  let acumulado = caixaInicial;
  MESES.forEach((_, m) => { acumulado += variacaoCaixaMes[m]; caixaAcumuladoMes.push(acumulado); });

  return {
    receitaBrutaMes, receitaLiquidaMes, deducoesMes, cpvMes, lucroBrutoMes, despesasSemDAmes,
    ebitdaMes, depreciacaoMes, resultadoFinanceiroMes, outrasMes, ircslMes, lucroLiquidoMes,
    ajuste13Mes, ajustePagamentoMes, variacaoGiroMes, fcOperacionalMes,
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
function computeFluxoCaixaDiretoMensal(data, dre, ref, ipcaAnualPct) {
  const receitaLiquidaMes = dre.receitaLiquidaMes;
  const receitaBrutaMes = dre.receitaBrutaMes;
  const linhasCustos = Object.entries(data.custos.linhas || {});

  function totalLinhasMes(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || cc.tipo !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
    }, 0);
  }
  // Versão em caixa — ver mesma nota em computeFluxoIndiretoMensal.
  function totalLinhasMesCaixa(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || cc.tipo !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMesCaixa(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
    }, 0);
  }
  // pacote 'pessoal' (2026-08-23): não exclui mais — ver nota em
  // computeFluxoIndiretoMensal/computeDRE.
  const cpvSemPessoalMes = MESES.map((_, m) => totalLinhasMes('producao', [], m));
  // Pagamentos de despesas de fato (caixa) — 2026-08-23: por padrão igual à
  // competência (totalLinhasMes); linhas marcadas com o descasamento
  // competência × caixa usam o valor de pagamento digitado à parte (ver
  // UNIDADES_COM_COMPETENCIA_CAIXA/valorLinhaMesCaixa).
  const despesasCaixaSemPessoalMes = MESES.map((_, m) => totalLinhasMesCaixa('despesa', ['depreciacao'], m));
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
  const pagamentosDespesasMes = despesasCaixaSemPessoalMes;
  // Bug corrigido em 2026-08-30 ("IRCSL calculado mesmo sem apresentar
  // receita") — mesmo racional do método Indireto (ver
  // computeFluxoIndiretoMensal): não dividir dre.ircsl (total anual) por
  // 12 igual em todo mês, senão aparece IRCSL até em mês sem lucro.
  // Reaproveita o ircslMes já calculado (proporcional ao EBT positivo de
  // cada mês) do método Indireto, em vez de duplicar a lógica — os dois
  // métodos já são descritos como "duas leituras do mesmo número" (ver
  // nota no topo desta função).
  const ircslMes = computeFluxoIndiretoMensal(data, dre, ref, ipcaAnualPct).ircslMes;

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
function runAuditoria(data, dre, ref, unidadeId, ipcaAnualPct) {
  const checks = [];
  const temReceita = unidadeId !== 'corporativo';
  const temCcProducao = ref.ccs.some(c => c.tipo === 'producao');

  if (temReceita) {
    if (data.receita.linhas) {
      // Mesma normalização de premissaTipo de receitaBrutaPorMes — ver
      // tipoLinhaReceitaResorts (bug de 2026-08-30).
      const linhasReceitaValidas = Object.entries(data.receita.linhas)
        .filter(([id, l]) => valorLinhaAnual({ ...l, premissaTipo: tipoLinhaReceitaResorts(id) || l.premissaTipo }, null, null) > 0);
      checks.push({
        label: 'Receita: ao menos uma linha (Hospedagem, A&B, etc.) com valor lançado',
        ok: linhasReceitaValidas.length > 0,
        detalhe: `${linhasReceitaValidas.length} de ${Object.keys(data.receita.linhas).length} linha(s) preenchida(s)`,
      });
    } else {
      // Mercado Externo (2026-08-23): preço mora em precoMoeda, não em
      // precos (que fica derivado/vazio — ver receitaBrutaPorMes).
      const produtosValidos = (data.receita.produtos || []).filter(p =>
        somaMes(p.volumes) > 0 && somaMes(p.mercado === 'externo' ? p.precoMoeda : p.precos) > 0
      );
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
    }).filter(([, linha]) => valorLinhaAnual(linha, dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes) > 0);
    checks.push({
      label: 'CPV: ao menos uma linha analítica lançada em CC de produção',
      ok: linhasProducao.length > 0,
      detalhe: `${linhasProducao.length} linha(s) analítica(s) com valor em CC de produção`,
    });
  }

  // Pedido de 2026-08-16: retirada do quadro de auditoria (não é mais nem
  // pendência informativa, nem bloqueio de envio).

  const linhasIncoerentes = linhasCustos.filter(([, linha]) => contaIncoerente(linha));
  checks.push({
    label: 'Linhas Qtd × Valor unit. ou Rateio (base manual) sem campo incompleto',
    ok: linhasIncoerentes.length === 0,
    detalhe: linhasIncoerentes.length === 0 ? 'Nenhuma linha com apenas um dos dois campos preenchido' : `${linhasIncoerentes.length} linha(s) com quantidade/valor unit. ou base/percentual incompletos em algum mês`,
  });

  // Múltiplas linhas por conta (2026-08-23): cada SUBLINHA com valor
  // lançado precisa da própria justificativa — não basta uma justificativa
  // por conta quando há mais de um fornecedor dentro dela.
  const linhasComValorSemJustificativa = linhasCustos.filter(([, contaRaw]) =>
    normalizarConta(contaRaw).sublinhas.some(sub =>
      valorLinhaAnual(sub, dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes) > 0 && !(sub.justificativa || '').trim()
    )
  );
  checks.push({
    label: 'Toda linha analítica com valor lançado tem justificativa preenchida',
    ok: linhasComValorSemJustificativa.length === 0,
    detalhe: linhasComValorSemJustificativa.length === 0 ? 'Justificativa preenchida em todas as linhas com valor' : `${linhasComValorSemJustificativa.length} linha(s) com valor e sem justificativa`,
  });

  // Descrição obrigatória (2026-08-23, pedido: "nenhuma descrição de conta
  // analítica pode ser opcional, é obrigatória") — mesmo racional da
  // justificativa acima: obrigatória a partir do momento que a sublinha
  // tem valor lançado (sublinha 100% vazia, ainda não tocada pelo gestor,
  // não é cobrada — evita acender aviso em toda conta intocada do plano).
  const linhasComValorSemDescricao = linhasCustos.filter(([, contaRaw]) =>
    normalizarConta(contaRaw).sublinhas.some(sub =>
      valorLinhaAnual(sub, dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes) > 0 && !(sub.descricao || '').trim()
    )
  );
  checks.push({
    label: 'Toda linha analítica com valor lançado tem descrição preenchida',
    ok: linhasComValorSemDescricao.length === 0,
    detalhe: linhasComValorSemDescricao.length === 0 ? 'Descrição preenchida em todas as linhas com valor' : `${linhasComValorSemDescricao.length} linha(s) com valor e sem descrição`,
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

  const valoresNegativos = (data.receita.produtos || []).some(p => (p.volumes || []).some(v => parseNum(v) < 0) || ((p.mercado === 'externo' ? p.precoMoeda : p.precos) || []).some(v => parseNum(v) < 0))
    || Object.values(data.custos.linhas || {}).some(linha => contaTemNegativo(linha));
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
// totalValor/formatarTotal (2026-08-30, bug: "coluna Total do Preço R$/t
// soma os 12 meses"): uma linha de `linhas` normalmente é aditiva (Volume,
// Receita — Total = soma dos 12 meses faz sentido), mas uma linha de PREÇO
// não é — R$3 em Set + R$4 em Out não vira "R$7 de total", vira uma média
// ponderada por volume (Receita do ano / Volume do ano), que quem chama já
// sabe calcular (tem os dois arrays) e a tabela genérica não. Por isso cada
// item de `linhas` pode opcionalmente trazer `totalValor` (usa esse valor
// em vez de somar `valores`) e `formatarTotal` (formatação só dessa linha,
// tem prioridade sobre o `formatarTotal` da tabela inteira).
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
            const total = linha.totalValor !== undefined ? linha.totalValor : somaMes(linha.valores);
            const formatarTotalLinha = linha.formatarTotal || formatarTotal;
            return (
              <tr key={linha.key} style={{ background: i % 2 ? COR.claro : COR.branco }}>
                <td style={{ fontWeight: 700, fontSize: 11.5, padding: '6px 10px', border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: i % 2 ? COR.claro : COR.branco }}>{linha.label}</td>
                {colunaExtra && celulaExtra(linha, i)}
                {MESES.map((m, mi) => (
                  <td key={m} style={{ padding: 3, border: `1px solid ${COR.borda}` }}>
                    <input
                      type="text" inputMode="decimal" value={linha.valores[mi]}
                      onChange={e => onChangeCelula(linha.key, mi, e.target.value)}
                      onPaste={e => onPasteMensal(e, mi, (idxs, vals) => onChangeCelula(linha.key, idxs, vals))}
                      style={{ width: '100%', border: 'none', outline: 'none', padding: '5px 4px', fontFamily: FONT, fontSize: 11, color: COR.texto, background: 'transparent', boxSizing: 'border-box', textAlign: 'right' }}
                    />
                  </td>
                ))}
                <td style={{ padding: '6px 8px', border: `1px solid ${COR.borda}`, fontWeight: 700, fontSize: 11, color: corTotal || COR.azul, textAlign: 'right' }}>
                  {formatarTotalLinha ? formatarTotalLinha(total) : `${total.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${sufixo || ''}`}
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

// erro (2026-08-23) — borda vermelha pra campo obrigatório vazio (ex.:
// descrição da conta analítica, ver LinhaConta) — opcional, não muda
// nenhum outro chamador existente.
function CampoTexto({ value, onChange, placeholder, erro }) {
  return (
    <input
      type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', border: `1px solid ${erro ? COR.vermelho : COR.borda}`, borderRadius: 6, padding: '8px 10px', fontFamily: FONT, fontSize: 13, color: COR.texto, boxSizing: 'border-box' }}
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
    // Backlog (2026-08-23): agora derivado direto de orcamento_versoes no
    // backend (ver listarVersoesRecentesTodasUnidades) — sem escrita
    // própria, sempre reflete o que foi realmente enviado. `totais` é o
    // mesmo subconjunto que o backend já grava no envio (ver
    // registrarEnvio), não o objeto DRE completo.
    try {
      const linhas = await listarBacklogApi();
      setBacklog(linhas.map(l => ({
        id: l.id, unidadeId: l.unidade_id, timestamp: l.enviado_em,
        autor: l.autor_nome, comentario: l.comentario, totalGeral: l.totais?.lucroLiquido,
      })));
    } catch (e) {
      setBacklog([]);
    }
    // Etapas do processo (2026-08-23): nome/ordem continuam vindos da
    // constante ETAPAS_PROCESSO_PADRAO; só inicio/fim (o que é editável)
    // vem do backend agora, mesclado por id.
    try {
      const salvas = await listarEtapasProcessoApi();
      setEtapasProcesso(ETAPAS_PROCESSO_PADRAO.map(e => {
        const s = salvas.find(x => x.id === e.id);
        return s && s.inicio && s.fim ? { ...e, inicio: s.inicio, fim: s.fim } : e;
      }));
    } catch (e) {
      setEtapasProcesso(ETAPAS_PROCESSO_PADRAO);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { if (role === 'fpa') carregarFPA(); }, [role, carregarFPA]);

  // Premissas macro (2026-08-20): saíram do localStorage do navegador (que
  // só quem preencheu enxergava) pra uma tabela de verdade (premissas_macro),
  // porque o "Reajuste Inflação" (tipo de premissa de Custos e Despesas)
  // precisa do IPCA chegando igual pra qualquer gestor, não só pra quem está
  // na mesma aba do FP&A que preencheu. Leitura liberada a qualquer perfil
  // autenticado. Backlog e etapas do processo passaram pelo mesmo caminho em
  // 2026-08-23 (ver carregarFPA/atualizarEtapa) — os três itens que o antigo
  // legacyStorage.js cobria já foram todos migrados.
  useEffect(() => {
    (async () => {
      try {
        const salvas = await listarPremissasMacroApi();
        setPremissasMacro(prev => prev.map(p => {
          const s = salvas.find(x => x.id === p.id);
          return s ? { ...p, valor: s.valor || '', fonte: s.fonte, atualizadoEm: s.atualizado_em } : p;
        }));
      } catch (e) {
        // mantém os valores padrão (vazios) se a leitura falhar
      }
    })();
  }, []);

  async function updatePremissaMacroGlobal(id, valor) {
    try {
      const p = await atualizarPremissaMacroApi(id, valor);
      setPremissasMacro(prev => prev.map(x => x.id === id ? { ...x, valor: p.valor || '', fonte: p.fonte, atualizadoEm: p.atualizado_em } : x));
    } catch (e) {
      // silencioso — mesmo padrão de antes (sem toast de erro nesta tela)
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
        // Só persiste as que o Focus realmente respondeu (fonte mudou pra
        // 'Boletim Focus (BCB)') — "Reajuste salarial/dissídio", que não
        // tem indicador no Focus, não muda e não precisa regravar.
        await Promise.all(
          atualizadas
            .filter(p => p.fonte === 'Boletim Focus (BCB)')
            .map(p => atualizarPremissaMacroApi(p.id, p.valor, p.fonte))
        );
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
    // Consolidado (Agrícola/Resorts, 2026-08-20) nunca é editado direto por
    // aqui (ver ConsolidadoAgricola/ConsolidadoResorts) — autosalvar o
    // `dados` deste componente arriscaria sobrescrever, com uma cópia
    // desatualizada, o snapshot que o Consolidado acabou de gravar no envio
    // (race condition).
    if (unidadeAtual === 'agricola' || unidadeAtual === 'resorts') return;
    const t = setTimeout(async () => {
      try {
        const status = dados.meta?.status === 'enviado' ? 'enviado' : 'em_preenchimento';
        await putOrcamento(unidadeAtual, { ...dados, meta: { ...dados.meta, status, atualizadoEm: new Date().toISOString() } });
        setUltimoSalvoEm(new Date());
        setErro(null); // limpa um erro anterior assim que um salvamento subsequente dá certo
      } catch (e) {
        // 403 acesso_expirado (2026-08-23, ver middleware/authorize.js)
        // vem com mensagem específica do backend — as outras falhas caem
        // no texto genérico de sempre.
        setErro(e instanceof ApiError && e.status === 403 ? e.message : 'Não foi possível salvar o rascunho automaticamente. Verifique a conexão.');
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
      setErro(e instanceof ApiError && e.status === 403 ? e.message : 'Não foi possível salvar o rascunho. Verifique a conexão.');
    }
    setSalvandoRascunho(false);
  }

  const refUnidadeAtual = referenciaDaUnidade(unidadeAtual);
  // IPCA (2026-08-20, tipo de premissa 'reajuste_inflacao') — vem das
  // premissas macro do FP&A (premissasMacro, agora persistidas no banco,
  // ver listarPremissasMacroApi acima).
  const ipcaAnualPct = premissasMacro.find(p => p.id === 'ipca')?.valor;
  // useMemo (não literal): cambiosDePremissas monta objeto novo a cada
  // render — sem memo, quebraria a memoização de `dre` logo abaixo (viraria
  // dependência sempre "diferente").
  const cambios = useMemo(() => cambiosDePremissas(premissasMacro), [premissasMacro]);
  // dreDaUnidade (não computeDRE direto): quando unidadeAtual é um
  // Consolidado ('agricola'/'resorts') e já houve um envio, o `dados` salvo
  // é o wrapper (ver CONSOLIDADOS_MULTISITE/ConsolidadoAgricola/
  // ConsolidadoResorts). computeDRE quebraria tentando ler `dados.receita`
  // direto do wrapper.
  const dre = useMemo(() => dreDaUnidade(dados, unidadeAtual, ipcaAnualPct, cambios), [dados, unidadeAtual, ipcaAnualPct, cambios]);
  // Mesmo motivo do dre acima: runAuditoria também espera o formato normal
  // de `dados` — Consolidado calcula as próprias checagens (dos sites,
  // separadas) dentro de si mesmo, não usa este `checks`.
  const checks = useMemo(() => {
    if (ehSnapshotConsolidado(dados)) return [];
    return runAuditoria(dados, dre, refUnidadeAtual, unidadeAtual, ipcaAnualPct);
  }, [dados, dre, refUnidadeAtual, unidadeAtual, ipcaAnualPct]);
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

  // Múltiplas linhas por conta (2026-08-23, ver normalizarConta/
  // novaContaVazia) — updateLinha virou 4 funções: updateConta (campo no
  // nível da conta, hoje só `classificacao`) e updateSublinha/addSublinha/
  // removeSublinha (miram uma sublinha específica pelo id dentro do array).
  function updateConta(chave, campo, valor) {
    const atual = normalizarConta(dados.custos.linhas[chave]);
    atualizar(['custos', 'linhas'], { ...dados.custos.linhas, [chave]: { ...atual, [campo]: valor } });
  }
  function updateSublinha(chave, sublinhaId, campo, valor) {
    const atual = normalizarConta(dados.custos.linhas[chave]);
    const sublinhas = atual.sublinhas.map(s => s.id === sublinhaId ? { ...s, [campo]: valor } : s);
    atualizar(['custos', 'linhas'], { ...dados.custos.linhas, [chave]: { ...atual, sublinhas } });
  }
  function addSublinha(chave) {
    const atual = normalizarConta(dados.custos.linhas[chave]);
    atualizar(['custos', 'linhas'], { ...dados.custos.linhas, [chave]: { ...atual, sublinhas: [...atual.sublinhas, novaLinhaVazia()] } });
  }
  // Nunca deixa a conta sem nenhuma sublinha (a última não pode ser
  // removida, só limpa de volta pro estado vazio) — o resto do código
  // (valorLinhaMes etc.) assume sempre pelo menos 1.
  function removeSublinha(chave, sublinhaId) {
    const atual = normalizarConta(dados.custos.linhas[chave]);
    const sublinhas = atual.sublinhas.filter(s => s.id !== sublinhaId);
    atualizar(['custos', 'linhas'], { ...dados.custos.linhas, [chave]: { ...atual, sublinhas: sublinhas.length > 0 ? sublinhas : [novaLinhaVazia()] } });
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
      // Backlog do FP&A (2026-08-23): não precisa mais de escrita própria
      // aqui — é derivado de orcamento_versoes no backend (ver
      // listarVersoesRecentesTodasUnidades/carregarFPA), a mesma versão que
      // acabou de ser gravada por enviarVersaoApi já aparece lá.
      const { orcamento } = await enviarVersaoApi(unidadeAtual, comentarioEnvio.trim());
      setDados(orcamento.dados);
      setAguardandoLiberacao(orcamento.aguardando_liberacao || false);
      setVersoes(await listarVersoes(unidadeAtual));

      setComentarioEnvio('');
    } catch (e) {
      // 409 aguardando_liberacao_fpa e 403 acesso_expirado (2026-08-23) vêm
      // com mensagem específica do backend (ApiError.message já traz
      // body.mensagem) — as outras falhas caem no texto genérico de sempre.
      setErro(e instanceof ApiError && (e.status === 409 || e.status === 403) ? e.message : 'Falha ao enviar a versão. Tente novamente em instantes.');
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
      const etapaNova = novasEtapas.find(e => e.id === id);
      await atualizarEtapaProcessoApi(id, etapaNova.inicio, etapaNova.fim);
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
      // Consolidado (ver CONSOLIDADOS_MULTISITE): `dados` aqui não é o
      // formato normal (é o wrapper com um site em cada chave) — os sites
      // (Terra do Sol/Frutos do Sol, Samoa Beach/Villa) já exportam as
      // próprias linhas de Custos e Despesas individualmente, então pular
      // esta unidade não perde informação, só evita duplicar num formato
      // que este laço não sabe interpretar.
      if (!d || ehSnapshotConsolidado(d)) return;
      const refU = referenciaDaUnidade(u.id);
      const dreU = computeDRE(d, refU, ipcaAnualPct, cambios);
      Object.entries(d.custos.linhas || {}).forEach(([chave, contaRaw]) => {
        const [ccCodigo, contaCodigo] = chave.split('|');
        const cc = refU.ccs.find(c => c.codigo === ccCodigo);
        const conta = refU.todasContas[contaCodigo];
        const pacote = (refU.pacotes || []).find(p => p.id === conta?.pacoteId);
        // Múltiplas linhas por conta (2026-08-23): exporta uma linha do
        // Excel por SUBLINHA (não por conta) — cada sublinha tem sua
        // própria premissa/justificativa (ex.: um fornecedor diferente).
        normalizarConta(contaRaw).sublinhas.forEach(sub => {
          const premissa = TIPOS_PREMISSA.find(t => t.id === sub.premissaTipo);
          const descricaoConta = sub.descricao ? `${conta?.nome || ''} — ${sub.descricao}` : (conta?.nome || '');
          MESES.forEach((m, mi) => {
            const valor = valorSublinhaMes(sub, mi, dreU.receitaBrutaMes, dreU.receitaLiquidaMes, ipcaAnualPct, dreU.volumeTotalKgMes);
            if (valor === 0) return;
            linhasCustosExport.push([u.nome, cc?.nome || ccCodigo, cc?.tipo === 'producao' ? 'Custo' : 'Despesa', pacote?.nome || 'Sem pacote', contaCodigo, descricaoConta, premissa?.nome || sub.premissaTipo, m, valor, sub.justificativa || '', d.meta?.status || 'nao_iniciado', formatData(d.meta?.atualizadoEm), d.meta?.autor || '']);
          });
        });
      });
    });
    const wsC = XLSX.utils.aoa_to_sheet(linhasCustosExport);
    wsC['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 26 }, { wch: 10 }, { wch: 30 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsC, 'Custos_Despesas');

    const linhasReceita = [['Unidade', 'Produto', 'Mercado', 'Mês', 'Volume (t)', 'Preço (R$/t)', 'Receita Bruta', 'Justificativa Geral da Receita']];
    unidadesParaExportar.forEach(u => {
      const d = role === 'fpa' ? statusUnidades[u.id] : dados;
      if (!d || ehSnapshotConsolidado(d)) return; // ver nota acima (Custos_Despesas)
      (d.receita.produtos || []).forEach(p => {
        // Mercado Externo (2026-08-23, ver receitaBrutaPorMes): preço em R$
        // é derivado (Preço na moeda × câmbio), não digitado direto — exporta
        // já convertido, pra manter a coluna "Preço (R$/t)" comparável entre
        // Mercado Interno e Externo.
        const externo = p.mercado === 'externo';
        const taxa = externo ? parseNum(cambios?.[p.moeda || 'usd']) : 1;
        MESES.forEach((m, mi) => {
          const vol = parseNum(p.volumes?.[mi]);
          if (vol === 0) return;
          const precoRs = externo ? parseNum(p.precoMoeda?.[mi]) * taxa : parseNum(p.precos?.[mi]);
          linhasReceita.push([u.nome, p.nome, externo ? `Externo (${(p.moeda || 'usd').toUpperCase()})` : 'Interno', m, vol, precoRs, vol * precoRs, d.receita.justificativaGeral || '']);
        });
      });
    });
    const wsR = XLSX.utils.aoa_to_sheet(linhasReceita);
    wsR['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsR, 'Receita');

    const linhasBalanco = [['Unidade', 'Item', 'Valor/Mês', 'Justificativa']];
    unidadesParaExportar.forEach(u => {
      const d = role === 'fpa' ? statusUnidades[u.id] : dados;
      if (!d || ehSnapshotConsolidado(d)) return; // ver nota acima (Custos_Despesas)
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
      if (!d || ehSnapshotConsolidado(d)) return; // ver nota acima (Custos_Despesas)
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
      const t = dreDaUnidade(d, u.id, ipcaAnualPct, cambios);
      linhasDRE.push([u.nome, t.receitaBruta, -t.deducoes, t.receitaLiquida, -t.cpv, t.lucroBruto, t.margemBruta, -t.despesasSemDA, t.ebitda, t.margemEbitda, -t.depreciacao, t.resultadoFinanceiro, t.outras, -t.ircsl, t.lucroLiquido, t.margemLiquida]);
    });
    const wsD = XLSX.utils.aoa_to_sheet(linhasDRE);
    XLSX.utils.book_append_sheet(wb, wsD, 'DRE_Resumo');

    XLSX.writeFile(wb, `Orcamento_2027_${role === 'fpa' ? 'Consolidado' : unidadeObj.nome.replace(/\s/g, '_')}_DadosBrutos.xlsx`);
  }

  // Excel - Cálculo (2026-08-23, pedido: "precisa ser uma modelagem
  // financeira completa com todas as fórmulas e racionais presentes na
  // plataforma") — reescrito do zero: em vez de escrever os números já
  // calculados pelo JS (uma "foto"), agora cada aba de premissa vira uma
  // planilha de INPUTS (azul) e cada aba calculada tem FÓRMULAS DE EXCEL
  // de verdade (SheetJS `.f`, sem valor em cache — Excel recalcula ao
  // abrir), linkadas entre si — exatamente o racional de valorLinhaMes/
  // computeDRE/computeFluxoIndiretoMensal/computeFluxoCaixaDiretoMensal
  // reescrito em fórmula. Escopo (confirmado com o usuário em 2026-08-23):
  // sempre 1 unidade por vez (a atual, no Gestor; a aberta no drill-down,
  // no FP&A — ver exportarExcelCalculo(unidadeIdParam)); núcleo com
  // fórmula = Receita, Custos e Despesas, Pessoal, DRE e os 2 Fluxos de
  // Caixa — CAPEX/FC Financiamentos/Provisões/Balanço/Plano 5Y continuam
  // como valor calculado (são digitação direta hoje, sem racional de
  // fórmula próprio pra replicar).
  //
  // Simplificações documentadas (decisão de escopo, não bug): saldos de
  // abertura de Caixa/AR/AP/Estoque entram como premissa única (valor de
  // saldosAberturaFc), não decompostos na malha granular do Balanço da
  // Têxtil; a cascata de aging de recebimentos da Têxtil
  // (premissasRecebimento) e os Pagamentos Manuais (idem, só Têxtil)
  // entram como valor calculado — são funcionalidades muito específicas
  // de uma unidade só, formularizar quebraria a paridade com as outras.
  function exportarExcelCalculo(unidadeIdParam) {
    // role 'fpa' (VisaoFPA) exige uma unidade aberta no drill-down — não
    // existe "unidadeAtual" nesse contexto (é do Gestor); role 'gerente'
    // sempre usa a unidade que ele está editando, mesmo sem param.
    const uId = role === 'fpa' ? unidadeIdParam : (unidadeIdParam || unidadeAtual);
    const uObj = UNIDADES.find(x => x.id === uId) || unidadeObj;
    const d = uId ? (role === 'fpa' ? statusUnidades[uId] : dados) : null;
    if (!uId || !d) { alert('Abra uma unidade no drill-down (ou selecione uma unidade) antes de exportar o modelo completo.'); return; }
    if (ehSnapshotConsolidado(d)) { alert('O Consolidado não tem premissas próprias — abra uma das unidades que o compõem (ex.: Terra do Sol) para exportar o modelo completo.'); return; }
    const refU = referenciaDaUnidade(uId);

    const wb = XLSX.utils.book_new();
    function colL(c) { return XLSX.utils.encode_col(c); }
    function cellRef(r, c) { return XLSX.utils.encode_cell({ r, c }); }
    function putS(ws, r, c, v) { ws[cellRef(r, c)] = { t: 's', v: String(v ?? '') }; }
    function putN(ws, r, c, v) { ws[cellRef(r, c)] = { t: 'n', v: parseNum(v) }; }
    function putF(ws, r, c, f) { ws[cellRef(r, c)] = { t: 'n', f }; }
    function finish(ws, nRows, nCols, cols) {
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(nRows - 1, 0), c: Math.max(nCols - 1, 0) } });
      if (cols) ws['!cols'] = cols;
    }
    function addSheet(nome, ws) { XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31)); }

    // ================= Premissas_Macro (câmbio, IPCA) =================
    const wsMacro = {};
    putS(wsMacro, 0, 0, 'Indicador'); putS(wsMacro, 0, 1, 'Valor');
    putS(wsMacro, 1, 0, 'Câmbio USD/BRL'); putN(wsMacro, 1, 1, cambios?.usd);
    putS(wsMacro, 2, 0, 'Câmbio EUR/BRL'); putN(wsMacro, 2, 1, cambios?.eur);
    putS(wsMacro, 3, 0, 'Câmbio GBP/BRL'); putN(wsMacro, 3, 1, cambios?.gbp);
    putS(wsMacro, 4, 0, 'IPCA anual (%)'); putN(wsMacro, 4, 1, ipcaAnualPct);
    finish(wsMacro, 5, 2, [{ wch: 22 }, { wch: 14 }]);
    addSheet('Premissas_Macro', wsMacro);
    const REF_CAMBIO = { usd: '$B$2', eur: '$B$3', gbp: '$B$4' };
    const REF_IPCA = 'Premissas_Macro!$B$5';

    // ================= Premissas_Receita + Receita =================
    const wsPremRec = {}, wsRec = {};
    const headerPremRec = ['Produto', 'Mercado', 'Moeda', 'Computa?', ...MESES.map(m => `Vol ${m}`), ...MESES.map(m => `Preço ${m}`)];
    headerPremRec.forEach((h, c) => putS(wsPremRec, 0, c, h));
    putS(wsRec, 0, 0, 'Produto'); putS(wsRec, 0, 1, 'Mercado'); putS(wsRec, 0, 2, 'Moeda');
    MESES.forEach((m, i) => putS(wsRec, 0, 3 + i, m));
    putS(wsRec, 0, 15, 'Total');

    const linhasReceitaRows = [];
    if ((d.receita.produtos || []).length > 0) {
      (d.receita.produtos || []).forEach(p => {
        const externo = p.mercado === 'externo';
        linhasReceitaRows.push({
          nome: p.nome, mercado: externo ? 'externo' : 'interno', moeda: externo ? (p.moeda || 'usd') : '', computa: 1,
          volumes: MESES.map((_, m) => parseNum(p.volumes?.[m])),
          precos: MESES.map((_, m) => externo ? parseNum(p.precoMoeda?.[m]) : parseNum(p.precos?.[m])),
        });
      });
    } else if (d.receita.linhas) {
      Object.entries(d.receita.linhas).forEach(([id, linha]) => {
        const def = LINHAS_RECEITA_RESORTS.find(l => l.id === id);
        const ehQtdValor = def?.tipo === 'qtd_valor';
        linhasReceitaRows.push({
          id, nome: def?.nome || id, mercado: 'interno', moeda: '', computa: id === LINHA_RECEITA_INFORMATIVA_RESORTS ? 0 : 1,
          volumes: MESES.map((_, m) => ehQtdValor ? parseNum(linha.quantidades?.[m]) : 1),
          precos: MESES.map((_, m) => ehQtdValor ? parseNum(linha.valoresUnit?.[m]) : parseNum(linha.valores?.[m])),
        });
      });
    }

    let rRec = 1;
    const linhaRowById = {};
    linhasReceitaRows.forEach(row => {
      putS(wsPremRec, rRec, 0, row.nome); putS(wsPremRec, rRec, 1, row.mercado); putS(wsPremRec, rRec, 2, row.moeda); putN(wsPremRec, rRec, 3, row.computa);
      row.volumes.forEach((v, m) => putN(wsPremRec, rRec, 4 + m, v));
      row.precos.forEach((v, m) => putN(wsPremRec, rRec, 16 + m, v));

      putS(wsRec, rRec, 0, row.nome);
      putS(wsRec, rRec, 1, row.mercado === 'externo' ? `Externo (${row.moeda.toUpperCase()})` : 'Interno');
      putS(wsRec, rRec, 2, row.moeda);
      const exRef = row.mercado === 'externo' ? REF_CAMBIO[row.moeda] : null;
      const excelRowRec = rRec + 1;
      for (let m = 0; m < 12; m++) {
        const volRef = `Premissas_Receita!${colL(4 + m)}${excelRowRec}`;
        const precoRef = `Premissas_Receita!${colL(16 + m)}${excelRowRec}`;
        putF(wsRec, rRec, 3 + m, exRef ? `${volRef}*${precoRef}*Premissas_Macro!${exRef}` : `${volRef}*${precoRef}`);
      }
      putF(wsRec, rRec, 15, `SUM(${colL(3)}${excelRowRec}:${colL(14)}${excelRowRec})`);
      if (row.id) linhaRowById[row.id] = rRec;
      rRec++;
    });
    const lastRecDataRow = Math.max(rRec, 2); // linha excel (1-based) da última linha de dado — mínimo 2 pra range nunca inverter
    finish(wsPremRec, rRec, 28, [{ wch: 26 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, ...MESES.map(() => ({ wch: 10 })), ...MESES.map(() => ({ wch: 10 }))]);
    addSheet('Premissas_Receita', wsPremRec);

    let r2 = rRec + 1;
    const rowTotalBruta = r2;
    putS(wsRec, r2, 0, 'Total Receita Bruta');
    for (let m = 0; m < 12; m++) putF(wsRec, r2, 3 + m, `SUMIF(Premissas_Receita!$D$2:$D$${lastRecDataRow},1,${colL(3 + m)}2:${colL(3 + m)}${lastRecDataRow})`);
    putF(wsRec, r2, 15, `SUM(${colL(3)}${r2 + 1}:${colL(14)}${r2 + 1})`);
    r2++;
    const rowVolumeKg = r2;
    putS(wsRec, r2, 0, 'Volume Total (kg) — todos os produtos');
    for (let m = 0; m < 12; m++) putF(wsRec, r2, 3 + m, `SUM(Premissas_Receita!${colL(4 + m)}2:${colL(4 + m)}${lastRecDataRow})*1000`);
    r2++;
    r2++; // linha em branco
    putS(wsRec, r2, 0, 'Deduções sobre a Receita'); r2++;
    const usaBaseLinhaIds = !!d.receita.linhas; // só Resorts — ver receitaBrutaPorMes
    const dedRows = [];
    (d.receita.deducoes || []).forEach(ded => {
      const rowPct = r2;
      putS(wsRec, r2, 0, `${ded.nome} (%)`);
      for (let m = 0; m < 12; m++) putN(wsRec, r2, 3 + m, ded.pcts?.[m]);
      r2++;
      const rowValor = r2;
      putS(wsRec, r2, 0, `${ded.nome} (R$)`);
      for (let m = 0; m < 12; m++) {
        const baseRef = (usaBaseLinhaIds && ded.baseLinhaIds?.length)
          ? `(${ded.baseLinhaIds.map(id => linhaRowById[id] !== undefined ? `${colL(3 + m)}${linhaRowById[id] + 1}` : '0').join('+')})`
          : `${colL(3 + m)}${rowTotalBruta + 1}`;
        putF(wsRec, r2, 3 + m, `${baseRef}*${colL(3 + m)}${rowPct + 1}/100`);
      }
      putF(wsRec, r2, 15, `SUM(${colL(3)}${r2 + 1}:${colL(14)}${r2 + 1})`);
      dedRows.push(rowValor);
      r2++;
    });
    const rowTotalDeducoes = r2;
    putS(wsRec, r2, 0, 'Total Deduções');
    for (let m = 0; m < 12; m++) putF(wsRec, r2, 3 + m, dedRows.length ? dedRows.map(rr => `${colL(3 + m)}${rr + 1}`).join('+') : '0');
    r2++;
    const rowReceitaLiquida = r2;
    putS(wsRec, r2, 0, '(=) Receita Líquida');
    for (let m = 0; m < 12; m++) putF(wsRec, r2, 3 + m, `${colL(3 + m)}${rowTotalBruta + 1}-${colL(3 + m)}${rowTotalDeducoes + 1}`);
    r2++;
    finish(wsRec, r2, 16, [{ wch: 26 }, { wch: 14 }, { wch: 8 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }]);
    addSheet('Receita', wsRec);

    // ================= Premissas_Custos + Custos_e_Despesas =================
    const PC = { CC: 0, CCNOME: 1, CCTIPO: 2, PACID: 3, PACNOME: 4, CONTACOD: 5, CONTANOME: 6, SUB: 7, PREMISSA: 8, BASETIPO: 9, UNIDMED: 10, PAGDIF: 11, REAJTIPO: 12, REAJMES: 13, QTD: 14, VUNIT: 26, VBASE: 38, BMANUAL: 50, PERC: 62, VPAG: 74 };
    const CD = { CC: 0, CCNOME: 1, CCTIPO: 2, PACID: 3, PACNOME: 4, CONTACOD: 5, CONTANOME: 6, SUB: 7, MES: 8, TOTAL: 20, CAIXA: 21 };
    const wsPremCus = {}, wsCus = {};
    const headerPC = ['CC Código', 'CC Nome', 'CC Tipo', 'Pacote ID', 'Pacote Nome', 'Conta Código', 'Conta Nome', 'Sublinha', 'Premissa', 'BaseTipo', 'UnidadeMedida', 'PagDiferente', 'ReajusteTipo', 'ReajusteMês',
      ...MESES.map(m => `Qtd ${m}`), ...MESES.map(m => `ValorUnit ${m}`), ...MESES.map(m => `ValorBase ${m}`), ...MESES.map(m => `BaseManual ${m}`), ...MESES.map(m => `Percentual ${m}`), ...MESES.map(m => `ValorPagamento ${m}`)];
    headerPC.forEach((h, c) => putS(wsPremCus, 0, c, h));
    const headerCD = ['CC Código', 'CC Nome', 'CC Tipo', 'Pacote ID', 'Pacote Nome', 'Conta Código', 'Conta Nome', 'Sublinha', ...MESES, 'Total', ...MESES.map(m => `Caixa ${m}`)];
    headerCD.forEach((h, c) => putS(wsCus, 0, c, h));

    let rc = 1;
    Object.entries(d.custos.linhas || {}).forEach(([chave, contaRaw]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = (refU.ccs || []).find(c => c.codigo === ccCodigo);
      if (!cc) return;
      const conta = refU.todasContas?.[contaCodigo];
      const pacote = (refU.pacotes || []).find(p => p.id === conta?.pacoteId);
      normalizarConta(contaRaw).sublinhas.forEach(sub => {
        const semNada = ['valores', 'quantidades', 'valoresUnit', 'baseManual', 'percentuais'].every(campo => (sub[campo] || []).every(v => !parseNum(v)));
        if (semNada) return;

        putS(wsPremCus, rc, PC.CC, ccCodigo); putS(wsPremCus, rc, PC.CCNOME, cc.nome); putS(wsPremCus, rc, PC.CCTIPO, cc.tipo);
        putS(wsPremCus, rc, PC.PACID, conta?.pacoteId || ''); putS(wsPremCus, rc, PC.PACNOME, pacote?.nome || 'Sem pacote');
        putS(wsPremCus, rc, PC.CONTACOD, contaCodigo); putS(wsPremCus, rc, PC.CONTANOME, conta?.nome || contaCodigo); putS(wsPremCus, rc, PC.SUB, sub.descricao || '');
        putS(wsPremCus, rc, PC.PREMISSA, sub.premissaTipo); putS(wsPremCus, rc, PC.BASETIPO, sub.baseTipo || ''); putS(wsPremCus, rc, PC.UNIDMED, sub.unidadeMedida || '');
        putN(wsPremCus, rc, PC.PAGDIF, sub.pagamentoDiferente ? 1 : 0);
        putS(wsPremCus, rc, PC.REAJTIPO, sub.reajusteInflacaoTipo || 'mensal'); putS(wsPremCus, rc, PC.REAJMES, sub.reajusteInflacaoMes || '');
        for (let m = 0; m < 12; m++) {
          putN(wsPremCus, rc, PC.QTD + m, sub.quantidades?.[m]);
          putN(wsPremCus, rc, PC.VUNIT + m, sub.valoresUnit?.[m]);
          putN(wsPremCus, rc, PC.VBASE + m, sub.valores?.[m]);
          putN(wsPremCus, rc, PC.BMANUAL + m, sub.baseManual?.[m]);
          putN(wsPremCus, rc, PC.PERC + m, sub.percentuais?.[m]);
          putN(wsPremCus, rc, PC.VPAG + m, sub.valoresPagamento?.[m]);
        }

        putS(wsCus, rc, CD.CC, ccCodigo); putS(wsCus, rc, CD.CCNOME, cc.nome); putS(wsCus, rc, CD.CCTIPO, cc.tipo);
        putS(wsCus, rc, CD.PACID, conta?.pacoteId || ''); putS(wsCus, rc, CD.PACNOME, pacote?.nome || 'Sem pacote');
        putS(wsCus, rc, CD.CONTACOD, contaCodigo); putS(wsCus, rc, CD.CONTANOME, conta?.nome || contaCodigo); putS(wsCus, rc, CD.SUB, sub.descricao || '');

        const excelRow = rc + 1;
        const idxReajusteMes = sub.reajusteInflacaoMes ? MESES.indexOf(sub.reajusteInflacaoMes) : -1;
        for (let m = 0; m < 12; m++) {
          let f;
          if (sub.premissaTipo === 'qtd_valor') {
            f = `Premissas_Custos!${colL(PC.QTD + m)}${excelRow}*Premissas_Custos!${colL(PC.VUNIT + m)}${excelRow}`;
          } else if (sub.premissaTipo === 'rateio') {
            const baseCel = sub.baseTipo === 'receita_bruta' ? `Receita!${colL(3 + m)}${rowTotalBruta + 1}`
              : sub.baseTipo === 'receita_liquida' ? `Receita!${colL(3 + m)}${rowReceitaLiquida + 1}`
              : `Premissas_Custos!${colL(PC.BMANUAL + m)}${excelRow}`;
            f = `${baseCel}*Premissas_Custos!${colL(PC.PERC + m)}${excelRow}/100`;
          } else if (sub.premissaTipo === 'reajuste_inflacao') {
            const baseCel = `Premissas_Custos!${colL(PC.VBASE + m)}${excelRow}`;
            if (sub.reajusteInflacaoTipo === 'unico') {
              f = (idxReajusteMes >= 0 && m >= idxReajusteMes) ? `${baseCel}*(1+${REF_IPCA}/100)` : `${baseCel}`;
            } else {
              f = `${baseCel}*(1+${REF_IPCA}/100)^(${m + 1}/12)`;
            }
          } else if (sub.premissaTipo === 'custo_por_kg') {
            f = `Receita!${colL(3 + m)}${rowVolumeKg + 1}*Premissas_Custos!${colL(PC.VUNIT + m)}${excelRow}`;
          } else {
            f = `Premissas_Custos!${colL(PC.VBASE + m)}${excelRow}`;
          }
          putF(wsCus, rc, CD.MES + m, f);
        }
        putF(wsCus, rc, CD.TOTAL, `SUM(${colL(CD.MES)}${excelRow}:${colL(CD.MES + 11)}${excelRow})`);
        for (let m = 0; m < 12; m++) {
          putF(wsCus, rc, CD.CAIXA + m, sub.pagamentoDiferente ? `Premissas_Custos!${colL(PC.VPAG + m)}${excelRow}` : `${colL(CD.MES + m)}${excelRow}`);
        }
        rc++;
      });
    });
    finish(wsPremCus, rc, 86, undefined);
    addSheet('Premissas_Custos', wsPremCus);
    const lastCusRow = Math.max(rc, 2);
    finish(wsCus, rc, 33, undefined);
    addSheet('Custos_e_Despesas', wsCus);
    function rngCus(col) { return `Custos_e_Despesas!${colL(col)}2:${colL(col)}${lastCusRow}`; }

    // ================= Premissas_Pessoal + Pessoal_Folha =================
    const pp = d.custos.premissasPessoal || {};
    const wsPremPes = {};
    putS(wsPremPes, 0, 0, 'Premissa'); putS(wsPremPes, 0, 1, 'Valor');
    const encargosDefs = [
      ['inssPct', 'INSS (%)'], ['fgtsPct', 'FGTS (%)'], ['feriasPct', 'Férias (%)'], ['decimoTerceiroPct', '13º salário (%)'],
      ['meritocraciaPct', 'Meritocracia (%)'], ['valeTransporteValor', 'Vale eletrônico (R$/func.)'], ['cestaBasicaValor', 'Cesta básica (R$/func.)'],
      ['planoSaudeValor', 'Assistência médica (R$/func.)'], ['outrosBeneficiosValor', 'Outros benefícios (R$/func.)'],
    ];
    let rp = 1;
    const refEncargo = {};
    encargosDefs.forEach(([campo, label]) => { putS(wsPremPes, rp, 0, label); putN(wsPremPes, rp, 1, pp[campo]); refEncargo[campo] = rp; rp++; });
    const dissidioMesIdx = pp.dissidioMes ? MESES.indexOf(pp.dissidioMes) : -1;
    putS(wsPremPes, rp, 0, 'Dissídio — mês'); putS(wsPremPes, rp, 1, pp.dissidioMes || ''); rp++;
    const rowDissidioPct = rp;
    putS(wsPremPes, rp, 0, 'Dissídio — % reajuste'); putN(wsPremPes, rp, 1, pp.dissidioPct); rp++;
    rp += 2; // 2 linhas em branco antes da tabela de funcionários
    const headerFunc = ['Nome', 'CC', 'Cargo', 'Salário', 'Mês Admissão', ...MESES.map(m => `Salário Efetivo ${m}`), ...MESES.map(m => `Ativo ${m}`)];
    headerFunc.forEach((h, c) => putS(wsPremPes, rp, c, h));
    rp++;
    const funcionarios = d.custos.funcionarios || [];
    const rowsFuncByRow = [];
    funcionarios.forEach(f => {
      const idxAdm = f.mesAdmissao ? MESES.indexOf(f.mesAdmissao) : -1;
      putS(wsPremPes, rp, 0, f.nome); putS(wsPremPes, rp, 1, f.ccCodigo); putS(wsPremPes, rp, 2, f.cargo || '');
      putN(wsPremPes, rp, 3, f.salario); putS(wsPremPes, rp, 4, f.mesAdmissao || '');
      const excelRow = rp + 1;
      for (let m = 0; m < 12; m++) {
        const ativo = idxAdm === -1 || idxAdm <= m;
        if (ativo) {
          const dissidioAtivo = dissidioMesIdx >= 0 && m >= dissidioMesIdx;
          putF(wsPremPes, rp, 5 + m, dissidioAtivo ? `$D$${excelRow}*(1+$B$${rowDissidioPct + 1}/100)` : `$D$${excelRow}`);
        } else {
          putN(wsPremPes, rp, 5 + m, 0);
        }
        putN(wsPremPes, rp, 17 + m, ativo ? 1 : 0);
      }
      rowsFuncByRow.push({ row: rp, cc: f.ccCodigo });
      rp++;
    });
    finish(wsPremPes, rp, 29, undefined);
    addSheet('Premissas_Pessoal', wsPremPes);

    const wsFolha = {};
    putS(wsFolha, 0, 0, 'Centro de Custo'); putS(wsFolha, 0, 1, 'CC Tipo'); putS(wsFolha, 0, 2, 'Componente');
    MESES.forEach((m, i) => putS(wsFolha, 0, 3 + i, m)); putS(wsFolha, 0, 15, 'Total');
    let rf = 1;
    const folhaRowsByCC = {};
    (refU.ccs || []).forEach(cc => {
      const funcsCC = rowsFuncByRow.filter(x => x.cc === cc.codigo);
      if (funcsCC.length === 0) return;
      function addFolhaRow(label, formulaPerMonth) {
        const row = rf;
        putS(wsFolha, rf, 0, cc.codigo); putS(wsFolha, rf, 1, cc.tipo); putS(wsFolha, rf, 2, label);
        for (let m = 0; m < 12; m++) putF(wsFolha, rf, 3 + m, formulaPerMonth(m));
        putF(wsFolha, rf, 15, `SUM(${colL(3)}${rf + 1}:${colL(14)}${rf + 1})`);
        rf++;
        return row;
      }
      const rowSal = addFolhaRow('Salários', m => funcsCC.map(x => `Premissas_Pessoal!${colL(5 + m)}${x.row + 1}`).join('+'));
      const rowEnc = addFolhaRow('Encargos (INSS+FGTS+Férias)', m => `${colL(3 + m)}${rowSal + 1}*(Premissas_Pessoal!$B$${refEncargo.inssPct + 1}+Premissas_Pessoal!$B$${refEncargo.fgtsPct + 1}+Premissas_Pessoal!$B$${refEncargo.feriasPct + 1})/100`);
      const row13 = addFolhaRow('13º salário (provisão)', m => `${colL(3 + m)}${rowSal + 1}*Premissas_Pessoal!$B$${refEncargo.decimoTerceiroPct + 1}/100`);
      const rowMerit = addFolhaRow('Meritocracia', m => `${colL(3 + m)}${rowSal + 1}*Premissas_Pessoal!$B$${refEncargo.meritocraciaPct + 1}/100`);
      const rowBenef = addFolhaRow('Benefícios', m => `(${funcsCC.map(x => `Premissas_Pessoal!${colL(17 + m)}${x.row + 1}`).join('+')})*(Premissas_Pessoal!$B$${refEncargo.valeTransporteValor + 1}+Premissas_Pessoal!$B$${refEncargo.cestaBasicaValor + 1}+Premissas_Pessoal!$B$${refEncargo.planoSaudeValor + 1}+Premissas_Pessoal!$B$${refEncargo.outrosBeneficiosValor + 1})`);
      const rowTotal = addFolhaRow('Total da folha (CLT)', m => `${colL(3 + m)}${rowSal + 1}+${colL(3 + m)}${rowEnc + 1}+${colL(3 + m)}${row13 + 1}+${colL(3 + m)}${rowMerit + 1}+${colL(3 + m)}${rowBenef + 1}`);
      folhaRowsByCC[cc.codigo] = { cc, totalRow: rowTotal, dec13Row: row13 };
    });
    finish(wsFolha, rf, 16, undefined);
    addSheet('Pessoal_Folha', wsFolha);

    // ================= DRE_Mensal =================
    const wsDre = {};
    putS(wsDre, 0, 0, 'Linha'); MESES.forEach((m, i) => putS(wsDre, 0, 1 + i, m)); putS(wsDre, 0, 13, 'Total');
    let rd = 1;
    function addDreRow(label, formulaPerMonth) {
      const row = rd; putS(wsDre, rd, 0, label);
      for (let m = 0; m < 12; m++) putF(wsDre, rd, 1 + m, formulaPerMonth(m));
      putF(wsDre, rd, 13, `SUM(${colL(1)}${rd + 1}:${colL(12)}${rd + 1})`);
      rd++; return row;
    }
    function addDreRowValues(label, valores) {
      const row = rd; putS(wsDre, rd, 0, label);
      valores.forEach((v, m) => putN(wsDre, rd, 1 + m, v));
      putF(wsDre, rd, 13, `SUM(${colL(1)}${rd + 1}:${colL(12)}${rd + 1})`);
      rd++; return row;
    }
    addDreRow('Receita Bruta', m => `Receita!${colL(3 + m)}${rowTotalBruta + 1}`);
    addDreRow('(-) Deduções', m => `-Receita!${colL(3 + m)}${rowTotalDeducoes + 1}`);
    const rowRecLiq = addDreRow('(=) Receita Líquida', m => `Receita!${colL(3 + m)}${rowReceitaLiquida + 1}`);
    const folhaProducao = Object.values(folhaRowsByCC).filter(x => x.cc.tipo === 'producao');
    const folhaDespesa = Object.values(folhaRowsByCC).filter(x => x.cc.tipo === 'despesa');
    const rowCpv = addDreRow('(-) CPV', m => {
      const custosParte = `SUMIFS(${rngCus(CD.MES + m)},${rngCus(CD.CCTIPO)},"producao")`;
      const folhaParte = folhaProducao.length ? folhaProducao.map(x => `Pessoal_Folha!${colL(3 + m)}${x.totalRow + 1}`).join('+') : '0';
      return `-((${custosParte})+(${folhaParte}))`;
    });
    const rowLucroBruto = addDreRow('(=) Lucro Bruto', m => `${colL(1 + m)}${rowRecLiq + 1}+${colL(1 + m)}${rowCpv + 1}`);
    const rowDespesas = addDreRow('(-) Despesas Operacionais', m => {
      const custosParte = `SUMIFS(${rngCus(CD.MES + m)},${rngCus(CD.CCTIPO)},"despesa",${rngCus(CD.PACID)},"<>depreciacao")`;
      const folhaParte = folhaDespesa.length ? folhaDespesa.map(x => `Pessoal_Folha!${colL(3 + m)}${x.totalRow + 1}`).join('+') : '0';
      return `-((${custosParte})+(${folhaParte}))`;
    });
    const rowEbitda = addDreRow('(=) EBITDA', m => `${colL(1 + m)}${rowLucroBruto + 1}+${colL(1 + m)}${rowDespesas + 1}`);
    const rowDA = addDreRow('(-) Depreciação e Amortização', m => `-SUMIFS(${rngCus(CD.MES + m)},${rngCus(CD.CCTIPO)},"despesa",${rngCus(CD.PACID)},"depreciacao")`);
    const rowResFin = addDreRowValues('(+/-) Resultado Financeiro (premissa)', MESES.map((_, m) => parseNum(d.resultado?.receitaFinanceira?.[m]) - parseNum(d.resultado?.despesaFinanceira?.[m])));
    const rowOutras = addDreRowValues('(+/-) Outras Receitas e Despesas (premissa)', MESES.map((_, m) => parseNum(d.resultado?.outrasReceitasDespesas?.[m])));
    const rowAliq = rd; putS(wsDre, rd, 0, 'Alíquota IR/CSLL (%) — premissa');
    for (let m = 0; m < 12; m++) putN(wsDre, rd, 1 + m, d.resultado?.aliquotaIR ?? 34);
    rd++;
    const rowEbt = addDreRow('(=) EBT (antes do IR)', m => `${colL(1 + m)}${rowEbitda + 1}+${colL(1 + m)}${rowDA + 1}+${colL(1 + m)}${rowResFin + 1}+${colL(1 + m)}${rowOutras + 1}`);
    const rowIrcsl = addDreRow('(-) IR/CSLL', m => `-IF(${colL(1 + m)}${rowEbt + 1}>0,${colL(1 + m)}${rowEbt + 1}*${colL(1 + m)}${rowAliq + 1}/100,0)`);
    addDreRow('(=) Lucro Líquido', m => `${colL(1 + m)}${rowEbt + 1}+${colL(1 + m)}${rowIrcsl + 1}`);
    finish(wsDre, rd, 14, [{ wch: 36 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }]);
    addSheet('DRE_Mensal', wsDre);

    // ================= Kgiro_FC_Operacional (método indireto) =================
    const wsKg = {};
    putS(wsKg, 0, 0, 'Linha'); MESES.forEach((m, i) => putS(wsKg, 0, 1 + i, m)); putS(wsKg, 0, 13, 'Total');
    let rk = 1;
    function addKgRow(label, formulaPerMonth) {
      const row = rk; putS(wsKg, rk, 0, label);
      for (let m = 0; m < 12; m++) putF(wsKg, rk, 1 + m, formulaPerMonth(m));
      putF(wsKg, rk, 13, `SUM(${colL(1)}${rk + 1}:${colL(12)}${rk + 1})`);
      rk++; return row;
    }
    const saldos = saldosAberturaFc(d);
    const rowArIni = rk; putS(wsKg, rk, 0, 'Saldo inicial — Contas a Receber (premissa)'); putN(wsKg, rk, 1, saldos.arInicial); rk++;
    const rowApIni = rk; putS(wsKg, rk, 0, 'Saldo inicial — Contas a Pagar (premissa)'); putN(wsKg, rk, 1, saldos.apInicial); rk++;
    const rowEstIni = rk; putS(wsKg, rk, 0, 'Saldo inicial — Estoque (premissa)'); putN(wsKg, rk, 1, saldos.estoqueInicial); rk++;
    const cg = d.capitalGiro || {};
    const rowPrazoReceb = rk; putS(wsKg, rk, 0, 'Prazo de Recebimento (dias, premissa)'); for (let m = 0; m < 12; m++) putN(wsKg, rk, 1 + m, cg.prazoRecebimento?.[m]); rk++;
    const rowPrazoPag = rk; putS(wsKg, rk, 0, 'Prazo de Pagamento (dias, premissa)'); for (let m = 0; m < 12; m++) putN(wsKg, rk, 1 + m, cg.prazoPagamento?.[m]); rk++;
    const rowGiroEst = rk; putS(wsKg, rk, 0, 'Giro de Estoque (dias, premissa)'); for (let m = 0; m < 12; m++) putN(wsKg, rk, 1 + m, cg.giroEstoque?.[m]); rk++;
    const rowAr = rk; putS(wsKg, rk, 0, 'Contas a Receber (saldo)'); for (let m = 0; m < 12; m++) putF(wsKg, rk, 1 + m, `DRE_Mensal!${colL(1 + m)}${rowRecLiq + 1}*${colL(1 + m)}${rowPrazoReceb + 1}/30`); rk++;
    const rowAp = rk; putS(wsKg, rk, 0, 'Contas a Pagar (saldo)'); for (let m = 0; m < 12; m++) putF(wsKg, rk, 1 + m, `-DRE_Mensal!${colL(1 + m)}${rowCpv + 1}*${colL(1 + m)}${rowPrazoPag + 1}/30`); rk++;
    const rowEst = rk; putS(wsKg, rk, 0, 'Estoque (saldo)'); for (let m = 0; m < 12; m++) putF(wsKg, rk, 1 + m, `-DRE_Mensal!${colL(1 + m)}${rowCpv + 1}*${colL(1 + m)}${rowGiroEst + 1}/30`); rk++;
    const rowVarGiro = addKgRow('(+/-) Variação de Capital de Giro', m => {
      const arCur = `${colL(1 + m)}${rowAr + 1}`, arPrev = m === 0 ? `$B$${rowArIni + 1}` : `${colL(m)}${rowAr + 1}`;
      const apCur = `${colL(1 + m)}${rowAp + 1}`, apPrev = m === 0 ? `$B$${rowApIni + 1}` : `${colL(m)}${rowAp + 1}`;
      const estCur = `${colL(1 + m)}${rowEst + 1}`, estPrev = m === 0 ? `$B$${rowEstIni + 1}` : `${colL(m)}${rowEst + 1}`;
      return `-(${arCur}-${arPrev})-(${estCur}-${estPrev})+(${apCur}-${apPrev})`;
    });
    const folhaTodos = Object.values(folhaRowsByCC);
    const rowDec13Total = addKgRow('13º salário — provisão total (referência)', m => folhaTodos.length ? folhaTodos.map(x => `Pessoal_Folha!${colL(3 + m)}${x.dec13Row + 1}`).join('+') : '0');
    const rowPag13 = addKgRow('Pagamento do 13º (nov/dez, metade cada)', m => (m === 10 || m === 11) ? `SUM(${colL(1)}${rowDec13Total + 1}:${colL(12)}${rowDec13Total + 1})/2` : '0');
    const rowAjuste13 = addKgRow('(+/-) Ajuste 13º (competência × caixa)', m => `${colL(1 + m)}${rowDec13Total + 1}-${colL(1 + m)}${rowPag13 + 1}`);
    const rowDespesasCaixa = addKgRow('Despesas — caixa (competência × caixa)', m => {
      const custosParte = `SUMIFS(${rngCus(CD.CAIXA + m)},${rngCus(CD.CCTIPO)},"despesa",${rngCus(CD.PACID)},"<>depreciacao")`;
      const folhaParte = folhaDespesa.length ? folhaDespesa.map(x => `Pessoal_Folha!${colL(3 + m)}${x.totalRow + 1}`).join('+') : '0';
      return `(${custosParte})+(${folhaParte})`;
    });
    const rowAjustePag = addKgRow('(+/-) Ajuste de Pagamento (competência × caixa)', m => `-DRE_Mensal!${colL(1 + m)}${rowDespesas + 1}-${colL(1 + m)}${rowDespesasCaixa + 1}`);
    const rowIrcslProp = addKgRow('(-) IR/CSLL proporcional', m => `DRE_Mensal!${colL(1 + m)}${rowIrcsl + 1}`);
    addKgRow('(=) FC Operacional (indireto)', m => `DRE_Mensal!${colL(1 + m)}${rowEbitda + 1}+${colL(1 + m)}${rowIrcslProp + 1}+${colL(1 + m)}${rowVarGiro + 1}+${colL(1 + m)}${rowAjuste13 + 1}+${colL(1 + m)}${rowAjustePag + 1}`);
    finish(wsKg, rk, 14, [{ wch: 40 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }]);
    addSheet('Kgiro_FC_Operacional', wsKg);

    // ================= FC_Direto =================
    const wsFd = {};
    putS(wsFd, 0, 0, 'Linha'); MESES.forEach((m, i) => putS(wsFd, 0, 1 + i, m)); putS(wsFd, 0, 13, 'Total');
    let rfd = 1;
    function addFdRow(label, formulaPerMonth) {
      const row = rfd; putS(wsFd, rfd, 0, label);
      for (let m = 0; m < 12; m++) putF(wsFd, rfd, 1 + m, formulaPerMonth(m));
      putF(wsFd, rfd, 13, `SUM(${colL(1)}${rfd + 1}:${colL(12)}${rfd + 1})`);
      rfd++; return row;
    }
    addFdRow('Recebimentos de Clientes', m => {
      const arCur = `Kgiro_FC_Operacional!${colL(1 + m)}${rowAr + 1}`;
      const arPrev = m === 0 ? `Kgiro_FC_Operacional!$B$${rowArIni + 1}` : `Kgiro_FC_Operacional!${colL(m)}${rowAr + 1}`;
      return `DRE_Mensal!${colL(1 + m)}${rowRecLiq + 1}-(${arCur}-${arPrev})`;
    });
    addFdRow('(-) Pagamentos a Fornecedores', m => {
      const estCur = `Kgiro_FC_Operacional!${colL(1 + m)}${rowEst + 1}`;
      const estPrev = m === 0 ? `Kgiro_FC_Operacional!$B$${rowEstIni + 1}` : `Kgiro_FC_Operacional!${colL(m)}${rowEst + 1}`;
      const apCur = `Kgiro_FC_Operacional!${colL(1 + m)}${rowAp + 1}`;
      const apPrev = m === 0 ? `Kgiro_FC_Operacional!$B$${rowApIni + 1}` : `Kgiro_FC_Operacional!${colL(m)}${rowAp + 1}`;
      return `-(-DRE_Mensal!${colL(1 + m)}${rowCpv + 1}+(${estCur}-${estPrev})-(${apCur}-${apPrev}))`;
    });
    addFdRow('(-) Pagamentos de Pessoal', m => {
      const totalFolha = folhaTodos.length ? folhaTodos.map(x => `Pessoal_Folha!${colL(3 + m)}${x.totalRow + 1}`).join('+') : '0';
      return `-((${totalFolha})-(Kgiro_FC_Operacional!${colL(1 + m)}${rowDec13Total + 1})+(Kgiro_FC_Operacional!${colL(1 + m)}${rowPag13 + 1}))`;
    });
    addFdRow('(-) Pagamentos de Despesas', m => `-Kgiro_FC_Operacional!${colL(1 + m)}${rowDespesasCaixa + 1}`);
    const rowIrcslFd = addFdRow('(-) IR/CSLL', m => `DRE_Mensal!${colL(1 + m)}${rowIrcsl + 1}`);
    // Pagamentos Manuais (só Têxtil, ver PLANO_CONTAS_PAGAMENTOS_TEXTIL) — valor
    // calculado (simplificação de escopo, ver nota no topo da função).
    const pagamentosManuaisMes = cg.pagamentosManuais ? computePagamentosManuaisMes(cg.pagamentosManuais) : MESES.map(() => 0);
    const rowPagManual = rfd; putS(wsFd, rfd, 0, '(-) Pagamentos Manuais (Têxtil, valor calculado)');
    pagamentosManuaisMes.forEach((v, m) => putN(wsFd, rfd, 1 + m, -parseNum(v)));
    putF(wsFd, rfd, 13, `SUM(${colL(1)}${rfd + 1}:${colL(12)}${rfd + 1})`);
    const linhasSomarFd = [1, 2, 3, 4, rowIrcslFd, rowPagManual]; // linhas já escritas acima (0-based rows)
    rfd++;
    addFdRow('(=) FC Operacional (direto)', m => linhasSomarFd.map(r => `${colL(1 + m)}${r + 1}`).join('+'));
    finish(wsFd, rfd, 14, [{ wch: 40 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }]);
    addSheet('FC_Direto', wsFd);

    // ================= CAPEX, FC Financiamentos, Provisões, Balanço, Plano 5Y =================
    // Continuam como valor calculado (digitação direta hoje, sem racional de
    // fórmula próprio pra replicar — ver nota no topo da função).
    const linhasCapex = [['Categoria', 'Projeto', 'Mês', 'Valor', 'Justificativa']];
    (d.capex.projetos || []).forEach(p => {
      if (!parseNum(p.valor)) return;
      linhasCapex.push([CATEGORIAS_CAPEX.find(c => c.id === p.categoria)?.nome || p.categoria, p.nome, p.mes || '', parseNum(p.valor), p.justificativa || '']);
    });
    const wsCapex = XLSX.utils.aoa_to_sheet(linhasCapex);
    wsCapex['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsCapex, 'CAPEX');

    const linhasFin = [['Banco/Linha', 'Métrica', ...MESES, 'Total']];
    (d.fcFinanciamentos?.linhas || []).forEach(l => {
      const nomeLinha = `${l.banco || '(sem banco)'} — ${l.linha || ''}`;
      [['Captações', l.captacoes], ['Amortizações', l.amortizacoes], ['Juros Pagos', l.jurosPagos], ['Variação Cambial', l.variacaoCambial], ['Provisão Desp. Financeira', l.provisaoDespesaFinanceira]]
        .forEach(([metrica, arr]) => {
          const vals = MESES.map((_, m) => parseNum(arr?.[m]));
          if (vals.every(v => v === 0)) return;
          linhasFin.push([nomeLinha, metrica, ...vals, vals.reduce((a, v) => a + v, 0)]);
        });
    });
    (d.fcFinanciamentos?.movimentacoesAcionistas || []).forEach(mv => {
      const vals = MESES.map((_, m) => parseNum(mv.valores?.[m]));
      if (vals.every(v => v === 0)) return;
      linhasFin.push(['Movimentação de acionistas', mv.nome, ...vals, vals.reduce((a, v) => a + v, 0)]);
    });
    const wsFin = XLSX.utils.aoa_to_sheet(linhasFin);
    wsFin['!cols'] = [{ wch: 26 }, { wch: 22 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsFin, 'FC_Financiamentos');

    const linhasProv = [['Linha', ...MESES, 'Total']];
    [['Inadimplência (%)', d.provisoes?.inadimplencia], ['Contingências (R$)', d.provisoes?.contingencias], ['Perdas (R$)', d.provisoes?.perdas]].forEach(([label, arr]) => {
      const vals = MESES.map((_, m) => parseNum(arr?.[m]));
      linhasProv.push([label, ...vals, vals.reduce((a, v) => a + v, 0)]);
    });
    const wsProv = XLSX.utils.aoa_to_sheet(linhasProv);
    wsProv['!cols'] = [{ wch: 20 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsProv, 'Provisoes');

    const b = d.balanco || {};
    const linhasBal = [['Item', 'Valor', 'Justificativa']];
    linhasBal.push(
      ['Caixa inicial', parseNum(b.caixaInicial), ''],
      ['Imobilizado inicial', parseNum(b.imobilizadoInicial), ''],
      ['Depreciação acumulada inicial', parseNum(b.depreciacaoAcumuladaInicial), ''],
      ['Contas a receber inicial', parseNum(b.contasAReceberInicial), ''],
      ['Estoque inicial', parseNum(b.estoqueInicial), ''],
      ['Contas a pagar inicial', parseNum(b.contasAPagarInicial), ''],
      ['Saldo inicial de dívida', parseNum(b.emprestimos?.saldoInicial), b.emprestimos?.justificativa || ''],
    );
    const wsBal = XLSX.utils.aoa_to_sheet(linhasBal);
    wsBal['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsBal, 'Balanco_Patrimonial');

    const dreU = computeDRE(d, refU, ipcaAnualPct, cambios);
    const plano5y = computePlano5Y(dreU, d.plano5y?.anos || {});
    const linhasP5y = [['Linha', 2027, ...ANOS_PLANO_5Y]];
    [['receitaLiquida', 'Receita Líquida'], ['cpv', 'CPV'], ['lucroBruto', 'Lucro Bruto'], ['despesasSemDA', 'Despesas Operacionais'], ['ebitda', 'EBITDA'], ['depreciacao', 'Depreciação e Amortização'], ['lucroLiquido', 'Lucro Líquido']]
      .forEach(([campo, label]) => linhasP5y.push([label, ...[2027, ...ANOS_PLANO_5Y].map(ano => plano5y[ano]?.[campo] ?? '')]));
    const wsP5y = XLSX.utils.aoa_to_sheet(linhasP5y);
    wsP5y['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsP5y, 'Plano_5Y');

    XLSX.writeFile(wb, `Orcamento_2027_${uObj.nome.replace(/\s/g, '_')}_ModeloCompleto.xlsx`);
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

        const totais = UNIDADES_PARA_TOTAL_GRUPO.reduce((acc, u) => {
          const d = statusUnidades[u.id];
          const t = d ? dreDaUnidade(d, u.id, ipcaAnualPct, cambios) : dreDaUnidade(emptyFormData(u.id), u.id, ipcaAnualPct, cambios);
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
          const t = d ? dreDaUnidade(d, u.id, ipcaAnualPct, cambios) : dreDaUnidade(emptyFormData(u.id), u.id, ipcaAnualPct, cambios);
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
        const fd = computeFluxoIndiretoMensal(dados, dre, refUnidadeAtual, ipcaAnualPct);
        const fcd = computeFluxoCaixaDiretoMensal(dados, dre, refUnidadeAtual, ipcaAnualPct);
        const totalFcOperacional = fd.fcOperacionalMes.reduce((a, v) => a + v, 0);
        const totalIrcslAno = fd.ircslMes.reduce((a, v) => a + v, 0);
        const totalGiroAno = fd.variacaoGiroMes.reduce((a, v) => a + v, 0);
        const totalAjuste13Ano = fd.ajuste13Mes.reduce((a, v) => a + v, 0);
        const totalAjustePagamentoAno = fd.ajustePagamentoMes.reduce((a, v) => a + v, 0);

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
          { label: 'Outros Ajustes', valor: totalAjuste13Ano + totalAjustePagamentoAno, tipo: 'incremento' },
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
          { label: '(+/-) Ajuste de Pagamento (competência × caixa)', valoresMensal: fd.ajustePagamentoMes, totalValor: fd.ajustePagamentoMes.reduce((a, v) => a + v, 0) },
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
          updateConta={updateConta} updateSublinha={updateSublinha} addSublinha={addSublinha} removeSublinha={removeSublinha}
          addDetalhe={addDetalhe} updateDetalhe={updateDetalhe} removeDetalhe={removeDetalhe}
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
          exportarExcel={exportarExcel} exportarExcelCalculo={exportarExcelCalculo} solicitarResumoExecutivo={solicitarResumoExecutivo}
          abrirVersao={abrirVersao}
        />
      ) : (
        <VisaoFPA
          statusUnidades={statusUnidades} aguardandoLiberacaoPorUnidade={aguardandoLiberacaoPorUnidade} liberarReenvioUnidade={liberarReenvioUnidade}
          backlog={backlog} unidadeDrill={unidadeDrill} abrirDrill={abrirDrill}
          versoesDrill={versoesDrill} exportarExcel={exportarExcel} exportarExcelCalculo={exportarExcelCalculo} solicitarResumoExecutivo={solicitarResumoExecutivo}
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
          ipcaAnualPct={ipcaAnualPct} cambios={cambios}
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
    updateConta, updateSublinha, addSublinha, removeSublinha, addDetalhe, updateDetalhe, removeDetalhe,
    addFuncionario, updateFuncionario, removeFuncionario, updatePremissaPessoal, importarFuncionariosLote,
    addProjeto, updateProjeto, removeProjeto,
    addLinhaFinanciamento, updateLinhaFinanciamento, removeLinhaFinanciamento, updateMovimentacaoAcionista,
    updatePremissa5Y, updateCenarioSensibilidade,
    atualizar, autorNome, setAutorNome,
    comentarioEnvio, setComentarioEnvio, enviarVersao, enviando, erro,
    versoes, mostrarHistorico, setMostrarHistorico, exportarExcel, exportarExcelCalculo, solicitarResumoExecutivo,
    abrirVersao,
  } = props;

  // IPCA (2026-08-20, tipo de premissa 'reajuste_inflacao') — ver nota
  // igual no componente pai (App). Recalculado aqui porque premissasMacro
  // já é prop desta tela (usada por AbaEstrategicas) e não vale a pena
  // encher a lista de props do topo com mais um item derivável localmente.
  const ipcaAnualPct = premissasMacro.find(p => p.id === 'ipca')?.valor;
  const cambios = cambiosDePremissas(premissasMacro);

  return (
    <div style={{ padding: 22, maxWidth: 1520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Antes: UNIDADES (todas, para qualquer um). Agora: só as que este
              usuário tem vínculo real — proteção de verdade é no backend
              (exigirUnidade em toda rota), isto é só não oferecer na UI o
              que o servidor rejeitaria de qualquer forma. */}
          {/* 2026-08-20: cada família multi-site (Terra do Sol/Frutos do
              Sol/Consolidado na Agrícola, Samoa Beach/Samoa Villa/
              Consolidado no Resorts — ver FAMILIAS_MULTISITE) aparece
              agrupada num único botão ("ARA Agrícola", "ARA Resorts") — o
              site escolhido vira a subfaixa de botões logo abaixo. */}
          {(() => {
            const pills = [];
            const familiaAdicionada = {};
            unidadesVisiveis.forEach(u => {
              const familia = FAMILIAS_MULTISITE.find(f => f.ids.includes(u.id));
              if (familia) {
                if (!familiaAdicionada[familia.nome]) {
                  pills.push({ id: `__familia_${familia.nome}__`, nome: familia.nome, cor: familia.cor, logo: familia.logo, logoAltura: familia.logoAltura, familia });
                  familiaAdicionada[familia.nome] = true;
                }
              } else {
                pills.push(u);
              }
            });
            return pills.map(u => {
              const ativo = u.familia ? u.familia.ids.includes(unidadeAtual) : u.id === unidadeAtual;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    if (u.familia) {
                      if (!u.familia.ids.includes(unidadeAtual)) {
                        const primeiraVisivel = u.familia.subunidades.find(s => unidadesVisiveis.some(uv => uv.id === s.id));
                        if (primeiraVisivel) setUnidadeAtual(primeiraVisivel.id);
                      }
                      return;
                    }
                    setUnidadeAtual(u.id);
                  }}
                  style={{
                    fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 22, cursor: 'pointer',
                    border: `1.5px solid ${ativo ? u.cor : COR.borda}`,
                    background: ativo ? u.cor : COR.branco,
                    color: ativo ? COR.branco : COR.texto,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {u.logo && (
                    <img
                      src={u.logo} alt=""
                      style={{ height: u.logoAltura || 24, borderRadius: 3, background: '#fff', padding: ativo ? '2px 5px' : '1px 3px' }}
                    />
                  )}
                  {u.nome}
                </button>
              );
            });
          })()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Consolidado ('agricola'/'resorts') nunca é editado direto —
              não faz sentido "salvar rascunho" nele (ver
              ConsolidadoAgricola/ConsolidadoResorts). */}
          {UNIDADES_COM_LANCAMENTO_HABILITADO.includes(unidadeAtual) && unidadeAtual !== 'agricola' && unidadeAtual !== 'resorts' && (
            <>
              {/* Erro de salvamento (2026-08-23) — antes só aparecia dentro
                  da aba Revisão, então uma falha no autosave passava em
                  branco pra quem não estava naquela aba (sintoma reportado:
                  "não salva e não aparece nada"). Agora mostra aqui do lado
                  do próprio botão de salvar, sempre visível. */}
              {erro && (
                <span style={{ fontSize: 10.5, color: COR.vermelho, maxWidth: 320 }} title={erro}>
                  ⚠ {erro}
                </span>
              )}
              {!erro && ultimoSalvoEm && (
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

      {/* Subfaixa de sites (fazendas/resorts + Consolidado) — só aparece
          quando alguma família multi-site está selecionada, só mostra os
          que este usuário realmente tem vínculo (unidadesVisiveis). */}
      {FAMILIAS_MULTISITE.filter(f => f.ids.includes(unidadeAtual)).map(familiaAtiva => (
        <div key={familiaAtiva.nome} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, marginTop: -6 }}>
          {familiaAtiva.subunidades.filter(s => unidadesVisiveis.some(uv => uv.id === s.id)).map(s => (
            <button
              key={s.id} onClick={() => setUnidadeAtual(s.id)}
              style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
                border: `1.5px solid ${s.id === unidadeAtual ? familiaAtiva.cor : COR.borda}`,
                background: s.id === unidadeAtual ? familiaAtiva.cor : COR.branco,
                color: s.id === unidadeAtual ? COR.branco : COR.texto,
              }}
            >{s.nome}</button>
          ))}
        </div>
      ))}

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
      ) : unidadeAtual === 'agricola' ? (
        // Consolidado da Agrícola (2026-08-20): nunca editado direto — é
        // sempre TDS + FDS somados, com o próprio envio/histórico. Ver
        // ConsolidadoAgricola.
        <ConsolidadoAgricola autorNome={autorNome} setAutorNome={setAutorNome} abrirVersao={abrirVersao} ipcaAnualPct={ipcaAnualPct} cambios={cambios} />
      ) : unidadeAtual === 'resorts' ? (
        // Consolidado do Resorts (2026-08-20): mesmo racional — sempre
        // Samoa Beach + Samoa Villa somados. Ver ConsolidadoResorts.
        <ConsolidadoResorts autorNome={autorNome} setAutorNome={setAutorNome} abrirVersao={abrirVersao} ipcaAnualPct={ipcaAnualPct} cambios={cambios} />
      ) : (
        <>
      <div style={{ display: 'flex', gap: 2, borderBottom: `2px solid ${COR.borda}`, marginBottom: 18, flexWrap: 'wrap' }}>
        {/* Gestor de CC (pedido de 2026-08-16, revisado em 2026-08-23:
            "cada gestor do CC corporativo também terá o campo de envio do
            orçamento") — só Custos e Despesas + Revisão, Análise e Envio
            (a visão completa das demais seções — Estratégicas, Receita,
            CAPEX etc. — continua exclusiva de Gestor da Unidade e Admin
            FP&A). O envio em si (POST /enviar) já era liberado no backend
            pra quem tem pelo menos 1 CC na unidade (ver exigirUnidade em
            authorize.js) — só faltava o botão aparecer na tela. A DRE/
            Bridge/Sensibilidades mostradas ali são as do Corporativo
            inteiro (não dá pra recortar por CC — Receita/IR são da
            unidade toda), mesma tela que Admin FP&A vê. Terra do Sol/
            Frutos do Sol (2026-08-20) não têm aba de Revisão própria — o
            envio/histórico da Agrícola/Resorts é só no Consolidado (ver
            ConsolidadoAgricola/ConsolidadoResorts). */}
        {(usuario.perfil === 'gerente_cc_corporativo' ? ABAS.filter(a => a.id === 'custos' || a.id === 'revisao')
          : IDS_MULTISITE_FILHOS.includes(unidadeAtual) ? ABAS.filter(a => a.id !== 'revisao')
          : ABAS).map(a => (
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
              updateProduto={updateProduto} updateDeducao={updateDeducao} atualizar={atualizar} dre={dre} cambios={cambios}
            />
          )
        )}
        {aba === 'custos' && (
          <AbaCustos
            refUnidade={referenciaDaUnidade(unidadeAtual)}
            unidadeId={unidadeAtual} usuario={usuario}
            linhas={dados.custos.linhas} updateConta={updateConta} updateSublinha={updateSublinha} addSublinha={addSublinha} removeSublinha={removeSublinha} dre={dre} ipcaAnualPct={ipcaAnualPct}
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
        {aba === 'giro' && <AbaGiro capitalGiro={dados.capitalGiro} atualizar={atualizar} dre={dre} dados={dados} refUnidade={referenciaDaUnidade(unidadeAtual)} ipcaAnualPct={ipcaAnualPct} />}
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
        {aba === 'revisao' && !IDS_MULTISITE_FILHOS.includes(unidadeAtual) && (
          <AbaRevisao
            refUnidade={referenciaDaUnidade(unidadeAtual)}
            unidadeId={unidadeAtual} versoes={versoes}
            dados={dados} dre={dre} ipcaAnualPct={ipcaAnualPct} cambios={cambios} autorNome={autorNome} setAutorNome={setAutorNome}
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
        <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 3 formatos de exportação (2026-08-23): Cálculo (projeções
              calculadas, por aba, mês a mês — ver exportarExcelCalculo) ×
              Dados Brutos (1 linha por mês por conta/produto, para
              auditoria — exportarExcel) × Apresentação (PPT pro CAD). */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Botao variante="secundario" icone={FileSpreadsheet} onClick={() => exportarExcelCalculo()}>Excel — Cálculo</Botao>
            <Botao variante="secundario" icone={FileSpreadsheet} onClick={exportarExcel}>Excel — Dados Brutos</Botao>
            <Botao variante="secundario" icone={FileBarChart} onClick={solicitarResumoExecutivo}>Apresentação (PPT)</Botao>
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

function CustosLeituraVersao({ refUnidade, unidadeId, dados, dre, ipcaAnualPct }) {
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
  function totalConta(contaCodigo) { return valorLinhaAnual(linhas[chaveLinha(contaCodigo)], dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes); }
  const gruposPacote = (refUnidade.pacotes || [])
    .map(p => ({ ...p, contas: (refUnidade.planoContas?.[p.id] || []).filter(c => c.origem === origemAlvo) }))
    .filter(g => g.contas.length > 0);
  const funcionariosCC = funcionarios.filter(f => f.ccCodigo === ccSel);
  const folhaAtual = computeFolhaPessoalAnual(funcionariosCC, premissasPessoal);
  // Pessoal (2026-08-23): soma folha (CLT) + eventuais contas do pacote
  // (Consultórias PJs, só Corporativo) — não exclui mais 'pessoal' da soma.
  const totalCC = gruposPacote.reduce((acc, g) => acc + g.contas.reduce((a, c) => a + totalConta(c.codigo), 0), 0) + folhaAtual.totalAnual;

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
        const contasTotal = g.contas.reduce((acc, c) => acc + totalConta(c.codigo), 0);
        const totalPacote = g.id === 'pessoal' ? folhaAtual.totalAnual + contasTotal : contasTotal;
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
                  <>
                    <FolhaPessoalLeitura funcionarios={funcionariosCC} premissasPessoal={premissasPessoal} />
                    {g.contas.filter(c => c.codigo === CONTA_CONSULTORIA_PJ).map(c => (
                      <div key={c.codigo} style={{ marginTop: 14 }}>
                        <h5 style={{ fontSize: 11.5, color: COR.azul, marginBottom: 8 }}>Consultórias PJs — conta analítica</h5>
                        <LinhaContaLeitura
                          conta={c}
                          linha={linhas[chaveLinha(c.codigo)] || novaLinhaVazia()}
                          aberta={contaAberta === chaveLinha(c.codigo)}
                          onToggle={() => setContaAberta(prev => prev === chaveLinha(c.codigo) ? null : chaveLinha(c.codigo))}
                          total={totalConta(c.codigo)}
                          receitaBrutaMes={dre.receitaBrutaMes} receitaLiquidaMes={dre.receitaLiquidaMes}
                          ocultarClassificacao={unidadeId === 'corporativo'}
                          ipcaAnualPct={ipcaAnualPct} volumeTotalKgMes={dre.volumeTotalKgMes}
                        />
                      </div>
                    ))}
                  </>
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
                        ipcaAnualPct={ipcaAnualPct} volumeTotalKgMes={dre.volumeTotalKgMes}
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
function ReceitaLeituraVersao({ dados, cambios }) {
  const receita = dados.receita || {};
  if (Array.isArray(receita.produtos) && receita.produtos.length > 0) {
    return (
      <div>
        <h4 style={{ fontSize: 12.5, color: COR.azul, marginBottom: 8 }}>Produtos — volume, preço e receita</h4>
        {receita.produtos.map(p => {
          const externo = p.mercado === 'externo';
          const moedaNome = { usd: 'USD', eur: 'EUR', gbp: 'GBP' }[p.moeda || 'usd'];
          const taxa = parseNum(cambios?.[p.moeda || 'usd']);
          return (
            <div key={p.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COR.texto, marginBottom: 4 }}>
                {p.nome} {externo && <span style={{ fontSize: 9.5, fontWeight: 700, color: COR.azul, background: COR.claro, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: '1px 6px', marginLeft: 4 }}>Mercado Externo · {moedaNome}</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <CabecalhoMensalLeitura />
                  <tbody>
                    <LinhaCalculadaMensal label="Volume" valoresMensal={(p.volumes || mesesVazios()).map(parseNum)} formatarCelula={formatarQtdLeitura} />
                    {externo ? (
                      <>
                        <LinhaCalculadaMensal label={`Preço (${moedaNome}/t)`} valoresMensal={(p.precoMoeda || mesesVazios()).map(parseNum)} formatarCelula={v => `${moedaNome} ${formatarQtdLeitura(v)}`} />
                        <LinhaCalculadaMensal label={`Câmbio (R$/${moedaNome})`} valoresMensal={MESES.map(() => taxa)} formatarCelula={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} />
                      </>
                    ) : (
                      <LinhaCalculadaMensal label="Preço (R$)" valoresMensal={(p.precos || mesesVazios()).map(parseNum)} />
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
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
function ModalVersao({ unidadeId, versaoId, onClose, ipcaAnualPct, cambios }) {
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
  // Versão de um Consolidado (Agrícola/Resorts, 2026-08-20): o `dados`
  // salvo não é o formato normal (receita/custos direto), é o wrapper com
  // o snapshot dos 2 sites no momento do envio — ver
  // CONSOLIDADOS_MULTISITE/ConsolidadoAgricola/ConsolidadoResorts/somarDRE.
  // Precisa de um caminho próprio de leitura.
  const consolidado = CONSOLIDADOS_MULTISITE[unidadeId];
  const ehConsolidado = !!(consolidado && versao?.dados?._tipo === consolidado.tipo);
  const dresSites = ehConsolidado
    ? consolidado.sites.map(siteId => computeDRE(versao.dados[siteId] || emptyFormData(siteId), referenciaDaUnidade(siteId), ipcaAnualPct, cambios))
    : null;
  const dre = versao ? (ehConsolidado ? somarDRE(dresSites[0], dresSites[1]) : computeDRE(versao.dados, ref, ipcaAnualPct, cambios)) : null;

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
            {ehConsolidado ? (
              <>
                {abaDetalhe === 'receita' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {consolidado.sites.map((siteId, i) => (
                      <div key={siteId}><h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 10 }}>{consolidado.labels[i]}</h4><ReceitaLeituraVersao dados={versao.dados[siteId] || emptyFormData(siteId)} cambios={cambios} /></div>
                    ))}
                  </div>
                )}
                {abaDetalhe === 'custos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {consolidado.sites.map((siteId, i) => (
                      <div key={siteId}><h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 10 }}>{consolidado.labels[i]}</h4><CustosLeituraVersao refUnidade={referenciaDaUnidade(siteId)} unidadeId={siteId} dados={versao.dados[siteId] || emptyFormData(siteId)} dre={dresSites[i]} ipcaAnualPct={ipcaAnualPct} /></div>
                    ))}
                  </div>
                )}
                {abaDetalhe === 'capex' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {consolidado.sites.map((siteId, i) => (
                      <div key={siteId}><h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 10 }}>{consolidado.labels[i]}</h4><CapexLeituraVersao dados={versao.dados[siteId] || emptyFormData(siteId)} /></div>
                    ))}
                  </div>
                )}
                {abaDetalhe === 'provisoes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {consolidado.sites.map((siteId, i) => (
                      <div key={siteId}><h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 10 }}>{consolidado.labels[i]}</h4><ProvisoesLeituraVersao dados={versao.dados[siteId] || emptyFormData(siteId)} /></div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {abaDetalhe === 'receita' && <ReceitaLeituraVersao dados={versao.dados} cambios={cambios} />}
                {abaDetalhe === 'custos' && <CustosLeituraVersao refUnidade={ref} unidadeId={unidadeId} dados={versao.dados} dre={dre} ipcaAnualPct={ipcaAnualPct} />}
                {abaDetalhe === 'capex' && <CapexLeituraVersao dados={versao.dados} />}
                {abaDetalhe === 'provisoes' && <ProvisoesLeituraVersao dados={versao.dados} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Consolidado da ARA Agrícola (pedido de 2026-08-20): Terra do Sol e Frutos
// do Sol são unidades próprias, cada uma com seu orçamento editável — o
// Consolidado nunca é editado direto, é sempre a soma das duas (dre via
// somarDRE, nunca mesclando os `dados` brutos das fazendas — os códigos de
// CC são os mesmos nas duas, mesclar arriscaria colisão de chave
// CC|Conta). É aqui que vive o envio/histórico de versões da Agrícola —
// TDS/FDS não têm aba de Revisão própria (ver ABAS/FAMILIA_AGRICOLA).
function ConsolidadoAgricola({ autorNome, setAutorNome, abrirVersao, ipcaAnualPct, cambios }) {
  const [dadosTds, setDadosTds] = useState(null);
  const [dadosFds, setDadosFds] = useState(null);
  const [versoes, setVersoes] = useState([]);
  const [aguardandoLiberacao, setAguardandoLiberacao] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [comentarioEnvio, setComentarioEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ifrs18, setIfrs18] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [rTds, rFds, rAg] = await Promise.all([
        getOrcamento('agricola_tds'), getOrcamento('agricola_fds'), getOrcamento('agricola'),
      ]);
      setDadosTds(rTds.orcamento.dados);
      setDadosFds(rFds.orcamento.dados);
      setAguardandoLiberacao(rAg.orcamento.aguardando_liberacao || false);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar os dados de Terra do Sol e Frutos do Sol.');
    }
    try {
      setVersoes(await listarVersoes('agricola'));
    } catch (e) {
      setVersoes([]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) return <p style={{ fontSize: 12.5, color: '#7A8088' }}>Carregando Terra do Sol e Frutos do Sol…</p>;
  if (!dadosTds || !dadosFds) {
    return (
      <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, borderRadius: 6, padding: 10, fontSize: 12 }}>
        {erro || 'Não foi possível carregar os dados das fazendas.'}
      </div>
    );
  }

  const refAg = referenciaDaUnidade('agricola_tds');
  const dreTds = computeDRE(dadosTds, refAg, ipcaAnualPct, cambios);
  const dreFds = computeDRE(dadosFds, refAg, ipcaAnualPct, cambios);
  const dre = somarDRE(dreTds, dreFds);
  const checksTds = runAuditoria(dadosTds, dreTds, refAg, 'agricola_tds', ipcaAnualPct);
  const checksFds = runAuditoria(dadosFds, dreFds, refAg, 'agricola_fds', ipcaAnualPct);
  const tudoOkTds = checksTds.filter(c => c.obrigatorio !== false).every(c => c.ok);
  const tudoOkFds = checksFds.filter(c => c.obrigatorio !== false).every(c => c.ok);
  const tudoOk = tudoOkTds && tudoOkFds;

  // Bridge Receita->EBITDA->FCO (2026-08-23, item 3): mesma mecânica de
  // AbaRevisao, só que somando os dois lados (computeFluxoIndiretoMensal
  // exige um `data`/`dre`/`ref` por vez — não dá pra chamar com o `dre`
  // já somado de somarDRE, que não carrega os *Mes de detalhe).
  const fdTds = computeFluxoIndiretoMensal(dadosTds, dreTds, refAg, ipcaAnualPct);
  const fdFds = computeFluxoIndiretoMensal(dadosFds, dreFds, refAg, ipcaAnualPct);
  const totalFcOperacional = fdTds.fcOperacionalMes.reduce((a, v) => a + v, 0) + fdFds.fcOperacionalMes.reduce((a, v) => a + v, 0);
  const bridgeReceitaEbitda = [
    { label: 'Receita Bruta', valor: dre.receitaBruta, tipo: 'inicio' },
    { label: 'Deduções/Impostos', valor: -dre.deducoes, tipo: 'incremento' },
    { label: 'Custos (CPV)', valor: -dre.cpv, tipo: 'incremento' },
    { label: 'Despesas', valor: -dre.despesasSemDA, tipo: 'incremento' },
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'total' },
  ];
  const totalIrcslAno = fdTds.ircslMes.reduce((a, v) => a + v, 0) + fdFds.ircslMes.reduce((a, v) => a + v, 0);
  const totalGiroAno = fdTds.variacaoGiroMes.reduce((a, v) => a + v, 0) + fdFds.variacaoGiroMes.reduce((a, v) => a + v, 0);
  const totalAjuste13Ano = fdTds.ajuste13Mes.reduce((a, v) => a + v, 0) + fdFds.ajuste13Mes.reduce((a, v) => a + v, 0);
  const totalAjustePagamentoAno = fdTds.ajustePagamentoMes.reduce((a, v) => a + v, 0) + fdFds.ajustePagamentoMes.reduce((a, v) => a + v, 0);
  const bridgeEbitdaFco = [
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'inicio' },
    { label: 'Impostos', valor: -totalIrcslAno, tipo: 'incremento' },
    { label: 'Var. Capital de Giro', valor: totalGiroAno, tipo: 'incremento' },
    { label: 'Outros Ajustes', valor: totalAjuste13Ano + totalAjustePagamentoAno, tipo: 'incremento' },
    { label: 'FCO', valor: totalFcOperacional, tipo: 'total' },
  ];

  async function handleEnviar() {
    setEnviando(true);
    setErro(null);
    try {
      // Snapshot combinado — marcado com _tipo pra ModalVersao/dreDaUnidade
      // saberem que este `dados` não segue o formato normal de uma unidade
      // (ver notas em ambos). Grava primeiro (PUT) pra depois o envio
      // (registrarEnvio, backend inalterado) snapshotar exatamente isso.
      await putOrcamento('agricola', { _tipo: 'consolidado_agricola', agricola_tds: dadosTds, agricola_fds: dadosFds });
      await enviarVersaoApi('agricola', { comentario: comentarioEnvio, autorNome });
      setComentarioEnvio('');
      await carregar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setAguardandoLiberacao(true);
      setErro(e instanceof ApiError ? e.message : 'Falha ao enviar a versão consolidada.');
    }
    setEnviando(false);
  }

  function PainelChecklist({ titulo, checks }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COR.azul, marginBottom: 6 }}>{titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              {c.ok ? <CheckCircle2 size={13} color={COR.verde} /> : <AlertTriangle size={13} color={c.obrigatorio === false ? COR.laranja : COR.vermelho} />}
              <span style={{ color: c.ok ? COR.texto : (c.obrigatorio === false ? '#7A8088' : COR.vermelho) }}>
                {c.label}{c.detalhe ? ` — ${c.detalhe}` : ''}
                {!c.ok && c.obrigatorio === false ? ' (opcional)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>ARA Agrícola — Consolidado</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Soma de Terra do Sol (TDS) e Frutos do Sol (FDS) — sempre calculada ao vivo a partir do orçamento atual das
        duas fazendas. O envio e o histórico de versões do orçamento da Agrícola acontecem aqui, não em cada fazenda.
      </p>

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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
        <CardTotal label="Receita bruta" valor={dre.receitaBruta} cor={COR.azul} />
        <CardTotal label="EBITDA" valor={dre.ebitda} cor={COR.laranja} />
        <CardTotal label="Lucro líquido" valor={dre.lucroLiquido} cor={COR.verde} />
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '18px 0' }}>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul, marginBottom: 2 }}>Bridge — Receita até EBITDA</div>
          <GraficoBridge etapas={bridgeReceitaEbitda} />
        </div>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul, marginBottom: 2 }}>Bridge — EBITDA até FCO</div>
          <GraficoBridge etapas={bridgeEbitdaFco} />
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 20, marginBottom: 10 }}>DRE mensal — por tipo de receita/custo/despesa, aberta por fazenda</h4>
      <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 10 }}>Clique em uma linha com seta para abrir a quebra por Terra do Sol (TDS) e Frutos do Sol (FDS).</p>
      <div style={{ marginBottom: 24 }}>
        <DREMensalConsolidada
          lados={[{ nome: 'Terra do Sol', dados: dadosTds, dre: dreTds, fd: fdTds, ref: refAg }, { nome: 'Frutos do Sol', dados: dadosFds, dre: dreFds, fd: fdFds, ref: refAg }]}
          unidadeKind="agricola" ipcaAnualPct={ipcaAnualPct} cambios={cambios}
        />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 20, marginBottom: 10 }}>Detalhe por fazenda (Receita e Custos e Despesas)</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            Terra do Sol <span style={{ fontSize: 10.5, fontWeight: 400, color: '#7A8088' }}>({formatBRL(dreTds.receitaBruta)} receita bruta)</span>
          </div>
          <ReceitaLeituraVersao dados={dadosTds} cambios={cambios} />
          <div style={{ marginTop: 10 }}><CustosLeituraVersao refUnidade={refAg} unidadeId="agricola_tds" dados={dadosTds} dre={dreTds} ipcaAnualPct={ipcaAnualPct} /></div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            Frutos do Sol <span style={{ fontSize: 10.5, fontWeight: 400, color: '#7A8088' }}>({formatBRL(dreFds.receitaBruta)} receita bruta)</span>
          </div>
          <ReceitaLeituraVersao dados={dadosFds} cambios={cambios} />
          <div style={{ marginTop: 10 }}><CustosLeituraVersao refUnidade={refAg} unidadeId="agricola_fds" dados={dadosFds} dre={dreFds} ipcaAnualPct={ipcaAnualPct} /></div>
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 10 }}>Auditoria — checagens de completude</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 10 }}>
        <PainelChecklist titulo="Terra do Sol" checks={checksTds} />
        <PainelChecklist titulo="Frutos do Sol" checks={checksFds} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '20px 0 14px' }}>
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
        <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>{erro}</div>
      )}
      {!tudoOk && (
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, color: COR.texto, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>
          Existem checagens de Auditoria pendentes em Terra do Sol e/ou Frutos do Sol. Corrija-as antes de enviar (painel acima).
        </div>
      )}
      {aguardandoLiberacao && (
        <div style={{ background: '#E9F0FB', border: `1px solid ${COR.azul}`, color: COR.azul, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>
          Este orçamento consolidado já foi enviado e está aguardando liberação do FP&A para permitir um novo envio.
        </div>
      )}

      <Botao variante="laranja" icone={Send} onClick={handleEnviar} disabled={!tudoOk || enviando || aguardandoLiberacao}>
        {enviando ? 'Enviando…' : aguardandoLiberacao ? 'Aguardando liberação do FP&A' : 'Enviar versão consolidada'}
      </Botao>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 30, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <History size={15} /> Histórico de versões — Consolidado
      </h4>
      {versoes.length === 0 ? (
        <p style={{ fontSize: 12, color: '#7A8088' }}>Nenhuma versão consolidada enviada ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {versoes.map(v => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${COR.borda}`, borderRadius: 6, padding: '8px 12px', fontSize: 11.5 }}>
              <span>{formatData(v.timestamp)} — <b>{v.autor}</b>{v.comentario ? ` — ${v.comentario}` : ''}</span>
              <button onClick={() => abrirVersao('agricola', v.id)} style={{ ...botaoSecundarioLocal }}>Abrir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const botaoSecundarioLocal = {
  fontFamily: FONT, fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${COR.azul}`, background: '#fff', color: COR.azul,
};

// Consolidado do Resorts (2026-08-20) — mesmo racional do ConsolidadoAgricola
// (ver notas lá), adaptado pro Resorts: Samoa Beach e Samoa Villa são as
// unidades editáveis, o Consolidado é sempre a soma das duas. Diferença
// importante: Beach e Villa NÃO têm exatamente os mesmos CCs ("AT Ampliação
// Beach" só existe no Beach, "Villa Muro Alto" e "AT Ampliação Villa" só na
// Villa — ver CCS_RESORTS), então cada lado usa a própria referência
// (referenciaDaUnidade('samoa_beach')/('samoa_villa')), nunca uma única
// referência compartilhada como a Agrícola faz.
function ConsolidadoResorts({ autorNome, setAutorNome, abrirVersao, ipcaAnualPct, cambios }) {
  const [dadosBeach, setDadosBeach] = useState(null);
  const [dadosVilla, setDadosVilla] = useState(null);
  const [versoes, setVersoes] = useState([]);
  const [aguardandoLiberacao, setAguardandoLiberacao] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [comentarioEnvio, setComentarioEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ifrs18, setIfrs18] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [rBeach, rVilla, rRes] = await Promise.all([
        getOrcamento('samoa_beach'), getOrcamento('samoa_villa'), getOrcamento('resorts'),
      ]);
      setDadosBeach(rBeach.orcamento.dados);
      setDadosVilla(rVilla.orcamento.dados);
      setAguardandoLiberacao(rRes.orcamento.aguardando_liberacao || false);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar os dados de Samoa Beach e Samoa Villa.');
    }
    try {
      setVersoes(await listarVersoes('resorts'));
    } catch (e) {
      setVersoes([]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) return <p style={{ fontSize: 12.5, color: '#7A8088' }}>Carregando Samoa Beach e Samoa Villa…</p>;
  if (!dadosBeach || !dadosVilla) {
    return (
      <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, borderRadius: 6, padding: 10, fontSize: 12 }}>
        {erro || 'Não foi possível carregar os dados dos resorts.'}
      </div>
    );
  }

  const refBeach = referenciaDaUnidade('samoa_beach');
  const refVilla = referenciaDaUnidade('samoa_villa');
  const dreBeach = computeDRE(dadosBeach, refBeach, ipcaAnualPct);
  const dreVilla = computeDRE(dadosVilla, refVilla, ipcaAnualPct);
  const dre = somarDRE(dreBeach, dreVilla);
  const checksBeach = runAuditoria(dadosBeach, dreBeach, refBeach, 'samoa_beach', ipcaAnualPct);
  const checksVilla = runAuditoria(dadosVilla, dreVilla, refVilla, 'samoa_villa', ipcaAnualPct);
  const tudoOkBeach = checksBeach.filter(c => c.obrigatorio !== false).every(c => c.ok);
  const tudoOkVilla = checksVilla.filter(c => c.obrigatorio !== false).every(c => c.ok);
  const tudoOk = tudoOkBeach && tudoOkVilla;

  // Bridge Receita->EBITDA->FCO (2026-08-23, item 3) — mesmo racional de
  // ConsolidadoAgricola (ver nota lá).
  const fdBeach = computeFluxoIndiretoMensal(dadosBeach, dreBeach, refBeach, ipcaAnualPct);
  const fdVilla = computeFluxoIndiretoMensal(dadosVilla, dreVilla, refVilla, ipcaAnualPct);
  const totalFcOperacional = fdBeach.fcOperacionalMes.reduce((a, v) => a + v, 0) + fdVilla.fcOperacionalMes.reduce((a, v) => a + v, 0);
  const bridgeReceitaEbitda = [
    { label: 'Receita Bruta', valor: dre.receitaBruta, tipo: 'inicio' },
    { label: 'Deduções/Impostos', valor: -dre.deducoes, tipo: 'incremento' },
    { label: 'Custos (CPV)', valor: -dre.cpv, tipo: 'incremento' },
    { label: 'Despesas', valor: -dre.despesasSemDA, tipo: 'incremento' },
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'total' },
  ];
  const totalIrcslAno = fdBeach.ircslMes.reduce((a, v) => a + v, 0) + fdVilla.ircslMes.reduce((a, v) => a + v, 0);
  const totalGiroAno = fdBeach.variacaoGiroMes.reduce((a, v) => a + v, 0) + fdVilla.variacaoGiroMes.reduce((a, v) => a + v, 0);
  const totalAjuste13Ano = fdBeach.ajuste13Mes.reduce((a, v) => a + v, 0) + fdVilla.ajuste13Mes.reduce((a, v) => a + v, 0);
  const totalAjustePagamentoAno = fdBeach.ajustePagamentoMes.reduce((a, v) => a + v, 0) + fdVilla.ajustePagamentoMes.reduce((a, v) => a + v, 0);
  const bridgeEbitdaFco = [
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'inicio' },
    { label: 'Impostos', valor: -totalIrcslAno, tipo: 'incremento' },
    { label: 'Var. Capital de Giro', valor: totalGiroAno, tipo: 'incremento' },
    { label: 'Outros Ajustes', valor: totalAjuste13Ano + totalAjustePagamentoAno, tipo: 'incremento' },
    { label: 'FCO', valor: totalFcOperacional, tipo: 'total' },
  ];

  async function handleEnviar() {
    setEnviando(true);
    setErro(null);
    try {
      await putOrcamento('resorts', { _tipo: 'consolidado_resorts', samoa_beach: dadosBeach, samoa_villa: dadosVilla });
      await enviarVersaoApi('resorts', { comentario: comentarioEnvio, autorNome });
      setComentarioEnvio('');
      await carregar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setAguardandoLiberacao(true);
      setErro(e instanceof ApiError ? e.message : 'Falha ao enviar a versão consolidada.');
    }
    setEnviando(false);
  }

  function PainelChecklist({ titulo, checks }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COR.azul, marginBottom: 6 }}>{titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              {c.ok ? <CheckCircle2 size={13} color={COR.verde} /> : <AlertTriangle size={13} color={c.obrigatorio === false ? COR.laranja : COR.vermelho} />}
              <span style={{ color: c.ok ? COR.texto : (c.obrigatorio === false ? '#7A8088' : COR.vermelho) }}>
                {c.label}{c.detalhe ? ` — ${c.detalhe}` : ''}
                {!c.ok && c.obrigatorio === false ? ' (opcional)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>ARA Resorts — Consolidado</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Soma de Samoa Beach e Samoa Villa — sempre calculada ao vivo a partir do orçamento atual dos dois resorts.
        O envio e o histórico de versões do orçamento do Resorts acontecem aqui, não em cada resort.
      </p>

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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
        <CardTotal label="Receita bruta" valor={dre.receitaBruta} cor={COR.azul} />
        <CardTotal label="EBITDA" valor={dre.ebitda} cor={COR.laranja} />
        <CardTotal label="Lucro líquido" valor={dre.lucroLiquido} cor={COR.verde} />
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '18px 0' }}>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul, marginBottom: 2 }}>Bridge — Receita até EBITDA</div>
          <GraficoBridge etapas={bridgeReceitaEbitda} />
        </div>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COR.azul, marginBottom: 2 }}>Bridge — EBITDA até FCO</div>
          <GraficoBridge etapas={bridgeEbitdaFco} />
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 20, marginBottom: 10 }}>DRE mensal — por tipo de receita/custo/despesa, aberta por resort</h4>
      <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 10 }}>Clique em uma linha com seta para abrir a quebra por Samoa Beach e Samoa Villa.</p>
      <div style={{ marginBottom: 24 }}>
        <DREMensalConsolidada
          lados={[{ nome: 'Samoa Beach', dados: dadosBeach, dre: dreBeach, fd: fdBeach, ref: refBeach }, { nome: 'Samoa Villa', dados: dadosVilla, dre: dreVilla, fd: fdVilla, ref: refVilla }]}
          unidadeKind="resorts" ipcaAnualPct={ipcaAnualPct} cambios={cambios}
        />
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 20, marginBottom: 10 }}>Detalhe por resort (Receita e Custos e Despesas)</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            Samoa Beach <span style={{ fontSize: 10.5, fontWeight: 400, color: '#7A8088' }}>({formatBRL(dreBeach.receitaBruta)} receita bruta)</span>
          </div>
          <ReceitaLeituraVersao dados={dadosBeach} cambios={cambios} />
          <div style={{ marginTop: 10 }}><CustosLeituraVersao refUnidade={refBeach} unidadeId="samoa_beach" dados={dadosBeach} dre={dreBeach} ipcaAnualPct={ipcaAnualPct} /></div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            Samoa Villa <span style={{ fontSize: 10.5, fontWeight: 400, color: '#7A8088' }}>({formatBRL(dreVilla.receitaBruta)} receita bruta)</span>
          </div>
          <ReceitaLeituraVersao dados={dadosVilla} cambios={cambios} />
          <div style={{ marginTop: 10 }}><CustosLeituraVersao refUnidade={refVilla} unidadeId="samoa_villa" dados={dadosVilla} dre={dreVilla} ipcaAnualPct={ipcaAnualPct} /></div>
        </div>
      </div>

      <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 10 }}>Auditoria — checagens de completude</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 10 }}>
        <PainelChecklist titulo="Samoa Beach" checks={checksBeach} />
        <PainelChecklist titulo="Samoa Villa" checks={checksVilla} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '20px 0 14px' }}>
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
        <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>{erro}</div>
      )}
      {!tudoOk && (
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, color: COR.texto, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>
          Existem checagens de Auditoria pendentes em Samoa Beach e/ou Samoa Villa. Corrija-as antes de enviar (painel acima).
        </div>
      )}
      {aguardandoLiberacao && (
        <div style={{ background: '#E9F0FB', border: `1px solid ${COR.azul}`, color: COR.azul, borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 12 }}>
          Este orçamento consolidado já foi enviado e está aguardando liberação do FP&A para permitir um novo envio.
        </div>
      )}

      <Botao variante="laranja" icone={Send} onClick={handleEnviar} disabled={!tudoOk || enviando || aguardandoLiberacao}>
        {enviando ? 'Enviando…' : aguardandoLiberacao ? 'Aguardando liberação do FP&A' : 'Enviar versão consolidada'}
      </Botao>

      <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 30, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <History size={15} /> Histórico de versões — Consolidado
      </h4>
      {versoes.length === 0 ? (
        <p style={{ fontSize: 12, color: '#7A8088' }}>Nenhuma versão consolidada enviada ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {versoes.map(v => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${COR.borda}`, borderRadius: 6, padding: '8px 12px', fontSize: 11.5 }}>
              <span>{formatData(v.timestamp)} — <b>{v.autor}</b>{v.comentario ? ` — ${v.comentario}` : ''}</span>
              <button onClick={() => abrirVersao('resorts', v.id)} style={{ ...botaoSecundarioLocal }}>Abrir</button>
            </div>
          ))}
        </div>
      )}
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

const MOEDAS_ME = [{ id: 'usd', nome: 'USD' }, { id: 'eur', nome: 'EUR' }, { id: 'gbp', nome: 'GBP' }];

function AbaReceita({ unidadeId, produtos, deducoes, deducoesJustificativa, justificativaGeral, updateProduto, updateDeducao, atualizar, dre, cambios }) {
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
        // Mercado Interno × Externo (2026-08-23, ver receitaVazia/
        // receitaBrutaPorMes): produtos sem o campo `mercado` (Têxtil) são
        // sempre tratados como Interno — não ganham o toggle.
        const temMercado = p.mercado !== undefined;
        const externo = p.mercado === 'externo';
        const moedaNome = MOEDAS_ME.find(m => m.id === (p.moeda || 'usd'))?.nome || 'USD';
        const taxaCambio = parseNum(cambios?.[p.moeda || 'usd']);
        const receitaMensal = MESES.map((_, m) => externo
          ? parseNum(p.volumes?.[m]) * parseNum(p.precoMoeda?.[m]) * taxaCambio
          : parseNum(p.volumes?.[m]) * parseNum(p.precos?.[m]));
        const totalProduto = receitaMensal.reduce((a, v) => a + v, 0);
        const volumeAnualProduto = MESES.reduce((acc, _, m) => acc + parseNum(p.volumes?.[m]), 0);
        // Preço ponderado do produto (2026-08-30, bug: Total da linha
        // "Preço (R$/t)" somava os 12 meses, ex. R$3+R$4=R$7, em vez da
        // média ponderada por volume) — Receita do ano do produto / Volume
        // do ano do produto, na moeda da própria linha (precoMoeda pra
        // Externo não precisa de câmbio aqui: é preço médio na moeda
        // original, o câmbio só entra na conversão pra Receita em R$).
        const precoPonderadoProduto = (precosArr) => {
          if (!volumeAnualProduto) return 0;
          const numerador = MESES.reduce((acc, _, m) => acc + parseNum(p.volumes?.[m]) * parseNum(precosArr?.[m]), 0);
          return numerador / volumeAnualProduto;
        };
        return (
          <div key={p.id} style={{ marginBottom: 18, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 12, background: i % 2 ? COR.claro : COR.branco }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul }}>{p.nome}</span>
              <span style={{ fontSize: 10.5, color: '#8A8F96' }}>
                {ref ? `Referência 2026: ${ref.volumeRef} t · R$ ${ref.precoRef.toFixed(2)}/t` : '—'}
              </span>
            </div>
            {temMercado && (
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: COR.texto }}>Mercado:</span>
                <div style={{ display: 'flex', border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                  <button
                    onClick={() => updateProduto(p.id, 'mercado', 'interno')}
                    style={{
                      fontFamily: FONT, fontSize: 10.5, fontWeight: 700, padding: '3px 10px', border: 'none', cursor: 'pointer',
                      background: !externo ? COR.azul : COR.branco, color: !externo ? COR.branco : '#8A8F96',
                    }}
                  >Interno</button>
                  <button
                    onClick={() => updateProduto(p.id, 'mercado', 'externo')}
                    style={{
                      fontFamily: FONT, fontSize: 10.5, fontWeight: 700, padding: '3px 10px', border: 'none', cursor: 'pointer',
                      background: externo ? COR.laranja : COR.branco, color: externo ? COR.branco : '#8A8F96',
                    }}
                  >Externo</button>
                </div>
                {externo && (
                  <div style={{ maxWidth: 130 }}>
                    <Selecao value={p.moeda || 'usd'} onChange={v => updateProduto(p.id, 'moeda', v)} opcoes={MOEDAS_ME} />
                  </div>
                )}
              </div>
            )}
            {externo && (
              <p style={{ fontSize: 10.5, color: '#7A8088', marginBottom: 8 }}>
                Racional: Volume × Preço ({moedaNome}/t) × Câmbio (R$/{moedaNome}) — câmbio estático, vem da premissa
                macro do FP&A Corporativo (tela "Gestão do Orçamento"), mesmo valor o ano inteiro.
              </p>
            )}
            <TabelaMensal
              linhas={externo ? [
                { key: 'volume', label: 'Volume (t)', valores: p.volumes },
                { key: 'precoMoeda', label: `Preço (${moedaNome}/t)`, valores: p.precoMoeda, totalValor: precoPonderadoProduto(p.precoMoeda), formatarTotal: v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
              ] : [
                { key: 'volume', label: 'Volume (t)', valores: p.volumes },
                { key: 'preco', label: 'Preço (R$/t)', valores: p.precos, totalValor: precoPonderadoProduto(p.precos), formatarTotal: v => formatBRL(v) },
              ]}
              onChangeCelula={(linhaKey, mesIdx, valor) => {
                if (!externo) {
                  const campo = linhaKey === 'volume' ? 'volumes' : 'precos';
                  updateProduto(p.id, campo, atualizarArray(p[campo], mesIdx, valor));
                  return;
                }
                const campo = linhaKey === 'volume' ? 'volumes' : 'precoMoeda';
                updateProduto(p.id, campo, atualizarArray(p[campo], mesIdx, valor));
              }}
              corTotal={COR.azul}
              linhasCalculadas={[
                ...(externo ? [
                  { key: 'cambio', label: `Câmbio (R$/${moedaNome})`, valoresMensal: MESES.map(() => taxaCambio), totalValor: taxaCambio, cor: '#8A8F96', formatarCelula: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }), formatarTotal: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) },
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
        linhas={deducoes.map(d => {
          // Mesmo bug de "Preço (R$/t)" (ver TabelaMensal/precoPonderadoProduto
          // acima) — % de dedução não é aditivo mês a mês (Set 2% + Out 3%
          // não é "Total 5%"), é o valor absoluto do ano / receita bruta do
          // ano, ponderado pela base de cada mês.
          const valoresMensal = MESES.map((_, m) => (dre.receitaBrutaMes?.[m] || 0) * (parseNum(d.pcts?.[m]) / 100));
          const totalAbs = valoresMensal.reduce((a, v) => a + v, 0);
          const pctPonderado = dre.receitaBruta > 0 ? (totalAbs / dre.receitaBruta) * 100 : 0;
          return { key: d.id, label: d.nome, valores: d.pcts, totalValor: pctPonderado, formatarTotal: v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` };
        })}
        onChangeCelula={(dedId, mesIdx, valor) => {
          const d = deducoes.find(x => x.id === dedId);
          updateDeducao(dedId, atualizarArray(d.pcts, mesIdx, valor));
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
        // Bug de 2026-08-30: nunca confiar no premissaTipo armazenado nessas
        // linhas — ver nota em tipoLinhaReceitaResorts.
        const linhaTipada = { ...linha, premissaTipo: def.tipo };
        const receitaMensal = MESES.map((_, m) => valorLinhaMes(linhaTipada, m, null, null));
        const totalLinha = receitaMensal.reduce((a, v) => a + v, 0);
        // Hospedagem: a "quantidade" (acomodações ocupadas) não é digitada
        // direto — é derivada de Total de Acomodações × Taxa de Ocupação
        // (mesmo racional da planilha: linha 16 = linha 17 × linha 18).
        // Pedido explícito de 2026-08-09.
        const ehHospedagem = def.id === 'hospedagem';
        // Valor unitário ponderado (2026-08-30, mesmo bug de "Preço (R$/t)"
        // no Têxtil/Agrícola — ver TabelaMensal/AbaReceita): o Total da
        // linha Tarifa Média/Consumo Médio não pode ser a soma dos 12
        // meses — é Receita do ano da linha / Quantidade do ano da linha.
        const quantidadeAnualLinha = def.tipo === 'qtd_valor'
          ? MESES.reduce((acc, _, m) => acc + parseNum(linha.quantidades?.[m]), 0)
          : 0;
        const valorUnitPonderado = quantidadeAnualLinha > 0 ? totalLinha / quantidadeAnualLinha : 0;
        // Taxa de Ocupação (%) tem o mesmo problema — Total não pode ser a
        // soma dos 12 meses (ex.: 70%+75%=145%). Total certo = Acomodações
        // Ocupadas do ano / Total de Acomodações do ano.
        const totalAcomodacoesAnual = ehHospedagem
          ? MESES.reduce((acc, _, m) => acc + parseNum(linha.totalAcomodacoes?.[m]), 0)
          : 0;
        const taxaOcupacaoPonderada = totalAcomodacoesAnual > 0 ? (quantidadeAnualLinha / totalAcomodacoesAnual) * 100 : 0;
        const camposEditaveis = ehHospedagem
          ? [
              { key: 'totalAcomodacoes', label: 'Total de Acomodações (#) — UH × dias do mês', valores: linha.totalAcomodacoes || mesesVazios() },
              { key: 'taxaOcupacao', label: 'Taxa de Ocupação (%)', valores: linha.taxaOcupacao || mesesVazios(), totalValor: taxaOcupacaoPonderada, formatarTotal: v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` },
              { key: 'valorUnit', label: def.rotuloValor, valores: linha.valoresUnit, totalValor: valorUnitPonderado, formatarTotal: v => formatBRL(v) },
            ]
          : def.tipo === 'qtd_valor'
          ? [
              { key: 'quantidade', label: def.rotuloQtd, valores: linha.quantidades },
              { key: 'valorUnit', label: def.rotuloValor, valores: linha.valoresUnit, totalValor: valorUnitPonderado, formatarTotal: v => formatBRL(v) },
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
                  const totalAtual = campoKey === 'totalAcomodacoes' ? atualizarArray(linha.totalAcomodacoes, mesIdx, valor) : (linha.totalAcomodacoes || mesesVazios());
                  const taxaAtual = campoKey === 'taxaOcupacao' ? atualizarArray(linha.taxaOcupacao, mesIdx, valor) : (linha.taxaOcupacao || mesesVazios());
                  const novasQuantidades = totalAtual.map((v, idx) => parseNum(v) * (parseNum(taxaAtual[idx]) / 100));
                  atualizar(['receita', 'linhas', def.id], {
                    ...linha, totalAcomodacoes: totalAtual, taxaOcupacao: taxaAtual, quantidades: novasQuantidades,
                  });
                  return;
                }
                const campo = campoKey === 'quantidade' ? 'quantidades' : campoKey === 'valorUnit' ? 'valoresUnit' : 'valores';
                const base = campo === 'quantidades' ? linha.quantidades : campo === 'valoresUnit' ? linha.valoresUnit : linha.valores;
                const novoArray = atualizarArray(base, mesIdx, valor);
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
      <p style={{ fontSize: 10.5, color: '#7A8088', marginBottom: 8 }}>
        Café e Pensão (1.2.2) não soma na Receita Operacional Bruta: já está embutida na Tarifa Média da
        Hospedagem (mesmo racional de Premissa Resorts.xlsx) — por isso a linha abaixo mostra o quanto disso
        está implícito na Hospedagem, só para conferência.
      </p>
      <TabelaMensal
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={[
          {
            key: 'hospedagemSemPensao', label: 'Receita com Hospedagem sem Pensão (informativo)',
            // Bug de 2026-08-30: nunca confiar no premissaTipo armazenado —
            // ver nota em tipoLinhaReceitaResorts.
            valoresMensal: MESES.map((_, m) => valorLinhaMes({ ...(linhas.hospedagem || novaLinhaVazia()), premissaTipo: tipoLinhaReceitaResorts('hospedagem') }, m, null, null) - valorLinhaMes({ ...(linhas.cafePensao || novaLinhaVazia()), premissaTipo: tipoLinhaReceitaResorts('cafePensao') }, m, null, null)),
            totalValor: valorLinhaAnual({ ...(linhas.hospedagem || novaLinhaVazia()), premissaTipo: tipoLinhaReceitaResorts('hospedagem') }, null, null) - valorLinhaAnual({ ...(linhas.cafePensao || novaLinhaVazia()), premissaTipo: tipoLinhaReceitaResorts('cafePensao') }, null, null),
            cor: '#8A8F96',
          },
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
        linhas={deducoes.map(d => {
          // Bug de 2026-08-30: nunca confiar no premissaTipo armazenado —
          // ver nota em tipoLinhaReceitaResorts. Mesmo bug de "Preço (R$/t)"
          // (ver precoPonderadoProduto em AbaReceita): % de dedução não é
          // aditivo mês a mês — Total é o valor absoluto do ano / base do
          // ano (baseLinhaIds), não a soma dos percentuais mensais.
          const baseMes = MESES.map((_, m) =>
            (d.baseLinhaIds || []).reduce((s, id) => s + valorLinhaMes({ ...(linhas[id] || novaLinhaVazia()), premissaTipo: tipoLinhaReceitaResorts(id) }, m, null, null), 0)
          );
          const baseAnual = baseMes.reduce((a, v) => a + v, 0);
          const valorAbsAnual = MESES.reduce((acc, _, m) => acc + baseMes[m] * (parseNum(d.pcts?.[m]) / 100), 0);
          const pctPonderado = baseAnual > 0 ? (valorAbsAnual / baseAnual) * 100 : 0;
          return { key: d.id, label: d.nome, valores: d.pcts, totalValor: pctPonderado, formatarTotal: v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` };
        })}
        onChangeCelula={(dedId, mesIdx, valor) => {
          const d = deducoes.find(x => x.id === dedId);
          const novoArray = atualizarArray(d.pcts, mesIdx, valor);
          atualizar(['receita', 'deducoes'], deducoes.map(x => x.id === dedId ? { ...x, pcts: novoArray } : x));
        }}
        corTotal={COR.vermelho}
        sufixo="%"
        linhasCalculadas={deducoes.map(d => {
          // Bug de 2026-08-30: nunca confiar no premissaTipo armazenado —
          // ver nota em tipoLinhaReceitaResorts.
          const baseMes = MESES.map((_, m) =>
            (d.baseLinhaIds || []).reduce((s, id) => s + valorLinhaMes({ ...(linhas[id] || novaLinhaVazia()), premissaTipo: tipoLinhaReceitaResorts(id) }, m, null, null), 0)
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

// idx/valor podem ser um par escalar (edição de uma célula) ou um par de
// arrays do mesmo tamanho (colagem em lote — ver onPasteMensal): nesse caso
// aplica cada valor[i] na posição idx[i], todas de uma vez sobre a MESMA
// cópia do array. Isso importa porque cada onChangeCelula/onChange do app
// substitui o campo inteiro no estado (não faz merge) — se a colagem
// chamasse o callback uma vez por célula, cada chamada partiria do array
// de ANTES de colar (o React só re-renderiza depois que a função que
// disparou o paste termina), e a última célula colada apagaria as
// anteriores. Uma chamada só, com o array já mesclado, resolve isso.
function atualizarArray(arr, idx, valor) {
  const novo = [...(arr || mesesVazios())];
  if (Array.isArray(idx)) {
    idx.forEach((i, k) => { novo[i] = valor[k]; });
  } else {
    novo[idx] = valor;
  }
  return novo;
}

// Colar direto do Excel numa grade mensal (pedido de 2026-08-20): o gestor
// copia uma linha ou coluna de células da planilha de premissas dele e cola
// numa célula da grade — em vez de digitar mês a mês, os 12 valores entram
// de uma vez, a partir da célula onde colou. Excel copia uma seleção
// horizontal como texto separado por TAB e uma seleção vertical como texto
// separado por quebra de linha (uma célula só copiada não tem nem um nem
// outro, aí o comportamento nativo do input continua valendo). Números com
// vírgula decimal (padrão BR do Excel) chegam intactos — parseNum, usado em
// todo o motor de cálculo, já entende vírgula.
function valoresColados(textoColado) {
  const texto = (textoColado || '').replace(/\r/g, '');
  const partes = texto.includes('\t') ? texto.split('\t') : texto.split('\n');
  return partes.map(v => v.trim()).filter((v, i, arr) => !(v === '' && i === arr.length - 1 && arr.length > 1));
}
// setValoresMes(indices, valores) aplica o lote colado numa chamada só (ver
// nota em atualizarArray sobre por que não pode ser uma chamada por
// célula). mesInicial é o mês da célula onde o usuário colou; os valores
// colados preenchem esse mês em diante, truncando em Dez.
function onPasteMensal(e, mesInicial, setValoresMes) {
  const texto = e.clipboardData?.getData('text');
  if (!texto) return;
  const valores = valoresColados(texto);
  if (valores.length <= 1) return; // 1 célula só — deixa o paste nativo do input
  e.preventDefault();
  const indices = [];
  const valoresAplicaveis = [];
  valores.forEach((v, i) => {
    const mesIdx = mesInicial + i;
    if (mesIdx < 12) { indices.push(mesIdx); valoresAplicaveis.push(v); }
  });
  setValoresMes(indices, valoresAplicaveis);
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
            onPaste={e => onPasteMensal(e, mi, (idxs, vals2) => onChange(idxs, vals2))}
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

// Conteúdo de UMA sublinha — Selecao de premissa, grades mensais, avisos e
// justificativa. Extraído em 2026-08-23 do que era o corpo inteiro de
// LinhaConta, pra dar suporte a mais de uma sublinha por conta analítica
// (ver normalizarConta/novaContaVazia) sem duplicar toda essa lógica —
// LinhaConta (abaixo) chama isto uma vez por sublinha.
function LinhaSublinha({ sublinha, onUpdate, unidadeId, ipcaAnualPct, volumeTotalKgMes, receitaBrutaMes, receitaLiquidaMes }) {
  const valoresMensaisCalc = MESES.map((_, m) => valorSublinhaMes(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes));
  const incoerente = linhaIncoerente(sublinha);
  // "Custo/Despesa por kg" só aparece nas opções nas unidades com Volume em
  // toneladas na Receita (Têxtil/Agrícola) — ver UNIDADES_COM_CUSTO_POR_KG.
  const opcoesPremissa = TIPOS_PREMISSA.filter(t => t.id !== 'custo_por_kg' || UNIDADES_COM_CUSTO_POR_KG.includes(unidadeId));
  // Linha de referência não-editável do IPCA acumulado mês a mês, a partir
  // da premissa macro do FP&A Corporativo (ipcaAnualPct) — pedido de
  // 2026-08-20. Único (2026-08-23): a referência mostra 0% antes do mês
  // escolhido e o IPCA anual cheio dele em diante (sem composição).
  const ipcaAcumuladoMensal = sublinha.reajusteInflacaoTipo === 'unico'
    ? MESES.map((_, m) => {
        const idxReajuste = sublinha.reajusteInflacaoMes ? MESES.indexOf(sublinha.reajusteInflacaoMes) : -1;
        return (idxReajuste >= 0 && m >= idxReajuste) ? parseNum(ipcaAnualPct) : 0;
      })
    : MESES.map((_, m) => (Math.pow(1 + ipcaMensalDe(ipcaAnualPct), m + 1) - 1) * 100);

  return (
    <div>
      <div style={{ marginBottom: 8, maxWidth: 260 }}>
        <Selecao value={sublinha.premissaTipo} onChange={v => onUpdate('premissaTipo', v)} opcoes={opcoesPremissa} />
      </div>
      {/* Competência × caixa (2026-08-23, ver UNIDADES_COM_COMPETENCIA_CAIXA)
          — pergunta em toda conta analítica do Corporativo, pra dar
          insumo ao FC (a DRE nunca muda, é sempre em competência). */}
      {UNIDADES_COM_COMPETENCIA_CAIXA.includes(unidadeId) && (
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: COR.texto }}>O fato gerador (competência) desta despesa ocorre no mesmo mês do pagamento?</span>
          <div style={{ display: 'flex', border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
            <button
              onClick={() => onUpdate('pagamentoDiferente', false)}
              style={{
                fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '3px 10px', border: 'none', cursor: 'pointer',
                background: !sublinha.pagamentoDiferente ? COR.azul : COR.branco,
                color: !sublinha.pagamentoDiferente ? COR.branco : '#8A8F96',
              }}
            >Sim</button>
            <button
              onClick={() => onUpdate('pagamentoDiferente', true)}
              style={{
                fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '3px 10px', border: 'none', cursor: 'pointer',
                background: sublinha.pagamentoDiferente ? COR.laranja : COR.branco,
                color: sublinha.pagamentoDiferente ? COR.branco : '#8A8F96',
              }}
            >Não</button>
          </div>
        </div>
      )}
      {/* Reajuste único × mensal (2026-08-23): "mensal" compõe o IPCA
          mês a mês desde Janeiro (comportamento de sempre); "único"
          aplica o IPCA anual inteiro de uma vez só a partir de um mês
          escolhido. */}
      {sublinha.premissaTipo === 'reajuste_inflacao' && (
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: COR.texto }}>Reajuste:</span>
          <div style={{ display: 'flex', border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
            <button
              onClick={() => onUpdate('reajusteInflacaoTipo', 'unico')}
              style={{
                fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '3px 10px', border: 'none', cursor: 'pointer',
                background: sublinha.reajusteInflacaoTipo === 'unico' ? COR.azul : COR.branco,
                color: sublinha.reajusteInflacaoTipo === 'unico' ? COR.branco : '#8A8F96',
              }}
            >Único</button>
            <button
              onClick={() => onUpdate('reajusteInflacaoTipo', 'mensal')}
              style={{
                fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '3px 10px', border: 'none', cursor: 'pointer',
                background: sublinha.reajusteInflacaoTipo !== 'unico' ? COR.azul : COR.branco,
                color: sublinha.reajusteInflacaoTipo !== 'unico' ? COR.branco : '#8A8F96',
              }}
            >Mensal</button>
          </div>
          {sublinha.reajusteInflacaoTipo === 'unico' && (
            <div style={{ maxWidth: 160 }}>
              <Selecao
                value={sublinha.reajusteInflacaoMes} onChange={v => onUpdate('reajusteInflacaoMes', v)}
                opcoes={[{ id: '', nome: 'Mês do reajuste…' }, ...MESES.map(m => ({ id: m, nome: m }))]}
              />
            </div>
          )}
        </div>
      )}
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
            {sublinha.premissaTipo === 'direto' && (
              <GradeMensalLinha label="Valor (R$)" valores={sublinha.valores} onChange={(mi, v) => onUpdate('valores', atualizarArray(sublinha.valores, mi, v))} />
            )}
            {sublinha.premissaTipo === 'qtd_valor' && (
              <>
                <GradeMensalLinha label={`Quantidade${sublinha.unidadeMedida ? ` (${sublinha.unidadeMedida})` : ''}`} valores={sublinha.quantidades} onChange={(mi, v) => onUpdate('quantidades', atualizarArray(sublinha.quantidades, mi, v))} />
                <GradeMensalLinha label="Valor unit. (R$)" valores={sublinha.valoresUnit} onChange={(mi, v) => onUpdate('valoresUnit', atualizarArray(sublinha.valoresUnit, mi, v))} />
                <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {sublinha.premissaTipo === 'rateio' && (
              <>
                {sublinha.baseTipo === 'manual' && (
                  <GradeMensalLinha label="Base manual (R$)" valores={sublinha.baseManual} onChange={(mi, v) => onUpdate('baseManual', atualizarArray(sublinha.baseManual, mi, v))} />
                )}
                <GradeMensalLinha label="Percentual (%)" valores={sublinha.percentuais} onChange={(mi, v) => onUpdate('percentuais', atualizarArray(sublinha.percentuais, mi, v))} />
                <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {sublinha.premissaTipo === 'reajuste_inflacao' && (
              <>
                <LinhaCalculadaMensal
                  label={`IPCA ${sublinha.reajusteInflacaoTipo === 'unico' ? `único (${sublinha.reajusteInflacaoMes || 'sem mês'})` : 'acumulado'} (${ipcaAnualPct ? parseNum(ipcaAnualPct).toFixed(2) : '0,00'}% a.a.)`}
                  valoresMensal={ipcaAcumuladoMensal}
                  formatarCelula={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                  formatarTotal={() => `${ipcaAnualPct ? parseNum(ipcaAnualPct).toFixed(2) : '0,00'}%`}
                />
                <GradeMensalLinha label="Valor-base (R$)" valores={sublinha.valores} onChange={(mi, v) => onUpdate('valores', atualizarArray(sublinha.valores, mi, v))} />
                <LinhaCalculadaMensal label="Valor projetado (R$)" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {sublinha.premissaTipo === 'custo_por_kg' && (
              <>
                <LinhaCalculadaMensal
                  label="Volume total (kg) — da Receita"
                  valoresMensal={volumeTotalKgMes || Array(12).fill(0)}
                  formatarCelula={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`}
                  formatarTotal={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`}
                />
                <GradeMensalLinha label="Valor unit. (R$/kg)" valores={sublinha.valoresUnit} onChange={(mi, v) => onUpdate('valoresUnit', atualizarArray(sublinha.valoresUnit, mi, v))} />
                <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {UNIDADES_COM_COMPETENCIA_CAIXA.includes(unidadeId) && sublinha.pagamentoDiferente && (
              <GradeMensalLinha
                label="Valor do pagamento — caixa (R$)"
                valores={sublinha.valoresPagamento}
                onChange={(mi, v) => onUpdate('valoresPagamento', atualizarArray(sublinha.valoresPagamento, mi, v))}
              />
            )}
          </tbody>
        </table>
      </div>
      {sublinha.premissaTipo === 'reajuste_inflacao' && (
        <p style={{ fontSize: 10, color: '#8A8F96', marginTop: -4, marginBottom: 8 }}>
          IPCA vem da premissa macro do FP&A Corporativo (tela "Gestão do Orçamento"). O gestor digita o valor-base mensal (R$);
          {sublinha.reajusteInflacaoTipo === 'unico'
            ? ' no modo Único, o sistema aplica o IPCA anual inteiro de uma vez só a partir do mês escolhido (sem reajuste antes dele).'
            : ' no modo Mensal, o sistema aplica o reajuste acumulado mês a mês a partir de Janeiro automaticamente.'}
        </p>
      )}
      {sublinha.premissaTipo === 'custo_por_kg' && (
        <p style={{ fontSize: 10, color: '#8A8F96', marginTop: -4, marginBottom: 8 }}>
          Volume vem da aba Receita (soma dos produtos, toneladas × 1000). O gestor digita o R$/kg; o valor calculado é Volume (kg) × R$/kg.
        </p>
      )}
      {UNIDADES_COM_COMPETENCIA_CAIXA.includes(unidadeId) && sublinha.pagamentoDiferente && (
        <p style={{ fontSize: 10, color: '#8A8F96', marginTop: -4, marginBottom: 8 }}>
          A DRE continua usando o valor de competência (acima). O valor do pagamento (caixa) alimenta só o Fluxo de Caixa — aba Revisão, Análise e Envio.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {sublinha.premissaTipo === 'qtd_valor' && (
          <div style={{ maxWidth: 260, flex: 1 }}>
            <CampoTexto value={sublinha.unidadeMedida} onChange={v => onUpdate('unidadeMedida', v)} placeholder="Unidade de medida (ex.: kg, kWh, viagens)" />
          </div>
        )}
        {sublinha.premissaTipo === 'rateio' && (
          <div style={{ maxWidth: 260, flex: 1 }}>
            <Selecao value={sublinha.baseTipo} onChange={v => onUpdate('baseTipo', v)} opcoes={BASES_RATEIO} />
          </div>
        )}
      </div>
      {incoerente && (
        <div style={{ fontSize: 10.5, color: COR.vermelho, marginBottom: 6 }}>
          Há mês com apenas um dos dois campos da premissa preenchido — revisar antes de enviar.
        </div>
      )}
      <CampoJustificativa value={sublinha.justificativa} onChange={v => onUpdate('justificativa', v)} />
    </div>
  );
}

// Conta analítica — cabeçalho (código/nome/classificação/total) e, aberta,
// uma ou mais sublinhas (2026-08-23, "se o gestor quiser incluir mais de
// uma linha dentro de cada despesa, ex.: por fornecedor" — ver
// normalizarConta/novaContaVazia/LinhaSublinha acima). `linha` aqui é a
// CONTA inteira (não mais uma linha só) — normalizarConta aceita os dois
// formatos, então dado já salvo antes desta mudança continua funcionando
// sem migração.
function LinhaConta({ conta, linha, aberta, onToggle, onUpdateClassificacao, onUpdateSublinha, onAddSublinha, onRemoveSublinha, total, receitaBrutaMes, receitaLiquidaMes, ocultarClassificacao, unidadeId, ipcaAnualPct, volumeTotalKgMes }) {
  const contaNorm = normalizarConta(linha);
  const incoerente = contaNorm.sublinhas.some(s => linhaIncoerente(s));
  const multiplas = contaNorm.sublinhas.length > 1;

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
          {multiplas && <span style={{ fontSize: 9.5, fontWeight: 700, color: COR.azul, background: COR.claro, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{contaNorm.sublinhas.length} linhas</span>}
          {incoerente && <AlertTriangle size={13} color={COR.vermelho} style={{ flexShrink: 0 }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!ocultarClassificacao && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ display: 'flex', border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}
            >
              <button
                onClick={() => onUpdateClassificacao('fixo')}
                style={{
                  fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '2px 8px', border: 'none', cursor: 'pointer',
                  background: contaNorm.classificacao === 'fixo' ? COR.azul : COR.branco,
                  color: contaNorm.classificacao === 'fixo' ? COR.branco : '#8A8F96',
                }}
              >Fixo</button>
              <button
                onClick={() => onUpdateClassificacao('variavel')}
                style={{
                  fontFamily: FONT, fontSize: 9.5, fontWeight: 700, padding: '2px 8px', border: 'none', cursor: 'pointer',
                  background: contaNorm.classificacao === 'variavel' ? COR.laranja : COR.branco,
                  color: contaNorm.classificacao === 'variavel' ? COR.branco : '#8A8F96',
                }}
              >Variável</button>
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: total > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(total)}</span>
        </div>
      </button>
      {aberta && (
        <div style={{ padding: '10px 10px 12px', borderTop: `1px solid ${COR.borda}` }}>
          {contaNorm.sublinhas.map((sub, i) => (
            <div key={sub.id} style={{ border: multiplas ? `1px solid ${COR.borda}` : 'none', borderRadius: multiplas ? 6 : 0, padding: multiplas ? 8 : 0, marginBottom: multiplas ? 10 : 0, background: multiplas ? COR.claro : 'transparent' }}>
              {multiplas && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: COR.azul }}>Linha {i + 1}</span>
                  <button onClick={() => onRemoveSublinha(sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COR.vermelho }}><Trash2 size={13} /></button>
                </div>
              )}
              <div style={{ marginBottom: 8, maxWidth: 300 }}>
                <CampoTexto
                  value={sub.descricao} onChange={v => onUpdateSublinha(sub.id, 'descricao', v)}
                  placeholder="Descrição (obrigatória — ex.: nome do fornecedor)" erro={!(sub.descricao || '').trim()}
                />
              </div>
              <LinhaSublinha
                sublinha={sub}
                onUpdate={(campo, valor) => onUpdateSublinha(sub.id, campo, valor)}
                unidadeId={unidadeId} ipcaAnualPct={ipcaAnualPct} volumeTotalKgMes={volumeTotalKgMes}
                receitaBrutaMes={receitaBrutaMes} receitaLiquidaMes={receitaLiquidaMes}
              />
            </div>
          ))}
          {/* Múltiplas linhas por conta (2026-08-23): "se o gestor quiser
              incluir mais de uma linha dentro de cada despesa, ex.: por
              fornecedor". Cada sublinha tem sua própria premissa/grade
              mensal independente; o total da conta soma todas. */}
          <Botao variante="fantasma" icone={Plus} onClick={onAddSublinha}>+ Adicionar linha (ex.: outro fornecedor)</Botao>
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
// Mirror somente-leitura de LinhaSublinha (2026-08-23) — mesma extração,
// mesmo motivo: suportar mais de uma sublinha por conta nas telas de
// Revisão/Versão/Consolidado sem duplicar a lógica de exibição.
function LinhaSublinhaLeitura({ sublinha, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes }) {
  const valoresMensaisCalc = MESES.map((_, m) => valorSublinhaMes(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes));
  const formatarPct = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  const ipcaAcumuladoMensal = sublinha.reajusteInflacaoTipo === 'unico'
    ? MESES.map((_, m) => {
        const idxReajuste = sublinha.reajusteInflacaoMes ? MESES.indexOf(sublinha.reajusteInflacaoMes) : -1;
        return (idxReajuste >= 0 && m >= idxReajuste) ? parseNum(ipcaAnualPct) : 0;
      })
    : MESES.map((_, m) => (Math.pow(1 + ipcaMensalDe(ipcaAnualPct), m + 1) - 1) * 100);
  return (
    <div>
      <div style={{ fontSize: 10.5, color: '#7A8088', marginBottom: 8 }}>
        {sublinha.descricao && <><b style={{ color: COR.texto }}>{sublinha.descricao}</b> — </>}
        Premissa: <b style={{ color: COR.texto }}>{TIPOS_PREMISSA.find(t => t.id === sublinha.premissaTipo)?.nome || sublinha.premissaTipo}</b>
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
            {sublinha.premissaTipo === 'direto' && (
              <LinhaCalculadaMensal label="Valor (R$)" valoresMensal={(sublinha.valores || mesesVazios()).map(parseNum)} />
            )}
            {sublinha.premissaTipo === 'qtd_valor' && (
              <>
                <LinhaCalculadaMensal label={`Quantidade${sublinha.unidadeMedida ? ` (${sublinha.unidadeMedida})` : ''}`} valoresMensal={(sublinha.quantidades || mesesVazios()).map(parseNum)} formatarCelula={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} />
                <LinhaCalculadaMensal label="Valor unit. (R$)" valoresMensal={(sublinha.valoresUnit || mesesVazios()).map(parseNum)} />
                <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {sublinha.premissaTipo === 'rateio' && (
              <>
                {sublinha.baseTipo === 'manual' && (
                  <LinhaCalculadaMensal label="Base manual (R$)" valoresMensal={(sublinha.baseManual || mesesVazios()).map(parseNum)} />
                )}
                <LinhaCalculadaMensal label={`Percentual — base: ${BASES_RATEIO.find(b => b.id === sublinha.baseTipo)?.nome || sublinha.baseTipo}`} valoresMensal={(sublinha.percentuais || mesesVazios()).map(parseNum)} formatarCelula={formatarPct} />
                <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {sublinha.premissaTipo === 'reajuste_inflacao' && (
              <>
                <LinhaCalculadaMensal
                  label={`IPCA ${sublinha.reajusteInflacaoTipo === 'unico' ? `único (${sublinha.reajusteInflacaoMes || '—'})` : 'acumulado'} (${ipcaAnualPct ? parseNum(ipcaAnualPct).toFixed(2) : '0,00'}% a.a.)`}
                  valoresMensal={ipcaAcumuladoMensal}
                  formatarCelula={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                  formatarTotal={() => `${ipcaAnualPct ? parseNum(ipcaAnualPct).toFixed(2) : '0,00'}%`}
                />
                <LinhaCalculadaMensal label="Valor-base (R$)" valoresMensal={(sublinha.valores || mesesVazios()).map(parseNum)} />
                <LinhaCalculadaMensal label="Valor projetado (R$)" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {sublinha.premissaTipo === 'custo_por_kg' && (
              <>
                <LinhaCalculadaMensal
                  label="Volume total (kg) — da Receita"
                  valoresMensal={volumeTotalKgMes || Array(12).fill(0)}
                  formatarCelula={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`}
                  formatarTotal={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`}
                />
                <LinhaCalculadaMensal label="Valor unit. (R$/kg)" valoresMensal={(sublinha.valoresUnit || mesesVazios()).map(parseNum)} />
                <LinhaCalculadaMensal label="Valor calculado" valoresMensal={valoresMensaisCalc} />
              </>
            )}
            {sublinha.pagamentoDiferente && (
              <LinhaCalculadaMensal label="Valor do pagamento — caixa (R$)" valoresMensal={(sublinha.valoresPagamento || mesesVazios()).map(parseNum)} />
            )}
          </tbody>
        </table>
      </div>
      {sublinha.pagamentoDiferente && (
        <p style={{ fontSize: 10, color: '#8A8F96', marginTop: -4, marginBottom: 8 }}>
          Fato gerador (competência) em mês diferente do pagamento — a DRE usa o valor de competência acima; o Fluxo de Caixa usa o valor do pagamento.
        </p>
      )}
      {sublinha.justificativa && (
        <div style={{ fontSize: 10.5, color: COR.texto, background: COR.claro, borderRadius: 6, padding: 8 }}>
          <b>Justificativa:</b> {sublinha.justificativa}
        </div>
      )}
    </div>
  );
}

function LinhaContaLeitura({ conta, linha, aberta, onToggle, total, receitaBrutaMes, receitaLiquidaMes, ocultarClassificacao, ipcaAnualPct, volumeTotalKgMes }) {
  const contaNorm = normalizarConta(linha);
  const multiplas = contaNorm.sublinhas.length > 1;
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
          {multiplas && <span style={{ fontSize: 9.5, fontWeight: 700, color: COR.azul, background: COR.claro, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{contaNorm.sublinhas.length} linhas</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!ocultarClassificacao && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8A8F96' }}>{contaNorm.classificacao === 'variavel' ? 'Variável' : 'Fixo'}</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color: total > 0 ? COR.azul : '#B5B9BE' }}>{formatBRL(total)}</span>
        </div>
      </button>
      {aberta && (
        <div style={{ padding: '10px 10px 12px', borderTop: `1px solid ${COR.borda}` }}>
          {contaNorm.sublinhas.map((sub, i) => (
            <div key={sub.id} style={{ border: multiplas ? `1px solid ${COR.borda}` : 'none', borderRadius: multiplas ? 6 : 0, padding: multiplas ? 8 : 0, marginBottom: multiplas ? 10 : 0, background: multiplas ? COR.claro : 'transparent' }}>
              {multiplas && <div style={{ fontSize: 10.5, fontWeight: 700, color: COR.azul, marginBottom: 8 }}>Linha {i + 1}</div>}
              <LinhaSublinhaLeitura sublinha={sub} receitaBrutaMes={receitaBrutaMes} receitaLiquidaMes={receitaLiquidaMes} ipcaAnualPct={ipcaAnualPct} volumeTotalKgMes={volumeTotalKgMes} />
            </div>
          ))}
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

function QuadroPessoal({ ccCodigo, unidadeId, funcionarios, addFuncionario, updateFuncionario, removeFuncionario, premissasPessoal, updatePremissaPessoal, folha, onImportarLote }) {
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
      <div style={{ display: 'flex', gap: 8 }}>
        <Botao variante="fantasma" icone={Plus} onClick={() => addFuncionario(ccCodigo)}>Adicionar funcionário (Novo Headcount)</Botao>
      </div>

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
        <div>
          <Rotulo>Meritocracia (% sobre salários)</Rotulo>
          <CampoNumero value={premissasPessoal.meritocraciaPct} onChange={v => updatePremissaPessoal('meritocraciaPct', v)} sufixo="%" placeholder="0,0" />
        </div>
      </div>
      <p style={{ fontSize: 10.5, color: '#8A8F96', marginBottom: 12 }}>
        13º salário é provisionado mês a mês por competência (1/12 do salário, acima). No fluxo de caixa (aba Revisão, Análise e Envio), o pagamento é reconhecido metade em novembro e metade em dezembro.
      </p>

      <h5 style={{ fontSize: 11.5, color: COR.azul, marginBottom: 8 }}>Dissídio</h5>
      <p style={{ fontSize: 10.5, color: '#8A8F96', marginBottom: 8 }}>
        A partir do mês escolhido (inclusive), o salário de todo mundo na unidade sobe pelo % informado — INSS/FGTS/Férias/13º/Meritocracia (tudo % sobre salário) já refletem automaticamente o valor reajustado. Sem mês escolhido, nenhum reajuste é aplicado.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <div>
          <Rotulo>Mês do dissídio</Rotulo>
          <Selecao
            value={premissasPessoal.dissidioMes} onChange={v => updatePremissaPessoal('dissidioMes', v)}
            opcoes={[{ id: '', nome: 'Sem dissídio' }, ...MESES.map(m => ({ id: m, nome: m }))]}
          />
        </div>
        <div>
          <Rotulo>Reajuste do dissídio</Rotulo>
          <CampoNumero value={premissasPessoal.dissidioPct} onChange={v => updatePremissaPessoal('dissidioPct', v)} sufixo="%" placeholder="0,0" />
        </div>
      </div>

      <h5 style={{ fontSize: 11.5, color: COR.azul, marginBottom: 8 }}>CLT — Folha calculada — {ccCodigo}, mês a mês (Existente + Novo Headcount)</h5>
      <TabelaMensal
        linhas={[]}
        onChangeCelula={() => {}}
        linhasCalculadas={[
          { key: 'salarios', label: 'Salários (CLT, já com dissídio se houver)', valoresMensal: folha.mensal.map(m => m.salarios), totalValor: folha.mensal.reduce((a, m) => a + m.salarios, 0), cor: COR.texto },
          { key: 'encargos', label: 'Encargos (INSS+FGTS+Férias)', valoresMensal: folha.mensal.map(m => m.encargos), totalValor: folha.mensal.reduce((a, m) => a + m.encargos, 0), cor: COR.texto },
          { key: 'decimo', label: '13º salário (provisão mensal)', valoresMensal: folha.mensal.map(m => m.decimoTerceiro), totalValor: folha.decimoTerceiroAnual, cor: COR.texto },
          { key: 'meritocracia', label: 'Meritocracia', valoresMensal: folha.mensal.map(m => m.meritocracia), totalValor: folha.mensal.reduce((a, m) => a + m.meritocracia, 0), cor: COR.texto },
          { key: 'beneficios', label: 'Benefícios', valoresMensal: folha.mensal.map(m => m.beneficios), totalValor: folha.mensal.reduce((a, m) => a + m.beneficios, 0), cor: COR.texto },
          { key: 'total', label: 'Total da folha CLT', valoresMensal: folha.mensal.map(m => m.total), totalValor: folha.totalAnual, cor: COR.azul },
        ]}
      />
    </div>
  );
}

// Seletor de CC (2026-08-23, item 1: "como as empresas possuem muitos CCs...
// procure outra forma de apresentar a lista de CCs sem poluir o visual") —
// quando a unidade tem hierarquia de área (nível 2/3, hoje só Agrícola e
// Resorts — ver CCS_AGRICOLA/CCS_RESORTS), agrupa os CCs-folha (nível 3)
// dentro do próprio pill da área (nível 2), escondidos por padrão — declara
// só as ~10 pills de área em vez dos ~35 pills soltos do antigo layout
// flat. Sem hierarquia (Têxtil/Corporativo), mantém a lista simples de
// sempre — nada muda pra essas unidades.
// Redesenhado em 2026-08-25 (pedido: "visão de agrupamento dos CC na ARA
// Agrícola está muito confusa") — o problema do layout anterior era permitir
// várias áreas abertas ao mesmo tempo, cada uma virando uma fileira de pills
// dentro de outra fileira de pills, tudo quebrando linha junto: em unidades
// com muitas áreas/CCs (Agrícola: 9 áreas, até 12 filhos numa só — Uva
// Terceiros; Resorts: parecido) virava uma parede sem hierarquia visual
// clara. Agora é um accordion de UMA área aberta por vez: primeira fileira
// só com as áreas (nível 2), fileira de baixo mostra só os CCs da área
// selecionada — like breadcrumb de 2 níveis, não uma lista plana.
function SeletorCcs({ ccs, ccSel, onSelect }) {
  const temHierarquia = ccs.some(cc => cc.nivel === 2);
  const areas = temHierarquia ? ccs.filter(cc => cc.nivel === 2) : [];
  const areaDoSelecionado = ccs.find(cc => cc.codigo === ccSel)?.areaCodigo || (areas.some(a => a.codigo === ccSel) ? ccSel : null);
  const [areaAberta, setAreaAberta] = useState(areaDoSelecionado || areas[0]?.codigo || null);

  // Se o CC selecionado mudar por fora (ex.: outro componente chama onSelect
  // programaticamente) e cair numa área diferente da aberta, acompanha —
  // sem isso o accordion podia ficar mostrando uma área sem o CC ativo nela.
  useEffect(() => {
    if (areaDoSelecionado && areaDoSelecionado !== areaAberta) setAreaAberta(areaDoSelecionado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccSel]);

  function Pill({ cc, tamanho }) {
    const selecionado = cc.codigo === ccSel;
    return (
      <button onClick={() => onSelect(cc.codigo)}
        style={{
          fontFamily: FONT, fontSize: tamanho === 'grande' ? 12 : 11.5, fontWeight: 700, padding: tamanho === 'grande' ? '8px 14px' : '7px 12px', borderRadius: 16, cursor: 'pointer',
          border: `1.5px solid ${selecionado ? COR.azul : COR.borda}`,
          background: selecionado ? COR.azul : COR.branco, color: selecionado ? COR.branco : COR.texto,
        }}
      >{cc.nome}{cc.nivel === 2 ? ' · Consolidador' : cc.tipo === 'producao' ? ' · CPV' : ' · Despesa'}</button>
    );
  }

  if (!temHierarquia) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ccs.map(cc => <Pill key={cc.codigo} cc={cc} />)}
      </div>
    );
  }

  const filhosDaAreaAberta = ccs.filter(cc => cc.areaCodigo === areaAberta);
  const areaAtual = areas.find(a => a.codigo === areaAberta);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A8F96', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
        1. Área
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {areas.map(area => {
          const filhos = ccs.filter(cc => cc.areaCodigo === area.codigo);
          const areaSelecionada = area.codigo === areaAberta;
          const filhoSelecionado = filhos.some(f => f.codigo === ccSel) || area.codigo === ccSel;
          return (
            <button
              key={area.codigo}
              onClick={() => setAreaAberta(area.codigo)}
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                border: `1.5px solid ${areaSelecionada ? COR.azul : COR.borda}`,
                background: areaSelecionada ? COR.claro : COR.branco,
                color: filhoSelecionado ? COR.azul : COR.texto,
              }}
            >
              {areaSelecionada ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {area.nome}
              {filhos.length > 0 && <span style={{ fontSize: 9.5, fontWeight: 400, color: '#8A8F96' }}>({filhos.length})</span>}
            </button>
          );
        })}
      </div>
      {areaAtual && (
        <div style={{ background: COR.claro, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A8F96', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
            2. Centro de Custo em {areaAtual.nome}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill cc={areaAtual} tamanho="grande" />
            {filhosDaAreaAberta.map(f => <Pill key={f.codigo} cc={f} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// Consolidado por pacote (2026-08-23, revisado a pedido: "agrupe Pacote >
// Conta analítica > Centro de Custo") — 3 níveis de accordion, só Admin
// FP&A (ver gate em AbaCustos). Pessoal ganha uma sublinha sintética "CLT —
// Folha calculada" (a folha nunca é uma conta em custos.linhas) antes das
// contas analíticas de verdade do pacote (ex.: Consultórias PJs, só
// Corporativo — ver CONTA_CONSULTORIA_PJ).
function VisaoConsolidadaPorPacote({ refUnidade, ccsConsolidado, totalContaMesCC, folhaCC }) {
  const [pacotesAbertos, setPacotesAbertos] = useState({});
  const [contasAbertas, setContasAbertas] = useState({});

  function ccsDaConta(conta) {
    const tipoAlvo = conta.origem === 'Custo' ? 'producao' : 'despesa';
    return ccsConsolidado.filter(cc => cc.tipo === tipoAlvo);
  }
  function totalContaMes(conta, m) {
    return ccsDaConta(conta).reduce((acc, cc) => acc + totalContaMesCC(cc.codigo, conta.codigo, m), 0);
  }
  function totalContaAnual(conta) {
    return MESES.reduce((acc, _, m) => acc + totalContaMes(conta, m), 0);
  }
  function totalFolhaMes(m) {
    return ccsConsolidado.reduce((acc, cc) => acc + (folhaCC(cc.codigo).mensal[m]?.total || 0), 0);
  }
  function totalPacoteMes(pacoteId, m) {
    const contas = refUnidade.planoContas[pacoteId] || [];
    const totalContas = contas.reduce((acc, c) => acc + totalContaMes(c, m), 0);
    return totalContas + (pacoteId === 'pessoal' ? totalFolhaMes(m) : 0);
  }
  function totalPacoteAnual(pacoteId) {
    return MESES.reduce((acc, _, m) => acc + totalPacoteMes(pacoteId, m), 0);
  }

  function Linha({ label, valoresMensal, total, indent, onClick, aberto, temFilhos, cor, bold, bg }) {
    return (
      <tr style={{ background: bg || COR.branco }}>
        <td
          onClick={onClick}
          style={{
            fontWeight: bold ? 700 : 400, fontSize: 11.5, padding: '6px 10px', paddingLeft: 10 + (indent || 0) * 18,
            border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: bg || COR.branco,
            color: cor || COR.texto, cursor: onClick ? 'pointer' : 'default',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {temFilhos && (aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
            {label}
          </span>
        </td>
        {valoresMensal.map((v, mi) => (
          <td key={mi} style={{ padding: '6px 6px', border: `1px solid ${COR.borda}`, fontSize: 10.5, textAlign: 'right', color: cor || COR.texto, fontWeight: bold ? 700 : 400 }}>
            {formatBRL(v)}
          </td>
        ))}
        <td style={{ padding: '6px 8px', border: `1px solid ${COR.borda}`, fontWeight: 700, fontSize: 11, color: cor || COR.azul, textAlign: 'right' }}>
          {formatBRL(total)}
        </td>
      </tr>
    );
  }

  const totalUnidadeMes = MESES.map((_, m) => refUnidade.pacotes.reduce((acc, p) => acc + totalPacoteMes(p.id, m), 0));
  const totalUnidadeAnual = totalUnidadeMes.reduce((a, v) => a + v, 0);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '7px 10px', textAlign: 'left', minWidth: 230, position: 'sticky', left: 0 }}>Pacote / Conta / CC</th>
            {MESES.map(m => <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '7px 4px', minWidth: 58 }}>{m}</th>)}
            <th style={{ background: COR.laranja, color: COR.branco, fontSize: 10, padding: '7px 8px', minWidth: 84 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {refUnidade.pacotes.map(p => {
            const pAberto = !!pacotesAbertos[p.id];
            const contas = refUnidade.planoContas[p.id] || [];
            return (
              <React.Fragment key={p.id}>
                <Linha
                  label={p.nome} valoresMensal={MESES.map((_, m) => totalPacoteMes(p.id, m))} total={totalPacoteAnual(p.id)}
                  onClick={() => setPacotesAbertos(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  aberto={pAberto} temFilhos bold cor={COR.azul}
                />
                {pAberto && p.id === 'pessoal' && (
                  <React.Fragment>
                    <Linha
                      label="CLT — Folha calculada" valoresMensal={MESES.map((_, m) => totalFolhaMes(m))} total={MESES.reduce((acc, _, m) => acc + totalFolhaMes(m), 0)}
                      indent={1} onClick={() => setContasAbertas(prev => ({ ...prev, __folha__: !prev.__folha__ }))}
                      aberto={!!contasAbertas.__folha__} temFilhos
                    />
                    {contasAbertas.__folha__ && ccsConsolidado.map(cc => (
                      <Linha
                        key={cc.codigo} label={cc.nome} indent={2} cor="#8A8F96" bg={COR.claro}
                        valoresMensal={MESES.map((_, m) => folhaCC(cc.codigo).mensal[m]?.total || 0)}
                        total={folhaCC(cc.codigo).totalAnual}
                      />
                    ))}
                  </React.Fragment>
                )}
                {pAberto && contas.map(c => {
                  const chaveConta = `${p.id}|${c.codigo}`;
                  const cAberto = !!contasAbertas[chaveConta];
                  const ccs = ccsDaConta(c);
                  return (
                    <React.Fragment key={c.codigo}>
                      <Linha
                        label={c.nome} valoresMensal={MESES.map((_, m) => totalContaMes(c, m))} total={totalContaAnual(c)}
                        indent={1} onClick={() => setContasAbertas(prev => ({ ...prev, [chaveConta]: !prev[chaveConta] }))}
                        aberto={cAberto} temFilhos
                      />
                      {cAberto && ccs.map(cc => (
                        <Linha
                          key={cc.codigo} label={cc.nome} indent={2} cor="#8A8F96" bg={COR.claro}
                          valoresMensal={MESES.map((_, m) => totalContaMesCC(cc.codigo, c.codigo, m))}
                          total={MESES.reduce((acc, _, m) => acc + totalContaMesCC(cc.codigo, c.codigo, m), 0)}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
          <Linha label="Total da unidade" valoresMensal={totalUnidadeMes} total={totalUnidadeAnual} bold cor={COR.laranja} />
        </tbody>
      </table>
    </div>
  );
}

function AbaCustos({ refUnidade, unidadeId, usuario, linhas, updateConta, updateSublinha, addSublinha, removeSublinha, dre, ipcaAnualPct, detalhes, addDetalhe, updateDetalhe, removeDetalhe, funcionarios, addFuncionario, updateFuncionario, removeFuncionario, premissasPessoal, updatePremissaPessoal, importarFuncionariosLote, viagens, atualizar }) {
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
  // Consolidado por pacote (2026-08-23, item 1: "incluir uma visão
  // consolidada dos CCs por pacote") — fechado por padrão, some abaixo do
  // seletor de CC.
  const [mostrarConsolidado, setMostrarConsolidado] = useState(false);

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
  function folhaCC(ccCodigo) {
    const funcs = (funcionarios || []).filter(f => f.ccCodigo === ccCodigo);
    return computeFolhaPessoalAnual(funcs, premissasPessoal);
  }
  // Versões parametrizadas por CC (não só o ccSel selecionado) — usadas na
  // visão consolidadora do CC sintético (2026-08-20, ARA Agrícola: cada
  // área tem um CC "AREA" que soma os CCs analíticos dela — ver
  // CCS_AGRICOLA/areaCodigo). Cada CC filha pode ter tipo diferente do pai
  // (ex.: Transporte de Pessoal é 'Custo' dentro de uma área majoritariamente
  // 'Adm'), por isso a origem é resolvida por CC, não herdada da área.
  function totalContaAnualCC(ccCodigo, contaCodigo) {
    return valorLinhaAnual(linhas[`${ccCodigo}|${contaCodigo}`], dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
  }
  function totalContaMesCC(ccCodigo, contaCodigo, m) {
    return valorLinhaMes(linhas[`${ccCodigo}|${contaCodigo}`], m, dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
  }
  function contasDoCc(cc) {
    const origem = cc.tipo === 'producao' ? 'Custo' : 'Despesa';
    return refUnidade.pacotes.flatMap(p => (refUnidade.planoContas[p.id] || []).filter(c => c.origem === origem));
  }
  function totalCcAnual(ccCodigo) {
    const cc = refUnidade.ccs.find(c => c.codigo === ccCodigo);
    if (!cc) return 0;
    return contasDoCc(cc).reduce((acc, c) => acc + totalContaAnualCC(ccCodigo, c.codigo), 0) + folhaCC(ccCodigo).totalAnual;
  }
  function totalCcMes(ccCodigo, m) {
    const cc = refUnidade.ccs.find(c => c.codigo === ccCodigo);
    if (!cc) return 0;
    return contasDoCc(cc).reduce((acc, c) => acc + totalContaMesCC(ccCodigo, c.codigo, m), 0) + (folhaCC(ccCodigo).mensal[m]?.total || 0);
  }
  function totalConta(contaCodigo) { return totalContaAnualCC(ccSel, contaCodigo); }
  function totalContaMes(contaCodigo, m) { return totalContaMesCC(ccSel, contaCodigo, m); }
  function totalPacoteMes(contas, m) {
    return contas.reduce((acc, c) => acc + totalContaMes(c.codigo, m), 0);
  }
  // Consolidado por pacote (2026-08-23, item 1) — soma TODOS os CCs
  // visíveis ao usuário. Só os CCs-folha (nível 3 ou sem nível) somam de
  // verdade — o nível 2 (área/consolidador) é uma visão derivada, nunca
  // guarda lançamento próprio (mesmo racional do bloco "CC sintético"
  // logo abaixo). Cálculo em si (Pacote > Conta > CC) mora em
  // VisaoConsolidadaPorPacote, só Admin FP&A — ver gate no render.
  const ccsConsolidado = ccsVisiveis.filter(cc => !cc.nivel || cc.nivel === 3);

  // CC sintético/consolidador (nivel:2 — só existe na ARA Agrícola por
  // enquanto, ver CCS_AGRICOLA): pedido de 2026-08-20, "o gestor do CC
  // precisa ter acesso o CC sintético consolidador e a visão a analítica" —
  // é uma visão consolidada somando os CCs analíticos da área, não um alvo
  // de lançamento (lançar direto nele duplicaria o que já está nos filhos).
  if (ccAtual.nivel === 2) {
    const filhos = refUnidade.ccs.filter(c => c.areaCodigo === ccAtual.codigo);
    const totalMes = MESES.map((_, m) => filhos.reduce((acc, f) => acc + totalCcMes(f.codigo, m), 0));
    const totalAnual = totalMes.reduce((a, v) => a + v, 0);
    return (
      <div>
        <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>3. Custos e Despesas — por conta analítica (OBZ)</h3>
        <SeletorCcs ccs={ccsVisiveis} ccSel={ccSel} onSelect={setCcSel} />
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Info size={17} color={COR.laranja} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: COR.texto }}>
            <b>{ccAtual.nome}</b> é o CC sintético da área — soma automática dos {filhos.length} CC(s) analítico(s) abaixo.
            O lançamento de premissas acontece neles, não aqui (evita contar o mesmo custo duas vezes).
          </div>
        </div>
        <TabelaMensal
          linhas={[]}
          onChangeCelula={() => {}}
          corTotal={COR.azul}
          linhasCalculadas={[
            ...filhos.map(f => ({
              key: f.codigo, label: f.nome,
              valoresMensal: MESES.map((_, m) => totalCcMes(f.codigo, m)),
              totalValor: totalCcAnual(f.codigo),
              cor: COR.texto,
            })),
            { key: '__total__', label: `Total ${ccAtual.nome}`, valoresMensal: totalMes, totalValor: totalAnual, cor: COR.laranja },
          ]}
        />
      </div>
    );
  }

  // Contas analíticas mapeadas pra este CC (De/Para Camadas.xlsx, só ARA
  // Agrícola) — undefined quando o CC ainda não tem essa planilha de
  // origem (áreas fora da Fazenda). Nesse caso não inventamos contas: o CC
  // fica com acesso criado (estrutura/usuário), mas sem lançamento, até o
  // FP&A trazer o De/Para dessa área.
  const contasMapeadasCC = (unidadeId === 'agricola_tds' || unidadeId === 'agricola_fds')
    ? CONTAS_POR_CC_AGRICOLA[ccAtual.codigo]
    : undefined;
  const semContasMapeadas = (unidadeId === 'agricola_tds' || unidadeId === 'agricola_fds') && !contasMapeadasCC;
  // Pedido de 2026-08-19 — só Corporativo, conta CONTA_VIAGENS_CALCULADORA:
  // grava a lista de viagens do CC e sincroniza o total calculado (mesma
  // fórmula da linha 6 de Viagens.xlsx) direto em custos.linhas, como uma
  // linha 'direto' comum — o resto do motor de cálculo (DRE, auditoria,
  // log de alteração) não precisa saber que essa conta tem tela própria.
  function updateViagensCC(novoArray) {
    atualizar(['custos', 'viagens', ccSel], novoArray);
    const chave = chaveLinha(CONTA_VIAGENS_CALCULADORA);
    // Tela dedicada, sem LinhaConta — mas normaliza mesmo assim (defensivo,
    // 2026-08-23): se por algum motivo essa conta já tiver ganhado mais de
    // uma sublinha, sincroniza só a primeira em vez de sobrescrever a
    // conta inteira com um objeto plano incompatível.
    const contaNorm = normalizarConta(linhas[chave]);
    const [primeira, ...resto] = contaNorm.sublinhas;
    const sublinhaAtualizada = { ...primeira, premissaTipo: 'direto', valores: computeViagensMes(novoArray) };
    atualizar(['custos', 'linhas', chave], { ...contaNorm, sublinhas: [sublinhaAtualizada, ...resto] });
  }
  function togglePacote(pacoteId) {
    setPacotesAbertos(prev => ({ ...prev, [pacoteId]: !prev[pacoteId] }));
  }
  function toggleConta(contaCodigo) {
    const chave = chaveLinha(contaCodigo);
    setContaAberta(prev => (prev === chave ? null : chave));
  }

  if (semContasMapeadas) {
    return (
      <div>
        <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>3. Custos e Despesas — por conta analítica (OBZ)</h3>
        <SeletorCcs ccs={ccsVisiveis} ccSel={ccSel} onSelect={setCcSel} />
        <div style={{ background: COR.total, border: `1px solid ${COR.laranja}`, borderRadius: 8, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} color={COR.laranja} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: COR.azul, marginBottom: 4 }}>{ccAtual.nome}: sem contas analíticas mapeadas ainda</div>
            <div style={{ fontSize: 11.5, color: COR.texto }}>
              O De/Para conta × CC (Camadas.xlsx + Base orçamento 2026.xlsx) por enquanto cobre 30 dos 44 CCs — faltam
              Uva Terceiros (fornecedores/fazendas terceiras), os CCs de Investimentos/Projetos de 507 e Custo da
              Mercadoria Vendida. Este CC já está cadastrado e o gestor já tem acesso — falta o FP&A trazer o De/Para
              dessa área pra habilitar o lançamento aqui.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const gruposPacote = refUnidade.pacotes
    .map(p => ({
      ...p,
      contas: (refUnidade.planoContas[p.id] || []).filter(c => c.origem === origemAlvo && (!contasMapeadasCC || contasMapeadasCC.includes(c.codigo))),
    }))
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

      <SeletorCcs ccs={ccsVisiveis} ccSel={ccSel} onSelect={cc => { setCcSel(cc); setContaAberta(null); }} />

      {/* Consolidado por pacote (2026-08-23, revisado): só Admin FP&A —
          é uma visão de auditoria/governança da unidade inteira
          (Pacote > Conta analítica > Centro de Custo, todos os CCs), não
          faz sentido pro Gestor de Unidade nem pro Gestor de CC. */}
      {usuario?.perfil === 'admin_fpa' && (
        <div style={{ border: `1px solid ${COR.borda}`, borderRadius: 8, marginBottom: 14, overflow: 'hidden' }}>
          <button
            onClick={() => setMostrarConsolidado(prev => !prev)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'space-between',
              padding: '9px 12px', background: COR.claro, border: 'none', cursor: 'pointer', fontFamily: FONT,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: COR.azul }}>
              {mostrarConsolidado ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Visão consolidada — todos os CCs, por pacote
            </span>
            <span style={{ fontSize: 10.5, color: '#8A8F96', fontWeight: 400 }}>{ccsConsolidado.length} CC(s)</span>
          </button>
          {mostrarConsolidado && (
            <div style={{ padding: 8 }}>
              <p style={{ fontSize: 11, color: '#7A8088', margin: '2px 2px 8px' }}>
                Soma de todos os Centros de Custo desta unidade, agrupada por Pacote → Conta analítica → Centro de Custo —
                clique numa linha com seta para abrir a quebra. Só visível para Admin FP&A.
              </p>
              <VisaoConsolidadaPorPacote refUnidade={refUnidade} ccsConsolidado={ccsConsolidado} totalContaMesCC={totalContaMesCC} folhaCC={folhaCC} />
            </div>
          )}
        </div>
      )}

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
              label: `${g.nome} (CLT — folha calculada + Consultórias PJs)`,
              valoresMensal: MESES.map((_, m) => folhaAtual.mensal[m].total + totalPacoteMes(g.contas, m)),
              totalValor: folhaAtual.totalAnual + g.contas.reduce((acc, c) => acc + totalConta(c.codigo), 0),
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
        // Pessoal (2026-08-23): CLT (folha calculada) + eventuais contas
        // analíticas do pacote (Consultórias PJs, só Corporativo).
        const totalPacote = g.id === 'pessoal'
          ? folhaAtual.totalAnual + g.contas.reduce((acc, c) => acc + totalConta(c.codigo), 0)
          : g.contas.reduce((acc, c) => acc + totalConta(c.codigo), 0);
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
                  <>
                    <QuadroPessoal
                      ccCodigo={ccSel}
                      unidadeId={unidadeId}
                      funcionarios={(funcionarios || []).filter(f => f.ccCodigo === ccSel)}
                      addFuncionario={addFuncionario}
                      updateFuncionario={updateFuncionario}
                      removeFuncionario={removeFuncionario}
                      premissasPessoal={premissasPessoal}
                      updatePremissaPessoal={updatePremissaPessoal}
                      folha={folhaAtual}
                      onImportarLote={lista => importarFuncionariosLote(ccSel, lista)}
                    />
                    {/* Consultórias PJs (2026-08-23) — 2ª conta analítica do
                        pacote Pessoal, só Corporativo (ver CONTA_CONSULTORIA_PJ/
                        PLANO_CONTAS_CORPORATIVO). LinhaConta normal, igual a
                        qualquer outra conta — sem premissa nenhuma dedicada. */}
                    {g.contas.filter(c => c.codigo === CONTA_CONSULTORIA_PJ).map(c => (
                      <div key={c.codigo} style={{ marginTop: 18 }}>
                        <h5 style={{ fontSize: 11.5, color: COR.azul, marginBottom: 8 }}>Consultórias PJs — conta analítica</h5>
                        <LinhaConta
                          conta={c}
                          linha={linhas[chaveLinha(c.codigo)] || novaContaVazia()}
                          aberta={contaAberta === chaveLinha(c.codigo)}
                          onToggle={() => toggleConta(c.codigo)}
                          onUpdateClassificacao={valor => updateConta(chaveLinha(c.codigo), 'classificacao', valor)}
                          onUpdateSublinha={(sublinhaId, campo, valor) => updateSublinha(chaveLinha(c.codigo), sublinhaId, campo, valor)}
                          onAddSublinha={() => addSublinha(chaveLinha(c.codigo))}
                          onRemoveSublinha={sublinhaId => removeSublinha(chaveLinha(c.codigo), sublinhaId)}
                          total={totalConta(c.codigo)}
                          receitaBrutaMes={dre.receitaBrutaMes} receitaLiquidaMes={dre.receitaLiquidaMes}
                          ocultarClassificacao={unidadeId === 'corporativo'}
                          unidadeId={unidadeId} ipcaAnualPct={ipcaAnualPct} volumeTotalKgMes={dre.volumeTotalKgMes}
                        />
                      </div>
                    ))}
                  </>
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
                        linha={linhas[chaveLinha(c.codigo)] || novaContaVazia()}
                        aberta={contaAberta === chaveLinha(c.codigo)}
                        onToggle={() => toggleConta(c.codigo)}
                        onUpdateClassificacao={valor => updateConta(chaveLinha(c.codigo), 'classificacao', valor)}
                        onUpdateSublinha={(sublinhaId, campo, valor) => updateSublinha(chaveLinha(c.codigo), sublinhaId, campo, valor)}
                        onAddSublinha={() => addSublinha(chaveLinha(c.codigo))}
                        onRemoveSublinha={sublinhaId => removeSublinha(chaveLinha(c.codigo), sublinhaId)}
                        total={totalConta(c.codigo)}
                        receitaBrutaMes={dre.receitaBrutaMes} receitaLiquidaMes={dre.receitaLiquidaMes}
                        ocultarClassificacao={unidadeId === 'corporativo'}
                        unidadeId={unidadeId} ipcaAnualPct={ipcaAnualPct} volumeTotalKgMes={dre.volumeTotalKgMes}
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
                  linha={linhas[chaveLinha(c.codigo)] || novaContaVazia()}
                  aberta={contaAberta === chaveLinha(c.codigo)}
                  onToggle={() => toggleConta(c.codigo)}
                  onUpdateClassificacao={valor => updateConta(chaveLinha(c.codigo), 'classificacao', valor)}
                  onUpdateSublinha={(sublinhaId, campo, valor) => updateSublinha(chaveLinha(c.codigo), sublinhaId, campo, valor)}
                  onAddSublinha={() => addSublinha(chaveLinha(c.codigo))}
                  onRemoveSublinha={sublinhaId => removeSublinha(chaveLinha(c.codigo), sublinhaId)}
                  total={totalConta(c.codigo)}
                  receitaBrutaMes={dre.receitaBrutaMes} receitaLiquidaMes={dre.receitaLiquidaMes}
                  ocultarClassificacao={unidadeId === 'corporativo'}
                  unidadeId={unidadeId} ipcaAnualPct={ipcaAnualPct} volumeTotalKgMes={dre.volumeTotalKgMes}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* "Detalhamento dos pacotes de decisão" (Dono/Nível de Serviço/
          Prioridade/Justificativa por CC×Pacote) retirado em 2026-08-23,
          pedido explícito: "Desconsidere a opção de adicionar pacote de
          decisão em todas as empresas". `detalhes`/addDetalhe/updateDetalhe/
          removeDetalhe continuam existindo no estado e nas props (dados já
          salvos de antes não se perdem, e o histórico de versões enviadas
          antes desta mudança preserva o que foi preenchido) — só a UI de
          edição saiu daqui. Nunca alimentou nenhum cálculo (DRE/FC), então
          a remoção não muda nenhum número. */}

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

function AbaGiro({ capitalGiro, atualizar, dre, dados, refUnidade, ipcaAnualPct }) {
  if (capitalGiro.premissasRecebimento) {
    return <AbaGiroTextil capitalGiro={capitalGiro} atualizar={atualizar} dre={dre} dados={dados} refUnidade={refUnidade} ipcaAnualPct={ipcaAnualPct} />;
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
          const novoArray = atualizarArray(capitalGiro[chave], mesIdx, valor);
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
function AbaGiroTextil({ capitalGiro, atualizar, dre, dados, refUnidade, ipcaAnualPct }) {
  const kgiro = computeRecebimentosKgiroMensal({ capitalGiro }, dre);
  const fcd = computeFluxoCaixaDiretoMensal(dados, dre, refUnidade, ipcaAnualPct);
  const p = capitalGiro.premissasRecebimento;
  const pagamentos = capitalGiro.pagamentosManuais || pagamentosManuaisVazios();

  function updatePremissa(id, valor) {
    atualizar(['capitalGiro', 'premissasRecebimento'], { ...p, [id]: valor });
  }
  function updatePagamento(contaId, mesIdx, valor) {
    // Defensivo: se o orçamento foi criado antes desta migração (formato
    // antigo, lista livre), pagamentos[contaId] pode não existir ainda.
    const novoArray = atualizarArray(pagamentos[contaId], mesIdx, valor);
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
          const novoArray = atualizarArray(capitalGiro[chave], mesIdx, valor);
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
          // Inadimplência é % (não é multiplicada por nada mês a mês no
          // motor de cálculo hoje — só a Auditoria checa a faixa 0-100%),
          // então o Total certo é a média simples dos 12 meses, não a soma
          // (2026-08-30, mesmo bug de "Preço (R$/t)" — ver TabelaMensal).
          { key: 'inadimplencia', label: 'Inadimplência (%)', valores: provisoes.inadimplencia, totalValor: somaMes(provisoes.inadimplencia) / 12, formatarTotal: v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` },
          { key: 'contingencias', label: 'Provisão contingências', valores: provisoes.contingencias },
          { key: 'perdas', label: 'Provisão perdas', valores: provisoes.perdas },
        ]}
        onChangeCelula={(chave, mesIdx, valor) => {
          const novoArray = atualizarArray(provisoes[chave], mesIdx, valor);
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
          const novoArray = atualizarArray(resultado[chave], mesIdx, valor);
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
              const novoArray = atualizarArray(planoContas[contaId], mesIdx, valor);
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

// DRE Mensal Consolidada (2026-08-23) — ver nota completa em
// computeGruposReceitaTipo/computeGruposCustosMensal/
// computeDespesasOperacionaisPorGrupo acima. Tabela mês a mês (com total do
// ano na última coluna), com grupos clicáveis que abrem a quebra por
// Resort/Fazenda dentro de cada tipo de receita/custo/despesa. Complementa
// (não substitui) a CascataDRE anual acima dela, que já cobre margens e o
// toggle IFRS 18.
function DREMensalConsolidada({ lados, unidadeKind, ipcaAnualPct, cambios }) {
  const [abertos, setAbertos] = useState({});
  const toggle = (k) => setAbertos(prev => ({ ...prev, [k]: !prev[k] }));

  const gruposReceita = computeGruposReceitaTipo(lados, unidadeKind, cambios);
  const gruposCustos = computeGruposCustosMensal(lados, ipcaAnualPct);
  const despesasOp = computeDespesasOperacionaisPorGrupo(lados, ipcaAnualPct);

  const receitaBrutaMes = MESES.map((_, m) => lados.reduce((acc, l) => acc + l.dre.receitaBrutaMes[m], 0));
  const deducoesMes = MESES.map((_, m) => lados.reduce((acc, l) => acc + (l.dre.receitaBrutaMes[m] - l.dre.receitaLiquidaMes[m]), 0));
  const receitaLiquidaMes = MESES.map((_, m) => receitaBrutaMes[m] - deducoesMes[m]);
  const cpvMes = somarPorLado(gruposCustos.map(g => ({ nome: g.chave, valoresMensal: g.valoresMensal })));
  const lucroBrutoMes = MESES.map((_, m) => receitaLiquidaMes[m] - cpvMes[m]);
  const pessoalMes = somarPorLado(despesasOp.pessoal);
  const vendasMes = somarPorLado(despesasOp.vendas);
  const geraisMes = somarPorLado(despesasOp.gerais);
  const despesasOperacionaisMes = MESES.map((_, m) => pessoalMes[m] + vendasMes[m] + geraisMes[m]);
  const ebitdaMes = MESES.map((_, m) => lucroBrutoMes[m] - despesasOperacionaisMes[m]);
  // Bug corrigido em 2026-08-24 ("ARA Agrícola tela em branco" — TypeError
  // reading '0'): computeDRE (l.dre) só tem depreciacao/resultadoFinanceiro/
  // outras/ircsl como TOTAL ANUAL (escalar), nunca como *Mes (array mensal)
  // — só computeFluxoIndiretoMensal tem essa versão mensal. `l.fd` (ver
  // ConsolidadoAgricola/ConsolidadoResorts, mesmo objeto já calculado ali
  // pro Bridge EBITDA→FCO) é a fonte certa.
  const depreciacaoMes = MESES.map((_, m) => lados.reduce((acc, l) => acc + l.fd.depreciacaoMes[m], 0));
  const resultadoFinanceiroMes = MESES.map((_, m) => lados.reduce((acc, l) => acc + l.fd.resultadoFinanceiroMes[m], 0));
  const outrasMes = MESES.map((_, m) => lados.reduce((acc, l) => acc + l.fd.outrasMes[m], 0));
  const ircslMes = MESES.map((_, m) => lados.reduce((acc, l) => acc + l.fd.ircslMes[m], 0));
  const ebtMes = MESES.map((_, m) => ebitdaMes[m] - depreciacaoMes[m] + resultadoFinanceiroMes[m] + outrasMes[m]);
  const lucroLiquidoMes = MESES.map((_, m) => ebtMes[m] - ircslMes[m]);

  function total(arr) { return arr.reduce((a, v) => a + v, 0); }

  function Linha({ label, valoresMensal, cor, bold, indent, onClick, aberto, temFilhos, bg }) {
    return (
      <tr style={{ background: bg || COR.branco }}>
        <td
          onClick={onClick}
          style={{
            fontWeight: bold ? 700 : 400, fontSize: 11, padding: '6px 10px', paddingLeft: 10 + (indent || 0) * 16,
            border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: bg || COR.branco,
            color: cor || COR.texto, cursor: onClick ? 'pointer' : 'default',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {temFilhos && (aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
            {label}
          </span>
        </td>
        {valoresMensal.map((v, mi) => (
          <td key={mi} style={{ padding: '6px 4px', border: `1px solid ${COR.borda}`, fontSize: 10, textAlign: 'right', color: cor || COR.texto, fontWeight: bold ? 700 : 400 }}>
            {formatBRL(v)}
          </td>
        ))}
        <td style={{ padding: '6px 8px', border: `1px solid ${COR.borda}`, fontWeight: 700, fontSize: 10.5, color: cor || COR.azul, textAlign: 'right' }}>
          {formatBRL(total(valoresMensal))}
        </td>
      </tr>
    );
  }
  function LinhasGrupo({ grupos }) {
    return grupos.map(g => (
      <React.Fragment key={g.chave}>
        <Linha
          label={g.nome} valoresMensal={g.valoresMensal} indent={1}
          onClick={() => toggle(g.chave)} aberto={!!abertos[g.chave]} temFilhos
        />
        {abertos[g.chave] && g.porLado.map(pl => (
          <Linha key={pl.nome} label={pl.nome} valoresMensal={pl.valoresMensal} cor="#8A8F96" indent={2} bg={COR.claro} />
        ))}
      </React.Fragment>
    ));
  }
  function LinhasPorLado({ chave, nome, porLado }) {
    const valoresMensal = somarPorLado(porLado);
    return (
      <React.Fragment>
        <Linha label={nome} valoresMensal={valoresMensal} indent={1}
          onClick={() => toggle(chave)} aberto={!!abertos[chave]} temFilhos />
        {abertos[chave] && porLado.map(pl => (
          <Linha key={pl.nome} label={pl.nome} valoresMensal={pl.valoresMensal} cor="#8A8F96" indent={2} bg={COR.claro} />
        ))}
      </React.Fragment>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '7px 10px', textAlign: 'left', minWidth: 230, position: 'sticky', left: 0 }}>Linha</th>
            {MESES.map(m => <th key={m} style={{ background: COR.azul, color: COR.branco, fontSize: 9.5, padding: '7px 4px', minWidth: 58 }}>{m}</th>)}
            <th style={{ background: COR.laranja, color: COR.branco, fontSize: 10, padding: '7px 8px', minWidth: 84 }}>Total ano</th>
          </tr>
        </thead>
        <tbody>
          <Linha label="Receita Bruta" valoresMensal={receitaBrutaMes} cor={COR.azul} bold />
          <LinhasGrupo grupos={gruposReceita} />
          <Linha label="(-) Deduções" valoresMensal={deducoesMes.map(v => -v)} cor={COR.vermelho} />
          <Linha label="(=) Receita Líquida" valoresMensal={receitaLiquidaMes} cor={COR.azul} bold bg={COR.total} />
          <Linha label="(-) Custos (CPV)" valoresMensal={cpvMes.map(v => -v)} cor={COR.vermelho} bold />
          <LinhasGrupo grupos={gruposCustos} />
          <Linha label="(=) Lucro Bruto" valoresMensal={lucroBrutoMes} cor={COR.azul} bold bg={COR.total} />
          <Linha label="(-) Despesas Operacionais" valoresMensal={despesasOperacionaisMes.map(v => -v)} cor={COR.vermelho} bold />
          <LinhasPorLado chave="__desp_pessoal__" nome="Despesas com Pessoal" porLado={despesasOp.pessoal} />
          <LinhasPorLado chave="__desp_vendas__" nome="Despesas com Vendas" porLado={despesasOp.vendas} />
          <LinhasPorLado chave="__desp_gerais__" nome="Despesas Gerais" porLado={despesasOp.gerais} />
          <Linha label="(=) EBITDA" valoresMensal={ebitdaMes} cor={COR.laranja} bold bg={COR.total} />
          <Linha label="(-) Depreciação e Amortização" valoresMensal={depreciacaoMes.map(v => -v)} cor={COR.vermelho} />
          <Linha label="(+/-) Resultado Financeiro" valoresMensal={resultadoFinanceiroMes} cor={COR.texto} />
          <Linha label="(+/-) Outras Receitas e Despesas" valoresMensal={outrasMes} cor={COR.texto} />
          <Linha label="(-) IR/CSLL" valoresMensal={ircslMes.map(v => -v)} cor={COR.vermelho} />
          <Linha label="(=) Lucro Líquido" valoresMensal={lucroLiquidoMes} cor={COR.verde} bold bg={COR.total} />
        </tbody>
      </table>
    </div>
  );
}

function CascataDFC({ dfc }) {
  const linhas = [
    { label: 'Lucro Líquido', valor: dfc.lucroLiquido, tipo: 'base' },
    { label: '(+) Depreciação e Amortização', valor: dfc.depreciacao, tipo: 'pos' },
    { label: '(=) Geração de Caixa Operacional (antes do giro)', valor: dfc.geracaoOperacionalAntesGiro, tipo: 'subtotal' },
    { label: '(+/-) Variação de Capital de Giro', valor: dfc.variacaoCapitalGiro, tipo: 'pos' },
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
        Variação de Capital de Giro: prazos de recebimento/pagamento e giro de estoque (aba 5), em dias, aplicados sobre a Receita Líquida/CPV projetados e os saldos iniciais de contas a receber, contas a pagar e estoque (aba 8 — Balanço Patrimonial).
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
  { id: 'dfc_giro', campo: 'variacaoCapitalGiro', label: '(+/-) Variação de Capital de Giro', tipo: 'pos' },
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
          {UNIDADES_PARA_TOTAL_GRUPO.map(u => {
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

function AbaRevisao({ refUnidade, unidadeId, versoes, dados, dre, ipcaAnualPct, cambios, autorNome, setAutorNome, comentarioEnvio, setComentarioEnvio, enviarVersao, enviando, tudoOk, erro, aguardandoLiberacao, sensibilidades, updateCenarioSensibilidade }) {
  const [ifrs18, setIfrs18] = useState(false);
  const fd = computeFluxoIndiretoMensal(dados, dre, refUnidade, ipcaAnualPct);
  const fcd = computeFluxoCaixaDiretoMensal(dados, dre, refUnidade, ipcaAnualPct);
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
  // "Outros Ajustes" = 13º (competência × caixa) + Ajuste de Pagamento
  // (competência × caixa, 2026-08-23) — dois ajustes de mesma natureza,
  // dobrados aqui pra manter a bridge em 5 passos e reconciliar com o FCO.
  const totalAjuste13Ano = fd.ajuste13Mes.reduce((a, v) => a + v, 0);
  const totalAjustePagamentoAno = fd.ajustePagamentoMes.reduce((a, v) => a + v, 0);
  const bridgeEbitdaFco = [
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'inicio' },
    { label: 'Impostos', valor: -totalIrcslAno, tipo: 'incremento' },
    { label: 'Var. Capital de Giro', valor: totalGiroAno, tipo: 'incremento' },
    { label: 'Outros Ajustes', valor: totalAjuste13Ano + totalAjustePagamentoAno, tipo: 'incremento' },
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
        FC Operacional: EBITDA menos IRCSL proporcional, mais variação de capital de giro (prazos da aba 5 sobre os saldos de abertura da aba 8), o ajuste de competência × caixa do 13º salário (provisionado mês a mês, pago metade em novembro e metade em dezembro) e o ajuste de pagamento (competência × caixa) de qualquer conta analítica marcada com fato gerador em mês diferente do pagamento (aba 3 — hoje só no Corporativo, ver pergunta em cada conta).
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
            { key: 'ajustePagamento', label: '(+/-) Ajuste de Pagamento (competência × caixa)', valoresMensal: fd.ajustePagamentoMes, totalValor: fd.ajustePagamentoMes.reduce((a, v) => a + v, 0), cor: COR.texto },
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

      {/* Pedido de 2026-08-19: "ao final da seção... análise de variações
          entre versões... macro e micro contas (analíticas)". Só quem
          abre esta aba já é Gestor da Unidade ou Admin FP&A (Gestor de CC
          nem vê a Revisão — ver ABAS/VisaoGerente), então não precisa de
          gate de perfil adicional aqui dentro. */}
      <AnaliseVariacoes dados={dados} dre={dre} refUnidade={refUnidade} unidadeId={unidadeId} versoes={versoes} ipcaAnualPct={ipcaAnualPct} cambios={cambios} />
    </div>
  );
}

// "Análise de Variações entre Versões" (pedido de 2026-08-19) — compara a
// versão atual (em edição, ainda não necessariamente enviada) com uma
// versão já enviada, escolhida num seletor. Macro = linhas da DRE
// (cascata); micro = contas analíticas de Custos e Despesas (CC × Conta) —
// mesma terminologia usada no resto do app ("conta analítica" sempre quer
// dizer uma linha de Custos e Despesas, ver AbaCustos/LinhaConta).
function AnaliseVariacoes({ dados, dre, refUnidade, unidadeId, versoes, ipcaAnualPct, cambios }) {
  const [versaoSelId, setVersaoSelId] = useState('');
  const [versaoSel, setVersaoSel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  async function selecionarVersao(id) {
    setVersaoSelId(id);
    setVersaoSel(null);
    setErro(null);
    if (!id) return;
    setCarregando(true);
    try {
      const v = await buscarVersaoApi(unidadeId, id);
      setVersaoSel(v);
    } catch (e) {
      setErro('Não foi possível carregar essa versão. Tente novamente.');
    }
    setCarregando(false);
  }

  function linhasMacro(dreA) {
    return [
      { label: 'Receita Bruta', valor: dreA.receitaBruta },
      { label: '(-) Deduções', valor: -dreA.deducoes },
      { label: '(=) Receita Líquida', valor: dreA.receitaLiquida },
      { label: '(-) CPV', valor: -dreA.cpv },
      { label: '(=) Lucro Bruto', valor: dreA.lucroBruto },
      { label: '(-) Despesas Operacionais', valor: -dreA.despesasSemDA },
      { label: '(=) EBITDA', valor: dreA.ebitda },
      { label: '(-) Depreciação e Amortização', valor: -dreA.depreciacao },
      { label: '(+/-) Resultado Financeiro', valor: dreA.resultadoFinanceiro },
      { label: '(+/-) Outras Receitas e Despesas', valor: dreA.outras },
      { label: '(-) IRCSL', valor: -dreA.ircsl },
      { label: '(=) Lucro Líquido', valor: dreA.lucroLiquido },
    ];
  }

  // ipcaAnualPct usado é o ATUAL (premissa macro de agora) mesmo pra
  // comparar com uma versão enviada no passado — não guardamos o IPCA
  // vigente em cada envio anterior (só o snapshot de `dados`), então não há
  // como recalcular a versão antiga com o IPCA "de época" dela. Mesma
  // aproximação de melhor esforço já usada no total gravado no envio (ver
  // routes/orcamentos.js POST /:unidadeId/enviar).
  const dreVersao = versaoSel ? computeDRE(versaoSel.dados, refUnidade, ipcaAnualPct, cambios) : null;
  const macroAtual = linhasMacro(dre);
  const macroVersao = dreVersao ? linhasMacro(dreVersao) : null;

  const microLinhas = useMemo(() => {
    if (!versaoSel || !dreVersao) return [];
    const linhasAtuais = dados.custos.linhas || {};
    const linhasVersao = versaoSel.dados.custos?.linhas || {};
    const chaves = new Set([...Object.keys(linhasAtuais), ...Object.keys(linhasVersao)]);
    const linhas = [];
    chaves.forEach((chave) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const totalAtual = valorLinhaAnual(linhasAtuais[chave], dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes);
      const totalVersao = valorLinhaAnual(linhasVersao[chave], dreVersao.receitaBrutaMes, dreVersao.receitaLiquidaMes, ipcaAnualPct, dreVersao.volumeTotalKgMes);
      const diff = totalAtual - totalVersao;
      if (Math.abs(diff) < 0.01) return;
      const cc = refUnidade.ccs.find((c) => c.codigo === ccCodigo);
      const conta = refUnidade.todasContas[contaCodigo];
      linhas.push({ chave, ccNome: cc?.nome || ccCodigo, contaNome: conta?.nome || contaCodigo, totalAtual, totalVersao, diff });
    });
    return linhas.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [versaoSel, dreVersao, dados, dre, refUnidade, ipcaAnualPct]);

  function linhaDiff(label, atual, versao, i) {
    const diff = atual - versao;
    const diffPct = versao !== 0 ? (diff / Math.abs(versao)) * 100 : (diff !== 0 ? null : 0);
    const cor = diff > 0 ? COR.verde : diff < 0 ? COR.vermelho : '#8A8F96';
    return (
      <tr key={label} style={{ background: i % 2 ? COR.claro : COR.branco }}>
        <td style={{ fontSize: 11, padding: '5px 8px', border: `1px solid ${COR.borda}`, position: 'sticky', left: 0, background: i % 2 ? COR.claro : COR.branco }}>{label}</td>
        <td style={{ fontSize: 11, padding: '5px 8px', border: `1px solid ${COR.borda}`, textAlign: 'right' }}>{formatBRL(atual)}</td>
        <td style={{ fontSize: 11, padding: '5px 8px', border: `1px solid ${COR.borda}`, textAlign: 'right' }}>{formatBRL(versao)}</td>
        <td style={{ fontSize: 11, fontWeight: 700, padding: '5px 8px', border: `1px solid ${COR.borda}`, textAlign: 'right', color: cor }}>{diff > 0 ? '+' : ''}{formatBRL(diff)}</td>
        <td style={{ fontSize: 11, fontWeight: 700, padding: '5px 8px', border: `1px solid ${COR.borda}`, textAlign: 'right', color: cor }}>{diffPct === null ? '—' : `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%`}</td>
      </tr>
    );
  }

  return (
    <div style={{ marginTop: 30, borderTop: `2px solid ${COR.borda}`, paddingTop: 20 }}>
      <h3 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Análise de Variações entre Versões</h3>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Compara a versão atual (em edição) com uma versão já enviada — macro (DRE) e micro (contas analíticas de Custos e Despesas).
      </p>

      <div style={{ maxWidth: 420, marginBottom: 16 }}>
        <Rotulo>Comparar com a versão enviada</Rotulo>
        <Selecao
          value={versaoSelId} onChange={selecionarVersao}
          opcoes={[
            { id: '', nome: versoes.length === 0 ? 'Nenhuma versão enviada ainda' : 'Selecione uma versão…' },
            ...versoes.map((v) => ({ id: v.id, nome: `${formatData(v.timestamp)} — ${v.autor}${v.comentario ? ' — ' + v.comentario : ''}` })),
          ]}
        />
      </div>

      {carregando && <p style={{ fontSize: 12, color: '#7A8088' }}>Carregando versão…</p>}
      {erro && <div style={{ background: '#FBE9E9', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, borderRadius: 6, padding: 10, fontSize: 12 }}>{erro}</div>}

      {macroVersao && (
        <>
          <h4 style={{ fontSize: 13, color: COR.azul, marginTop: 10, marginBottom: 4 }}>Macro — DRE</h4>
          <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 8 }}>
            Atual vs. versão enviada em {formatData(versaoSel.enviado_em)} por {versaoSel.autor_nome}.
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '6px 8px', textAlign: 'left', position: 'sticky', left: 0 }}>Linha</th>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 100 }}>Atual</th>
                  <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 100 }}>Versão enviada</th>
                  <th style={{ background: COR.laranja, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 100 }}>Diferença (R$)</th>
                  <th style={{ background: COR.laranja, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 80 }}>Diferença (%)</th>
                </tr>
              </thead>
              <tbody>
                {macroAtual.map((linha, i) => linhaDiff(linha.label, linha.valor, macroVersao[i].valor, i))}
              </tbody>
            </table>
          </div>

          <h4 style={{ fontSize: 13, color: COR.azul, marginBottom: 4 }}>Micro — Contas analíticas (Custos e Despesas)</h4>
          <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 8 }}>
            Só contas com diferença — {microLinhas.length} conta(s) mudou(mudaram) entre as duas versões, ordenadas pela maior variação.
          </p>
          {microLinhas.length === 0 ? (
            <p style={{ fontSize: 11.5, color: '#8A8F96' }}>Nenhuma diferença nas contas analíticas entre a versão atual e a selecionada.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '6px 8px', textAlign: 'left', position: 'sticky', left: 0 }}>CC — Conta</th>
                    <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 100 }}>Atual</th>
                    <th style={{ background: COR.azul, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 100 }}>Versão enviada</th>
                    <th style={{ background: COR.laranja, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 100 }}>Diferença (R$)</th>
                    <th style={{ background: COR.laranja, color: COR.branco, fontSize: 10, padding: '6px 8px', minWidth: 80 }}>Diferença (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {microLinhas.map((l, i) => linhaDiff(`${l.ccNome} — ${l.contaNome}`, l.totalAtual, l.totalVersao, i))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão FP&A Corporativo
// ---------------------------------------------------------------------------

function VisaoFPA({ statusUnidades, aguardandoLiberacaoPorUnidade, liberarReenvioUnidade, backlog, unidadeDrill, abrirDrill, versoesDrill, exportarExcel, exportarExcelCalculo, solicitarResumoExecutivo, etapasProcesso, atualizarEtapa, premissasMacro, updatePremissaMacroGlobal, buscarBoletimFocus, buscandoFocus, erroFocus, abrirVersao }) {
  const [subVisao, setSubVisao] = useState('gestao');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  // Mesmo racional do ipcaAnualPct no componente App — recalculado aqui
  // porque premissasMacro chega como prop, não como estado local.
  const ipcaAnualPct = premissasMacro.find(p => p.id === 'ipca')?.valor;
  const cambios = cambiosDePremissas(premissasMacro);

  const totalGrupo = UNIDADES_PARA_TOTAL_GRUPO.reduce((acc, u) => {
    // 'agricola'/'resorts' somam sempre ao vivo dos sites — ver nota
    // completa em dreEDfcGrupoUnidade (bug de 2026-08-30).
    const { dre: t } = dreEDfcGrupoUnidade(statusUnidades, u.id, ipcaAnualPct, cambios);
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Botao variante="secundario" icone={FileSpreadsheet} onClick={() => exportarExcelCalculo(unidadeDrill)}>Excel — Cálculo{unidadeDrill ? '' : ' (abra uma unidade)'}</Botao>
          <Botao variante="secundario" icone={FileSpreadsheet} onClick={exportarExcel}>Excel — Dados Brutos</Botao>
          <Botao variante="secundario" icone={FileBarChart} onClick={solicitarResumoExecutivo}>Apresentação (PPT)</Botao>
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
              const t = d ? dreDaUnidade(d, u.id, ipcaAnualPct, cambios) : dreDaUnidade(emptyFormData(u.id), u.id, ipcaAnualPct, cambios);
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
        <VisaoResultadosConsolidados statusUnidades={statusUnidades} totalGrupo={totalGrupo} ipcaAnualPct={ipcaAnualPct} cambios={cambios} />
      )}
    </div>
  );
}

function VisaoResultadosConsolidados({ statusUnidades, totalGrupo, ipcaAnualPct, cambios }) {
  const [linhasAbertasDRE, setLinhasAbertasDRE] = useState({});
  const [linhasAbertasDFC, setLinhasAbertasDFC] = useState({});

  const porUnidadeDRE = {};
  const porUnidadeDFC = {};
  UNIDADES_PARA_TOTAL_GRUPO.forEach(u => {
    // 'agricola'/'resorts' somam sempre ao vivo dos sites — ver nota
    // completa em dreEDfcGrupoUnidade (bug de 2026-08-30).
    const { dre: t, dfc } = dreEDfcGrupoUnidade(statusUnidades, u.id, ipcaAnualPct, cambios);
    porUnidadeDRE[u.id] = t;
    porUnidadeDFC[u.id] = dfc;
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
        Variação de Capital de Giro: prazos de recebimento/pagamento e giro de estoque (aba 5, por unidade), aplicados sobre os saldos iniciais de contas a receber, contas a pagar e estoque (aba 8 — Balanço Patrimonial).
      </p>
    </>
  );
}



