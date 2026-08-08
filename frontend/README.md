# OBZ 2027 — frontend (Caminho B)

## Setup

```bash
npm install
npm run dev
```

Assume o backend rodando em `http://localhost:3000` (proxy configurado em
`vite.config.js` para `/api` e `/auth`). Sem SSO configurado no backend
(`AZURE_TENANT_ID`/`CLIENT_ID`/`CLIENT_SECRET` vazios), o botão "Entrar com
Microsoft" leva a um `/auth/login` que responde `503` — esperado até o TI
registrar o app no Entra ID.

## O que foi migrado do protótipo

`src/OrcamentoARA.jsx` é o `OrcamentoARA.jsx` do Caminho A, com a lógica de
negócio intacta (nenhuma função de cálculo foi tocada) e a camada de I/O
trocada:

| Antes (Caminho A) | Agora (Caminho B) |
|---|---|
| `window.storage.get/set('ara-orc:unidade:...')` | `GET/PUT /api/orcamentos/:unidadeId` (`src/api/orcamentos.js`) |
| `window.storage.get('ara-orc:versoes:...')` | `GET /api/orcamentos/:unidadeId/versoes` |
| `role` = toggle livre (`useState('gerente')`) | `role` derivado de `usuario.perfil` (sessão real, via `/auth/me`) |
| Formulário aberto para editar qualquer unidade | `unidadesVisiveis` restrito a `usuario.unidadesPermitidas` (proteção de verdade é no backend — isto é só UX) |
| `autorNome` = campo de texto livre | Pré-preenchido com `usuario.nome`; autor real gravado no banco é `req.usuario.id` do backend, não o texto |

`src/AppGate.jsx` resolve a sessão (`/auth/me`) antes de montar
`OrcamentoARA` — sem isso o componente não sabe o perfil/escopo real do
usuário logado.

## Pendência real: 3 chaves sem tabela no banco

`backlog` (histórico consolidado do FP&A), `etapasProcesso` (etapas do ciclo
orçamentário) e `premissasMacro` (IPCA/câmbio/Selic/PIB) existiam no
protótipo via `window.storage` — uma API do host do artefato Claude.ai que
**não existe em produção**. `src/legacyStorage.js` troca isso por
`localStorage` do navegador, o que evita a aplicação quebrar, mas:

- **Não é multiusuário** para essas três coisas especificamente — cada
  navegador tem sua própria cópia, sem sincronizar entre gerentes/FP&A.
- Nenhuma das três está no schema de `../db/schema.sql` — a especificação
  não as modela (ela cobre `usuarios`, `orcamentos`, `orcamento_versoes`,
  `log_alteracoes`, não backlog/etapas/premissas macro).

Antes de produção, decidir com o FP&A: viram tabelas novas (schema change
fora do escopo original) ou ficam mesmo como conveniência local?

## Não testado em runtime

Como neste ambiente de desenvolvimento não há Node.js instalado, não rodei
`npm install` nem `npm run dev` para validar isto de fato renderiza e
funciona contra o backend. O código foi revisado por leitura e checado por
balanceamento de chaves/parênteses, não testado. Antes de confiar nisto,
rode localmente os dois lados (backend + frontend) e teste ao menos:

1. Login (quando o SSO estiver configurado).
2. Carregar/editar/salvar o orçamento da ARA Têxtil como `gerente_unidade`.
3. Confirmar que Agrícola/Resorts/Corporativo mostram o painel de referência,
   sem tentar salvar.
4. Visão consolidada como `admin_fpa`.
