// Portado verbatim de OrcamentoARA.jsx (Caminho A) — computeDRE, computeDFC,
// computeFluxoIndiretoMensal, computeFluxoCaixaDiretoMensal,
// computeFolhaPessoalMes/Anual, folhaAnualPorCC, computeSensibilidade,
// computePlano5Y, runAuditoria, e as funções de apoio que elas usam.
//
// Regra do CLAUDE.md: "Essa lógica deve ser reaproveitada, não reescrita".
// Não alterar a lógica de negócio aqui sem replicar a mudança no .jsx (ou,
// depois que a Fase 6 aposentar o protótipo, aqui passa a ser a única fonte).
import { MESES, mesesVazios, PRODUTOS_REF, DEDUCOES_REF } from './constantesTextil.js';
import { PRODUTOS_REF_AGRICOLA, DEDUCOES_REF_AGRICOLA, LINHAS_RECEITA_RESORTS, DEDUCOES_REF_RESORTS, LINHA_RECEITA_INFORMATIVA_RESORTS, LINHAS_DESCONTINUADAS_RESORTS, tipoLinhaReceitaResorts } from './receitaAgricolaResorts.js';
import { premissasRecebimentoVazias, planoContasBalancoVazio, saldosIniciaisBalancoVazio, computeRecebimentosKgiroMensal, pagamentosManuaisVazios, saldosAberturaFc } from './kgiroBalancoTextil.js';
// Só pra dreDaUnidade resolver a referência de agricola_tds/agricola_fds no
// ramo do Consolidado (ver nota lá embaixo) — sem ciclo: registroUnidades.js
// não importa nada deste arquivo.
import { buscarReferencia } from './registroUnidades.js';
import { pocVazio, pocDoDocumento } from './pocLaFleur.js';
import { CC_COMISSAO_POC_PADRAO } from './constantesEI.js';

// ARA EI (2026-09-27): só a La Fleur II tem Receita (POC); Holding e South
// Bay não têm seção de Receita. Escritório de Investimentos ('energia') só
// tem aportes/dividendos (FC de Investimentos). Espelho do frontend.
export const UNIDADES_SEM_RECEITA = ['corporativo', 'ei_southbay', 'energia'];

// FC de Investimentos por mês a partir de capex.projetos: desembolso de
// CapEx sai; no Escritório de Investimentos cada lançamento tem aporte de
// capital (sai) e distribuição de dividendos (entra). Espelho do frontend.
export function fcInvestimentoProjetosMes(data) {
  return MESES.map((_, m) => (data.capex?.projetos || []).reduce((acc, p) =>
    acc - parseNum(desembolsosDoProjeto(p)[m]) - parseNum(p.aportes?.[m]) + parseNum(p.dividendos?.[m]), 0));
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Bug corrigido em 2026-09-08 — ver nota completa no espelho frontend
// (frontend/src/OrcamentoARA.jsx): "128.835,3" (formato BR) virava NaN→0
// porque o replace(',', '.') sozinho gerava "128.835.3" (dois pontos).
export function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

export function somaMes(arr) {
  return (arr || []).reduce((a, v) => a + parseNum(v), 0);
}

// Desembolsos mensais de um projeto de CAPEX (2026-09-09) — ver nota
// completa no espelho frontend. Compat: projeto antigo com valor único
// (`valor`/`mes`), sem `desembolsos` ainda, é lido como desembolsado só
// naquele mês.
export function desembolsosDoProjeto(p) {
  if (p.desembolsos) return p.desembolsos;
  if (p.valor) {
    const arr = mesesVazios();
    const idx = p.mes ? MESES.indexOf(p.mes) : -1;
    arr[idx >= 0 ? idx : 0] = p.valor;
    return arr;
  }
  return mesesVazios();
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
    // Competência × caixa (2026-08-23, ver UNIDADES_COM_COMPETENCIA_CAIXA no
    // frontend) — por padrão o fato gerador e o pagamento ocorrem no mesmo
    // mês (pagamentoDiferente false); a DRE nunca usa estes 2 campos, só o
    // FC (ver valorLinhaMesCaixa/computeFluxoIndiretoMensal/
    // computeFluxoCaixaDiretoMensal).
    pagamentoDiferente: false,
    valoresPagamento: mesesVazios(),
    // Reajuste Inflação — único × mensal (2026-08-23) — espelho de
    // frontend/src/OrcamentoARA.jsx.
    reajusteInflacaoTipo: 'mensal',
    reajusteInflacaoMes: '',
  };
}

// Múltiplas linhas por conta analítica (2026-08-23, "se o gestor quiser
// incluir mais de uma linha dentro de cada despesa, ex.: por fornecedor" —
// avalie e ajuste para todas as empresas"): custos.linhas['CC|Conta'] passa
// a poder ser { classificacao, sublinhas: [novaLinhaVazia(), ...] } em vez
// de uma linha só — normalizarConta aceita os dois formatos (dado salvo
// antes desta mudança é tratado como 1 sublinha "legacy", sem migração de
// banco: custos.linhas continua um JSONB livre). Espelho de
// frontend/src/OrcamentoARA.jsx.
export function normalizarConta(contaRaw) {
  if (!contaRaw) return novaContaVazia();
  if (Array.isArray(contaRaw.sublinhas)) {
    return { classificacao: contaRaw.classificacao || 'fixo', sublinhas: contaRaw.sublinhas };
  }
  return { classificacao: contaRaw.classificacao || 'fixo', sublinhas: [{ ...contaRaw, id: contaRaw.id || 'legacy' }] };
}
export function novaContaVazia() {
  return { classificacao: 'fixo', sublinhas: [novaLinhaVazia()] };
}

// IPCA mensal composto a partir de um IPCA anual (%) — usado só pelo tipo
// de premissa 'reajuste_inflacao'. (1+ipcaAnual/100)^(1/12) - 1.
export function ipcaMensalDe(ipcaAnualPct) {
  const anual = parseNum(ipcaAnualPct);
  if (!anual) return 0;
  return Math.pow(1 + anual / 100, 1 / 12) - 1;
}

// Valor de uma linha (chave CC|Conta) em um mês, de acordo com o tipo de premissa.
// receitaBrutaMes/receitaLiquidaMes são arrays de 12 posições, vindos do computeDRE.
// ipcaAnualPct (2026-08-20, tipo 'reajuste_inflacao') e volumeTotalKgMes
// (tipo 'custo_por_kg') são opcionais — quando quem chama não os informa,
// o cálculo degrada sem quebrar: reajuste_inflacao cai pro valor-base sem
// reajuste (equivalente a IPCA 0%) e custo_por_kg cai pra zero.
export function valorSublinhaMes(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes) {
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
  // Resorts: % sobre a receita de Hospedagem / de A&B (espelho do frontend).
  if (sublinha.premissaTipo === 'rateio_hospedagem') {
    const pct = parseNum(sublinha.percentuais?.[m]) / 100;
    const base = receitaHospedagemMes?.[m] || 0;
    return base * pct;
  }
  if (sublinha.premissaTipo === 'rateio_aeb') {
    const pct = parseNum(sublinha.percentuais?.[m]) / 100;
    const base = receitaAebMes?.[m] || 0;
    return base * pct;
  }
  if (sublinha.premissaTipo === 'reajuste_inflacao') {
    const base = parseNum(sublinha.valores?.[m]);
    // Único × mensal (2026-08-23) — espelho de frontend/src/OrcamentoARA.jsx.
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
// Múltiplas linhas por conta (2026-08-23): valorLinhaMes/valorLinhaAnual
// normalizam a conta (normalizarConta) e SOMAM o valor de todas as
// sublinhas — mantém a assinatura idêntica à de antes, então todo o
// resto do arquivo (computeDRE, runAuditoria, FC, etc.) continua chamando
// exatamente como chamava, sem saber que por baixo pode haver mais de uma
// sublinha. Espelho de frontend/src/OrcamentoARA.jsx.
export function valorLinhaMes(contaRaw, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes) {
  if (!contaRaw) return 0;
  return normalizarConta(contaRaw).sublinhas.reduce((acc, sub) => acc + valorSublinhaMes(sub, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes), 0);
}
export function valorLinhaAnual(contaRaw, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes) {
  return MESES.reduce((acc, _, m) => acc + valorLinhaMes(contaRaw, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes), 0);
}
// Valor de CAIXA (pagamento) de uma sublinha num mês — usado só pelo Fluxo de
// Caixa, nunca pela DRE. Espelho exato de frontend/src/OrcamentoARA.jsx.
export function valorSublinhaMesCaixa(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes) {
  if (!sublinha) return 0;
  if (sublinha.pagamentoDiferente) return parseNum(sublinha.valoresPagamento?.[m]);
  return valorSublinhaMes(sublinha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes);
}
export function valorLinhaMesCaixa(contaRaw, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes) {
  if (!contaRaw) return 0;
  return normalizarConta(contaRaw).sublinhas.reduce((acc, sub) => acc + valorSublinhaMesCaixa(sub, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes), 0);
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
    : linha.premissaTipo === 'custo_por_kg' ? [linha.valoresUnit]
    : [linha.valores]; // 'direto' e 'reajuste_inflacao' usam `valores` (base, no caso do reajuste)
  return campos.some(arr => (arr || []).some(v => parseNum(v) < 0));
}
// Wrappers em nível de CONTA (2026-08-23) — usados por runAuditoria, que
// só precisa saber se a conta (qualquer uma de suas sublinhas) tem
// problema, não qual sublinha especificamente. Espelho de
// frontend/src/OrcamentoARA.jsx.
export function contaIncoerente(contaRaw) {
  return normalizarConta(contaRaw).sublinhas.some(sub => linhaIncoerente(sub));
}
export function contaTemNegativo(contaRaw) {
  return normalizarConta(contaRaw).sublinhas.some(sub => linhaTemNegativo(sub));
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
// Produção Core (2026-10-02): o produto 'BAIXO GIRO' saiu da receita da Produção
// Core — o dado foi para a Produção BG. O produto continua guardado no documento
// (nada é apagado), mas é ignorado em cálculo, quadros, exportações e checks.
const NOME_PRODUTO_CORE_EXCLUIDO = 'BAIXO GIRO';
const produtosReceitaAtivos = (lista) => (Array.isArray(lista) ? lista : []).filter(p => (p?.nome || '').trim().toUpperCase() !== NOME_PRODUTO_CORE_EXCLUIDO);
const PRODUTOS_BG = [{ nome: 'BAIXO GIRO ANTIGO' }, { nome: 'BAIXO GIRO NOVO' }];

// Produção BG (2026-09-29): o volume do BAIXO GIRO NOVO não é digitado — é um
// % (`pctCore`, por mês) sobre o volume total da Produção Core (soma dos
// volumes de todos os produtos do documento 'textil'). Preço continua input.
// Aplicado na LEITURA (GET/envio), sem gravar nada na Core; mês sem % digitado
// mantém o volume que já estiver salvo (nenhum dado preenchido é sobrescrito).
export const NOME_BG_NOVO = 'BAIXO GIRO NOVO';
export function volumeTotalCoreMes(dadosCore) {
  const produtos = produtosReceitaAtivos(dadosCore?.receita?.produtos);
  return MESES.map((_, m) => produtos.reduce((acc, p) => acc + parseNum(p?.volumes?.[m]), 0));
}
export function aplicarVolumeBgNovo(dadosBg, volumeCoreMes) {
  const produtos = dadosBg?.receita?.produtos;
  if (!Array.isArray(produtos) || !Array.isArray(volumeCoreMes)) return dadosBg;
  const novos = produtos.map(p => {
    if (p?.nome !== NOME_BG_NOVO) return p;
    const pct = Array.isArray(p.pctCore) ? p.pctCore : [];
    const base = Array.isArray(p.volumes) ? p.volumes : mesesVazios();
    const volumes = MESES.map((_, m) => {
      const bruto = pct[m];
      if (bruto === undefined || bruto === null || String(bruto).trim() === '') return base[m] ?? '';
      return (parseNum(bruto) / 100) * (volumeCoreMes[m] || 0);
    });
    return { ...p, volumes };
  });
  return { ...dadosBg, receita: { ...dadosBg.receita, produtos: novos } };
}
function receitaVazia(unidadeId) {
  if (unidadeId === 'textil' || unidadeId === 'textil_bg') {
    return {
      // Produção BG (2026-09-29): só Baixo Giro Antigo e Baixo Giro Novo — espelho do frontend.
      produtos: (unidadeId === 'textil_bg' ? PRODUTOS_BG : produtosReceitaAtivos(PRODUTOS_REF)).map(p => ({ id: uid(), nome: p.nome, volumes: mesesVazios(), precos: mesesVazios(), ...(p.nome === NOME_BG_NOVO ? { pctCore: mesesVazios() } : {}) })),
      deducoes: DEDUCOES_REF.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios() })),
    };
  }
  if (unidadeId === 'agricola' || unidadeId === 'agricola_tds' || unidadeId === 'agricola_fds') {
    return {
      // Produção -> Vendas Mercado Interno/Externo (2026-09-07) — espelho de
      // frontend/src/OrcamentoARA.jsx (ver receitaVazia/computeReceitaAgricola
      // lá pro racional completo). Substitui o modelo anterior (produtos);
      // nenhum documento tinha sido preenchido até esta data (confirmado
      // com o usuário).
      agricola: {
        embaladaKg: mesesVazios(),
        refugoPct: '',
        vendaInterna: { pctTon: mesesVazios(), precoKg: mesesVazios() },
        vendaExterna: {
          pctTon: mesesVazios(),
          volumeKg: mesesVazios(),
          gbp: { pct: mesesVazios(), precoMoeda: mesesVazios() },
          eur: { pct: mesesVazios(), precoMoeda: mesesVazios() },
          usd: { pct: mesesVazios(), precoMoeda: mesesVazios() },
        },
        justificativa: '',
      },
      deducoes: DEDUCOES_REF_AGRICOLA.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios() })),
    };
  }
  if (unidadeId === 'resorts' || unidadeId === 'samoa_beach' || unidadeId === 'samoa_villa') {
    const linhas = {};
    // premissaTipo já nasce correto por linha (ver tipoLinhaReceitaResorts) —
    // não é escolha do usuário, é fixo pela definição. Cálculo (computeDRE/
    // runAuditoria) normaliza de novo por segurança, mas documento novo já
    // sai certo.
    LINHAS_RECEITA_RESORTS.forEach((l) => { linhas[l.id] = { ...novaLinhaVazia(), premissaTipo: l.tipo }; });
    return {
      linhas,
      deducoes: DEDUCOES_REF_RESORTS.map(d => ({ id: d.id, nome: d.nome, pcts: mesesVazios(), baseLinhaIds: d.baseLinhaIds })),
    };
  }
  // La Fleur II (2026-09-27): receita, RET e custo pelo POC — ver pocLaFleur.js.
  if (unidadeId === 'ei_lafleur') return { poc: pocVazio(), deducoes: [] };
  // Holding (2026-10-02): receita simples por linha, com projeção mensal em R$ — `linhasLivres`.
  if (unidadeId === 'ei_holding') return { linhasLivres: [], deducoes: [] };
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
      // meritocraciaPct/dissidioMes/dissidioPct (2026-08-23) — espelho de
      // frontend/src/OrcamentoARA.jsx, ver nota completa em
      // computeFolhaPessoalMes.
      premissasPessoal: {
        inssPct: '', fgtsPct: '', feriasPct: '', decimoTerceiroPct: '', meritocraciaPct: '',
        valeTransporteValor: '', cestaBasicaValor: '', planoSaudeValor: '', outrosBeneficiosValor: '',
        dissidioMes: '', dissidioPct: '',
      },
      // Só Corporativo, conta CORP18 "Passagem e Hospedagem" (decisão de
      // 2026-08-19) — { [ccCodigo]: [viagem, ...] }. O backend nunca
      // calcula em cima disto: o frontend sincroniza o total já pronto em
      // custos.linhas['CC|CORP18'] a cada edição (ver nota espelho em
      // frontend/src/OrcamentoARA.jsx, computeViagensMes) — este campo só
      // precisa existir aqui pra o documento novo ter o formato certo.
      viagens: {},
    },
    capex: { projetos: [] },
    capitalGiro: {
      prazoRecebimento: mesesVazios(), prazoPagamento: mesesVazios(), giroEstoque: mesesVazios(), justificativa: '',
      // Só usado por ARA Têxtil (ver Premissas Têxtil.xlsx, aba Premissas
      // Kgiro — decisão de 2026-08-16). Agrícola/Resorts continuam só com
      // os prazos em dias acima.
      ...(unidadeId === 'textil' || unidadeId === 'textil_bg' ? {
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
      aliquotaIR: '34', aliquotaIRPct: '6,25', aliquotaCSPct: '9', justificativa: '',
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
      ...(unidadeId === 'textil' || unidadeId === 'textil_bg' ? { planoContas: planoContasBalancoVazio(), saldosIniciais: saldosIniciaisBalancoVazio() } : {}),
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
//
// Meritocracia/Dissídio (2026-08-23) — espelho de frontend/src/OrcamentoARA.jsx,
// ver nota completa lá. Consultoria PJ (revisado em 2026-08-23) NÃO entra
// mais aqui — é uma conta analítica normal do pacote Pessoal (CORP03
// "Consultórias PJs", só Corporativo — ver CONTA_CONSULTORIA_PJ), somada
// como qualquer outra conta em custos.linhas (ver computeDRE).
// ---------------------------------------------------------------------------
export function computeFolhaPessoalMes(funcionariosCC, premissas, mIdx) {
  const ativos = (funcionariosCC || []).filter(f => {
    if (!f.mesAdmissao) return true;
    const idxAdm = MESES.indexOf(f.mesAdmissao);
    return idxAdm === -1 || idxAdm <= mIdx;
  });

  const idxDissidio = premissas?.dissidioMes ? MESES.indexOf(premissas.dissidioMes) : -1;
  const idxDissidio2 = premissas?.dissidioMes2 ? MESES.indexOf(premissas.dissidioMes2) : -1;
  const fatorDissidio =
    (idxDissidio >= 0 && mIdx >= idxDissidio ? (1 + parseNum(premissas?.dissidioPct) / 100) : 1) *
    (idxDissidio2 >= 0 && mIdx >= idxDissidio2 ? (1 + parseNum(premissas?.dissidioPct2) / 100) : 1);
  const salarios = ativos.reduce((acc, f) => acc + parseNum(f.salario) * fatorDissidio, 0);
  const inss = salarios * (parseNum(premissas?.inssPct) / 100);
  const fgts = salarios * (parseNum(premissas?.fgtsPct) / 100);
  const ferias = salarios * (parseNum(premissas?.feriasPct) / 100);
  const decimoTerceiro = salarios * (parseNum(premissas?.decimoTerceiroPct) / 100);
  // Novo Headcount não é elegível à meritocracia no ano (decisão de 2026-09-23,
  // espelho do frontend).
  const meritocracia = 0;
  const beneficiosPorFuncionario = parseNum(premissas?.valeTransporteValor) + parseNum(premissas?.cestaBasicaValor) + parseNum(premissas?.planoSaudeValor) + parseNum(premissas?.outrosBeneficiosValor);
  const beneficios = ativos.length * beneficiosPorFuncionario;
  const encargos = inss + fgts + ferias;
  const total = salarios + encargos + decimoTerceiro + beneficios;
  return { qtdFuncionarios: ativos.length, salarios, inss, fgts, ferias, encargos, decimoTerceiro, meritocracia, beneficios, total };
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
// 'existente' (2026-09-08) — espelho de frontend/src/OrcamentoARA.jsx (ver
// nota completa lá): sai do cálculo por funcionário, vira a conta analítica
// "Headcount Existente" do pacote Pessoal, somada como qualquer conta em
// custos.linhas (ver cpv/despesasSemDA abaixo). Só 'novo' passa por aqui.
// Tipo contábil de uma linha: tipo do CC, ou origem da conta onde
// ref.dreSegueOrigemConta (Agrícola) — espelho do frontend. Depreciação
// (pacote 'depreciacao') sempre abaixo do EBITDA, mesmo em conta de origem
// Custo como 71102008 (pedido do usuário, 2026-09-28).
export function tipoDaLinha(ref, cc, contaCodigo) {
  if (ref.dreSegueOrigemConta) {
    const conta = ref.todasContas?.[contaCodigo];
    if (conta?.pacoteId === 'depreciacao') return 'despesa';
    if (conta?.origem === 'Custo') return 'producao';
    if (conta?.origem === 'Despesa') return 'despesa';
  }
  return cc.tipo;
}

// Espelho de pessoalCalculadoPorCC/pessoalExtraPorCC do frontend — ver nota lá.
const CONTA_CONSULTORIA_PJ = 'CORP03';
function multiplicadorBonus(v) {
  return v === undefined || v === null || String(v).trim() === '' ? 1 : parseNum(v);
}

// ---------------------------------------------------------------------------
// ARA Agrícola — Headcount Existente aberto por conta analítica (2026-09-30).
// Fonte: "Premissa - sugestão v2 1.xlsx" (aba Premissas, 189 funções), somada
// por fazenda × CC. Por CC: [fazenda, cc, S, S reajustado, HE, HE reajustado, HC]
//   S  = Σ salário × HC (salário sem reajuste, coluna U da planilha)
//   S reajustado = Σ salário × HC × (1 + reajuste da categoria da função — 4,28% ou 7%)
//   HE = Σ salário × HC × % horas extras da função (3% ou 0%); idem reajustado
// Regras (decisões do usuário): dissídio a partir do mês da premissa (Janeiro);
// meritocracia = % da premissa (5%) × (salário + dissídio), a partir do mês da
// premissa; bônus = % × multiplicador × Salários do mês do bônus (S + D + M);
// encargos sobre E = S + D + M: FGTS 8%, INSS 2,7%, HE (% da função), férias
// 1/12 + 1/3 (1/12 × 33,33%), 13º 1/12 (caixa: metade em Nov, metade em Dez).
// Salários da conta = S + D + M + B. Só soma no orçamento quando o Admin FP&A
// ativa a abertura (premissasPessoal.hcAberturaPorConta === 'sim'); até lá o
// valor consolidado (HC_EXISTENTE) segue valendo e a abertura é só prévia.
// ---------------------------------------------------------------------------
const HC_AGRICOLA_PLANILHA = [
  ['tds', '50303', 364707.00, 389151.7540, 10756.5900, 11482.0309, 210],
  ['tds', '50102', 23831.00, 24896.2276, 530.3100, 554.3651, 8],
  ['tds', '50605', 12226.00, 12749.2728, 182.1600, 189.9564, 4],
  ['tds', '50710', 7070.00, 7372.5960, 89.3100, 93.1325, 2],
  ['tds', '50601', 6524.00, 6803.2272, 0.000, 0.0000, 1],
  ['fds', '50102', 16884.00, 17606.6352, 506.5200, 528.1991, 6],
  ['fds', '50207', 7491.00, 7902.1364, 224.7300, 237.0641, 4],
  ['fds', '50203', 8575.00, 9032.5316, 257.2500, 270.9759, 4],
  ['fds', '50301', 289178.00, 308442.0760, 8490.7200, 9060.7405, 164],
  ['fds', '50302', 306211.00, 326652.1540, 9001.7100, 9607.0429, 176],
  ['fds', '50402', 11953.00, 12518.0636, 358.5900, 375.5419, 5],
  ['fds', '50502', 7682.00, 8010.7896, 230.4600, 240.3237, 3],
  ['fds', '50101', 26239.00, 27362.0292, 224.1000, 233.6915, 4],
  ['fds', '50712', 6524.00, 6803.2272, 0.000, 0.0000, 1],
  ['tds', '50203', 21265.00, 22401.4460, 637.9500, 672.0434, 11],
  ['tds', '50205', 8590.00, 9048.1736, 257.7000, 271.4452, 5],
  ['tds', '50301', 303159.00, 323373.2948, 8899.0500, 9497.1020, 173],
  ['tds', '50302', 358011.00, 381852.1492, 10555.7100, 11263.0427, 205],
  ['tds', '50503', 269543.00, 288049.6036, 8086.2900, 8641.4881, 161],
  ['tds', '50606', 17262.00, 18362.9000, 517.8600, 550.8870, 10],
  ['tds', '50202', 3926.00, 4139.2936, 117.7800, 124.1788, 2],
  ['tds', '50402', 15612.00, 16376.7536, 468.3600, 491.3026, 7],
  ['tds', '50207', 8559.00, 8925.3252, 256.7700, 267.7598, 4],
  ['tds', '50403', 17605.00, 18760.9452, 528.1500, 562.8284, 9],
  ['tds', '50201', 3701.00, 3859.4028, 111.0300, 115.7821, 2],
  ['tds', '50712', 10915.00, 11382.1620, 142.8300, 148.9431, 3],
  ['tds', '50502', 13654.00, 14238.3912, 245.2800, 255.7780, 4],
  ['tds', '50105', 2499.00, 2605.9572, 74.9700, 78.1787, 1],
  ['tds', '50206', 9797.00, 10216.3116, 109.2900, 113.9676, 2],
  ['fds', '50503', 149301.00, 159492.9900, 4479.0300, 4784.7897, 89],
  ['fds', '50606', 14125.00, 15001.1148, 423.7500, 450.0334, 8],
  ['fds', '50201', 5063.00, 5324.9572, 151.8900, 159.7487, 3],
  ['fds', '50405', 1664.00, 1780.4800, 49.9200, 53.4144, 1],
  ['fds', '50202', 6059.00, 6318.3252, 181.7700, 189.5498, 2],
  ['fds', '50403', 12669.00, 13555.8300, 380.0700, 406.6749, 7],
  ['fds', '50501', 1934.00, 2016.7752, 58.0200, 60.5033, 1],
  ['fds', '50205', 3793.00, 3955.3404, 113.7900, 118.6602, 2],
];
const HC_AGRICOLA_POR_CC = {};
HC_AGRICOLA_PLANILHA.forEach(([fazenda, cc, s, sReaj, he, heReaj, hc]) => {
  HC_AGRICOLA_POR_CC[`${fazenda}|${cc}`] = { s, sReaj, he, heReaj, hc };
});
// Classe de custeio do CC (PLANO_C_CUSTO_2026, coluna "Tipo de custeio"):
// Custo → contas 71101, Adm → 34201, Comercial → 34101.
const CCS_COMERCIAIS_AGRICOLA = ['50601', '50602', '50605', '50505'];
function custeioCcAgricola(cc) {
  if (cc?.tipo === 'producao') return 'custo';
  return CCS_COMERCIAIS_AGRICOLA.includes(cc?.codigo) ? 'comercial' : 'adm';
}
const CONTAS_ABERTURA_AGRICOLA = {
  custo: { aberturaSalarios: '71101001', aberturaFgts: '71101007', aberturaHe: '71101003', aberturaInss: '71101006', aberturaFerias: '71101004', aberturaDecimo: '71101005' },
  adm: { aberturaSalarios: '34201001', aberturaFgts: '34201006', aberturaHe: '34201014', aberturaInss: '34201005', aberturaFerias: '34201004', aberturaDecimo: '34201003' },
  comercial: { aberturaSalarios: '34101001', aberturaFgts: '34101006', aberturaHe: '34101014', aberturaInss: '34101005', aberturaFerias: '34101004', aberturaDecimo: '34101003' },
};
// Conta da classe do CC? (só os da sua origem — contas com valor lançado
// continuam aparecendo na tela mesmo fora da classe, para nada sumir).
function contaDaClasseAgricola(conta, classe) {
  const c = conta.codigo;
  if (classe === 'custo') return conta.origem === 'Custo';
  if (classe === 'comercial') return c.startsWith('34101') || c.startsWith('34202');
  return c.startsWith('34201') || c.startsWith('34202') || c.startsWith('34203');
}
function aberturaAtivaAgricola(pp) {
  return pp?.hcAberturaPorConta === 'sim';
}
// Abertura calculada de um CC (null se a planilha não tem esse CC).
function aberturaHcAgricolaCC(ref, ccCodigo, pp) {
  const dadosCc = ref?.hcAberturaFazenda ? HC_AGRICOLA_POR_CC[`${ref.hcAberturaFazenda}|${ccCodigo}`] : null;
  if (!dadosCc) return null;
  const cc = (ref.ccs || []).find(c => c.codigo === ccCodigo);
  const contas = CONTAS_ABERTURA_AGRICOLA[custeioCcAgricola(cc)];
  const idxMes = (mes, padrao) => { const i = MESES.indexOf(mes || padrao); return i; };
  const iDiss = idxMes(pp?.dissidioMes, 'Jan');
  const iMerit = pp?.meritocraciaMes ? MESES.indexOf(pp.meritocraciaMes) : -1;
  const iBonus = pp?.bonusMes ? MESES.indexOf(pp.bonusMes) : -1;
  const pctMerit = parseNum(pp?.meritocraciaPct) / 100;
  const S = MESES.map(() => dadosCc.s);
  const D = MESES.map((_, m) => (iDiss >= 0 && m >= iDiss ? dadosCc.sReaj - dadosCc.s : 0));
  const M = MESES.map((_, m) => (iMerit >= 0 && m >= iMerit ? (S[m] + D[m]) * pctMerit : 0));
  const E = MESES.map((_, m) => S[m] + D[m] + M[m]);
  const B = MESES.map((_, m) => (iBonus >= 0 && m === iBonus ? E[m] * multiplicadorBonus(pp?.bonusMultiplicador) * parseNum(pp?.bonusPct) / 100 : 0));
  // HE por função (3% ou 0%): taxa efetiva do CC sobre o salário, antes/depois do dissídio.
  const taxaHe = MESES.map((_, m) => (D[m] ? (dadosCc.sReaj ? dadosCc.heReaj / dadosCc.sReaj : 0) : (dadosCc.s ? dadosCc.he / dadosCc.s : 0)));
  const linhas = {
    aberturaSalarios: MESES.map((_, m) => E[m] + B[m]),
    aberturaFgts: E.map(v => v * 0.08),
    aberturaHe: E.map((v, m) => v * taxaHe[m]),
    aberturaInss: E.map(v => v * 0.027),
    aberturaFerias: E.map(v => v * (1 / 12 + (1 / 12) * 0.3333)),
    aberturaDecimo: E.map(v => v / 12),
  };
  const totalMes = MESES.map((_, m) => Object.values(linhas).reduce((acc, arr) => acc + arr[m], 0));
  return { S, D, M, B, E, linhas, contaDaChave: contas, totalMes, totalAnual: totalMes.reduce((a, v) => a + v, 0), hc: dadosCc.hc };
}
// Soma, no mês, das linhas da abertura (moram em contas do pacote Pessoal).
function calculadasAberturaMes(calc, m) {
  return Object.keys(calc?.contaDaChave || {}).reduce((acc, k) => acc + (calc[k]?.[m] || 0), 0);
}
export function pessoalCalculadoPorCC(data, ref, ccCodigo, bases) {
  const pp = data.custos.premissasPessoal || {};
  const linhas = data.custos.linhas || {};
  const idx = (mes) => (mes ? MESES.indexOf(mes) : -1);
  const valorContaMes = (conta, m) => valorLinhaMes(linhas[`${ccCodigo}|${conta}`], m, bases.receitaBrutaMes, bases.receitaLiquidaMes, bases.ipcaAnualPct, bases.volumeTotalKgMes, bases.receitaHospedagemMes, bases.receitaAebMes);
  const ehCorporativo = !!ref.todasContas?.[CONTA_CONSULTORIA_PJ];
  const contasPessoal = ref.planoContas?.pessoal || [];
  const contasHc = ehCorporativo
    ? contasPessoal.filter(c => c.nome === 'Headcount Existente').slice(0, 1)
    : contasPessoal.filter(c => c.codigo.startsWith('HC_EXISTENTE'));
  const hcMes = contasHc.length > 0 ? MESES.map((_, m) => contasHc.reduce((acc, c) => acc + valorContaMes(c.codigo, m), 0)) : null;

  const iMerit = idx(pp.meritocraciaMes);
  const iBonus = idx(pp.bonusMes);
  const iBonusPj = idx(pp.bonusPjMes);
  const meritocracia = hcMes ? MESES.map((_, m) => (iMerit >= 0 && m >= iMerit ? hcMes[m] * parseNum(pp.meritocraciaPct) / 100 : 0)) : null;
  const dissidioSobreHc = (iD, pct) => MESES.map((_, m) => (iD < 0 || m < iD ? 0 : (hcMes[m] + (meritocracia?.[m] || 0)) * parseNum(pct) / 100));
  // Agrícola: HC Existente já vem reajustado — sem dissídio sobre ele.
  const aplicaDissidio = hcMes && !ref.hcExistenteComDissidio;
  const dissidio1 = aplicaDissidio ? dissidioSobreHc(idx(pp.dissidioMes), pp.dissidioPct) : null;
  const dissidio2 = aplicaDissidio && !ehCorporativo ? dissidioSobreHc(idx(pp.dissidioMes2), pp.dissidioPct2) : null;
  // Agrícola: base do bônus = salários reajustados só das funções elegíveis.
  // Demais unidades (2026-09-29): o bônus incide só sobre o SALÁRIO, mas o HC
  // Existente já traz encargos e benefícios — o salário é extraído dividindo
  // pelo mesmo fator (1 + encargosNovoHcPct/100) do Novo HC, sobre HC Existente +
  // meritocracia + dissídios já vigentes no mês do bônus. Sem o % preenchido
  // o fator é 1 e o cálculo fica como era.
  const baseBonus = ref.bonusSomenteElegiveis
    ? parseNum(pp.baseBonusElegiveisPorCC?.[ccCodigo])
    : (hcMes && iBonus >= 0 ? ((hcMes[iBonus] + (meritocracia?.[iBonus] || 0) + (dissidio1?.[iBonus] || 0) + (dissidio2?.[iBonus] || 0)) / (1 + parseNum(pp.encargosNovoHcPct) / 100)) : 0);
  const bonus = hcMes || ref.bonusSomenteElegiveis
    ? MESES.map((_, m) => (iBonus >= 0 && m === iBonus ? baseBonus * multiplicadorBonus(pp.bonusMultiplicador) * parseNum(pp.bonusPct) / 100 : 0))
    : null;
  const bonusPj = ehCorporativo && iBonusPj >= 0
    ? MESES.map((_, m) => (m === iBonusPj ? valorContaMes(CONTA_CONSULTORIA_PJ, iBonusPj) * multiplicadorBonus(pp.bonusPjMultiplicador) * parseNum(pp.bonusPjAtendimentoPct) / 100 : 0))
    : null;
  let licencaSoftware = null;
  if (ehCorporativo) {
    const novos = (data.custos.funcionarios || []).filter(f => f.ccCodigo === ccCodigo && f.origem === 'novo');
    const valorAno = parseNum(pp.licencaSoftwareNovoHcValor || '2700');
    licencaSoftware = MESES.map((_, m) => novos.filter(f => { const i = MESES.indexOf(f.mesAdmissao); return i >= 0 && i <= m; }).length * valorAno / 12);
  }
  // La Fleur II: comissão apropriada do POC, na conta 34102001 do CC escolhido.
  const poc = data.receita?.poc;
  const comissaoPoc = poc && ccCodigo === (poc.premissas?.ccComissao || CC_COMISSAO_POC_PADRAO)
    ? pocDoDocumento(data).comissaoMes
    : null;

  // ARA Agrícola (2026-09-30): com a abertura por conta ativa, o HC Existente do
  // CC sai do valor consolidado e passa a ser a abertura da planilha de pessoal
  // (salários, FGTS, HE, INSS, férias, 13º — ver aberturaHcAgricolaCC). O valor
  // consolidado continua gravado (nada é apagado): entra um estorno do mesmo
  // valor, e meritocracia/bônus passam a ser calculados dentro da abertura.
  // CC sem linha na planilha segue o racional antigo.
  const abertura = aberturaAtivaAgricola(pp) ? aberturaHcAgricolaCC(ref, ccCodigo, pp) : null;
  const calculadas = abertura
    ? { meritocracia: null, dissidio1, dissidio2, bonus: null, bonusPj, licencaSoftware, comissaoPoc,
      ...abertura.linhas, estornoHcConsolidado: hcMes ? hcMes.map(v => -v) : null }
    : { meritocracia, dissidio1, dissidio2, bonus, bonusPj, licencaSoftware, comissaoPoc };
  const totalMes = MESES.map((_, m) => Object.values(calculadas).reduce((acc, row) => acc + (row?.[m] || 0), 0));
  return { ...calculadas, hcExistenteMes: hcMes, contaDaChave: abertura ? abertura.contaDaChave : null, aberturaBonusMes: abertura ? abertura.B : null, totalMes, totalAnual: totalMes.reduce((a, v) => a + v, 0) };
}
export function pessoalExtraPorCC(data, ref, ccCodigo, bases) {
  const fator = 1 + parseNum(data.custos.premissasPessoal?.encargosNovoHcPct) / 100;
  const folha = folhaAnualPorCC(data, ccCodigo);
  const calc = pessoalCalculadoPorCC(data, ref, ccCodigo, bases);
  const mes = MESES.map((_, m) => folha.mensal[m].total * fator + calc.totalMes[m]);
  return { mes, anual: mes.reduce((a, v) => a + v, 0), folha, calc };
}
function pessoalExtraTodosCCs(data, ref, dre, ipcaAnualPct) {
  const bases = { receitaBrutaMes: dre.receitaBrutaMes, receitaLiquidaMes: dre.receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes: dre.volumeTotalKgMes, receitaHospedagemMes: dre.receitaHospedagemMes, receitaAebMes: dre.receitaAebMes };
  return Object.fromEntries(ref.ccs.map(cc => [cc.codigo, pessoalExtraPorCC(data, ref, cc.codigo, bases)]));
}

export function folhaAnualPorCC(data, ccCodigo) {
  const funcs = (data.custos.funcionarios || []).filter(f => f.ccCodigo === ccCodigo && f.origem === 'novo');
  return computeFolhaPessoalAnual(funcs, data.custos.premissasPessoal);
}

// Duas formas de modelar receita, conforme a unidade (ver
// calc/receitaAgricolaResorts.js): `receita.produtos` (Volume × Preço por
// produto — Têxtil e Agrícola) ou `receita.linhas` (quantidade × valor
// unitário ou valor direto por linha — Resorts, modelo de hotelaria). Uma
// exclui a outra; nunca as duas ao mesmo tempo num mesmo documento.
// cambios ({ usd, eur, gbp }, 2026-08-23) — câmbio estático (mesmo valor o
// ano inteiro) da premissa macro do FP&A Corporativo, usado só por produtos
// de Mercado Externo (mercado==='externo') do modelo `produtos` (Agrícola —
// ver receitaVazia). Espelho de frontend/src/OrcamentoARA.jsx.
// Racional de receita da ARA Agrícola (2026-09-07) — espelho de
// frontend/src/OrcamentoARA.jsx (ver computeReceitaAgricola lá pro racional
// completo). Substitui o modelo anterior (produtos) por uma cascata
// Produção -> Vendas Mercado Interno/Externo.
function computeReceitaAgricola(agricola, cambios) {
  const embaladaKgMes = (agricola?.embaladaKg || mesesVazios()).map(parseNum);
  const refugoPct = parseNum(agricola?.refugoPct) / 100;
  const refugoKgMes = embaladaKgMes.map(v => v * refugoPct);
  const producaoTotalKgMes = embaladaKgMes.map((v, m) => v + refugoKgMes[m]);

  // Volume Mercado Externo (2026-09-11) — ver nota completa no espelho
  // frontend (AbaReceitaAgricola/computeReceitaAgricola): passa a ser o
  // dado digitado direto (vendaExterna.volumeKg); o Interno vira o residual
  // (Produção Total − Externo do mesmo mês, nunca negativo). pctTon (dos
  // dois lados) fica sem uso, não apagado do documento por compatibilidade.
  const ve = agricola?.vendaExterna || {};
  // Volume por moeda digitado direto (espelho do frontend 2026-09-14).
  // ve.volumeKg (campo anterior do total) fica no modelo para compat.
  const gbpVolumeKgMes = (ve.gbp?.volumeKg || mesesVazios()).map(parseNum);
  const eurVolumeKgMes = (ve.eur?.volumeKg || mesesVazios()).map(parseNum);
  const usdVolumeKgMes = (ve.usd?.volumeKg || mesesVazios()).map(parseNum);
  const volumeExternoTotalKgMes = MESES.map((_, m) => gbpVolumeKgMes[m] + eurVolumeKgMes[m] + usdVolumeKgMes[m]);
  // Volume interno = embalada − externo (refugo é vendido separadamente).
  const volumeInternoKgMes = embaladaKgMes.map((v, m) => Math.max(0, v - volumeExternoTotalKgMes[m]));

  const vi = agricola?.vendaInterna || {};
  const receitaInternaMes = volumeInternoKgMes.map((v, m) => v * parseNum(vi.precoKg?.[m]));
  const precoRefugoKgMes = (vi.precoRefugoKg || mesesVazios()).map(parseNum);
  const receitaRefugoMes = refugoKgMes.map((v, m) => v * precoRefugoKgMes[m]);

  const pctInternoMes = embaladaKgMes.map((v, m) => v > 0 ? (volumeInternoKgMes[m] / v) * 100 : 0);
  const pctExternoMes = embaladaKgMes.map((v, m) => v > 0 ? (volumeExternoTotalKgMes[m] / v) * 100 : 0);

  function porMoeda(moedaObj, chaveCambio, volumeKgMes) {
    const taxa = parseNum(cambios?.[chaveCambio]);
    const receitaMes = volumeKgMes.map((v, m) => v * parseNum(moedaObj?.precoMoeda?.[m]) * taxa);
    return { volumeKgMes, receitaMes };
  }
  const gbp = porMoeda(ve.gbp, 'gbp', gbpVolumeKgMes);
  const eur = porMoeda(ve.eur, 'eur', eurVolumeKgMes);
  const usd = porMoeda(ve.usd, 'usd', usdVolumeKgMes);
  const receitaExternaMes = MESES.map((_, m) => gbp.receitaMes[m] + eur.receitaMes[m] + usd.receitaMes[m]);

  const receitaBrutaMes = MESES.map((_, m) => receitaInternaMes[m] + receitaExternaMes[m] + receitaRefugoMes[m]);

  return {
    embaladaKgMes, refugoKgMes, producaoTotalKgMes,
    volumeInternoKgMes, receitaInternaMes, precoRefugoKgMes, receitaRefugoMes,
    pctInternoMes, pctExternoMes, volumeExternoTotalKgMes, gbp, eur, usd, receitaExternaMes,
    receitaBrutaMes,
  };
}

function receitaBrutaPorMes(data, cambios) {
  if (data.receita.poc) {
    return { receitaBrutaMes: pocDoDocumento(data).robMes, linhasReceitaMes: null };
  }
  if (data.receita.agricola) {
    const r = computeReceitaAgricola(data.receita.agricola, cambios);
    return { receitaBrutaMes: r.receitaBrutaMes, linhasReceitaMes: null };
  }
  // ARA EI Holding (2026-10-02): linhas de receita livres, valor mensal em R$.
  if (Array.isArray(data.receita.linhasLivres)) {
    return {
      receitaBrutaMes: MESES.map((_, m) => data.receita.linhasLivres.reduce((acc, l) => acc + parseNum(l.valores?.[m]), 0)),
      linhasReceitaMes: null,
    };
  }
  if (data.receita.linhas) {
    const linhasMes = {};
    Object.entries(data.receita.linhas).filter(([id]) => !LINHAS_DESCONTINUADAS_RESORTS.includes(id)).forEach(([id, linha]) => {
      // Bug de 2026-08-30: nunca confiar no premissaTipo armazenado nessas
      // linhas — ver nota em tipoLinhaReceitaResorts.
      const linhaTipada = { ...linha, premissaTipo: tipoLinhaReceitaResorts(id) || linha.premissaTipo };
      linhasMes[id] = MESES.map((_, m) => valorLinhaMes(linhaTipada, m, null, null));
    });
    // Café e Pensão não soma na ROB — ver LINHA_RECEITA_INFORMATIVA_RESORTS
    // em receitaAgricolaResorts.js. Continua em linhasMes (ex.: pra exibir
    // ou usar como base de dedução, se algum dia alguma passar a referenciá-la).
    const totalMes = MESES.map((_, m) =>
      Object.entries(linhasMes).reduce((acc, [id, arr]) => id === LINHA_RECEITA_INFORMATIVA_RESORTS ? acc : acc + arr[m], 0)
    );
    return { receitaBrutaMes: totalMes, linhasReceitaMes: linhasMes };
  }
  const totalMes = MESES.map((_, m) =>
    produtosReceitaAtivos(data.receita.produtos).reduce((acc, p) => {
      if (p.mercado === 'externo') {
        const taxa = parseNum(cambios?.[p.moeda || 'usd']);
        return acc + parseNum(p.volumes?.[m]) * parseNum(p.precoMoeda?.[m]) * taxa;
      }
      return acc + parseNum(p.volumes?.[m]) * parseNum(p.precos?.[m]);
    }, 0)
  );
  return { receitaBrutaMes: totalMes, linhasReceitaMes: null };
}

// ARA Agrícola: deduções calculadas só sobre a Receita Mercado Interno — INSS
// (2026-09-11) e Devoluções (2026-10-01, pedido do usuário). As demais usam a
// receita bruta total (que inclui o Mercado Externo e o refugo).
const DEDUCOES_SOBRE_MI_AGRICOLA = ['inss', 'devolucoes'];
// Apuração mensal de IRCSL (2026-10-02): EBT mês a mês = EBITDA − D&A + Receita
// financeira − Despesa financeira + Outras; IR e CS incidem sobre o EBT do mês
// (mês com EBT negativo não paga e não gera crédito). A despesa financeira vem da
// "Provisão desp. financeira" do FC Financiamentos; se nenhuma linha tiver
// provisão lançada, vale a despesa digitada antes (resultado.despesaFinanceira,
// preservada no documento). Alíquotas: IR 6,25% (25% com redução Sudene de 75%) e
// CS 9% como padrão quando o documento ainda não tem os campos novos.
const ALIQUOTA_IR_PADRAO = 6.25;
const ALIQUOTA_CS_PADRAO = 9;
function aliquotasIRCS(data) {
  const r = data.resultado || {};
  return {
    ir: r.aliquotaIRPct == null ? ALIQUOTA_IR_PADRAO : parseNum(r.aliquotaIRPct),
    cs: r.aliquotaCSPct == null ? ALIQUOTA_CS_PADRAO : parseNum(r.aliquotaCSPct),
  };
}
function despesaFinanceiraMesCalc(data) {
  const prov = MESES.map((_, m) => (data.fcFinanciamentos?.linhas || []).reduce((acc, l) => acc + parseNum(l.provisaoDespesaFinanceira?.[m]), 0));
  if (prov.some(v => v !== 0)) return prov;
  return MESES.map((_, m) => parseNum(data.resultado?.despesaFinanceira?.[m]));
}

export function computeDRE(data, ref, ipcaAnualPct, cambios) {
  // Receita bruta por mês, para aplicar deduções percentuais mês a mês
  const { receitaBrutaMes, linhasReceitaMes } = receitaBrutaPorMes(data, cambios);
  const receitaBruta = receitaBrutaMes.reduce((a, v) => a + v, 0);

  // Volume total (kg) por mês — só pra contas com premissaTipo
  // 'custo_por_kg' (2026-08-20). Só o modelo `produtos` (Têxtil/Agrícola)
  // tem Volume; unidades com `receita.linhas` (Resorts) ou sem receita
  // (Corporativo) caem em [] e o reduce dá 0 — nunca quebra, essas
  // unidades nem oferecem 'custo_por_kg' como opção (ver
  // UNIDADES_COM_CUSTO_POR_KG no frontend). Volume vem em toneladas — ×1000 pra kg.
  const receitaAgricolaCalc = data.receita.agricola ? computeReceitaAgricola(data.receita.agricola, cambios) : null;
  const poc = pocDoDocumento(data);
  const volumeTotalKgMes = receitaAgricolaCalc
    ? receitaAgricolaCalc.producaoTotalKgMes
    : MESES.map((_, m) => produtosReceitaAtivos(data.receita.produtos).reduce((acc, p) => acc + parseNum(p.volumes?.[m]), 0) * 1000);

  // Base do percentual de dedução: normalmente a receita bruta total
  // (Têxtil/Agrícola), mas uma linha pode apontar `baseLinhaIds` — soma só
  // das linhas referenciadas (Resorts: PIS/Cofins de Hospedagem incidem só
  // sobre a receita de Hospedagem, não sobre A&B, por exemplo). ARA Agrícola
  // (2026-09-11, pedido: "o INSS presente nas deduções deve ser calculado
  // apenas sob a receita do Mercado Interno") — caso especial: a dedução de
  // id 'inss' (só existe em DEDUCOES_REF_AGRICOLA) usa a Receita Mercado
  // Interno como base, não a receita bruta total (que inclui o Externo).
  const deducoesMes = MESES.map((_, m) =>
    (data.receita.deducoes || []).reduce((a, d) => {
      let base = receitaBrutaMes[m];
      if (d.baseLinhaIds && linhasReceitaMes) {
        base = d.baseLinhaIds.reduce((s, id) => s + (linhasReceitaMes[id]?.[m] || 0), 0);
      } else if (DEDUCOES_SOBRE_MI_AGRICOLA.includes(d.id) && receitaAgricolaCalc) {
        base = receitaAgricolaCalc.receitaInternaMes[m];
      }
      return a + base * (parseNum(d.pcts?.[m]) / 100);
    }, 0)
    // La Fleur II: RET calculado pelo POC.
    + (poc ? poc.retMes[m] : 0)
  );
  const deducoes = deducoesMes.reduce((a, v) => a + v, 0);
  const receitaLiquidaMes = MESES.map((_, m) => receitaBrutaMes[m] - deducoesMes[m]);
  const receitaLiquida = receitaBruta - deducoes;

  const linhasCustos = Object.entries(data.custos.linhas || {});
  // La Fleur II: custo apropriado + espólio do POC, somado ao CPV.
  const pocCpvMes = poc ? poc.cpvMes : null;

  const receitaHospedagemMes = linhasReceitaMes?.hospedagem || null;
  const receitaAebMes = linhasReceitaMes
    ? MESES.map((_, m) => (linhasReceitaMes.aeb?.[m] || 0) + (linhasReceitaMes.cafePensao?.[m] || 0))
    : null;

  // Folha do Novo HC com encargos + linhas calculadas de pessoal, por CC.
  const basesPessoal = { receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes };
  const pessoalExtraAnual = (cc) => pessoalExtraPorCC(data, ref, cc.codigo, basesPessoal).anual;

  // pacote 'pessoal' (2026-08-23): não exclui mais da soma — espelho de
  // frontend/src/OrcamentoARA.jsx, ver nota completa lá.
  const cpv = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== 'producao') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes);
  }, 0) + ref.ccs.filter(cc => cc.tipo === 'producao').reduce((acc, cc) => acc + pessoalExtraAnual(cc), 0)
    + (pocCpvMes ? pocCpvMes.reduce((a, v) => a + v, 0) : 0);
  const lucroBruto = receitaLiquida - cpv;
  const margemBruta = receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0;

  const despesasSemDA = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== 'despesa' || pacoteId === 'depreciacao') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes);
  }, 0) + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + pessoalExtraAnual(cc), 0);
  const ebitda = lucroBruto - despesasSemDA;
  const margemEbitda = receitaLiquida ? (ebitda / receitaLiquida) * 100 : 0;

  const depreciacao = linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== 'despesa' || pacoteId !== 'depreciacao') return acc;
    return acc + valorLinhaAnual(linha, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, volumeTotalKgMes, receitaHospedagemMes, receitaAebMes);
  }, 0);

  const resultadoFinanceiro = somaMes(data.resultado.receitaFinanceira) - despesaFinanceiraMesCalc(data).reduce((a, v) => a + v, 0);
  const outras = somaMes(data.resultado.outrasReceitasDespesas);

  const ebt = ebitda - depreciacao + resultadoFinanceiro + outras;
  const ircsl = 0; // provisório: o IRCSL real é a soma mensal, calculado abaixo
  const lucroLiquido = ebt;
  const margemLiquida = receitaLiquida ? (lucroLiquido / receitaLiquida) * 100 : 0;

  const capexTotal = (data.capex.projetos || []).reduce((acc, p) => acc + somaMes(desembolsosDoProjeto(p)), 0);

  const dreCalc = {
    receitaBruta, deducoes, receitaLiquida, cpv, lucroBruto, margemBruta,
    despesasSemDA, ebitda, margemEbitda, depreciacao, resultadoFinanceiro, outras,
    ebt, ircsl, lucroLiquido, margemLiquida, capexTotal,
    receitaBrutaMes, receitaLiquidaMes,
    receitaHospedagemMes,
    receitaAebMes,
    // Exposto pra quem precisa recalcular valorLinhaMes/valorLinhaAnual de
    // uma linha específica fora daqui sem duplicar o cálculo de volume —
    // mesmo racional de receitaBrutaMes/receitaLiquidaMes.
    volumeTotalKgMes,
    // Custo do POC por mês (La Fleur II) — somado ao CPV mensal dos fluxos.
    pocCpvMes,
    totalGeral: lucroLiquido,
  };
  // IRCSL do ano = soma dos 12 meses (cada mês sobre o próprio EBT, sem IRCSL em mês negativo).
  const ircslAno = computeFluxoIndiretoMensal(data, dreCalc, ref, ipcaAnualPct).ircslMes.reduce((a, v) => a + v, 0);
  const lucroLiquidoAno = ebt - ircslAno;
  return {
    ...dreCalc,
    ircsl: ircslAno,
    lucroLiquido: lucroLiquidoAno,
    margemLiquida: receitaLiquida ? (lucroLiquidoAno / receitaLiquida) * 100 : 0,
    totalGeral: lucroLiquidoAno,
  };
}

// Soma dois DREs já calculados (não dois `dados` brutos) — espelho de
// somarDRE em frontend/src/OrcamentoARA.jsx. Usada pelo Consolidado da
// Agrícola (2026-08-20): Terra do Sol e Frutos do Sol têm os mesmos códigos
// de CC, então nunca mesclamos os `dados` brutos das duas (colidiria a
// chave CC|Conta) — só os DREs já calculados, campo a campo. Percentuais de
// margem são recalculados sobre as bases já somadas, nunca somados direto.
export function somarDRE(a, b) {
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

// Consolidados multi-site — espelho de CONSOLIDADOS_MULTISITE em
// frontend/src/OrcamentoARA.jsx. A chave de cada site no wrapper é o
// próprio unidadeId dele (ex.: {_tipo:'consolidado_agricola', agricola_tds:
// {...}, agricola_fds: {...}}). Cada site resolve a própria referência —
// necessário de verdade pro Resorts, já que Beach e Villa não têm
// exatamente os mesmos CCs.
const CONSOLIDADOS_MULTISITE = {
  agricola: { tipo: 'consolidado_agricola', sites: ['agricola_tds', 'agricola_fds'] },
  resorts: { tipo: 'consolidado_resorts', sites: ['samoa_beach', 'samoa_villa'] },
  ei: { tipo: 'consolidado_ei', sites: ['ei_holding', 'ei_lafleur', 'ei_southbay'] },
  textil_consolidado: { tipo: 'consolidado_textil', sites: ['textil', 'textil_bg'] },
};
// true se `d` é um dos wrappers acima (qualquer família) — espelho de
// ehSnapshotConsolidado em frontend/src/OrcamentoARA.jsx.
export function ehSnapshotConsolidado(d) {
  return !!(d && Object.values(CONSOLIDADOS_MULTISITE).some(c => c.tipo === d._tipo));
}

// computeDRE "unidade-aware" — espelho de dreDaUnidade em OrcamentoARA.jsx.
// GET /:unidadeId e POST /:unidadeId/enviar chamam computeDRE direto sobre
// `orcamento.dados`; pra 'agricola'/'resorts' (Consolidado) depois do
// primeiro envio, esse `dados` é o snapshot combinado (ver
// CONSOLIDADOS_MULTISITE) gravado pelo frontend (ver ConsolidadoAgricola/
// ConsolidadoResorts) — computeDRE quebraria tentando ler `dados.receita`
// direto do wrapper. `ref` continua sendo passado pra manter a assinatura
// igual a computeDRE nos outros casos, mas não é usado no ramo do wrapper
// (usa sempre a referência de cada site, que são as unidades de verdade
// por trás dele).
export function dreDaUnidade(dadosUnidade, unidadeId, ref, ipcaAnualPct, cambios) {
  const consolidado = CONSOLIDADOS_MULTISITE[unidadeId];
  if (consolidado && dadosUnidade && dadosUnidade._tipo === consolidado.tipo) {
    // N sites (ARA EI tem 3) — somarDRE é binário, então reduz.
    const dres = consolidado.sites.map(siteId => {
      const refSite = buscarReferencia(siteId) || ref;
      return computeDRE(dadosUnidade[siteId] || emptyFormData(siteId), refSite, ipcaAnualPct, cambios);
    });
    return dres.reduce((acc, d) => somarDRE(acc, d));
  }
  return computeDRE(dadosUnidade, ref, ipcaAnualPct, cambios);
}

// ---------------------------------------------------------------------------
// Cálculo do Fluxo de Caixa (método indireto) — a partir do Lucro Líquido da
// DRE, add-back de D&A, CAPEX e eventos do Balanço (empréstimos, aportes,
// dividendos). Variação de Capital de Giro (2026-08-23, antes fixada em 0
// aqui — espelho exato de frontend/src/OrcamentoARA.jsx): soma o
// variacaoGiroMes do método mensal (computeFluxoIndiretoMensal), que já usa
// os saldos iniciais de aba 8/Balanço via saldosAberturaFc — evita duplicar
// a conta em dois lugares.
// ---------------------------------------------------------------------------
export function computeDFC(data, dre, ref, ipcaAnualPct) {
  const capexTotal = (data.capex.projetos || []).reduce((acc, p) => acc + somaMes(desembolsosDoProjeto(p)), 0);

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
  const variacaoCapitalGiro = ref
    ? computeFluxoIndiretoMensal(data, dre, ref, ipcaAnualPct).variacaoGiroMes.reduce((a, v) => a + v, 0)
    : 0;
  const fluxoOperacional = geracaoOperacionalAntesGiro + variacaoCapitalGiro;

  // −CapEx; no Escritório de Investimentos, −aportes + dividendos.
  const fluxoInvestimento = fcInvestimentoProjetosMes(data).reduce((a, v) => a + v, 0);
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
export function computeFluxoIndiretoMensal(data, dre, ref, ipcaAnualPct) {
  const pessoalCC = pessoalExtraTodosCCs(data, ref, dre, ipcaAnualPct);
  const receitaLiquidaMes = dre.receitaLiquidaMes;
  const receitaBrutaMes = dre.receitaBrutaMes;
  const linhasCustos = Object.entries(data.custos.linhas || {});

  function totalLinhasMes(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes);
    }, 0);
  }
  // Versão em caixa — espelho de frontend/src/OrcamentoARA.jsx.
  function totalLinhasMesCaixa(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMesCaixa(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes);
    }, 0);
  }
  // pacote 'pessoal' (2026-08-23): não exclui mais de totalLinhasMes — ver
  // nota completa em computeDRE. + custo do POC (La Fleur II).
  const cpvSemPessoalMes = MESES.map((_, m) => totalLinhasMes('producao', [], m) + (dre.pocCpvMes?.[m] || 0));
  const cpvMes = MESES.map((_, m) => cpvSemPessoalMes[m]
    + ref.ccs.filter(cc => cc.tipo === 'producao').reduce((acc, cc) => acc + pessoalCC[cc.codigo].mes[m], 0));
  const despesasSemDAmes = MESES.map((_, m) => totalLinhasMes('despesa', ['depreciacao'], m)
    + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + pessoalCC[cc.codigo].mes[m], 0));
  const ebitdaMes = MESES.map((_, m) => receitaLiquidaMes[m] - cpvMes[m] - despesasSemDAmes[m]);

  // depreciacaoMes/resultadoFinanceiroMes/outrasMes/ebtMes precisam vir
  // antes de ircslMes — espelho de frontend/src/OrcamentoARA.jsx (ver nota
  // completa lá, bug de 2026-08-30 "IRCSL calculado mesmo sem receita").
  const depreciacaoMes = MESES.map((_, m) => linhasCustos.reduce((acc, [chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
    if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== 'despesa' || pacoteId !== 'depreciacao') return acc;
    return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes);
  }, 0));
  const despesaFinanceiraMes = despesaFinanceiraMesCalc(data);
  const resultadoFinanceiroMes = MESES.map((_, m) => parseNum(data.resultado.receitaFinanceira?.[m]) - despesaFinanceiraMes[m]);
  const outrasMes = MESES.map((_, m) => parseNum(data.resultado.outrasReceitasDespesas?.[m]));
  const ebtMes = MESES.map((_, m) => ebitdaMes[m] - depreciacaoMes[m] + resultadoFinanceiroMes[m] + outrasMes[m]);

  // dre.ircsl (total anual) distribuído só pelos meses com EBT positivo,
  // proporcionalmente — não mais dividido igual por 12 (aparecia até em
  // mês sem lucro). Soma do ano continua batendo com dre.ircsl.
  const { ir: aliqIR, cs: aliqCS } = aliquotasIRCS(data);
  const irMes = ebtMes.map(v => (v > 0 ? v * (aliqIR / 100) : 0));
  const csMes = ebtMes.map(v => (v > 0 ? v * (aliqCS / 100) : 0));
  const ircslMes = MESES.map((_, m) => irMes[m] + csMes[m]);

  // + 13º da abertura do HC Existente da ARA Agrícola (pago metade em Nov, metade em Dez).
  const decimoTerceiroMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].decimoTerceiro
    + (pessoalCC[cc.codigo]?.calc.aberturaDecimo?.[m] || 0), 0));
  const decimoTerceiroAnualTotal = decimoTerceiroMes.reduce((a, v) => a + v, 0);
  const pagamento13Mes = MESES.map((_, m) => (m === 10 || m === 11) ? decimoTerceiroAnualTotal / 2 : 0);
  const ajuste13Mes = MESES.map((_, m) => decimoTerceiroMes[m] - pagamento13Mes[m]);

  // Ajuste competência × caixa (2026-08-23) — espelho de
  // frontend/src/OrcamentoARA.jsx.
  // + ajuste das contas em M+1/defasada (5.2), CPV e despesas — mesmo número
  // que o FC Direto aplica.
  const ajustePrazoConta = ajustePrazoPorContaMes(data, ref, dre, ipcaAnualPct);
  const despesasCaixaMes = MESES.map((_, m) => totalLinhasMesCaixa('despesa', ['depreciacao'], m)
    + ref.ccs.filter(cc => cc.tipo === 'despesa').reduce((acc, cc) => acc + pessoalCC[cc.codigo].mes[m], 0)
    + ajustePrazoConta.despesaMes[m] + ajustePrazoConta.producaoMes[m]);
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

  const fcInvestimentoMes = fcInvestimentoProjetosMes(data);

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
    ebtMes, irMes, csMes, despesaFinanceiraMes,
    ajuste13Mes, ajustePagamentoMes, variacaoGiroMes, fcOperacionalMes,
    fcInvestimentoMes, fcFinanciamentoMes, variacaoCaixaMes, caixaInicial, caixaAcumuladoMes,
  };
}

// Espelho de frontend/src/OrcamentoARA.jsx (2026-09-30): recebimentos dos Resorts (modelo
// Projecao_Recebimentos) e pagamento em M+1/defasado por conta (5.2). Antes só a tela
// aplicava essas regras e o FC calculado pelo servidor divergia dela.
const ENCARTEIRADO_RESORTS = [
  { id: 'getnet', nome: 'Contas a Receber Getnet' },
  { id: 'operadoraCR', nome: 'Operadora CR' },
  { id: 'operadoraVHF', nome: 'Operadora VHF' },
  { id: 'alugueis', nome: 'Aluguéis' },
];
// Responsável padrão por linha (coluna "Setor" da planilha) — editável na tela.
const RESPONSAVEL_PADRAO_RESORTS = {
  getnet: 'CR', operadoraCR: 'Relatório CM', operadoraVHF: 'Comercial', alugueis: '',
  vendasNovDez: '', antecipados: 'CR', baseReservas: 'Comercial', crescimentoReservasPct: 'Comercial',
};
const MESES_RELATIVOS = Array.from({ length: 13 }, (_, k) => `M+${k}`);

// Percentuais padrão da planilha do FP&A (% por mês de venda × M+0..M+12).
// Valem enquanto o site não gravar os seus; a primeira edição grava a matriz.
const PCT_CARTAO_PADRAO_RESORTS = [
  [0.34649951, 56.44208745, 6.90750267, 5.81454833, 5.09807636, 4.57370532, 3.89771055, 3.33013401, 3.27681468, 3.15731766, 3.0955987, 2.03632743, 2.02367735],
  [0.21559047, 53.6949845, 7.48075324, 5.95063914, 5.4358247, 4.84772276, 4.37732317, 3.7226761, 3.59527938, 3.33088103, 3.27402889, 2.05152755, 2.02276909],
  [0.23190383, 32.05823344, 10.28705138, 8.88156886, 8.07710295, 7.20326301, 6.51817324, 5.60908446, 5.26172495, 4.8502364, 4.6171692, 3.23201668, 3.17247159],
  [0.44831068, 55.03164024, 7.33953502, 6.14551057, 5.03861799, 4.44151713, 4.16309637, 3.49370691, 3.33367866, 3.19476393, 3.19030036, 2.09421916, 2.08510299],
  [0.37454686, 39.73422108, 9.72881387, 8.42247404, 7.36435104, 6.58278926, 5.88377839, 4.7510894, 4.37896265, 4.01462052, 3.99606646, 2.40896824, 2.35931818],
  [0.1762029, 41.1440815, 11.24810061, 8.26535785, 7.04691634, 6.02714981, 5.14749172, 4.26058599, 4.09186158, 3.89851233, 3.89851233, 2.44299066, 2.35223638],
  [0.2814648, 53.26576266, 8.27988346, 6.89590321, 5.87879093, 4.91485705, 4.03226126, 3.29696509, 3.27091593, 3.17376421, 3.15331555, 1.77805793, 1.77805793],
  [0.30182199, 42.35155242, 9.88604525, 8.39358811, 7.42872464, 6.09345507, 5.33382862, 4.03944157, 3.86678185, 3.72261301, 3.71848883, 2.43182931, 2.43182931],
  [0.2778056, 40.08818469, 9.48584961, 8.39707886, 7.11028586, 6.66353853, 5.75674495, 4.47404894, 4.35831865, 4.08174921, 4.08174921, 2.62146684, 2.60317905],
  [0.36105898, 45.44697982, 9.48680354, 7.71365133, 6.50722029, 5.45780117, 4.80764036, 3.97589001, 3.87807746, 3.61518259, 3.61518259, 2.56725593, 2.56725593],
  [0.07750027, 22.85646025, 10.62184144, 9.61036397, 8.77951971, 8.05002545, 7.50629596, 6.5745997, 6.36391785, 5.92906235, 5.78470114, 3.96386661, 3.8818453],
  [0.36105898, 45.44697982, 9.48680354, 7.71365133, 6.50722029, 5.45780117, 4.80764036, 3.97589001, 3.87807746, 3.61518259, 3.61518259, 2.56725593, 2.56725593],
];
const CANCEL_CARTAO_PADRAO_RESORTS = Array(12).fill(5);
const PCT_OPERADORA_PADRAO_RESORTS = [
  ...Array.from({ length: 6 }, () => Array(13).fill(0)),
  [3.8277512, 6.22009569, 10.52631579, 33.01435407, 10.52631579, 16.26794258, 11.00478469, 5.26315789, 1.9138756, 0.4784689, 0.4784689, 0.4784689, 0],
  [4.32692308, 11.05769231, 21.15384615, 15.38461538, 12.01923077, 12.5, 16.34615385, 3.84615385, 1.44230769, 0.48076923, 1.44230769, 0, 0],
  [3.15186246, 9.16905444, 10.0286533, 13.75358166, 22.63610315, 23.78223496, 8.30945559, 2.86532951, 4.29799427, 0.5730659, 1.14613181, 0.28653295, 0],
  [7.46753247, 17.53246753, 16.55844156, 20.77922078, 13.31168831, 11.68831169, 5.84415584, 2.27272727, 1.94805195, 1.2987013, 0.64935065, 0.64935065, 0],
  [6.0483871, 12.09677419, 12.5, 16.12903226, 12.90322581, 12.09677419, 13.70967742, 6.4516129, 0.80645161, 0.40322581, 2.41935484, 4.42580645, 0],
  [7.5, 30, 35, 7.5, 3.75, 3.75, 2.5, 6.25, 2.5, 1.25, 0, 0, 0],
];
const CANCEL_OPERADORA_PADRAO_RESORTS = Array(12).fill(0);
const paraTextoPct = (n) => (n ? String(n).replace('.', ',') : '');
function matrizPctEfetiva(salva, padrao) {
  return salva || padrao.map(linha => linha.map(paraTextoPct));
}
function cancelPctEfetivo(salvo, padrao) {
  return salvo || padrao.map(paraTextoPct);
}

function recebimentosResortsPreenchido(rr) {
  if (!rr) return false;
  const temValor = (arr) => (arr || []).some(v => parseNum(v) !== 0);
  return ENCARTEIRADO_RESORTS.some(l => temValor(rr.encarteirado?.[l.id])) || temValor(rr.vendasNovDez) || temValor(rr.baseReservas) || temValor(rr.antecipados);
}

function computeRecebimentosResorts(data) {
  const rr = data.capitalGiro?.recebimentosResorts || {};
  const pct = (v) => parseNum(v) / 100;
  const linhaAeb = data.receita?.linhas?.aeb;
  const aebMes = MESES.map((_, m) => (linhaAeb ? valorLinhaMes({ ...linhaAeb, premissaTipo: tipoLinhaReceitaResorts('aeb') }, m, null, null) : 0));
  const reservasMes = MESES.map((_, m) => parseNum(rr.baseReservas?.[m]) * (1 + pct(rr.crescimentoReservasPct?.[m])));
  const totalFaturadoMes = MESES.map((_, m) => reservasMes[m] + aebMes[m]);
  const aVistaMes = MESES.map((_, m) => totalFaturadoMes[m] * pct(rr.mixAVistaPct?.[m]));
  const vendasCartaoMes = MESES.map((_, m) => totalFaturadoMes[m] * pct(rr.mixCartaoPct?.[m]));
  const vendasOperadoraMes = MESES.map((_, m) => totalFaturadoMes[m] * pct(rr.mixOperadoraPct?.[m]));

  // Linha = mês da venda (r); coluna M+k cai no mês r+k (o que passa de Dez fica fora do ano).
  function distribuir(vendasMes, matriz, cancelPct) {
    const porVenda = MESES.map((_, r) => MESES.map((_, c) => {
      const k = c - r;
      if (k < 0 || k > 12) return 0;
      return vendasMes[r] * pct(matriz?.[r]?.[k]) * (1 - pct(cancelPct?.[r]));
    }));
    const totalMes = MESES.map((_, c) => porVenda.reduce((acc, linha) => acc + linha[c], 0));
    return { porVenda, totalMes };
  }
  const cartao = distribuir(vendasCartaoMes,
    matrizPctEfetiva(rr.cartaoPct, PCT_CARTAO_PADRAO_RESORTS), cancelPctEfetivo(rr.cartaoCancelPct, CANCEL_CARTAO_PADRAO_RESORTS));
  const checkout = distribuir(vendasOperadoraMes,
    matrizPctEfetiva(rr.operadoraPct, PCT_OPERADORA_PADRAO_RESORTS), cancelPctEfetivo(rr.operadoraCancelPct, CANCEL_OPERADORA_PADRAO_RESORTS));
  const operadoraMes = MESES.map((_, m) => (m === 0 ? 0 : checkout.totalMes[m - 1]));

  const encarteiradoPorLinha = Object.fromEntries(ENCARTEIRADO_RESORTS.map(l => [l.id, MESES.map((_, m) => parseNum(rr.encarteirado?.[l.id]?.[m]))]));
  const encarteiradoMes = MESES.map((_, m) => ENCARTEIRADO_RESORTS.reduce((acc, l) => acc + encarteiradoPorLinha[l.id][m], 0));
  const vendasNovDezMes = MESES.map((_, m) => parseNum(rr.vendasNovDez?.[m]));
  const novosMes = MESES.map((_, m) => aVistaMes[m] + cartao.totalMes[m] + operadoraMes[m]);
  const antecipadosMes = MESES.map((_, m) => parseNum(rr.antecipados?.[m]));
  const totalMes = MESES.map((_, m) => encarteiradoMes[m] + vendasNovDezMes[m] + novosMes[m] + antecipadosMes[m]);
  return {
    aebMes, reservasMes, totalFaturadoMes, aVistaMes, vendasCartaoMes, vendasOperadoraMes,
    cartao, checkout, operadoraMes, encarteiradoPorLinha, encarteiradoMes, vendasNovDezMes, novosMes, antecipadosMes, totalMes,
  };
}

// 5.2 — "M+1" (100% no mês seguinte) e "Competência defasada" (% no mês e o
// restante no mês seguinte; vazio = 50%). Ex.: A&B dos Resorts 50/50 =
// metade da competência do mês anterior + metade da do mês vigente. A parte
// "mês seguinte" de Dez/2027 fica para 2028; a de Dez/2026 não existe no modelo.
function pctPagoNoMes(config) {
  if (config?.tipo === 'm1') return 0;
  if (config?.tipo !== 'defasada') return 1;
  const v = config.pctMes;
  return v === undefined || v === null || String(v).trim() === '' ? 0.5 : parseNum(v) / 100;
}
function pagamentoDefasadoMes(compMes, pctMes) {
  return MESES.map((_, m) => compMes[m] * pctMes + (m > 0 ? compMes[m - 1] * (1 - pctMes) : 0));
}
// Diferença pagamento − competência das contas em M+1/defasada, separada por
// CC de produção (CPV) e de despesa. Zero quando nenhuma conta usa essas opções.
function ajustePrazoPorContaMes(data, ref, dre, ipcaAnualPct) {
  const producaoMes = MESES.map(() => 0);
  const despesaMes = MESES.map(() => 0);
  const porConta = data.capitalGiro?.premissasPagamento2?.porConta || {};
  const pctPorConta = {};
  Object.entries(porConta).forEach(([codigo, config]) => {
    if (config && (config.tipo === 'm1' || config.tipo === 'defasada')) pctPorConta[codigo] = pctPagoNoMes(config);
  });
  if (Object.keys(pctPorConta).length === 0) return { producaoMes, despesaMes };
  Object.entries(data.custos.linhas || {}).forEach(([chave, linha]) => {
    const [ccCodigo, contaCodigo] = chave.split('|');
    if (!(contaCodigo in pctPorConta)) return;
    const cc = ref.ccs.find(c => c.codigo === ccCodigo);
    if (!cc || ref.todasContas[contaCodigo]?.pacoteId === 'depreciacao') return;
    const comp = MESES.map((_, m) => valorLinhaMes(linha, m, dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes));
    const pag = pagamentoDefasadoMes(comp, pctPorConta[contaCodigo]);
    const alvo = tipoDaLinha(ref, cc, contaCodigo) === 'producao' ? producaoMes : despesaMes;
    MESES.forEach((_, m) => { alvo[m] += pag[m] - comp[m]; });
  });
  return { producaoMes, despesaMes };
}


// ---------------------------------------------------------------------------
// Fluxo de Caixa Direto mensal — recebimentos e pagamentos por categoria
// (não parte do EBITDA; é uma decomposição por natureza de caixa). Construído
// com os mesmos componentes do método indireto (receita, CPV, despesas,
// folha, capital de giro, 13º), então reconcilia matematicamente com o
// FC Operacional do método indireto — são duas leituras do mesmo número.
// ---------------------------------------------------------------------------
export function computeFluxoCaixaDiretoMensal(data, dre, ref, ipcaAnualPct) {
  const pessoalCC = pessoalExtraTodosCCs(data, ref, dre, ipcaAnualPct);
  const receitaLiquidaMes = dre.receitaLiquidaMes;
  const receitaBrutaMes = dre.receitaBrutaMes;
  const linhasCustos = Object.entries(data.custos.linhas || {});

  function totalLinhasMes(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMes(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes);
    }, 0);
  }
  // Versão em caixa — espelho de frontend/src/OrcamentoARA.jsx.
  function totalLinhasMesCaixa(tipoAlvo, excluirPacotes, m) {
    return linhasCustos.reduce((acc, [chave, linha]) => {
      const [ccCodigo, contaCodigo] = chave.split('|');
      const cc = ref.ccs.find(c => c.codigo === ccCodigo);
      const pacoteId = ref.todasContas[contaCodigo]?.pacoteId;
      if (!cc || tipoDaLinha(ref, cc, contaCodigo) !== tipoAlvo || excluirPacotes.includes(pacoteId)) return acc;
      return acc + valorLinhaMesCaixa(linha, m, receitaBrutaMes, receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes);
    }, 0);
  }
  // pacote 'pessoal' (2026-08-23): não exclui mais — ver nota em computeDRE.
  // + custo do POC (La Fleur II), como no método Indireto.
  const cpvSemPessoalMes = MESES.map((_, m) => totalLinhasMes('producao', [], m) + (dre.pocCpvMes?.[m] || 0));
  // Comissão do POC é despesa comercial, não pessoal: sai da folha, entra em despesas.
  const comissaoPocMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + (pessoalCC[cc.codigo].calc.comissaoPoc?.[m] || 0), 0));
  // Pagamentos de despesas de fato (caixa) — 2026-08-23, espelho de
  // frontend/src/OrcamentoARA.jsx.
  const despesasCaixaSemPessoalMes = MESES.map((_, m) => totalLinhasMesCaixa('despesa', ['depreciacao'], m) + comissaoPocMes[m]);
  const folhaTotalMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + pessoalCC[cc.codigo].mes[m], 0) - comissaoPocMes[m]);
  // + 13º da abertura do HC Existente da ARA Agrícola (pago metade em Nov, metade em Dez).
  const decimoTerceiroMes = MESES.map((_, m) => ref.ccs.reduce((acc, cc) => acc + folhaAnualPorCC(data, cc.codigo).mensal[m].decimoTerceiro
    + (pessoalCC[cc.codigo]?.calc.aberturaDecimo?.[m] || 0), 0));
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

  // ARA Resorts: premissa de recebimentos própria, só depois de preenchida
  // (antes disso o FC segue na aproximação por prazo) — espelho da tela.
  if (recebimentosResortsPreenchido(cg.recebimentosResorts)) {
    recebimentosClientesMes = computeRecebimentosResorts(data).totalMes;
  }

  const ajustePrazoConta = ajustePrazoPorContaMes(data, ref, dre, ipcaAnualPct);
  const pagamentosFornecedoresMes = MESES.map((_, m) => {
    const apAnt = m === 0 ? apInicial : apMes[m - 1];
    const estAnt = m === 0 ? estoqueInicial : estoqueMes[m - 1];
    return cpvSemPessoalMes[m] + (estoqueMes[m] - estAnt) - (apMes[m] - apAnt) + ajustePrazoConta.producaoMes[m];
  });
  const pagamentosDespesasMes = MESES.map((_, m) => despesasCaixaSemPessoalMes[m] + ajustePrazoConta.despesaMes[m]);
  // Bug de 2026-08-30 ("IRCSL calculado mesmo sem receita") — espelho de
  // frontend/src/OrcamentoARA.jsx: reaproveita o ircslMes já ponderado por
  // EBT positivo do método Indireto, em vez de dividir dre.ircsl por 12.
  const ircslMes = computeFluxoIndiretoMensal(data, dre, ref, ipcaAnualPct).ircslMes;

  // 5.2 Premissas de pagamento (2026-09-13) — espelho de
  // frontend/src/OrcamentoARA.jsx: "pagamentos em carteira" e "Competência
  // Nov/Dez" entram como saídas adicionais no FC Direto (substituíram o antigo
  // plano de "pagamentos manuais", que o frontend deixou de usar; o campo antigo
  // continua no documento, só não entra mais na conta).
  const premPag2 = cg.premissasPagamento2 || {};
  const pagamentosCarteiraMes = MESES.map((_, m) =>
    parseNum((premPag2.carteira || mesesVazios())[m]) +
    (premPag2.carteiraLinhas || []).reduce((a, l) => a + parseNum((l.valores || [])[m]), 0)
  );
  const pagamentosNovDezMes = MESES.map((_, m) =>
    parseNum((premPag2.competenciaNovDez || mesesVazios())[m]) +
    (premPag2.competenciaNovDezLinhas || []).reduce((a, l) => a + parseNum((l.valores || [])[m]), 0)
  );

  const fcOperacionalDiretoMes = MESES.map((_, m) =>
    recebimentosClientesMes[m] - pagamentosFornecedoresMes[m] - pessoalEmCaixaMes[m] - pagamentosDespesasMes[m] - ircslMes[m] - pagamentosCarteiraMes[m] - pagamentosNovDezMes[m]
  );

  return {
    recebimentosClientesMes, pagamentosFornecedoresMes, pessoalEmCaixaMes, pagamentosDespesasMes, ircslMes,
    pagamentosCarteiraMes, pagamentosNovDezMes,
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

// unidadeId opcional (default undefined = comportamento antigo, todas as
// checagens) — pedido de 2026-08-19: exclui checagens estruturalmente
// inaplicáveis ao Corporativo (sem Receita — unidade de back-office — e
// sem CC de produção), em vez de deixá-las permanentemente vermelhas.
// Espelho exato de frontend/src/OrcamentoARA.jsx.
export function runAuditoria(data, dre, ref, unidadeId, ipcaAnualPct) {
  if (unidadeId === 'energia') return auditoriaEscritorio(data);
  const checks = [];
  const temReceita = !UNIDADES_SEM_RECEITA.includes(unidadeId);
  const temCcProducao = ref.ccs.some(c => c.tipo === 'producao');

  // Modelo por produto (Têxtil/Agrícola) ou por linha (Resorts) — ver
  // receitaBrutaPorMes() em computeDRE. Auditoria checa o que existir.
  if (temReceita) {
    if (data.receita.poc) {
      const p = data.receita.poc;
      const avancoOk = somaMes(p.avancoAcumuladoPct) > 0 || parseNum(p.saldosIniciais?.avancoAcumuladoPct) > 0;
      const vgvOk = parseNum(p.saldosIniciais?.vgvAApropriar) > 0 || somaMes(p.novasVendasValor) > 0;
      checks.push({
        label: 'Receita POC: VGV (saldo ou novas vendas) e avanço de obra preenchidos',
        ok: avancoOk && vgvOk,
        detalhe: avancoOk && vgvOk ? 'Preenchida' : 'Pendente de preenchimento',
      });
      // Comentário obrigatório sobre as premissas mensais (2.3), 2026-10-02.
      const comentarioPocOk = !!(p.comentarioPremissasMensais || '').trim();
      checks.push({
        label: 'Receita POC: comentário das premissas mensais (2.3) preenchido (campo obrigatório)',
        ok: comentarioPocOk,
        detalhe: comentarioPocOk ? 'Preenchido' : 'Pendente de preenchimento',
      });
    } else if (unidadeId === 'ei_holding') {
      // ARA EI Holding (2026-10-02): linhas de receita livres, projeção mensal em R$.
      const linhasHolding = (data.receita.linhasLivres || []).filter(l => somaMes(l.valores) > 0);
      checks.push({
        label: 'Receita: ao menos uma linha de receita com valor lançado',
        ok: linhasHolding.length > 0,
        detalhe: `${linhasHolding.length} de ${(data.receita.linhasLivres || []).length} linha(s) preenchida(s)`,
      });
    } else if (data.receita.agricola) {
      // ARA Agrícola (2026-09-07) — espelho de OrcamentoARA.jsx, ver
      // computeReceitaAgricola.
      const embaladaOk = somaMes(data.receita.agricola.embaladaKg) > 0;
      // Volume Mercado Externo (2026-09-11) é o novo input que decide a
      // cascata (ver computeReceitaAgricola) — checar ele já cobre os dois
      // lados (Interno vira sempre o residual, nunca é digitado direto).
      const veAud = data.receita.agricola.vendaExterna || {};
      const vendaOk = (somaMes(veAud.gbp?.volumeKg) + somaMes(veAud.eur?.volumeKg) + somaMes(veAud.usd?.volumeKg)) > 0;
      checks.push({
        label: 'Receita: Produção (Embalada) e Vendas (Interno/Externo) com valor lançado',
        ok: embaladaOk && vendaOk,
        detalhe: embaladaOk && vendaOk ? 'Preenchida' : 'Pendente de preenchimento',
      });
    } else if (data.receita.linhas) {
      // Mesma normalização de premissaTipo de receitaBrutaPorMes — ver
      // tipoLinhaReceitaResorts (bug de 2026-08-30).
      const linhasReceitaValidas = Object.entries(data.receita.linhas).filter(([id]) => !LINHAS_DESCONTINUADAS_RESORTS.includes(id))
        .filter(([id, l]) => valorLinhaAnual({ ...l, premissaTipo: tipoLinhaReceitaResorts(id) || l.premissaTipo }, null, null) > 0);
      checks.push({
        label: 'Receita: ao menos uma linha (Hospedagem, A&B, etc.) com valor lançado',
        ok: linhasReceitaValidas.length > 0,
        detalhe: `${linhasReceitaValidas.length} de ${Object.keys(data.receita.linhas).filter(id => !LINHAS_DESCONTINUADAS_RESORTS.includes(id)).length} linha(s) preenchida(s)`,
      });
    } else {
      // Mercado Externo (2026-08-23): preço mora em precoMoeda, não em
      // precos (que fica derivado/vazio — ver receitaBrutaPorMes).
      const produtosValidos = produtosReceitaAtivos(data.receita.produtos).filter(p =>
        somaMes(p.volumes) > 0 && somaMes(p.mercado === 'externo' ? p.precoMoeda : p.precos) > 0
      );
      checks.push({
        label: 'Receita: ao menos um produto com volume e preço em algum mês',
        ok: produtosValidos.length > 0,
        detalhe: `${produtosValidos.length} de ${produtosReceitaAtivos(data.receita.produtos).length} produto(s) preenchido(s)`,
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
    // Holding (2026-10-02): receita simples por linha, sem deduções — sem esta justificativa.
    if (unidadeId !== 'ei_holding') {
      checks.push({
        label: 'Justificativa das deduções preenchida (campo obrigatório)',
        ok: justDeducoesOk,
        detalhe: justDeducoesOk ? 'Preenchida' : 'Pendente de preenchimento',
      });
    }
  }

  const linhasCustos = Object.entries(data.custos.linhas || {});

  if (temCcProducao) {
    const linhasProducao = linhasCustos.filter(([chave]) => {
      const cc = ref.ccs.find(c => c.codigo === chave.split('|')[0]);
      return cc?.tipo === 'producao';
    }).filter(([, linha]) => valorLinhaAnual(linha, dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes) > 0);
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
      valorLinhaAnual(sub, dre.receitaBrutaMes, dre.receitaLiquidaMes, ipcaAnualPct, dre.volumeTotalKgMes, dre.receitaHospedagemMes, dre.receitaAebMes) > 0 && !(sub.justificativa || '').trim()
    )
  );
  checks.push({
    label: 'Toda linha analítica com valor lançado tem justificativa preenchida',
    ok: linhasComValorSemJustificativa.length === 0,
    detalhe: linhasComValorSemJustificativa.length === 0 ? 'Justificativa preenchida em todas as linhas com valor' : `${linhasComValorSemJustificativa.length} linha(s) com valor e sem justificativa`,
  });

  // Descrição obrigatória — revertido em 2026-08-31 (pedido: "desconsidere
  // como obrigatória para todas as unidades"). Espelho de
  // frontend/src/OrcamentoARA.jsx.

  // Checks de faixa de inadimplência (0–100%) e de deduções (0–40%)
  // retirados em 2026-09-28 (pedido do usuário) — espelho do frontend.

  // ARA Agrícola (2026-09-07): checa negativo em todos os arrays mensais da
  // cascata (embaladaKg, refugoPct é um único valor — checado à parte).
  const algumNegativo = arr => (arr || []).some(v => parseNum(v) < 0);
  const agricolaTemNegativo = (() => {
    const ag = data.receita.agricola;
    if (!ag) return false;
    const ve = ag.vendaExterna || {};
    return algumNegativo(ag.embaladaKg) || parseNum(ag.refugoPct) < 0
      || algumNegativo(ag.vendaInterna?.pctTon) || algumNegativo(ag.vendaInterna?.precoKg)
      || algumNegativo(ve.pctTon) || algumNegativo(ve.volumeKg)
      || ['gbp', 'eur', 'usd'].some(m => algumNegativo(ve[m]?.pct) || algumNegativo(ve[m]?.precoMoeda) || algumNegativo(ve[m]?.volumeKg));
  })();
  const valoresNegativos = agricolaTemNegativo
    || produtosReceitaAtivos(data.receita.produtos).some(p => (p.volumes || []).some(v => parseNum(v) < 0) || ((p.mercado === 'externo' ? p.precoMoeda : p.precos) || []).some(v => parseNum(v) < 0))
    || Object.values(data.custos.linhas || {}).some(linha => contaTemNegativo(linha));
  checks.push({
    label: 'Nenhum valor negativo em receita ou custos/despesas',
    ok: !valoresNegativos,
    detalhe: valoresNegativos ? 'Há valor negativo lançado — revisar' : 'Sem valores negativos',
  });

  return checks;
}

// Escritório de Investimentos (2026-09-27): só aportes/dividendos por
// investimento — espelho do frontend.
function auditoriaEscritorio(data) {
  const lancamentos = data.capex?.projetos || [];
  const comValor = lancamentos.filter(p => somaMes(p.aportes) + somaMes(p.dividendos) !== 0);
  const semJustificativa = comValor.filter(p => !(p.justificativa || '').trim());
  const negativos = lancamentos.some(p => (p.aportes || []).some(v => parseNum(v) < 0) || (p.dividendos || []).some(v => parseNum(v) < 0));
  return [
    { label: 'Ao menos um aporte ou distribuição de dividendos lançado', ok: comValor.length > 0, detalhe: `${comValor.length} lançamento(s) com valor` },
    { label: 'Todo lançamento com valor tem justificativa', ok: semJustificativa.length === 0, detalhe: semJustificativa.length === 0 ? 'Justificativa preenchida em todos' : `${semJustificativa.length} lançamento(s) sem justificativa` },
    { label: 'Aportes e dividendos digitados como valores positivos', ok: !negativos, detalhe: negativos ? 'Há valor negativo — o sinal já vem da linha (aporte sai, dividendo entra)' : 'Sem valores negativos' },
  ];
}
