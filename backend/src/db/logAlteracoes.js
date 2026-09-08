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

// Sessão de edição (2026-09-08, pedido: "o backlog de alterações precisa
// registrar todas edições realizadas por usuário") — log_alteracoes já grava
// uma linha por seção alterada A CADA salvamento (inclusive autosave, a cada
// poucos segundos durante edição ativa — ver PUT /:unidadeId), então listar
// linha a linha inundaria o Backlog do FP&A com dezenas/centenas de entradas
// por sessão de trabalho. Em vez disso, agrupa: linhas consecutivas do MESMO
// usuário + unidade + seção, com intervalo menor que GAP_MINUTOS entre uma e
// a próxima, viram UMA sessão ("Editou Custos e Despesas — 14:02 a 14:15,
// 23 salvamentos"). Trocar de seção ou de unidade sempre fecha a sessão
// atual, mesmo sem gap de tempo.
const GAP_MINUTOS = 15;

/** Busca as linhas cruas dos últimos `diasHistorico` dias (todas as
 * unidades) e agrupa em sessões — puro em JS, sem GROUP BY no Postgres,
 * porque "gaps and islands" por 3 colunas é mais simples de ler/testar
 * assim, e o volume (uso interno, algumas dezenas de pessoas) não pede
 * otimização de banco. */
export async function listarSessoesEdicaoTodasUnidades({ diasHistorico = 30, limite = 200 } = {}) {
  const { rows } = await pool.query(
    `SELECT l.usuario_id, u.nome AS usuario_nome, l.unidade_id, l.campo, l.criado_em
     FROM log_alteracoes l JOIN usuarios u ON u.id = l.usuario_id
     WHERE l.criado_em > now() - ($1 || ' days')::interval
     ORDER BY l.usuario_id, l.unidade_id, l.campo, l.criado_em ASC`,
    [diasHistorico]
  );

  const sessoes = [];
  let atual = null;
  for (const r of rows) {
    const abreNova = !atual
      || atual.usuarioId !== r.usuario_id
      || atual.unidadeId !== r.unidade_id
      || atual.campo !== r.campo
      || (new Date(r.criado_em) - new Date(atual.fim)) > GAP_MINUTOS * 60 * 1000;
    if (abreNova) {
      atual = {
        usuarioId: r.usuario_id, usuarioNome: r.usuario_nome, unidadeId: r.unidade_id, campo: r.campo,
        inicio: r.criado_em, fim: r.criado_em, edicoes: 1,
      };
      sessoes.push(atual);
    } else {
      atual.fim = r.criado_em;
      atual.edicoes += 1;
    }
  }

  return sessoes.sort((a, b) => new Date(b.fim) - new Date(a.fim)).slice(0, limite);
}
