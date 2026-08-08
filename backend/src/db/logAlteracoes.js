import { pool } from './pool.js';

const SECOES_TOP_LEVEL = [
  'estrategicas', 'receita', 'custos', 'capex', 'capitalGiro',
  'provisoes', 'resultado', 'fcFinanciamentos', 'balanco', 'plano5y', 'sensibilidades',
];

/** Diff puro (sem I/O) entre duas versões do documento de orçamento, por
 * seção de topo (`campo` = nome da seção, ex. 'custos').
 *
 * Simplificação deliberada: o schema (seção 3.3) tem colunas para
 * cc_codigo/conta_codigo/pacote_id, pensadas para um diff por linha
 * analítica — mas o endpoint de escrita hoje recebe o documento inteiro
 * (dados JSONB) de uma vez, não uma edição pontual. Um diff genérico até o
 * nível de conta/CC exigiria conhecer a forma de cada seção; em vez de
 * simular granularidade que não temos, logamos por seção com o antes/depois
 * em JSON. Quando o frontend (Fase 6) passar a mandar patches pontuais por
 * campo — espelhando os `update*` callbacks do protótipo — trocar isto por
 * um diff por campo real, preenchendo cc_codigo/conta_codigo. */
export function calcularDiffPorSecao(antes, depois) {
  const linhas = [];
  for (const secao of SECOES_TOP_LEVEL) {
    const a = JSON.stringify(antes?.[secao] ?? null);
    const d = JSON.stringify(depois?.[secao] ?? null);
    if (a !== d) linhas.push({ campo: secao, valorAnterior: a, valorNovo: d });
  }
  return linhas;
}

/** Insere as linhas de log usando um client já aberto (participa da mesma
 * transação de quem chamou — ver db/orcamentos.js atualizarDadosComAuditoria).
 * Isso evita o cenário em que orcamentos.dados muda mas o log não é gravado
 * (ou vice-versa) por uma falha no meio do caminho. */
export async function inserirLinhasLog(client, { usuarioId, unidadeId, motivo, linhas }) {
  for (const l of linhas) {
    await client.query(
      `INSERT INTO log_alteracoes (usuario_id, unidade_id, campo, valor_anterior, valor_novo, motivo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuarioId, unidadeId, l.campo, l.valorAnterior, l.valorNovo, motivo || null]
    );
  }
}

/** Variante autônoma (própria conexão/transação) para chamadores fora do
 * fluxo de escrita de orçamento — ex.: um futuro ajuste manual administrativo. */
export async function registrarDiffPorSecao({ usuarioId, unidadeId, antes, depois, motivo }) {
  const linhas = calcularDiffPorSecao(antes, depois);
  if (linhas.length === 0) return [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await inserirLinhasLog(client, { usuarioId, unidadeId, motivo, linhas });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return linhas;
}

export async function listarLog(unidadeId, { limit = 200 } = {}) {
  const { rows } = await pool.query(
    `SELECT l.*, u.nome AS usuario_nome FROM log_alteracoes l
     JOIN usuarios u ON u.id = l.usuario_id
     WHERE l.unidade_id = $1 ORDER BY l.criado_em DESC LIMIT $2`,
    [unidadeId, limit]
  );
  return rows;
}
