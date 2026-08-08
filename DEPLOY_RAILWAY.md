# Deploy num link público (Railway, free tier)

⚠️ **Antes de fazer isto, leia**: este deploy vai ligar o login de
desenvolvimento (`DEV_LOGIN_ENABLED=true`) numa URL **pública** — qualquer
pessoa que tiver o link entra como qualquer usuário cadastrado, sem senha,
sem prova de identidade nenhuma (é assim que dá pra testar sem o SSO do
Entra ID ainda existir). Trate esse link como descartável: não compartilhe,
e apague o projeto no Railway assim que terminar de conferir — ou desligue
`DEV_LOGIN_ENABLED` e vá para o fluxo de SSO real assim que o TI concluir o
App Registration.

## 1. Colocar o código no GitHub

O repositório git já foi criado localmente (commit inicial já feito). Falta
só um repositório remoto — isso eu não posso fazer por você (exige sua
conta):

1. Crie um repositório vazio em https://github.com/new (ex.: `obz-2027-caminho-b`,
   pode ser privado).
2. **Não** marque "Add a README" — o repo local já tem tudo.
3. Copie a URL que o GitHub mostrar (algo como
   `https://github.com/SEU_USUARIO/obz-2027-caminho-b.git`) e rode, no terminal,
   dentro da pasta do projeto:

```bash
git remote add origin https://github.com/SEU_USUARIO/obz-2027-caminho-b.git
git branch -M main
git push -u origin main
```

(Vai pedir login do GitHub na primeira vez — siga o fluxo do navegador que
ele abrir.)

## 2. Criar o projeto no Railway

1. Crie conta em https://railway.app (dá pra entrar direto com a conta do GitHub).
2. **New Project → Deploy from GitHub repo** → selecione o repositório que
   você acabou de criar.
3. Railway vai tentar detectar um serviço automaticamente — apague esse
   serviço detectado, vamos criar os três manualmente (banco, backend,
   frontend), porque o repo tem mais de um Dockerfile.

## 3. Banco de dados

**+ New → Database → PostgreSQL.** O Railway já cria e expõe as variáveis de
conexão automaticamente (`DATABASE_URL` no formato do próprio Railway).

Depois de criado, abra a aba **Data** desse serviço e rode, colando o
conteúdo de cada arquivo na ordem:

1. [db/schema.sql](db/schema.sql)
2. [db/seed_usuarios.sql](db/seed_usuarios.sql)
3. [db/seed_referencia.sql](db/seed_referencia.sql)

(O Railway tem um editor SQL na aba Data — cole e rode cada arquivo inteiro.)

## 4. Serviço do backend

**+ New → GitHub Repo** (mesmo repo) → em **Settings**:
- **Root Directory**: `backend`
- Railway detecta o `Dockerfile` sozinho.

Em **Variables**, adicione:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}     # referencia o serviço de banco criado no passo 3
SESSION_JWT_SECRET=<gere um valor aleatório longo>
SESSION_TTL_MINUTES=30
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_REDIRECT_URI=
PORT=3000
NODE_ENV=development
DEV_LOGIN_ENABLED=true
FRONTEND_ORIGIN=<preenche depois de criar o frontend, passo 5>
```

Em **Settings → Networking**, gere um domínio público (`Generate Domain`) —
anote a URL, algo como `obz2027-backend-production.up.railway.app`.

## 5. Serviço do frontend

**+ New → GitHub Repo** (mesmo repo de novo) → em **Settings**:
- **Root Directory**: `frontend`

O `frontend/nginx.conf` faz proxy de `/api` e `/auth` para um serviço chamado
`backend` — no Railway isso não existe por nome assim, então antes do deploy
troque, no `frontend/nginx.conf`, as duas linhas `proxy_pass http://backend:3000;`
pela URL pública do backend do passo 4:

```
proxy_pass https://obz2027-backend-production.up.railway.app;
```

Faça essa edição, `git commit` + `git push` — o Railway rebuilda sozinho a
cada push.

Gere um domínio público pra esse serviço também (**Settings → Networking →
Generate Domain**) — essa é a URL final da aplicação.

Volte no serviço do **backend** e preencha `FRONTEND_ORIGIN` com essa URL do
frontend, e em `AZURE_REDIRECT_URI` (mesmo vazio por enquanto) — redeploy.

## 6. Testar

Abra a URL do frontend. Na tela de login, use a caixa de "login de
desenvolvimento" com um e-mail de [db/seed_usuarios.sql](db/seed_usuarios.sql)
— por exemplo `lucas.santiago@grupoara.com.br` para ver a visão de admin.

## Quando terminar de conferir

- Se for continuar usando: desligue `DEV_LOGIN_ENABLED` assim que o SSO do
  Entra ID estiver configurado (Fase 2), e mude `NODE_ENV` para `production`.
- Se era só para você olhar agora: **apague o projeto no Railway**
  (Settings → Danger → Delete Project) para não deixar uma URL com login sem
  senha pública indefinidamente.

## O que eu não fiz

Nada disto foi executado — não tenho conta no GitHub nem no Railway, e essas
duas etapas exigem as suas credenciais. Preparei o repositório git local
(commit já feito) e este roteiro; a execução é sua, passo a passo, num
navegador.
