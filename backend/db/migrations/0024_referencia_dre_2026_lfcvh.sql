-- Referência DRE 2026 por unidade (2026-10-02) + unidade LFCVH no ARA Resorts.
--
-- referencia_dre_2026: DRE e fluxo de caixa ANUAIS de 2026 (realizado jan–ago
-- + previsto set–dez), só como REFERÊNCIA na Revisão (colunas 2026 / Δ R$ /
-- Δ %) e nos gráficos Bridge 2027 vs 2026. Não alimenta nenhum cálculo, total
-- ou checagem do orçamento 2027. Fonte: "Dados 2026.xlsx", aba "Tendência
-- Grupo ARA", coluna U (FY 2026, R$ milhões × 1.000.000); a coluna origem
-- guarda a célula de cada valor.
--   tipo 'importado': linhas-fonte (sinal da planilha). Subtotais e margens
--     são recalculados por fórmula na tela.
--   tipo 'subtotal_planilha': subtotal como está na planilha, guardado só
--     para mostrar onde a planilha não bate com a soma das linhas.
-- ARA EI: o FC de Investimentos inclui o South Bay (U148), que na planilha
-- ficava fora da linha da ARA EI (decisão do usuário, 2026-10-02).
-- Escopo: Têxtil (Consolidado), Agrícola (Consolidado), ARA EI (Consolidado),
-- Samoa Beach, Samoa Villa e LFCVH; o Resorts Consolidado soma os três.
CREATE TABLE IF NOT EXISTS referencia_dre_2026 (
  unidade_id TEXT NOT NULL,
  linha      TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('importado', 'subtotal_planilha')),
  valor      NUMERIC(16,2) NOT NULL,
  origem     TEXT NOT NULL,
  PRIMARY KEY (unidade_id, linha, tipo)
);

-- ON CONFLICT DO NOTHING: reexecutar nunca sobrescreve valor já gravado.
INSERT INTO referencia_dre_2026 (unidade_id, linha, tipo, valor, origem) VALUES
  ('samoa_beach','receitaBruta','importado',78136396.72,'U5'),
  ('samoa_beach','deducoes','importado',-7109446.01,'U14'),
  ('samoa_beach','cpv','importado',-36874052.63,'U32'),
  ('samoa_beach','despesasSemDA','importado',-9781204.47,'U51'),
  ('samoa_beach','depreciacao','importado',-1949327.45,'U70'),
  ('samoa_beach','resultadoFinanceiro','importado',-3066538.23,'U79'),
  ('samoa_beach','outras','importado',-228428.61,'U88'),
  ('samoa_beach','ircsl','importado',-4237994.06,'U97'),
  ('samoa_beach','ircslCaixa','importado',-4237994.06,'U118'),
  ('samoa_beach','variacaoNcg','importado',1584588.9,'U127'),
  ('samoa_beach','fcInvestimento','importado',-1885903.02,'U149'),
  ('samoa_beach','receitaLiquida','subtotal_planilha',71026950.71,'U23'),
  ('samoa_beach','lucroBruto','subtotal_planilha',34152898.08,'U42'),
  ('samoa_beach','ebitda','subtotal_planilha',24371693.62,'U61'),
  ('samoa_beach','lucroLiquido','subtotal_planilha',14889405.27,'U107'),
  ('samoa_beach','fco','subtotal_planilha',21718288.45,'U137'),
  ('samoa_beach','fcl','subtotal_planilha',19832385.43,'U163'),
  ('samoa_villa','receitaBruta','importado',68600762.15,'U6'),
  ('samoa_villa','deducoes','importado',-6239902.95,'U15'),
  ('samoa_villa','cpv','importado',-39997451.74,'U33'),
  ('samoa_villa','despesasSemDA','importado',-8294892.68,'U52'),
  ('samoa_villa','depreciacao','importado',-2839654.09,'U71'),
  ('samoa_villa','resultadoFinanceiro','importado',-3036970.25,'U80'),
  ('samoa_villa','outras','importado',-279059.24,'U89'),
  ('samoa_villa','ircsl','importado',-2073482.07,'U98'),
  ('samoa_villa','ircslCaixa','importado',-2073482.07,'U119'),
  ('samoa_villa','variacaoNcg','importado',-136454.38,'U128'),
  ('samoa_villa','fcInvestimento','importado',-6916970.06,'U150'),
  ('samoa_villa','receitaLiquida','subtotal_planilha',62360859.2,'U24'),
  ('samoa_villa','lucroBruto','subtotal_planilha',22363407.46,'U43'),
  ('samoa_villa','ebitda','subtotal_planilha',14068514.77,'U62'),
  ('samoa_villa','lucroLiquido','subtotal_planilha',6118408.36,'U108'),
  ('samoa_villa','fco','subtotal_planilha',11858578.32,'U138'),
  ('samoa_villa','fcl','subtotal_planilha',4941608.26,'U164'),
  ('lfcvh','receitaBruta','importado',3087643.39,'U7'),
  ('lfcvh','deducoes','importado',-267082.55,'U16'),
  ('lfcvh','cpv','importado',0,'U34'),
  ('lfcvh','despesasSemDA','importado',-2216094.27,'U53'),
  ('lfcvh','depreciacao','importado',0,'U72'),
  ('lfcvh','resultadoFinanceiro','importado',-53140.52,'U81'),
  ('lfcvh','outras','importado',0,'U90'),
  ('lfcvh','ircsl','importado',-321939.97,'U99'),
  ('lfcvh','ircslCaixa','importado',-321939.97,'U120'),
  ('lfcvh','variacaoNcg','importado',1583794.96,'U129'),
  ('lfcvh','fcInvestimento','importado',0,'U151'),
  ('lfcvh','receitaLiquida','subtotal_planilha',2820560.84,'U25'),
  ('lfcvh','lucroBruto','subtotal_planilha',2820560.84,'U44'),
  ('lfcvh','ebitda','subtotal_planilha',604466.57,'U63'),
  ('lfcvh','lucroLiquido','subtotal_planilha',229386.08,'U109'),
  ('lfcvh','fco','subtotal_planilha',1866321.56,'U139'),
  ('lfcvh','fcl','subtotal_planilha',1866321.56,'U165'),
  ('ei','receitaBruta','importado',33486319.68,'U8'),
  ('ei','deducoes','importado',-1251893.34,'U17'),
  ('ei','cpv','importado',-35445204.54,'U35'),
  ('ei','despesasSemDA','importado',-9781638.72,'U54'),
  ('ei','depreciacao','importado',-66693.8,'U73'),
  ('ei','resultadoFinanceiro','importado',-1003311.76,'U82'),
  ('ei','outras','importado',1295604.49,'U91'),
  ('ei','ircsl','importado',0,'U100'),
  ('ei','ircslCaixa','importado',0,'U121'),
  ('ei','variacaoNcg','importado',50494705.06,'U130'),
  ('ei','fcInvestimento','importado',-3632391.4,'U152+U148 (South Bay)'),
  ('ei','receitaLiquida','subtotal_planilha',32234426.34,'U26'),
  ('ei','lucroBruto','subtotal_planilha',-3210778.19,'U45'),
  ('ei','ebitda','subtotal_planilha',-12992416.91,'U64'),
  ('ei','lucroLiquido','subtotal_planilha',-14062422.47,'U110'),
  ('ei','fco','subtotal_planilha',37502288.15,'U140'),
  ('ei','fcl','subtotal_planilha',33869896.76,'U166'),
  ('agricola','receitaBruta','importado',114939104.86,'U9'),
  ('agricola','deducoes','importado',-5040228.76,'U18'),
  ('agricola','cpv','importado',-86655545.52,'U36'),
  ('agricola','despesasSemDA','importado',-15767874.43,'U55'),
  ('agricola','depreciacao','importado',-1704189.67,'U74'),
  ('agricola','resultadoFinanceiro','importado',-6313409.72,'U83'),
  ('agricola','outras','importado',13856431.9,'U92'),
  ('agricola','ircsl','importado',-1328819.31,'U101'),
  ('agricola','ircslCaixa','importado',0,'U122'),
  ('agricola','variacaoNcg','importado',-1882303.91,'U131'),
  ('agricola','fcInvestimento','importado',-930802.28,'U153'),
  ('agricola','receitaLiquida','subtotal_planilha',109898876.1,'U27'),
  ('agricola','lucroBruto','subtotal_planilha',23243330.58,'U46'),
  ('agricola','ebitda','subtotal_planilha',7475456.15,'U65'),
  ('agricola','lucroLiquido','subtotal_planilha',-1870962.55,'U111'),
  ('agricola','fco','subtotal_planilha',5593152.24,'U141'),
  ('agricola','fcl','subtotal_planilha',4662349.96,'U167'),
  ('textil_consolidado','receitaBruta','importado',104822893.01,'U10'),
  ('textil_consolidado','deducoes','importado',-20162555.62,'U19'),
  ('textil_consolidado','cpv','importado',-70259968.8,'U37'),
  ('textil_consolidado','despesasSemDA','importado',-9455004.75,'U56'),
  ('textil_consolidado','depreciacao','importado',-1459019.16,'U75'),
  ('textil_consolidado','resultadoFinanceiro','importado',215617.17,'U84'),
  ('textil_consolidado','outras','importado',983689.69,'U93'),
  ('textil_consolidado','ircsl','importado',-1098743.81,'U102'),
  ('textil_consolidado','ircslCaixa','importado',-1098743.81,'U123'),
  ('textil_consolidado','variacaoNcg','importado',4652033.25,'U132'),
  ('textil_consolidado','fcInvestimento','importado',-1409465.08,'U154'),
  ('textil_consolidado','receitaLiquida','subtotal_planilha',84660337.39,'U28'),
  ('textil_consolidado','lucroBruto','subtotal_planilha',14400368.6,'U47'),
  ('textil_consolidado','ebitda','subtotal_planilha',4945363.85,'U66'),
  ('textil_consolidado','lucroLiquido','subtotal_planilha',3586907.74,'U112'),
  ('textil_consolidado','fco','subtotal_planilha',8498653.29,'U142'),
  ('textil_consolidado','fcl','subtotal_planilha',7089188.21,'U168')
ON CONFLICT DO NOTHING;

-- LFCVH: terceira unidade do ARA Resorts (mesmo plano de contas, todos os
-- CCs do Resorts). Acesso: Admin FP&A (todas as unidades) e os Gestores da
-- Unidade do Resorts (quem já tem 'resorts').
INSERT INTO unidades (id, nome) VALUES ('lfcvh', 'ARA Resorts — LFCVH')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT uu.usuario_id, 'lfcvh' FROM usuario_unidade uu JOIN usuarios u ON u.id = uu.usuario_id
WHERE uu.unidade_id = 'resorts' AND u.perfil = 'gerente_unidade'
ON CONFLICT DO NOTHING;
