// Estrutura de Receita de ARA Agrícola e ARA Resorts — extraída de
// "Premissas por Empresa.xlsx" (abas Premissas_Agrícola / Premissas_Resorts),
// fornecida pelo usuário em 2026-08-09. Diferente da Têxtil (Volume × Preço
// por produto têxtil), cada unidade tem um modelo de receita próprio:
//
// - Agrícola: volume agregado (não por produto), dividido Interno/Externo,
//   com preço ponderado próprio para cada canal. Mesma mecânica de
//   Volume × Preço da Têxtil, só que 2 "produtos" (Interno/Externo) em vez
//   de 9 produtos têxteis — reaproveita o mesmo modelo de `produtos`.
//
// - Resorts: modelo de hotelaria (ocupação × tarifa, consumo × pessoas),
//   estruturalmente diferente — não é "produto com volume e preço". Reusa a
//   mesma abstração de "linha" (premissaTipo/quantidades/valoresUnit) já
//   usada em Custos, não um mecanismo novo.
export const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ---------------------------------------------------------------------------
// ARA Agrícola
// ---------------------------------------------------------------------------
export const PRODUTOS_REF_AGRICOLA = [
  { nome: 'Vendas Internas', volumeRef: 7570, precoRef: 11.01 },
  { nome: 'Vendas Externas', volumeRef: 3930, precoRef: 12.13 },
];

export const REFERENCIA_2026_AGRICOLA = {
  volume: {
    'Vendas Internas': [230, 626, 1005, 827, 641, 553, 401, 927, 584, 520, 859, 397],
    'Vendas Externas': [0, 0, 0, 61, 325, 207, 161, 147, 891, 711, 809, 618],
  },
  preco: {
    'Vendas Internas': [11.018576378182454, 10.459786967073221, 10.745427171652675, 11.293415384068526, 11.365938996897924, 11.352985698829878, 11.919999547389089, 11.760590392544715, 10.811134483921602, 11.348869912986494, 10.060818472150235, 10.210518428501416],
    'Vendas Externas': [0, 0, 0, 12.006054160932537, 12.00597977967244, 12.757467763202012, 12.757489425927027, 12.757438305327678, 12.162092968666709, 12.002474695930115, 11.992112585788947, 11.988178875867476],
  },
};

// pctRef = percentual de referência (magnitude positiva; computeDRE aplica
// como dedução). Fonte: coluna "Premissa" (E) de cada linha de dedução.
export const DEDUCOES_REF_AGRICOLA = [
  { id: 'pis', nome: 'PIS', pctRef: 0 },
  { id: 'cofins', nome: 'Cofins', pctRef: 0 },
  { id: 'iss', nome: 'ISS', pctRef: 0 },
  { id: 'devolucoes', nome: 'Devoluções', pctRef: 1.6 },
  { id: 'inss', nome: 'INSS', pctRef: 2.05 },
];

// ---------------------------------------------------------------------------
// ARA Resorts — linhas de receita (modelo qtd_valor: quantidade × valor
// unitário, igual ao premissaTipo já usado em Custos) e linhas diretas
// (valor direto por mês) para as receitas menores.
// ---------------------------------------------------------------------------
export const LINHAS_RECEITA_RESORTS = [
  { id: 'hospedagem', nome: '1.1 Hospedagem', tipo: 'qtd_valor', rotuloQtd: 'Acomodações ocupadas (#)', rotuloValor: 'Tarifa média (R$/acomodação)' },
  { id: 'aeb', nome: '1.2.1 Alimentação e Bebidas', tipo: 'qtd_valor', rotuloQtd: 'Nº de adultos', rotuloValor: 'Consumo médio de A&B (R$)' },
  { id: 'cafePensao', nome: '1.2.2 Café e Pensão', tipo: 'qtd_valor', rotuloQtd: 'Nº de adultos', rotuloValor: 'Consumo médio (R$)' },
  { id: 'moorea', nome: '1.3 Receita Moorea', tipo: 'direto' },
  { id: 'alugueis', nome: '1.4 Outras Receitas — Aluguéis', tipo: 'direto' },
  { id: 'outrasIss', nome: '1.4 Outras Receitas — ISS', tipo: 'direto' },
  { id: 'arrumacao', nome: '1.4 Outras Receitas — Arrumação (LFCVH)', tipo: 'direto' },
];

// Café e Pensão NÃO soma na Receita Operacional Bruta (conferido célula a
// célula em Premissa Resorts.xlsx, aba "1.1 DRE"): a linha 42 "Receita
// Operacional Bruta" é a soma de Hospedagem(43) + A&B(44) + Moorea(45) +
// Outras Receitas(46) — e a fórmula da linha 44 ("1.2 Receita Total com
// A&B" dentro da ROB) puxa só a célula de Alimentação e Bebidas (=G25),
// não a soma de A&B com Café e Pensão que aparece no subtotal informativo
// da linha 23. Café e Pensão já está embutido na Tarifa Média da
// Hospedagem — é por isso que a planilha tem uma linha só informativa,
// "Receita com Hospedagem sem Pensão" = Hospedagem − Café e Pensão (linha
// 21), que só faz sentido se a Hospedagem contabilizada alhures já a
// inclui. Somar Café e Pensão de novo na ROB duplicaria essa receita.
export const LINHA_RECEITA_INFORMATIVA_RESORTS = 'cafePensao';

export const REFERENCIA_2026_RESORTS = {
  hospedagem: {
    quantidades: [4371.7905, 3927.924, 4283.8125, 3747.15, 3880.7505, 3462.03, 4327.8015, 3915.021, 3861, 4092, 3762, 4092],
    valoresUnit: [2149.2582904271262, 1524.6021856757254, 1325.8431952163246, 1265.4328597257008, 1125.6478879052697, 1168.0070756978505, 1608.8571470813738, 1152.5467189434357, 1407.4939819131491, 1237.6580704219621, 1416.1194747917777, 1715.3198690534382],
  },
  aeb: {
    quantidades: [12063, 10695.793050916496, 11782.484287464986, 10208, 10439, 9543, 11737.461646719037, 10548.056579310343, 10100.143024314133, 10521.224335558634, 9781.2, 10639.2],
    valoresUnit: [125.01705355218438, 93.902989822146793, 97.777984412476457, 98.333654094827594, 83.045528977871442, 84.5395934192602, 116.61364383521585, 84.239070706434944, 85.969500422887691, 97.26112545110621, 124.83552631578944, 139.21875000000003],
  },
  cafePensao: {
    quantidades: [10016, 9050.8248788187375, 9618.5790003501406, 8359, 8590, 7706, 9442.5669049214412, 8131.0436145593867, 7880.1196203354566, 8347.650837636982, 7900.2, 8593.2],
    valoresUnit: [137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137],
  },
  moorea: { valores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  alugueis: { valores: [44440.31319, 44925.98101, 37408.38846, 38883.43955, 36361.86099, 36356.57838, 35264.72194, 45054.08124, 35893.17442, 36897.52967, 36570.82575, 39410.89584] },
  outrasIss: { valores: [401195.74880677764, 237427.92535849859, 218095.91648298313, 179829.18701605801, 159576.43019061597, 149397.6768139115, 283459.1354225126, 169914.58164750063, 217737.89380903557, 196043.43297052011, 212255.70320833341, 292091.02520833345] },
  arrumacao: { valores: [11034.073218039501, 11071.717624384575, 13485.212167793332, 13173.58001700911, 15236.803356997434, 15180.440458644696, 21193.187684836041, 21411.073993284026, 23581.94180548103, 27911.989431083683, 28658.229974325044, 34813.01222088113] },
};

// baseLinhaIds: quais linhas de receita somadas formam a base do percentual
// (em vez de sempre a receita bruta total, como Têxtil/Agrícola). Conferido
// direto nas fórmulas da planilha (não é aproximação — os valores batem
// numericamente, inclusive Cofins, cuja célula não trazia fórmula visível
// mas cujo resultado só fecha com a mesma base do PIS correspondente):
//   PIS/Cofins Hospedagem = Hospedagem + Outras Receitas (ISS)
//   ISS Hospedagem        = Hospedagem + Arrumação (LFCVH)
//   PIS/Cofins A&B        = Alimentação e Bebidas + Aluguéis + Arrumação
//   ICMS A&B               = Alimentação e Bebidas (só)
//   Descontos s/ serviços  = Hospedagem + Moorea + Aluguéis + Outras(ISS) + Arrumação
//   Descontos A&B          = Alimentação e Bebidas (só)
// Café e Pensão NÃO entra em nenhuma base de dedução — nenhuma das 8
// fórmulas da planilha a referencia.
export const DEDUCOES_REF_RESORTS = [
  { id: 'pis_hospedagem', nome: 'PIS — % Receita Hospedagem', pctRef: 0.65, baseLinhaIds: ['hospedagem', 'outrasIss'] },
  { id: 'cofins_hospedagem', nome: 'Cofins — % Receita Hospedagem', pctRef: 3, baseLinhaIds: ['hospedagem', 'outrasIss'] },
  { id: 'iss_hospedagem', nome: 'ISS — % Receita Hospedagem', pctRef: 5, baseLinhaIds: ['hospedagem', 'arrumacao'] },
  { id: 'pis_aeb', nome: 'PIS — % Receita A&B', pctRef: 1.65, baseLinhaIds: ['aeb', 'alugueis', 'arrumacao'] },
  { id: 'cofins_aeb', nome: 'Cofins — % Receita A&B', pctRef: 7.6, baseLinhaIds: ['aeb', 'alugueis', 'arrumacao'] },
  { id: 'icms_aeb', nome: 'ICMS — % A&B', pctRef: 2.12, baseLinhaIds: ['aeb'] },
  { id: 'descontos_servicos', nome: 'Descontos sobre serviços — % Receita A&B', pctRef: 0, baseLinhaIds: ['hospedagem', 'moorea', 'alugueis', 'outrasIss', 'arrumacao'] },
  { id: 'descontos_aeb', nome: 'Descontos A&B — % A&B', pctRef: 0, baseLinhaIds: ['aeb'] },
];
