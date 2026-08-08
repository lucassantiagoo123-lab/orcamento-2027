// Rotas de administração — gestão de usuários/vínculos e concessões
// temporárias (seções 2.4 e 4.4). Toda rota exige admin_fpa: quem monta o
// router (server.js) já aplica authenticate; aqui aplicamos exigirPerfil.
import { Router } from 'express';
import { exigirPerfil } from '../middleware/authorize.js';
import {
  listarUsuarios, criarUsuario, atualizarUsuario,
  vincularUnidade, desvincularUnidade, vincularCc, desvincularCc,
  listarConcessoes, criarConcessao, revogarConcessao,
} from '../db/admin.js';

export const adminRouter = Router();
adminRouter.use(exigirPerfil('admin_fpa'));

const PERFIS_VALIDOS = ['admin_fpa', 'gerente_unidade', 'gerente_cc_corporativo'];

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

adminRouter.patch('/usuarios/:id', async (req, res, next) => {
  try {
    const { perfil, ativo } = req.body;
    if (perfil !== undefined && !PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ erro: 'perfil_invalido' });
    }
    // Seção 6, teste 6: usuário desativado perde acesso na hora — não exige
    // nada além disto, porque authenticate.js já busca `ativo` do banco a
    // cada request (não confia em nada cacheado na sessão).
    const usuario = await atualizarUsuario(req.params.id, { perfil, ativo });
    if (!usuario) return res.status(404).json({ erro: 'usuario_nao_encontrado' });
    res.json({ usuario });
  } catch (err) { next(err); }
});

adminRouter.post('/usuarios/:id/unidades', async (req, res, next) => {
  try {
    const { unidadeId } = req.body;
    if (!unidadeId) return res.status(400).json({ erro: 'unidadeId_obrigatorio' });
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

adminRouter.post('/usuarios/:id/ccs', async (req, res, next) => {
  try {
    const { ccCodigo } = req.body;
    if (!ccCodigo) return res.status(400).json({ erro: 'ccCodigo_obrigatorio' });
    await vincularCc(req.params.id, ccCodigo);
    res.status(204).end();
  } catch (err) { next(err); }
});
adminRouter.delete('/usuarios/:id/ccs/:ccCodigo', async (req, res, next) => {
  try {
    await desvincularCc(req.params.id, req.params.ccCodigo);
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
