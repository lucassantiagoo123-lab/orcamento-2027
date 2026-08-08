// Construção do app Express, separada de server.js — permite que os testes
// (backend/test/) importem o app e usem supertest sem abrir uma porta real.
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config, ssoConfigurado } from './config.js';
import { authRouter, loginDevDisponivel } from './auth/routes.js';
import { authenticate } from './middleware/authenticate.js';
import { orcamentosRouter } from './routes/orcamentos.js';
import { adminRouter } from './routes/admin.js';

export function criarApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (req, res) => res.json({ ok: true, ssoConfigurado, loginDevDisponivel }));

  app.use('/auth', authRouter);

  // Quem está logado agora — o frontend usa isto para saber o perfil e o escopo
  // (unidadesPermitidas/ccsPermitidos) sem precisar decodificar nada no cliente.
  app.get('/auth/me', authenticate, (req, res) => {
    const { id, nome, email, perfil, unidadesPermitidas, ccsPermitidos } = req.usuario;
    res.json({ id, nome, email, perfil, unidadesPermitidas, ccsPermitidos });
  });

  app.use('/api/orcamentos', authenticate, orcamentosRouter);
  app.use('/api/admin', authenticate, adminRouter);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ erro: 'erro_interno' });
  });

  return app;
}
