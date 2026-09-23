// Merge 3-way do documento inteiro do orçamento (todas as seções).
// base  = o que o navegador tinha quando carregou/salvou pela última vez
// banco = o que está salvo agora (pode ter mudança de outro usuário)
// novo  = o que o navegador está enviando
// Só o que o cliente de fato mudou em relação à base é aplicado sobre o banco.
// Cópia idêntica em backend/src/db/mesclarDados.js — manter as duas iguais.

// Igualdade profunda que ignora a ordem das chaves (o JSONB do Postgres
// reordena as chaves, então comparar via JSON.stringify daria falso "mudou").
export function iguais(a, b) {
  if (a === b) return true;
  if (a === undefined || a === null || b === undefined || b === null) return (a ?? null) === (b ?? null);
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => iguais(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => iguais(a[k], b[k]));
}

function mudou(a, b) {
  return !iguais(a, b);
}

function ehObjeto(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function saoListasComId(...listas) {
  if (!listas.every((l) => l === undefined || l === null || Array.isArray(l))) return false;
  const itens = listas.flatMap((l) => l || []);
  return itens.length > 0 && itens.every((i) => ehObjeto(i) && i.id !== undefined && i.id !== null);
}

function saoListasDeValores(...listas) {
  if (!listas.every(Array.isArray)) return false;
  const n = listas[0].length;
  return listas.every((l) => l.length === n && l.every((i) => i === null || typeof i !== 'object'));
}

function mesclarObjeto(base, banco, novo) {
  const resultado = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(banco), ...Object.keys(novo)])) {
    const v = mesclarValor(base[k], banco[k], novo[k]);
    if (v !== undefined) resultado[k] = v;
  }
  return resultado;
}

function mesclarListaPorId(base, banco, novo) {
  const mapa = (l) => new Map((l || []).map((i) => [i.id, i]));
  const b = mapa(base), a = mapa(banco), n = mapa(novo);
  const ordem = [...a.keys(), ...[...n.keys()].filter((id) => !a.has(id))];
  const resultado = [];
  for (const id of ordem) {
    const v = mesclarValor(b.get(id), a.get(id), n.get(id));
    if (v !== undefined) resultado.push(v);
  }
  return resultado;
}

export function mesclarValor(base, banco, novo) {
  if (!mudou(base, novo)) return banco;
  if (!mudou(base, banco) || !mudou(banco, novo)) return novo;
  // Os dois mexeram no mesmo ponto: desce um nível pra separar o que não conflita.
  if (novo === undefined) return banco; // cliente removeu algo que outro editou: preserva a edição
  if (ehObjeto(banco) && ehObjeto(novo)) return mesclarObjeto(ehObjeto(base) ? base : {}, banco, novo);
  if (saoListasComId(base, banco, novo)) return mesclarListaPorId(base, banco, novo);
  if (saoListasDeValores(base, banco, novo)) return novo.map((_, i) => mesclarValor(base[i], banco[i], novo[i]));
  return novo; // mesma célula alterada pelos dois: vale quem salvou por último
}

export function mesclarDados(base, banco, novo) {
  const b = ehObjeto(base) ? base : {};
  const a = ehObjeto(banco) ? banco : {};
  const n = ehObjeto(novo) ? novo : {};
  const resultado = mesclarObjeto(b, a, n);
  // Seção ausente do payload nunca é tratada como "apagada".
  for (const k of Object.keys(a)) {
    if (!(k in n)) resultado[k] = a[k];
  }
  return resultado;
}
