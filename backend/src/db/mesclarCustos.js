// Merge de edições simultâneas em custos.linhas/detalhes/funcionarios/
// premissasPessoal/viagens (2026-09-10, pedido: "a plataforma precisa de
// fato capturar e hospedar todas as edições simultâneas").
//
// O problema: orcamentos.dados é um único bloco JSON por unidade. Até aqui,
// o PUT /:unidadeId sempre SUBSTITUÍA o bloco inteiro pelo que o navegador
// tinha em memória — carregado uma vez, na hora que a tela abriu. Se dois
// gestores de CC diferentes (ex.: Corporativo, 20 CCs) editam a mesma
// unidade ao mesmo tempo, o segundo a salvar sobrescreve silenciosamente
// tudo que o primeiro salvou entre a abertura da tela e aquele momento —
// sem erro, sem aviso, perda de dado de verdade.
//
// A correção (escopo: só Custos e Despesas — a única parte do modelo hoje
// organizada por CC, ver nota em validarEscritaCcCustos/routes/orcamentos.js;
// Receita/CAPEX/etc. continuam substituindo a seção inteira, como sempre):
// o frontend passa a mandar, junto do PUT, `custosBase` — o que o próprio
// navegador tinha em `custos` quando carregou a tela (não o que está no
// banco agora). A diferença entre `custosBase` e o `custos` que está sendo
// enviado agora é exatamente o que ESTE cliente editou nesta sessão —
// aplica só isso por cima do que está no banco NESTE INSTANTE (que pode já
// ter mudança de outro usuário), em vez de substituir o bloco inteiro.
//
// Compatibilidade: chamador que não manda `custosBase` (frontend antigo em
// cache, ou qualquer outro chamador da API) cai no comportamento de sempre
// — ver o `if (custosBase)` em routes/orcamentos.js, esta função só é
// chamada quando ele existe.

function mudou(a, b) {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

/** `linhas`/`premissasPessoal`/`viagens` — objetos chaveados (CC|conta, ou
 * campo, ou CC). Começa do que está no banco agora e só troca as chaves que
 * o cliente de fato mudou desde o `base` dele. */
function mesclarPorChave(base, atualBanco, novoCliente) {
  const baseObj = base || {};
  const atualObj = atualBanco || {};
  const novoObj = novoCliente || {};
  const resultado = { ...atualObj };
  const chaves = new Set([...Object.keys(baseObj), ...Object.keys(novoObj)]);
  for (const chave of chaves) {
    if (!mudou(baseObj[chave], novoObj[chave])) continue;
    if (chave in novoObj) resultado[chave] = novoObj[chave];
    else delete resultado[chave]; // cliente removeu essa chave
  }
  return resultado;
}

/** `detalhes`/`funcionarios` — arrays de objetos com `id`. Mesma ideia,
 * comparando item a item pelo id em vez de por chave de objeto. */
function mesclarPorId(base, atualBanco, novoCliente) {
  const baseMap = new Map((base || []).map((x) => [x.id, x]));
  const novoMap = new Map((novoCliente || []).map((x) => [x.id, x]));
  const resultadoMap = new Map((atualBanco || []).map((x) => [x.id, x]));
  const idsMudados = new Set();
  for (const [id, item] of novoMap) {
    if (mudou(baseMap.get(id), item)) idsMudados.add(id);
  }
  for (const id of baseMap.keys()) {
    if (!novoMap.has(id)) idsMudados.add(id); // cliente removeu esse item
  }
  for (const id of idsMudados) {
    if (novoMap.has(id)) resultadoMap.set(id, novoMap.get(id));
    else resultadoMap.delete(id);
  }
  return [...resultadoMap.values()];
}

export function mesclarCustos(custosBase, custosAtualBanco, custosCliente) {
  return {
    linhas: mesclarPorChave(custosBase?.linhas, custosAtualBanco?.linhas, custosCliente?.linhas),
    detalhes: mesclarPorId(custosBase?.detalhes, custosAtualBanco?.detalhes, custosCliente?.detalhes),
    funcionarios: mesclarPorId(custosBase?.funcionarios, custosAtualBanco?.funcionarios, custosCliente?.funcionarios),
    premissasPessoal: mesclarPorChave(custosBase?.premissasPessoal, custosAtualBanco?.premissasPessoal, custosCliente?.premissasPessoal),
    viagens: mesclarPorChave(custosBase?.viagens, custosAtualBanco?.viagens, custosCliente?.viagens),
  };
}
