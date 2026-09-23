// Rotas de administração — gestão de usuários/vínculos e concessões
// temporárias (seções 2.4 e 4.4). Toda rota exige admin_fpa: quem monta o
// router (server.js) já aplica authenticate; aqui aplicamos exigirPerfil.
import { Router } from 'express';
import { exigirPerfil } from '../middleware/authorize.js';
import {
  listarUsuarios, criarUsuario, atualizarUsuario,
  vincularUnidade, desvincularUnidade, vincularCc, desvincularCc, removerTodosCcUsuario,
  listarConcessoes, criarConcessao, revogarConcessao,
} from '../db/admin.js';
import { migrarPlanoContasResorts } from '../db/migracaoContasResorts.js';
import { pool } from '../db/pool.js';
import { definirSenha, buscarUsuarioParaEnvioAcesso, definirAcessoExpiracao } from '../db/usuarios.js';
import { validarSenha, gerarHashSenha } from '../auth/senha.js';
import { enviarAcesso } from '../email/notificacoes.js';
import { buscarOuCriarOrcamento, atualizarDadosComAuditoria } from '../db/orcamentos.js';
import { listarAlertas, contarAlertasPendentes, resolverAlerta } from '../db/alertasDados.js';
import { totalProjeto } from '../db/detectarPerdas.js';
import { iguais } from '../db/mesclarDados.js';
import { recalcularTotaisVersoes } from '../db/recalcularTotaisVersoes.js';

const ANO_ORCAMENTO = 2027;

export const adminRouter = Router();
adminRouter.use(exigirPerfil('admin_fpa'));

const PERFIS_VALIDOS = ['admin_fpa', 'gerente_unidade', 'gerente_cc_corporativo'];
// Rebatizado de "Gerente de CC (Corporativo)" para "Gestor de CC" em
// 2026-08-16 — id interno gerente_cc_corporativo mantido (evita migrar o
// CHECK constraint do enum em produção), mas agora vale para qualquer
// unidade, não só Corporativo.
// Bug corrigido em 2026-08-30 ("não estou conseguindo selecionar a
// unidade" — vínculo de Alice Fernandes/Resorts): esta lista ficou
// desatualizada desde 2026-08-20, quando Agrícola e Resorts viraram 3
// "unidades" cada (os 2 sites editáveis + o Consolidado — ver
// FAMILIA_AGRICOLA/FAMILIA_RESORTS em frontend/src/OrcamentoARA.jsx).
// Faltavam agricola_tds/agricola_fds/samoa_beach/samoa_villa — só
// 'agricola'/'resorts' (o Consolidado) validavam. POST/DELETE
// /usuarios/:id/unidades pra qualquer site individual sempre voltava 400
// unidadeId_invalido, silenciosamente (o frontend não tinha tratamento de
// erro nesse clique — parecia que o botão não fazia nada).
const UNIDADES_VALIDAS = ['textil', 'agricola_tds', 'agricola_fds', 'agricola', 'samoa_beach', 'samoa_villa', 'resorts', 'ei', 'energia', 'corporativo'];

adminRouter.get('/usuarios', async (req, res, next) => {
  try {
    res.json({ usuarios: await listarUsuarios() });
  } catch (err) { next(err); }
});

adminRouter.post('/usuarios', async (req, res, next) => {
  try {
    const { nome, email, perfil } = req.body;
    if (!nome || !email || !PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ erro: 'campos_invalidos', mensagem: 'nome, email e perfil (admin_fpa|gerente_unidade|gerente_cc_corporativo) são obrigatórios.' });
    }
    const usuario = await criarUsuario({ nome, email, perfil });
    res.status(201).json({ usuario });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'email_ja_cadastrado' }); // unique_violation
    next(err);
  }
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

adminRouter.patch('/usuarios/:id', async (req, res, next) => {
  try {
    const { perfil, ativo, nome, email } = req.body;
    if (perfil !== undefined && !PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ erro: 'perfil_invalido' });
    }
    if (nome !== undefined && !nome.trim()) {
      return res.status(400).json({ erro: 'nome_invalido' });
    }
    if (email !== undefined && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ erro: 'email_invalido' });
    }
    // Seção 6, teste 6: usuário desativado perde acesso na hora — não exige
    // nada além disto, porque authenticate.js já busca `ativo` do banco a
    // cada request (não confia em nada cacheado na sessão).
    const usuario = await atualizarUsuario(req.params.id, { perfil, ativo, nome, email });
    if (!usuario) return res.status(404).json({ erro: 'usuario_nao_encontrado' });
    res.json({ usuario });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'email_ja_cadastrado' });
    next(err);
  }
});

/** Admin define/reseta a senha de qualquer usuário — não há autocadastro
 * nem "esqueci minha senha" por e-mail ainda (pendência, ver
 * auth/senha.js). O usuário troca essa senha inicial pela própria depois,
 * via POST /auth/alterar-senha. */
adminRouter.post('/usuarios/:id/senha', async (req, res, next) => {
  try {
    const { senha } = req.body || {};
    const erroValidacao = validarSenha(senha);
    if (erroValidacao) return res.status(400).json({ erro: 'senha_invalida', mensagem: erroValidacao });

    await definirSenha(req.params.id, await gerarHashSenha(senha), senha);
    res.status(204).end();
  } catch (err) { next(err); }
});

/** Manda a senha ATUAL (a que já está guardada em texto puro, ver
 * senha_texto) por e-mail pro próprio usuário — pedido de 2026-08-23,
 * complementa a visibilidade de senha na tela. Best-effort, mesmo padrão de
 * email/notificacoes.js: se SMTP não estiver configurado, retorna erro
 * explícito em vez de fingir que enviou. */
adminRouter.post('/usuarios/:id/enviar-acesso', async (req, res, next) => {
  try {
    const usuario = await buscarUsuarioParaEnvioAcesso(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'usuario_nao_encontrado' });
    if (!usuario.senha_texto) {
      return res.status(400).json({ erro: 'sem_senha_definida', mensagem: 'Defina uma senha para este usuário antes de enviar o acesso por e-mail.' });
    }
    const enviado = await enviarAcesso({ nome: usuario.nome, email: usuario.email, senha: usuario.senha_texto });
    if (!enviado) {
      return res.status(503).json({ erro: 'smtp_nao_configurado', mensagem: 'E-mail não configurado no servidor (SMTP_HOST/SMTP_USER/SMTP_PASS) — copie a senha manualmente.' });
    }
    res.status(204).end();
  } catch (err) { next(err); }
});

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Tempo de acesso do usuário (2026-08-23): null/ausente = Indefinido;
 * 'AAAA-MM-DD' = Definido — a partir do dia seguinte a essa data o usuário
 * continua vendo o orçamento (GET) mas perde a escrita (PUT/POST enviar,
 * ver exigirAcessoNaoExpirado em middleware/authorize.js). Sempre um SET
 * explícito, nunca ignora o campo — é como o admin também volta pra
 * Indefinido (mandando acessoExpiraEm: null de propósito). */
adminRouter.patch('/usuarios/:id/acesso', async (req, res, next) => {
  try {
    const { acessoExpiraEm } = req.body || {};
    if (acessoExpiraEm != null && !DATA_REGEX.test(acessoExpiraEm)) {
      return res.status(400).json({ erro: 'data_invalida', mensagem: 'Data deve estar no formato AAAA-MM-DD.' });
    }
    const usuario = await definirAcessoExpiracao(req.params.id, acessoExpiraEm || null);
    if (!usuario) return res.status(404).json({ erro: 'usuario_nao_encontrado' });
    res.json({ usuario });
  } catch (err) { next(err); }
});

adminRouter.post('/usuarios/:id/unidades', async (req, res, next) => {
  try {
    const { unidadeId } = req.body;
    if (!unidadeId || !UNIDADES_VALIDAS.includes(unidadeId)) return res.status(400).json({ erro: 'unidadeId_invalido' });
    await vincularUnidade(req.params.id, unidadeId);
    res.status(204).end();
  } catch (err) { next(err); }
});
adminRouter.delete('/usuarios/:id/unidades/:unidadeId', async (req, res, next) => {
  try {
    await desvincularUnidade(req.params.id, req.params.unidadeId);
    res.status(204).end();
  } catch (err) { next(err); }
});

/** Gestor de CC (pedido de 2026-08-16, corrigido no mesmo dia: "um gestor
 * pode ser gestor de mais de um CC") — checklist na tela de admin, cada
 * marcação/desmarcação chama estas duas rotas (acumula, não substitui). */
adminRouter.post('/usuarios/:id/ccs', async (req, res, next) => {
  try {
    const { unidadeId, ccCodigo } = req.body;
    if (!unidadeId || !UNIDADES_VALIDAS.includes(unidadeId)) return res.status(400).json({ erro: 'unidadeId_invalido' });
    if (!ccCodigo) return res.status(400).json({ erro: 'ccCodigo_obrigatorio' });
    await vincularCc(req.params.id, unidadeId, ccCodigo);
    res.status(204).end();
  } catch (err) { next(err); }
});
adminRouter.delete('/usuarios/:id/ccs/:unidadeId/:ccCodigo', async (req, res, next) => {
  try {
    await desvincularCc(req.params.id, req.params.unidadeId, req.params.ccCodigo);
    res.status(204).end();
  } catch (err) { next(err); }
});
/** Limpa todos os CCs — usado quando o admin troca a unidade do Gestor de
 * CC (os CCs antigos eram da unidade anterior). */
adminRouter.delete('/usuarios/:id/ccs', async (req, res, next) => {
  try {
    await removerTodosCcUsuario(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// --- Concessões temporárias (seção 4.4) ---

adminRouter.get('/concessoes', async (req, res, next) => {
  try {
    const apenasAtivas = req.query.ativas === 'true';
    res.json({ concessoes: await listarConcessoes({ apenasAtivas }) });
  } catch (err) { next(err); }
});

adminRouter.post('/concessoes', async (req, res, next) => {
  try {
    const { usuarioId, ccCodigo, motivo, validoAte } = req.body;
    if (!usuarioId || !ccCodigo || !motivo || !validoAte) {
      return res.status(400).json({ erro: 'campos_invalidos', mensagem: 'usuarioId, ccCodigo, motivo e validoAte são obrigatórios.' });
    }
    // "só um admin_fpa pode inserir" (seção 4.4) — já garantido pelo
    // exigirPerfil('admin_fpa') no topo do router; concedido_por é sempre
    // req.usuario.id, nunca um valor vindo do cliente.
    const concessao = await criarConcessao({ usuarioId, ccCodigo, concedidoPor: req.usuario.id, motivo, validoAte });
    res.status(201).json({ concessao });
  } catch (err) { next(err); }
});

adminRouter.post('/concessoes/:id/revogar', async (req, res, next) => {
  try {
    const concessao = await revogarConcessao(req.params.id);
    if (!concessao) return res.status(404).json({ erro: 'concessao_nao_encontrada_ou_ja_revogada' });
    res.json({ concessao });
  } catch (err) { next(err); }
});

// --- Migração pontual: plano de contas Resorts (2026-09-07) ---
// Ver backend/src/db/migracaoContasResorts.js para o racional completo.
// `aplicar` no corpo (default false) — sempre simular antes de aplicar de
// verdade. Idempotente: rodar de novo depois de aplicado não encontra mais
// nada pra mover (as contas antigas não existem mais nas chaves).
adminRouter.post('/migracoes/plano-contas-resorts', async (req, res, next) => {
  try {
    const aplicar = req.body?.aplicar === true;
    const resultado = await migrarPlanoContasResorts({ aplicar, usuarioId: req.usuario.id });
    res.json(resultado);
  } catch (err) { next(err); }
});

// --- Recalcular totais das versões enviadas (2026-09-23) ---
// Ver db/recalcularTotaisVersoes.js. `aplicar` false (padrão) só simula.
adminRouter.post('/versoes/recalcular-totais', async (req, res, next) => {
  try {
    res.json(await recalcularTotaisVersoes({ aplicar: req.body?.aplicar === true }));
  } catch (err) { next(err); }
});

// --- Snapshots / recuperação de dados (seção do log_alteracoes) ---

adminRouter.get('/snapshots/:unidadeId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.id, l.unidade_id, l.campo, l.criado_em, u.nome AS usuario_nome,
             length(l.valor_anterior) AS tam_anterior, length(l.valor_novo) AS tam_novo
      FROM log_alteracoes l
      JOIN usuarios u ON u.id = l.usuario_id
      WHERE l.unidade_id = $1
      ORDER BY l.criado_em DESC
      LIMIT 100
    `, [req.params.unidadeId]);
    res.json({ snapshots: rows });
  } catch (err) { next(err); }
});

adminRouter.post('/snapshots/:logId/restaurar', async (req, res, next) => {
  try {
    const logId = Number(req.params.logId);
    if (!Number.isInteger(logId) || logId <= 0) return res.status(400).json({ erro: 'logId_invalido' });
    const { rows: logRows } = await pool.query(
      `SELECT unidade_id, campo, valor_anterior FROM log_alteracoes WHERE id = $1`, [logId]
    );
    if (!logRows[0]) return res.status(404).json({ erro: 'snapshot_nao_encontrado' });
    const { unidade_id, campo, valor_anterior } = logRows[0];
    if (!valor_anterior) return res.status(400).json({ erro: 'sem_valor_anterior', mensagem: 'Este snapshot não registrou estado anterior.' });
    // Via atualizarDadosComAuditoria: a restauração vira uma linha de log
    // como qualquer save — dá pra ver quem restaurou e desfazer.
    const atual = await buscarOuCriarOrcamento(unidade_id, ANO_ORCAMENTO);
    await atualizarDadosComAuditoria({
      orcamentoAntes: atual,
      dadosNovos: { ...atual.dados, [campo]: JSON.parse(valor_anterior) },
      usuarioId: req.usuario.id,
      motivo: `Restauração da seção "${campo}" ao estado anterior do log #${logId}`,
    });
    res.json({ ok: true, unidade_id, campo });
  } catch (err) { next(err); }
});

// --- Alertas de possível perda de dados (ver db/detectarPerdas.js) ---

adminRouter.get('/alertas', async (req, res, next) => {
  try {
    res.json({ alertas: await listarAlertas({ pendentes: req.query.todos !== 'true' }) });
  } catch (err) { next(err); }
});

adminRouter.get('/alertas/contagem', async (req, res, next) => {
  try {
    res.json({ pendentes: await contarAlertasPendentes() });
  } catch (err) { next(err); }
});

adminRouter.post('/alertas/:id/resolver', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: 'id_invalido' });
    const r = await resolverAlerta(id, req.usuario.id);
    if (!r) return res.status(404).json({ erro: 'alerta_nao_encontrado_ou_ja_resolvido' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// --- Histórico de CapEx por projeto (restaura projeto a projeto) ---
// Diferente da restauração de seção inteira acima: repõe só os projetos
// escolhidos, sem desfazer o que outros gestores salvaram depois.

function lerProjetos(texto) {
  try { return JSON.parse(texto)?.projetos || []; } catch { return []; }
}

async function buscarLogCapex(unidadeId, logId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.criado_em, l.valor_anterior, l.valor_novo, u.nome AS usuario_nome
     FROM log_alteracoes l JOIN usuarios u ON u.id = l.usuario_id
     WHERE l.id = $1 AND l.unidade_id = $2 AND l.campo = 'capex'`,
    [logId, unidadeId]
  );
  return rows[0] || null;
}

adminRouter.get('/capex-historico/:unidadeId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.criado_em, l.motivo, l.valor_anterior, l.valor_novo, u.nome AS usuario_nome, u.perfil AS usuario_perfil
       FROM log_alteracoes l JOIN usuarios u ON u.id = l.usuario_id
       WHERE l.unidade_id = $1 AND l.campo = 'capex'
       ORDER BY l.criado_em DESC LIMIT 300`,
      [req.params.unidadeId]
    );
    const resumo = (texto) => {
      const ps = lerProjetos(texto);
      return { projetos: ps.length, total: ps.reduce((acc, p) => acc + totalProjeto(p), 0) };
    };
    res.json({
      historico: rows.map((r) => ({
        id: r.id, criado_em: r.criado_em, motivo: r.motivo,
        usuario_nome: r.usuario_nome, usuario_perfil: r.usuario_perfil,
        antes: resumo(r.valor_anterior), depois: resumo(r.valor_novo),
      })),
    });
  } catch (err) { next(err); }
});

adminRouter.get('/capex-historico/:unidadeId/:logId', async (req, res, next) => {
  try {
    const log = await buscarLogCapex(req.params.unidadeId, Number(req.params.logId));
    if (!log) return res.status(404).json({ erro: 'log_nao_encontrado' });
    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ORCAMENTO);
    const atuaisPorId = new Map((atual.dados?.capex?.projetos || []).map((p) => [p.id, p]));
    const descrever = (texto) => lerProjetos(texto).map((p) => {
      const hoje = atuaisPorId.get(p.id);
      return {
        id: p.id, nome: p.nome, ccCodigo: p.ccCodigo, categoria: p.categoria,
        total: totalProjeto(p),
        totalHoje: hoje ? totalProjeto(hoje) : null,
        situacao: !hoje ? 'ausente_hoje' : (iguais(hoje, p) ? 'igual' : 'diferente'),
      };
    });
    res.json({
      id: log.id, criado_em: log.criado_em, usuario_nome: log.usuario_nome,
      anterior: descrever(log.valor_anterior),
      novo: descrever(log.valor_novo),
    });
  } catch (err) { next(err); }
});

adminRouter.post('/capex-historico/:unidadeId/:logId/restaurar', async (req, res, next) => {
  try {
    const { projetoIds, lado } = req.body || {};
    if (!Array.isArray(projetoIds) || projetoIds.length === 0) return res.status(400).json({ erro: 'projetoIds_obrigatorio' });
    if (lado !== 'anterior' && lado !== 'novo') return res.status(400).json({ erro: 'lado_invalido' });
    const log = await buscarLogCapex(req.params.unidadeId, Number(req.params.logId));
    if (!log) return res.status(404).json({ erro: 'log_nao_encontrado' });

    const escolhidos = lerProjetos(lado === 'novo' ? log.valor_novo : log.valor_anterior)
      .filter((p) => projetoIds.includes(p.id));
    if (escolhidos.length === 0) return res.status(400).json({ erro: 'projetos_nao_encontrados_no_log' });

    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ORCAMENTO);
    const porId = new Map(escolhidos.map((p) => [p.id, p]));
    const projetosAtuais = atual.dados?.capex?.projetos || [];
    const projetos = [
      ...projetosAtuais.map((p) => porId.get(p.id) || p),
      ...escolhidos.filter((p) => !projetosAtuais.some((q) => q.id === p.id)),
    ];
    await atualizarDadosComAuditoria({
      orcamentoAntes: atual,
      dadosNovos: { ...atual.dados, capex: { ...(atual.dados?.capex || {}), projetos } },
      usuarioId: req.usuario.id,
      motivo: `Restauração de ${escolhidos.length} projeto(s) de CapEx a partir do log #${log.id} (${lado === 'novo' ? 'depois' : 'antes'} do save de ${log.usuario_nome})`,
    });
    res.json({ ok: true, restaurados: escolhidos.map((p) => p.nome || p.id) });
  } catch (err) { next(err); }
});
