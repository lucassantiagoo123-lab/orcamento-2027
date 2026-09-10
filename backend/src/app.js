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
import { premissasMacroRouter } from './routes/premissasMacro.js';
import { processoRouter } from './routes/processo.js';

export function criarApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  // limit (2026-09-09, bug real: PayloadTooLargeError travando o autosave de
  // Samoa Beach assim que a gestora abria a unidade) — o padrão do Express é
  // 100kb, e o documento de orçamento (JSONB único por unidade, com
  // custos.linhas de todo CC × conta) já passa disso desde que a Resorts
  // ganhou o plano de contas completo em todo CC (ver contasDoPacoteNoCc,
  // 2026-09-08). 10mb dá bastante margem pro documento crescer sem precisar
  // mexer aqui de novo.
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // sessionTtlMinutes (2026-09-10, pedido: pop-up central de inatividade
  // "vinculado ao tempo") — expõe o valor real configurado (ver
  // config.session.ttlMinutes/SESSION_TTL_MINUTES) pra o frontend cronometrar
  // a inatividade com o MESMO número que o backend usa pra expirar a sessão
  // (ver middleware/authenticate.js, renovação deslizante) — nunca um valor
  // fixo no cliente que poderia divergir se essa env var mudar no Railway.
  app.get('/health', (req, res) => res.json({ ok: true, ssoConfigurado, loginDevDisponivel, sessionTtlMinutes: config.session.ttlMinutes }));

  app.use('/auth', authRouter);

  // Quem está logado agora — o frontend usa isto para saber o perfil e o escopo
  // (unidadesPermitidas/ccsPermitidos) sem precisar decodificar nada no cliente.
  app.get('/auth/me', authenticate, (req, res) => {
    const { id, nome, email, perfil, unidadesPermitidas, ccsPermitidos } = req.usuario;
    res.json({ id, nome, email, perfil, unidadesPermitidas, ccsPermitidos });
  });

  app.use('/api/orcamentos', authenticate, orcamentosRouter);
  app.use('/api/admin', authenticate, adminRouter);
  app.use('/api/premissas-macro', authenticate, premissasMacroRouter);
  app.use('/api/processo', authenticate, processoRouter);

  // 2026-09-09: erros do próprio Express/body-parser (payload grande demais,
  // JSON malformado etc.) já vêm com status e mensagem úteis — antes isto
  // sempre respondia 500/"erro_interno" pra qualquer erro, escondendo até
  // esses casos claros (só apareciam no log do servidor, nunca pro usuário
  // nem pra quem for investigar pela tela). Preserva o status/mensagem
  // quando o próprio erro já traz um (4xx conhecido); só cai no genérico
  // 500/"erro_interno" pra exceção de verdade não tratada.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    if (err.status === 413 || err.type === 'entity.too.large') {
      return res.status(413).json({ erro: 'payload_grande_demais', mensagem: 'Documento grande demais para salvar de uma vez. Fale com o Admin FP&A — pode ser um sinal de que o plano de contas dessa unidade cresceu além do esperado.' });
    }
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ erro: 'requisicao_invalida', mensagem: err.message || 'Requisição inválida.' });
    }
    res.status(500).json({ erro: 'erro_interno' });
  });

  return app;
}
