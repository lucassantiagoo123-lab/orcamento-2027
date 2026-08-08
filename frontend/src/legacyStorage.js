// PENDÊNCIA REAL, não solução definitiva: backlog de envios (histórico do
// FP&A), etapas do processo orçamentário e premissas macro globais existiam
// no protótipo via `window.storage` (uma API do host do artefato Claude.ai
// que não existe fora dele — chamar direto quebraria a aplicação real).
//
// Nenhuma dessas três coisas está no schema de db/schema.sql — a
// especificação (Especificacao_Caminho_B_Multiusuario.md) não as modela.
// Ficam em localStorage do navegador por enquanto: funciona para um usuário
// sozinho, mas NÃO sincroniza entre gerentes/FP&A diferentes — ou seja, não
// é multiusuário para esses três itens específicos, ao contrário do resto da
// aplicação. Decidir com o FP&A se viram tabelas novas (schema change fora
// do escopo original) antes de ir para produção.
export const legacyStorage = {
  async get(key) {
    const v = window.localStorage.getItem(key);
    return v === null ? null : { value: v };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
  },
};
