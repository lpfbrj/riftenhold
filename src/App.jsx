import React, { useEffect, useState } from 'react';
import { sessaoAtual, sair } from './lib/auth.js';
import { MODO, casaQueChefia, minhasPropriedades } from './lib/db.js';
import { nobrezaDoCivil } from './lib/casas.js';
import { imoveisDe } from './lib/imobiliaria.js';
import { DadosProvider, useDados } from './lib/store.jsx';
import { Brasao, Icone } from './components/ui.jsx';
import Portal from './pages/Portal.jsx';
import RegistroPublico from './pages/RegistroPublico.jsx';
import Login from './pages/Login.jsx';
import LoginCidadao from './pages/LoginCidadao.jsx';
import Palacio from './pages/Palacio.jsx';
import Civis from './pages/Civis.jsx';
import Exercito from './pages/Exercito.jsx';
import Comercios from './pages/Comercios.jsx';
import Trabalhadores from './pages/Trabalhadores.jsx';
import Licencas from './pages/Licencas.jsx';
import Prisoes from './pages/Prisoes.jsx';
import Logistica from './pages/Logistica.jsx';
import MinhaFicha from './pages/MinhaFicha.jsx';
import MinhaFichaMilitar from './pages/MinhaFichaMilitar.jsx';
import Dinastia from './pages/Dinastia.jsx';
import MercadoImobiliario from './pages/MercadoImobiliario.jsx';
import Clas from './pages/Clas.jsx';
import ClasCorte from './pages/ClasCorte.jsx';
import Avisos from './pages/Avisos.jsx';
import Propriedades from './pages/Propriedades.jsx';
import ComerciosCidade from './pages/ComerciosCidade.jsx';
import Editais from './pages/Editais.jsx';
import Tesouraria from './pages/Tesouraria.jsx';
import Cobrancas from './pages/Cobrancas.jsx';
import { cobrancasDe, pendentes } from './lib/tesouraria.js';
import { resumoDasForcas } from './lib/forcas.js';

// A ordem daqui define a ordem das seções no menu lateral.
const TELAS = [
  { id: 'palacio',       nome: 'Palácio do Jarl',      icone: 'coroa',      secao: 'Administração',   Comp: Palacio },
  { id: 'licencas',      nome: 'Emissão de Licenças',  icone: 'pergaminho', secao: 'Administração',   Comp: Licencas,
    badge: (d) => (d.licencas || []).filter((l) => l.status === 'Ativa').length || null },
  { id: 'editais',       nome: 'Editais e Contratos',  icone: 'balanca',    secao: 'Administração',   Comp: Editais,
    badge: (d) => (d.editais || []).filter((e) => e.status === 'Aberto').length || null },
  { id: 'avisos',        nome: 'Quadro de Avisos',     icone: 'mural',      secao: 'Administração',   Comp: Avisos, chave: 'avisos' },
  { id: 'tesouraria',    nome: 'Tesouraria',           icone: 'moeda',      secao: 'Administração',   Comp: Tesouraria,
    // O número no menu é o que espera decisão: cobrança em aberto ou
    // pagamento declarado pelo morador esperando conferência.
    badge: (d) => (d.cobrancas || []).filter(
      (c) => ['Em aberto', 'Pagamento declarado'].includes(c.status || 'Em aberto'),
    ).length || null,
    alerta: true },

  { id: 'exercito',      nome: 'Exército de Riften',   icone: 'espada',     secao: 'Quartel General', Comp: Exercito,
    // O número no menu é a força inteira do Hold: tropa, mesnadas e milícia.
    badge: (d) => resumoDasForcas({ guardas: d.guardas, clas: d.clas, milicia: d.milicia }).total || null },
  { id: 'prisoes',       nome: 'Registro de Prisões',  icone: 'grades',     secao: 'Quartel General', Comp: Prisoes,
    badge: (d) => (d.prisoes || []).filter((x) => x.status === 'Cumprindo pena').length || null, alerta: true },
  { id: 'logistica',     nome: 'Logística',            icone: 'caixa',      secao: 'Quartel General', Comp: Logistica, chave: 'movimentos' },

  { id: 'civis',         nome: 'Registro Civil',       icone: 'pessoa',     secao: 'Registros',       Comp: Civis,
    badge: (d) => (d.civis || []).filter((c) => c.status === 'Pendente').length || null, alerta: true },
  { id: 'imobiliaria',   nome: 'Imobiliária',          icone: 'moeda',      secao: 'Registros',       Comp: Comercios,     chave: 'propriedades' },
  { id: 'clas-corte',    nome: 'Clãs do Hold',         icone: 'selo',       secao: 'Registros',       Comp: ClasCorte,
    badge: (d) => (d.guildas || []).filter((g) => (g.situacao || 'Pendente') === 'Pendente').length || null,
    alerta: true },
  { id: 'trabalhadores', nome: 'Trabalhadores',        icone: 'martelo',    secao: 'Registros',       Comp: Trabalhadores, chave: 'trabalhadores' },
];

/** O soldado vê a própria ficha, o registro de prisões e a logística. */
const TELAS_QUARTEL = [
  { id: 'minha-militar', nome: 'Meu registro militar', icone: 'escudo', secao: 'Quartel General', Comp: MinhaFichaMilitar },
  { id: 'prisoes',       nome: 'Registro de Prisões',  icone: 'grades', secao: 'Quartel General', Comp: Prisoes,
    badge: (d) => (d.prisoes || []).filter((x) => x.status === 'Cumprindo pena').length || null, alerta: true },
  { id: 'logistica',     nome: 'Logística',            icone: 'caixa',  secao: 'Quartel General', Comp: Logistica, chave: 'movimentos' },
  { id: 'editais',       nome: 'Editais e Contratos',  icone: 'balanca', secao: 'Quartel General', Comp: Editais,
    // O que pesa para o Quartel é a proposta esperando resposta num edital dele.
    badge: (d) => (d.propostas || []).filter((p) => p.status === 'Enviada' &&
      (d.editais || []).some((e) => e.id === p.edital_id && e.orgao_tipo === 'quartel')).length || null,
    alerta: true },
  { id: 'avisos',        nome: 'Quadro de Avisos',     icone: 'mural',  secao: 'Quartel General', Comp: Avisos,
    badge: (d, u) => contarAvisos(d, u) },
];

/**
 * O morador vê a própria ficha, os comércios da cidade e o quadro de avisos.
 * Dinastia e Propriedades entram no meio, e só para quem tem uma.
 */
const TELA_MINHA_FICHA = { id: 'minha-ficha', nome: 'Minha ficha', icone: 'pessoa', secao: 'Cidade de Riften', Comp: MinhaFicha };
const TELA_COMERCIOS = {
  id: 'comercios-cidade', nome: 'Comércios', icone: 'moeda', secao: 'Cidade de Riften', Comp: ComerciosCidade,
  badge: (d, u) => (d.pedidos_compra || [])
    .filter((x) => x.comprador_civil_id === u.civil_id && x.status === 'Aberto').length || null,
};
const TELA_EDITAIS = {
  id: 'editais', nome: 'Editais e Contratos', icone: 'balanca', secao: 'Cidade de Riften', Comp: Editais,
  badge: (d) => (d.editais || []).filter((e) => e.status === 'Aberto').length || null,
};
/**
 * O que o morador deve ao Hold: dele, das propriedades dele e da
 * casa que ele chefia. A aba existe sempre — não devendo nada, ela
 * diz isso, que também é informação.
 */
const TELA_COBRANCAS = {
  id: 'cobrancas', nome: 'Cobranças', icone: 'balanca', secao: 'Cidade de Riften', Comp: Cobrancas,
  badge: (d, u) => pendentes(cobrancasDe(u, d.cobrancas || [], {
    propriedades: d.propriedades || [], clas: d.clas || [],
  })).length || null,
  alerta: true,
};
const TELA_AVISOS = {
  id: 'avisos', nome: 'Quadro de Avisos', icone: 'mural', secao: 'Cidade de Riften', Comp: Avisos,
  badge: (d, u) => contarAvisos(d, u),
};
/**
 * O Mercado Imobiliário é de todo morador: quem tem imóvel anuncia,
 * quem não tem procura. Por isso não depende de já ter propriedade.
 */
const TELA_MERCADO = {
  id: 'mercado', nome: 'Mercado Imobiliário', icone: 'vila', secao: 'Cidade de Riften',
  Comp: MercadoImobiliario,
  badge: (d, u) => {
    // Mesmo critério de dono do resto do sistema: vínculo com o
    // Registro Civil, ou o nome quando não há vínculo.
    const meus = imoveisDe(u, d.propriedades || []).map((p) => p.id);
    return (d.ofertas || [])
      .filter((o) => o.status === 'Aberta' && meus.includes(o.propriedade_id)).length || null;
  },
  alerta: true,
};

/**
 * Os clãs são de todo morador: quem lidera administra o seu, quem
 * não tem procura um. Por isso a aba não depende de nada.
 */
const TELA_CLAS = {
  id: 'clas', nome: 'Clãs', icone: 'selo', secao: 'Cidade de Riften', Comp: Clas,
  badge: (d, u) => {
    // Um registro seu ainda na mesa da Corte pede atenção.
    const meu = (d.guildas || []).find(
      (g) => g.lider_civil_id === u.civil_id && (g.situacao === 'Pendente' || g.situacao === 'Recusado'),
    );
    return meu ? 1 : null;
  },
};

const TELA_PROPRIEDADES = {
  id: 'propriedades', nome: 'Propriedades', icone: 'casa', secao: 'Cidade de Riften', Comp: Propriedades,
  // O que pesa aqui é o pedido esperando resposta.
  badge: (d, u) => {
    const minhas = minhasPropriedades(u, d.propriedades || []).map((p) => p.id);
    return (d.pedidos_compra || [])
      .filter((x) => x.status === 'Aberto' && minhas.includes(x.propriedade_id)).length || null;
  },
  alerta: true,
};

/** Quantos avisos esta pessoa enxerga: os gerais mais os que são dela. */
const contarAvisos = (d, u) => (d.avisos || [])
  .filter((a) => !a.destino_civil_id || a.destino_civil_id === u.civil_id).length || null;
const TELA_DINASTIA = {
  id: 'dinastia', nome: 'Dinastia', icone: 'estandarte', secao: 'Cidade de Riften', Comp: Dinastia,
  badge: (d, u) => {
    const meus = (d.pedidos_dinastia || [])
      .filter((x) => x.status === 'Pendente' && x.pedido_por_civil_id === u.civil_id).length;
    // Propostas de aliança esperando a resposta da casa dele contam também.
    const minhaCasa = casaQueChefia(u, d.clas || []);
    const propostas = minhaCasa
      ? (d.pedidos_casa || []).filter(
          (x) => x.tipo === 'alianca' && x.status === 'Aguardando casa' && x.alvo_cla_id === minhaCasa.id,
        ).length
      : 0;
    return (meus + propostas) || null;
  },
};

/**
 * As telas de cada porta. A do morador depende dos dados: só quem chefia
 * uma casa enxerga a aba Dinastia.
 */
function telasDe(usuario, d) {
  if (usuario.tipo === 'soldado') return TELAS_QUARTEL;
  if (usuario.tipo !== 'cidadao') return TELAS;
  const telas = [TELA_MINHA_FICHA];
  // A aba abre para quem chefia uma casa — e também para o nobre que
  // ganhou o título e ainda não fundou a dele.
  const enobrecido = nobrezaDoCivil(usuario, {
    pedidos: d.pedidos_casa || [], propriedades: d.propriedades || [],
  }).nobre;
  if (casaQueChefia(usuario, d.clas || []) || enobrecido) telas.push(TELA_DINASTIA);
  if (minhasPropriedades(usuario, d.propriedades || []).length) telas.push(TELA_PROPRIEDADES);
  telas.push(TELA_MERCADO, TELA_COMERCIOS, TELA_CLAS, TELA_COBRANCAS, TELA_EDITAIS, TELA_AVISOS);
  return telas;
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  // 'portal' | 'corte' | 'cidade' | 'quartel' | 'registro'
  const [entrada, setEntrada] = useState('portal');
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    sessaoAtual().then(setUsuario).catch(() => setUsuario(null)).finally(() => setPronto(true));
  }, []);

  if (!pronto) {
    return (
      <div className="login-tela">
        <div style={{ textAlign: 'center', color: 'var(--txt-3)' }}>
          <Brasao tamanho={48} />
          <p style={{ marginTop: 12, fontSize: 12.5, letterSpacing: '.2em', textTransform: 'uppercase' }}>
            Abrindo os portões…
          </p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    if (entrada === 'registro') {
      return <RegistroPublico aoVoltar={() => setEntrada('portal')} />;
    }
    if (entrada === 'corte') {
      return <Login aoEntrar={setUsuario} aoVoltar={() => setEntrada('portal')} />;
    }
    if (entrada === 'cidade' || entrada === 'quartel') {
      return (
        <LoginCidadao
          porta={entrada === 'quartel' ? 'soldado' : 'cidadao'}
          aoEntrar={setUsuario}
          aoVoltar={() => setEntrada('portal')}
          aoRegistrar={() => setEntrada('registro')}
        />
      );
    }
    return <Portal aoEscolher={setEntrada} />;
  }

  return (
    <DadosProvider usuario={usuario}>
      <Painel
        usuario={usuario}
        aoSair={async () => { await sair(); setUsuario(null); setEntrada('portal'); }}
      />
    </DadosProvider>
  );
}

const CASA = {
  corte: { nome: 'Riften Hold', sub: 'Corte de Riften' },
  cidadao: { nome: 'Cidade de Riften', sub: 'Documentações' },
  soldado: { nome: 'Quartel General', sub: 'Exército de Riften' },
};

function Painel({ usuario, aoSair }) {
  const [tela, setTela] = useState(null);
  const d = useDados();
  const telas = telasDe(usuario, d);
  const atual = telas.find((t) => t.id === tela) || telas[0];
  const Atual = atual.Comp;
  const secoes = [...new Set(telas.map((t) => t.secao))];
  const casa = CASA[usuario.tipo] || CASA.corte;

  return (
    <div className={`app ${usuario.tipo || 'corte'}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Brasao tamanho={36} /></span>
          <span>
            <span className="brand-nome">{casa.nome}</span>
            <span className="brand-sub">{casa.sub}</span>
          </span>
        </div>

        {secoes.map((s) => (
          <React.Fragment key={s}>
            <div className="nav-sec">{s}</div>
            {telas.filter((t) => t.secao === s).map((t) => {
              const n = t.badge ? t.badge(d, usuario) : t.chave ? (d[t.chave] || []).length : null;
              return (
                <button
                  key={t.id}
                  className={`nav-item ${atual.id === t.id ? 'ativo' : ''}`}
                  onClick={() => setTela(t.id)}
                >
                  <Icone nome={t.icone} tam={16} />
                  {t.nome}
                  {n != null && (
                    <span className={`badge-num ${t.alerta ? 'alerta' : ''}`}>{n}</span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}

        <div className="rodape-user">
          <strong>{usuario.nome}</strong>
          <span>{usuario.cargo || 'Corte de Riften'}</span>
          {usuario.id_jogo && <span className="mono" style={{ fontSize: 10.5 }}>ID {usuario.id_jogo}</span>}
          <button className="btn pq fantasma" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={aoSair}>
            <Icone nome="saida" tam={13} /> Sair
          </button>
        </div>
      </aside>

      <main className="main">
        {MODO === 'demo' && (
          <div className="faixa-demo">
            <Icone nome="livro" tam={15} />
            <span>
              <strong>Modo demonstração.</strong> Sem banco configurado — os dados ficam só neste navegador
              e não são compartilhados com o resto da Corte. Configure o Supabase para uso real.
            </span>
            {usuario.tipo === 'corte' && (
              <button className="btn pq fantasma" style={{ marginLeft: 'auto' }} onClick={d.reiniciar}>
                Restaurar dados iniciais
              </button>
            )}
          </div>
        )}
        {d.erro && <div className="login-erro" style={{ marginBottom: 18 }}>{d.erro}</div>}
        {d.carregando
          ? <p style={{ color: 'var(--txt-3)' }}>Consultando os arquivos do Hold…</p>
          : <Atual usuario={usuario} />}
      </main>
    </div>
  );
}
