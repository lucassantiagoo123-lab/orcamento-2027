# Backup para o SharePoint (camada 2 de redundância)

Contexto: pedido de 2026-08-31 ("todo dado inputado precisa estar 100%
salvo" — os gestores já começaram a preencher o orçamento real). Duas
camadas:

- **Camada 1** (já existe): Railway → serviço Postgres → aba **Backups**.
  Protege contra erro de aplicação/exclusão acidental, mas não sobrevive
  a um problema na própria conta/projeto Railway (billing, exclusão).
- **Camada 2** (esta pasta): dump diário do banco, comprimido, enviado
  pro SharePoint do FP&A — fora do Railway inteiramente.

## 1. Autorizar o rclone contra o SharePoint (uma vez, por um humano)

Isto **não pode ser feito por automação** — precisa do login real de
alguém com acesso ao site/biblioteca do SharePoint do FP&A.

1. Instale o rclone: <https://rclone.org/downloads/> (Windows:
   `winget install Rclone.Rclone` no PowerShell).
2. Rode `rclone config` num terminal.
3. `n` (New remote) → nome: `onedrive-fpa` (se usar outro nome, ajuste a
   variável `PASTA_REMOTA` do passo 3 de acordo).
4. Tipo de storage: procure `onedrive` na lista.
5. Deixe `client_id`/`client_secret` em branco (usa o app público do
   rclone — não depende de App Registration da empresa no Entra ID).
6. `Edit advanced config?` → `n`.
7. `Use auto config?` → `y` — abre o navegador pedindo login Microsoft.
   Faça login com a conta que tem acesso ao site do FP&A.
8. Quando perguntar o tipo de drive: escolha **Sharepoint site**, depois
   selecione (por busca) o site/biblioteca certos.
9. Confirme a configuração (`y`) e saia (`q`).

Isso grava um arquivo local (normalmente
`~/.config/rclone/rclone.conf` no Linux/Mac, ou
`%APPDATA%\rclone\rclone.conf` no Windows) com um **token de acesso — não
sua senha**. Gere o valor em base64 pra colar como variável de ambiente:

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:APPDATA\rclone\rclone.conf")) | Set-Clipboard
# já fica copiado — cole direto na variável RCLONE_CONFIG_BASE64 do Railway
```

```bash
# Linux/Mac
base64 -w0 ~/.config/rclone/rclone.conf
```

**Nunca** cole esse conteúdo em código-fonte, chat, ou qualquer lugar
fora da caixa de variável de ambiente do Railway — é a chave de acesso ao
SharePoint.

## 2. Criar o serviço de backup no Railway

1. No projeto `dazzling-learning` → **+ New → GitHub Repo** (mesmo repo)
   → em **Settings**:
   - **Root Directory**: `backup`
   - Railway detecta o `Dockerfile` desta pasta sozinho.
2. Em **Variables**, adicione:

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   RCLONE_CONFIG_BASE64=<o valor em base64 do passo 1>
   PASTA_REMOTA=onedrive-fpa:Backups Orcamento 2027
   RETENCAO_DIAS=30
   ```

3. Em **Settings → Deploy → Cron Schedule**, defina a frequência —
   recomendado diário de madrugada, ex. `0 6 * * *` (6h UTC = 3h em
   horário de Brasília). Formato cron padrão (minuto hora dia mês
   dia-da-semana).
4. **Não** gere domínio público pra esse serviço — ele não expõe nada,
   só executa e sai.

## 3. Testar

Depois de configurado, force um deploy manual (Railway → serviço de
backup → **Deploy**) e confira em **View Logs** se apareceu
`[backup] ... concluído com sucesso`. Confira também no SharePoint se o
arquivo `orcamento2027_AAAA-MM-DD_HHMMSS.sql.gz` chegou na pasta.

## 4. Restaurar, se precisar

```bash
# baixa o dump do SharePoint (manual, pelo navegador ou rclone copy) e:
gunzip -c orcamento2027_2027-XX-XX_HHMMSS.sql.gz | psql "$DATABASE_URL"
```

Faça isso só contra um banco vazio/de teste primeiro — restaurar em cima
de um banco com dado novo mais recente sobrescreve esse dado novo.
