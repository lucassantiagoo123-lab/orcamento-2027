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
  return false; // gerente_cc_corporativo não acessa por unidade, só por CC dentro do Corporativo
}

export function podeAcessarCc(usuario, ccCodigo) {
  if (usuario.perfil === 'admin_fpa') return true;
  if (usuario.perfil === 'gerente_cc_corporativo') return usuario.ccsPermitidos.includes(ccCodigo);
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

/** Idem, para cc_codigo dentro do Corporativo. */
export function exigirCc(param = 'ccCodigo') {
  return (req, res, next) => {
    const ccCodigo = req.params[param];
    if (!podeAcessarCc(req.usuario, ccCodigo)) {
      return res.status(403).json({ erro: 'fora_de_escopo', mensagem: `Sem acesso ao CC ${ccCodigo}.` });
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
