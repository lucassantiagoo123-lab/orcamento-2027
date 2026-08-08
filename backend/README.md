# OBZ 2027 — backend (Caminho B)

## Setup

```bash
cp .env.example .env
# edite .env: pelo menos DATABASE_URL e SESSION_JWT_SECRET
npm install
npm run dev
```

Sem `AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET` preenchidos, o
servidor sobe normalmente, mas `/auth/login` e `/auth/callback` respondem
`503 sso_nao_configurado` — é o estado esperado até o TI registrar o app no
Entra ID (ver `.env.example`). O resto do backend (banco, `/health`) funciona
sem SSO.

## Banco de dados

Rodar, nessa ordem, contra o Postgres apontado por `DATABASE_URL`:

```bash
psql "$DATABASE_URL" -f ../db/schema.sql
psql "$DATABASE_URL" -f ../db/seed_usuarios.sql
psql "$DATABASE_URL" -f ../db/seed_referencia.sql
```

## Testes de autorização (seção 6 da especificação)

```bash
createdb obz2027_test   # ou equivalente no seu Postgres
DATABASE_URL=postgresql://usuario:senha@localhost:5432/obz2027_test npm test
```

`npm test` roda `node --test test/` (runner nativo do Node — sem dependência
nova). Os testes rodam contra um banco Postgres **real** (não mocks — a regra
sob teste é justamente "confiar no banco, não no cliente"), e `resetarBanco()`
recria o schema do zero a cada arquivo de teste. Por segurança,
`test/helpers.js` recusa rodar se `DATABASE_URL` não contiver `test` no nome —
não aponte para o banco de desenvolvimento/produção.

Cobertura dos 6 casos da seção 6:

| # | Caso | Arquivo |
|---|---|---|
| 1 | Gerente de Unidade não lê/escreve outra unidade | `test/autorizacao.test.js` |
| 2 | Gerente de CC não acessa CC fora da lista | `test/autorizacao.test.js` (unitário — ver nota de escopo no arquivo: não há rota HTTP por CC ainda) |
| 3 | Concessão expirada perde acesso sozinha | `test/concessao.test.js` |
| 4 | Orçamento aprovado rejeita escrita não-admin | `test/bloqueio-e-auditoria.test.js` |
| 5 | Toda escrita pós-elaboração gera log | `test/bloqueio-e-auditoria.test.js` |
| 6 | Usuário inativo não autentica | `test/autorizacao.test.js` |

**Não executei estes testes neste ambiente** (sem Node.js/Postgres
disponíveis) — foram escritos e revisados por leitura, não rodados. Rode
localmente antes de confiar neles; é bem possível que a primeira rodada
encontre um erro de digitação ou um detalhe de schema que só aparece em
execução real.

## Estrutura

- `src/config.js` — variáveis de ambiente, com `ssoConfigurado` como guard.
- `src/auth/` — fluxo OIDC (Authorization Code + PKCE) contra o Entra ID, e a
  sessão própria da aplicação (cookie httpOnly, JWT curto — seção 5.2 e 4 da
  especificação).
- `src/middleware/authenticate.js` — resolve `req.usuario` (perfil, unidades e
  CCs permitidos) a partir do banco a cada request.
- `src/middleware/authorize.js` — primitivas de escopo (`exigirUnidade`,
  `exigirCc`, `exigirPerfil`) para as rotas de orçamento da Fase 3.
- `src/db/` — acesso a dados (sem ORM; queries explícitas contra o schema em
  `../db/schema.sql`).

## Quando o App Registration existir

1. Preencher `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` e
   `AZURE_REDIRECT_URI` em `.env`.
2. No Entra ID, cadastrar o mesmo `AZURE_REDIRECT_URI` como Redirect URI do
   tipo "Web" no App Registration.
3. Reiniciar o servidor — `ssoConfigurado` vira `true` automaticamente e as
   rotas `/auth/login`/`/auth/callback` passam a funcionar, sem mudança de
   código.
