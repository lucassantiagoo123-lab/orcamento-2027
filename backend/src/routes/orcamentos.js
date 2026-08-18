// Rotas de orçamento — seção 4 (autorização) e 4.5 (bloqueio pós-aprovação)
// da especificação. Toda rota passa por authenticate (fora daqui, no
// server.js) e por exigirUnidade, que rejeita (403) qualquer unidade_id fora
// do vínculo real do usuário no banco — nunca confia no que vem da URL.
import { Router } from 'express';
import { exigirUnidade, exigirPerfil } from '../middleware/authorize.js';
import { buscarOuCriarOrcamento, atualizarDadosComAuditoria, registrarEnvio, aprovar, listarVersoes } from '../db/orcamentos.js';
import { listarLog } from '../db/logAlteracoes.js';
import { computeDRE, computeDFC, computeFluxoIndiretoMensal, computeFluxoCaixaDiretoMensal, runAuditoria } from '../calc/orcamento.js';
import { buscarReferencia } from '../calc/registroUnidades.js';

export const orcamentosRouter = Router();

// ARA Agrícola e ARA Resorts habilitadas em 2026-08-09, usando um CC
// placeholder (ver calc/constantesAgricolaResorts.js) até a planilha real. O
// Corporativo continua painel de referência (falta De/Para de conta×CC —
// pendência diferente, sem solução de placeholder por enquanto); ARA EI
// segue de fora também (nem plano de contas ela tem ainda).
// Isto é reforçado aqui, no servidor, e não só escondido na UI — mesma regra
// da seção 4 aplicada a uma pendência de dado, não só a escopo de usuário.
const UNIDADES_COM_LANCAMENTO_HABILITADO = ['textil', 'agricola', 'resorts'];

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
    const dre = computeDRE(orcamento.dados, ref);
    res.json({
      orcamento,
      dre,
      dfc: computeDFC(orcamento.dados, dre),
      fluxoIndiretoMensal: computeFluxoIndiretoMensal(orcamento.dados, dre, ref),
      fluxoDiretoMensal: computeFluxoCaixaDiretoMensal(orcamento.dados, dre, ref),
      auditoria: runAuditoria(orcamento.dados, dre, ref),
    });
  } catch (err) { next(err); }
});

orcamentosRouter.put('/:unidadeId', exigirUnidade('unidadeId'), exigirLancamentoHabilitado, async (req, res, next) => {
  try {
    const { dados, motivo } = req.body;
    if (!dados) return res.status(400).json({ erro: 'dados_obrigatorio' });

    const erroEscopo = validarEscritaCcCustos(req.usuario, req.params.unidadeId, dados);
    if (erroEscopo) return res.status(403).json({ erro: 'fora_de_escopo', mensagem: erroEscopo });

    const atual = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);

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
    const ref = buscarReferencia(req.params.unidadeId) || REF_VAZIA;
    const dre = computeDRE(atual.dados, ref);
    const totais = { receitaLiquida: dre.receitaLiquida, ebitda: dre.ebitda, lucroLiquido: dre.lucroLiquido };
    const { orcamento, versao } = await registrarEnvio(atual.id, atual.dados, req.usuario.id, req.body.comentario, totais);
    res.json({ orcamento, versao });
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

orcamentosRouter.get('/:unidadeId/log', exigirUnidade('unidadeId'), exigirPerfil('admin_fpa', 'gerente_unidade'), async (req, res, next) => {
  try {
    res.json({ log: await listarLog(req.params.unidadeId) });
  } catch (err) { next(err); }
});
