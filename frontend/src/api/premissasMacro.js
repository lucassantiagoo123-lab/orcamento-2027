import { apiFetch } from './client.js';

// Premissas macroeconômicas do ciclo (IPCA, Câmbio, Selic, PIB) — pedido de
// 2026-08-20, antes só vivia em estado local do navegador (ver
// backend/db/migrations/0003_premissas_macro.sql pra contexto completo).
export async function listarPremissasMacro() {
  const { premissas } = await apiFetch('/api/premissas-macro');
  return premissas;
}

export async function atualizarPremissaMacro(id, valor, fonte) {
  const { premissa } = await apiFetch(`/api/premissas-macro/${id}`, {
    method: 'PUT',
    body: { valor, fonte },
  });
  return premissa;
}

// Boletim Focus (PDF de referência, pedido de 2026-09-07) — substitui o
// antigo botão de buscar direto na API do BCB (nunca funcionava a partir do
// navegador neste ambiente). Só guarda o PDF pra consulta manual — nenhum
// valor é extraído automaticamente dele.
export async function buscarBoletimFocusPdfMeta() {
  const { arquivo } = await apiFetch('/api/premissas-macro/boletim-focus-pdf');
  return arquivo;
}

export async function enviarBoletimFocusPdf(arquivo) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  const { arquivo: meta } = await apiFetch('/api/premissas-macro/boletim-focus-pdf', {
    method: 'POST',
    body: formData,
  });
  return meta;
}

// URL pra abrir/baixar o PDF direto (usada num <a>, não via apiFetch) —
// o cookie de sessão já vai junto pela navegação normal do navegador.
export function urlBoletimFocusPdf() {
  return '/api/premissas-macro/boletim-focus-pdf/arquivo';
}
