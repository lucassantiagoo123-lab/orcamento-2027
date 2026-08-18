# Migrações de banco

Pedido de 2026-08-16: parar de acumular ajustes de schema feitos à mão no
editor SQL do Railway.

## Como funciona

- Cada arquivo `NNNN_descricao.sql` aqui dentro é uma migração, numerada em
  ordem (`0001_...`, `0002_...`, ...).
- `backend/src/server.js` chama `rodarMigracoes()` (de
  `backend/src/db/migrate.js`) **antes** de `app.listen` — a cada deploy, o
  próprio servidor aplica sozinho as migrações que ainda não rodaram nesse
  banco, registrando cada uma na tabela `schema_migrations`.
- Se uma migração falhar, o servidor **não sobe** (fica melhor um deploy
  travado, visível no Railway, do que a aplicação rodando contra um schema
  pela metade).
- Nenhuma ação manual no Railway é necessária para aplicar uma migração
  nova — só dar `git push` (o deploy do backend cuida do resto).

## Como adicionar uma migração nova

1. Criar `NNNN_descricao_curta.sql` aqui, com o próximo número.
2. Escrever SQL idempotente sempre que der (`IF NOT EXISTS` / `IF EXISTS`) —
   protege contra a migração já ter sido aplicada manualmente antes deste
   sistema existir (foi o caso da 0001), e contra reprocessamento acidental.
3. Commitar junto com o código que depende da mudança de schema, e dar push.

## Por que fica em `backend/db/migrations`, não em `db/` (raiz do repo)

O `Dockerfile` do backend só copia o que está dentro de `backend/` para a
imagem publicada no Railway. O `db/schema.sql` da raiz do repositório
continua existindo — é a referência do estado final do schema, usada pelos
testes automatizados (`backend/test/helpers.js`) para montar um banco de
teste do zero — mas nunca foi (e não precisa ser) copiado para dentro do
container em produção. As migrações precisam estar dentro de `backend/`
para existirem de fato no container que roda `rodarMigracoes()`.
