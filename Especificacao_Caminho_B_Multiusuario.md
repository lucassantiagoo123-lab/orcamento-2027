# Caminho B — Especificação Técnica: Multiusuário e Controle de Acesso
## Orçamento 2027 (OBZ) — Grupo ARA

Documento de handoff para implementação no Claude Code. Cobre exclusivamente o item 9 do
escopo (Interface Multiusuário e Controle de Acesso) e o que é estritamente necessário para
sustentá-lo: persistência real, autenticação e autorização por perfil.

---

## 1. Objetivo e escopo

O protótipo atual (`OrcamentoARA.html`/`.jsx`, Caminho A) roda inteiro no navegador, sem
servidor, com `window.storage` como persistência. A troca de "papel" (Gerente/FP&A) é uma
simulação de interface, sem autenticação real — qualquer pessoa com o arquivo vê e edita
dados de qualquer unidade. Isso é adequado para prototipagem, mas não sustenta um processo
de governança orçamentária real.

Este documento especifica a aplicação real (Caminho B): login por usuário e senha, três
perfis de acesso, e escopo de dados aplicado no servidor — não apenas escondido na
interface. A lógica de negócio já validada no protótipo (`computeDRE`, `computeDFC`,
`computeFluxoIndiretoMensal`, `computeFluxoCaixaDiretoMensal`, `computeSensibilidade`,
`computePlano5Y`, a folha de pessoal, a Auditoria) deve ser **reaproveitada**, não
reescrita — ela já está testada numericamente. O que muda é onde os dados moram e quem
pode ler/escrever o quê.

---

## 2. Perfis e matriz de permissões

### 2.1 Administrador FP&A
Acesso completo. Enxerga e edita todas as unidades e todos os CCs, gerencia usuários e
permissões, corrige classificações do De/Para (Matriz de Governança), aprova etapas do
fluxo, consolida informações.

### 2.2 Gerente da Unidade
Um usuário por unidade de negócio (ARA Têxtil, ARA Agrícola, ARA Resorts, ARA EI, ARA
Energia). Acesso de leitura e escrita **exclusivamente** à própria unidade — orçamento,
premissas, DRE, gráficos Bridge, Análise de Sensibilidades, histórico, revisão e envio
para aprovação. Sem acesso a outras unidades, em nenhuma hipótese.

### 2.3 Gerente de Centro de Custo — Corporativo
Um usuário por CC (ou por grupo de CCs) dentro do Corporativo. Acesso de leitura e escrita
apenas aos CCs sob sua responsabilidade — orçamento, valores, histórico, DRE do(s) seu(s)
CC(s), análises, revisão e envio. Sem acesso a outros CCs do Corporativo, salvo autorização
explícita do FP&A (ver 4.4 — Concessão temporária de acesso).

### 2.4 Matriz de permissões por recurso

| Recurso / Ação | Admin FP&A | Gerente Unidade | Gerente CC Corporativo |
|---|---|---|---|
| Visualizar todas as unidades | Sim | Não (só a própria) | Não (só o Corporativo) |
| Visualizar todos os CCs | Sim | Sim, dentro da própria unidade | Não (só os seus CCs) |
| Inserir/editar premissas | Sim, qualquer unidade | Sim, só a própria unidade | Sim, só os seus CCs |
| Inserir/editar orçamento | Sim, qualquer unidade | Sim, só a própria unidade | Sim, só os seus CCs |
| Excluir premissas | Sim | Não | Não |
| Visualizar DRE / Bridge / Sensibilidades | Sim, todas | Sim, só a própria unidade | Sim, só os seus CCs |
| Visualizar histórico/auditoria | Sim, todas | Sim, só a própria unidade | Sim, só os seus CCs |
| Revisar e enviar para aprovação | Sim | Sim, só a própria unidade | Sim, só os seus CCs |
| Aprovar etapas / desbloquear pós-aprovação | Sim | Não | Não |
| Consolidar informações (visão Grupo) | Sim | Não | Não |
| Corrigir De/Para (Matriz de Governança) | Sim | Não | Não |
| Gerenciar usuários e permissões | Sim | Não | Não |
| Editar Base_Corporativo (CCs/Classes válidos) | Sim | — | Não |

Esta matriz é a fonte de verdade para os testes de autorização (ver seção 6).

---

## 3. Modelo de dados

### 3.1 Autenticação e autorização

```sql
-- Usuários
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT,              -- NULL se login for via SSO (ver seção 5.2)
  perfil        TEXT NOT NULL CHECK (perfil IN ('admin_fpa', 'gerente_unidade', 'gerente_cc_corporativo')),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_login  TIMESTAMPTZ
);

-- Vínculo Gerente de Unidade -> unidade (1 usuário : 1 unidade, mas modelado N:N para flexibilidade futura)
CREATE TABLE usuario_unidade (
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id  TEXT NOT NULL,   -- 'textil' | 'agricola' | 'resorts' | 'ei' | 'energia'
  PRIMARY KEY (usuario_id, unidade_id)
);

-- Vínculo Gerente de CC (Corporativo) -> CC(s)
CREATE TABLE usuario_cc_corporativo (
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cc_codigo   TEXT NOT NULL,    -- código do CC, conforme Base_Corporativo
  PRIMARY KEY (usuario_id, cc_codigo)
);

-- Concessões temporárias de acesso (item 9.3 — "salvo autorização do FP&A")
CREATE TABLE concessao_acesso_temporaria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES usuarios(id),
  cc_codigo         TEXT NOT NULL,
  concedido_por     UUID NOT NULL REFERENCES usuarios(id),  -- deve ser admin_fpa
  motivo            TEXT NOT NULL,
  valido_de         TIMESTAMPTZ NOT NULL DEFAULT now(),
  valido_ate        TIMESTAMPTZ NOT NULL,
  revogado_em       TIMESTAMPTZ
);

-- Sessões (se não usar JWT stateless — ver seção 5)
CREATE TABLE sessoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em     TIMESTAMPTZ NOT NULL,
  ip_origem     TEXT,
  user_agent    TEXT
);
```

### 3.2 Dados de orçamento

A estrutura já existe e está validada no protótipo — é o objeto retornado por
`emptyFormData()` em `OrcamentoARA.jsx` (`estrategicas`, `receita`, `custos`, `capex`,
`capitalGiro`, `provisoes`, `fcFinanciamentos`, `balanco`, `plano5y`, `sensibilidades`,
`meta`). Recomendação: manter esse objeto como um documento (`JSONB` em Postgres) por
unidade/versão, em vez de normalizar cada campo em tabelas relacionais — evita uma
reescrita grande do código de cálculo já testado, e o Postgres indexa/consulta JSONB bem.

```sql
CREATE TABLE orcamentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    TEXT NOT NULL,
  ano           INT NOT NULL DEFAULT 2027,
  dados         JSONB NOT NULL,      -- o objeto emptyFormData() preenchido
  status        TEXT NOT NULL DEFAULT 'nao_iniciado'
                  CHECK (status IN ('nao_iniciado','em_elaboracao','em_revisao','em_analise','enviado','aprovado')),
  bloqueado     BOOLEAN NOT NULL DEFAULT false,  -- true após aprovação (ver seção 7)
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES usuarios(id)
);

CREATE TABLE orcamento_versoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  UUID NOT NULL REFERENCES orcamentos(id),
  dados         JSONB NOT NULL,       -- snapshot completo no momento do envio
  autor_id      UUID NOT NULL REFERENCES usuarios(id),
  comentario    TEXT,
  totais        JSONB,                -- { receitaLiquida, ebitda, lucroLiquido, ... } para listagem rápida
  enviado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 Auditoria (item 11 do escopo original)

```sql
CREATE TABLE log_alteracoes (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id),
  unidade_id    TEXT NOT NULL,
  cc_codigo     TEXT,
  conta_codigo  TEXT,
  pacote_id     TEXT,
  campo         TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo    TEXT,
  motivo        TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Toda escrita em `orcamentos.dados` que ocorra **após** o status passar de
`em_elaboracao` deve gerar uma linha aqui (trigger de banco ou middleware da API —
recomendo middleware, para poder registrar `usuario_id` do request).

---

## 4. Regras de autorização (enforcement)

A regra central: **a interface esconder algo não é controle de acesso.** Toda validação
de escopo precisa acontecer na API, sobre o `usuario_id` autenticado do token/sessão —
nunca confiar em um `unidade_id` enviado pelo cliente sem checar contra o vínculo real do
usuário no banco.

### 4.1 Gerente de Unidade
```
SE usuario.perfil == 'gerente_unidade':
    unidades_permitidas = SELECT unidade_id FROM usuario_unidade WHERE usuario_id = :id
    TODA rota de leitura/escrita de orçamento DEVE filtrar unidade_id IN unidades_permitidas
    REJEITAR (403) qualquer request para unidade_id fora dessa lista
```

### 4.2 Gerente de CC — Corporativo
```
SE usuario.perfil == 'gerente_cc_corporativo':
    ccs_permitidos = SELECT cc_codigo FROM usuario_cc_corporativo WHERE usuario_id = :id
                     UNION
                     SELECT cc_codigo FROM concessao_acesso_temporaria
                     WHERE usuario_id = :id AND revogado_em IS NULL AND now() BETWEEN valido_de AND valido_ate
    TODA rota de leitura/escrita DEVE filtrar cc_codigo IN ccs_permitidos, dentro de unidade_id = 'corporativo'
    REJEITAR (403) qualquer CC fora dessa lista
```

### 4.3 Admin FP&A
Sem filtro de escopo — mas toda ação sensível (excluir premissa, aprovar etapa, corrigir
De/Para, gerenciar usuário) deve passar por confirmação explícita na interface e gerar
registro em `log_alteracoes`, mesmo sendo permitida.

### 4.4 Concessão temporária de acesso
Implementa literalmente "salvo autorização do FP&A" do item 9.3: só um `admin_fpa` pode
inserir em `concessao_acesso_temporaria`; a concessão tem validade (`valido_ate`) e pode
ser revogada antes do prazo. A tela de administração deve listar concessões ativas e
permitir revogação com um clique.

### 4.5 Bloqueio pós-aprovação (item 10)
```
SE orcamentos.status == 'aprovado' E orcamentos.bloqueado == true:
    REJEITAR (403) qualquer escrita, EXCETO se usuario.perfil == 'admin_fpa'
    (admin_fpa que edite após aprovação deve informar motivo — grava em log_alteracoes.motivo)
```

---

## 5. Autenticação — duas opções

### Opção A — Login e senha próprios
Implementação padrão: `bcrypt`/`argon2` para hash de senha, JWT de curta duração (15–30
min) + refresh token, ou sessão em `sessoes` com cookie `httpOnly` + `secure`. Exige
política de senha, fluxo de "esqueci minha senha" (envio de e-mail), e bloqueio após N
tentativas falhas.

### Opção B — SSO com Microsoft 365 (Entra ID)
O Grupo ARA já usa Microsoft 365. Se o AD/Entra ID for centralizado, autenticar via
OAuth2/OIDC contra o Entra ID elimina a necessidade de gerenciar senha própria, herda a
política de senha e MFA que a empresa já tem, e reduz a superfície de risco deste sistema
(nenhuma senha nova para vazar). O perfil (`admin_fpa`/`gerente_unidade`/
`gerente_cc_corporativo`) e os vínculos de unidade/CC continuam sendo geridos na tabela
`usuarios` — o Entra ID só resolve "quem é essa pessoa", não "o que ela pode fazer aqui".

**Recomendo a Opção B**, mas isso depende de decisão sua e de TI (se há Entra ID
centralizado, se o FP&A tem como registrar um app AD, prazo). Não escolhi por você — é
uma decisão de infraestrutura, não só de código.

---

## 6. Plano de testes de autorização

Antes de considerar o controle de acesso pronto, validar (idealmente com testes
automatizados, não só manuais):

1. Gerente da Unidade Têxtil autenticado não consegue ler nem escrever dados de
   `unidade_id = 'agricola'` via API, mesmo manipulando o request diretamente (não só pela
   interface).
2. Gerente de CC Corporativo autenticado não consegue ler nem escrever dados de um CC fora
   da sua lista, mesmo trocando o `cc_codigo` no request.
3. Concessão temporária expirada deixa de dar acesso automaticamente, sem necessidade de
   ação manual.
4. Orçamento com `status = 'aprovado'` rejeita escrita de qualquer perfil que não seja
   `admin_fpa`.
5. Toda escrita após `em_elaboracao` gera uma linha correspondente em `log_alteracoes`.
6. Usuário inativo (`ativo = false`) não consegue autenticar, mesmo com sessão/token
   ainda não expirado.

---

## 7. Migração da lógica do protótipo

Reaproveitar diretamente (só trocar a camada de I/O, a lógica de cálculo já está testada):

- `computeDRE`, `computeDFC`, `computeFluxoIndiretoMensal`, `computeFluxoCaixaDiretoMensal`
- `computeFolhaPessoalMes/Anual`, `folhaAnualPorCC`
- `computeSensibilidade`, `computePlano5Y`
- `runAuditoria` (a Auditoria de integridade da planilha, não confundir com
  `log_alteracoes` — são propósitos diferentes: uma valida consistência do orçamento, a
  outra rastreia quem mudou o quê)
- `PLANO_CONTAS`, `PACOTES_TEXTIL`, `PLANO_CONTAS_AGRICOLA/RESORTS`, `CCS_CORPORATIVO` —
  viram tabelas de referência no banco (`contas`, `pacotes`, `centros_custo`), com a
  Matriz de Governança oficial como fonte de carga inicial (seed).

Trocar: `window.storage.get/set` por chamadas HTTP para a API real; os `useState` de
formulário continuam iguais no front, só o `useEffect` que carrega/salva muda de alvo.

---

## 8. Stack recomendada

- **Banco**: PostgreSQL (já era o destino documentado do projeto).
- **Backend**: Node.js (Express/Fastify) ou Python (FastAPI) — qualquer um serve; Node
  mantém a mesma linguagem do front, o que facilita reaproveitar as funções de cálculo
  quase sem tradução.
- **Frontend**: mesma base React do protótipo, migrada de artefato único para projeto com
  build (Vite), consumindo a API real.
- **Autenticação**: conforme seção 5.
- **Deploy**: a decidir conforme infraestrutura interna disponível (Azure, já que há
  Microsoft 365, é o caminho de menor atrito).

---

## 9. Decisões que ficam abertas para você

Não decidi sozinho porque são decisões de negócio/infraestrutura, não de código:

1. Login próprio ou SSO com Entra ID (seção 5).
2. Quem são, hoje, os Gerentes de CC do Corporativo e quais CCs cada um cobre — isso
   ainda depende do De/Para de `Base_Corporativo.xlsx` ser corrigido (pendência já
   registrada no protótipo).
3. Política de senha e duração de sessão, se optar pela Opção A.
4. Quem, além de você, deve ter perfil `admin_fpa` no lançamento do sistema.
5. Prazo e forma de migração dos dados já preenchidos no protótipo (se houver) para o
   banco real.
