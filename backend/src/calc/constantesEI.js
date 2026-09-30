// ARA EI (2026-09-27) — três empresas com o mesmo plano de contas e a mesma
// estrutura de CC: Holding, La Fleur II e South Bay; 'ei' é o Consolidado
// (soma só das três). Espelho em frontend/src/OrcamentoARA.jsx.
//
// CCs: "Listagem CC - LA FLEUR II (1).xlsx" (02-21AF - Listagem do Cadastro).
// Decisão do usuário (2026-09-27): cópia idêntica para as três empresas.
// Código de 5 dígitos = área (nivel 2, consolidador); 7 dígitos = CC
// analítico (nivel 3). O código de 3 dígitos (000/001/002/108) vai em
// `grupo`. Nomes exatamente como na listagem (inclusive "LA FELUR II").
// Todos 'despesa': o plano de contas da ARA EI só tem despesas (SG&A) —
// custo e deduções vêm do POC da La Fleur II (ver computePOC).
export const CCS_EI = [
  { codigo: '00001', nome: 'DIRETORIA', tipo: 'despesa', nivel: 2, areaCodigo: null, grupo: '000' },
  { codigo: '0000101', nome: 'PRESIDENCIA', tipo: 'despesa', nivel: 3, areaCodigo: '00001', grupo: '000' },
  { codigo: '0000102', nome: 'EXECUTIVA', tipo: 'despesa', nivel: 3, areaCodigo: '00001', grupo: '000' },
  { codigo: '0000103', nome: 'GESTAO CORPORATIVA', tipo: 'despesa', nivel: 3, areaCodigo: '00001', grupo: '000' },
  { codigo: '0000104', nome: 'TECNICA', tipo: 'despesa', nivel: 3, areaCodigo: '00001', grupo: '000' },
  { codigo: '0000105', nome: 'NEGOCIOS', tipo: 'despesa', nivel: 3, areaCodigo: '00001', grupo: '000' },
  { codigo: '0000199', nome: 'SECRETARIA', tipo: 'despesa', nivel: 3, areaCodigo: '00001', grupo: '000' },

  { codigo: '00101', nome: 'ADMINISTRACAO', tipo: 'despesa', nivel: 2, areaCodigo: null, grupo: '001' },
  { codigo: '0010101', nome: 'ADMINISTRATIVO-APOIO', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },
  { codigo: '0010102', nome: 'FINANCEIRO', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },
  { codigo: '0010103', nome: 'CONTABILIDADE-FISCAL', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },
  { codigo: '0010104', nome: 'RH-DEPTO DE PESSOAL', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },
  { codigo: '0010105', nome: 'TI', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },
  { codigo: '0010106', nome: 'FATURAMENTO-CONTRATOS', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },
  { codigo: '0010107', nome: 'SUPRIMENTOS', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },
  { codigo: '0010109', nome: 'COBRANCA', tipo: 'despesa', nivel: 3, areaCodigo: '00101', grupo: '001' },

  { codigo: '00201', nome: 'COMERCIAL', tipo: 'despesa', nivel: 2, areaCodigo: null, grupo: '002' },
  { codigo: '0020101', nome: 'VENDAS', tipo: 'despesa', nivel: 3, areaCodigo: '00201', grupo: '002' },
  { codigo: '0020102', nome: 'PROPAGANDA E MARKETING', tipo: 'despesa', nivel: 3, areaCodigo: '00201', grupo: '002' },
  { codigo: '0020103', nome: 'INCORPORACAO E DESENVOLVIMENTO', tipo: 'despesa', nivel: 3, areaCodigo: '00201', grupo: '002' },

  { codigo: '10801', nome: 'OBRA - LA FLEUR II', tipo: 'despesa', nivel: 2, areaCodigo: null, grupo: '108' },
  { codigo: '1080101', nome: 'BLOCO GERAL - FLATS', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },
  { codigo: '1080102', nome: 'HOTEL', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },
  { codigo: '1080103', nome: 'AREA COMUM - PISCINA/ESTACIONAMENTO/ETC', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },
  { codigo: '1080104', nome: 'VILLA', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },
  { codigo: '1080105', nome: 'MONTAGEM - FLATS', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },
  { codigo: '1080106', nome: 'AMPLIACAO DA VILLA DE MURO ALTO', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },
  { codigo: '1080107', nome: 'POLINESIA VILLA PRE OPERACIONAL', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },
  { codigo: '1080108', nome: 'ASSISTENCIA TECNICA - FLATS', tipo: 'despesa', nivel: 3, areaCodigo: '10801', grupo: '108' },

  { codigo: '10802', nome: 'ADMINISTRACAO - LA FLEUR II', tipo: 'despesa', nivel: 2, areaCodigo: null, grupo: '108' },
  { codigo: '1080201', nome: 'ENGENHARIA - APOIO ADMINISTRATIVO', tipo: 'despesa', nivel: 3, areaCodigo: '10802', grupo: '108' },
  { codigo: '1080202', nome: 'PROJETOS E CONSULTORIA DE PROJETOS', tipo: 'despesa', nivel: 3, areaCodigo: '10802', grupo: '108' },

  { codigo: '10803', nome: 'IMPLANTACAO - LA FELUR II', tipo: 'despesa', nivel: 2, areaCodigo: null, grupo: '108' },
  { codigo: '1080301', nome: 'BLOCO FLATS -AREA INTERNA', tipo: 'despesa', nivel: 3, areaCodigo: '10803', grupo: '108' },
  { codigo: '1080302', nome: 'BLOCO FLATS -AREA EXTERNA', tipo: 'despesa', nivel: 3, areaCodigo: '10803', grupo: '108' },
  { codigo: '1080303', nome: 'BLOCO HOTEL-AREA INTERNA', tipo: 'despesa', nivel: 3, areaCodigo: '10803', grupo: '108' },
  { codigo: '1080304', nome: 'BLOCO HOTEL-AREA EXTERNA', tipo: 'despesa', nivel: 3, areaCodigo: '10803', grupo: '108' },
  { codigo: '1080305', nome: 'BLOCO VILLA-AREA INTERNA E EXTERNA', tipo: 'despesa', nivel: 3, areaCodigo: '10803', grupo: '108' },
];

// Plano de contas: "Plano de Contas.xlsx" (3.1 DRE e DFC) — só despesas (SG&A).
// Desde 2026-09-30 a ARA EI usa a MESMA abertura de pacotes das demais empresas
// (Pessoal, Manutenção, Fretes e Logística, Serviços de Terceiros, Comercial e
// Marketing, Viagens, Locação e Ocupação, Depreciação e Amortização,
// Administrativo e Utilidades, Impostos e Tecnologia e Inovação): cada conta
// continua com o MESMO código — só muda o pacote em que aparece —, então nenhum
// valor já lançado (custos.linhas['CC|conta']) é alterado. Critério: mesmo
// pacote da Têxtil quando código e nome coincidem; nos demais, pela natureza da
// conta. 34202011 e 34202020 (PIS-COFINS sobre a depreciação, como na Têxtil)
// ficam em Depreciação e Amortização (abaixo do EBITDA). 'HC_EXISTENTE' é a
// conta nova de Headcount Existente do pacote Pessoal, como nas demais empresas.
export const PACOTES_EI = [
  { id: 'pessoal', nome: 'Pessoal', ref: 'Plano de Contas.xlsx' },
  { id: 'manutencao', nome: 'Manutenção', ref: 'Plano de Contas.xlsx' },
  { id: 'fretes', nome: 'Fretes e Logística', ref: 'Plano de Contas.xlsx' },
  { id: 'servicos', nome: 'Serviços de Terceiros', ref: 'Plano de Contas.xlsx' },
  { id: 'comercial', nome: 'Comercial e Marketing', ref: 'Plano de Contas.xlsx' },
  { id: 'viagens', nome: 'Viagens', ref: 'Plano de Contas.xlsx' },
  { id: 'locacao', nome: 'Locação e Ocupação', ref: 'Plano de Contas.xlsx' },
  { id: 'depreciacao', nome: 'Depreciação e Amortização', ref: 'Plano de Contas.xlsx' },
  { id: 'administrativo_utilidades', nome: 'Administrativo e Utilidades', ref: 'Plano de Contas.xlsx' },
  { id: 'impostos', nome: 'Impostos Indiretos e Diretos', ref: 'Plano de Contas.xlsx' },
  { id: 'tecnologia', nome: 'Tecnologia e Inovação', ref: 'Plano de Contas.xlsx' },
];

// [código, nome, pacote]
const CONTAS_EI = [
  ['HC_EXISTENTE', 'Headcount Existente', 'pessoal'],
  ['34101001', 'SALARIOS', 'pessoal'], ['34101002', 'PREMIOS E GRATIFICACOES', 'pessoal'], ['34101003', '13º SALARIO', 'pessoal'],
  ['34101004', 'FERIAS', 'pessoal'], ['34101005', 'INSS (GPS)', 'pessoal'], ['34101006', 'FGTS (GFIP)', 'pessoal'],
  ['34101007', 'INDENIZACOES E AVISO PREVIO', 'pessoal'], ['34101008', 'VALE ELETRONICO (VEM)', 'pessoal'], ['34101009', 'CESTAS BASICAS', 'pessoal'],
  ['34101010', 'FARDAMENTOS', 'pessoal'], ['34101011', 'ASSISTENCIA MEDICA E SOCIAL', 'pessoal'], ['34101012', 'TREINAMENTO DE PESSOAL', 'pessoal'],
  ['34101014', 'HORAS EXTRAS', 'pessoal'], ['34101015', 'ALIMENTACAO', 'pessoal'],
  ['34102001', 'COMISSOES', 'comercial'],
  ['34103001', 'PROPAGANDA E PUBLICIDADE', 'comercial'],
  ['34104001', 'FRETES E CARRETOS', 'fretes'], ['34104002', 'MANUTENCAO DE VEICULOS', 'manutencao'], ['34104003', 'SERVICOS ADUANEIROS', 'fretes'],
  ['34104004', 'DESPACHANTE', 'fretes'], ['34104017', 'TAXAS DE CONTRATACAO - CEF', 'servicos'], ['34104020', 'DESPESAS COM VIAGENS', 'viagens'],
  ['34104023', 'REFEICOES', 'administrativo_utilidades'], ['34104027', 'EQUIPAMENTOS E SISTEMAS', 'tecnologia'], ['34104031', 'DESPESAS COM COMBUSTIVEIS', 'fretes'],
  ['34104036', 'CUSTO DE TRANSMISSAO - CLIENTES', 'servicos'], ['34104037', 'STAND / LOJA DE VENDAS', 'comercial'], ['34104398', 'OUTRAS DESPESAS COMERCIAIS', 'comercial'],
  ['34201001', 'SALARIOS', 'pessoal'], ['34201002', 'PREMIOS E GRATIFICACOES', 'pessoal'], ['34201003', '13º SALARIO', 'pessoal'],
  ['34201004', 'FERIAS', 'pessoal'], ['34201005', 'INSS (GPS)', 'pessoal'], ['34201006', 'FGTS (GFIP)', 'pessoal'],
  ['34201007', 'INDENIZACOES E AVISO PREVIO', 'pessoal'], ['34201008', 'VALE ELETRONICO (VEM)', 'pessoal'], ['34201009', 'CESTAS BASICAS', 'pessoal'],
  ['34201010', 'FARDAMENTOS', 'pessoal'], ['34201011', 'ASSISTENCIA MEDICA E SOCIAL', 'pessoal'], ['34201012', 'DESPESA COM TREINAMENTO DE PESSOAL', 'pessoal'],
  ['34201013', 'PENSAO ALIMENTICIA', 'pessoal'], ['34201014', 'HORAS EXTRAS', 'pessoal'], ['34201015', 'ALIMENTACAO', 'pessoal'],
  ['34201022', 'CAIXA FUNDO FIXO', 'administrativo_utilidades'],
  ['34202001', 'ENERGIA ELETRICA', 'locacao'], ['34202002', 'AGUA E ESGOTO', 'locacao'], ['34202003', 'TELEFONE E INTERNET', 'tecnologia'],
  ['34202004', 'MANUTENCAO DE VEICULOS', 'manutencao'], ['34202005', 'CORREIOS E MALOTES', 'administrativo_utilidades'], ['34202006', 'MATERIAL DE EXPEDIENTE', 'administrativo_utilidades'],
  ['34202007', 'MANUTENCAO, CONSERVACAO E LIMPEZA', 'manutencao'], ['34202008', 'LIVROS, JORNAIS E REVISTAS', 'administrativo_utilidades'], ['34202009', 'DESPESA  ALIMENTACAO', 'administrativo_utilidades'],
  ['34202010', 'SERVICOS DE TERCEIROS - PESSSOA JURIDICA', 'servicos'], ['34202012', 'BENS DE PEQUENO VALOR', 'administrativo_utilidades'],
  ['34202013', 'DESPESAS COM FESTAS E COMEMORACOES', 'administrativo_utilidades'], ['34202014', 'IMPOSTOS E TAXAS', 'impostos'], ['34202015', 'FRETES E CARRETOS', 'fretes'],
  ['34202016', 'CONTRIBUICAO SINDICAL', 'impostos'], ['34202017', 'SERVICOS DE TERCEIRO PESSOA FISICA', 'servicos'], ['34202018', 'DESPESAS COM VIAGENS', 'viagens'],
  ['34202019', 'ALUGUEL A PESSOA FISICA', 'locacao'], ['34202020', 'PIS - COFINS SOBRE A DEPRECIACAO', 'depreciacao'], ['34202021', 'REFEICOES', 'administrativo_utilidades'],
  ['34202022', 'CAIXA FUNDO FIXO', 'administrativo_utilidades'], ['34202023', 'SEGURANCA E VIGILANCIA', 'servicos'], ['34202025', 'LOCACAO DE MAQ E EQUIPAMENTOS', 'locacao'],
  ['34202026', 'MANUTENCAO DE MAQ E EQUIPAMENTOS', 'manutencao'], ['34202027', 'ASSESSORIAS E CONSULTORIAS', 'servicos'], ['34202028', 'DESPESAS COM SEGUROS', 'administrativo_utilidades'],
  ['34202029', 'DESPESAS COM COMBUSTIVEL', 'manutencao'], ['34202033', 'CONDOMINIOS DE IMOVEIS PROPRIOS', 'locacao'], ['34202034', 'DESPESAS ADMINISTRATIVAS RATEADAS', 'administrativo_utilidades'],
  ['34202039', 'DISTRATOS', 'administrativo_utilidades'], ['34202042', 'PERDA COM FORNECEDOR', 'administrativo_utilidades'], ['34202090', 'DIVERSOS', 'administrativo_utilidades'],
  ['34202011', 'ENCARGOS COM DEPRECIACAO', 'depreciacao'],
];
export const PLANO_CONTAS_EI = {};
PACOTES_EI.forEach(p => { PLANO_CONTAS_EI[p.id] = []; });
CONTAS_EI.forEach(([codigo, nome, pacote]) => { PLANO_CONTAS_EI[pacote].push({ codigo, nome, origem: 'Despesa' }); });

export const TODAS_CONTAS_EI = {};
Object.entries(PLANO_CONTAS_EI).forEach(([pacoteId, contas]) => {
  contas.forEach(c => { TODAS_CONTAS_EI[c.codigo] = { ...c, pacoteId }; });
});

// Conta onde entra a Comissão apropriada do POC (decisão do usuário de
// 2026-09-27: "POC dentro da 34102001"), no CC escolhido na aba Receita
// (padrão 0020101 VENDAS).
export const CONTA_COMISSAO_POC = '34102001';
export const CC_COMISSAO_POC_PADRAO = '0020101';
