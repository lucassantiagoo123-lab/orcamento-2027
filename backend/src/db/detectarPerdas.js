// Detecta, num save, remoções/reduções que parecem perda de dado e não
// edição normal. Puro (sem I/O). Regras pensadas para não disparar com a
// digitação do dia a dia (apagar dígitos de um valor reduz o total a cada
// autosave) — só com o padrão dos incidentes de 22–23/set:
//  - Gestor de CC alterando/removendo projeto de CapEx de CC que não é dele
//  - 2+ projetos de CapEx com valor removidos no mesmo save (qualquer perfil)
//  - 3+ funcionários/detalhes ou 5+ linhas de Custos removidos no mesmo save
//  - Seção que encolhe mais de 40% de uma vez

const LIMIAR_REDUCAO_REAIS = 1000;

function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isNaN(v) ? 0 : v;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

export function totalProjeto(p) {
  const d = Array.isArray(p?.desembolsos) ? p.desembolsos : (p?.valor !== undefined ? [p.valor] : []);
  return d.reduce((acc, v) => acc + parseNum(v), 0);
}

const reais = (n) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
const tamanho = (x) => (x === undefined || x === null ? 0 : JSON.stringify(x).length);

function listarNomes(projetos) {
  const nomes = projetos.slice(0, 5).map((p) => `"${(p.nome || '').trim() || 'sem nome'}" (${p.cc || 'sem CC'})`);
  return nomes.join(', ') + (projetos.length > 5 ? ` e mais ${projetos.length - 5}` : '');
}

function removidosPorId(antes, depois) {
  const idsDepois = new Set((depois || []).map((x) => x?.id));
  return (antes || []).filter((x) => x && !idsDepois.has(x.id));
}

export function detectarPerdas(antes, depois, usuario, unidadeId) {
  const alertas = [];
  const ehGestorCc = usuario?.perfil === 'gerente_cc_corporativo';
  const meusCcs = new Set((usuario?.ccsPermitidos || []).filter((c) => c.unidadeId === unidadeId).map((c) => c.codigo));
  const deOutroCc = (cc) => ehGestorCc && !meusCcs.has(cc || '');

  // CapEx
  const projetosDepois = new Map((depois?.capex?.projetos || []).map((p) => [p.id, p]));
  const removidos = [];
  const reduzidos = [];
  for (const p of antes?.capex?.projetos || []) {
    const totalAntes = totalProjeto(p);
    const q = projetosDepois.get(p.id);
    if (!q) {
      if (totalAntes > 0 || (p.nome || '').trim()) removidos.push({ id: p.id, nome: p.nome, cc: p.ccCodigo, antes: totalAntes, depois: 0 });
      continue;
    }
    const totalDepois = totalProjeto(q);
    if (totalAntes - totalDepois >= LIMIAR_REDUCAO_REAIS && totalDepois <= totalAntes * 0.5) {
      reduzidos.push({ id: p.id, nome: p.nome, cc: p.ccCodigo, antes: totalAntes, depois: totalDepois });
    }
  }
  const deOutros = [...removidos, ...reduzidos].filter((p) => deOutroCc(p.cc));
  const removidosComValor = removidos.filter((p) => p.antes > 0);
  if (deOutros.length > 0) {
    const perdido = deOutros.reduce((acc, p) => acc + p.antes - p.depois, 0);
    alertas.push({
      secao: 'capex',
      descricao: `CapEx de outro CC removido/reduzido (${reais(perdido)} a menos): ${listarNomes(deOutros)}.`,
      detalhes: { projetos: deOutros },
    });
  } else if (removidosComValor.length >= 2) {
    const perdido = removidosComValor.reduce((acc, p) => acc + p.antes, 0);
    alertas.push({
      secao: 'capex',
      descricao: `${removidosComValor.length} projetos de CapEx com valor removidos de uma vez (${reais(perdido)}): ${listarNomes(removidosComValor)}.`,
      detalhes: { projetos: removidosComValor },
    });
  }

  // Custos e Despesas
  const custosA = antes?.custos || {};
  const custosD = depois?.custos || {};
  const funcRemovidos = removidosPorId(custosA.funcionarios, custosD.funcionarios);
  const detRemovidos = removidosPorId(custosA.detalhes, custosD.detalhes);
  const linhasRemovidas = Object.keys(custosA.linhas || {}).filter((k) => !(k in (custosD.linhas || {})));
  const partes = [];
  if (funcRemovidos.length >= 3) partes.push(`${funcRemovidos.length} funcionários`);
  if (detRemovidos.length >= 3) partes.push(`${detRemovidos.length} detalhamentos de pacote`);
  if (linhasRemovidas.length >= 5) partes.push(`${linhasRemovidas.length} linhas de conta`);
  if (partes.length > 0) {
    alertas.push({
      secao: 'custos',
      descricao: `Custos e Despesas: ${partes.join(', ')} removidos de uma vez.`,
      detalhes: {
        funcionarios: funcRemovidos.map((f) => ({ id: f.id, cargo: f.cargo, cc: f.ccCodigo })),
        detalhes: detRemovidos.map((d) => ({ id: d.id, cc: d.cc })),
        linhas: linhasRemovidas.slice(0, 50),
      },
    });
  }

  // Qualquer seção que encolhe de uma vez (rede de segurança genérica)
  const jaAlertadas = new Set(alertas.map((a) => a.secao));
  for (const secao of Object.keys(antes || {})) {
    if (secao === 'meta' || jaAlertadas.has(secao)) continue;
    const tA = tamanho(antes[secao]);
    const tD = tamanho(depois?.[secao]);
    if (tA >= 2000 && tD < tA * 0.6) {
      alertas.push({
        secao,
        descricao: `Seção "${secao}" encolheu de ${Math.round(tA / 1024)} KB para ${Math.round(tD / 1024)} KB num único salvamento.`,
        detalhes: { tamanhoAntes: tA, tamanhoDepois: tD },
      });
    }
  }

  return alertas;
}
