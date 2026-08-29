import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Icone, Vazio, Confirmar,
} from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const soData = (iso) => (iso
  ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  : '—');

/**
 * O Quadro de Avisos do Hold.
 *
 * A Corte publica aqui, e a publicação chega a todo mundo que tem registro
 * em Riften. Além das publicações gerais, o quadro carrega os **recados
 * pessoais** que o próprio sistema emite — a recusa de um pedido de casa
 * nobre, por exemplo, avisa quem pediu, e só ele lê.
 */
export default function Avisos({ usuario }) {
  const d = useDados();
  const daCorte = usuario?.tipo === 'corte';

  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);

  const todos = d.avisos || [];

  /** A Corte lê tudo; morador e soldado leem o que é geral mais o que é deles. */
  const meus = useMemo(() => {
    const lista = daCorte
      ? todos
      : todos.filter((a) => !a.destino_civil_id || a.destino_civil_id === usuario.civil_id);
    return [...lista].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  }, [todos, daCorte, usuario]);

  const gerais = meus.filter((a) => !a.destino_civil_id);
  const pessoais = meus.filter((a) => a.destino_civil_id);

  const publicar = async (v) => {
    await d.salvar('avisos', {
      ...v,
      titulo: String(v.titulo || '').trim(),
      texto: String(v.texto || '').trim(),
      criado_em: v.criado_em || new Date().toISOString(),
      autor: v.autor || usuario?.nome || usuario?.cargo || 'Corte de Riften',
      destino_civil_id: v.destino_civil_id || '',
    }, v.titulo);
  };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Quadro de Avisos</h1>
          <p>
            {daCorte
              ? 'O que a Corte publica aqui chega a todo mundo que tem registro em Riften. Os recados dirigidos a uma pessoa só aparecem para ela.'
              : 'O que a Corte de Riften tem a dizer ao Hold — e o que a Corte tem a dizer a você.'}
          </p>
        </div>
        {daCorte && (
          <div className="acoes">
            <button className="btn primario" onClick={() => setEdit({ titulo: '', texto: '' })}>
              <Icone nome="mais" tam={15} /> Publicar aviso
            </button>
          </div>
        )}
      </div>
      <div className="regra" />

      {daCorte && (
        <div className="grade g3" style={{ marginBottom: 18 }}>
          <Stat rotulo="Publicações" valor={gerais.length} sub="visíveis a todo o Hold" tom="verde" />
          <Stat rotulo="Recados pessoais" valor={pessoais.length} sub="dirigidos a uma pessoa" tom="roxo" />
          <Stat rotulo="Último aviso" valor={meus[0] ? soData(meus[0].criado_em) : '—'}
                sub={meus[0] ? meus[0].titulo : 'nada publicado'} />
        </div>
      )}

      {/* -------- Recados dirigidos a quem está lendo -------- */}
      {!daCorte && pessoais.length > 0 && (
        <>
          <Painel
            titulo="Para você"
            acoes={<Selo tom="roxo" ponto>{pessoais.length} recado{pessoais.length === 1 ? '' : 's'}</Selo>}
          >
            {pessoais.map((a) => <Aviso key={a.id} aviso={a} pessoal />)}
          </Painel>
          <div style={{ height: 16 }} />
        </>
      )}

      {/* -------- O mural -------- */}
      <Painel
        titulo={daCorte ? 'Publicações do Palácio' : 'Avisos do Hold'}
        acoes={<Selo>{gerais.length} {gerais.length === 1 ? 'aviso' : 'avisos'}</Selo>}
      >
        {gerais.length === 0 ? (
          <Vazio simb="✒">
            {daCorte
              ? 'Nada publicado ainda. Use Publicar aviso para falar com o Hold inteiro.'
              : 'O quadro está vazio. Quando a Corte publicar algo, aparece aqui.'}
          </Vazio>
        ) : (
          gerais.map((a) => (
            <Aviso
              key={a.id}
              aviso={a}
              aoEditar={daCorte ? () => setEdit(a) : null}
              aoRemover={daCorte ? () => setRem(a) : null}
            />
          ))
        )}
      </Painel>

      {/* -------- Recados pessoais, na visão da Corte -------- */}
      {daCorte && pessoais.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Painel
            titulo="Recados pessoais"
            acoes={<Selo tom="roxo">{pessoais.length}</Selo>}
          >
            <p className="painel-nota">
              Recados dirigidos a uma pessoa só. Quem os recebe lê no quadro dele; ninguém
              mais enxerga. O sistema emite estes sozinho — por exemplo, quando a Corte
              recusa a entrada de alguém numa casa nobre.
            </p>
            {pessoais.map((a) => (
              <Aviso key={a.id} aviso={a} pessoal
                     paraQuem={(d.civis || []).find((c) => c.id === a.destino_civil_id)?.nome}
                     aoRemover={() => setRem(a)} />
            ))}
          </Painel>
        </>
      )}

      {edit && (
        <FormAviso
          inicial={edit}
          aoFechar={() => setEdit(null)}
          aoSalvar={async (v) => { await publicar(v); setEdit(null); }}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Retirar "${rem.titulo}" do Quadro de Avisos? Quem já leu não vê mais.`}
          aoConfirmar={() => d.remover('avisos', rem.id, rem.titulo)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function Aviso({ aviso, pessoal = false, paraQuem, aoEditar, aoRemover }) {
  return (
    <article className={`aviso ${pessoal ? 'pessoal' : ''}`}>
      <header>
        <h3>{aviso.titulo}</h3>
        {pessoal && <Selo tom="roxo">recado pessoal</Selo>}
        {paraQuem && <Selo>para {paraQuem}</Selo>}
        <span className="aviso-data">
          <Icone nome="ampulheta" tam={12} /> {quando(aviso.criado_em)}
        </span>
        {(aoEditar || aoRemover) && (
          <span className="aviso-bts">
            {aoEditar && (
              <button className="btn pq fantasma" onClick={aoEditar} aria-label="Editar aviso">
                <Icone nome="lapis" tam={13} />
              </button>
            )}
            {aoRemover && (
              <button className="btn pq perigo" onClick={aoRemover} aria-label="Retirar aviso">
                <Icone nome="lixo" tam={13} />
              </button>
            )}
          </span>
        )}
      </header>
      <p className="aviso-texto">{aviso.texto}</p>
      {aviso.autor && <footer className="aviso-autor">— {aviso.autor}</footer>}
    </article>
  );
}

/* ------------------------------------------------------------ */
function FormAviso({ inicial, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const pronto = v.titulo?.trim() && v.texto?.trim();

  const publicar = async () => {
    setErro('');
    setOcupado(true);
    try {
      await aoSalvar(v);
    } catch (ex) {
      // Sem isto o modal fechava calado e o aviso não ia a lugar nenhum.
      setErro(ex.message || 'Não foi possível publicar agora.');
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={inicial.id ? 'Editar aviso' : 'Publicar no Quadro de Avisos'}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            {inicial.destino_civil_id
              ? 'Recado dirigido a uma pessoa.'
              : 'Chega a todo mundo com registro em Riften.'}
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!pronto || ocupado} onClick={publicar}>
            {ocupado ? 'Publicando…' : (inicial.id ? 'Salvar' : 'Publicar')}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      <Texto rotulo="Título" valor={v.titulo} aoMudar={set('titulo')}
             placeholder="Ex.: Toque de recolher no Mercado" />
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Texto do aviso" valor={v.texto} aoMudar={set('texto')} rows={7}
                 placeholder="O que a Corte quer comunicar ao Hold." />
      <p className="ajuda" style={{ marginTop: 10 }}>
        <Icone nome="livro" tam={13} /> A data da publicação é gravada no momento em que
        você publica.
      </p>
    </Modal>
  );
}

/**
 * Emite um recado dirigido a uma pessoa. É por aqui que o sistema avisa
 * alguém de uma decisão da Corte.
 */
export function recadoPara(civil_id, titulo, texto, autor) {
  return {
    titulo, texto,
    destino_civil_id: civil_id || '',
    autor: autor || 'Corte de Riften',
    criado_em: new Date().toISOString(),
  };
}
