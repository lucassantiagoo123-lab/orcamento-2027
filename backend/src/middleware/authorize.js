// Primitivas de autorização de escopo (seção 4 da especificação). Ficam aqui,
// ao lado de authenticate.js, porque authenticate já carrega req.usuario com
// unidadesPermitidas/ccsPermitidos resolvidos do banco — mas a aplicação nas
// rotas de orçamento (checar :unidade_id / :cc_codigo de cada request) é da
// Fase 3, junto com o resto da API. Import antecipado para não duplicar esta
// lógica quando as rotas de orçamento forem escritas.

/** admin_fpa não tem filtro de escopo (seção 4.3) — mas isso é decidido aqui,
 * de um jeito só, para toda rota, em vez de cada rota reimplementar o bypass. */
export function podeAcessarUnidade(usuario, unidadeId) {
  if (usuario.perfil === 'admin_fpa') return true;
  if (usuario.perfil === 'gerente_unidade') return usuario.unidadesPermitidas.includes(unidadeId);
  return false; // Gestor de CC não acessa a unidade inteira, só o seu CC (ver podeAcessarCc)
}

/** Gestor de CC (perfil gerente_cc_corporativo, rebatizado de "Gerente de CC
 * — Corporativo" em 2026-08-16) — hoje pode estar vinculado a qualquer
 * unidade, não só Corporativo, então precisa bater unidade E código (o
 * mesmo código de CC se repete entre Têxtil/Agrícola/Resorts, que
 * reaproveitam a mesma lista de CCs). Concessões temporárias (seção 4.4)
 * continuam com unidadeId: null — valem em qualquer unidade. */
export function podeAcessarCc(usuario, unidadeId, ccCodigo) {
  if (usuario.perfil === 'admin_fpa') return true;
  if (usuario.perfil === 'gerente_cc_corporativo') {
    return usuario.ccsPermitidos.some((c) => c.codigo === ccCodigo && (c.unidadeId === null || c.unidadeId === unidadeId));
  }
  return false;
}

/** Middleware factory: rejeita (403) se req.params[param] (um unidade_id) não
 * estiver no escopo do usuário autenticado. Uso: router.get('/unidades/:unidadeId/orcamento', authenticate, exigirUnidade('unidadeId'), handler) */
export function exigirUnidade(param = 'unidadeId') {
  return (req, res, next) => {
    const unidadeId = req.params[param];
    if (!podeAcessarUnidade(req.usuario, unidadeId)) {
      return res.status(403).json({ erro: 'fora_de_escopo', mensagem: `Sem acesso à unidade ${unidadeId}.` });
    }
    next();
  };
}

/** Idem, para cc_codigo — exige também o unidade_id da rota (ver nota em
 * podeAcessarCc sobre colisão de código de CC entre unidades). */
export function exigirCc(unidadeParam = 'unidadeId', ccParam = 'ccCodigo') {
  return (req, res, next) => {
    const unidadeId = req.params[unidadeParam];
    const ccCodigo = req.params[ccParam];
    if (!podeAcessarCc(req.usuario, unidadeId, ccCodigo)) {
      return res.status(403).json({ erro: 'fora_de_escopo', mensagem: `Sem acesso ao CC ${ccCodigo} em ${unidadeId}.` });
    }
    next();
  };
}

/** Restringe a rota a um conjunto de perfis (ex.: gerenciar usuários, aprovar
 * etapa, corrigir De/Para — tudo exclusivo admin_fpa, seção 2.4). */
export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'perfil_insuficiente' });
    }
    next();
  };
}
