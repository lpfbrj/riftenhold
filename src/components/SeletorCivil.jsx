import React, { useMemo, useRef, useState } from 'react';
import { Icone } from './ui.jsx';

/**
 * Campo de nome que consulta o Registro Civil.
 * Digite para buscar por nome ou ID do jogo; escolher um cidadão devolve a
 * ficha inteira, para que o formulário preencha raça, ofício e nível sozinho.
 * Nomes fora do registro continuam sendo aceitos — é só digitar e seguir.
 */
export default function SeletorCivil({
  rotulo = 'Nome',
  valor,
  aoMudar,
  aoEscolher,
  civis = [],
  vinculado = null,
  aoDesvincular,
  placeholder = 'Digite para buscar no Registro Civil…',
  /** Versão sem rótulo, para caber numa linha de lista. */
  compacto = false,
}) {
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  const caixa = useRef(null);

  const aprovados = useMemo(
    () => civis.filter((c) => c.status === 'Aprovado'),
    [civis],
  );

  const achados = useMemo(() => {
    const t = String(valor || '').trim().toLowerCase();
    const base = t
      ? aprovados.filter((c) => `${c.nome} ${c.id_jogo}`.toLowerCase().includes(t))
      : aprovados;
    return base.slice(0, 8);
  }, [aprovados, valor]);

  function escolher(c) {
    aoEscolher?.(c);
    setAberto(false);
  }

  function teclado(e) {
    if (!aberto || !achados.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => (f + 1) % achados.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => (f - 1 + achados.length) % achados.length); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(achados[foco] || achados[0]); }
    else if (e.key === 'Escape') { setAberto(false); }
  }

  return (
    <div className={`campo seletor-civil ${compacto ? 'compacto' : ''}`} ref={caixa}>
      {!compacto && <label>{rotulo}</label>}

      {vinculado ? (
        <div className="civil-vinculado">
          <Icone nome="pessoa" tam={15} cor="var(--ok)" />
          <span className="cv-nome">{vinculado.nome}</span>
          <span className="selo mono">ID {vinculado.id_jogo}</span>
          {!compacto && vinculado.raca && <span className="selo">{vinculado.raca}</span>}
          <button type="button" className="btn pq fantasma" onClick={aoDesvincular} title="Desvincular do Registro Civil">
            {compacto ? '×' : 'Trocar'}
          </button>
        </div>
      ) : (
        <div className="seletor-caixa">
          <input
            value={valor || ''}
            onChange={(e) => { aoMudar(e.target.value); setAberto(true); setFoco(0); }}
            onFocus={() => setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 160)}
            onKeyDown={teclado}
            placeholder={placeholder}
            autoComplete="off"
          />
          <span className="seletor-lupa"><Icone nome="busca" tam={14} cor="var(--txt-3)" /></span>

          {aberto && (
            <div className="seletor-lista" role="listbox">
              {achados.length === 0 ? (
                <p className="seletor-vazio">
                  {aprovados.length === 0
                    ? 'Nenhum cidadão aprovado no Registro Civil ainda.'
                    : 'Ninguém encontrado. Pode digitar o nome mesmo assim.'}
                </p>
              ) : achados.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  className={`seletor-op ${i === foco ? 'foco' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setFoco(i)}
                  onClick={() => escolher(c)}
                  role="option"
                  aria-selected={i === foco}
                >
                  <span className="so-nome">{c.nome}</span>
                  <span className="so-id mono">ID {c.id_jogo}</span>
                  {c.raca && <span className="so-tag">{c.raca}</span>}
                  {c.profissao && <span className="so-tag ouro">{c.profissao} · {c.nivel}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
