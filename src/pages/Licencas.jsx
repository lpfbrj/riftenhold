import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { cobrarLicenca, precoDaLicenca } from '../lib/db.js';
import {
  TIPOS_LICENCA, TIPO_LICENCA_POR_ID, STATUS_LICENCA, STATUS_LICENCA_TOM,
  TITULARES_LICENCA, recursoDaLicenca,
} from '../lib/constants.js';
import { clasAprovados, tipoDoCla, tamanhoDoCla } from '../lib/guildas.js';
import SeletorCivil from '../components/SeletorCivil.jsx';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar, Campo,
} from '../components/ui.jsx';

const VAZIO = {
  tipo: 'mineracao',
  // O titular pode ser um morador ou um clã. A licença de clã vale
  // para todos os membros dele, sem cada um tirar a sua.
  titular_tipo: 'civil', titular: '', civil_id: '', id_jogo: '',
  guilda_id: '', guilda_nome: '',
  cobertura: [], recursos: [], escolta: false,
  status: 'Ativa', validade: '', notas: '', valor: null,
};

/** LIC-MIN-0007 — o prefixo vem do tipo. */
function proximoNumero(tipoId, licencas) {
  const prefixo = `LIC-${TIPO_LICENCA_POR_ID[tipoId]?.prefixo || tipoId.slice(0, 3).toUpperCase()}`;
  const usados = licencas
    .filter((l) => String(l.numero || '').startsWith(prefixo))
    .map((l) => Number(String(l.numero).split('-').pop()) || 0);
  return `${prefixo}-${String(Math.max(0, ...usados) + 1).padStart(4, '0')}`;
}

export default function Licencas({ usuario }) {
  const d = useDados();
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);

  const licencas = d.licencas || [];
  const guildas = useMemo(() => clasAprovados(d.guildas || []), [d.guildas]);

  /** Para quanta gente a licença vale: uma pessoa, ou o clã inteiro. */
  const alcance = (l) => {
    if (l.titular_tipo !== 'guilda') return 1;
    const g = guildas.find((x) => x.id === l.guilda_id);
    return g ? tamanhoDoCla(g) : 0;
  };

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return licencas
      .filter((l) =>
        (!t || `${l.titular} ${l.numero} ${l.id_jogo} ${l.guilda_nome || ''}`.toLowerCase().includes(t)) &&
        (!fTipo || l.tipo === fTipo) &&
        (!fStatus || l.status === fStatus))
      .sort((a, b) => String(b.numero || '').localeCompare(String(a.numero || '')));
  }, [licencas, busca, fTipo, fStatus]);

  const ativas = licencas.filter((l) => l.status === 'Ativa');
  const comEscolta = ativas.filter((l) => l.escolta).length;
  const minerios = new Set(ativas.flatMap((l) => l.recursos || []));

  const mudarStatus = (l, status) =>
    d.salvar('licencas', { ...l, status }, `${l.numero} — ${status.toLowerCase()}`);

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Emissão de Licenças</h1>
          <p>
            Autorizações concedidas pela Corte a cidadãos e trabalhadores. Cada licença
            registra o que cobre, quais recursos libera e se dá direito a escolta.
          </p>
        </div>
        <div className="acoes">
          <button
            className="btn primario"
            onClick={() => setEdit({ ...VAZIO, numero: proximoNumero('mineracao', licencas) })}
          >
            <Icone nome="mais" tam={15} /> Emitir licença
          </button>
        </div>
      </div>
      <div className="regra" />

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Licenças ativas" valor={ativas.length} sub={`${licencas.length} emitidas ao todo`} tom="verde" />
        <Stat rotulo="Com escolta" valor={comEscolta} sub="direito a acompanhamento da Guarda" tom="roxo" />
        <Stat rotulo="Minérios liberados" valor={minerios.size} sub="tipos autorizados hoje" tom="laranja" />
        <Stat rotulo="Suspensas ou revogadas" valor={licencas.filter((l) => l.status === 'Suspensa' || l.status === 'Revogada').length} sub="fora de validade" />
      </div>

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Titular, número ou ID…" />
        </div>
        <Selecao
          rotulo="Tipo" valor={fTipo} aoMudar={setFTipo}
          opcoes={TIPOS_LICENCA.map((t) => ({ valor: t.id, rotulo: t.nome }))}
          vazioLabel="Todos"
        />
        <Selecao rotulo="Situação" valor={fStatus} aoMudar={setFStatus} opcoes={STATUS_LICENCA} vazioLabel="Todas" />
      </div>

      {lista.length === 0 ? (
        <Painel>
          <Vazio simb="⚖">
            Nenhuma licença {licencas.length ? 'corresponde ao filtro' : 'emitida ainda'}. Use
            <strong> Emitir licença</strong> para conceder a primeira.
          </Vazio>
        </Painel>
      ) : (
        <div className="grade g2">
          {lista.map((l) => {
            const tipo = TIPO_LICENCA_POR_ID[l.tipo];
            return (
              <article key={l.id} className={`licenca-card ${l.status !== 'Ativa' ? 'inativa' : ''}`}>
                <header>
                  <span className="lic-selo"><Icone nome={tipo?.icone || 'pergaminho'} tam={19} cor="var(--gold)" /></span>
                  <div className="lic-titulo">
                    <h3>{l.titular || 'Sem titular'}</h3>
                    <span className="lic-sub">
                      <span className="mono">{l.numero}</span> · {tipo?.nome || l.tipo}
                      {l.id_jogo && <> · <span className="mono">ID {l.id_jogo}</span></>}
                    </span>
                  </div>
                  {l.titular_tipo === 'guilda' && (
                    <Selo tom="roxo">
                      <Icone nome="selo" tam={11} /> Clã · {alcance(l)} pessoa{alcance(l) === 1 ? '' : 's'}
                    </Selo>
                  )}
                  <Selo tom={STATUS_LICENCA_TOM[l.status]} ponto>{l.status}</Selo>
                </header>

                <div className="lic-secao">
                  <span className="lic-rot">Cobertura</span>
                  {(l.cobertura || []).length === 0 ? (
                    <span className="lic-nada">Nada habilitado</span>
                  ) : (
                    <div className="chip-lista">
                      {(l.cobertura || []).map((c) => (
                        <Selo key={c} tom="gold">
                          {tipo?.coberturas.find((x) => x.id === c)?.nome || c}
                        </Selo>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lic-secao">
                  <span className="lic-rot">{tipo?.rotuloRecursos || 'Recursos'}</span>
                  {(l.recursos || []).length === 0 ? (
                    <span className="lic-nada">Nenhum autorizado</span>
                  ) : (
                    <div className="cat-chips">
                      {(l.recursos || []).map((r) => {
                        const m = recursoDaLicenca(l.tipo, r);
                        return (
                          <span className="cat-chip" key={r} style={{ '--c': m.cor }}>
                            <i className="minerio-ponto" style={{ background: m.cor }} />
                            {m.nome}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lic-rodape">
                  <Selo tom={l.escolta ? 'roxo' : ''} ponto={l.escolta}>
                    <Icone nome="escudo" tam={11} /> {l.escolta ? 'Com escolta' : 'Sem escolta'}
                  </Selo>
                  {l.validade && <Selo>Validade: {l.validade}</Selo>}
                  {l.emitida_por && <Selo>Emitida por {l.emitida_por}</Selo>}
                </div>

                <footer>
                  <button className="btn pq" onClick={() => setEdit(l)}>
                    <Icone nome="lapis" tam={13} /> Abrir
                  </button>
                  {l.status === 'Ativa' ? (
                    <button className="btn pq" onClick={() => mudarStatus(l, 'Suspensa')}>Suspender</button>
                  ) : l.status !== 'Revogada' ? (
                    <button className="btn pq" onClick={() => mudarStatus(l, 'Ativa')}>Reativar</button>
                  ) : null}
                  {l.status !== 'Revogada' && (
                    <button className="btn pq perigo" onClick={() => mudarStatus(l, 'Revogada')}>Revogar</button>
                  )}
                  <button className="btn pq perigo" style={{ marginLeft: 'auto' }} onClick={() => setRem(l)}>
                    <Icone nome="lixo" tam={13} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {edit && (
        <FormLicenca
          inicial={edit}
          civis={d.civis || []}
          guildas={guildas}
          usuario={usuario}
          licencas={licencas}
          aoFechar={() => setEdit(null)}
          precos={d.precos || []}
          aoSalvar={async (v) => {
            const gravada = await d.salvar('licencas', v, `${v.numero} · ${v.titular}`);
            // A licença emitida cobra o titular: é assim que ela entra
            // no gráfico de arrecadação em vez de sumir do dinheiro.
            if (gravada?.id && gravada.valor) {
              await cobrarLicenca(gravada, usuario?.nome || usuario?.cargo || 'Corte');
              await d.recarregar();
            }
            setEdit(null);
          }}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Apagar a licença ${rem.numero} de ${rem.titular}? Se a intenção é apenas cassá-la, use Revogar — fica o histórico.`}
          aoConfirmar={() => d.remover('licencas', rem.id, rem.numero)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormLicenca({ inicial, civis, guildas = [], usuario, licencas, precos = [], aoFechar, aoSalvar }) {
  // A taxa nasce com o preço de tabela do tipo — e quem emite pode
  // mudar naquela emissão, se o caso pedir.
  const [v, setV] = useState(() => ({
    ...VAZIO,
    ...inicial,
    valor: inicial?.id
      ? (inicial.valor ?? null)
      : precoDaLicenca(inicial?.tipo || VAZIO.tipo, precos),
  }));
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const tipo = TIPO_LICENCA_POR_ID[v.tipo] || TIPOS_LICENCA[0];
  const dePreco = precoDaLicenca(v.tipo, precos);
  const vinculado = v.civil_id ? civis.find((c) => c.id === v.civil_id) : null;

  const alternar = (campo, id) => setV((s) => {
    const atual = s[campo] || [];
    return { ...s, [campo]: atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id] };
  });

  const trocarTipo = (novo) => setV((s) => ({
    ...s, tipo: novo, cobertura: [], recursos: [],
    numero: s.id ? s.numero : proximoNumero(novo, licencas),
    // Numa licença nova a taxa acompanha o tipo; numa já emitida o
    // valor cobrado é história e não se reescreve sozinho.
    valor: s.id ? s.valor : precoDaLicenca(novo, precos),
  }));

  /**
   * Trocar quem é o titular limpa o vínculo do outro lado: uma
   * licença é do morador ou do clã, nunca dos dois.
   */
  const trocarTitular = (tipoTitular) => setV((s) => (tipoTitular === 'guilda'
    ? { ...s, titular_tipo: 'guilda', titular: '', civil_id: '', id_jogo: '', guilda_id: '', guilda_nome: '' }
    : { ...s, titular_tipo: 'civil', titular: '', guilda_id: '', guilda_nome: '' }));

  /** Escolher o clã preenche o titular com o nome dele. */
  const escolherCla = (id) => setV((s) => {
    const g = guildas.find((x) => x.id === id);
    return { ...s, guilda_id: id, guilda_nome: g?.nome || '', titular: g?.nome || '', civil_id: '', id_jogo: '' };
  });

  const [ocupado, setOcupado] = useState(false);
  const claEscolhido = guildas.find((g) => g.id === v.guilda_id) || null;
  const pronto = v.titular_tipo === 'guilda'
    ? Boolean(v.guilda_id)
    : Boolean(String(v.titular || '').trim());

  /** Emitir duas vezes daria duas licenças com o mesmo número. */
  const salvar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await aoSalvar({
        ...v,
        emitida_por: v.emitida_por || usuario?.nome || usuario?.cargo || 'Corte',
        emitida_em: v.emitida_em || new Date().toISOString(),
        // O número é conferido de novo na hora de gravar: outra
        // emissão pode ter tomado este entre abrir e salvar.
        numero: v.id ? v.numero : proximoNumero(v.tipo, licencas),
      });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={inicial.id ? `Licença ${inicial.numero}` : 'Emitir licença'}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            <span className="mono">{v.numero}</span>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!pronto || ocupado} onClick={salvar}>
            {ocupado ? 'Emitindo…' : inicial.id ? 'Salvar' : 'Emitir'}
          </button>
        </>
      }
    >
      <div className="campo">
        <label>Para quem é a licença</label>
        <div className="origem-escolha">
          {TITULARES_LICENCA.map((x) => (
            <button
              type="button"
              key={x.id}
              className={`origem-op ${(v.titular_tipo || 'civil') === x.id ? 'ativo' : ''}`}
              onClick={() => trocarTitular(x.id)}
            >
              <Icone nome={x.id === 'guilda' ? 'selo' : 'pessoa'} tam={17}
                     cor={(v.titular_tipo || 'civil') === x.id ? 'var(--gold)' : 'var(--txt-3)'} />
              <strong>{x.nome}</strong>
              <span>{x.resumo}</span>
            </button>
          ))}
        </div>
      </div>

      {v.titular_tipo === 'guilda' ? (
        <>
          <Selecao
            rotulo="Clã titular"
            valor={v.guilda_id}
            aoMudar={escolherCla}
            vazioLabel={guildas.length ? 'Escolha o clã…' : 'Nenhum clã reconhecido ainda'}
            opcoes={guildas.map((g) => ({
              valor: g.id,
              rotulo: `${g.nome} — ${tipoDoCla(g).nome} · ${tamanhoDoCla(g)} membro${tamanhoDoCla(g) === 1 ? '' : 's'}`,
            }))}
          />
          {claEscolhido && (
            <p className="ajuda">
              <Icone nome="livro" tam={13} /> Esta licença vale para{' '}
              <strong>{tamanhoDoCla(claEscolhido)} pessoa{tamanhoDoCla(claEscolhido) === 1 ? '' : 's'}</strong>:
              {' '}{claEscolhido.lider} e quem mais estiver no clã. Entrou no clã depois, já está coberto.
            </p>
          )}
        </>
      ) : (
        <SeletorCivil
          rotulo="Titular da licença"
          valor={v.titular}
          aoMudar={(n) => setV((s) => ({ ...s, titular: n, civil_id: '', id_jogo: '' }))}
          aoEscolher={(c) => setV((s) => ({ ...s, titular: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '' }))}
          civis={civis}
          vinculado={vinculado}
          aoDesvincular={() => setV((s) => ({ ...s, civil_id: '', id_jogo: '' }))}
          placeholder="Busque no Registro Civil ou digite o nome"
        />
      )}

      <div style={{ height: 12 }} />
      <div className="grade g3">
        <Selecao
          rotulo="Tipo de licença" valor={v.tipo} aoMudar={trocarTipo}
          opcoes={TIPOS_LICENCA.map((t) => ({ valor: t.id, rotulo: t.nome }))} vazioLabel="—"
        />
        <Selecao rotulo="Situação" valor={v.status} aoMudar={set('status')} opcoes={STATUS_LICENCA} vazioLabel="—" />
        <Texto rotulo="Validade" valor={v.validade} aoMudar={set('validade')} placeholder="Ex.: 3 luas, indeterminada" />
        <Campo rotulo="Taxa de emissão (Septims)">
          <input
            type="number" min="0" className="mono"
            value={v.valor ?? ''}
            onChange={(e) => set('valor')(e.target.value === '' ? null : Number(e.target.value))}
            placeholder={`tabela: ${dePreco.toLocaleString('pt-BR')}`}
          />
        </Campo>
      </div>
      <p className="painel-nota" style={{ margin: '8px 0 0' }}>
        A taxa vira uma cobrança em nome do titular assim que a licença é emitida. Em branco,
        a licença sai sem custo — o preço de tabela deste tipo é{' '}
        <strong>{dePreco.toLocaleString('pt-BR')} Septims</strong>, e muda na Tesouraria.
      </p>

      {/* -------- Cobertura -------- */}
      <div style={{ height: 18 }} />
      <div className="editor-cat">
        <div className="editor-cat-h">
          <label>O que esta licença cobre</label>
          <span className="selo">{(v.cobertura || []).length} de {tipo.coberturas.length}</span>
        </div>
        <div className="cobertura-lista">
          {tipo.coberturas.map((c) => {
            const on = (v.cobertura || []).includes(c.id);
            return (
              <button
                type="button" key={c.id}
                className={`cobertura-op ${on ? 'ativo' : ''}`}
                onClick={() => alternar('cobertura', c.id)}
                aria-pressed={on}
              >
                <span className="marca">{on ? '✓' : ''}</span>
                <span>{c.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* -------- Recursos -------- */}
      <div style={{ height: 14 }} />
      <div className="editor-cat">
        <div className="editor-cat-h">
          <label>{tipo.rotuloRecursos}</label>
          <span className="selo">{(v.recursos || []).length} de {tipo.recursos.length}</span>
          <button
            type="button" className="btn pq" style={{ marginLeft: 'auto' }}
            onClick={() => set('recursos')(
              (v.recursos || []).length === tipo.recursos.length ? [] : tipo.recursos.map((r) => r.id),
            )}
          >
            {(v.recursos || []).length === tipo.recursos.length ? 'Limpar' : 'Autorizar todos'}
          </button>
        </div>
        <div className="minerio-grade">
          {tipo.recursos.map((m) => {
            const on = (v.recursos || []).includes(m.id);
            return (
              <button
                type="button" key={m.id}
                className={`minerio-op ${on ? 'ativo' : ''}`}
                style={{ '--c': m.cor }}
                onClick={() => alternar('recursos', m.id)}
                aria-pressed={on}
              >
                <span className="minerio-pedra" />
                <span>{m.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* -------- Escolta -------- */}
      <div style={{ height: 14 }} />
      <button
        type="button"
        className={`escolta-op ${v.escolta ? 'ativo' : ''}`}
        onClick={() => set('escolta')(!v.escolta)}
        aria-pressed={v.escolta}
      >
        <Icone nome="escudo" tam={22} cor={v.escolta ? 'var(--purple)' : 'var(--txt-3)'} />
        <span className="eo-texto">
          <strong>{tipo.escolta.rotulo}</strong>
          <span>{tipo.escolta.descricao}</span>
        </span>
        <span className={`interruptor ${v.escolta ? 'on' : ''}`}><i /></span>
      </button>

      <div style={{ height: 14 }} />
      <AreaTexto rotulo="Condições e observações do acordo" valor={v.notas} aoMudar={set('notas')}
                 placeholder="Limites de extração, tributo devido, prazo de escolta…" />
    </Modal>
  );
}
