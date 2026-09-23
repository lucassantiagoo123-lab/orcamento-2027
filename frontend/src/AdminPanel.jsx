// Tela de administração (seções 2.4 e 4.4) — exclusiva admin_fpa. A proteção
// de verdade é o backend (todo /api/admin/* exige exigirPerfil('admin_fpa'));
// esta tela só existe para quem já tem esse perfil real na sessão (ver
// AppGate.jsx), então não há checagem de perfil aqui dentro.
import React, { useEffect, useState } from 'react';
import {
  listarUsuarios, criarUsuario, atualizarUsuario, vincularUnidade, desvincularUnidade,
  vincularCc, desvincularCc, removerTodosCcUsuario, listarConcessoes, criarConcessao, revogarConcessao,
  definirAcessoUsuario, listarSnapshots, restaurarSnapshot,
  listarAlertas, resolverAlerta, listarHistoricoCapex, detalharHistoricoCapex, restaurarProjetosCapex,
  recalcularTotaisVersoes, listarPeriodosEdicao, definirPeriodoEdicao,
} from './api/admin.js';
import { definirSenhaUsuario } from './api/senha.js';
import { ApiError } from './api/client.js';
import { CCS_TEXTIL, CCS_AGRICOLA, CCS_RESORTS, CCS_CORPORATIVO, FAMILIA_AGRICOLA, FAMILIA_RESORTS } from './OrcamentoARA.jsx';

const COR = { azul: '#0C4391', laranja: '#FFA707', texto: '#494949', borda: '#D9D9D9', claro: '#F7F7F7' };
// 2026-08-20: Agrícola e Resorts viraram 3 "unidades" cada — os 2 sites
// (fazendas/resorts, onde o lançamento de verdade acontece) e o Consolidado
// (só leitura + envio — ver ConsolidadoAgricola/ConsolidadoResorts no
// OrcamentoARA.jsx). Um Gestor da Unidade normalmente precisa das 3
// vinculadas pra ter o pacote completo (editar os dois sites + enviar o
// Consolidado); um Gestor de CC só precisa dos dois sites (não acessa o
// Consolidado).
const UNIDADES_IDS = ['textil', 'agricola_tds', 'agricola_fds', 'agricola', 'samoa_beach', 'samoa_villa', 'resorts', 'ei', 'energia', 'corporativo'];
// Bug encontrado em 2026-08-30: os 3 botões de uma família (ex.: samoa_beach/
// samoa_villa/resorts) eram toggles independentes — marcar só 'resorts' (ou
// esquecer um dos dois sites) deixava um Gestor da Unidade com vínculo
// inconsistente: a aba "Consolidado" aparece pra ele (por causa de 'resorts'
// nos vínculos), mas ConsolidadoResorts busca os dois sites + o consolidado
// juntos (Promise.all) e quebra com "Sem acesso à unidade samoa_villa" (ou
// samoa_beach) assim que falta um dos três. Agrupar aqui pra marcar/
// desmarcar a família inteira de uma vez elimina esse estado inválido.
const FAMILIAS_UNIDADE = [FAMILIA_AGRICOLA, FAMILIA_RESORTS];
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
// Têxtil (2026-08-19), Agrícola (2026-08-20) e Resorts (2026-08-20) já têm
// CC real. EI/Energia ainda não têm CC.
const CCS_POR_UNIDADE = {
  textil: CCS_TEXTIL,
  agricola_tds: CCS_AGRICOLA,
  agricola_fds: CCS_AGRICOLA,
  agricola: [], // Consolidado — sem CC próprio pra vincular Gestor de CC (ver nota acima)
  samoa_beach: CCS_RESORTS.filter(cc => cc.resorts.includes('beach')),
  samoa_villa: CCS_RESORTS.filter(cc => cc.resorts.includes('villa')),
  resorts: [], // Consolidado — idem
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
          <SecaoAlertas />
          <SecaoPeriodoEdicao />
          <SecaoUsuarios usuarios={usuarios} onMudou={carregar} />
          <SecaoConcessoes usuarios={usuarios} concessoes={concessoes} onMudou={carregar} />
          <SecaoHistoricoCapex />
          <SecaoRecuperacaoDados />
          <SecaoRecalcularTotais />
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

const FILTRO_VAZIO = { nome: '', email: '', perfil: '', unidade: '', cc: '', acesso: '', ativo: '' };

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
    if (filtro.acesso === 'indefinido' && u.acesso_expira_em) return false;
    if (filtro.acesso === 'definido' && !u.acesso_expira_em) return false;
    if (filtro.acesso === 'expirado' && !u.acesso_expirado) return false;
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
            <th style={th}>Unidades</th><th style={th}>Centro de Custo</th><th style={th}>Senha</th><th style={th}>Tempo de Acesso</th><th style={th}>Ativo</th>
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
              <select value={filtro.acesso} onChange={(e) => setFiltro({ ...filtro, acesso: e.target.value })} style={campoFiltro}>
                <option value="">Todos</option>
                <option value="indefinido">Indefinido</option>
                <option value="definido">Definido</option>
                <option value="expirado">Expirado</option>
              </select>
            </th>
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
  const [editandoAcesso, setEditandoAcesso] = useState(false);
  const [tipoAcesso, setTipoAcesso] = useState(usuario.acesso_expira_em ? 'definido' : 'indefinido');
  const [dataAcesso, setDataAcesso] = useState(usuario.acesso_expira_em || '');
  const [erroAcesso, setErroAcesso] = useState(null);
  const [salvandoAcesso, setSalvandoAcesso] = useState(false);
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
      onMudou();
    } catch (err) {
      setErroSenha(err instanceof ApiError ? err.message : 'Falha ao definir senha.');
    }
    setSalvandoSenha(false);
  }

  // Tempo de acesso (2026-08-23): Indefinido (padrão, sem mudança de
  // comportamento) ou Definido com uma data — depois dela o usuário
  // continua vendo o orçamento (GET) mas perde a escrita (bloqueado no
  // backend, ver middleware/authorize.js::exigirAcessoNaoExpirado).
  async function handleSalvarAcesso(e) {
    e.preventDefault();
    if (tipoAcesso === 'definido' && !dataAcesso) {
      setErroAcesso('Informe a data.');
      return;
    }
    setSalvandoAcesso(true);
    setErroAcesso(null);
    try {
      await definirAcessoUsuario(usuario.id, tipoAcesso === 'definido' ? dataAcesso : null);
      setEditandoAcesso(false);
      onMudou();
    } catch (err) {
      setErroAcesso(err instanceof ApiError ? err.message : 'Falha ao salvar o tempo de acesso.');
    }
    setSalvandoAcesso(false);
  }
  function cancelarEdicaoAcesso() {
    setEditandoAcesso(false);
    setErroAcesso(null);
    setTipoAcesso(usuario.acesso_expira_em ? 'definido' : 'indefinido');
    setDataAcesso(usuario.acesso_expira_em || '');
  }

  // Abre o app de e-mail padrão do Windows (Outlook, se for o padrão) com
  // destinatário, assunto e corpo já preenchidos — pedido de 2026-08-23,
  // alternativa ao envio via SMTP do servidor (que precisa de
  // SMTP_HOST/SMTP_USER/SMTP_PASS configurados no Railway, e hoje não
  // estão). Não depende de nenhuma configuração: mailto: é só um link, o
  // navegador delega pro app de e-mail já instalado no computador do admin.
  // O admin ainda precisa clicar em "Enviar" lá — isto só monta o rascunho.
  function abrirNoOutlook() {
    const assunto = 'Seu acesso à plataforma de Orçamento 2027';
    const corpo = [
      `Olá, ${usuario.nome}.`,
      '',
      'Seu acesso à plataforma de Orçamento 2027 do Grupo ARA:',
      `Login: ${usuario.email}`,
      `Senha: ${usuario.senha_texto}`,
      '',
      `Acessar: ${window.location.origin}`,
      '',
      'Guarde este e-mail em local seguro. Se precisar trocar a senha, peça a um Admin FP&A.',
    ].join('\n');
    window.location.href = `mailto:${usuario.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  }

  async function mudarPerfil(perfil) {
    await atualizarUsuario(usuario.id, { perfil });
    onMudou();
  }
  async function alternarAtivo() {
    await atualizarUsuario(usuario.id, { ativo: !usuario.ativo });
    onMudou();
  }
  // Bug de 2026-08-30 (ver nota em FAMILIAS_UNIDADE): id de uma família
  // (Agrícola/Resorts) sempre vincula/desvincula os 3 juntos — nunca deixa
  // marcar só 1 ou 2. Se a família já está completa, o clique desfaz tudo;
  // caso contrário, completa o que faltar (sem desmarcar o que já tinha).
  async function toggleUnidade(unidadeId) {
    const familia = FAMILIAS_UNIDADE.find((f) => f.includes(unidadeId));
    if (familia) {
      const completa = familia.every((id) => usuario.unidades.includes(id));
      if (completa) await Promise.all(familia.map((id) => desvincularUnidade(usuario.id, id)));
      else await Promise.all(familia.filter((id) => !usuario.unidades.includes(id)).map((id) => vincularUnidade(usuario.id, id)));
      onMudou();
      return;
    }
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {usuario.senha_texto ? (
              <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{usuario.senha_texto}</span>
            ) : (
              <span style={{ color: '#B5BAC0', fontSize: 11 }}>Sem senha definida</span>
            )}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setEditandoSenha(true)} style={{ ...botaoSecundario, padding: '3px 7px', fontSize: 10.5 }}>
                {usuario.senha_texto ? 'Redefinir' : 'Definir'}
              </button>
              {usuario.senha_texto && (
                <button onClick={abrirNoOutlook} style={{ ...botaoSecundario, padding: '3px 7px', fontSize: 10.5 }}>
                  Abrir no Outlook
                </button>
              )}
            </div>
          </div>
        )}
      </td>
      <td style={td}>
        {editandoAcesso ? (
          <form onSubmit={handleSalvarAcesso} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: 'hidden', width: 'fit-content' }}>
              <button
                type="button" onClick={() => setTipoAcesso('indefinido')}
                style={{
                  fontSize: 10.5, fontWeight: 700, padding: '3px 8px', border: 'none', cursor: 'pointer',
                  background: tipoAcesso === 'indefinido' ? COR.azul : '#fff',
                  color: tipoAcesso === 'indefinido' ? '#fff' : COR.azul,
                }}
              >Indefinido</button>
              <button
                type="button" onClick={() => setTipoAcesso('definido')}
                style={{
                  fontSize: 10.5, fontWeight: 700, padding: '3px 8px', border: 'none', cursor: 'pointer',
                  background: tipoAcesso === 'definido' ? COR.laranja : '#fff',
                  color: tipoAcesso === 'definido' ? '#fff' : COR.azul,
                }}
              >Definido</button>
            </div>
            {tipoAcesso === 'definido' && (
              <input
                required type="date" value={dataAcesso} onChange={(e) => setDataAcesso(e.target.value)}
                style={{ ...campo, width: 132 }}
              />
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="submit" disabled={salvandoAcesso} style={{ ...botaoSecundario, padding: '4px 8px' }}>✓</button>
              <button type="button" onClick={cancelarEdicaoAcesso} style={{ ...botaoSecundario, padding: '4px 8px' }}>×</button>
            </div>
            {erroAcesso && <div style={{ color: '#C00000', fontSize: 10.5 }}>{erroAcesso}</div>}
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {usuario.acesso_expira_em ? (
              <span style={{ fontSize: 11, color: usuario.acesso_expirado ? '#C00000' : COR.texto, fontWeight: usuario.acesso_expirado ? 700 : 400 }}>
                {usuario.acesso_expirado ? 'Expirado em ' : 'Definido até '}
                {new Date(usuario.acesso_expira_em + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#B5BAC0' }}>Indefinido</span>
            )}
            <button onClick={() => setEditandoAcesso(true)} style={{ ...botaoSecundario, padding: '3px 7px', fontSize: 10.5, width: 'fit-content' }}>Editar</button>
          </div>
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

const CAMPO_LABEL = {
  estrategicas: 'Premissas Estratégicas', receita: 'Receita', custos: 'Custos e Despesas',
  capex: 'CAPEX', capitalGiro: 'Capital de Giro', provisoes: 'Provisões',
  resultado: 'Resultado (Não Operacional)', fcFinanciamentos: 'FC Financiamentos',
  balanco: 'Balanço Patrimonial', plano5y: 'Plano 5Y (2028-2031)', sensibilidades: 'Sensibilidades',
};
const UNIDADE_LABEL = {
  textil: 'ARA Têxtil', agricola: 'ARA Agrícola — Consolidado',
  agricola_tds: 'ARA Agrícola — Terra do Sol', agricola_fds: 'ARA Agrícola — Frutos do Sol',
  resorts: 'ARA Resorts — Consolidado', samoa_beach: 'ARA Resorts — Samoa Beach',
  samoa_villa: 'ARA Resorts — Samoa Villa', corporativo: 'Corporativo',
};
const UNIDADES_BACKUP = Object.keys(UNIDADE_LABEL);

function SecaoRecuperacaoDados() {
  const [unidadeSel, setUnidadeSel] = useState('textil');
  const [snapshots, setSnapshots] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [restaurando, setRestaurando] = useState(null);
  const [msg, setMsg] = useState(null);

  async function carregar() {
    setCarregando(true);
    setMsg(null);
    try {
      const data = await listarSnapshots(unidadeSel);
      setSnapshots(data.snapshots);
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.message : 'Erro ao carregar snapshots.' });
    } finally {
      setCarregando(false);
    }
  }

  async function handleRestaurar(snap) {
    const unidadeNome = UNIDADE_LABEL[snap.unidade_id] || snap.unidade_id;
    const campo = CAMPO_LABEL[snap.campo] || snap.campo;
    const kbAntes = snap.tam_anterior ? Math.round(snap.tam_anterior / 1024) : 0;
    const kbDepois = snap.tam_novo ? Math.round(snap.tam_novo / 1024) : 0;
    const confirmado = window.confirm(
      `⚠️ RESTAURAR — ${unidadeNome}\n\nSeção: ${campo}\nData do snapshot: ${new Date(snap.criado_em).toLocaleString('pt-BR')}\nAutor da alteração: ${snap.usuario_nome}\n\n` +
      `Isso substituirá os dados ATUAIS (${kbDepois} KB) pelo estado ANTERIOR (${kbAntes} KB).\n` +
      `Gestores que estiverem editando agora perderão mudanças não salvas.\n\nConfirmar restauração?`
    );
    if (!confirmado) return;
    setRestaurando(snap.id);
    setMsg(null);
    try {
      await restaurarSnapshot(snap.id);
      setMsg({ tipo: 'ok', texto: `✓ Seção "${campo}" de ${unidadeNome} restaurada. Peça aos gestores que recarreguem a página para ver o estado restaurado.` });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.message : 'Erro ao restaurar snapshot.' });
    } finally {
      setRestaurando(null);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Recuperação de Dados</h2>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Lista os últimos 100 snapshots por unidade. Use para restaurar uma seção ao estado anterior após uma edição acidental.
        {' '}<strong style={{ color: '#C00000' }}>A restauração substitui a seção inteira — desfaz também o que outros usuários salvaram depois.</strong>
        {' '}Para CapEx, prefira o Histórico de CapEx por projeto acima. Toda restauração fica registrada no histórico.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <select
          value={unidadeSel}
          onChange={e => { setUnidadeSel(e.target.value); setSnapshots(null); setMsg(null); }}
          style={{ fontSize: 12, padding: '6px 10px', border: `1px solid ${COR.borda}`, borderRadius: 6, fontFamily: 'inherit' }}
        >
          {UNIDADES_BACKUP.map(id => <option key={id} value={id}>{UNIDADE_LABEL[id]}</option>)}
        </select>
        <button onClick={carregar} disabled={carregando} style={botaoSecundario}>
          {carregando ? 'Carregando…' : 'Carregar snapshots'}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12, background: msg.tipo === 'ok' ? '#E8F5E9' : '#FDECEC', color: msg.tipo === 'ok' ? '#2E7D32' : '#C00000', border: `1px solid ${msg.tipo === 'ok' ? '#A5D6A7' : '#FFCDD2'}` }}>
          {msg.texto}
        </div>
      )}

      {snapshots !== null && (
        snapshots.length === 0
          ? <p style={{ fontSize: 12, color: '#8A8F96' }}>Nenhum snapshot encontrado para esta unidade.</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Data/hora</th>
                    <th style={th}>Usuário</th>
                    <th style={th}>Seção</th>
                    <th style={{ ...th, textAlign: 'right' }}>KB antes</th>
                    <th style={{ ...th, textAlign: 'right' }}>KB depois</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(s => (
                    <tr key={s.id}>
                      <td style={td}>{new Date(s.criado_em).toLocaleString('pt-BR')}</td>
                      <td style={td}>{s.usuario_nome}</td>
                      <td style={td}>{CAMPO_LABEL[s.campo] || s.campo}</td>
                      <td style={{ ...td, textAlign: 'right', color: s.tam_anterior > 0 ? COR.texto : '#B5B9BE' }}>
                        {s.tam_anterior ? Math.round(s.tam_anterior / 1024) : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{s.tam_novo ? Math.round(s.tam_novo / 1024) : '—'}</td>
                      <td style={td}>
                        <button
                          onClick={() => handleRestaurar(s)}
                          disabled={restaurando === s.id || !s.tam_anterior}
                          style={{ ...botaoSecundario, color: s.tam_anterior ? '#C00000' : '#B5B9BE', cursor: s.tam_anterior ? 'pointer' : 'default' }}
                        >
                          {restaurando === s.id ? '…' : 'Restaurar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  );
}

const reais = (v) => `R$ ${Math.round(Number(v) || 0).toLocaleString('pt-BR')}`;
const dataHora = (d) => new Date(d).toLocaleString('pt-BR');

// Alertas de possível perda de dados (2026-09-23) — gerados no backend a cada
// save suspeito (ver backend/src/db/detectarPerdas.js).
function SecaoAlertas() {
  const [alertas, setAlertas] = useState(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [erro, setErro] = useState(null);
  const [resolvendo, setResolvendo] = useState(null);

  async function carregar(todos) {
    setErro(null);
    try {
      const r = await listarAlertas(todos);
      setAlertas(r.alertas);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar alertas.');
    }
  }

  useEffect(() => { carregar(mostrarTodos); }, [mostrarTodos]);

  async function resolver(id) {
    setResolvendo(id);
    try {
      await resolverAlerta(id);
      await carregar(mostrarTodos);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao marcar como verificado.');
    }
    setResolvendo(null);
  }

  const pendentes = (alertas || []).filter((a) => !a.resolvido_em).length;

  return (
    <div style={{ marginBottom: 28, border: `1px solid ${pendentes ? '#C00000' : COR.borda}`, borderRadius: 8, padding: 14, background: pendentes ? '#FFF6F6' : '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, color: pendentes ? '#C00000' : COR.azul, margin: 0 }}>
          ⚠ Alertas de possível perda de dados{pendentes ? ` — ${pendentes} pendente${pendentes > 1 ? 's' : ''}` : ''}
        </h2>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarTodos} onChange={(e) => setMostrarTodos(e.target.checked)} />
          Mostrar também os já verificados
        </label>
      </div>
      <p style={{ fontSize: 12, color: '#7A8088', margin: '6px 0 12px' }}>
        Gerados automaticamente quando um salvamento remove ou reduz dados de um jeito incomum (ex.: um gestor alterando CapEx de um CC que não é dele,
        ou vários projetos apagados de uma vez). Confira no <strong>Histórico de CapEx por projeto</strong> abaixo e, se for perda real, restaure.
      </p>
      {erro && <p style={{ fontSize: 12, color: '#C00000' }}>{erro}</p>}
      {alertas === null ? <p style={{ fontSize: 12 }}>Carregando…</p> : alertas.length === 0 ? (
        <p style={{ fontSize: 12, color: '#2E7D32' }}>✓ Nenhum alerta{mostrarTodos ? '' : ' pendente'}.</p>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Data/hora</th>
                <th style={th}>Unidade</th>
                <th style={th}>Quem salvou</th>
                <th style={th}>O que aconteceu</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((a) => (
                <tr key={a.id} style={{ opacity: a.resolvido_em ? 0.55 : 1 }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataHora(a.criado_em)}</td>
                  <td style={td}>{UNIDADE_LABEL[a.unidade_id] || a.unidade_id}</td>
                  <td style={td}>{a.usuario_nome || '—'}</td>
                  <td style={td}>
                    <strong>{CAMPO_LABEL[a.secao] || a.secao}:</strong> {a.descricao}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {a.resolvido_em ? (
                      <span style={{ fontSize: 11, color: '#7A8088' }}>Verificado por {a.resolvido_por_nome || '—'}</span>
                    ) : (
                      <button onClick={() => resolver(a.id)} disabled={resolvendo === a.id} style={botaoSecundario}>
                        {resolvendo === a.id ? '…' : 'Marcar como verificado'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Período de edição dos Gestores de CC, por unidade (2026-09-23). Encerrado =
// Gestor de CC só visualiza (trava no servidor, ver exigirPeriodoEdicaoAberto).
function SecaoPeriodoEdicao() {
  const [periodos, setPeriodos] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const [erro, setErro] = useState(null);

  async function carregar() {
    try {
      setPeriodos((await listarPeriodosEdicao()).periodos);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar o período de edição.');
    }
  }
  useEffect(() => { carregar(); }, []);

  async function alternar(p) {
    const nome = UNIDADE_LABEL[p.unidade_id] || p.unidade_id;
    const encerrar = !p.encerrado;
    const ok = window.confirm(encerrar
      ? `Encerrar o período de edição de ${nome}?\n\nOs Gestores de CC dessa unidade passam a ver o orçamento apenas para consulta — não conseguem mais salvar nem enviar. Admin FP&A e Gestor da Unidade continuam editando.`
      : `Reabrir o período de edição de ${nome} para os Gestores de CC?`);
    if (!ok) return;
    setSalvando(p.unidade_id);
    setErro(null);
    try {
      await definirPeriodoEdicao(p.unidade_id, encerrar);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao alterar o período de edição.');
    }
    setSalvando(null);
  }

  return (
    <div style={{ marginBottom: 28, border: `1px solid ${COR.borda}`, borderRadius: 8, padding: 14 }}>
      <h2 style={{ fontSize: 15, color: COR.azul, margin: '0 0 4px' }}>Período de edição — Gestores de CC</h2>
      <p style={{ fontSize: 12, color: '#7A8088', margin: '0 0 12px' }}>
        Com o período <strong>encerrado</strong>, os Gestores de CC da unidade veem "Período de edição finalizado — liberado apenas visualização"
        e não conseguem mais salvar nem enviar. Admin FP&amp;A e Gestor da Unidade não são afetados.
      </p>
      {erro && <p style={{ fontSize: 12, color: '#C00000' }}>{erro}</p>}
      {periodos === null ? <p style={{ fontSize: 12 }}>Carregando…</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Unidade</th>
              <th style={th}>Situação</th>
              <th style={th}>Última alteração</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.unidade_id}>
                <td style={td}>{UNIDADE_LABEL[p.unidade_id] || p.unidade_id}</td>
                <td style={td}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: p.encerrado ? '#C00000' : '#2E7D32', background: p.encerrado ? '#FDECEC' : '#E8F5E9' }}>
                    {p.encerrado ? '🔒 Encerrado — só visualização' : 'Aberto para edição'}
                  </span>
                </td>
                <td style={{ ...td, fontSize: 11.5, color: '#7A8088' }}>
                  {p.alterado_em ? `${dataHora(p.alterado_em)}${p.alterado_por_nome ? ` — ${p.alterado_por_nome}` : ''}` : '—'}
                </td>
                <td style={td}>
                  <button onClick={() => alternar(p)} disabled={salvando === p.unidade_id} style={p.encerrado ? botaoSecundario : { ...botaoSecundario, color: '#C00000' }}>
                    {salvando === p.unidade_id ? '…' : p.encerrado ? 'Reabrir edição' : 'Encerrar edição'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Recalcular totais das versões já enviadas (2026-09-23) — ver
// backend/src/db/recalcularTotaisVersoes.js. Sempre simula antes de aplicar.
function SecaoRecalcularTotais() {
  const [resultado, setResultado] = useState(null);
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState(null);

  async function rodar(aplicar) {
    if (aplicar && !window.confirm(
      `Atualizar os totais (Receita Líquida, EBITDA, Lucro Líquido) de ${mudaram.length} versão(ões) enviada(s)?\n\n` +
      'O conteúdo enviado de cada versão não muda — só os números de resumo usados no Backlog. O valor anterior fica guardado e pode ser restaurado.'
    )) return;
    setRodando(true);
    setMsg(null);
    try {
      const r = await recalcularTotaisVersoes(aplicar);
      setResultado(r);
      if (aplicar) setMsg({ tipo: 'ok', texto: `✓ Totais atualizados em ${r.versoes.filter((v) => v.mudou).length} versão(ões).` });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.message : 'Erro ao recalcular.' });
    }
    setRodando(false);
  }

  const mudaram = (resultado?.versoes || []).filter((v) => v.mudou);
  const comErro = (resultado?.versoes || []).filter((v) => v.erro);

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Recalcular totais das versões enviadas</h2>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Até 23/09 o servidor calculava o EBITDA/Lucro gravado no envio sem os encargos do Novo HC, sem o 2º dissídio e sem os rateios de
        Hospedagem/A&amp;B da Resorts. Isto recalcula esses três números a partir do conteúdo que cada versão guardou, com as regras atuais.
        Usa o IPCA/câmbio de <strong>hoje</strong> — versões marcadas com ⚠ tiveram a receita alterada por isso.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => rodar(false)} disabled={rodando} style={botaoSecundario}>
          {rodando && !resultado ? 'Simulando…' : 'Simular (não grava nada)'}
        </button>
        {resultado && !resultado.aplicado && mudaram.length > 0 && (
          <button onClick={() => rodar(true)} disabled={rodando} style={botaoPrimario}>
            {rodando ? 'Aplicando…' : `Aplicar em ${mudaram.length} versão(ões)`}
          </button>
        )}
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12, background: msg.tipo === 'ok' ? '#E8F5E9' : '#FDECEC', color: msg.tipo === 'ok' ? '#2E7D32' : '#C00000', border: `1px solid ${msg.tipo === 'ok' ? '#A5D6A7' : '#FFCDD2'}` }}>
          {msg.texto}
        </div>
      )}

      {resultado && (
        <>
          <p style={{ fontSize: 12, marginBottom: 8 }}>
            {resultado.versoes.length} versão(ões) analisada(s) — <strong>{mudaram.length}</strong> com total diferente
            {comErro.length > 0 && <span style={{ color: '#C00000' }}> — {comErro.length} com erro no cálculo (não serão alteradas)</span>}.
          </p>
          {mudaram.length > 0 && (
            <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: `1px solid ${COR.borda}`, borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Unidade</th>
                    <th style={th}>Enviada em</th>
                    <th style={th}>Autor</th>
                    <th style={{ ...th, textAlign: 'right' }}>EBITDA gravado</th>
                    <th style={{ ...th, textAlign: 'right' }}>EBITDA correto</th>
                    <th style={{ ...th, textAlign: 'right' }}>Lucro gravado</th>
                    <th style={{ ...th, textAlign: 'right' }}>Lucro correto</th>
                  </tr>
                </thead>
                <tbody>
                  {mudaram.map((v) => (
                    <tr key={v.id}>
                      <td style={td}>{v.receitaMudou && <span title="Receita mudou: IPCA/câmbio de hoje diferente do dia do envio">⚠ </span>}{UNIDADE_LABEL[v.unidade_id] || v.unidade_id}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataHora(v.enviado_em)}</td>
                      <td style={td}>{v.autor_nome}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{reais(v.antes.ebitda)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{reais(v.depois.ebitda)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{reais(v.antes.lucroLiquido)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{reais(v.depois.lucroLiquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SITUACAO_PROJETO = {
  igual: { texto: 'Igual a hoje', cor: '#2E7D32', fundo: '#E8F5E9' },
  diferente: { texto: 'Diferente de hoje', cor: '#8A5A00', fundo: '#FFF4DC' },
  ausente_hoje: { texto: 'Não existe hoje', cor: '#C00000', fundo: '#FDECEC' },
};

// Histórico de CapEx por projeto (2026-09-23) — cada linha é um salvamento
// que mexeu no CapEx; abre os projetos daquele momento e restaura só os
// escolhidos (sem desfazer o que outros gestores salvaram depois).
function SecaoHistoricoCapex() {
  const [unidadeSel, setUnidadeSel] = useState('corporativo');
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(null);
  const [lado, setLado] = useState('anterior');
  const [marcados, setMarcados] = useState(new Set());
  const [restaurando, setRestaurando] = useState(false);
  const [msg, setMsg] = useState(null);

  async function carregar() {
    setCarregando(true);
    setMsg(null);
    setDetalhe(null);
    try {
      const r = await listarHistoricoCapex(unidadeSel);
      setHistorico(r.historico);
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.message : 'Erro ao carregar o histórico.' });
    }
    setCarregando(false);
  }

  async function abrir(logId) {
    setCarregandoDetalhe(logId);
    setMsg(null);
    try {
      setDetalhe(await detalharHistoricoCapex(unidadeSel, logId));
      setMarcados(new Set());
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.message : 'Erro ao abrir o salvamento.' });
    }
    setCarregandoDetalhe(null);
  }

  const projetos = detalhe ? detalhe[lado] : [];
  const restauraveis = projetos.filter((p) => p.situacao !== 'igual');

  function alternar(id) {
    setMarcados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  async function restaurar() {
    const escolhidos = projetos.filter((p) => marcados.has(p.id));
    if (escolhidos.length === 0) return;
    const ok = window.confirm(
      `Restaurar ${escolhidos.length} projeto(s) de CapEx de ${UNIDADE_LABEL[unidadeSel]} para como estavam ` +
      `${lado === 'anterior' ? 'ANTES' : 'DEPOIS'} do salvamento de ${detalhe.usuario_nome} em ${dataHora(detalhe.criado_em)}?\n\n` +
      escolhidos.map((p) => `• ${p.nome || 'sem nome'} (${p.ccCodigo || 'sem CC'}): ${p.totalHoje === null ? 'não existe hoje' : reais(p.totalHoje)} → ${reais(p.total)}`).join('\n') +
      '\n\nSó esses projetos mudam; o resto do CapEx fica como está. A restauração fica registrada no histórico e pode ser desfeita.'
    );
    if (!ok) return;
    setRestaurando(true);
    setMsg(null);
    try {
      await restaurarProjetosCapex(unidadeSel, detalhe.id, escolhidos.map((p) => p.id), lado);
      setMsg({ tipo: 'ok', texto: `✓ ${escolhidos.length} projeto(s) restaurado(s). Peça aos gestores que recarreguem a página (F5).` });
      await abrir(detalhe.id);
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.message : 'Erro ao restaurar.' });
    }
    setRestaurando(false);
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, color: COR.azul, marginBottom: 4 }}>Histórico de CapEx por projeto</h2>
      <p style={{ fontSize: 12, color: '#7A8088', marginBottom: 14 }}>
        Cada linha é um salvamento que alterou o CapEx. Em vermelho, os que reduziram o total. Abra um salvamento, veja os projetos como estavam
        antes ou depois dele e restaure <strong>só os projetos escolhidos</strong> — o que outros gestores salvaram depois não é desfeito.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <select
          value={unidadeSel}
          onChange={(e) => { setUnidadeSel(e.target.value); setHistorico(null); setDetalhe(null); setMsg(null); }}
          style={{ fontSize: 12, padding: '6px 10px', border: `1px solid ${COR.borda}`, borderRadius: 6, fontFamily: 'inherit' }}
        >
          {UNIDADES_BACKUP.map((id) => <option key={id} value={id}>{UNIDADE_LABEL[id]}</option>)}
        </select>
        <button onClick={carregar} disabled={carregando} style={botaoSecundario}>
          {carregando ? 'Carregando…' : 'Carregar histórico'}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12, background: msg.tipo === 'ok' ? '#E8F5E9' : '#FDECEC', color: msg.tipo === 'ok' ? '#2E7D32' : '#C00000', border: `1px solid ${msg.tipo === 'ok' ? '#A5D6A7' : '#FFCDD2'}` }}>
          {msg.texto}
        </div>
      )}

      {historico !== null && (historico.length === 0 ? (
        <p style={{ fontSize: 12, color: '#8A8F96' }}>Nenhuma alteração de CapEx registrada para esta unidade.</p>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: `1px solid ${COR.borda}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Data/hora</th>
                <th style={th}>Quem salvou</th>
                <th style={{ ...th, textAlign: 'right' }}>Projetos</th>
                <th style={{ ...th, textAlign: 'right' }}>Total antes</th>
                <th style={{ ...th, textAlign: 'right' }}>Total depois</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => {
                const caiu = h.depois.total < h.antes.total - 1000;
                const aberto = detalhe?.id === h.id;
                return (
                  <tr key={h.id} style={{ background: aberto ? '#EEF3FB' : caiu ? '#FFF6F6' : undefined }}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataHora(h.criado_em)}</td>
                    <td style={td}>
                      {h.usuario_nome}
                      {h.motivo && <div style={{ fontSize: 10.5, color: '#7A8088' }}>{h.motivo}</div>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{h.antes.projetos} → {h.depois.projetos}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{reais(h.antes.total)}</td>
                    <td style={{ ...td, textAlign: 'right', color: caiu ? '#C00000' : COR.texto, fontWeight: caiu ? 700 : 400 }}>{reais(h.depois.total)}</td>
                    <td style={td}>
                      <button onClick={() => abrir(h.id)} disabled={carregandoDetalhe === h.id} style={botaoSecundario}>
                        {carregandoDetalhe === h.id ? '…' : 'Ver projetos'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {detalhe && (
        <div style={{ marginTop: 16, border: `1px solid ${COR.azul}`, borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COR.azul }}>
              Salvamento de {detalhe.usuario_nome} — {dataHora(detalhe.criado_em)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['anterior', 'Como estava ANTES'], ['novo', 'Como ficou DEPOIS']].map(([id, rotulo]) => (
                <button
                  key={id}
                  onClick={() => { setLado(id); setMarcados(new Set()); }}
                  style={{ ...botaoSecundario, background: lado === id ? COR.azul : '#fff', color: lado === id ? '#fff' : COR.azul }}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          {projetos.length === 0 ? <p style={{ fontSize: 12, color: '#8A8F96' }}>Nenhum projeto neste momento.</p> : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}></th>
                    <th style={th}>Projeto</th>
                    <th style={th}>CC</th>
                    <th style={th}>Categoria</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total neste momento</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total hoje</th>
                    <th style={th}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {projetos.map((p) => {
                    const s = SITUACAO_PROJETO[p.situacao];
                    return (
                      <tr key={p.id}>
                        <td style={td}>
                          <input type="checkbox" disabled={p.situacao === 'igual'} checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
                        </td>
                        <td style={td}>{p.nome || <em style={{ color: '#8A8F96' }}>sem nome</em>}</td>
                        <td style={td}>{p.ccCodigo || '—'}</td>
                        <td style={td}>{p.categoria || '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{reais(p.total)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{p.totalHoje === null ? '—' : reais(p.totalHoje)}</td>
                        <td style={td}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: s.cor, background: s.fundo }}>{s.texto}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setMarcados(new Set(restauraveis.map((p) => p.id)))}
                  disabled={restauraveis.length === 0}
                  style={botaoSecundario}
                >
                  Marcar todos os que mudaram ({restauraveis.length})
                </button>
                <button onClick={restaurar} disabled={marcados.size === 0 || restaurando} style={{ ...botaoPrimario, opacity: marcados.size === 0 ? 0.5 : 1 }}>
                  {restaurando ? 'Restaurando…' : `Restaurar selecionados (${marcados.size})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
