// Registro central: qual plano de contas/pacotes/CCs cada unidade usa para
// computeDRE e companhia. Decisão de 2026-08-09: habilitar lançamento para
// Agrícola e Resorts usando os CCs genéricos da Têxtil como placeholder
// (ver constantesAgricolaResorts.js) — ARA EI continua de fora, sem plano de
// contas nenhum ainda (nem placeholder: não há dado-fonte pra basear um).
import { CCS_TEXTIL, PLANO_CONTAS, TODAS_CONTAS } from './constantesTextil.js';
import {
  CCS_AGRICOLA,
  PLANO_CONTAS_AGRICOLA, TODAS_CONTAS_AGRICOLA,
  CCS_RESORTS,
  PLANO_CONTAS_RESORTS, TODAS_CONTAS_RESORTS,
  CCS_CORPORATIVO, PLANO_CONTAS_CORPORATIVO, TODAS_CONTAS_CORPORATIVO,
} from './constantesAgricolaResorts.js';
import { CCS_EI, PLANO_CONTAS_EI, TODAS_CONTAS_EI, PACOTES_EI } from './constantesEI.js';

// ARA EI (2026-09-27): Holding, La Fleur II e South Bay com a mesma
// estrutura; 'ei' é o Consolidado. Espelho de REFERENCIA_POR_UNIDADE no frontend.
const REF_EI = { ccs: CCS_EI, todasContas: TODAS_CONTAS_EI, planoContas: PLANO_CONTAS_EI, pacotes: PACOTES_EI };

// Regras próprias da ARA Agrícola — espelho de REGRAS_AGRICOLA no frontend.
const REGRAS_AGRICOLA = { hcExistenteComDissidio: true, bonusSomenteElegiveis: true, dreSegueOrigemConta: true };

export const UNIDADES_ORCAMENTO = {
  textil: { ccs: CCS_TEXTIL, todasContas: TODAS_CONTAS, planoContas: PLANO_CONTAS },
  // Produção BG e Consolidado da Têxtil (2026-09-29): mesma estrutura da Produção Core.
  textil_bg: { ccs: CCS_TEXTIL, todasContas: TODAS_CONTAS, planoContas: PLANO_CONTAS },
  textil_consolidado: { ccs: CCS_TEXTIL, todasContas: TODAS_CONTAS, planoContas: PLANO_CONTAS },
  // Agrícola ganhou CC real em 2026-08-20 (Plano Centro de Custo.xlsx) — as
  // duas fazendas (agricola_tds/agricola_fds) usam a mesma estrutura de CC
  // e plano de contas. 'agricola' (sem sufixo, Consolidado) não é editada
  // direto, mas aparece aqui pra dreDaUnidade ter uma referência de
  // fallback e pra GET /agricola não quebrar antes do primeiro envio.
  agricola: { ccs: CCS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA, ...REGRAS_AGRICOLA },
  agricola_tds: { ccs: CCS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA, ...REGRAS_AGRICOLA, hcAberturaFazenda: 'tds' },
  agricola_fds: { ccs: CCS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA, ...REGRAS_AGRICOLA, hcAberturaFazenda: 'fds' },
  // Resorts ganhou CC real em 2026-08-20 (Centros de Custos - ARA Resorts
  // 1.xlsx) — mesmo padrão: samoa_beach/samoa_villa são os sites editáveis
  // (cada um só com os CCs que existem naquele resort, ver `resorts` em
  // CCS_RESORTS), 'resorts' é o Consolidado.
  resorts: { ccs: CCS_RESORTS, todasContas: TODAS_CONTAS_RESORTS, planoContas: PLANO_CONTAS_RESORTS },
  samoa_beach: { ccs: CCS_RESORTS.filter(cc => cc.resorts.includes('beach')), todasContas: TODAS_CONTAS_RESORTS, planoContas: PLANO_CONTAS_RESORTS },
  samoa_villa: { ccs: CCS_RESORTS.filter(cc => cc.resorts.includes('villa')), todasContas: TODAS_CONTAS_RESORTS, planoContas: PLANO_CONTAS_RESORTS },
  // LFCVH (2026-10-02): terceira unidade do Resorts, com todos os CCs do Resorts.
  lfcvh: { ccs: CCS_RESORTS, todasContas: TODAS_CONTAS_RESORTS, planoContas: PLANO_CONTAS_RESORTS },
  // Habilitada em 2026-08-16 — ver nota completa em constantesAgricolaResorts.js.
  corporativo: { ccs: CCS_CORPORATIVO, todasContas: TODAS_CONTAS_CORPORATIVO, planoContas: PLANO_CONTAS_CORPORATIVO },
  ei: REF_EI,
  ei_holding: REF_EI,
  ei_lafleur: REF_EI,
  ei_southbay: REF_EI,
};

export function buscarReferencia(unidadeId) {
  return UNIDADES_ORCAMENTO[unidadeId] || null;
}
