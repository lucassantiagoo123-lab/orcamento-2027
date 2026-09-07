// Premissas macroeconômicas do ciclo (IPCA, Câmbio, Selic, PIB) — pedido de
// 2026-08-20, ver migração 0003_premissas_macro.sql. Leitura liberada pra
// qualquer usuário autenticado (todo gestor precisa ver o IPCA de
// referência); escrita só admin_fpa, mesma regra da tela "Gestão do
// Orçamento" no frontend (VisaoFPA) de onde isso é preenchido.
import { Router } from 'express';
import multer from 'multer';
import { exigirPerfil } from '../middleware/authorize.js';
import { listarPremissasMacro, atualizarPremissaMacro, definirFontePremissaMacro } from '../db/premissasMacro.js';
import { salvarBoletimFocusPdf, buscarBoletimFocusPdfMeta, buscarBoletimFocusPdfArquivo } from '../db/boletimFocusPdf.js';

export const premissasMacroRouter = Router();

premissasMacroRouter.get('/', async (req, res, next) => {
  try {
    res.json({ premissas: await listarPremissasMacro() });
  } catch (err) { next(err); }
});

premissasMacroRouter.put('/:id', exigirPerfil('admin_fpa'), async (req, res, next) => {
  try {
    const { valor, fonte } = req.body;
    const premissa = await atualizarPremissaMacro(req.params.id, valor ?? '', fonte, req.usuario.id);
    res.json({ premissa });
  } catch (err) { next(err); }
});

/** Só a etiqueta de "Fonte" — pedido de 2026-09-07: "mantenha a data e hora
 * da atualização" (não passa por atualizarPremissaMacro de propósito, que
 * sempre mexe em atualizado_em). Ver definirFontePremissaMacro. */
premissasMacroRouter.patch('/:id/fonte', exigirPerfil('admin_fpa'), async (req, res, next) => {
  try {
    const { fonte } = req.body || {};
    if (!fonte) return res.status(400).json({ erro: 'fonte_obrigatoria' });
    const premissa = await definirFontePremissaMacro(req.params.id, fonte);
    res.json({ premissa });
  } catch (err) { next(err); }
});

// Boletim Focus (PDF, pedido de 2026-09-07): substitui o antigo botão
// "Atualizar do Boletim Focus (BCB)" (fetch direto na API do BCB a partir
// do navegador, que nunca funcionava neste ambiente) por um PDF enviado à
// mão, guardado só como referência — ninguém extrai valor automaticamente
// dele, os campos de IPCA/Câmbio/Selic/PIB acima continuam 100% manuais.
// Leitura liberada pra qualquer autenticado (mesma regra dos valores de
// premissas); só admin_fpa envia um PDF novo (substitui o anterior).
const uploadBoletimFocus = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('apenas_pdf'));
    cb(null, true);
  },
});

premissasMacroRouter.get('/boletim-focus-pdf', async (req, res, next) => {
  try {
    res.json({ arquivo: await buscarBoletimFocusPdfMeta() });
  } catch (err) { next(err); }
});

premissasMacroRouter.get('/boletim-focus-pdf/arquivo', async (req, res, next) => {
  try {
    const arq = await buscarBoletimFocusPdfArquivo();
    if (!arq) return res.status(404).json({ erro: 'nenhum_pdf_enviado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${arq.nome_arquivo.replace(/"/g, '')}"`);
    res.send(arq.conteudo);
  } catch (err) { next(err); }
});

premissasMacroRouter.post('/boletim-focus-pdf', exigirPerfil('admin_fpa'), (req, res, next) => {
  uploadBoletimFocus.single('arquivo')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erro: 'arquivo_muito_grande', mensagem: 'O PDF precisa ter até 20MB.' });
      if (err.message === 'apenas_pdf') return res.status(400).json({ erro: 'apenas_pdf', mensagem: 'Envie um arquivo PDF.' });
      return next(err);
    }
    try {
      if (!req.file) return res.status(400).json({ erro: 'arquivo_obrigatorio' });
      const arquivo = await salvarBoletimFocusPdf({
        nomeArquivo: req.file.originalname,
        conteudo: req.file.buffer,
        tamanhoBytes: req.file.size,
        usuarioId: req.usuario.id,
      });
      res.status(201).json({ arquivo });
    } catch (e) { next(e); }
  });
});
