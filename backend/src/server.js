import { config, ssoConfigurado } from './config.js';
import { criarApp } from './app.js';

const app = criarApp();

app.listen(config.port, () => {
  console.log(`OBZ 2027 backend ouvindo em http://localhost:${config.port}`);
  if (!ssoConfigurado) {
    console.warn(
      'AVISO: SSO Entra ID não configurado (sem App Registration ainda) — /auth/login e /auth/callback retornam 503. ' +
      'Preencha AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET em .env quando o TI concluir o registro.'
    );
  }
});
