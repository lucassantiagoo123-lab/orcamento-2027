import { apiFetch } from './client.js';

/** { orcamento, dre, dfc, fluxoIndiretoMensal, fluxoDiretoMensal, auditoria } */
export function getOrcamento(unidadeId) {
  return apiFetch(`/api/orcamentos/${unidadeId}`);
}

/** motivo é obrigatório só quando o orçamento já está aprovado/bloqueado
 * (seção 4.5) — o backend rejeita com 400 se faltar nesse caso. */
export function putOrcamento(unidadeId, dados, motivo) {
  return apiFetch(`/api/orcamentos/${unidadeId}`, {
    method: 'PUT',
    body: { dados, motivo },
  });
}

export function enviarVersao(unidadeId, comentario) {
  return apiFetch(`/api/orcamentos/${unidadeId}/enviar`, {
    method: 'POST',
    body: { comentario },
  });
}

export function aprovar(unidadeId) {
  return apiFetch(`/api/orcamentos/${unidadeId}/aprovar`, { method: 'POST' });
}

// Admin FP&A libera o botão "Enviar versão" de novo (pedido de 2026-08-16 —
// depois de um envio, fica travado até essa ação).
export function liberarReenvio(unidadeId) {
  return apiFetch(`/api/orcamentos/${unidadeId}/liberar-reenvio`, { method: 'POST' });
}

// Mapeia { versoes: [{ id, autor_nome, comentario, totais, enviado_em }] }
// (formato da API) para { id, timestamp, autor, comentario, totais } (formato
// que o protótipo já usa em VisaoFPA/AbaRevisao) — evita reescrever quem
// consome `versoes`. `totais` aqui é o subconjunto { receitaLiquida, ebitda,
// lucroLiquido } gravado em orcamento_versoes.totais (ver db/orcamentos.js),
// menor que o objeto DRE completo que o protótipo produzia localmente — telas
// que só leem essas três chaves continuam funcionando.
export async function listarVersoes(unidadeId) {
  const { versoes } = await apiFetch(`/api/orcamentos/${unidadeId}/versoes`);
  return versoes.map(v => ({
    id: v.id,
    timestamp: v.enviado_em,
    autor: v.autor_nome,
    comentario: v.comentario,
    totais: v.totais,
  }));
}

export function listarLog(unidadeId) {
  return apiFetch(`/api/orcamentos/${unidadeId}/log`);
}
