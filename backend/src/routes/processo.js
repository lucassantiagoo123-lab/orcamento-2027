// Etapas do processo orçamentário e backlog de envios (histórico
// consolidado entre unidades) — telas de gestão do processo do FP&A, pedido
// de 2026-08-23. Ver migração 0004_etapas_processo.sql e
// db/orcamentos.js::listarVersoesRecentesTodasUnidades.
import { Router } from 'express';
import { exigirPerfil } from '../middleware/authorize.js';
import { listarEtapasProcesso, atualizarEtapaProcesso } from '../db/etapasProcesso.js';
import { listarVersoesRecentesTodasUnidades } from '../db/orcamentos.js';
import { listarSessoesEdicaoTodasUnidades } from '../db/logAlteracoes.js';

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
//
// Pedido de 2026-09-08: "o backlog de alterações precisa registrar todas
// edições realizadas por usuário" — até aqui só listava envios de versão
// (registrarEnvio). Passa a combinar dois tipos, cada um com `tipo` pro
// frontend diferenciar: 'envio' (uma versão enviada — como já era) e
// 'edicao' (uma sessão de edição agrupada, ver
// listarSessoesEdicaoTodasUnidades — log_alteracoes grava uma linha a cada
// autosave, então listar cru inundaria a tela). Junta os dois, ordena pela
// mesma data (enviado_em ou fim da sessão) e corta no limite combinado.
processoRouter.get('/backlog', exigirPerfil('admin_fpa'), async (req, res, next) => {
  try {
    const [envios, edicoes] = await Promise.all([
      listarVersoesRecentesTodasUnidades(),
      listarSessoesEdicaoTodasUnidades(),
    ]);
    const combinado = [
      ...envios.map(e => ({ tipo: 'envio', data: e.enviado_em, item: e })),
      ...edicoes.map(e => ({ tipo: 'edicao', data: e.fim, item: e })),
    ]
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 200);
    res.json({ backlog: combinado });
  } catch (err) { next(err); }
});
