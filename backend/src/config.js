// Carrega e valida variáveis de ambiente. Falha alto (fail loud) para o que é
// indispensável (DATABASE_URL, SESSION_JWT_SECRET); o SSO Entra ID é tolerado
// vazio porque ainda não existe App Registration (ver .env.example) — nesse
// caso o servidor sobe, mas as rotas de login ficam desabilitadas (503).
import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name} (ver backend/.env.example)`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL'),

  session: {
    jwtSecret: required('SESSION_JWT_SECRET'),
    ttlMinutes: Number(process.env.SESSION_TTL_MINUTES || 30),
  },

  azure: {
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    redirectUri: process.env.AZURE_REDIRECT_URI || '',
  },

  // E-mail (pedido de 2026-08-16: notificar o FP&A por e-mail a cada envio
  // de versão). Mesmo padrão de tolerância do SSO: sem SMTP_HOST/USER/PASS,
  // o servidor sobe normal, só que src/email/notificacoes.js loga um aviso e
  // não manda nada em vez de quebrar — ver emailConfigurado abaixo.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },
};

// SSO configurado = os três campos essenciais preenchidos. Enquanto o App
// Registration não existir no Entra ID, isto é false e src/auth/routes.js
// responde 503 em vez de tentar montar um client OIDC quebrado.
export const ssoConfigurado = Boolean(
  config.azure.tenantId && config.azure.clientId && config.azure.clientSecret
);

// E-mail configurado = host/usuário/senha preenchidos. Enquanto o TI não
// passar as credenciais SMTP (Office 365, SendGrid, etc.), isto é false.
export const emailConfigurado = Boolean(
  config.smtp.host && config.smtp.user && config.smtp.pass
);
