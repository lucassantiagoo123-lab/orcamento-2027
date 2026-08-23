// Rotas de orçamento — seção 4 (autorização) e 4.5 (bloqueio pós-aprovação)
// da especificação. Toda rota passa por authenticate (fora daqui, no
// server.js) e por exigirUnidade, que rejeita (403) qualquer unidade_id fora
// do vínculo real do usuário no banco — nunca confia no que vem da URL.
import { Router } from 'express';
import { exigirUnidade, exigirPerfil } from '../middleware/authorize.js';
import { buscarOuCriarOrcamento, atualizarDadosComAuditoria, registrarEnvio, liberarReenvio, aprovar, listarVersoes, buscarVersao } from '../db/orcamentos.js';
import { listarLog } from '../db/logAlteracoes.js';
import { computeDRE, computeDFC, computeFluxoIndiretoMensal, computeFluxoCaixaDiretoMensal, runAuditoria, dreDaUnidade, ehSnapshotConsolidado } from '../calc/orcamento.js';
import { buscarReferencia } from '../calc/registroUnidades.js';
import { notificarEnvioParaFpa } from '../email/notificacoes.js';
import { listarPremissasMacro } from '../db/premissasMacro.js';

// IPCA anual (%) da premissa macro do FP&A Corporativo — usado pelo tipo de
// premissa 'reajuste_inflacao' (ver dreDaUnidade/valorLinhaMes,
// calc/orcamento.js). Sem premissa preenchida, retorna undefined — computeDRE
// degrada pra reajuste 0% (ver ipcaMensalDe), nunca quebra.
async function buscarIpcaAnualPct() {
  const premissas = await listarPremissasMacro();
  return premissas.find(p => p.id === 'ipca')?.valor;
}

export const orcamentosRouter = Router();

// Só pra mensagem do e-mail de notificação — não é usado em nenhum cálculo.
const NOME_UNIDADE = {
  textil: 'ARA Têxtil',
  agricola: 'ARA Agrícola — Consolidado', agricola_tds: 'ARA Agrícola — Terra do Sol', agricola_fds: 'ARA Agrícola — Frutos do Sol',
  resorts: 'ARA Resorts — Consolidado', samoa_beach: 'ARA Resorts — Samoa Beach', samoa_villa: 'ARA Resorts — Samoa Villa',
  corporativo: 'Corporativo', ei: 'ARA EI', energia: 'Escritório de Investimentos',
};

// ARA Agrícola e ARA Resorts habilitadas em 2026-08-09, usando um CC
// placeholder (ver calc/constantesAgricolaResorts.js) até a planilha real.
// Corporativo habilitado em 2026-08-16, com os 20 CCs reais e todo CC
// recebendo o mesmo plano de contas completo (decisão do usuário — falta
// De/Para conta×CC na fonte, mas o pedido foi explícito: "cada CC precisa
// conter todas as contas analíticas"). ARA EI segue de fora — nem plano de
// contas ela tem ainda.
// Isto é reforçado aqui, no servidor, e não só escondido na UI — mesma regra
// da seção 4 aplicada a uma pendência de dado, não só a escopo de usuário.
// 2026-08-20: Agrícola e Resorts viraram Família (2 sites + Consolidado —
// ver ConsolidadoAgricola/ConsolidadoResorts no frontend) —
// 'agricola_tds'/'agricola_fds'/'samoa_beach'/'samoa_villa' são as unidades
// editáveis de verdade; 'agricola'/'resorts' (Consolidado) continuam na
// lista porque o envio deles reaproveita o mesmo PUT + POST /enviar de
// qualquer unidade (grava o snapshot combinado antes de enviar — não têm
// formulário de premissa próprio, só essas duas chamadas).
const UNIDADES_COM_LANCAMENTO_HABILITADO = ['textil', 'agricola', 'agricola_tds', 'agricola_fds', 'resorts', 'samoa_beach', 'samoa_villa', 'corporativo'];

function exigirLancamentoHabilitado(req, res, next) {
  const { unidadeId } = req.params;
  if (!UNIDADES_COM_LANCAMENTO_HABILITADO.includes(unidadeId)) {
    return res.status(409).json({
      erro: 'unidade_em_modo_referencia',
      mensagem: `${unidadeId} ainda não tem lançamento de orçamento habilitado — pendência de dado-fonte documentada no CLAUDE.md. Painel de referência apenas.`,
    });
  }
  next();
}

const ANO_ATUAL = 2027;

/** Gestor de CC (corrigido em 2026-08-16): só pode gravar linhas de Custos e
 * Despesas do(s) seu(s) CC(s) — o orçamento é um único bloco JSONB por
 * unidade (não fatiado por CC), então isto é a única barreira real contra
 * ele escrever num CC alheio, já que podeAcessarUnidade agora libera a
 * unidade inteira pra ele (ver middleware/authorize.js). Retorna null se
 * está tudo dentro do escopo, ou uma mensagem de erro se achou algo fora.
 * Pendência conhecida, não escondida: isto valida só custos.linhas/
 * detalhes/funcionarios (a única parte do formulário organizada por CC) —
 * Receita, CAPEX, Kgiro etc. continuam de unidade inteira, sem filtro por
 * CC, porque não têm essa granularidade no modelo de dados hoje. */
function validarEscritaCcCustos(usuario, unidadeId, dadosNovos) {
  if (usuario.perfil !== 'gerente_cc_corporativo') return null;
  const ccsPermitidos = new Set(
    (usuario.ccsPermitidos || []).filter((c) => c.unidadeId === unidadeId).map((c) => c.codigo)
  );
  const custos = dadosNovos?.custos || {};

  for (const chave of Object.keys(custos.linhas || {})) {
    const ccCodigo = chave.split('|')[0];
    if (!ccsPermitidos.has(ccCodigo)) {
      return `Sem acesso ao CC ${ccCodigo} (custos.linhas).`;
    }
  }
  for (const d of custos.detalhes || []) {
    if (d.cc && !ccsPermitidos.has(d.cc)) return `Sem acesso ao CC ${d.cc} (detalhamento de pacote).`;
  }
  for (const f of custos.funcionarios || []) {
    if (f.ccCodigo && !ccsPermitidos.has(f.ccCodigo)) return `Sem acesso ao CC ${f.ccCodigo} (funcionário).`;
  }
  return null;
}

/** Gestor de CC (pedido de 2026-08-16: "acesso apenas à seção Custos e
 * Despesas [...] a visão completa é só do Gestor da Unidade e do Admin") —
 * como o PUT substitui o documento inteiro (não faz merge por seção), a
 * única forma de garantir isso de verdade é comparar o que veio com o que
 * já estava salvo: qualquer seção fora de 'custos' que tenha mudado é
 * rejeitada. dadosAntes vem do próprio buscarOuCriarOrcamento já chamado
 * na rota — não gera consulta extra. */
function validarSoCustosAlterado(usuario, dadosAntes, dadosNovos) {
  if (usuario.perfil !== 'gerente_cc_corporativo') return null;
  const chaves = new Set([...Object.keys(dadosAntes || {}), ...Object.keys(dadosNovos || {})]);
  for (const chave of chaves) {
    if (chave === 'custos') continue;
    if (JSON.stringify(dadosAntes?.[chave]) !== JSON.stringify(dadosNovos?.[chave])) {
      return `Gestor de CC só pode alterar a seção Custos e Despesas (tentativa de mudar "${chave}").`;
    }
  }
  return null;
}

// Unidades sem registro (Corporativo, ARA EI, ARA Energia) caem num ref
// vazio — cpv/despesas/depreciação dão 0 (nenhum CC bate), em vez de
// quebrar a rota. Essas unidades só mostram painel de referência no
// frontend mesmo, então esse cálculo nunca é exibido de verdade — é só
// pra rota não explodir se algo tentar carregar os dados de qualquer forma.
const REF_VAZIA = { ccs: [], todasContas: {} };

orcamentosRouter.get('/:unidadeId', exigirUnidade('unidadeId'), async (req, res, next) => {
  try {
    const { unidadeId } = req.params;
    const ref = buscarReferencia(unidadeId) || REF_VAZIA;
    const orcamento = await buscarOuCriarOrcamento(unidadeId, ANO_ATUAL);
    // Consolidado (Agrícola/Resorts, 2026-08-20): depois do primeiro envio,
    // orcamento.dados de 'agricola'/'resorts' é o snapshot combinado — ver
    // frontend ConsolidadoAgricola/ConsolidadoResorts.
    // computeDFC/computeFluxoIndiretoMensal/computeFluxoCaixaDiretoMensal/
    // runAuditoria quebrariam nesse formato (nenhum é wrapper-aware como
    // dreDaUnidade) — e o frontend nem usa esses 4 campos da resposta
    // (sempre recalcula do zero a partir de orcamento.dados, ver
    // dreDaUnidade/OrcamentoARA.jsx), então ficam null nesse caso em vez de
    // arriscar quebrar a rota à toa.
    const ehConsolidado = ehSnapshotConsolidado(orcamento.dados);
    const ipcaAnualPct = await buscarIpcaAnualPct();
    const dre = dreDaUnidade(orcamento.dados, unidadeId, ref, ipcaAnualPct);
    res.json({
      orcamento,
      dre,
      dfc: ehConsolidado ? null : computeDFC(orcamento.dados, dre),
      fluxoIndiretoMensal: ehConsolidado ? null : computeFluxoIndiretoMensal(orcamento.dados, dre, ref, ipcaAnualPct),
      fluxoDiretoMensal: ehConsolidado ? null : computeFluxoCaixaDiretoMensal(orcamento.dados, dre, ref, ipcaAnualPct),
      auditoria: ehConsolidado ? [] : runAuditoria(orcamento.dados, dre, ref, unidadeId, ipcaAnualPct),
    });
  } catch (err) { next(err); }
});

orcamentosRouter.put('/:unidadeId', exigirUnidade('unidadeId'), exigirLancamentoHabilitado, async (req, res, next) => {
  try {
    const { dados, motivo } = req.body;
    if (!dados) return res.status(400).json({ erro: 'dados_obrigatorio' });

    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);

    const erroEscopoCc = validarEscritaCcCustos(req.usuario, req.params.unidadeId, dados);
    if (erroEscopoCc) return res.status(403).json({ erro: 'fora_de_escopo', mensagem: erroEscopoCc });
    const erroSecao = validarSoCustosAlterado(req.usuario, atual.dados, dados);
    if (erroSecao) return res.status(403).json({ erro: 'fora_de_escopo', mensagem: erroSecao });

    // Seção 4.5 — bloqueio pós-aprovação: só admin_fpa escreve depois de
    // aprovado, e precisa justificar (motivo vai para log_alteracoes.motivo).
    if (atual.status === 'aprovado' && atual.bloqueado) {
      if (req.usuario.perfil !== 'admin_fpa') {
        return res.status(403).json({ erro: 'orcamento_bloqueado', mensagem: 'Orçamento aprovado — só admin_fpa pode editar, informando motivo.' });
      }
      if (!motivo || !motivo.trim()) {
        return res.status(400).json({ erro: 'motivo_obrigatorio', mensagem: 'Edição pós-aprovação exige motivo.' });
      }
    }

    // Seção 3.3 — dados e log de alteração gravados na mesma transação:
    // ou os dois efeitos acontecem, ou nenhum (ver db/orcamentos.js).
    const { orcamento: atualizado } = await atualizarDadosComAuditoria({
      orcamentoAntes: atual,
      dadosNovos: dados,
      usuarioId: req.usuario.id,
      motivo: motivo || null,
    });

    res.json({ orcamento: atualizado });
  } catch (err) { next(err); }
});

orcamentosRouter.post('/:unidadeId/enviar', exigirUnidade('unidadeId'), exigirLancamentoHabilitado, async (req, res, next) => {
  try {
    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);
    // Pedido de 2026-08-16: trava reenvio até um admin_fpa liberar — o
    // frontend já desabilita o botão, isto é a barreira de verdade.
    if (atual.aguardando_liberacao) {
      return res.status(409).json({
        erro: 'aguardando_liberacao_fpa',
        mensagem: 'Este orçamento já foi enviado e está aguardando liberação do FP&A para permitir um novo envio.',
      });
    }
    const ref = buscarReferencia(req.params.unidadeId) || REF_VAZIA;
    // dreDaUnidade (não computeDRE direto): no envio do Consolidado da
    // Agrícola, atual.dados já é o snapshot combinado {_tipo, tds, fds} que
    // o frontend acabou de gravar via PUT — ver ConsolidadoAgricola. Soma
    // os totais reais de Terra do Sol + Frutos do Sol em vez de quebrar (ou
    // de mandar e-mail/gravar versão com totais zerados).
    const ipcaAnualPct = await buscarIpcaAnualPct();
    const dre = dreDaUnidade(atual.dados, req.params.unidadeId, ref, ipcaAnualPct);
    const totais = { receitaLiquida: dre.receitaLiquida, ebitda: dre.ebitda, lucroLiquido: dre.lucroLiquido };
    const { orcamento, versao } = await registrarEnvio(atual.id, atual.dados, req.usuario.id, req.body.comentario, totais);
    res.json({ orcamento, versao });

    // Depois da resposta — best-effort, não atrasa nem derruba o envio se o
    // e-mail falhar (ver notificacoes.js, tudo try/catch lá dentro).
    notificarEnvioParaFpa({
      unidadeNome: NOME_UNIDADE[req.params.unidadeId] || req.params.unidadeId,
      autorNome: req.usuario.nome,
      comentario: req.body.comentario,
      totais,
    }).catch((err) => console.error('[email] notificarEnvioParaFpa falhou:', err.message));
  } catch (err) { next(err); }
});

/** Admin FP&A libera o botão "Enviar versão" de novo, depois de revisar o
 * envio anterior (pedido de 2026-08-16). */
orcamentosRouter.post('/:unidadeId/liberar-reenvio', exigirUnidade('unidadeId'), exigirPerfil('admin_fpa'), async (req, res, next) => {
  try {
    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);
    const orcamento = await liberarReenvio(atual.id);
    res.json({ orcamento });
  } catch (err) { next(err); }
});

orcamentosRouter.post('/:unidadeId/aprovar', exigirUnidade('unidadeId'), exigirPerfil('admin_fpa'), async (req, res, next) => {
  try {
    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);
    const orcamento = await aprovar(atual.id, req.usuario.id);
    res.json({ orcamento });
  } catch (err) { next(err); }
});

orcamentosRouter.get('/:unidadeId/versoes', exigirUnidade('unidadeId'), async (req, res, next) => {
  try {
    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);
    res.json({ versoes: await listarVersoes(atual.id) });
  } catch (err) { next(err); }
});

/** Snapshot completo de uma versão específica — "abrir a versão enviada e
 * salva" (pedido de 2026-08-17). Mesmo escopo de acesso da unidade
 * (exigirUnidade): quem já vê o orçamento vê o histórico dele. */
orcamentosRouter.get('/:unidadeId/versoes/:versaoId', exigirUnidade('unidadeId'), async (req, res, next) => {
  try {
    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);
    const versao = await buscarVersao(atual.id, req.params.versaoId);
    if (!versao) return res.status(404).json({ erro: 'versao_nao_encontrada' });
    res.json({ versao });
  } catch (err) { next(err); }
});

orcamentosRouter.get('/:unidadeId/log', exigirUnidade('unidadeId'), exigirPerfil('admin_fpa', 'gerente_unidade'), async (req, res, next) => {
  try {
    res.json({ log: await listarLog(req.params.unidadeId) });
  } catch (err) { next(err); }
});
