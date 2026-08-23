import React, { useEffect, useState } from 'react';
import { getMe, irParaLogin } from './api/auth.js';
import { verificarStatusBackend } from './api/devLogin.js';
import { loginSenha } from './api/senha.js';
import { ApiError } from './api/client.js';
import OrcamentoARA from './OrcamentoARA.jsx';
import AdminPanel from './AdminPanel.jsx';

const COR_AZUL = '#0C4391';
const COR_LARANJA = '#FFA707';

/** Porta de entrada: resolve a sessão (via /auth/me) antes de montar a
 * aplicação. Sem isso, OrcamentoARA não sabe o perfil/escopo real do usuário
 * — e sem perfil real não há como aplicar a matriz de permissões da
 * seção 2.4 na interface (a proteção de verdade é sempre o backend, mas a
 * UI precisa saber o que mostrar). */
export default function AppGate() {
  const [estado, setEstado] = useState('carregando'); // 'carregando' | 'deslogado' | 'logado'
  const [usuario, setUsuario] = useState(null);
  const [tela, setTela] = useState('orcamento'); // 'orcamento' | 'admin' — só admin_fpa alcança 'admin'
  const [statusBackend, setStatusBackend] = useState(null); // { ssoConfigurado } — loginDevDisponivel também vem do /health, mas não é mais usado aqui (ver nota abaixo de LoginSenha)

  useEffect(() => {
    getMe()
      .then((u) => {
        if (u) { setUsuario(u); setEstado('logado'); }
        else setEstado('deslogado');
      })
      .catch(() => setEstado('deslogado'));
    verificarStatusBackend().then(setStatusBackend);
  }, []);

  if (estado === 'carregando') {
    return <TelaCentral texto="Carregando sessão…" />;
  }

  if (estado === 'deslogado') {
    return (
      <TelaCentral>
        <img src="/logos/grupo-ara.jpg" alt="Grupo ARA" style={{ height: 110, marginBottom: 14 }} />
        <img src="/logos/familia-marcas.png" alt="Unidades do Grupo ARA" style={{ height: 48, marginBottom: 20 }} />
        <h1 style={{ fontSize: 20, color: COR_AZUL, marginBottom: 8 }}>Orçamento 2027 — Grupo ARA</h1>
        <p style={{ fontSize: 13, color: '#494949', marginBottom: 20 }}>
          Entre com sua conta Microsoft do Grupo ARA para continuar.
        </p>
        <button
          disabled={!statusBackend?.ssoConfigurado}
          onClick={irParaLogin}
          style={{
            fontSize: 13, fontWeight: 700, padding: '10px 20px', borderRadius: 7,
            border: 'none', background: statusBackend?.ssoConfigurado ? COR_LARANJA : '#D9D9D9',
            color: statusBackend?.ssoConfigurado ? '#fff' : '#8A8F96',
            cursor: statusBackend?.ssoConfigurado ? 'pointer' : 'not-allowed',
          }}
        >
          Entrar com Microsoft
        </button>
        {statusBackend && !statusBackend.ssoConfigurado && (
          <p style={{ fontSize: 11.5, color: '#7A8088', marginTop: 8 }}>
            SSO ainda não configurado (sem App Registration no Entra ID) — botão desabilitado.
          </p>
        )}

        <LoginSenha onEntrou={() => window.location.reload()} />
      </TelaCentral>
    );
  }

  if (tela === 'admin' && usuario.perfil === 'admin_fpa') {
    return <AdminPanel voltar={() => setTela('orcamento')} />;
  }

  return (
    <div>
      {usuario.perfil === 'admin_fpa' && (
        <div style={{ background: '#0A2E63', padding: '4px 22px', textAlign: 'right' }}>
          <button
            onClick={() => setTela('admin')}
            style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid #3E63A8', background: 'transparent', color: '#fff', cursor: 'pointer' }}
          >
            ⚙ Administração
          </button>
        </div>
      )}
      <OrcamentoARA usuario={usuario} />
    </div>
  );
}

/** Login por e-mail e senha (Opção A, em paralelo ao SSO) — só funciona
 * para usuários que já têm uma senha definida por um admin_fpa no painel de
 * administração. Não tem "esqueci minha senha" ainda (pendência registrada
 * em backend/src/auth/senha.js). */
function LoginSenha({ onEntrou }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await loginSenha(email.trim(), senha);
      onEntrou();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Falha ao entrar.');
    }
    setEnviando(false);
  }

  return (
    <div style={{ marginTop: 20, maxWidth: 300 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7A8088', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
        ou entre com e-mail e senha
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          required type="email" placeholder="seu.nome@grupoara.com.br"
          value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ fontSize: 12, padding: '8px 10px', borderRadius: 6, border: '1px solid #D9D9D9' }}
        />
        <input
          required type="password" placeholder="senha"
          value={senha} onChange={(e) => setSenha(e.target.value)}
          style={{ fontSize: 12, padding: '8px 10px', borderRadius: 6, border: '1px solid #D9D9D9' }}
        />
        <button type="submit" disabled={enviando} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 6, border: 'none', background: COR_AZUL, color: '#fff', cursor: 'pointer' }}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      {erro && <p style={{ fontSize: 11, color: '#C00000', marginTop: 6 }}>{erro}</p>}
      <p style={{ fontSize: 10.5, color: '#B5BAC0', marginTop: 8 }}>
        Sem senha ainda? Peça a um Admin FP&amp;A para definir uma no painel de administração.
      </p>
    </div>
  );
}

// Login de desenvolvimento (⚠ "LOGIN DE DESENVOLVIMENTO — SEM SENHA")
// retirado da tela de login em 2026-08-23, agora que todo usuário tem senha
// definida (ver backend/db/seed_usuarios.sql / painel de Administração). O
// componente LoginDev e o import de devLogin() foram removidos daqui — o
// endpoint POST /auth/dev-login no backend continua existindo (gated por
// DEV_LOGIN_ENABLED=true && NODE_ENV!=='production', ver
// backend/src/auth/routes.js), mas some da tela mesmo se alguém reativar a
// env var por engano. Pendência real, fora do alcance do código: confirmar
// que DEV_LOGIN_ENABLED não está setado (ou está 'false') nas variáveis do
// serviço de backend no Railway — só isso desliga a rota de fato.

function TelaCentral({ texto, children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif",
      textAlign: 'center', padding: 24,
    }}>
      {texto ? <p style={{ color: '#7A8088', fontSize: 13 }}>{texto}</p> : children}
    </div>
  );
}
