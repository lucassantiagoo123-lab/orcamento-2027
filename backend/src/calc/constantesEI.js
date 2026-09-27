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

// Plano de contas: "Plano de Contas.xlsx" (3.1 DRE e DFC) — só despesas
// (SG&A). Pacotes = contas sintéticas do próprio plano. grupoDre diz em que
// balde das Despesas Operacionais o pacote entra no Consolidado (Pessoal,
// Vendas ou Gerais). 34202011 ENCARGOS COM DEPRECIACAO vai para
// 'depreciacao' (abaixo do EBITDA) — decisão do usuário de 2026-09-27; no
// plano ela está dentro de 34202 DESPESAS GERAIS.
export const PACOTES_EI = [
  { id: 'pessoal_vendas', nome: 'Despesa com Pessoal — Vendas (34101)', grupoDre: 'pessoal', ref: 'Plano de Contas.xlsx (14 contas)' },
  { id: 'comissoes', nome: 'Comissões sobre Vendas (34102)', grupoDre: 'vendas', ref: 'Plano de Contas.xlsx (1 conta)' },
  { id: 'propaganda', nome: 'Propaganda e Publicidade (34103)', grupoDre: 'vendas', ref: 'Plano de Contas.xlsx (1 conta)' },
  { id: 'entrega', nome: 'Despesas com Entrega (34104)', grupoDre: 'vendas', ref: 'Plano de Contas.xlsx (12 contas)' },
  { id: 'pessoal_adm', nome: 'Despesa com Pessoal — Administrativas (34201)', grupoDre: 'pessoal', ref: 'Plano de Contas.xlsx (16 contas)' },
  { id: 'despesas_gerais', nome: 'Despesas Gerais (34202)', grupoDre: 'gerais', ref: 'Plano de Contas.xlsx (32 contas)' },
  { id: 'depreciacao', nome: 'Depreciação (34202011)', ref: 'Plano de Contas.xlsx (1 conta, movida de 34202 por decisão do usuário)' },
];

const d = (codigo, nome) => ({ codigo, nome, origem: 'Despesa' });
export const PLANO_CONTAS_EI = {
  pessoal_vendas: [
    d('34101001', 'SALARIOS'), d('34101002', 'PREMIOS E GRATIFICACOES'), d('34101003', '13º SALARIO'),
    d('34101004', 'FERIAS'), d('34101005', 'INSS (GPS)'), d('34101006', 'FGTS (GFIP)'),
    d('34101007', 'INDENIZACOES E AVISO PREVIO'), d('34101008', 'VALE ELETRONICO (VEM)'), d('34101009', 'CESTAS BASICAS'),
    d('34101010', 'FARDAMENTOS'), d('34101011', 'ASSISTENCIA MEDICA E SOCIAL'), d('34101012', 'TREINAMENTO DE PESSOAL'),
    d('34101014', 'HORAS EXTRAS'), d('34101015', 'ALIMENTACAO'),
  ],
  comissoes: [d('34102001', 'COMISSOES')],
  propaganda: [d('34103001', 'PROPAGANDA E PUBLICIDADE')],
  entrega: [
    d('34104001', 'FRETES E CARRETOS'), d('34104002', 'MANUTENCAO DE VEICULOS'), d('34104003', 'SERVICOS ADUANEIROS'),
    d('34104004', 'DESPACHANTE'), d('34104017', 'TAXAS DE CONTRATACAO - CEF'), d('34104020', 'DESPESAS COM VIAGENS'),
    d('34104023', 'REFEICOES'), d('34104027', 'EQUIPAMENTOS E SISTEMAS'), d('34104031', 'DESPESAS COM COMBUSTIVEIS'),
    d('34104036', 'CUSTO DE TRANSMISSAO - CLIENTES'), d('34104037', 'STAND / LOJA DE VENDAS'), d('34104398', 'OUTRAS DESPESAS COMERCIAIS'),
  ],
  pessoal_adm: [
    d('34201001', 'SALARIOS'), d('34201002', 'PREMIOS E GRATIFICACOES'), d('34201003', '13º SALARIO'),
    d('34201004', 'FERIAS'), d('34201005', 'INSS (GPS)'), d('34201006', 'FGTS (GFIP)'),
    d('34201007', 'INDENIZACOES E AVISO PREVIO'), d('34201008', 'VALE ELETRONICO (VEM)'), d('34201009', 'CESTAS BASICAS'),
    d('34201010', 'FARDAMENTOS'), d('34201011', 'ASSISTENCIA MEDICA E SOCIAL'), d('34201012', 'DESPESA COM TREINAMENTO DE PESSOAL'),
    d('34201013', 'PENSAO ALIMENTICIA'), d('34201014', 'HORAS EXTRAS'), d('34201015', 'ALIMENTACAO'),
    d('34201022', 'CAIXA FUNDO FIXO'),
  ],
  despesas_gerais: [
    d('34202001', 'ENERGIA ELETRICA'), d('34202002', 'AGUA E ESGOTO'), d('34202003', 'TELEFONE E INTERNET'),
    d('34202004', 'MANUTENCAO DE VEICULOS'), d('34202005', 'CORREIOS E MALOTES'), d('34202006', 'MATERIAL DE EXPEDIENTE'),
    d('34202007', 'MANUTENCAO, CONSERVACAO E LIMPEZA'), d('34202008', 'LIVROS, JORNAIS E REVISTAS'), d('34202009', 'DESPESA  ALIMENTACAO'),
    d('34202010', 'SERVICOS DE TERCEIROS - PESSSOA JURIDICA'), d('34202012', 'BENS DE PEQUENO VALOR'),
    d('34202013', 'DESPESAS COM FESTAS E COMEMORACOES'), d('34202014', 'IMPOSTOS E TAXAS'), d('34202015', 'FRETES E CARRETOS'),
    d('34202016', 'CONTRIBUICAO SINDICAL'), d('34202017', 'SERVICOS DE TERCEIRO PESSOA FISICA'), d('34202018', 'DESPESAS COM VIAGENS'),
    d('34202019', 'ALUGUEL A PESSOA FISICA'), d('34202020', 'PIS - COFINS SOBRE A DEPRECIACAO'), d('34202021', 'REFEICOES'),
    d('34202022', 'CAIXA FUNDO FIXO'), d('34202023', 'SEGURANCA E VIGILANCIA'), d('34202025', 'LOCACAO DE MAQ E EQUIPAMENTOS'),
    d('34202026', 'MANUTENCAO DE MAQ E EQUIPAMENTOS'), d('34202027', 'ASSESSORIAS E CONSULTORIAS'), d('34202028', 'DESPESAS COM SEGUROS'),
    d('34202029', 'DESPESAS COM COMBUSTIVEL'), d('34202033', 'CONDOMINIOS DE IMOVEIS PROPRIOS'), d('34202034', 'DESPESAS ADMINISTRATIVAS RATEADAS'),
    d('34202039', 'DISTRATOS'), d('34202042', 'PERDA COM FORNECEDOR'), d('34202090', 'DIVERSOS'),
  ],
  depreciacao: [d('34202011', 'ENCARGOS COM DEPRECIACAO')],
};

export const TODAS_CONTAS_EI = {};
Object.entries(PLANO_CONTAS_EI).forEach(([pacoteId, contas]) => {
  contas.forEach(c => { TODAS_CONTAS_EI[c.codigo] = { ...c, pacoteId }; });
});

// Conta onde entra a Comissão apropriada do POC (decisão do usuário de
// 2026-09-27: "POC dentro da 34102001"), no CC escolhido na aba Receita
// (padrão 0020101 VENDAS).
export const CONTA_COMISSAO_POC = '34102001';
export const CC_COMISSAO_POC_PADRAO = '0020101';
