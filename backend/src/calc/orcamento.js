// Portado verbatim de OrcamentoARA.jsx (Caminho A) — computeDRE, computeDFC,
// computeFluxoIndiretoMensal, computeFluxoCaixaDiretoMensal,
// computeFolhaPessoalMes/Anual, folhaAnualPorCC, computeSensibilidade,
// computePlano5Y, runAuditoria, e as funções de apoio que elas usam.
//
// Regra do CLAUDE.md: "Essa lógica deve ser reaproveitada, não reescrita".
// Não alterar a lógica de negócio aqui sem replicar a mudança no .jsx (ou,
// depois que a Fase 6 aposentar o protótipo, aqui passa a ser a única fonte).
import { MESES, mesesVazios, PRODUTOS_REF, DEDUCOES_REF } from './constantesTextil.js';
import { PRODUTOS_REF_AGRICOLA, DEDUCOES_REF_AGRICOLA, LINHAS_RECEITA_RESORTS, DEDUCOES_REF_RESORTS } from './receitaAgricolaResorts.js';
import { premissasRecebimentoVazias, planoContasBalancoVazio, saldosIniciaisBalancoVazio, computeRecebimentosKgiroMensal, pagamentosManuaisVazios, computePagamentosManuaisMes, saldosAberturaFc } from './kgiroBalancoTextil.js';

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function somaMes(arr) {
  return (arr || []).reduce((a, v) => a + parseNum(v), 0);
}

export function novaLinhaFinanciamento() {
  return {
    id: uid(), banco: '', linha: '', moeda: 'BRL', saldoInicial: '',
    captacoes: mesesVazios(), amortizacoes: mesesVazios(), jurosPagos: mesesVazios(),
    variacaoCambial: mesesVazios(), provisaoDespesaFinanceira: mesesVazios(),
    justificativa: '',
  };
}

export function novaLinhaVazia() {
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

// Valor de uma linha (chave CC|Conta) em um mês, de acordo com o tipo de premissa.
// receitaBrutaMes/receitaLiquidaMes são arrays de 12 posições, vindos do computeDRE.
export function valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes) {
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
export function valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes) {
  return MESES.reduce((acc, _, m) => acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes), 0);
}
// Checagem de coerência: premissa qtd_valor/rateio com apenas um dos dois campos preenchido em algum mês.
export function linhaIncoerente(linha) {
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
export function linhaTemNegativo(linha) {
  if (!linha) return false;
  const campos = linha.premissaTipo === 'qtd_valor' ? [linha.quantidades, linha.valoresUnit]
    : linha.premissaTipo === 'rateio' ? [linha.baseManual, linha.percentuais]
    : [linha.valores];
  return campos.some(arr => (arr || []).some(v => parseNum(v) < 0));
}

// unidadeId só muda uma coisa: PRODUTOS_REF (produtos têxteis de referência,
// tipo "ALGODAO PENTEADO") só faz sentido pré-preenchido para a Têxtil.
// Agrícola/Resorts começam com a lista de produtos vazia — o gerente cadastra
// os produtos/serviços da própria unidade (ainda sem uma lista de referência
// oficial para essas duas, é uma pendência separada da estrutura de CC).
// Monta o objeto `receita` certo por unidade — três modelos diferentes (ver
// calc/receitaAgricolaResorts.js): produtos com referência pré-carregada
// (Têxtil), produtos genéricos vazios com deduções próprias (Agrícola), ou
// linhas de hotelaria (Resorts). unidades sem modelo definido (Corporativo,
// EI, Energia) caem no genérico vazio — não têm lançamento habilitado mesmo.
function receitaVazia(unidadeId) {
  if (unidadeId === 'textil') {
    return {
      produtos: PRODUTOS_REF.map(p => ({ id: uid(), nome: p.nome, volumes: mesesVazios(), precos: mesesVazios() })),
      deducoes: DEDUCOES_REF.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios() })),
    };
  }
  if (unidadeId === 'agricola') {
    return {
      produtos: PRODUTOS_REF_AGRICOLA.map(p => ({ id: uid(), nome: p.nome, volumes: mesesVazios(), precos: mesesVazios() })),
      deducoes: DEDUCOES_REF_AGRICOLA.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios(), baseLinhaIds: d.baseLinhaIds })),
    };
  }
  if (unidadeId === 'resorts') {
    const linhas = {};
    LINHAS_RECEITA_RESORTS.forEach((l) => { linhas[l.id] = novaLinhaVazia(); });
    return {
      linhas,
      deducoes: DEDUCOES_REF_RESORTS.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios(), baseLinhaIds: d.baseLinhaIds })),
    };
  }
  return { produtos: [], deducoes: [] };
}

export function emptyFormData(unidadeId = 'textil') {
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
    },
    capex: { projetos: [] },
    capitalGiro: {
      prazoRecebimento: mesesVazios(), prazoPagamento: mesesVazios(), giroEstoque: mesesVazios(), justificativa: '',
      // Só usado por ARA Têxtil (ver Premissas Têxtil.xlsx, aba Premissas
      // Kgiro — decisão de 2026-08-16). Agrícola/Resorts continuam só com
      // os prazos em dias acima.
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
      // Só usado por ARA Têxtil — plano de contas completo (ver Premissas
      // Têxtil.xlsx, aba Balanço Patrimonial). Lançamento manual mês a mês
      // por conta, igual à planilha original (que também não tinha fórmula
      // de projeção real, só os subtotais) — ver computeBalancoMensal.
      // saldosIniciais = coluna Dez/25 (saldo de partida, um valor por
      // conta) — substitui os campos escalares antigos (caixaInicial etc.)
      // como fonte dos cálculos de FC para Têxtil (ver saldosAberturaFc).
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

// ---------------------------------------------------------------------------
// Folha de Pessoal — a partir da lista de funcionários (nome + salário atual,
// por CC) e das premissas de encargos/benefícios padronizadas da unidade.
// 13º salário é provisionado mês a mês por competência (1/12 do salário);
// o pagamento em caixa (metade nov, metade dez) é tratado à parte, no fluxo
// de caixa direto (aba Revisão, Análise e Envio), não aqui na DRE.
// ---------------------------------------------------------------------------
export function computeFolhaPessoalMes(funcionariosCC, premissas, mIdx) {
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
export function computeFolhaPessoalAnual(funcionariosCC, premissas) {
  const mensal = MESES.map((_, m) => computeFolhaPessoalMes(funcionariosCC, premissas, m));
  return {
    mensal,
    totalAnual: mensal.reduce((acc, m) => acc + m.total, 0),
    decimoTerceiroAnual: mensal.reduce((acc, m) => acc + m.decimoTerceiro, 0),
    salariosMes: mensal.map(m => m.salarios),
    totalMes: mensal.map(m => m.total),
  };
}
export function folhaAnualPorCC(data, ccCodigo) {
  const funcs = (data.custos.funcionarios || []).filter(f => f.ccCodigo === ccCodigo);
  return computeFolhaPessoalAnual(funcs, data.custos.premissasPessoal);
}

// Duas formas de modelar receita, conforme a unidade (ver
// calc/receitaAgricolaResorts.js): `receita.produtos` (Volume × Preço por
// produto — Têxtil e Agrícola) ou `receita.linhas` (quantidade × valor
// unitário ou valor direto por linha — Resorts, modelo de hotelaria). Uma
// exclui a outra; nunca as duas ao mesmo tempo num mesmo documento.
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

export function computeDRE(data, ref) {
  // Receita bruta por mês, para aplicar deduções percentuais mês a mês
  const { receitaBrutaMes, linhasReceitaMes } = receitaBrutaPorMes(data);
  const receitaBruta = receitaBrutaMes.reduce((a, v) => a + v, 0);

  // Base do percentual de dedução: normalmente a receita bruta total
  // (Têxtil/Agrícola), mas uma linha pode apontar `baseLinhaIds` — soma só
  // das linhas referenciadas (Resorts: PIS/Cofins de Hospedagem incidem só
  // sobre a receita de Hospedagem, não sobre A&B, por exemplo).
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
export function computeDFC(data, dre) {
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
  const caixaInicial = saldosAberturaFc(data).caixaInicial;
  const caixaFinal = caixaInicial + variacaoCaixa; // computeDFC (anual, legado/dashboard consolidado)

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
// ---------------------------------------------------------------------------
export function computeFluxoIndiretoMensal(data, dre, ref) {
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
// Fluxo de Caixa Direto mensal — recebimentos e pagamentos por categoria
// (não parte do EBITDA; é uma decomposição por natureza de caixa). Construído
// com os mesmos componentes do método indireto (receita, CPV, despesas,
// folha, capital de giro, 13º), então reconcilia matematicamente com o
// FC Operacional do método indireto — são duas leituras do mesmo número.
// ---------------------------------------------------------------------------
export function computeFluxoCaixaDiretoMensal(data, dre, ref) {
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

  // ARA Têxtil (única unidade com cg.premissasRecebimento definido — ver
  // emptyFormData): recebimentos vêm da cascata de aging real (Premissas
  // Têxtil.xlsx, aba Premissas Kgiro), não da aproximação genérica de
  // "prazo médio em dias" usada pelas demais unidades. Isso quebra um pouco
  // a reconciliação exata com o método Indireto (que ainda usa a
  // aproximação genérica para variacaoGiroMes) — pendência conhecida, não
  // escondida: ver aviso na tela de Revisão.
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
  // 2026-08-16) — plano de contas fixo (Rateio Administrativo, Matéria-Prima
  // Fios/Químicos, Mão de obra, Gás, Energia Elétrica, Assessorias e
  // Consultorias, Outros — confirmado pelo usuário por print, já que a aba
  // Fluxo de Caixa Direto da planilha-fonte não trazia rótulo nenhum),
  // lançamento manual por conta/mês. Soma às saídas do FC Direto, sem
  // duplicar o que já vem de Custos e Despesas (esses continuam automáticos acima).
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
// premissas do usuário — nenhum valor é pré-preenchido.
// ---------------------------------------------------------------------------
export const VARIAVEIS_SENSIBILIDADE = [
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

export function novoCenarioSensibilidadeVazio() {
  const c = {};
  VARIAVEIS_SENSIBILIDADE.forEach(v => { c[v.campo] = ''; });
  c.justificativa = '';
  return c;
}

export function computeSensibilidade(dados, dre, ajustes) {
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

export const ANOS_PLANO_5Y = [2028, 2029, 2030, 2031];

export function computePlano5Y(dre, anos) {
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

export function runAuditoria(data, dre, ref) {
  const checks = [];
  // Modelo por produto (Têxtil/Agrícola) ou por linha (Resorts) — ver
  // receitaBrutaPorMes() em computeDRE. Auditoria checa o que existir.
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

  const justContextoOk = !!(data.estrategicas?.contexto || '').trim();
  checks.push({
    label: 'Contexto estratégico do ciclo preenchido (campo obrigatório)',
    ok: justContextoOk,
    detalhe: justContextoOk ? 'Preenchido' : 'Pendente de preenchimento',
  });

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

  const linhasCustos = Object.entries(data.custos.linhas || {});

  const linhasProducao = linhasCustos.filter(([chave]) => {
    const cc = ref.ccs.find(c => c.codigo === chave.split('|')[0]);
    return cc?.tipo === 'producao';
  }).filter(([, linha]) => valorLinhaAnual(linha, dre.receitaBrutaMes, dre.receitaLiquidaMes) > 0);
  checks.push({
    label: 'CPV: ao menos uma linha analítica lançada em CC de produção',
    ok: linhasProducao.length > 0,
    detalhe: `${linhasProducao.length} linha(s) analítica(s) com valor em CC de produção`,
  });

  const linhasDespesa = linhasCustos.filter(([chave]) => {
    const cc = ref.ccs.find(c => c.codigo === chave.split('|')[0]);
    return cc?.tipo === 'despesa';
  }).filter(([, linha]) => valorLinhaAnual(linha, dre.receitaBrutaMes, dre.receitaLiquidaMes) > 0);
  checks.push({
    label: 'Despesas: ao menos uma linha analítica lançada em CC de despesa',
    ok: linhasDespesa.length > 0,
    detalhe: `${linhasDespesa.length} linha(s) analítica(s) com valor em CC de despesa`,
  });

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

  const somaDeducoesMensal = MESES.map((_, m) => (data.receita.deducoes || []).reduce((acc, d) => acc + parseNum(d.pcts?.[m]), 0));
  const deducaoForaFaixa = somaDeducoesMensal.some(v => v < 0 || v > 40);
  checks.push({
    label: 'Deduções sobre receita dentro de faixa plausível (0% a 40%) em todos os meses',
    ok: !deducaoForaFaixa,
    detalhe: deducaoForaFaixa ? 'Há mês com soma de deduções fora da faixa' : 'Todos os meses dentro da faixa',
  });

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

  const bal = data.balanco;
  // Pedido de 2026-08-09: Balanço Patrimonial é responsabilidade do FP&A,
  // não bloqueia envio do gestor da unidade — obrigatorio:false (espelha o
  // mesmo campo no .jsx, que é quem realmente decide o botão de Enviar).
  const balancoBaseOk = bal.caixaInicial !== '' && bal.imobilizadoInicial !== '';
  checks.push({
    label: 'Balanço Patrimonial: caixa e imobilizado iniciais informados',
    ok: balancoBaseOk,
    detalhe: balancoBaseOk ? 'Saldos de abertura informados' : 'Faltam saldos de abertura (caixa e/ou imobilizado) — responsabilidade do FP&A, não bloqueia envio',
    obrigatorio: false,
  });

  return checks;
}
