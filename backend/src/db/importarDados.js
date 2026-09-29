// Importação de dados por arquivo (2026-09-27, carga da ARA Agrícola a partir
// das planilhas do FP&A). Formato:
//   { cargas: [{ unidadeId, linhas?: { 'CC|conta': conta }, premissasPessoal?: { campo: valor } }] }
// - linhas: só entram onde a linha não existe ou está zerada — nunca
//   sobrescreve valor já lançado (conflito vai para o relatório).
// - premissasPessoal: campo a campo; objeto (ex.: baseBonusElegiveisPorCC)
//   mescla chave a chave. Substitui o valor atual (reportado antes → depois).
// - CC ou conta fora do plano da unidade recusa a carga inteira.
// Aplicar grava via atualizarDadosComAuditoria (fica no histórico/log).
import { buscarOuCriarOrcamento, atualizarDadosComAuditoria } from './orcamentos.js';
import { buscarReferencia } from '../calc/registroUnidades.js';
import { parseNum } from '../calc/orcamento.js';

const ANO = 2027;
const NAO_IMPORTAVEIS = new Set(['agricola', 'resorts', 'ei', 'textil_consolidado']); // Consolidados: snapshot, não documento de lançamento
const CAMPOS_COM_VALOR = ['valores', 'quantidades', 'valoresUnit', 'baseManual', 'percentuais'];

function linhaTemValor(conta) {
  return (conta?.sublinhas || []).some(s => CAMPOS_COM_VALOR.some(c => (s?.[c] || []).some(v => parseNum(v) !== 0)));
}

export async function importarDados({ cargas, aplicar = false, nomeArquivo = 'arquivo', usuarioId }) {
  if (!Array.isArray(cargas) || cargas.length === 0) throw Object.assign(new Error('Arquivo sem cargas.'), { status: 400 });

  // Valida tudo antes de gravar qualquer coisa.
  const erros = [];
  for (const carga of cargas) {
    const ref = buscarReferencia(carga.unidadeId);
    if (!ref || NAO_IMPORTAVEIS.has(carga.unidadeId)) { erros.push(`Unidade inválida: ${carga.unidadeId}`); continue; }
    const ccs = new Set(ref.ccs.map(c => c.codigo));
    for (const chave of Object.keys(carga.linhas || {})) {
      const [cc, conta] = chave.split('|');
      if (!ccs.has(cc)) erros.push(`${carga.unidadeId}: CC ${cc} não existe (${chave})`);
      else if (!ref.todasContas[conta]) erros.push(`${carga.unidadeId}: conta ${conta} não existe no plano (${chave})`);
    }
  }
  if (erros.length) throw Object.assign(new Error(`Carga recusada: ${erros.slice(0, 20).join('; ')}`), { status: 400 });

  const relatorio = [];
  for (const carga of cargas) {
    const atual = await buscarOuCriarOrcamento(carga.unidadeId, ANO);
    const dados = structuredClone(atual.dados);
    dados.custos = dados.custos || {};
    dados.custos.linhas = dados.custos.linhas || {};
    const novas = [];
    const conflitos = [];
    for (const [chave, conta] of Object.entries(carga.linhas || {})) {
      if (linhaTemValor(dados.custos.linhas[chave])) { conflitos.push(chave); continue; }
      dados.custos.linhas[chave] = conta;
      novas.push(chave);
    }
    const premissas = [];
    const pp = dados.custos.premissasPessoal = dados.custos.premissasPessoal || {};
    for (const [campo, valor] of Object.entries(carga.premissasPessoal || {})) {
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        pp[campo] = pp[campo] || {};
        for (const [k, v] of Object.entries(valor)) {
          premissas.push({ campo: `${campo}.${k}`, antes: pp[campo][k] ?? '', depois: v });
          pp[campo][k] = v;
        }
      } else {
        premissas.push({ campo, antes: pp[campo] ?? '', depois: valor });
        pp[campo] = valor;
      }
    }
    if (aplicar && (novas.length || premissas.length)) {
      await atualizarDadosComAuditoria({
        orcamentoAntes: atual,
        dadosNovos: dados,
        usuarioId,
        motivo: `Importação de dados: ${nomeArquivo}`,
      });
    }
    relatorio.push({ unidadeId: carga.unidadeId, novas: novas.length, conflitos, premissas });
  }
  return { aplicado: aplicar, relatorio };
}
