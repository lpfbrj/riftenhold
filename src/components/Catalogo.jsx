import React, { useState } from 'react';
import {
  TIPOS_ITEM, CATEGORIAS, ITEM_POR_ID, nomeItem, corItem, totalItens, lerCatalogacao,
} from '../data/itens.js';

/* ---------------- Ícone de um tipo de item ---------------- */
export function IconeItem({ tipo, tam = 16, cor = 'currentColor' }) {
  const t = ITEM_POR_ID[tipo] || ITEM_POR_ID.outro;
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor}
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <path d={t.d} />
    </svg>
  );
}

/* ---------------- Exibição compacta (tabelas) ---------------- */
export function Catalogo({ itens, limite = 0 }) {
  const lista = lerCatalogacao(itens);
  if (!lista.length) return <span style={{ color: 'var(--txt-3)' }}>—</span>;
  const visiveis = limite ? lista.slice(0, limite) : lista;
  const resto = lista.length - visiveis.length;

  return (
    <span className="cat-chips">
      {visiveis.map((it, i) => (
        <span className="cat-chip" key={i} title={nomeItem(it)} style={{ '--c': corItem(it) }}>
          <IconeItem tipo={it.t} tam={13} cor="var(--c)" />
          <b>{it.q}</b>
          <span className="cat-nome">{nomeItem(it)}</span>
        </span>
      ))}
      {resto > 0 && <span className="cat-chip mais">+{resto}</span>}
    </span>
  );
}

/* ---------------- Resumo numérico ---------------- */
export function ResumoCatalogo({ itens }) {
  const lista = lerCatalogacao(itens);
  return (
    <span className="selo gold" title="Peças catalogadas">
      {totalItens(lista)} peça{totalItens(lista) === 1 ? '' : 's'} · {lista.length} tipo{lista.length === 1 ? '' : 's'}
    </span>
  );
}

/* ---------------- Editor ---------------- */
export function EditorCatalogo({ valor, aoMudar, titulo = 'Catalogação' }) {
  const itens = lerCatalogacao(valor);
  const [aberto, setAberto] = useState(false);
  const [cat, setCat] = useState(CATEGORIAS[0].id);

  const mudar = (novo) => aoMudar(novo);

  function adicionar(tipoId) {
    const i = itens.findIndex((x) => x.t === tipoId && !x.d);
    if (i >= 0) {
      const copia = [...itens];
      copia[i] = { ...copia[i], q: (Number(copia[i].q) || 0) + 1 };
      mudar(copia);
    } else {
      mudar([...itens, { t: tipoId, q: 1 }]);
    }
  }

  const ajustar = (i, delta) => {
    const copia = [...itens];
    const q = Math.max(1, (Number(copia[i].q) || 1) + delta);
    copia[i] = { ...copia[i], q };
    mudar(copia);
  };

  const definir = (i, campo, v) => {
    const copia = [...itens];
    copia[i] = { ...copia[i], [campo]: campo === 'q' ? Math.max(1, Number(v) || 1) : v };
    mudar(copia);
  };

  const remover = (i) => mudar(itens.filter((_, j) => j !== i));

  return (
    <div className="editor-cat">
      <div className="editor-cat-h">
        <label>{titulo}</label>
        <span className="selo">{totalItens(itens)} peças</span>
        <button type="button" className="btn pq primario" onClick={() => setAberto((a) => !a)}>
          {aberto ? 'Fechar catálogo' : '+ Adicionar item'}
        </button>
      </div>

      {aberto && (
        <div className="seletor-itens">
          <div className="seletor-abas">
            {CATEGORIAS.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`aba ${cat === c.id ? 'ativa' : ''}`}
                onClick={() => setCat(c.id)}
              >
                <i className="dot" style={{ background: c.cor }} /> {c.nome}
              </button>
            ))}
          </div>
          <div className="seletor-grade">
            {TIPOS_ITEM.filter((t) => t.cat === cat).map((t) => (
              <button type="button" key={t.id} className="item-opcao" onClick={() => adicionar(t.id)}>
                <IconeItem tipo={t.id} tam={22} cor="var(--gold)" />
                <span>{t.nome}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {itens.length === 0 ? (
        <p className="cat-vazio">Nada catalogado ainda.</p>
      ) : (
        <ul className="lista-itens">
          {itens.map((it, i) => (
            <li key={i} style={{ '--c': corItem(it) }}>
              <IconeItem tipo={it.t} tam={18} cor="var(--c)" />
              <span className="nm">{ITEM_POR_ID[it.t]?.nome || 'Item'}</span>
              <input
                className="detalhe"
                value={it.d || ''}
                onChange={(e) => definir(i, 'd', e.target.value)}
                placeholder="detalhe (ex.: Dibella)"
              />
              <div className="qtd">
                <button type="button" onClick={() => ajustar(i, -1)} aria-label="Menos">−</button>
                <input
                  value={it.q}
                  onChange={(e) => definir(i, 'q', e.target.value)}
                  inputMode="numeric"
                  aria-label="Quantidade"
                />
                <button type="button" onClick={() => ajustar(i, 1)} aria-label="Mais">+</button>
              </div>
              <button type="button" className="btn pq perigo" onClick={() => remover(i)} aria-label="Remover">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
