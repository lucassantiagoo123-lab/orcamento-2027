import { pool } from './pool.js';
import { emptyFormData } from '../calc/orcamento.js';
import { calcularDiffPorSecao, inserirLinhasLog } from './logAlteracoes.js';

export async function buscarOuCriarOrcamento(unidadeId, ano) {
  const existente = await pool.query(
    `SELECT * FROM orcamentos WHERE unidade_id = $1 AND ano = $2`,
    [unidadeId, ano]
  );
  if (existente.rows[0]) return existente.rows[0];

  const criado = await pool.query(
    `INSERT INTO orcamentos (unidade_id, ano, dados) VALUES ($1, $2, $3) RETURNING *`,
    [unidadeId, ano, JSON.stringify(emptyFormData(unidadeId))]
  );
  return criado.rows[0];
}

export async function atualizarDados(orcamentoId, dados, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE orcamentos
     SET dados = $2, status = CASE WHEN status = 'nao_iniciado' THEN 'em_elaboracao' ELSE status END,
         atualizado_em = now(), atualizado_por = $3
     WHERE id = $1
     RETURNING *`,
    [orcamentoId, JSON.stringify(dados), usuarioId]
  );
  return rows[0];
}

/** Escreve orcamentos.dados e as linhas de log_alteracoes correspondentes
 * numa única transação (seção 3.3): ou os dois efeitos acontecem, ou nenhum.
 * `orcamentoAntes` é o registro já carregado pelo chamador (mesma leitura
 * usada para decidir bloqueio pós-aprovação — ver routes/orcamentos.js),
 * evitado reconsultar o banco só para calcular o diff. */
export async function atualizarDadosComAuditoria({ orcamentoAntes, dadosNovos, usuarioId, motivo }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE orcamentos
       SET dados = $2, status = CASE WHEN status = 'nao_iniciado' THEN 'em_elaboracao' ELSE status END,
           atualizado_em = now(), atualizado_por = $3
       WHERE id = $1
       RETURNING *`,
      [orcamentoAntes.id, JSON.stringify(dadosNovos), usuarioId]
    );

    // Toda escrita depois que o orçamento deixa de ser 'nao_iniciado' gera
    // log (seção 3.3 / teste 5 da seção 6). A própria escrita que faz a
    // transição nao_iniciado -> em_elaboracao não gera linha — não há
    // "antes" significativo para comparar num documento recém-criado vazio.
    let linhasLog = [];
    if (orcamentoAntes.status !== 'nao_iniciado') {
      linhasLog = calcularDiffPorSecao(orcamentoAntes.dados, dadosNovos);
      await inserirLinhasLog(client, {
        usuarioId, unidadeId: orcamentoAntes.unidade_id, motivo, linhas: linhasLog,
      });
    }

    await client.query('COMMIT');
    return { orcamento: rows[0], linhasLog };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function registrarEnvio(orcamentoId, dados, usuarioId, comentario, totais) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const versao = await client.query(
      `INSERT INTO orcamento_versoes (orcamento_id, dados, autor_id, comentario, totais)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orcamentoId, JSON.stringify(dados), usuarioId, comentario || null, JSON.stringify(totais || {})]
    );
    // aguardando_liberacao = true (pedido de 2026-08-16): trava novo envio
    // até um admin_fpa liberar — ver liberarReenvio abaixo.
    const orcamento = await client.query(
      `UPDATE orcamentos SET status = 'enviado', dados = $2, aguardando_liberacao = true, atualizado_em = now(), atualizado_por = $3
       WHERE id = $1 RETURNING *`,
      [orcamentoId, JSON.stringify(dados), usuarioId]
    );
    await client.query('COMMIT');
    return { orcamento: orcamento.rows[0], versao: versao.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Admin FP&A libera o botão "Enviar versão" de novo, depois de revisar o
 * envio (pedido de 2026-08-16). Não muda status/bloqueado — só a trava de
 * reenvio; a aprovação formal (seção 4.5) continua sendo o `aprovar`
 * abaixo, ação separada. */
export async function liberarReenvio(orcamentoId) {
  const { rows } = await pool.query(
    `UPDATE orcamentos SET aguardando_liberacao = false, atualizado_em = now() WHERE id = $1 RETURNING *`,
    [orcamentoId]
  );
  return rows[0];
}

export async function aprovar(orcamentoId, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE orcamentos SET status = 'aprovado', bloqueado = true, atualizado_em = now(), atualizado_por = $2
     WHERE id = $1 RETURNING *`,
    [orcamentoId, usuarioId]
  );
  return rows[0];
}

export async function listarVersoes(orcamentoId) {
  const { rows } = await pool.query(
    `SELECT ov.id, ov.autor_id, u.nome AS autor_nome, ov.comentario, ov.totais, ov.enviado_em
     FROM orcamento_versoes ov JOIN usuarios u ON u.id = ov.autor_id
     WHERE ov.orcamento_id = $1 ORDER BY ov.enviado_em DESC`,
    [orcamentoId]
  );
  return rows;
}

/** Backlog do FP&A: as N versões enviadas mais recentes de TODAS as
 * unidades juntas (histórico consolidado entre unidades) — pedido de
 * 2026-08-23. Antes vivia só em localStorage, escrito manualmente a cada
 * envio (ver frontend/src/legacyStorage.js); agora é derivado direto de
 * orcamento_versoes, a mesma fonte de verdade de sempre — não duplica nada,
 * não precisa de escrita própria no momento do envio. */
export async function listarVersoesRecentesTodasUnidades(limite = 200) {
  const { rows } = await pool.query(
    `SELECT ov.id, o.unidade_id, ov.autor_id, u.nome AS autor_nome, ov.comentario, ov.totais, ov.enviado_em
     FROM orcamento_versoes ov
     JOIN orcamentos o ON o.id = ov.orcamento_id
     JOIN usuarios u ON u.id = ov.autor_id
     ORDER BY ov.enviado_em DESC
     LIMIT $1`,
    [limite]
  );
  return rows;
}

/** Snapshot completo de uma versão específica (com `dados`) — pedido de
 * 2026-08-17: "o gestor da unidade ou admin FP&A precisa ter a opção de
 * abrir a versão enviada e salva". listarVersoes não traz `dados` de
 * propósito (é uma lista, ficaria pesada); esta busca é só quando o usuário
 * clica em "Abrir" numa versão específica. */
export async function buscarVersao(orcamentoId, versaoId) {
  const { rows } = await pool.query(
    `SELECT ov.id, ov.dados, ov.autor_id, u.nome AS autor_nome, ov.comentario, ov.totais, ov.enviado_em
     FROM orcamento_versoes ov JOIN usuarios u ON u.id = ov.autor_id
     WHERE ov.orcamento_id = $1 AND ov.id = $2`,
    [orcamentoId, versaoId]
  );
  return rows[0] || null;
}
