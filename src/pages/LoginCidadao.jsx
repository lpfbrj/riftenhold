import React, { useState } from 'react';
import { entrarCidadao } from '../lib/auth.js';
import { listar } from '../lib/db.js';
import { ONDE_ACHAR_ID } from '../lib/constants.js';
import { SUPABASE_ATIVO } from '../lib/supabase.js';
import { Brasao, Texto, Icone } from '../components/ui.jsx';

/**
 * Login do morador e do soldado. É o mesmo par de credenciais nas duas
 * portas — ID do jogo e a senha que a Corte entregou. A diferença é que o
 * Quartel só abre para quem está alistado no Exército.
 */
export default function LoginCidadao({ porta = 'cidadao', aoEntrar, aoVoltar, aoRegistrar }) {
  const [id, setId] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const soldado = porta === 'soldado';

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      // O Exército só é consultado na porta do Quartel.
      const guardas = soldado ? await listar('guardas') : [];
      aoEntrar(await entrarCidadao(id, senha, porta, guardas));
    } catch (ex) {
      setErro(ex.message);
      setOcupado(false);
    }
  }

  return (
    <div className="login-tela">
      <div className={`login-caixa ${soldado ? 'quartel' : 'cidade'}`}>
        {aoVoltar && <button className="btn pq fantasma voltar" onClick={aoVoltar}>← Portal</button>}
        <Brasao tamanho={58} />
        <h1>{soldado ? 'Quartel General' : 'Cidade de Riften'}</h1>
        <div className="sub">
          {soldado ? 'Exército de Riften · acesso do alistado' : 'Registro Civil e documentações'}
        </div>

        <form onSubmit={enviar}>
          {erro && <div className="login-erro">{erro}</div>}
          <Texto
            rotulo="ID do jogo"
            valor={id}
            aoMudar={setId}
            className="mono"
            autoComplete="username"
            placeholder="o ID do seu personagem"
            required
          />
          <Texto
            rotulo="Senha entregue pela Corte"
            valor={senha}
            aoMudar={setSenha}
            type="password"
            autoComplete="current-password"
            placeholder="RFT-••••-•••"
            required
          />
          <button className="btn primario" style={{ justifyContent: 'center', marginTop: 4 }} disabled={ocupado}>
            <Icone nome={soldado ? 'escudo' : 'chave'} tam={15} />
            {ocupado ? 'Verificando…' : soldado ? 'Entrar no Quartel' : 'Ver minha ficha'}
          </button>
        </form>

        {!soldado && aoRegistrar && (
          <div className="login-alternativa">
            <span>Ainda não é registrado?</span>
            <button className="btn pq" onClick={aoRegistrar}>
              <Icone nome="mais" tam={13} /> Fazer o Registro Civil
            </button>
          </div>
        )}

        <div className="login-aviso">
          {soldado ? (
            <>O Quartel abre com as <strong>mesmas credenciais</strong> da Cidade, mas só para
            quem está alistado no Exército de Riften. Se você é da tropa e mesmo assim não
            entra, peça ao Lorde Comandante para conferir seu alistamento.</>
          ) : (
            <><Icone nome="livro" tam={12} /> {ONDE_ACHAR_ID} A senha é gerada quando a Corte
            aprova seu registro, e entregue em mãos por alguém da Corte.</>
          )}
        </div>
        {!SUPABASE_ATIVO && (
          <div className="login-aviso" style={{ marginTop: 8 }}>
            <strong style={{ color: 'var(--purple)' }}>Modo demonstração</strong> — para testar,
            entre com <code>Sophia</code>, <code>Aldric</code> ou <code>Varek</code>, senha{' '}
            <code>123</code>. {soldado
              ? 'Só Varek está alistado no Exército.'
              : 'Aldric é Patriarca da Casa Blackwing; Sophia tem casa no nome.'}
          </div>
        )}
      </div>
    </div>
  );
}
