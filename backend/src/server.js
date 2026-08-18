import { config, ssoConfigurado } from './config.js';
import { criarApp } from './app.js';
import { rodarMigracoes } from './db/migrate.js';

const app = criarApp();

// Pedido de 2026-08-16: nada de ajuste de schema acumulado à mão no editor
// SQL do Railway — cada deploy aplica sozinho as migrações pendentes de
// backend/db/migrations/ antes de aceitar requisições. Se uma migração
// falhar, o processo não sobe (ver rodarMigracoes) — melhor um deploy
// travado do que a aplicação rodando contra um schema pela metade.
rodarMigracoes()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`OBZ 2027 backend ouvindo em http://localhost:${config.port}`);
      if (!ssoConfigurado) {
        console.warn(
          'AVISO: SSO Entra ID não configurado (sem App Registration ainda) — /auth/login e /auth/callback retornam 503. ' +
          'Preencha AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET em .env quando o TI concluir o registro.'
        );
      }
    });
  })
  .catch((err) => {
    console.error('Falha ao aplicar migrações de banco — servidor não subiu:', err);
    process.exit(1);
  });
