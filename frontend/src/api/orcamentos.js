import { apiFetch } from './client.js';

/** { orcamento, dre, dfc, fluxoIndiretoMensal, fluxoDiretoMensal, auditoria } */
export function getOrcamento(unidadeId) {
  return apiFetch(`/api/orcamentos/${unidadeId}`);
}

/** motivo é obrigatório só quando o orçamento já está aprovado/bloqueado
 * (seção 4.5) — o backend rejeita com 400 se faltar nesse caso.
 * dadosBase (ver backend/src/db/mesclarDados.js): o documento que este
 * navegador tinha quando carregou/salvou pela última vez. O servidor aplica
 * só o que mudou entre dadosBase e dados, por cima do que está no banco —
 * nunca apaga edição simultânea de outro usuário. Sem dadosBase, o backend
 * substitui o documento (usado só pelo snapshot do Consolidado). */
export function putOrcamento(unidadeId, dados, motivo, dadosBase) {
  return apiFetch(`/api/orcamentos/${unidadeId}`, {
    method: 'PUT',
    body: { dados, motivo, dadosBase },
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

// Snapshot completo (com `dados`) de uma versão específica — "abrir a
// versão enviada e salva" (pedido de 2026-08-17).
export async function buscarVersao(unidadeId, versaoId) {
  const { versao } = await apiFetch(`/api/orcamentos/${unidadeId}/versoes/${versaoId}`);
  return versao;
}

// Referência 2026 (somente leitura) e conclusão de CC — o servidor já devolve
// só os CCs que o usuário pode ver (Gestor de CC: os dele).
export async function getReferencia2026(unidadeId) {
  const { linhas } = await apiFetch(`/api/orcamentos/${unidadeId}/referencia-2026`);
  return linhas;
}
export async function getConclusoesCc(unidadeId) {
  const { conclusoes } = await apiFetch(`/api/orcamentos/${unidadeId}/conclusao-cc`);
  return conclusoes;
}
export async function concluirCc(unidadeId, ccCodigo) {
  const { conclusoes } = await apiFetch(`/api/orcamentos/${unidadeId}/cc/${encodeURIComponent(ccCodigo)}/concluir`, { method: 'POST' });
  return conclusoes;
}
// Só Admin FP&A.
export async function liberarCc(unidadeId, ccCodigo) {
  const { conclusoes } = await apiFetch(`/api/orcamentos/${unidadeId}/cc/${encodeURIComponent(ccCodigo)}/liberar`, { method: 'POST' });
  return conclusoes;
}

// Notas de ajustes gerenciais da unidade — só Admin FP&A.
export async function getNotasGerenciais(unidadeId) {
  const { notas } = await apiFetch(`/api/orcamentos/${unidadeId}/notas-gerenciais`);
  return notas;
}

// Cadastro que o servidor usa na unidade (só Admin FP&A) — para a conferência front × servidor.
export function getCadastroServidor(unidadeId) {
  return apiFetch(`/api/orcamentos/${unidadeId}/cadastro`);
}

// Referência DRE 2026 da unidade (migração 0024) — null quando não há dado
// (ou para Gestor de CC). Resorts Consolidado = Beach + Villa + LFCVH.
export async function getReferenciaDre2026(unidadeId) {
  const { referencia } = await apiFetch(`/api/orcamentos/${unidadeId}/referencia-dre-2026`);
  return referencia;
}
