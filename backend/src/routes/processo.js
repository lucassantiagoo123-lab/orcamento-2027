// Etapas do processo orçamentário e backlog de envios (histórico
// consolidado entre unidades) — telas de gestão do processo do FP&A, pedido
// de 2026-08-23. Ver migração 0004_etapas_processo.sql e
// db/orcamentos.js::listarVersoesRecentesTodasUnidades.
import { Router } from 'express';
import { exigirPerfil } from '../middleware/authorize.js';
import { listarEtapasProcesso, atualizarEtapaProcesso } from '../db/etapasProcesso.js';
import { listarVersoesRecentesTodasUnidades } from '../db/orcamentos.js';

export const processoRouter = Router();

// Leitura liberada a qualquer usuário autenticado — datas do cronograma não
// são sensíveis (mesma regra de premissas_macro).
processoRouter.get('/etapas', async (req, res, next) => {
  try {
    res.json({ etapas: await listarEtapasProcesso() });
  } catch (err) { next(err); }
});

// Escrita só admin_fpa — mesma tela (VisaoFPA) que já é exclusiva desse
// perfil no frontend, reforçada aqui no servidor.
processoRouter.put('/etapas/:id', exigirPerfil('admin_fpa'), async (req, res, next) => {
  try {
    const { inicio, fim } = req.body;
    const etapa = await atualizarEtapaProcesso(req.params.id, inicio, fim, req.usuario.id);
    res.json({ etapa });
  } catch (err) { next(err); }
});

// Backlog cruza totais de todas as unidades — mais sensível que as datas do
// cronograma, então só admin_fpa também na leitura (mesmo perfil que já é
// o único a enxergar essa lista no frontend, ver VisaoFPA).
processoRouter.get('/backlog', exigirPerfil('admin_fpa'), async (req, res, next) => {
  try {
    res.json({ backlog: await listarVersoesRecentesTodasUnidades() });
  } catch (err) { next(err); }
});
