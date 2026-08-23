// Premissas macroeconômicas do ciclo (IPCA, Câmbio, Selic, PIB) — pedido de
// 2026-08-20, ver migração 0003_premissas_macro.sql. Leitura liberada pra
// qualquer usuário autenticado (todo gestor precisa ver o IPCA de
// referência); escrita só admin_fpa, mesma regra da tela "Gestão do
// Orçamento" no frontend (VisaoFPA) de onde isso é preenchido.
import { Router } from 'express';
import { exigirPerfil } from '../middleware/authorize.js';
import { listarPremissasMacro, atualizarPremissaMacro } from '../db/premissasMacro.js';

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
