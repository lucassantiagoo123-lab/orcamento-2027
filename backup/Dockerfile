# Serviço de backup — camada 2 de redundância dos dados do Orçamento 2027
# (pedido de 2026-08-31: "camada dupla de armazenamento... todo dado
# inputado precisa estar 100% salvo"). Ver backup.sh para o racional
# completo. Roda como serviço Railway separado, agendado via Cron
# Schedule (Settings > Deploy > Cron Schedule) — nunca fica online o
# tempo todo, só executa o script e sai.
#
# Base postgres:18-alpine (não alpine genérico): garante que o pg_dump
# instalado é da MESMA versão major do servidor de produção
# (ghcr.io/railwayapp-templates/postgres-ssl:18, confirmado no Railway em
# 2026-08-31) — pg_dump de versão desencontrada com o servidor é uma
# causa comum de dump incompleto/incompatível.
FROM postgres:18-alpine

# rclone: sobe o dump pro SharePoint do FP&A (autorizado uma vez, fora
# desta imagem, por um humano — ver README.md desta pasta, "config do
# rclone"). bash: o script usa sintaxe de bash, não sh puro (set -euo
# pipefail). gzip já vem no alpine base.
RUN apk add --no-cache rclone bash ca-certificates tzdata

WORKDIR /app
COPY backup.sh .
RUN chmod +x backup.sh

CMD ["./backup.sh"]
