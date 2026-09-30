// Integridade do cadastro (CCs, contas e pacotes) de cada unidade no servidor
// (2026-09-30). Pega o erro silencioso de um CC/conta duplicado ou fora de
// pacote — que faz o cálculo do servidor divergir da tela sem nada quebrar.
// A comparação com o cadastro do frontend é feita pela tela "Conferência tela ×
// servidor" (Gestão do Orçamento), com os dados reais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNIDADES_ORCAMENTO } from '../src/calc/registroUnidades.js';

for (const [unidadeId, ref] of Object.entries(UNIDADES_ORCAMENTO)) {
  test(`cadastro de ${unidadeId}: CCs únicos, contas em um só pacote e pacotes coerentes`, () => {
    const codigosCc = ref.ccs.map((c) => c.codigo);
    assert.equal(new Set(codigosCc).size, codigosCc.length, 'CC repetido no cadastro');

    const vistas = new Map();
    for (const [pacoteId, contas] of Object.entries(ref.planoContas)) {
      assert.ok(contas.length > 0, `pacote ${pacoteId} sem contas`);
      for (const c of contas) {
        assert.ok(!vistas.has(c.codigo), `conta ${c.codigo} está em ${vistas.get(c.codigo)} e em ${pacoteId}`);
        vistas.set(c.codigo, pacoteId);
        assert.equal(ref.todasContas[c.codigo]?.pacoteId, pacoteId, `todasContas diverge do plano em ${c.codigo}`);
      }
    }
    assert.equal(Object.keys(ref.todasContas).length, vistas.size, 'todasContas tem conta fora do plano');
    if (ref.pacotes) {
      const ids = ref.pacotes.map((p) => p.id).sort().join(',');
      assert.equal(ids, Object.keys(ref.planoContas).sort().join(','), 'lista de pacotes diverge do plano');
    }
  });
}
