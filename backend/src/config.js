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
};

// SSO configurado = os três campos essenciais preenchidos. Enquanto o App
// Registration não existir no Entra ID, isto é false e src/auth/routes.js
// responde 503 em vez de tentar montar um client OIDC quebrado.
export const ssoConfigurado = Boolean(
  config.azure.tenantId && config.azure.clientId && config.azure.clientSecret
);
