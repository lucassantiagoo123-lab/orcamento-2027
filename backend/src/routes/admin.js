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
import { definirSenha } from '../db/usuarios.js';
import { validarSenha, gerarHashSenha } from '../auth/senha.js';

export const adminRouter = Router();
adminRouter.use(exigirPerfil('admin_fpa'));

const PERFIS_VALIDOS = ['admin_fpa', 'gerente_unidade', 'gerente_cc_corporativo'];
// Rebatizado de "Gerente de CC (Corporativo)" para "Gestor de CC" em
// 2026-08-16 — id interno gerente_cc_corporativo mantido (evita migrar o
// CHECK constraint do enum em produção), mas agora vale para qualquer
// unidade, não só Corporativo.
const UNIDADES_VALIDAS = ['textil', 'agricola', 'resorts', 'ei', 'energia', 'corporativo'];

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

    await definirSenha(req.params.id, await gerarHashSenha(senha));
    res.status(204).end();
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
