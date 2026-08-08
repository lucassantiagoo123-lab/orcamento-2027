import React, { useEffect, useState } from 'react';
import { getMe, irParaLogin } from './api/auth.js';
import { verificarStatusBackend, devLogin } from './api/devLogin.js';
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
  const [statusBackend, setStatusBackend] = useState(null); // { ssoConfigurado, loginDevDisponivel }

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

        {statusBackend?.loginDevDisponivel && <LoginDev onEntrou={() => window.location.reload()} />}
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

/** Login de desenvolvimento — só aparece quando o backend expõe
 * loginDevDisponivel=true (DEV_LOGIN_ENABLED=true e NODE_ENV != production).
 * Serve exclusivamente para testar a interface multiusuário enquanto o SSO
 * do Entra ID não existe (ver backend/src/auth/routes.js). Sem senha, sem
 * verificação de identidade — nunca deve aparecer num ambiente real. */
function LoginDev({ onEntrou }) {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await devLogin(email.trim());
      onEntrou();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Falha ao entrar.');
    }
    setEnviando(false);
  }

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed #D9D9D9', maxWidth: 300 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#C00000', letterSpacing: 0.5, marginBottom: 8 }}>
        ⚠ LOGIN DE DESENVOLVIMENTO — SEM SENHA
      </div>
      <p style={{ fontSize: 11, color: '#7A8088', marginBottom: 10, textAlign: 'left' }}>
        Só existe enquanto o SSO do Entra ID não está configurado. Entra como qualquer
        usuário já cadastrado, só com o e-mail — ver <code>db/seed_usuarios.sql</code>.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6 }}>
        <input
          required type="email" placeholder="lucas.santiago@grupoara.com.br"
          value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '7px 9px', borderRadius: 6, border: '1px solid #D9D9D9' }}
        />
        <button type="submit" disabled={enviando} style={{ fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 6, border: 'none', background: COR_AZUL, color: '#fff', cursor: 'pointer' }}>
          {enviando ? '…' : 'Entrar'}
        </button>
      </form>
      {erro && <p style={{ fontSize: 11, color: '#C00000', marginTop: 6 }}>{erro}</p>}
    </div>
  );
}

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
