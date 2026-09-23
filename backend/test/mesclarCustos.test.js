// Teste puro (sem banco, sem servidor) da função de merge de edições
// simultâneas em Custos e Despesas — ver backend/src/db/mesclarCustos.js e
// a nota completa em routes/orcamentos.js (PUT /:unidadeId). Pedido de
// 2026-09-10: "a plataforma precisa de fato capturar e hospedar todas as
// edições simultâneas".
//
// Cenário central que este arquivo prova: dois usuários abrem a mesma
// unidade com o mesmo `custos` (o `base`). Um deles salva primeiro (sua
// mudança já está em `atualBanco`, o "banco" no momento do segundo PUT). O
// outro salva depois, sem saber da mudança do primeiro — seu payload
// (`novoCliente`) ainda tem, pra aquela chave, o valor antigo de `base`
// (porque ele nunca tocou nela). O merge tem que preservar a mudança do
// primeiro usuário, não sobrescrever com o valor antigo que o segundo só
// está "carregando junto" sem querer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesclarCustos, mesclarCapex } from '../src/db/mesclarCustos.js';

function linha(valores) {
  return { tipo: 'valor', valores };
}

test('linhas: mudança de outro usuário sobrevive quando este cliente não tocou naquela chave', () => {
  const base = { linhas: { 'cc1|contaA': linha(['100']) } };
  // "Banco agora": outro usuário já salvou uma mudança na mesma conta.
  const atualBanco = { linhas: { 'cc1|contaA': linha(['999']) } };
  // Este cliente nunca editou contaA (payload ainda tem o valor de `base`),
  // mas editou contaB, uma conta nova que ele criou.
  const novoCliente = { linhas: { 'cc1|contaA': linha(['100']), 'cc1|contaB': linha(['50']) } };

  const resultado = mesclarCustos(base, atualBanco, novoCliente);

  assert.deepEqual(resultado.linhas['cc1|contaA'], linha(['999']), 'mudança do outro usuário não pode ser perdida');
  assert.deepEqual(resultado.linhas['cc1|contaB'], linha(['50']), 'mudança nova deste cliente precisa entrar');
});

test('linhas: duas contas diferentes editadas ao mesmo tempo, as duas sobrevivem', () => {
  const base = { linhas: { 'cc1|contaA': linha(['0']), 'cc2|contaC': linha(['0']) } };
  const atualBanco = { linhas: { 'cc1|contaA': linha(['10']), 'cc2|contaC': linha(['0']) } }; // outro usuário mudou contaA
  const novoCliente = { linhas: { 'cc1|contaA': linha(['0']), 'cc2|contaC': linha(['20']) } }; // este mudou contaC

  const resultado = mesclarCustos(base, atualBanco, novoCliente);

  assert.deepEqual(resultado.linhas['cc1|contaA'], linha(['10']));
  assert.deepEqual(resultado.linhas['cc2|contaC'], linha(['20']));
});

test('linhas: os dois usuários editam a MESMA conta — quem salva por último (este PUT) ganha', () => {
  const base = { linhas: { 'cc1|contaA': linha(['0']) } };
  const atualBanco = { linhas: { 'cc1|contaA': linha(['777']) } }; // outro usuário salvou primeiro
  const novoCliente = { linhas: { 'cc1|contaA': linha(['555']) } }; // este edita a mesma conta e salva depois

  const resultado = mesclarCustos(base, atualBanco, novoCliente);

  // Colisão real na MESMA célula: não tem como preservar as duas — o merge
  // não inventa uma terceira versão, só evita apagar edições em CÉLULAS
  // diferentes. Comportamento aceito: quem salva por último nesta célula
  // específica prevalece (mesmo "last write wins" de sempre, só que agora
  // isolado à célula em conflito, não ao documento inteiro).
  assert.deepEqual(resultado.linhas['cc1|contaA'], linha(['555']));
});

test('funcionarios: dois usuários adicionam funcionários diferentes ao mesmo tempo', () => {
  const base = { funcionarios: [] };
  const atualBanco = { funcionarios: [{ id: 'f1', cargo: 'Analista', salario: '3000', ccCodigo: '01', origem: 'novo' }] };
  const novoCliente = { funcionarios: [{ id: 'f2', cargo: 'Gerente', salario: '8000', ccCodigo: '02', origem: 'novo' }] };

  const resultado = mesclarCustos(base, atualBanco, novoCliente);

  const ids = resultado.funcionarios.map((f) => f.id).sort();
  assert.deepEqual(ids, ['f1', 'f2']);
});

test('funcionarios: este cliente remove um funcionário que ele mesmo tinha criado', () => {
  const base = { funcionarios: [{ id: 'f1', cargo: 'Analista' }] };
  const atualBanco = { funcionarios: [{ id: 'f1', cargo: 'Analista' }, { id: 'f2', cargo: 'Gerente' }] }; // outro usuário adicionou f2
  const novoCliente = { funcionarios: [] }; // este removeu f1

  const resultado = mesclarCustos(base, atualBanco, novoCliente);

  const ids = resultado.funcionarios.map((f) => f.id);
  assert.deepEqual(ids, ['f2'], 'f1 removido por este cliente, f2 do outro usuário preservado');
});

test('capex: edição de valores de outro usuário sobrevive quando este cliente só reenvia o projeto sem mudar', () => {
  const projetoGabriela = { id: 'p1', nome: 'Projeto G', desembolsos: ['0'] };
  const base = { projetos: [projetoGabriela] };
  const atualBanco = { projetos: [{ ...projetoGabriela, desembolsos: ['50000'] }] }; // Gabriela preencheu
  const novoCliente = { projetos: [projetoGabriela, { id: 'p2', nome: 'Projeto A' }] }; // outro gestor adicionou p2

  const resultado = mesclarCapex(base, atualBanco, novoCliente);

  assert.deepEqual(resultado.projetos.find((p) => p.id === 'p1').desembolsos, ['50000']);
  assert.ok(resultado.projetos.some((p) => p.id === 'p2'));
});

test('capex: projeto adicionado por outro usuário não é apagado por cliente com cópia antiga', () => {
  const base = { projetos: [] };
  const atualBanco = { projetos: [{ id: 'p1', nome: 'Novo do gestor' }] };
  const novoCliente = { projetos: [] };

  const resultado = mesclarCapex(base, atualBanco, novoCliente);

  assert.deepEqual(resultado.projetos.map((p) => p.id), ['p1']);
});

test('capex: este cliente remove o próprio projeto', () => {
  const base = { projetos: [{ id: 'p1' }] };
  const atualBanco = { projetos: [{ id: 'p1' }, { id: 'p2' }] };
  const novoCliente = { projetos: [] };

  const resultado = mesclarCapex(base, atualBanco, novoCliente);

  assert.deepEqual(resultado.projetos.map((p) => p.id), ['p2']);
});

test('sem custosBase (compatibilidade): comportamento não é chamado — verificado na rota, não aqui', () => {
  // mesclarCustos em si sempre espera os 3 argumentos; a decisão de "não
  // mesclar, sobrescrever tudo" quando o cliente não manda custosBase é da
  // rota (PUT /:unidadeId em routes/orcamentos.js), não desta função — ver
  // o `if (custosBase)` lá. Este teste só documenta a fronteira.
  assert.equal(typeof mesclarCustos, 'function');
});
