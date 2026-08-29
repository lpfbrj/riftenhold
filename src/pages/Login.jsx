import React, { useState } from 'react';
import { entrar, CONTAS_DEMO } from '../lib/auth.js';
import { SUPABASE_ATIVO } from '../lib/supabase.js';
import { Brasao, Texto, Icone } from '../components/ui.jsx';

export default function Login({ aoEntrar, aoVoltar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      aoEntrar(await entrar(email, senha));
    } catch (ex) {
      setErro(ex.message);
      setOcupado(false);
    }
  }

  return (
    <div className="login-tela">
      <div className="login-caixa">
        {aoVoltar && <button className="btn pq fantasma voltar" onClick={aoVoltar}>← Portal</button>}
        <Brasao tamanho={58} />
        <h1>Mistveil Keep</h1>
        <div className="sub">Corte do Hold de Riften</div>

        <form onSubmit={enviar}>
          {erro && <div className="login-erro">{erro}</div>}
          <Texto
            rotulo="Identificação"
            valor={email}
            aoMudar={setEmail}
            type={SUPABASE_ATIVO ? 'email' : 'text'}
            autoComplete="username"
            placeholder={SUPABASE_ATIVO ? 'nome@riften.rift' : 'Jarl'}
            required
          />
          <Texto
            rotulo="Selo de acesso"
            valor={senha}
            aoMudar={setSenha}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <button className="btn primario" style={{ justifyContent: 'center', marginTop: 4 }} disabled={ocupado}>
            <Icone nome="chave" tam={15} />
            {ocupado ? 'Verificando…' : 'Adentrar o Salão'}
          </button>
        </form>

        <div className="login-aviso">
          {SUPABASE_ATIVO ? (
            <>Acesso restrito aos membros da Corte. Contas são criadas pelo Jarl —
            não há autocadastro. Guardas, trabalhadores e cidadãos não possuem acesso.</>
          ) : (
            <>
              <strong style={{ color: 'var(--purple)' }}>Modo demonstração</strong> — sem banco
              configurado, os dados ficam apenas neste navegador. Entre com{' '}
              <code>{CONTAS_DEMO[0].email}</code> / <code>{CONTAS_DEMO[0].senha}</code>{' '}
              (ou qualquer conta listada no README). Pela Cidade de Riften, use{' '}
              <code>Sophia</code>, <code>Aldric</code> ou <code>Varek</code> — senha <code>123</code>.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
