-- =====================================================================================
-- Orçamento 2027 (OBZ) — Grupo ARA — Caminho B
-- Seed de usuários e vínculos — Fase 1
-- Fonte: lista fornecida pelo usuário em 2026-08-08 (chat).
-- Convenção de e-mail para quem não veio com e-mail explícito: nome.sobrenome@grupoara.com.br
-- =====================================================================================

-- ---------------------------------------------------------------------------
-- Unidades de referência
-- ---------------------------------------------------------------------------
INSERT INTO unidades (id, nome) VALUES
  ('textil', 'ARA Têxtil'),
  ('agricola', 'ARA Agrícola'),
  ('resorts', 'ARA Resorts'),
  ('ei', 'ARA EI'),
  ('energia', 'ARA Energia'),
  ('corporativo', 'Corporativo')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Admin FP&A
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, perfil) VALUES
  ('Lucas Santiago',  'lucas.santiago@grupoara.com.br',  'admin_fpa'),
  ('Renato Martins',  'renato.martins@grupoara.com.br',  'admin_fpa'),
  ('Luiz Melo',       'luiz.melo@grupoara.com.br',       'admin_fpa'),
  ('Enzo Perrusi',    'enzo.perrusi@grupoara.com.br',    'admin_fpa'),
  ('Brenndo Vieira',  'brenndo.vieira@grupoara.com.br',  'admin_fpa');

-- ---------------------------------------------------------------------------
-- Gerentes de Unidade (2 pessoas por unidade: Gerente + Diretor, ambos com o
-- mesmo escopo de acesso — só a própria unidade, conforme matriz seção 2.2)
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, perfil) VALUES
  ('Kleber Ribeiro',    'kleber.ribeiro@grupoara.com.br',    'gerente_unidade'),
  ('Alexander Borges',  'alexander.borges@grupoara.com.br',  'gerente_unidade'),
  ('Patricia Marques',  'patricia.marques@grupoara.com.br',  'gerente_unidade'),
  ('Jacinto Henriques', 'jacinto.henriques@grupoara.com.br', 'gerente_unidade'),
  ('Luiz Lima',         'luiz.lima@grupoara.com.br',         'gerente_unidade'),
  ('Adailton Nunes',    'adailton.nunes@grupoara.com.br',    'gerente_unidade'),
  ('Claudio Campelo',   'claudio.campelo@grupoara.com.br',   'gerente_unidade'),
  ('Ruy Rego',          'ruy.rego@grupoara.com.br',          'gerente_unidade');

INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT id, 'resorts' FROM usuarios WHERE email IN ('kleber.ribeiro@grupoara.com.br', 'alexander.borges@grupoara.com.br')
UNION ALL
SELECT id, 'textil' FROM usuarios WHERE email IN ('patricia.marques@grupoara.com.br', 'jacinto.henriques@grupoara.com.br')
UNION ALL
SELECT id, 'agricola' FROM usuarios WHERE email IN ('luiz.lima@grupoara.com.br', 'adailton.nunes@grupoara.com.br')
UNION ALL
SELECT id, 'ei' FROM usuarios WHERE email IN ('claudio.campelo@grupoara.com.br', 'ruy.rego@grupoara.com.br');

-- ARA Energia: sem Gerente de Unidade cadastrado ainda — pendência de dado-fonte
-- (ver CLAUDE.md: "ARA EI e ARA Energia: sem dado nenhum ainda (placeholder)").

-- ---------------------------------------------------------------------------
-- Gerentes de CC — Corporativo
-- Códigos conforme CCS_CORPORATIVO (OrcamentoARA.jsx) — batem 1:1 com a lista
-- da screenshot fornecida, sem divergência.
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, perfil) VALUES
  ('Alexander Forsberg', 'alexander.forsberg@grupoara.com.br', 'gerente_cc_corporativo'),
  ('Arthur Neto',        'arthur.neto@grupoara.com.br',        'gerente_cc_corporativo'),
  ('Carlos Campello',    'carlos.campello@grupoara.com.br',    'gerente_cc_corporativo'),
  ('Ladice Pizzolitto',  'ladice.pizzolitto@grupoara.com.br',  'gerente_cc_corporativo'),
  ('Edivania Parente',   'edivania.parente@grupoara.com.br',   'gerente_cc_corporativo'),
  ('Antoni Silva',       'antoni.silva@grupoara.com.br',       'gerente_cc_corporativo'),
  ('Silvio Vidal',       'silvio.vidal@grupoara.com.br',       'gerente_cc_corporativo'),
  ('Saulo Araujo',       'saulo.araujo@grupoara.com.br',       'gerente_cc_corporativo'),
  ('Isaac Queiroz',      'isaac.queiroz@grupoara.com.br',      'gerente_cc_corporativo'),
  ('Mouriza Silva',      'mouriza.silva@grupoara.com.br',      'gerente_cc_corporativo'),
  ('Marcelo Aguiar',     'marcelo.aguiar@grupoara.com.br',     'gerente_cc_corporativo'),
  ('Priscila Miyazaki',  'priscila.miyazaki@grupoara.com.br',  'gerente_cc_corporativo');

-- Nota: usuario_cc_corporativo é metadado de titularidade do CC (quem é o
-- responsável de fato), não o único portão de acesso — a regra de autorização
-- (seção 4.3 da especificação) dá a um admin_fpa acesso irrestrito independente
-- do que estiver aqui. Por isso é seguro registrar Lucas Santiago como titular
-- de Controladoria (0010116) e FP&A (0010118) mesmo permanecendo admin_fpa: o
-- vínculo documenta a responsabilidade distinta da pessoa, sem alterar (nem
-- restringir) o escopo de acesso que o perfil admin_fpa já concede.

INSERT INTO usuario_cc_corporativo (usuario_id, unidade_id, cc_codigo)
SELECT id, 'corporativo', cc.codigo
FROM usuarios
JOIN LATERAL (VALUES
  ('alexander.forsberg@grupoara.com.br', '0000102'),  -- Financeiro
  ('arthur.neto@grupoara.com.br',        '02'),       -- GSC (Arthur)
  ('carlos.campello@grupoara.com.br',    '0000104'),  -- Riscos, Auditoria e Compliance
  ('carlos.campello@grupoara.com.br',    '0010110'),  -- Auditoria Interna
  ('ladice.pizzolitto@grupoara.com.br',  '0000199'),  -- Conselho
  ('ladice.pizzolitto@grupoara.com.br',  '0010114'),  -- Jurídico
  ('ladice.pizzolitto@grupoara.com.br',  '0010115'),  -- Escritório
  ('ladice.pizzolitto@grupoara.com.br',  '0010119'),  -- Secretaria de Governança
  ('edivania.parente@grupoara.com.br',   '0010103'),  -- Contabilidade/Fiscal
  ('antoni.silva@grupoara.com.br',       '0010104'),  -- Departamento Pessoal
  ('silvio.vidal@grupoara.com.br',       '0010105'),  -- TI GSP (SISTEMAS)
  ('silvio.vidal@grupoara.com.br',       '0010120'),  -- Inovação e Tecnologia
  ('saulo.araujo@grupoara.com.br',       '0010107'),  -- Compras
  ('isaac.queiroz@grupoara.com.br',      '0010109'),  -- Novos Negócios
  ('isaac.queiroz@grupoara.com.br',      '0010112'),  -- Estratégia e Projetos
  ('mouriza.silva@grupoara.com.br',      '0010111'),  -- Gestão de Pessoas
  ('marcelo.aguiar@grupoara.com.br',     '0010117'),  -- TI GSI Infra
  ('priscila.miyazaki@grupoara.com.br',  '0020102'),  -- Marketing
  ('lucas.santiago@grupoara.com.br',     '0010116'),  -- Controladoria
  ('lucas.santiago@grupoara.com.br',     '0010118')   -- FP&A
) AS cc(email, codigo) ON cc.email = usuarios.email;

-- ---------------------------------------------------------------------------
-- Gerentes de CC — ARA Têxtil
-- Fonte: extrato CTT010 fornecido pelo usuário em 2026-08-19 (código,
-- descrição, responsável) — CCs conforme CCS_TEXTIL (OrcamentoARA.jsx,
-- nível de subárea, 14 CCs). Convenção de e-mail própria desta unidade:
-- nome.sobrenome@aratextil.com.br (diferente do domínio grupoara.com.br
-- usado nas demais listas deste arquivo).
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, perfil) VALUES
  ('Patrícia Marques',   'patricia.marques@aratextil.com.br',   'gerente_cc_corporativo'),
  ('Antônio Santos',     'antonio.santos@aratextil.com.br',     'gerente_cc_corporativo'),
  ('Érico Freire',       'erico.freire@aratextil.com.br',       'gerente_cc_corporativo'),
  ('Waldécio Souza',     'waldecio.souza@aratextil.com.br',     'gerente_cc_corporativo'),
  ('Vinícius Araújo',    'vinicius.araujo@aratextil.com.br',    'gerente_cc_corporativo'),
  ('Jefferson Oliveira', 'jefferson.oliveira@aratextil.com.br', 'gerente_cc_corporativo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT id, 'textil' FROM usuarios WHERE email IN (
  'patricia.marques@aratextil.com.br', 'antonio.santos@aratextil.com.br', 'erico.freire@aratextil.com.br',
  'waldecio.souza@aratextil.com.br', 'vinicius.araujo@aratextil.com.br', 'jefferson.oliveira@aratextil.com.br'
)
ON CONFLICT DO NOTHING;

INSERT INTO usuario_cc_corporativo (usuario_id, unidade_id, cc_codigo)
SELECT id, 'textil', cc.codigo
FROM usuarios
JOIN LATERAL (VALUES
  ('patricia.marques@aratextil.com.br',   '001.0101'),  -- Administração - Apoio
  ('patricia.marques@aratextil.com.br',   '001.0105'),  -- Tecnologia da Informação
  ('patricia.marques@aratextil.com.br',   '004.0301'),  -- Apoio Produção
  ('antonio.santos@aratextil.com.br',     '001.0109'),  -- Logística
  ('erico.freire@aratextil.com.br',       '002.0101'),  -- Vendas
  ('erico.freire@aratextil.com.br',       '002.0102'),  -- Marketing
  ('erico.freire@aratextil.com.br',       '002.0103'),  -- Fashion
  ('waldecio.souza@aratextil.com.br',     '004.0101'),  -- Malharia
  ('waldecio.souza@aratextil.com.br',     '004.0199'),  -- Manutenção Malharia
  ('waldecio.souza@aratextil.com.br',     '004.0303'),  -- Infra Estrutura
  ('waldecio.souza@aratextil.com.br',     '004.0304'),  -- ETE
  ('vinicius.araujo@aratextil.com.br',    '004.0201'),  -- Beneficiamento
  ('vinicius.araujo@aratextil.com.br',    '004.0299'),  -- Manutenção Beneficiamento
  ('jefferson.oliveira@aratextil.com.br', '004.0302')   -- Qualidade Processo & Produto
) AS cc(email, codigo) ON cc.email = usuarios.email
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- ARA Agrícola — Terra do Sol (TDS) / Frutos do Sol (FDS) / Consolidado
-- Fonte: Plano Centro de Custo.xlsx (código, descrição, responsável, tipo
-- de custeio) e Camadas.xlsx (De/Para conta × CC, só área Fazenda),
-- fornecidas em 2026-08-20. CCs conforme CCS_AGRICOLA (OrcamentoARA.jsx e
-- backend/src/calc/constantesAgricolaResorts.js) — 9 áreas (nível
-- sintético/consolidador) e seus CCs analíticos. Terra do Sol e Frutos do
-- Sol viraram duas "unidades" próprias (unidade_id 'agricola_tds' /
-- 'agricola_fds') com a MESMA estrutura de CC — cada gestor recebe acesso
-- às duas (é a mesma pessoa/área nas duas fazendas, a planilha-fonte não
-- distingue). O acesso ao CC sintético da área (ex.: '501') é a visão
-- consolidadora dos CCs analíticos dela — não um alvo de lançamento (ver
-- nota em AbaCustos, frontend/src/OrcamentoARA.jsx).
-- Convenção de e-mail própria desta unidade: nome.sobrenome@araagricola.com.br.
-- Sobrenomes completos (a planilha só trazia o primeiro nome de 4 dos 7)
-- confirmados pelo usuário em 2026-08-20: Emanuela Pereira, Maicon Silva,
-- Janyne Miranda, Edivania Parente.
-- Uva Terceiros (área 508): os 12 sub-CCs são nomeados por
-- fornecedor/fazenda terceira, não por funcionário do Grupo ARA — ficam
-- todos sob a Emanuela (responsável da área 508 inteira), sem usuário
-- próprio por sub-CC (decisão de 2026-08-20).
-- ---------------------------------------------------------------------------
INSERT INTO unidades (id, nome) VALUES
  ('agricola_tds', 'ARA Agrícola — Terra do Sol'),
  ('agricola_fds', 'ARA Agrícola — Frutos do Sol')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (nome, email, perfil) VALUES
  ('Luiz Lima',        'luiz.lima@araagricola.com.br',        'gerente_cc_corporativo'),
  ('Leodivan Bagagi',  'leodivan.bagagi@araagricola.com.br',  'gerente_cc_corporativo'),
  ('Ivan Lopes',       'ivan.lopes@araagricola.com.br',       'gerente_cc_corporativo'),
  ('Emanuela Pereira', 'emanuela.pereira@araagricola.com.br', 'gerente_cc_corporativo'),
  ('Maicon Silva',     'maicon.silva@araagricola.com.br',     'gerente_cc_corporativo'),
  ('Janyne Miranda',   'janyne.miranda@araagricola.com.br',   'gerente_cc_corporativo'),
  ('Edivania Parente', 'edivania.parente@araagricola.com.br', 'gerente_cc_corporativo')
ON CONFLICT (email) DO NOTHING;

-- Cada gestor tem acesso às duas fazendas (mesma pessoa/área nas duas).
INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT id, u.unidade_id
FROM usuarios
JOIN LATERAL (VALUES ('agricola_tds'), ('agricola_fds')) AS u(unidade_id) ON true
WHERE usuarios.email IN (
  'luiz.lima@araagricola.com.br', 'leodivan.bagagi@araagricola.com.br', 'ivan.lopes@araagricola.com.br',
  'emanuela.pereira@araagricola.com.br', 'maicon.silva@araagricola.com.br', 'janyne.miranda@araagricola.com.br',
  'edivania.parente@araagricola.com.br'
)
ON CONFLICT DO NOTHING;

-- CC sintético da área + todos os analíticos dela, nas duas fazendas.
INSERT INTO usuario_cc_corporativo (usuario_id, unidade_id, cc_codigo)
SELECT id, cc.unidade_id, cc.codigo
FROM usuarios
JOIN LATERAL (VALUES
  -- Luiz Lima — 501 Administrativo Financeiro
  ('luiz.lima@araagricola.com.br',        'agricola_tds', '501'),
  ('luiz.lima@araagricola.com.br',        'agricola_tds', '50101'),
  ('luiz.lima@araagricola.com.br',        'agricola_tds', '50102'),
  ('luiz.lima@araagricola.com.br',        'agricola_tds', '50103'),
  ('luiz.lima@araagricola.com.br',        'agricola_tds', '50105'),
  ('luiz.lima@araagricola.com.br',        'agricola_fds', '501'),
  ('luiz.lima@araagricola.com.br',        'agricola_fds', '50101'),
  ('luiz.lima@araagricola.com.br',        'agricola_fds', '50102'),
  ('luiz.lima@araagricola.com.br',        'agricola_fds', '50103'),
  ('luiz.lima@araagricola.com.br',        'agricola_fds', '50105'),
  -- Leodivan Bagagi — 502 Operação
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '502'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '50201'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '50202'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '50203'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '50204'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '50205'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '50206'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_tds', '50207'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '502'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '50201'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '50202'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '50203'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '50204'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '50205'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '50206'),
  ('leodivan.bagagi@araagricola.com.br',  'agricola_fds', '50207'),
  -- Ivan Lopes — 503 Produção + 504 Fazenda
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '503'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '50301'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '50302'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '50303'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '504'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '50402'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '50403'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '50404'),
  ('ivan.lopes@araagricola.com.br',       'agricola_tds', '50405'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '503'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '50301'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '50302'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '50303'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '504'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '50402'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '50403'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '50404'),
  ('ivan.lopes@araagricola.com.br',       'agricola_fds', '50405'),
  -- Emanuela Pereira — 505 Packing House + 508 Uva Terceiros
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '505'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50501'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50502'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50503'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50504'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '508'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50801'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50802'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50803'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50804'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50805'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50806'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50807'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50808'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50809'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50810'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50811'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_tds', '50812'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '505'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50501'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50502'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50503'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50504'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '508'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50801'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50802'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50803'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50804'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50805'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50806'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50807'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50808'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50809'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50810'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50811'),
  ('emanuela.pereira@araagricola.com.br', 'agricola_fds', '50812'),
  -- Maicon Silva — 506 Comercial
  ('maicon.silva@araagricola.com.br',     'agricola_tds', '506'),
  ('maicon.silva@araagricola.com.br',     'agricola_tds', '50601'),
  ('maicon.silva@araagricola.com.br',     'agricola_tds', '50602'),
  ('maicon.silva@araagricola.com.br',     'agricola_tds', '50605'),
  ('maicon.silva@araagricola.com.br',     'agricola_tds', '50606'),
  ('maicon.silva@araagricola.com.br',     'agricola_fds', '506'),
  ('maicon.silva@araagricola.com.br',     'agricola_fds', '50601'),
  ('maicon.silva@araagricola.com.br',     'agricola_fds', '50602'),
  ('maicon.silva@araagricola.com.br',     'agricola_fds', '50605'),
  ('maicon.silva@araagricola.com.br',     'agricola_fds', '50606'),
  -- Janyne Miranda — 507 Planejamento e Gestão
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '507'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50701'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50702'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50703'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50704'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50705'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50706'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50710'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50711'),
  ('janyne.miranda@araagricola.com.br',   'agricola_tds', '50712'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '507'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50701'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50702'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50703'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50704'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50705'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50706'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50710'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50711'),
  ('janyne.miranda@araagricola.com.br',   'agricola_fds', '50712'),
  -- Edivania Parente — 511 Custo Mercadoria Vendida
  ('edivania.parente@araagricola.com.br', 'agricola_tds', '511'),
  ('edivania.parente@araagricola.com.br', 'agricola_tds', '51101'),
  ('edivania.parente@araagricola.com.br', 'agricola_fds', '511'),
  ('edivania.parente@araagricola.com.br', 'agricola_fds', '51101')
) AS cc(email, unidade_id, codigo) ON cc.email = usuarios.email
ON CONFLICT DO NOTHING;

-- Migração dos Gestores da Unidade já existentes de 'agricola' (Kleber
-- Ribeiro/Alexander Borges são de Resorts, não afeta; os de fato Agrícola
-- são Luiz Lima e Adailton Nunes — mas esta consulta não depende de saber
-- nomes, generaliza pra qualquer vínculo 'agricola' existente): antes desta
-- migração, 'agricola' já cobria "toda a unidade" pra quem tinha esse
-- vínculo. Agora que virou Consolidado (não editável direto), sem o
-- vínculo extra nas duas fazendas essas pessoas veriam o Consolidado
-- (leitura + envio) mas não conseguiriam editar Terra do Sol/Frutos do Sol
-- — dá as duas fazendas de brinde pra quem já era Gestor da Unidade de
-- 'agricola', mantendo o nível de acesso que já tinham.
INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT usuario_id, 'agricola_tds' FROM usuario_unidade WHERE unidade_id = 'agricola'
UNION
SELECT usuario_id, 'agricola_fds' FROM usuario_unidade WHERE unidade_id = 'agricola'
ON CONFLICT DO NOTHING;
