// Tela de administração (seções 2.4 e 4.4) — exclusiva admin_fpa. A proteção
// de verdade é o backend (todo /api/admin/* exige exigirPerfil('admin_fpa'));
// esta tela só existe para quem já tem esse perfil real na sessão (ver
// AppGate.jsx), então não há checagem de perfil aqui dentro.
import React, { useEffect, useState } from 'react';
import {
  listarUsuarios, criarUsuario, atualizarUsuario, vincularUnidade, desvincularUnidade,
  vincularCc, desvincularCc, listarConcessoes, criarConcessao, revogarConcessao,
} from './api/admin.js';
import { ApiError } from './api/client.js';

const COR = { azul: '#0C4391', laranja: '#FFA707', texto: '#494949', borda: '#D9D9D9', claro: '#F7F7F7' };
const UNIDADES_IDS = ['textil', 'agricola', 'resorts', 'ei', 'energia'];
const PERFIL_LABEL = {
  admin_fpa: 'Admin FP&A',
  gerente_unidade: 'Gerente de Unidade',
  gerente_cc_corporativo: 'Gerente de CC — Corporativo',
};

export default function AdminPanel({ voltar }) {
  const [usuarios, setUsuarios] = useState([]);
  const [concessoes, setConcessoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [u, c] = await Promise.all([listarUsuarios(), listarConcessoes()]);
      setUsuarios(u.usuarios);
      setConcessoes(c.concessoes);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar dados de administração.');
    }
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div style={{ padding: 22, maxWidth: 1100, margin: '0 auto', fontFamily: "'Segoe UI', system-ui, sans-serif", color: COR.texto }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 18, color: COR.azul }}>Administração — Usuários e Acessos</h1>
        <button onClick={voltar} style={botaoSecundario}>← Voltar ao orçamento</button>
      </div>

      {erro && <div style={{ background: '#FDECEC', border: '1px solid #C00000', borderRadius: 6, padding: 10, marginBottom: 16, fontSize: 12.5 }}>{erro}</div>}
      {carregando ? <p>Carregando…</p> : (
        <>
          <SecaoUsuarios usuarios={usuarios} onMudou={carregar} />
          <SecaoConcessoes usuarios={usuarios} concessoes={concessoes} onMudou={carregar} />
        </>
      )}
    </div>
  );
}

const botaoSecundario = {
  fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
  border: `1px solid ${COR.borda}`, background: '#fff', color: COR.azul,
};
const botaoPrimario = {
  fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
  border: 'none', background: COR.laranja, color: '#fff',
};
const th = { textAlign: 'left', fontSize: 11, color: '#7A8088', padding: '6px 8px', borderBottom: `1px solid ${COR.borda}` };
const td = { fontSize: 12.5, padding: '8px', borderBottom: `1px solid ${COR.borda}`, verticalAlign: 'top' };

function SecaoUsuarios({ usuarios, onMudou }) {
  const [novo, setNovo] = useState({ nome: '', email: '', perfil: 'gerente_unidade' });
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState(null);

  async function handleCriar(e) {
    e.preventDefault();
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      await criarUsuario(novo);
      setNovo({ nome: '', email: '', perfil: 'gerente_unidade' });
      onMudou();
    } catch (e2) {
      setErroNovo(e2 instanceof ApiError ? e2.message : 'Falha ao criar usuário.');
    }
    setSalvandoNovo(false);
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 14, marginBottom: 10 }}>Usuários</h2>

      <form onSubmit={handleCriar} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', background: COR.claro, padding: 10, borderRadius: 8 }}>
        <input required placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={campo} />
        <input required type="email" placeholder="email@grupoara.com.br" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} style={campo} />
        <select value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value })} style={campo}>
          {Object.entries(PERFIL_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <button type="submit" disabled={salvandoNovo} style={botaoPrimario}>{salvandoNovo ? 'Criando…' : 'Adicionar usuário'}</button>
        {erroNovo && <span style={{ color: '#C00000', fontSize: 11.5 }}>{erroNovo}</span>}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Nome</th><th style={th}>E-mail</th><th style={th}>Perfil</th>
            <th style={th}>Unidades</th><th style={th}>CCs (Corporativo)</th><th style={th}>Ativo</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => <LinhaUsuario key={u.id} usuario={u} onMudou={onMudou} />)}
        </tbody>
      </table>
    </div>
  );
}

const campo = { fontSize: 12.5, padding: '6px 8px', borderRadius: 6, border: `1px solid ${COR.borda}` };

function LinhaUsuario({ usuario, onMudou }) {
  const [ccNovo, setCcNovo] = useState('');

  async function mudarPerfil(perfil) {
    await atualizarUsuario(usuario.id, { perfil });
    onMudou();
  }
  async function alternarAtivo() {
    await atualizarUsuario(usuario.id, { ativo: !usuario.ativo });
    onMudou();
  }
  async function toggleUnidade(unidadeId) {
    if (usuario.unidades.includes(unidadeId)) await desvincularUnidade(usuario.id, unidadeId);
    else await vincularUnidade(usuario.id, unidadeId);
    onMudou();
  }
  async function addCc(e) {
    e.preventDefault();
    if (!ccNovo.trim()) return;
    await vincularCc(usuario.id, ccNovo.trim());
    setCcNovo('');
    onMudou();
  }
  async function removeCc(cc) {
    await desvincularCc(usuario.id, cc);
    onMudou();
  }

  return (
    <tr style={{ opacity: usuario.ativo ? 1 : 0.5 }}>
      <td style={td}>{usuario.nome}</td>
      <td style={td}>{usuario.email}</td>
      <td style={td}>
        <select value={usuario.perfil} onChange={(e) => mudarPerfil(e.target.value)} style={campo}>
          {Object.entries(PERFIL_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </td>
      <td style={td}>
        {usuario.perfil === 'gerente_unidade' ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {UNIDADES_IDS.map((id) => (
              <button key={id} onClick={() => toggleUnidade(id)} style={{
                ...botaoSecundario, padding: '3px 8px', fontSize: 10.5,
                background: usuario.unidades.includes(id) ? COR.azul : '#fff',
                color: usuario.unidades.includes(id) ? '#fff' : COR.azul,
              }}>{id}</button>
            ))}
          </div>
        ) : <span style={{ color: '#B5BAC0' }}>—</span>}
      </td>
      <td style={td}>
        {usuario.perfil === 'gerente_cc_corporativo' ? (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {usuario.ccs.map((cc) => (
                <span key={cc} style={{ fontSize: 10.5, background: COR.claro, borderRadius: 12, padding: '2px 8px', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  {cc} <button onClick={() => removeCc(cc)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C00000', fontWeight: 700 }}>×</button>
                </span>
              ))}
            </div>
            <form onSubmit={addCc} style={{ display: 'flex', gap: 4 }}>
              <input placeholder="código do CC" value={ccNovo} onChange={(e) => setCcNovo(e.target.value)} style={{ ...campo, width: 90 }} />
              <button type="submit" style={{ ...botaoSecundario, padding: '4px 8px' }}>+</button>
            </form>
          </>
        ) : <span style={{ color: '#B5BAC0' }}>—</span>}
      </td>
      <td style={td}>
        <button onClick={alternarAtivo} style={{ ...botaoSecundario, color: usuario.ativo ? '#C00000' : '#008000' }}>
          {usuario.ativo ? 'Desativar' : 'Reativar'}
        </button>
      </td>
    </tr>
  );
}

function SecaoConcessoes({ usuarios, concessoes, onMudou }) {
  const gerentesCc = usuarios.filter((u) => u.perfil === 'gerente_cc_corporativo');
  const [form, setForm] = useState({ usuarioId: '', ccCodigo: '', motivo: '', validoAte: '' });
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);

  async function handleCriar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm(null);
    try {
      await criarConcessao({ ...form, validoAte: new Date(form.validoAte).toISOString() });
      setForm({ usuarioId: '', ccCodigo: '', motivo: '', validoAte: '' });
      onMudou();
    } catch (e2) {
      setErroForm(e2 instanceof ApiError ? e2.message : 'Falha ao criar concessão.');
    }
    setSalvando(false);
  }

  async function handleRevogar(id) {
    await revogarConcessao(id);
    onMudou();
  }

  const agora = new Date();

  return (
    <div>
      <h2 style={{ fontSize: 14, marginBottom: 4 }}>Concessões temporárias de acesso</h2>
      <p style={{ fontSize: 11.5, color: '#7A8088', marginBottom: 10 }}>
        Item 9.3 / seção 4.4 da especificação — acesso extra de um Gerente de CC a um CC fora
        da sua lista, com prazo e motivo. Expira sozinho; pode ser revogado antes.
      </p>

      <form onSubmit={handleCriar} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', background: COR.claro, padding: 10, borderRadius: 8 }}>
        <select required value={form.usuarioId} onChange={(e) => setForm({ ...form, usuarioId: e.target.value })} style={campo}>
          <option value="">Gerente de CC…</option>
          {gerentesCc.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <input required placeholder="Código do CC" value={form.ccCodigo} onChange={(e) => setForm({ ...form, ccCodigo: e.target.value })} style={{ ...campo, width: 110 }} />
        <input required placeholder="Motivo" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} style={{ ...campo, width: 220 }} />
        <input required type="date" value={form.validoAte} onChange={(e) => setForm({ ...form, validoAte: e.target.value })} style={campo} />
        <button type="submit" disabled={salvando} style={botaoPrimario}>{salvando ? 'Salvando…' : 'Conceder acesso'}</button>
        {erroForm && <span style={{ color: '#C00000', fontSize: 11.5 }}>{erroForm}</span>}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Gerente</th><th style={th}>CC</th><th style={th}>Motivo</th>
            <th style={th}>Concedido por</th><th style={th}>Válido até</th><th style={th}>Status</th><th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {concessoes.map((c) => {
            const expirada = new Date(c.valido_ate) < agora;
            const status = c.revogado_em ? 'Revogada' : expirada ? 'Expirada' : 'Ativa';
            return (
              <tr key={c.id}>
                <td style={td}>{c.usuario_nome}</td>
                <td style={td}>{c.cc_codigo}</td>
                <td style={td}>{c.motivo}</td>
                <td style={td}>{c.concedido_por_nome}</td>
                <td style={td}>{new Date(c.valido_ate).toLocaleDateString('pt-BR')}</td>
                <td style={td}>{status}</td>
                <td style={td}>
                  {status === 'Ativa' && <button onClick={() => handleRevogar(c.id)} style={{ ...botaoSecundario, color: '#C00000' }}>Revogar</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
