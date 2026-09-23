// Recalcula orcamento_versoes.totais (receitaLiquida/ebitda/lucroLiquido) a
// partir do snapshot `dados` de cada versão — 2026-09-23: até o commit c9f3dcf
// o cálculo do servidor ignorava encargos do Novo HC, o 2º dissídio e os
// rateios de Hospedagem/A&B da Resorts, então os totais gravados no envio
// divergiam da tela. O snapshot enviado (`dados`) nunca é alterado; o total
// anterior fica guardado em totais.totaisAnteriores (reversível).
import { pool } from './pool.js';
import { dreDaUnidade } from '../calc/orcamento.js';
import { buscarReferencia } from '../calc/registroUnidades.js';
import { listarPremissasMacro } from './premissasMacro.js';

const REF_VAZIA = { ccs: [], todasContas: {} };
const CAMPOS = ['receitaLiquida', 'ebitda', 'lucroLiquido'];

export async function recalcularTotaisVersoes({ aplicar = false } = {}) {
  const premissas = await listarPremissasMacro();
  const valor = (id) => premissas.find((p) => p.id === id)?.valor;
  const ipcaAnualPct = valor('ipca');
  const cambios = { usd: valor('cambio'), eur: valor('cambio_eur'), gbp: valor('cambio_gbp') };

  const { rows } = await pool.query(
    `SELECT ov.id, o.unidade_id, ov.dados, ov.totais, ov.enviado_em, u.nome AS autor_nome
     FROM orcamento_versoes ov
     JOIN orcamentos o ON o.id = ov.orcamento_id
     JOIN usuarios u ON u.id = ov.autor_id
     ORDER BY ov.enviado_em DESC`
  );

  const versoes = [];
  for (const r of rows) {
    const antes = Object.fromEntries(CAMPOS.map((k) => [k, Number(r.totais?.[k]) || 0]));
    let depois;
    try {
      const dre = dreDaUnidade(r.dados, r.unidade_id, buscarReferencia(r.unidade_id) || REF_VAZIA, ipcaAnualPct, cambios);
      depois = Object.fromEntries(CAMPOS.map((k) => [k, Number(dre[k]) || 0]));
    } catch (err) {
      versoes.push({ id: r.id, unidade_id: r.unidade_id, enviado_em: r.enviado_em, autor_nome: r.autor_nome, erro: err.message });
      continue;
    }
    const mudou = CAMPOS.some((k) => Math.abs(antes[k] - depois[k]) >= 0.01);
    // Receita não depende das regras corrigidas — se mudou, foi IPCA/câmbio
    // que mudaram desde o envio (o recálculo usa as premissas macro de hoje).
    const receitaMudou = Math.abs(antes.receitaLiquida - depois.receitaLiquida) >= 0.01;
    versoes.push({ id: r.id, unidade_id: r.unidade_id, enviado_em: r.enviado_em, autor_nome: r.autor_nome, antes, depois, mudou, receitaMudou });

    if (aplicar && mudou) {
      const jaRecalculada = r.totais?.totaisAnteriores;
      await pool.query(
        `UPDATE orcamento_versoes SET totais = COALESCE(totais, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
        [r.id, JSON.stringify({
          ...depois,
          totaisRecalculadosEm: new Date().toISOString(),
          totaisAnteriores: jaRecalculada || antes,
        })]
      );
    }
  }
  return { aplicado: aplicar, versoes };
}
