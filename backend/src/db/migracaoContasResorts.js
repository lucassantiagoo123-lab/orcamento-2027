import { pool } from './pool.js';
import { atualizarDadosComAuditoria } from './orcamentos.js';

const ANO_ATUAL = 2027;
const UNIDADES_RESORTS = ['samoa_beach', 'samoa_villa'];

// Migração de plano de contas Resorts (2026-09-07) — ver PLANO_CONTAS_RESORTS
// em frontend/src/OrcamentoARA.jsx para o histórico completo. Achado: 158
// das 260 contas do plano de contas dos Resorts eram, na verdade, contas da
// Têxtil/Agrícola (mesmo código 71xxx/72xxx/34xxx usado nos planos delas) —
// contaminação identificada a partir da "Visão consolidada" mostrando
// MATERIA PRIMA FIO/MALHARIA/BENEFICIAMENTO (contas têxteis) dentro do
// pacote Produção dos Resorts. Cruzando com o "Plano de Contas Resorts.xlsb"
// oficial (fornecido pelo usuário em 2026-09-07): as contas genuínas dos
// Resorts usam sempre código 41xxx/51xxx.
//
// Antes de remover as 158 contas contaminadas do PLANO_CONTAS_RESORTS, esta
// migração move os valores JÁ PREENCHIDOS (100% dos dados de Samoa Beach e
// Samoa Villa até esta data usavam contas contaminadas — confirmado via
// export "Dados Brutos" de cada unidade) para as contas genuínas
// equivalentes. Cada regra abaixo foi conferida uma a uma com o usuário:
//  - Mesmo nome em código diferente (Manutenção de Veículos, Fretes e
//    Carretos): mapeamento direto, sem ambiguidade.
//  - "MATERIAL DE USO E CONSUMO" (34104033) era usada como balde genérico
//    pros Resorts — dividida pela descrição de cada sublinha entre as
//    contas genuínas específicas (Limpeza/Descartável/Utensílios/Escritório).
//  - "A&B"/"Alimentos e Bebidas" sob um CC de despesa (Almoxarifado): não
//    existe conta genuína dedicada pra insumo de A&B como despesa (só como
//    Custo, em outro CC) — usuário escolheu usar DIVERSOS (410307280) como
//    destino genérico em vez de inventar um código novo sem fonte.
//  - "SERVICOS DE TERCEIROS - PJ" (34202010) — idem, balde genérico dividido
//    por descrição. "Mensalidade Associação ABIH" foi pra ASSOCIACAO DE
//    CLASSE (410307170), que vive no pacote Impostos (não Serviços) —
//    usuário confirmou explicitamente a mudança de pacote.
const REGRAS = [
  { contaAntiga: '34202004', contaNova: '410304010' }, // MANUTENCAO DE VEICULOS (mesmo nome)
  { contaAntiga: '34104009', contaNova: '410301010' }, // MATERIAL DE EXPEDIENTE -> MATERIAL DE ESCRITORIO
  { contaAntiga: '34104001', contaNova: '410307060' }, // FRETES E CARRETOS (mesmo nome)
  { contaAntiga: '34104027', contaNova: '410307100' }, // LOCACAO DE MAQ E EQUIPAMENTOS -> LOCACOES
  { contaAntiga: '34104033', contaNova: '410301030', contem: ['limpeza'] },
  { contaAntiga: '34104033', contaNova: '410301090', contem: ['descart'] },
  { contaAntiga: '34104033', contaNova: '410301120', contem: ['utensil', 'utensíl'] },
  { contaAntiga: '34104033', contaNova: '410301010', contem: ['escrit'] },
  { contaAntiga: '34104033', contaNova: '410307280', contem: ['a&b', 'aliment'] }, // decisão do usuário: opção "a"
  { contaAntiga: '34202010', contaNova: '410307030', contem: ['gráfic', 'grafic'] },
  { contaAntiga: '34202010', contaNova: '410302010', contem: ['pegasus'] },
  { contaAntiga: '34202010', contaNova: '410307010', contem: ['cronos'] },
  { contaAntiga: '34202010', contaNova: '410307170', contem: ['abih'] }, // muda de pacote (Serviços -> Impostos), confirmado
];

function somaValores(sub) {
  return (sub?.valores || []).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
}

/** Soma bruta de tudo que está em custos.linhas, não só o que foi migrado —
 * é a checagem de verdade (antes/depois têm que bater ao centavo, já que a
 * migração só move sublinhas, nunca cria/edita/apaga valor). */
function totalGeralLinhas(linhas) {
  let total = 0;
  for (const contaRaw of Object.values(linhas || {})) {
    const sublinhas = Array.isArray(contaRaw?.sublinhas) ? contaRaw.sublinhas : [contaRaw];
    for (const sub of sublinhas) total += somaValores(sub);
  }
  return Math.round(total * 100) / 100;
}

function migrarDados(dados) {
  const linhasOriginais = dados?.custos?.linhas || {};
  const linhas = { ...linhasOriginais };
  const movimentos = [];
  const naoMapeadas = [];

  for (const [chave, contaRaw] of Object.entries(linhasOriginais)) {
    const [ccCodigo, contaCodigo] = chave.split('|');
    const regrasDaConta = REGRAS.filter(r => r.contaAntiga === contaCodigo);
    if (regrasDaConta.length === 0) continue;

    const conta = Array.isArray(contaRaw?.sublinhas)
      ? contaRaw
      : { classificacao: contaRaw?.classificacao || 'fixo', sublinhas: [{ ...contaRaw, id: contaRaw?.id || 'legacy' }] };

    const restantes = [];
    for (const sub of conta.sublinhas) {
      const desc = (sub.descricao || '').toLowerCase();
      const regra = regrasDaConta.find(r => !r.contem || r.contem.some(s => desc.includes(s)));
      if (!regra) {
        restantes.push(sub);
        naoMapeadas.push({ ccCodigo, contaCodigo, descricao: sub.descricao || '(sem descrição)' });
        continue;
      }
      const novaChave = `${ccCodigo}|${regra.contaNova}`;
      const jaExiste = linhas[novaChave] && Array.isArray(linhas[novaChave].sublinhas);
      linhas[novaChave] = jaExiste
        ? { ...linhas[novaChave], sublinhas: [...linhas[novaChave].sublinhas, sub] }
        : { classificacao: conta.classificacao || 'fixo', sublinhas: [sub] };
      movimentos.push({
        ccCodigo, contaAntiga: contaCodigo, contaNova: regra.contaNova,
        descricao: sub.descricao || '', valorTotal: Math.round(somaValores(sub) * 100) / 100,
      });
    }

    if (restantes.length > 0) {
      linhas[chave] = { ...conta, sublinhas: restantes };
    } else {
      delete linhas[chave];
    }
  }

  const dadosNovos = { ...dados, custos: { ...dados.custos, linhas } };
  return { dadosNovos, movimentos, naoMapeadas };
}

/** Roda a migração para Samoa Beach e Samoa Villa. `aplicar: false` (padrão)
 * só simula e devolve o relatório, sem gravar nada — usar sempre primeiro.
 * `aplicar: true` grava via atualizarDadosComAuditoria (mesmo caminho
 * auditado de uma edição normal, gera linha em log_alteracoes). */
export async function migrarPlanoContasResorts({ aplicar = false, usuarioId } = {}) {
  const resultado = { aplicado: !!aplicar, unidades: [] };

  for (const unidadeId of UNIDADES_RESORTS) {
    const { rows } = await pool.query(
      `SELECT * FROM orcamentos WHERE unidade_id = $1 AND ano = $2`,
      [unidadeId, ANO_ATUAL]
    );
    const orcamento = rows[0];
    if (!orcamento) {
      resultado.unidades.push({ unidadeId, encontrado: false });
      continue;
    }

    const { dadosNovos, movimentos, naoMapeadas } = migrarDados(orcamento.dados);
    const totalAntes = totalGeralLinhas(orcamento.dados?.custos?.linhas);
    const totalDepois = totalGeralLinhas(dadosNovos.custos.linhas);

    resultado.unidades.push({
      unidadeId,
      encontrado: true,
      totalMovimentos: movimentos.length,
      totalGeralAntes: totalAntes,
      totalGeralDepois: totalDepois,
      bateCerto: Math.abs(totalAntes - totalDepois) < 0.01,
      movimentos,
      naoMapeadas,
    });

    if (aplicar && movimentos.length > 0) {
      await atualizarDadosComAuditoria({
        orcamentoAntes: orcamento,
        dadosNovos,
        usuarioId,
        motivo: 'Migração de plano de contas Resorts — contas contaminadas da Têxtil/Agrícola para as contas genuínas equivalentes (2026-09-07)',
      });
    }
  }

  return resultado;
}
