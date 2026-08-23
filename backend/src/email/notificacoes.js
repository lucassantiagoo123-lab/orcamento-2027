// Notificações por e-mail (pedido de 2026-08-16: "Notificar FP&A por email
// (email de todos os admins) a cada envio"). Best-effort de propósito — um
// envio de orçamento não pode falhar por causa de e-mail fora do ar; toda
// chamada aqui é try/catch e só loga, nunca lança pra quem chamou.
import nodemailer from 'nodemailer';
import { config, emailConfigurado } from '../config.js';
import { listarEmailsAdminFpa } from '../db/usuarios.js';

let transporter = null;
function getTransporter() {
  if (!emailConfigurado) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

// Devolve se o e-mail realmente saiu ou não — notificarEnvioParaFpa (abaixo)
// não usa esse retorno (é best-effort, disparado sem await por quem chama),
// mas enviarAcesso precisa saber pra responder certo pro admin que clicou
// no botão "Enviar acesso por e-mail" (2026-08-23).
async function enviarEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t || to.length === 0) {
    console.warn(
      `[email] não enviado (${!t ? 'SMTP não configurado — ver SMTP_HOST/SMTP_USER/SMTP_PASS' : 'sem destinatário'}): "${subject}"`
    );
    return false;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to: to.join(', '), subject, html, text });
    return true;
  } catch (err) {
    console.error(`[email] falha ao enviar "${subject}":`, err.message);
    return false;
  }
}

/** Dispara para todos os admin_fpa ativos quando um gestor envia uma versão
 * (routes/orcamentos.js, POST /:unidadeId/enviar). Chamado depois do
 * registrarEnvio ter sucesso — nunca bloqueia nem atrasa a resposta ao
 * usuário (a rota não faz `await` nisto, ver nota lá). */
export async function notificarEnvioParaFpa({ unidadeNome, autorNome, comentario, totais }) {
  const destinatarios = await listarEmailsAdminFpa();
  const linhaTotais = totais
    ? `Receita Líquida: R$ ${Number(totais.receitaLiquida || 0).toLocaleString('pt-BR')} · EBITDA: R$ ${Number(totais.ebitda || 0).toLocaleString('pt-BR')} · Lucro Líquido: R$ ${Number(totais.lucroLiquido || 0).toLocaleString('pt-BR')}`
    : '';
  // Pedido de 2026-08-17: o e-mail precisa trazer o link da plataforma —
  // config.frontendOrigin (FRONTEND_ORIGIN) é a mesma origem que o backend
  // já usa pra CORS/cookie, então é o endereço certo do app publicado.
  const link = config.frontendOrigin;
  await enviarEmail({
    to: destinatarios,
    subject: `[Orçamento 2027] ${unidadeNome} enviou uma nova versão`,
    text: [
      `${unidadeNome} enviou uma nova versão do orçamento.`,
      `Autor: ${autorNome || '—'}`,
      comentario ? `Comentário: ${comentario}` : null,
      linhaTotais || null,
      '',
      'O envio ficará travado (sem permitir reenvio) até um Admin FP&A liberar na tela de Administração/Revisão.',
      '',
      `Abrir a plataforma: ${link}`,
    ].filter(Boolean).join('\n'),
    html: `
      <p><strong>${unidadeNome}</strong> enviou uma nova versão do orçamento.</p>
      <p><strong>Autor:</strong> ${autorNome || '—'}</p>
      ${comentario ? `<p><strong>Comentário:</strong> ${comentario}</p>` : ''}
      ${linhaTotais ? `<p>${linhaTotais}</p>` : ''}
      <p>O envio ficará travado (sem permitir reenvio) até um Admin FP&A liberar.</p>
      <p><a href="${link}">Abrir a plataforma</a></p>
    `,
  });
}

/** Manda login + senha atual pro próprio usuário — pedido de 2026-08-23,
 * disparado pelo botão "Enviar acesso por e-mail" no Painel de
 * Administração (routes/admin.js, POST /usuarios/:id/enviar-acesso). Ao
 * contrário de notificarEnvioParaFpa, quem chama aguarda (await) o
 * resultado — a rota precisa saber se saiu de verdade pra responder certo
 * pro admin (SMTP pode não estar configurado, ver enviarEmail acima). */
export async function enviarAcesso({ nome, email, senha }) {
  const link = config.frontendOrigin;
  return enviarEmail({
    to: [email],
    subject: '[Orçamento 2027] Seu acesso à plataforma',
    text: [
      `Olá, ${nome}.`,
      '',
      'Seu acesso à plataforma de Orçamento 2027 do Grupo ARA:',
      `Login: ${email}`,
      `Senha: ${senha}`,
      '',
      `Acessar: ${link}`,
      '',
      'Guarde este e-mail em local seguro. Se precisar trocar a senha, peça a um Admin FP&A.',
    ].join('\n'),
    html: `
      <p>Olá, <strong>${nome}</strong>.</p>
      <p>Seu acesso à plataforma de Orçamento 2027 do Grupo ARA:</p>
      <p><strong>Login:</strong> ${email}<br/><strong>Senha:</strong> ${senha}</p>
      <p><a href="${link}">Acessar a plataforma</a></p>
      <p>Guarde este e-mail em local seguro. Se precisar trocar a senha, peça a um Admin FP&A.</p>
    `,
  });
}
