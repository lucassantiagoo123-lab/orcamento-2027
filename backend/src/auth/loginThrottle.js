// Bloqueio após N tentativas falhas (seção 5, Opção A da especificação).
//
// Implementação em memória, de propósito simples: um Map por processo,
// contando tentativas falhas por e-mail. NÃO sobrevive a um restart do
// processo e NÃO é compartilhado entre réplicas se o backend rodar com mais
// de uma instância (ex.: autoscaling) — para isso precisaria de um estado
// compartilhado (Redis, ou a própria tabela `sessoes`/uma tabela nova).
// Documentado como limitação conhecida, não escondida: suficiente para a
// escala atual (~25 usuários, uma instância), revisar se isso mudar.
const MAX_TENTATIVAS = 5;
const JANELA_BLOQUEIO_MS = 15 * 60 * 1000; // 15 minutos

const tentativas = new Map(); // email -> { falhas, bloqueadoAte }

export function verificarBloqueio(email) {
  const registro = tentativas.get(email);
  if (!registro) return null;
  if (registro.bloqueadoAte && registro.bloqueadoAte > Date.now()) {
    return registro.bloqueadoAte;
  }
  return null;
}

export function registrarFalha(email) {
  const registro = tentativas.get(email) || { falhas: 0, bloqueadoAte: null };
  registro.falhas += 1;
  if (registro.falhas >= MAX_TENTATIVAS) {
    registro.bloqueadoAte = Date.now() + JANELA_BLOQUEIO_MS;
    registro.falhas = 0; // reinicia a contagem depois de bloquear
  }
  tentativas.set(email, registro);
}

export function limparTentativas(email) {
  tentativas.delete(email);
}
