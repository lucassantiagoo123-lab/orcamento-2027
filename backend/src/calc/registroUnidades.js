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

export const UNIDADES_ORCAMENTO = {
  textil: { ccs: CCS_TEXTIL, todasContas: TODAS_CONTAS, planoContas: PLANO_CONTAS },
  // Agrícola ganhou CC real em 2026-08-20 (Plano Centro de Custo.xlsx) — as
  // duas fazendas (agricola_tds/agricola_fds) usam a mesma estrutura de CC
  // e plano de contas. 'agricola' (sem sufixo, Consolidado) não é editada
  // direto, mas aparece aqui pra dreDaUnidade ter uma referência de
  // fallback e pra GET /agricola não quebrar antes do primeiro envio.
  agricola: { ccs: CCS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA },
  agricola_tds: { ccs: CCS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA },
  agricola_fds: { ccs: CCS_AGRICOLA, todasContas: TODAS_CONTAS_AGRICOLA, planoContas: PLANO_CONTAS_AGRICOLA },
  // Resorts ganhou CC real em 2026-08-20 (Centros de Custos - ARA Resorts
  // 1.xlsx) — mesmo padrão: samoa_beach/samoa_villa são os sites editáveis
  // (cada um só com os CCs que existem naquele resort, ver `resorts` em
  // CCS_RESORTS), 'resorts' é o Consolidado.
  resorts: { ccs: CCS_RESORTS, todasContas: TODAS_CONTAS_RESORTS, planoContas: PLANO_CONTAS_RESORTS },
  samoa_beach: { ccs: CCS_RESORTS.filter(cc => cc.resorts.includes('beach')), todasContas: TODAS_CONTAS_RESORTS, planoContas: PLANO_CONTAS_RESORTS },
  samoa_villa: { ccs: CCS_RESORTS.filter(cc => cc.resorts.includes('villa')), todasContas: TODAS_CONTAS_RESORTS, planoContas: PLANO_CONTAS_RESORTS },
  // Habilitada em 2026-08-16 — ver nota completa em constantesAgricolaResorts.js.
  corporativo: { ccs: CCS_CORPORATIVO, todasContas: TODAS_CONTAS_CORPORATIVO, planoContas: PLANO_CONTAS_CORPORATIVO },
};

export function buscarReferencia(unidadeId) {
  return UNIDADES_ORCAMENTO[unidadeId] || null;
}
