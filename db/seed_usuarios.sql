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

-- ---------------------------------------------------------------------------
-- ARA Resorts — Samoa Beach / Samoa Villa / Consolidado
-- Fonte: Centros de Custos - ARA Resorts 1.xlsx (código, centro de custo,
-- status S/A, unidade Beach/Villa/Beach-Villa, responsável e e-mail já
-- inclusos na planilha por resort), fornecida em 2026-08-20. CCs conforme
-- CCS_RESORTS (OrcamentoARA.jsx e backend/src/calc/constantesAgricolaResorts.js)
-- — 12 áreas (nível sintético/consolidador) e seus CCs analíticos. Samoa
-- Beach e Samoa Villa viraram duas "unidades" (unidade_id 'samoa_beach' /
-- 'samoa_villa') com a MESMA estrutura de CC, mas nem todo CC existe nos
-- dois resorts — "AT Ampliação Beach" (94) só no Beach, "Villa Muro Alto"
-- (95) e "AT Ampliação Villa" (96) só na Villa.
-- E-mails vieram prontos na planilha, domínio @samoaresort.com.br. Quando
-- uma área (CC sintético) tem só um responsável cobrindo todos os CCs
-- analíticos dela nesse resort, ele recebe o sintético também (visão
-- consolidadora — mesmo racional da Agrícola); quando a área é dividida
-- entre várias pessoas (ex.: 03 Administração), todas recebem o sintético
-- em conjunto (usuario_cc_corporativo aceita múltiplos titulares por CC).
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, perfil) VALUES
  ('Kleber Ribeiro',      'kleber.ribeiro@samoaresort.com.br',     'gerente_cc_corporativo'),
  ('Agildo Junior',       'agildo.junior@samoaresort.com.br',      'gerente_cc_corporativo'),
  ('Silvaneide Borges',   'silvaneide.borges@samoaresort.com.br',  'gerente_cc_corporativo'),
  ('Zélio Cruz',          'zelio.cruz@samoaresort.com.br',         'gerente_cc_corporativo'),
  ('Marcelo Moura',       'marcelo.moura@samoaresort.com.br',      'gerente_cc_corporativo'),
  ('Daiane Melo',         'daiane.melo@samoaresort.com.br',        'gerente_cc_corporativo'),
  ('Leonardo Ferreira',   'leonardo.ferreira@samoaresort.com.br',  'gerente_cc_corporativo'),
  ('Lucas Menezes',       'lucas.menezes@samoaresort.com.br',      'gerente_cc_corporativo'),
  ('Wagner Tashiro',      'wagner.muraoka@samoaresort.com.br',     'gerente_cc_corporativo'),
  ('Daniel Abel',         'daniel.abel@samoaresort.com.br',        'gerente_cc_corporativo'),
  ('Maria Luiza',         'maria.luiza@samoaresort.com.br',        'gerente_cc_corporativo'),
  ('Alice Fernandes',     'alice.fernandes@samoaresort.com.br',    'gerente_cc_corporativo'),
  ('Ivan Lopes',          'ivan.lopes@samoaresort.com.br',         'gerente_cc_corporativo'),
  ('Willian Andrade',     'willian.andrade@samoaresort.com.br',    'gerente_cc_corporativo'),
  ('Elaine Ferreira',     'elaine.ferreira@samoaresort.com.br',    'gerente_cc_corporativo'),
  ('Guilherme Oliveira',  'guilherme.oliveira@samoaresort.com.br', 'gerente_cc_corporativo'),
  ('Elivelton Silva',     'elivelton.silva@samoaresort.com.br',    'gerente_cc_corporativo'),
  ('Alberto Alves',       'alberto.alves@samoaresort.com.br',      'gerente_cc_corporativo')
ON CONFLICT (email) DO NOTHING;

-- Vínculo de unidade — só no(s) resort(s) onde a pessoa realmente responde
-- por algum CC (nem todo mundo trabalha nos dois).
INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT id, u.unidade_id
FROM usuarios
JOIN LATERAL (VALUES
  ('kleber.ribeiro@samoaresort.com.br',     'samoa_beach'), ('kleber.ribeiro@samoaresort.com.br',     'samoa_villa'),
  ('agildo.junior@samoaresort.com.br',      'samoa_beach'),
  ('silvaneide.borges@samoaresort.com.br',  'samoa_villa'),
  ('zelio.cruz@samoaresort.com.br',         'samoa_beach'),
  ('marcelo.moura@samoaresort.com.br',      'samoa_villa'),
  ('daiane.melo@samoaresort.com.br',        'samoa_beach'), ('daiane.melo@samoaresort.com.br',        'samoa_villa'),
  ('leonardo.ferreira@samoaresort.com.br',  'samoa_beach'),
  ('lucas.menezes@samoaresort.com.br',      'samoa_villa'),
  ('wagner.muraoka@samoaresort.com.br',     'samoa_beach'), ('wagner.muraoka@samoaresort.com.br',     'samoa_villa'),
  ('daniel.abel@samoaresort.com.br',        'samoa_beach'),
  ('maria.luiza@samoaresort.com.br',        'samoa_villa'),
  ('alice.fernandes@samoaresort.com.br',    'samoa_beach'), ('alice.fernandes@samoaresort.com.br',    'samoa_villa'),
  ('ivan.lopes@samoaresort.com.br',         'samoa_beach'), ('ivan.lopes@samoaresort.com.br',         'samoa_villa'),
  ('willian.andrade@samoaresort.com.br',    'samoa_beach'), ('willian.andrade@samoaresort.com.br',    'samoa_villa'),
  ('elaine.ferreira@samoaresort.com.br',    'samoa_beach'), ('elaine.ferreira@samoaresort.com.br',    'samoa_villa'),
  ('guilherme.oliveira@samoaresort.com.br', 'samoa_beach'),
  ('elivelton.silva@samoaresort.com.br',    'samoa_beach'), ('elivelton.silva@samoaresort.com.br',    'samoa_villa'),
  ('alberto.alves@samoaresort.com.br',      'samoa_beach'), ('alberto.alves@samoaresort.com.br',      'samoa_villa')
) AS u(email, unidade_id) ON u.email = usuarios.email
ON CONFLICT DO NOTHING;

-- CCs — sintético (área) + analíticos, por resort, conforme a coluna
-- Unidade (D) da planilha (nem todo CC existe nos dois resorts).
INSERT INTO usuario_cc_corporativo (usuario_id, unidade_id, cc_codigo)
SELECT id, cc.unidade_id, cc.codigo
FROM usuarios
JOIN LATERAL (VALUES
  -- Kleber Ribeiro — Conselho, Diretoria (área 03, junto com outros),
  -- TI, Condomínio Polinésia, Bloco 3 — nas duas unidades
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '00'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '0002'),
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '03'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '0301'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '0308'),
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '97'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '9701'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '9702'),
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '99'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_beach', '9901'),
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '00'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '0002'),
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '03'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '0301'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '0308'),
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '97'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '9701'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '9702'),
  ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '99'), ('kleber.ribeiro@samoaresort.com.br', 'samoa_villa', '9901'),
  -- Agildo Junior (Beach) / Silvaneide Borges (Villa) — Apartamentos,
  -- Governança, Lavanderia (+ sintéticos 01 Hospedagem e 04 Serviços,
  -- compartilhados com outros responsáveis da mesma área)
  ('agildo.junior@samoaresort.com.br',      'samoa_beach', '01'), ('agildo.junior@samoaresort.com.br',      'samoa_beach', '0101'), ('agildo.junior@samoaresort.com.br',      'samoa_beach', '0106'),
  ('agildo.junior@samoaresort.com.br',      'samoa_beach', '04'), ('agildo.junior@samoaresort.com.br',      'samoa_beach', '0402'),
  ('silvaneide.borges@samoaresort.com.br',  'samoa_villa', '01'), ('silvaneide.borges@samoaresort.com.br',  'samoa_villa', '0101'), ('silvaneide.borges@samoaresort.com.br',  'samoa_villa', '0106'),
  ('silvaneide.borges@samoaresort.com.br',  'samoa_villa', '04'), ('silvaneide.borges@samoaresort.com.br',  'samoa_villa', '0402'),
  -- Zélio Cruz (Beach) / Marcelo Moura (Villa) — Recepção (Marcelo também
  -- Portaria/Segurança na Villa, dentro da área 03)
  ('zelio.cruz@samoaresort.com.br',   'samoa_beach', '01'), ('zelio.cruz@samoaresort.com.br',   'samoa_beach', '0102'),
  ('marcelo.moura@samoaresort.com.br', 'samoa_villa', '01'), ('marcelo.moura@samoaresort.com.br', 'samoa_villa', '0102'),
  ('marcelo.moura@samoaresort.com.br', 'samoa_villa', '03'), ('marcelo.moura@samoaresort.com.br', 'samoa_villa', '0310'),
  -- Daiane Melo — Reservas + Comercial/Marketing, nas duas unidades
  ('daiane.melo@samoaresort.com.br', 'samoa_beach', '01'), ('daiane.melo@samoaresort.com.br', 'samoa_beach', '0103'),
  ('daiane.melo@samoaresort.com.br', 'samoa_beach', '05'), ('daiane.melo@samoaresort.com.br', 'samoa_beach', '0502'),
  ('daiane.melo@samoaresort.com.br', 'samoa_villa', '01'), ('daiane.melo@samoaresort.com.br', 'samoa_villa', '0103'),
  ('daiane.melo@samoaresort.com.br', 'samoa_villa', '05'), ('daiane.melo@samoaresort.com.br', 'samoa_villa', '0502'),
  -- Leonardo Ferreira (Beach) / Lucas Menezes (Villa) — Esporte e Lazer
  ('leonardo.ferreira@samoaresort.com.br', 'samoa_beach', '01'), ('leonardo.ferreira@samoaresort.com.br', 'samoa_beach', '0105'),
  ('lucas.menezes@samoaresort.com.br',     'samoa_villa', '01'), ('lucas.menezes@samoaresort.com.br',     'samoa_villa', '0105'),
  -- Wagner Tashiro — Experiências (nas duas) + Villa Muro Alto (só Villa)
  ('wagner.muraoka@samoaresort.com.br', 'samoa_beach', '01'), ('wagner.muraoka@samoaresort.com.br', 'samoa_beach', '0107'),
  ('wagner.muraoka@samoaresort.com.br', 'samoa_villa', '01'), ('wagner.muraoka@samoaresort.com.br', 'samoa_villa', '0107'),
  ('wagner.muraoka@samoaresort.com.br', 'samoa_villa', '95'), ('wagner.muraoka@samoaresort.com.br', 'samoa_villa', '9501'),
  -- Daniel Abel (Beach) / Maria Luiza (Villa) — toda a área 02 Alimentos e
  -- Bebidas (Maria Luiza também o Lobby Bar, exclusivo da Villa)
  ('daniel.abel@samoaresort.com.br', 'samoa_beach', '02'),
  ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0201'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0202'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0203'),
  ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0204'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0205'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0206'),
  ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0207'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0208'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0209'),
  ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0210'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0212'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0213'),
  ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0214'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0215'), ('daniel.abel@samoaresort.com.br', 'samoa_beach', '0216'),
  ('maria.luiza@samoaresort.com.br', 'samoa_villa', '02'),
  ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0201'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0202'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0203'),
  ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0204'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0205'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0206'),
  ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0207'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0208'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0209'),
  ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0210'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0212'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0213'),
  ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0214'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0215'), ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0216'),
  ('maria.luiza@samoaresort.com.br', 'samoa_villa', '0217'),
  -- Alice Fernandes — Apoio Administrativo, Financeiro (área 03), nas duas
  ('alice.fernandes@samoaresort.com.br', 'samoa_beach', '03'), ('alice.fernandes@samoaresort.com.br', 'samoa_beach', '0302'), ('alice.fernandes@samoaresort.com.br', 'samoa_beach', '0306'),
  ('alice.fernandes@samoaresort.com.br', 'samoa_villa', '03'), ('alice.fernandes@samoaresort.com.br', 'samoa_villa', '0302'), ('alice.fernandes@samoaresort.com.br', 'samoa_villa', '0306'),
  -- Ivan Lopes (samoaresort.com.br — pessoa diferente do Ivan Lopes da
  -- Agrícola) — Almoxarifado (área 03), nas duas
  ('ivan.lopes@samoaresort.com.br', 'samoa_beach', '03'), ('ivan.lopes@samoaresort.com.br', 'samoa_beach', '0303'),
  ('ivan.lopes@samoaresort.com.br', 'samoa_villa', '03'), ('ivan.lopes@samoaresort.com.br', 'samoa_villa', '0303'),
  -- Willian Andrade — RH/Departamento Pessoal (área 03), nas duas
  ('willian.andrade@samoaresort.com.br', 'samoa_beach', '03'), ('willian.andrade@samoaresort.com.br', 'samoa_beach', '0304'),
  ('willian.andrade@samoaresort.com.br', 'samoa_villa', '03'), ('willian.andrade@samoaresort.com.br', 'samoa_villa', '0304'),
  -- Elaine Ferreira — Compras (área 03), nas duas
  ('elaine.ferreira@samoaresort.com.br', 'samoa_beach', '03'), ('elaine.ferreira@samoaresort.com.br', 'samoa_beach', '0307'),
  ('elaine.ferreira@samoaresort.com.br', 'samoa_villa', '03'), ('elaine.ferreira@samoaresort.com.br', 'samoa_villa', '0307'),
  -- Guilherme Oliveira — Portaria/Segurança (área 03), só Beach (a Villa é
  -- o Marcelo Moura, já incluído acima)
  ('guilherme.oliveira@samoaresort.com.br', 'samoa_beach', '03'), ('guilherme.oliveira@samoaresort.com.br', 'samoa_beach', '0310'),
  -- Elivelton Silva — Manutenção Predial e Obras e Reformas (área 06), nas duas
  ('elivelton.silva@samoaresort.com.br', 'samoa_beach', '06'), ('elivelton.silva@samoaresort.com.br', 'samoa_beach', '0601'), ('elivelton.silva@samoaresort.com.br', 'samoa_beach', '0602'),
  ('elivelton.silva@samoaresort.com.br', 'samoa_villa', '06'), ('elivelton.silva@samoaresort.com.br', 'samoa_villa', '0601'), ('elivelton.silva@samoaresort.com.br', 'samoa_villa', '0602'),
  -- Alberto Alves — AT Ampliação Beach (94) no Beach, AT Ampliação Villa
  -- (96) na Villa (áreas de expansão distintas por resort)
  ('alberto.alves@samoaresort.com.br', 'samoa_beach', '94'), ('alberto.alves@samoaresort.com.br', 'samoa_beach', '9401'), ('alberto.alves@samoaresort.com.br', 'samoa_beach', '9402'),
  ('alberto.alves@samoaresort.com.br', 'samoa_villa', '96'), ('alberto.alves@samoaresort.com.br', 'samoa_villa', '9601'), ('alberto.alves@samoaresort.com.br', 'samoa_villa', '9602')
) AS cc(email, unidade_id, codigo) ON cc.email = usuarios.email
ON CONFLICT DO NOTHING;

-- Migração dos Gestores da Unidade já existentes de 'resorts' (Kleber
-- Ribeiro e Alexander Borges, @grupoara.com.br — contas de Gestor da
-- Unidade, diferentes das contas de Gestor de CC @samoaresort.com.br
-- criadas acima para a mesma pessoa): mesmo racional da migração da
-- Agrícola — sem o vínculo extra nos dois resorts, veriam o Consolidado
-- mas não conseguiriam editar Samoa Beach/Samoa Villa.
INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT usuario_id, 'samoa_beach' FROM usuario_unidade WHERE unidade_id = 'resorts'
UNION
SELECT usuario_id, 'samoa_villa' FROM usuario_unidade WHERE unidade_id = 'resorts'
ON CONFLICT DO NOTHING;
