// Login e senha (Opção A da especificação, seção 5) — implementado em
// paralelo ao SSO (Opção B, seção 5.2), não no lugar dele: o Entra ID ainda
// não tem App Registration, então a aplicação não pode depender só disso.
//
// bcryptjs (puro JS, sem binding nativo) em vez de bcrypt — evita dor de
// cabeça de compilação no build Docker (Alpine + node-gyp costuma ser
// frágil). Custo 12 é um equilíbrio razoável de segurança x latência para
// uma base de ~25 usuários internos.
//
// PENDÊNCIA (seção 9.3 da especificação, "política de senha... se optar
// pela Opção A" — decisão em aberto): implementei só o mínimo (8+
// caracteres). NÃO implementei bloqueio após N tentativas falhas nem fluxo
// de "esqueci minha senha" por e-mail — a especificação pede os dois
// explicitamente para a Opção A. Fluxo de e-mail exigiria um provedor de
// envio (SMTP/SendGrid/etc.) que este projeto não tem configurado ainda.
import bcrypt from 'bcryptjs';

const CUSTO_HASH = 12;
export const TAMANHO_MINIMO_SENHA = 8;

export function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < TAMANHO_MINIMO_SENHA) {
    return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  }
  return null;
}

export async function gerarHashSenha(senha) {
  return bcrypt.hash(senha, CUSTO_HASH);
}

export async function verificarSenha(senha, hash) {
  if (!hash) return false; // usuário só tem login via SSO, sem senha cadastrada
  return bcrypt.compare(senha, hash);
}
