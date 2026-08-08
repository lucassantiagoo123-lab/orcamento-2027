# Deploy — Orçamento 2027 (Caminho B)

## 1. Rodar local com Docker (sem instalar Node/Postgres)

**Pré-requisito único**: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
instalado e aberto (Windows, com WSL2 — o instalador guia por isso).

```bash
docker compose up --build
```

Primeira vez demora alguns minutos (baixa as imagens, builda o backend e o
frontend, sobe o Postgres e já roda `db/schema.sql` + os dois seeds
automaticamente). Depois disso:

- Aplicação: **http://localhost:8080**
- API sozinha (health check): http://localhost:8080/health

### Como entrar sem o SSO existir ainda

O App Registration no Entra ID ainda não existe (pendência registrada na
Fase 2), então "Entrar com Microsoft" fica desabilitado. Para testar a
interface multiusuário mesmo assim, o `docker-compose.yml` liga um
**login de desenvolvimento sem senha** (`DEV_LOGIN_ENABLED=true`): na tela de
login, uma segunda caixa aparece pedindo só um e-mail. Use qualquer e-mail já
cadastrado no seed — por exemplo:

| E-mail | Perfil | O que você vê |
|---|---|---|
| `lucas.santiago@grupoara.com.br` | Admin FP&A | Visão consolidada + botão "⚙ Administração" |
| `patricia.marques@grupoara.com.br` | Gerente de Unidade (Têxtil) | Só o formulário da ARA Têxtil |
| `carlos.campello@grupoara.com.br` | Gerente de CC — Corporativo | Painel de referência do Corporativo |

Lista completa em [db/seed_usuarios.sql](db/seed_usuarios.sql). Esse login é
propositalmente inseguro — **nunca** habilitar `DEV_LOGIN_ENABLED=true` num
ambiente que outras pessoas acessam (ver aviso em
[backend/src/auth/routes.js](backend/src/auth/routes.js)).

### Comandos úteis

```bash
docker compose logs -f backend    # ver logs do backend em tempo real
docker compose down               # parar tudo
docker compose down -v            # parar e apagar o banco (recomeça do zero)
docker compose run --rm backend node --test test/   # rodar os testes da Fase 8
                                                       # (aponte DATABASE_URL pra um banco de teste antes)
```

---

## 2. Indo para produção de verdade

O que muda do ambiente local para produção:

1. **Segredos**: gerar valores fortes para `SESSION_JWT_SECRET` (ex.:
   `openssl rand -hex 48`) e a senha do Postgres — os do `docker-compose.yml`
   são só para uso local, nunca reaproveitar.
2. **SSO**: preencher `AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`
   assim que o TI concluir o App Registration (ver `backend/README.md`), e
   **desligar `DEV_LOGIN_ENABLED`** (nem deixar a variável definida).
3. **`NODE_ENV=production`** — ativa `secure: true` nos cookies (só HTTPS) e
   é a segunda trava que impede o login-dev de existir por acidente.
4. **Banco gerenciado**: trocar o `db` do compose por um Postgres gerenciado
   (Azure Database for PostgreSQL — ver seção 8 da especificação, que
   recomenda Azure por já haver Microsoft 365 no grupo).
5. **HTTPS**: o `nginx.conf` local serve HTTP puro; em produção, TLS
   termina no serviço do Azure (App Service/Container Apps já fazem isso) ou
   precisa ser configurado explicitamente.

### Caminho sugerido: Azure Container Apps

Os `Dockerfile` de `backend/` e `frontend/` já servem como estão — Container
Apps builda a partir deles sem mudança de código:

```bash
az group create --name rg-obz2027 --location brazilsouth

az postgres flexible-server create \
  --resource-group rg-obz2027 --name obz2027-db \
  --admin-user obzadmin --admin-password '<senha-forte>' \
  --sku-name Standard_B1ms --tier Burstable

az containerapp env create --name obz2027-env --resource-group rg-obz2027 --location brazilsouth

az containerapp create --name obz2027-backend --resource-group rg-obz2027 \
  --environment obz2027-env --source ./backend --target-port 3000 --ingress external \
  --env-vars DATABASE_URL=secretref:database-url SESSION_JWT_SECRET=secretref:session-secret \
             NODE_ENV=production FRONTEND_ORIGIN=https://<url-do-frontend>

az containerapp create --name obz2027-frontend --resource-group rg-obz2027 \
  --environment obz2027-env --source ./frontend --target-port 80 --ingress external
```

(Comandos ilustrativos — ajustar nomes, região, SKUs e segredos via
`az containerapp secret set` antes de rodar de verdade. **Não executei nada
disto** — não tenho acesso à sua assinatura Azure nem à sua infraestrutura;
isto é o roteiro, não uma execução.)

---

## O que eu não fiz

- Não rodei `docker compose up` neste ambiente (Docker também não está
  disponível aqui, só verificado que Node não está). Os `Dockerfile` e o
  `docker-compose.yml` foram revisados por leitura, não testados em
  execução real.
- Não provisionei nenhum recurso Azure — a seção acima é um roteiro de
  comandos, não uma ação já tomada.
- Os testes da Fase 8 continuam não executados — depois de subir o compose,
  rodar `docker compose run --rm backend node --test test/` (com
  `DATABASE_URL` apontando para um banco `*test*` separado) é o próximo
  passo antes de confiar neles.
