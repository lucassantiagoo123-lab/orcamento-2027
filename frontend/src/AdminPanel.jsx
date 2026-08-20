// Tela de administração (seções 2.4 e 4.4) — exclusiva admin_fpa. A proteção
// de verdade é o backend (todo /api/admin/* exige exigirPerfil('admin_fpa'));
// esta tela só existe para quem já tem esse perfil real na sessão (ver
// AppGate.jsx), então não há checagem de perfil aqui dentro.
import React, { useEffect, useState } from 'react';
import {
  listarUsuarios, criarUsuario, atualizarUsuario, vincularUnidade, desvincularUnidade,
  vincularCc, desvincularCc, removerTodosCcUsuario, listarConcessoes, criarConcessao, revogarConcessao,
} from './api/admin.js';
import { definirSenhaUsuario } from './api/senha.js';
import { ApiError } from './api/client.js';
import { CCS_TEXTIL, CCS_PLACEHOLDER_AGRICOLA_RESORTS, CCS_CORPORATIVO } from './OrcamentoARA.jsx';

const COR = { azul: '#0C4391', laranja: '#FFA707', texto: '#494949', borda: '#D9D9D9', claro: '#F7F7F7' };
const UNIDADES_IDS = ['textil', 'agricola', 'resorts', 'ei', 'energia', 'corporativo'];
const PERFIL_LABEL = {
  admin_fpa: 'Admin FP&A',
  gerente_unidade: 'Gestor da Unidade',
  gerente_cc_corporativo: 'Gestor de CC',
};
// Rebatizado de "Gerente de CC — Corporativo" para "Gestor de CC" em
// 2026-08-16: deixou de ser exclusivo do Corporativo — agora escolhe 1
// unidade (inclusive Corporativo) e, dentro dela, marca 1 ou mais CCs
// (checklist — "um gestor pode ser gestor de mais de um CC", correção do
// mesmo dia). Reaproveita as mesmas listas de CC já usadas no orçamento.
// Têxtil ganhou o CC real em 2026-08-19 (nível de subárea, 14 CCs,
// CCS_TEXTIL) — Agrícola/Resorts continuam no placeholder genérico
// (CCS_PLACEHOLDER_AGRICOLA_RESORTS — CLAUDE.md, "pendência de
// dado-fonte", ainda sem CC oficial pra elas). EI/Energia ainda não têm CC.
const CCS_POR_UNIDADE = {
  textil: CCS_TEXTIL,
  agricola: CCS_PLACEHOLDER_AGRICOLA_RESORTS,
  resorts: CCS_PLACEHOLDER_AGRICOLA_RESORTS,
  corporativo: CCS_CORPORATIVO,
  ei: [],
  energia: [],
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

const FILTRO_VAZIO = { nome: '', email: '', perfil: '', unidade: '', cc: '', ativo: '' };

// Nome do CC a partir do código, procurando em todas as listas de CC
// conhecidas (a mesma código pode existir em unidades diferentes, mas o
// filtro é por texto livre então basta achar alguma correspondência).
function nomeCcPorCodigo(codigo) {
  for (const lista of Object.values(CCS_POR_UNIDADE)) {
    const achado = lista.find((c) => c.codigo === codigo);
    if (achado) return achado.nome;
  }
  return '';
}

function SecaoUsuarios({ usuarios, onMudou }) {
  const [novo, setNovo] = useState({ nome: '', email: '', perfil: 'gerente_unidade' });
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState(null);
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);

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

  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtro.nome && !u.nome.toLowerCase().includes(filtro.nome.toLowerCase())) return false;
    if (filtro.email && !u.email.toLowerCase().includes(filtro.email.toLowerCase())) return false;
    if (filtro.perfil && u.perfil !== filtro.perfil) return false;
    if (filtro.unidade && !u.unidades.includes(filtro.unidade)) return false;
    if (filtro.cc) {
      const alvo = filtro.cc.toLowerCase();
      const bate = u.ccs.some((c) => c.codigo.toLowerCase().includes(alvo) || nomeCcPorCodigo(c.codigo).toLowerCase().includes(alvo));
      if (!bate) return false;
    }
    if (filtro.ativo === 'ativo' && !u.ativo) return false;
    if (filtro.ativo === 'inativo' && u.ativo) return false;
    return true;
  });

  const filtroAtivo = Object.values(filtro).some((v) => v !== '');

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#7A8088' }}>
          {usuariosFiltrados.length} de {usuarios.length} usuário{usuarios.length === 1 ? '' : 's'}
        </span>
        {filtroAtivo && (
          <button onClick={() => setFiltro(FILTRO_VAZIO)} style={{ ...botaoSecundario, padding: '3px 8px', fontSize: 10.5 }}>Limpar filtros</button>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={th}>Nome</th><th style={th}>E-mail</th><th style={th}>Perfil</th>
            <th style={th}>Unidades</th><th style={th}>Centro de Custo</th><th style={th}>Senha</th><th style={th}>Ativo</th>
          </tr>
          <tr>
            <th style={thFiltro}></th>
            <th style={thFiltro}>
              <input placeholder="filtrar…" value={filtro.nome} onChange={(e) => setFiltro({ ...filtro, nome: e.target.value })} style={campoFiltro} />
            </th>
            <th style={thFiltro}>
              <input placeholder="filtrar…" value={filtro.email} onChange={(e) => setFiltro({ ...filtro, email: e.target.value })} style={campoFiltro} />
            </th>
            <th style={thFiltro}>
              <select value={filtro.perfil} onChange={(e) => setFiltro({ ...filtro, perfil: e.target.value })} style={campoFiltro}>
                <option value="">Todos</option>
                {Object.entries(PERFIL_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </th>
            <th style={thFiltro}>
              <select value={filtro.unidade} onChange={(e) => setFiltro({ ...filtro, unidade: e.target.value })} style={campoFiltro}>
                <option value="">Todas</option>
                {UNIDADES_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </th>
            <th style={thFiltro}>
              <input placeholder="código ou nome…" value={filtro.cc} onChange={(e) => setFiltro({ ...filtro, cc: e.target.value })} style={campoFiltro} />
            </th>
            <th style={thFiltro}></th>
            <th style={thFiltro}>
              <select value={filtro.ativo} onChange={(e) => setFiltro({ ...filtro, ativo: e.target.value })} style={campoFiltro}>
                <option value="">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          {usuariosFiltrados.map((u, i) => <LinhaUsuario key={u.id} numero={i + 1} usuario={u} onMudou={onMudou} />)}
        </tbody>
      </table>
    </div>
  );
}

const campo = { fontSize: 12.5, padding: '6px 8px', borderRadius: 6, border: `1px solid ${COR.borda}` };
const thFiltro = { textAlign: 'left', padding: '4px 8px 8px', borderBottom: `1px solid ${COR.borda}` };
const campoFiltro = { fontSize: 11, padding: '4px 6px', borderRadius: 5, border: `1px solid ${COR.borda}`, width: '100%', boxSizing: 'border-box' };

function LinhaUsuario({ usuario, numero, onMudou }) {
  const [editandoSenha, setEditandoSenha] = useState(false);
  const [senhaNova, setSenhaNova] = useState('');
  const [erroSenha, setErroSenha] = useState(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [erroPerfilBasico, setErroPerfilBasico] = useState(null);

  async function salvarNome() {
    const valor = nome.trim();
    if (!valor || valor === usuario.nome) { setNome(usuario.nome); return; }
    setErroPerfilBasico(null);
    try {
      await atualizarUsuario(usuario.id, { nome: valor });
      onMudou();
    } catch (err) {
      setErroPerfilBasico(err instanceof ApiError ? err.message : 'Falha ao salvar o nome.');
      setNome(usuario.nome);
    }
  }
  async function salvarEmail() {
    const valor = email.trim().toLowerCase();
    if (!valor || valor === usuario.email) { setEmail(usuario.email); return; }
    setErroPerfilBasico(null);
    try {
      await atualizarUsuario(usuario.id, { email: valor });
      onMudou();
    } catch (err) {
      setErroPerfilBasico(err instanceof ApiError ? err.message : 'Falha ao salvar o e-mail.');
      setEmail(usuario.email);
    }
  }

  async function handleDefinirSenha(e) {
    e.preventDefault();
    setSalvandoSenha(true);
    setErroSenha(null);
    try {
      await definirSenhaUsuario(usuario.id, senhaNova);
      setSenhaNova('');
      setEditandoSenha(false);
    } catch (err) {
      setErroSenha(err instanceof ApiError ? err.message : 'Falha ao definir senha.');
    }
    setSalvandoSenha(false);
  }

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
  // Gestor de CC (pedido de 2026-08-16): a unidade é seleção única — trocar
  // de unidade limpa os CCs marcados, já que pertenciam à unidade antiga.
  async function selecionarUnidadeGestorCc(unidadeId) {
    const atual = usuario.unidades[0];
    if (atual === unidadeId) return;
    if (atual) await desvincularUnidade(usuario.id, atual);
    if (usuario.ccs.length > 0) await removerTodosCcUsuario(usuario.id);
    await vincularUnidade(usuario.id, unidadeId);
    onMudou();
  }
  // Checklist — "um gestor pode ser gestor de mais de um CC" (correção de
  // 2026-08-16): cada marcação/desmarcação acumula, não substitui.
  async function toggleCc(unidadeId, ccCodigo, marcado) {
    if (marcado) await vincularCc(usuario.id, unidadeId, ccCodigo);
    else await desvincularCc(usuario.id, unidadeId, ccCodigo);
    onMudou();
  }

  return (
    <tr style={{ opacity: usuario.ativo ? 1 : 0.5 }}>
      <td style={{ ...td, color: '#7A8088' }}>{numero}</td>
      <td style={td}>
        <input
          value={nome} onChange={(e) => setNome(e.target.value)}
          onBlur={salvarNome} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{ ...campo, width: 130 }}
        />
      </td>
      <td style={td}>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          onBlur={salvarEmail} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{ ...campo, width: 190 }}
        />
        {erroPerfilBasico && <div style={{ color: '#C00000', fontSize: 10.5, marginTop: 3 }}>{erroPerfilBasico}</div>}
      </td>
      <td style={td}>
        <select value={usuario.perfil} onChange={(e) => mudarPerfil(e.target.value)} style={campo}>
          {Object.entries(PERFIL_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </td>
      <td style={td}>
        {usuario.perfil === 'gerente_unidade' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {UNIDADES_IDS.map((id) => (
              <button key={id} onClick={() => toggleUnidade(id)} style={{
                ...botaoSecundario, padding: '3px 8px', fontSize: 10.5,
                background: usuario.unidades.includes(id) ? COR.azul : '#fff',
                color: usuario.unidades.includes(id) ? '#fff' : COR.azul,
              }}>{id}</button>
            ))}
          </div>
        )}
        {usuario.perfil === 'gerente_cc_corporativo' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {UNIDADES_IDS.map((id) => (
              <button key={id} onClick={() => selecionarUnidadeGestorCc(id)} style={{
                ...botaoSecundario, padding: '3px 8px', fontSize: 10.5,
                background: usuario.unidades.includes(id) ? COR.azul : '#fff',
                color: usuario.unidades.includes(id) ? '#fff' : COR.azul,
              }}>{id}</button>
            ))}
          </div>
        )}
        {usuario.perfil === 'admin_fpa' && <span style={{ color: '#B5BAC0' }}>—</span>}
      </td>
      <td style={td}>
        {usuario.perfil === 'gerente_cc_corporativo' ? (
          (() => {
            const unidadeId = usuario.unidades[0];
            if (!unidadeId) return <span style={{ color: '#B5BAC0', fontSize: 11 }}>Selecione a unidade primeiro</span>;
            const opcoes = CCS_POR_UNIDADE[unidadeId] || [];
            if (opcoes.length === 0) return <span style={{ color: '#B5BAC0', fontSize: 11 }}>Sem CCs cadastrados nesta unidade</span>;
            const marcados = new Set(usuario.ccs.filter((c) => c.unidadeId === unidadeId).map((c) => c.codigo));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
                {opcoes.map((cc) => (
                  <label key={cc.codigo} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
                    <input
                      type="checkbox" checked={marcados.has(cc.codigo)}
                      onChange={(e) => toggleCc(unidadeId, cc.codigo, e.target.checked)}
                    />
                    {cc.codigo} — {cc.nome}
                  </label>
                ))}
              </div>
            );
          })()
        ) : <span style={{ color: '#B5BAC0' }}>—</span>}
      </td>
      <td style={td}>
        {editandoSenha ? (
          <form onSubmit={handleDefinirSenha} style={{ display: 'flex', gap: 4 }}>
            <input
              required type="password" minLength={8} placeholder="mín. 8 caracteres"
              value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)}
              style={{ ...campo, width: 110 }}
            />
            <button type="submit" disabled={salvandoSenha} style={{ ...botaoSecundario, padding: '4px 8px' }}>✓</button>
            <button type="button" onClick={() => { setEditandoSenha(false); setErroSenha(null); }} style={{ ...botaoSecundario, padding: '4px 8px' }}>×</button>
            {erroSenha && <div style={{ color: '#C00000', fontSize: 10.5, width: '100%' }}>{erroSenha}</div>}
          </form>
        ) : (
          <button onClick={() => setEditandoSenha(true)} style={botaoSecundario}>Definir senha</button>
        )}
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
