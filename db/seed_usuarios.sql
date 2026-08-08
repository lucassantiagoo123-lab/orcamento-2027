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

INSERT INTO usuario_cc_corporativo (usuario_id, cc_codigo)
SELECT id, cc.codigo
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
