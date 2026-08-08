// Rotas do fluxo SSO (Authorization Code + PKCE contra o Entra ID).
//
// PENDENTE: sem App Registration no Entra ID ainda (decisão de 2026-08-08 —
// "não tem app registration, siga a segunda opção"). Por isso todo o fluxo
// abaixo está escrito e pronto, mas fica atrás do guard `ssoConfigurado`: até
// as variáveis AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET serem preenchidas em
// .env, estas rotas respondem 503 em vez de tentar descobrir um issuer que
// não existe — o resto do backend sobe e funciona normalmente.
import { Router } from 'express';
import { config, ssoConfigurado } from '../config.js';
import { getOidcClient, generators } from './oidc.js';
import { emitirSessao, limparSessao } from './session.js';
import { buscarUsuarioPorEmail, registrarLogin } from '../db/usuarios.js';

export const authRouter = Router();

const STATE_COOKIE = 'obz_oauth_state';
const VERIFIER_COOKIE = 'obz_oauth_verifier';

function exigirSsoConfigurado(req, res, next) {
  if (!ssoConfigurado) {
    return res.status(503).json({
      erro: 'sso_nao_configurado',
      mensagem:
        'Login via Microsoft Entra ID ainda não está disponível — o App Registration no Entra ID ' +
        'do Grupo ARA ainda não existe. Preencha AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET ' +
        'em backend/.env assim que o TI concluir o registro (ver backend/.env.example).',
    });
  }
  next();
}

authRouter.get('/login', exigirSsoConfigurado, async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    const cookieOpts = {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 min — só dura o tempo do fluxo de login
    };
    res.cookie(STATE_COOKIE, state, cookieOpts);
    res.cookie(VERIFIER_COOKIE, codeVerifier, cookieOpts);

    const authUrl = client.authorizationUrl({
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/callback', exigirSsoConfigurado, async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const params = client.callbackParams(req);
    const state = req.cookies?.[STATE_COOKIE];
    const codeVerifier = req.cookies?.[VERIFIER_COOKIE];
    res.clearCookie(STATE_COOKIE);
    res.clearCookie(VERIFIER_COOKIE);

    const tokenSet = await client.callback(config.azure.redirectUri, params, {
      state,
      code_verifier: codeVerifier,
    });
    const claims = tokenSet.claims();
    const email = String(claims.email || claims.preferred_username || '').toLowerCase();
    if (!email) {
      return res.status(400).json({ erro: 'sem_email', mensagem: 'Token do Entra ID sem e-mail nas claims.' });
    }

    // O Entra ID só prova identidade. Perfil/vínculos e ativação continuam
    // sendo geridos exclusivamente na tabela usuarios (seção 5.2 da especificação).
    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario) {
      return res.status(403).json({
        erro: 'usuario_nao_cadastrado',
        mensagem: `${email} autenticou no Entra ID mas não tem cadastro no sistema. Peça a um admin_fpa para criar o usuário.`,
      });
    }
    if (!usuario.ativo) {
      return res.status(403).json({ erro: 'usuario_inativo', mensagem: 'Usuário desativado.' });
    }

    emitirSessao(res, usuario.id);
    await registrarLogin(usuario.id);
    res.redirect(config.frontendOrigin);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req, res) => {
  limparSessao(res);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Login de desenvolvimento — SÓ existe para testar a interface multiusuário
// enquanto o App Registration do Entra ID não existe (Fase 9, decisão de
// 2026-08-08). Autentica como um usuário já cadastrado, informando só o
// e-mail — sem senha, sem verificação de identidade nenhuma.
//
// Guarda dupla contra ir parar em produção: exige DEV_LOGIN_ENABLED=true E
// NODE_ENV !== 'production' — as duas, não uma OU outra. Nunca ligar
// DEV_LOGIN_ENABLED num ambiente que usuários de verdade acessam: qualquer
// pessoa com a URL vira qualquer usuário cadastrado, sem prova nenhuma de
// quem é.
// ---------------------------------------------------------------------------
const loginDevHabilitado = process.env.DEV_LOGIN_ENABLED === 'true' && config.nodeEnv !== 'production';

if (loginDevHabilitado) {
  console.warn(
    '⚠ AVISO: /auth/dev-login está ATIVO (DEV_LOGIN_ENABLED=true). Isto autentica como qualquer ' +
    'usuário cadastrado só com o e-mail, sem senha. NUNCA deixar ligado num ambiente que usuários ' +
    'de verdade acessam.'
  );

  authRouter.post('/dev-login', async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').toLowerCase();
      if (!email) return res.status(400).json({ erro: 'email_obrigatorio' });

      const usuario = await buscarUsuarioPorEmail(email);
      if (!usuario) return res.status(404).json({ erro: 'usuario_nao_encontrado' });
      if (!usuario.ativo) return res.status(403).json({ erro: 'usuario_inativo' });

      emitirSessao(res, usuario.id);
      await registrarLogin(usuario.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
}

export const loginDevDisponivel = loginDevHabilitado;
