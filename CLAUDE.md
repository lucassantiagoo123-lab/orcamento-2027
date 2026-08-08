# Orçamento 2027 (OBZ) — Grupo ARA — Caminho B

Este é o projeto de migração do protótipo de Orçamento Base Zero do Grupo ARA (Caminho A,
um artefato React/HTML único, sem backend) para uma aplicação real, multiusuário, com
autenticação e permissões de verdade (Caminho B).

## Arquivos deste diretório

- **`Especificacao_Caminho_B_Multiusuario.md`** — especificação técnica do que precisa
  ser construído nesta fase: perfis de acesso, matriz de permissões, schema de banco
  (usuários, vínculos de unidade/CC, concessões temporárias, orçamentos, versões, log de
  alterações), regras de autorização, opções de autenticação, e plano de testes. **Leia
  este arquivo primeiro, por completo, antes de propor qualquer implementação.**
- **`OrcamentoARA.jsx`** — fonte de verdade do protótipo atual (Caminho A). Contém toda a
  lógica de negócio já validada numericamente: `computeDRE`, `computeDFC`,
  `computeFluxoIndiretoMensal`, `computeFluxoCaixaDiretoMensal`, `computeSensibilidade`,
  `computePlano5Y`, `computeFolhaPessoalMes/Anual`, `runAuditoria`, e as constantes de
  plano de contas (`PLANO_CONTAS`, `PACOTES_TEXTIL`, `PLANO_CONTAS_AGRICOLA/RESORTS`,
  `CCS_CORPORATIVO`). **Essa lógica deve ser reaproveitada, não reescrita** — só muda a
  camada de persistência (`window.storage` vira chamadas a uma API real) e passa a
  respeitar o escopo de acesso do usuário autenticado.

## Estado atual do protótipo (Caminho A), para contexto

- **ARA Têxtil**: fluxo completo de orçamento (Receita, Custos e Despesas por CC ×
  Conta × Pacote, CAPEX, Capital de Giro, Provisões, FC Financiamentos, Balanço, Plano
  5Y, Revisão/Análise/Envio). Plano de contas oficial (167 contas, 11 pacotes), fonte:
  Matriz_Governanca_OBZ_2027_4.xlsx.
- **ARA Agrícola e ARA Resorts**: só um painel de referência de governança (conta ×
  pacote), sem fluxo de orçamento habilitado — a matriz oficial dessas unidades não traz
  Centro de Custo, e o modelo de dados é `Unidade × CC × Pacote × Conta × Mês`. Isso é
  uma pendência de dado-fonte, não de código; não inventar CC para essas unidades.
  Enquanto durar, mantenha o mesmo comportamento no Caminho B: painel de referência, não
  formulário de lançamento.
- **Corporativo**: mesma situação — 20 CCs oficiais e confiáveis (fonte:
  Base_Corporativo.xlsx), mas as contas analíticas do mesmo arquivo não vêm pareadas por
  CC (é uma pendência de qualidade de dado na fonte, documentada). Painel de referência,
  sem lançamento, até o FP&A corrigir o De/Para.
- **ARA EI e ARA Energia**: sem dado nenhum ainda (placeholder).
- Já existem: Análise de Sensibilidades (cenários Base/Otimista/Pessimista), toggle DRE
  com/sem IFRS 18, gráficos Bridge (Receita→EBITDA, EBITDA→FCO), importação de
  funcionários via Excel, Plano 5Y (2028-2031).

## O que fazer nesta fase

Implementar exatamente o que está em `Especificacao_Caminho_B_Multiusuario.md`: banco de
dados real (Postgres), autenticação (login/senha ou SSO — decisão em aberto, ver seção 5
do documento), os três perfis de acesso (Admin FP&A, Gerente de Unidade, Gerente de CC do
Corporativo) com autorização **aplicada no servidor**, e migração da lógica de cálculo do
`OrcamentoARA.jsx`.

## Primeira tarefa

Não escreva código ainda. Leia os dois arquivos por completo e devolva um plano de
implementação em fases, na ordem sugerida na seção 8 da especificação. Aguarde aprovação
antes de começar a implementar.
