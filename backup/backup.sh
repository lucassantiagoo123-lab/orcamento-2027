#!/usr/bin/env bash
# Backup do Postgres de produção para o SharePoint do FP&A — camada 2 de
# redundância (pedido de 2026-08-31: "todo dado inputado precisa estar
# 100% salvo" — os gestores já começaram a preencher o orçamento real).
#
# Camada 1 (já existe, dentro do Railway): Postgres > aba Backups —
# protege contra erro de aplicação ou exclusão acidental de linha/tabela,
# mas NÃO protege se a conta/projeto Railway tiver qualquer problema
# (billing, exclusão do projeto). Camada 2 é este script: um dump
# independente, fora da infraestrutura do Railway, no SharePoint da
# empresa — sobrevive a qualquer problema que afete as duas camadas
# anteriores ao mesmo tempo.
#
# Roda como serviço Railway próprio (pasta `backup/` como Root
# Directory), agendado via Cron Schedule — nunca fica online contínuo,
# só executa e sai. Variáveis de ambiente esperadas (ver README.md desta
# pasta para o passo a passo completo de configuração):
#   DATABASE_URL          — referência ${{Postgres.DATABASE_URL}} (Railway
#                            já injeta isso automaticamente ao linkar o
#                            serviço; string de conexão do Postgres)
#   RCLONE_CONFIG_BASE64  — conteúdo do rclone.conf gerado no passo de
#                            autorização (rclone config), em base64 —
#                            NUNCA commitar isso no repo, só como
#                            variável de ambiente no Railway (Secret)
#   PASTA_REMOTA           — caminho no SharePoint, ex.:
#                            "onedrive-fpa:Backups Orcamento 2027"
#                            (o nome antes de ":" tem que bater com o
#                            nome do remote dado em `rclone config`)
#   RETENCAO_DIAS          — opcional, default 30 — backups mais antigos
#                            que isso são apagados do SharePoint (o
#                            Postgres em si e a Camada 1 não são afetados)
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL não definida — configure como referência \${{Postgres.DATABASE_URL}} nas Variables deste serviço}"
: "${RCLONE_CONFIG_BASE64:?RCLONE_CONFIG_BASE64 não definida — ver README.md desta pasta}"
: "${PASTA_REMOTA:?PASTA_REMOTA não definida — ex.: 'onedrive-fpa:Backups Orcamento 2027'}"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"

DATA=$(date +%F_%H%M%S)
ARQUIVO="orcamento2027_${DATA}.sql.gz"
CAMINHO_LOCAL="/tmp/${ARQUIVO}"

echo "[backup] $(date -Iseconds) — iniciando dump..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$CAMINHO_LOCAL"
TAMANHO=$(du -h "$CAMINHO_LOCAL" | cut -f1)
echo "[backup] dump gerado: $ARQUIVO ($TAMANHO)"

echo "[backup] configurando rclone..."
mkdir -p /root/.config/rclone
echo "$RCLONE_CONFIG_BASE64" | base64 -d > /root/.config/rclone/rclone.conf
chmod 600 /root/.config/rclone/rclone.conf

echo "[backup] enviando para $PASTA_REMOTA ..."
rclone copy "$CAMINHO_LOCAL" "$PASTA_REMOTA/" --checksum

echo "[backup] aplicando retenção de $RETENCAO_DIAS dia(s)..."
# --min-age só afeta arquivos dentro de PASTA_REMOTA — se essa pasta for
# dedicada a backups (recomendado), é seguro; nunca aponte PASTA_REMOTA
# pra uma pasta com outros documentos do FP&A.
rclone delete "$PASTA_REMOTA/" --min-age "${RETENCAO_DIAS}d" || echo "[backup] aviso: limpeza de retenção falhou, backup de hoje já está salvo mesmo assim"

rm -f "$CAMINHO_LOCAL"
echo "[backup] $(date -Iseconds) — concluído com sucesso."
