import React from 'react';
import { NIVEL_VALOR, STATUS_COR } from '../lib/constants.js';

/* ---------------- Brasão / ícones ---------------- */
export function Brasao({ tamanho = 34 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="bz" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6c987" />
          <stop offset="1" stopColor="#8f7538" />
        </linearGradient>
      </defs>
      <path d="M20 2.5 4.5 8v13.2C4.5 29.4 11 35.5 20 37.5c9-2 15.5-8.1 15.5-16.3V8Z"
            fill="#241d13" stroke="url(#bz)" strokeWidth="1.6" />
      <path d="M20 9.5c3.4 2.9 5.4 6.4 5.4 10.2 0 4.4-2.4 8-5.4 10.3-3-2.3-5.4-5.9-5.4-10.3 0-3.8 2-7.3 5.4-10.2Z"
            fill="none" stroke="#9384d1" strokeWidth="1.3" />
      <path d="M20 12.5v16M14.8 19.8h10.4" stroke="url(#bz)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="19.8" r="2.1" fill="#c9743a" />
    </svg>
  );
}

const CAMINHOS = {
  painel: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  espada: 'M14.5 3 21 9.5 11 19.5l-2.5 2.5-3-3L8 16.5zM4 20l2 2',
  moeda: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M9.5 9.5h5M9.5 14.5h5',
  martelo: 'M4 20l7-7M13 5l6 6-3 3-6-6zM9 9 5 13l2 2 4-4',
  mapa: 'M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6zM9 3v15M15 6v15',
  chave: 'M14 7a4 4 0 1 1-3.2 6.4L4 20.2V22H2v-2l7.6-7.6A4 4 0 0 1 14 7z',
  saida: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h12',
  mais: 'M12 5v14M5 12h14',
  lapis: 'M15 4 20 9 8.5 20.5 3 22l1.5-5.5z',
  lixo: 'M4 7h16M9 7V5h6v2M6 7l1 14h10l1-14M10 11v7M14 11v7',
  livro: 'M4 4h7a3 3 0 0 1 3 3v14a2.5 2.5 0 0 0-2.5-2.5H4zM20 4h-4a3 3 0 0 0-3 3v14a2.5 2.5 0 0 1 2.5-2.5H20z',
  coroa: 'M3 8l4 4 5-7 5 7 4-4v10H3zM3 18h18',
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  casa: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  vila: 'M2 21h20M4 21v-8l4-3 4 3v8M12 21v-10l5-4 5 4v10M6 21v-3h2v3',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  estandarte: 'M6 3v18M6 4h13l-3.5 4.5L19 13H6',
  picareta: 'M4 21l9-9M3 8c4-4 12-4 16 0M11 4c-2 4-2 8 0 10M14 11l6 6-2 2-6-6',
  selo: 'M12 3l2.2 1.5 2.6-.4 1 2.5 2.2 1.4-.8 2.5.8 2.5-2.2 1.4-1 2.5-2.6-.4L12 20l-2.2-1.5-2.6.4-1-2.5L4 15l.8-2.5L4 10l2.2-1.4 1-2.5 2.6.4z',
  pergaminho: 'M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5',
  escudo: 'M12 3l8 3v6c0 5-3.5 8.5-8 9.5C7.5 20.5 4 17 4 12V6z',
  grades: 'M4 3h16v18H4zM9 3v18M15 3v18M4 9h16M4 15h16',
  ampulheta: 'M7 3h10v3l-5 6 5 6v3H7v-3l5-6-5-6zM7 3h10M7 21h10',
  balanca: 'M12 3v18M8 21h8M12 6l-7 2 3.5 6a3.5 3.5 0 0 1-7 0L5 8M12 6l7 2-3.5 6a3.5 3.5 0 0 0 7 0L19 8',
  caixa: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9',
  frasco: 'M9 3h6M10.5 3v6L5.5 18a2.5 2.5 0 0 0 2.2 3.6h8.6A2.5 2.5 0 0 0 18.5 18l-5-9V3M7.6 14h8.8',
  bigorna: 'M3 8h5l2.5 3H19a2 2 0 0 0 2-2V8h-3M8 11v3H6l-1.5 4h13L16 14h-2v-3',
  pele: 'M7 3c-2 3-3 6-3 9s1 6 3 9h10c2-3 3-6 3-9s-1-6-3-9zM7 12h10',
  entrada: 'M12 3v13M7 11l5 5 5-5M4 21h16',
  saidaItem: 'M12 21V8M7 13l5-5 5 5M4 3h16',
  arco: 'M6 3c7 2 11 8 12 18M6 3 4 21M6 3l14 6M4 21l16-12',
  mural: 'M3 4h18v13H3zM3 17l3 4M21 17l-3 4M7 8h10M7 12h6',
};

export function Icone({ nome, tam = 16, cor = 'currentColor' }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor}
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
         style={{ flex: '0 0 auto' }}>
      <path d={CAMINHOS[nome] || CAMINHOS.painel} />
    </svg>
  );
}

/* ---------------- Blocos ---------------- */
export function Painel({ titulo, acoes, children, className = '' }) {
  return (
    <section className={`painel ${className}`}>
      {(titulo || acoes) && (
        <header className="painel-h">
          {titulo && <h3>{titulo}</h3>}
          {acoes && <div className="dir">{acoes}</div>}
        </header>
      )}
      <div className="painel-b">{children}</div>
    </section>
  );
}

export function Stat({ rotulo, valor, sub, tom = '' }) {
  return (
    <div className={`stat ${tom}`}>
      <div className="rot">{rotulo}</div>
      <div className="val">{valor}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Selo({ tom = '', ponto = false, children }) {
  return (
    <span className={`selo ${tom}`}>
      {ponto && <i className="ponto" />}
      {children}
    </span>
  );
}

export function SeloStatus({ status }) {
  return <Selo tom={STATUS_COR[status] || ''} ponto>{status || '—'}</Selo>;
}

export function Vazio({ children = 'Nenhum registro ainda.', simb = '✦' }) {
  return (
    <div className="vazio">
      <div className="simb">{simb}</div>
      <div>{children}</div>
    </div>
  );
}

/* ---------------- Formulário ---------------- */
export function Campo({ rotulo, children }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

export function Texto({ rotulo, valor, aoMudar, ...resto }) {
  return (
    <Campo rotulo={rotulo}>
      <input value={valor ?? ''} onChange={(e) => aoMudar(e.target.value)} {...resto} />
    </Campo>
  );
}

export function AreaTexto({ rotulo, valor, aoMudar, ...resto }) {
  return (
    <Campo rotulo={rotulo}>
      <textarea value={valor ?? ''} onChange={(e) => aoMudar(e.target.value)} {...resto} />
    </Campo>
  );
}

export function Selecao({ rotulo, valor, aoMudar, opcoes, vazioLabel = '—', ...resto }) {
  return (
    <Campo rotulo={rotulo}>
      <select value={valor ?? ''} onChange={(e) => aoMudar(e.target.value)} {...resto}>
        <option value="">{vazioLabel}</option>
        {opcoes.map((o) => {
          const v = typeof o === 'string' ? o : o.valor;
          const t = typeof o === 'string' ? o : o.rotulo;
          return <option key={v} value={v}>{t}</option>;
        })}
      </select>
    </Campo>
  );
}

/* ---------------- Modal ----------------
   Uma pilha de modais abertos. O Escape só fecha o de cima: antes,
   todos ouviam a mesma tecla, e um Esc na confirmação levava junto a
   ficha que estava por baixo — com o que ainda não tinha sido salvo. */
const pilhaModais = [];

export function Modal({ titulo, aoFechar, children, rodape, largo = false }) {
  // A função de fechar vive numa referência: se ela entrasse nas dependências
  // do efeito, cada render re-empilharia o modal e a ordem da pilha deixaria
  // de ser a ordem de abertura — que é justamente o que decide quem o Escape fecha.
  const fechar = React.useRef(aoFechar);
  fechar.current = aoFechar;

  React.useEffect(() => {
    const marca = {};
    pilhaModais.push(marca);
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      if (pilhaModais[pilhaModais.length - 1] !== marca) return;
      e.stopPropagation();
      fechar.current();
    };
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      const i = pilhaModais.indexOf(marca);
      if (i >= 0) pilhaModais.splice(i, 1);
    };
  }, []);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal ${largo ? 'largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal-h">
          <h3>{titulo}</h3>
          <button className="x" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>
        <div className="modal-b">{children}</div>
        {rodape && <footer className="modal-f">{rodape}</footer>}
      </div>
    </div>
  );
}

/* ---------------- Pips de perícia ---------------- */
export function Pips({ nivel }) {
  const n = NIVEL_VALOR[nivel] ?? 0;
  const na = !nivel || nivel === 'N/A';
  return (
    <span className="pips" title={nivel || 'N/A'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={`pip ${na ? 'na' : i <= n ? 'on' : ''}`} />
      ))}
    </span>
  );
}

/* ---------------- Confirmação ---------------- */
export function Confirmar({ mensagem, aoConfirmar, aoFechar, rotulo = 'Remover', tom }) {
  return (
    <Modal
      titulo="Confirmar"
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className={`btn ${tom || 'perigo'}`} onClick={() => { aoConfirmar(); aoFechar(); }}>{rotulo}</button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--txt-2)' }}>{mensagem}</p>
    </Modal>
  );
}
