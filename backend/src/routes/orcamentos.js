// Rotas de orçamento — seção 4 (autorização) e 4.5 (bloqueio pós-aprovação)
// da especificação. Toda rota passa por authenticate (fora daqui, no
// server.js) e por exigirUnidade, que rejeita (403) qualquer unidade_id fora
// do vínculo real do usuário no banco — nunca confia no que vem da URL.
import { Router } from 'express';
import { exigirUnidade, exigirPerfil } from '../middleware/authorize.js';
import { buscarOuCriarOrcamento, atualizarDadosComAuditoria, registrarEnvio, aprovar, listarVersoes } from '../db/orcamentos.js';
import { listarLog } from '../db/logAlteracoes.js';
import { computeDRE, computeDFC, computeFluxoIndiretoMensal, computeFluxoCaixaDiretoMensal, runAuditoria } from '../calc/orcamento.js';

export const orcamentosRouter = Router();

// ARA Agrícola, ARA Resorts e Corporativo ainda são painel de referência, sem
// formulário de lançamento (ver CLAUDE.md — pendência de dado-fonte: falta CC
// pareado para Agrícola/Resorts, falta De/Para de conta×CC para Corporativo).
// Isto é reforçado aqui, no servidor, e não só escondido na UI — mesma regra
// da seção 4 aplicada a uma pendência de dado, não só a escopo de usuário.
const UNIDADES_COM_LANCAMENTO_HABILITADO = ['textil'];

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

orcamentosRouter.get('/:unidadeId', exigirUnidade('unidadeId'), async (req, res, next) => {
  try {
    const orcamento = await buscarOuCriarOrcamento(req.params.unidadeId, ANO_ATUAL);
    const dre = computeDRE(orcamento.dados);
    res.json({
      orcamento,
      dre,
      dfc: computeDFC(orcamento.dados, dre),
      fluxoIndiretoMensal: computeFluxoIndiretoMensal(orcamento.dados, dre),
      fluxoDiretoMensal: computeFluxoCaixaDiretoMensal(orcamento.dados, dre),
      auditoria: runAuditoria(orcamento.dados, dre),
    });
  } catch (err) { next(err); }
});

orcamentosRouter.put('/:unidadeId', exigirUnidade('unidadeId'), exigirLancamentoHabilitado, async (req, res, next) => {
  try {
    const { dados, motivo } = req.body;
    if (!dados) return res.status(400).json({ erro: 'dados_obrigatorio' });

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
    const dre = computeDRE(atual.dados);
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
