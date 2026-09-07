import { pool } from './pool.js';

// Boletim Focus (PDF de referência) — ver migração 0007_boletim_focus_pdf.sql
// para o racional completo. Linha única (id fixo 1) — cada envio novo
// substitui o anterior (upsert), não guarda histórico.

export async function salvarBoletimFocusPdf({ nomeArquivo, conteudo, tamanhoBytes, usuarioId }) {
  const { rows } = await pool.query(
    `INSERT INTO boletim_focus_pdf (id, nome_arquivo, conteudo, tamanho_bytes, enviado_por, enviado_em)
     VALUES (1, $1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET
       nome_arquivo = EXCLUDED.nome_arquivo, conteudo = EXCLUDED.conteudo,
       tamanho_bytes = EXCLUDED.tamanho_bytes, enviado_por = EXCLUDED.enviado_por, enviado_em = now()
     RETURNING nome_arquivo, tamanho_bytes, enviado_em`,
    [nomeArquivo, conteudo, tamanhoBytes, usuarioId]
  );
  return rows[0];
}

/** Metadados só (sem o binário) — para exibir "enviado em / por quem" sem baixar o PDF inteiro. */
export async function buscarBoletimFocusPdfMeta() {
  const { rows } = await pool.query(
    `SELECT bf.nome_arquivo, bf.tamanho_bytes, bf.enviado_em, u.nome AS enviado_por_nome
     FROM boletim_focus_pdf bf LEFT JOIN usuarios u ON u.id = bf.enviado_por
     WHERE bf.id = 1`
  );
  return rows[0] || null;
}

/** O binário completo — só quando o usuário pede pra abrir/baixar o arquivo. */
export async function buscarBoletimFocusPdfArquivo() {
  const { rows } = await pool.query(`SELECT nome_arquivo, conteudo FROM boletim_focus_pdf WHERE id = 1`);
  return rows[0] || null;
}
