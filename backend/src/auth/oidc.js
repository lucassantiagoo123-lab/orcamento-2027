// Cliente OIDC contra o Microsoft Entra ID (Azure AD), via openid-client.
// Só é chamado quando ssoConfigurado === true (ver config.js) — ou seja, só
// depois que o TI registrar o app e as três variáveis AZURE_* forem preenchidas.
import { Issuer, generators } from 'openid-client';
import { config } from '../config.js';

let clientPromise = null;

function authorityUrl() {
  return `https://login.microsoftonline.com/${config.azure.tenantId}/v2.0`;
}

/** Descobre o issuer do Entra ID e monta o client OIDC. Resultado é cacheado
 * em memória (um client por processo) — a descoberta só roda uma vez. */
export async function getOidcClient() {
  if (!clientPromise) {
    clientPromise = Issuer.discover(authorityUrl()).then((issuer) => {
      return new issuer.Client({
        client_id: config.azure.clientId,
        client_secret: config.azure.clientSecret,
        redirect_uris: [config.azure.redirectUri],
        response_types: ['code'],
      });
    });
  }
  return clientPromise;
}

export { generators };
