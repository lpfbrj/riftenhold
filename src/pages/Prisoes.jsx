import React, { useEffect, useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { cobrarMultaDaPrisao, cobrarFiancaDaPrisao } from '../lib/db.js';
import { HOLDS, rotuloHold, STATUS_PRISAO, STATUS_PRISAO_TOM } from '../lib/constants.js';
import {
  CRIMES, CRIME_POR_ID, SECOES_CODIGO, SECAO_POR_ID, TEMPOS_PENA,
  septims, textoMulta, textoFianca,
} from '../data/codigo.js';
import SeletorCivil from '../components/SeletorCivil.jsx';
import FichaCidadao from '../components/FichaCidadao.jsx';
import { civilDaFicha } from '../lib/perfil.js';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar,
} from '../components/ui.jsx';

const VAZIO = {
  preso: '', civil_id: '', id_jogo: '', origem: 'riften',
  crime_id: '', minutos: 5, motivo: '',
  status: 'Cumprindo pena', notas: '',
};

const dois = (n) => String(n).padStart(2, '0');
const emHoras = (iso) => new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** Relógio compartilhado: um único intervalo move todos os cronômetros. */
function useAgora(ativo) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  return agora;
}

export default function Prisoes({ usuario }) {
  const d = useDados();
  const [busca, setBusca] = useState('');
  const [encerrando, setEncerrando] = useState(null);
  const [fStatus, setFStatus] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [verCodigo, setVerCodigo] = useState(false);

  // O guarda registra e encerra prisões; apagar um registro é ato da Corte.
  const daCorte = usuario?.tipo !== 'soldado';

  const prisoes = d.prisoes || [];
  const cumprindo = prisoes.filter((p) => p.status === 'Cumprindo pena');
  const agora = useAgora(cumprindo.length > 0);

  const historico = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return prisoes
      .filter((p) => p.status !== 'Cumprindo pena')
      .filter((p) =>
        (!t || `${p.preso} ${p.crime} ${p.id_jogo}`.toLowerCase().includes(t)) &&
        (!fStatus || p.status === fStatus) &&
        (!fOrigem || p.origem === fOrigem))
      .sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  }, [prisoes, busca, fStatus, fOrigem]);

  const registrar = async (v) => {
    const inicio = v.inicio || new Date().toISOString();
    const crime = CRIME_POR_ID[v.crime_id];
    // A pena vem do Código quando há crime escolhido. Sem crime — registro
    // antigo, ou prisão anotada à mão — o que já estava gravado fica: antes,
    // reabrir e salvar apagava crime, artigo, multa e fiança.
    const doCodigo = crime ? {
      crime: crime.nome,
      artigo: crime.artigo || '',
      secao: crime.secao || '',
      multa: crime.multa ?? null,
      multa_texto: crime.multaTexto || '',
      fianca: crime.fianca ?? null,
    } : {
      crime: v.crime || v.motivo || 'Não especificado',
      artigo: v.artigo || '',
      secao: v.secao || '',
      multa: v.multa ?? null,
      multa_texto: v.multa_texto || '',
      fianca: v.fianca ?? null,
    };
    const minutos = Math.max(1, Number(v.minutos) || 0);
    const autor = v.registrado_por || usuario?.nome || usuario?.cargo || 'Guarda';
    const gravada = await d.salvar('prisoes', {
      ...v,
      inicio,
      minutos,
      fim: new Date(new Date(inicio).getTime() + minutos * 60000).toISOString(),
      ...doCodigo,
      registrado_por: autor,
    }, `${v.preso} — ${doCodigo.crime}`);

    // A multa que o Código aplicou vira cobrança rastreável contra o
    // preso — sem isso ela era só um número escrito na ficha. O mesmo
    // fato nunca gera duas cobranças: salvar de novo corrige o valor
    // em aberto e nunca mexe no que já foi pago.
    if (gravada?.id && gravada.multa) {
      await cobrarMultaDaPrisao(gravada, autor);
      await d.recarregar();
    }
  };

  /**
   * Encerrar a prisão. Soltar sob fiança cobra a fiança: é o que
   * transforma "solto" numa dívida que alguém tem de quitar.
   */
  const encerrar = async (p, status) => {
    // Dois cliques em "Soltar sob fiança" cobrariam a fiança duas
    // vezes: a segunda chamada só é barrada aqui.
    if (encerrando) return;
    setEncerrando(p.id);
    try {
      await fecharPrisao(p, status);
    } finally {
      setEncerrando(null);
    }
  };

  const fecharPrisao = async (p, status) => {
    const autor = usuario?.nome || usuario?.cargo || 'Guarda';
    const gravada = await d.salvar('prisoes', {
      ...p, status, cumprida_em: new Date().toISOString(),
    }, `${p.preso} — ${status.toLowerCase()}`);
    if (status === 'Solto sob fiança' && p.fianca) {
      await cobrarFiancaDaPrisao(gravada?.id ? gravada : p, autor);
      await d.recarregar();
    }
  };

  const soltos = prisoes.filter((p) => p.status === 'Sentença cumprida').length;
  const fiancas = prisoes.filter((p) => p.status === 'Solto sob fiança').length;

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Registro de Prisões</h1>
          <p>
            Toda prisão feita pela Guarda entra aqui. A data e a hora são do momento do
            registro, e o cronômetro da pena começa a correr na hora.
          </p>
        </div>
        <div className="acoes">
          <button className="btn" onClick={() => setVerCodigo(true)}>
            <Icone nome="balanca" tam={15} /> Consultar o Código
          </button>
          <button className="btn primario" onClick={() => setEdit({ ...VAZIO })}>
            <Icone nome="mais" tam={15} /> Registrar prisão
          </button>
        </div>
      </div>
      <div className="regra" />

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Cumprindo pena" valor={cumprindo.length} sub="agora nas celas" tom="laranja" />
        <Stat rotulo="Sentenças cumpridas" valor={soltos} sub="penas concluídas" tom="verde" />
        <Stat rotulo="Soltos sob fiança" valor={fiancas} sub="pagaram a fiança" tom="roxo" />
        <Stat rotulo="Prisões registradas" valor={prisoes.length} sub="no total" />
      </div>

      {/* -------- Celas -------- */}
      <Painel
        titulo="Nas celas"
        acoes={cumprindo.length
          ? <Selo tom="warn" ponto>{cumprindo.length} cumprindo pena</Selo>
          : <Selo tom="ok" ponto>Celas vazias</Selo>}
      >
        {cumprindo.length === 0 ? (
          <Vazio simb="⛓">Ninguém preso no momento.</Vazio>
        ) : (
          <div className="grade g2">
            {cumprindo
              .sort((a, b) => new Date(a.fim) - new Date(b.fim))
              .map((p) => (
                <CelaCard
                  key={p.id}
                  prisao={p}
                  agora={agora}
                  aoCumprir={() => encerrar(p, 'Sentença cumprida')}
                  aoFiancar={() => encerrar(p, 'Solto sob fiança')}
                  aoEditar={() => setEdit(p)}
                  aoPerfil={() => {
                    const c = civilDaFicha({ nome: p.preso, civil_id: p.civil_id }, d.civis || []);
                    if (c) setPerfil(c);
                  }}
                  temPerfil={Boolean(civilDaFicha({ nome: p.preso, civil_id: p.civil_id }, d.civis || []))}
                />
              ))}
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Histórico -------- */}
      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Preso, crime ou ID…" />
        </div>
        <Selecao
          rotulo="Situação" valor={fStatus} aoMudar={setFStatus}
          opcoes={STATUS_PRISAO.filter((s) => s !== 'Cumprindo pena')} vazioLabel="Todas"
        />
        <Selecao
          rotulo="Procedência" valor={fOrigem} aoMudar={setFOrigem}
          opcoes={HOLDS.map((h) => ({ valor: h.id, rotulo: rotuloHold(h.id) }))} vazioLabel="Todas"
        />
      </div>

      {historico.length === 0 ? (
        <Painel>
          <Vazio simb="⚖">
            {prisoes.length === 0
              ? 'Nenhuma prisão registrada ainda.'
              : 'Nenhum registro encerrado corresponde ao filtro.'}
          </Vazio>
        </Painel>
      ) : (
        <div className="tabela-wrap">
          <table style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th>Preso</th><th>Procedência</th><th>Crime</th><th>Pena</th>
                <th>Entrada</th><th>Situação</th><th>Guarda</th><th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {historico.map((p) => {
                const civil = civilDaFicha({ nome: p.preso, civil_id: p.civil_id }, d.civis || []);
                return (
                  <tr key={p.id}>
                    <td>
                      {civil
                        ? <button className="nome-forte link-perfil" onClick={() => setPerfil(civil)}>{p.preso}</button>
                        : <span className="nome-forte">{p.preso}</span>}
                      {p.id_jogo && <div className="mono" style={{ fontSize: 11, color: 'var(--txt-3)' }}>ID {p.id_jogo}</div>}
                    </td>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{rotuloHold(p.origem)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ color: 'var(--txt)' }}>{p.crime}</span>
                        {p.artigo && (
                          <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                            {p.artigo} · {SECAO_POR_ID[p.secao]?.nome || ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td><Selo tom="gold">{p.minutos} min</Selo></td>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{emHoras(p.inicio)}</td>
                    <td><Selo tom={STATUS_PRISAO_TOM[p.status]} ponto>{p.status}</Selo></td>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{p.registrado_por || '—'}</td>
                    <td className="col-acoes">
                      <button className="btn pq fantasma" onClick={() => setEdit(p)}><Icone nome="lapis" tam={13} /></button>{' '}
                      {daCorte && (
                        <button className="btn pq perigo" onClick={() => setRem(p)}><Icone nome="lixo" tam={13} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <FormPrisao
          inicial={edit}
          civis={d.civis || []}
          aoFechar={() => setEdit(null)}
          aoSalvar={async (v) => { await registrar(v); setEdit(null); }}
        />
      )}
      {verCodigo && <CodigoDeRiften aoFechar={() => setVerCodigo(false)} />}
      {perfil && <FichaCidadao civil={perfil} dados={d} aoFechar={() => setPerfil(null)} />}
      {rem && (
        <Confirmar
          mensagem={`Apagar o registro da prisão de ${rem.preso}? O histórico de prisões é prova documental — considere marcar como Anulada em vez de apagar.`}
          aoConfirmar={() => d.remover('prisoes', rem.id, rem.preso)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function CelaCard({ prisao, agora, aoCumprir, aoFiancar, aoEditar, aoPerfil, temPerfil }) {
  const inicio = new Date(prisao.inicio).getTime() || agora;
  // Registro legado pode não ter `fim`: reconstruímos pelo tempo de pena
  // em vez de mostrar NaN no cronômetro e na barra.
  const fimBruto = new Date(prisao.fim).getTime();
  const fim = Number.isFinite(fimBruto)
    ? fimBruto
    : inicio + Math.max(1, Number(prisao.minutos) || 1) * 60000;
  const total = Math.max(1, fim - inicio);
  const resta = fim - agora;
  const acabou = resta <= 0;
  const pct = Math.min(100, Math.max(0, ((agora - inicio) / total) * 100));

  const seg = Math.max(0, Math.ceil(resta / 1000));
  const relogio = `${dois(Math.floor(seg / 60))}:${dois(seg % 60)}`;

  return (
    <article className={`cela-card ${acabou ? 'cumprida' : ''}`}>
      <header>
        <span className="cela-icone">
          <Icone nome={acabou ? 'chave' : 'grades'} tam={19} cor={acabou ? 'var(--ok)' : 'var(--warn)'} />
        </span>
        <div className="cela-titulo">
          {temPerfil
            ? <button className="h3-link" onClick={aoPerfil}>{prisao.preso}</button>
            : <h3>{prisao.preso}</h3>}
          <span className="cela-sub">
            {rotuloHold(prisao.origem)}
            {prisao.id_jogo && <> · <span className="mono">ID {prisao.id_jogo}</span></>}
          </span>
        </div>
        <span className={`cronometro ${acabou ? 'fim' : ''}`}>{acabou ? 'PENA CUMPRIDA' : relogio}</span>
      </header>

      <div className="cela-crime">
        <span className="cc-nome">{prisao.crime}</span>
        {prisao.artigo && <Selo>{prisao.artigo}</Selo>}
        <Selo tom="gold">{prisao.minutos} min</Selo>
        {prisao.multa != null && <Selo>Multa {septims(prisao.multa)}</Selo>}
        {prisao.multa == null && prisao.multa_texto && prisao.multa_texto !== '—' && (
          <Selo tom="perigo">{prisao.multa_texto}</Selo>
        )}
        <Selo tom={prisao.fianca == null ? 'perigo' : 'roxo'}>
          {prisao.fianca == null ? 'Sem fiança' : `Fiança ${septims(prisao.fianca)}`}
        </Selo>
      </div>

      {prisao.motivo && <p className="cela-motivo">{prisao.motivo}</p>}

      <div className="cela-barra">
        <div className="trilho"><div className={acabou ? 'cheio fim' : 'cheio'} style={{ width: `${pct}%` }} /></div>
        <span className="cela-tempos">
          Entrada {emHoras(prisao.inicio)} · Soltura prevista {emHoras(prisao.fim)}
          {prisao.registrado_por && <> · prisão de {prisao.registrado_por}</>}
        </span>
      </div>

      <footer>
        {acabou ? (
          <button className="btn primario" onClick={aoCumprir}>
            <Icone nome="chave" tam={14} /> Registrar pena cumprida
          </button>
        ) : (
          <>
            <span className="cela-espera">
              <Icone nome="ampulheta" tam={13} /> Aguardando o fim da pena
            </span>
            {prisao.fianca != null && (
              <button className="btn pq" onClick={aoFiancar}>Soltar sob fiança</button>
            )}
          </>
        )}
        <button className="btn pq fantasma" style={{ marginLeft: 'auto' }} onClick={aoEditar}>
          <Icone nome="lapis" tam={13} />
        </button>
      </footer>
    </article>
  );
}

/* ------------------------------------------------------------ */
function FormPrisao({ inicial, civis, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...VAZIO, ...inicial });
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const vinculado = v.civil_id ? civis.find((c) => c.id === v.civil_id) : null;
  const crime = CRIME_POR_ID[v.crime_id];

  /** Escolher o crime traz a pena do Código; o guarda ainda pode ajustar o tempo. */
  const escolherCrime = (id) => {
    const c = CRIME_POR_ID[id];
    setV((s) => ({ ...s, crime_id: id, minutos: c ? c.minutos : s.minutos }));
  };

  return (
    <Modal
      titulo={inicial.id ? `Prisão — ${inicial.preso}` : 'Registrar prisão'}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            {inicial.id
              ? `Entrada em ${emHoras(inicial.inicio)}`
              : 'Data e hora são gravadas no momento do registro.'}
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario"
                disabled={ocupado || !String(v.preso || '').trim()}
                onClick={async () => {
                  // Registrar duas vezes daria duas prisões — e duas
                  // multas, cada uma com o seu número de cobrança.
                  if (ocupado) return;
                  setOcupado(true);
                  try { await aoSalvar(v); } finally { setOcupado(false); }
                }}>
            {inicial.id ? 'Salvar' : 'Registrar e iniciar a pena'}
          </button>
        </>
      }
    >
      <SeletorCivil
        rotulo="Nome do preso"
        valor={v.preso}
        aoMudar={(n) => setV((s) => ({ ...s, preso: n, civil_id: '', id_jogo: '' }))}
        aoEscolher={(c) => setV((s) => ({ ...s, preso: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '' }))}
        civis={civis}
        vinculado={vinculado}
        aoDesvincular={() => setV((s) => ({ ...s, civil_id: '', id_jogo: '' }))}
        placeholder="Busque no Registro Civil ou digite o nome"
      />

      <div style={{ height: 12 }} />
      <div className="grade g3">
        <Texto rotulo="ID do jogo" valor={v.id_jogo} aoMudar={set('id_jogo')} className="mono" placeholder="se conhecido" />
        <Selecao
          rotulo="De onde ele é" valor={v.origem} aoMudar={set('origem')}
          opcoes={HOLDS.map((h) => ({ valor: h.id, rotulo: rotuloHold(h.id) }))} vazioLabel="—"
        />
        {inicial.id && (
          <Selecao rotulo="Situação" valor={v.status} aoMudar={set('status')} opcoes={STATUS_PRISAO} vazioLabel="—" />
        )}
      </div>

      {/* -------- Crime -------- */}
      <div style={{ height: 18 }} />
      <div className="editor-cat">
        <div className="editor-cat-h">
          <label>Motivo da prisão — Código de Riften</label>
          {crime && <span className="selo gold">{crime.artigo}</span>}
        </div>
        <select
          value={v.crime_id}
          onChange={(e) => escolherCrime(e.target.value)}
          className="crime-select"
        >
          <option value="">Selecione o crime…</option>
          {SECOES_CODIGO.map((s) => (
            <optgroup key={s.id} label={`${s.nome} — ${s.titulo}`}>
              {CRIMES.filter((c) => c.secao === s.id).map((c) => (
                <option key={c.id} value={c.id}>{c.artigo} · {c.nome}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {crime && (
          <div className="pena-resumo">
            <div><span>Pena de prisão</span><strong>{crime.minutos} min</strong></div>
            <div><span>Multa</span><strong>{textoMulta(crime)}</strong></div>
            <div><span>Fiança</span><strong className={crime.fianca == null ? 'perigo' : ''}>{textoFianca(crime)}</strong></div>
            {crime.obs && <p className="pena-obs">{crime.obs}</p>}
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />
      <div className="campo">
        <label>Tempo de prisão</label>
        <div className="nivel-escolha">
          {TEMPOS_PENA.map((m) => (
            <button
              type="button" key={m}
              className={`nivel-op ${Number(v.minutos) === m ? 'ativo' : ''}`}
              onClick={() => set('minutos')(m)}
            >
              {m} min
            </button>
          ))}
        </div>
        {crime && Number(v.minutos) !== crime.minutos && (
          <p className="ajuda" style={{ color: 'var(--warn)' }}>
            <Icone nome="balanca" tam={13} /> Diferente da pena prevista ({crime.minutos} min) — registre o porquê abaixo.
          </p>
        )}
      </div>

      <div style={{ height: 12 }} />
      <AreaTexto
        rotulo="Relato da prisão"
        valor={v.motivo}
        aoMudar={set('motivo')}
        placeholder="O que aconteceu, onde, quem testemunhou, agravantes ou atenuantes…"
      />
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function CodigoDeRiften({ aoFechar }) {
  return (
    <Modal
      titulo="Código de Riften — penas"
      largo
      aoFechar={aoFechar}
      rodape={<button className="btn primario" onClick={aoFechar}>Fechar</button>}
    >
      <p style={{ marginTop: 0, color: 'var(--txt-3)', fontSize: 12.5, fontStyle: 'italic' }}>
        “Que a lei seja forte o suficiente para conter os perversos, e justa o bastante para
        proteger os inocentes.” — Artorias Blackwing, Jarl de Riften.
      </p>

      {SECOES_CODIGO.map((s) => (
        <section key={s.id} className="codigo-secao">
          <h4>
            <Selo tom={s.tom}>{s.titulo}</Selo> {s.nome}
          </h4>
          <div className="tabela-wrap">
            <table style={{ minWidth: 520 }}>
              <thead>
                <tr><th>Artigo</th><th>Crime</th><th>Prisão</th><th>Multa</th><th>Fiança</th></tr>
              </thead>
              <tbody>
                {CRIMES.filter((c) => c.secao === s.id).map((c) => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--gold)', whiteSpace: 'nowrap' }}>{c.artigo}</td>
                    <td style={{ color: 'var(--txt)' }}>
                      {c.nome}
                      {c.obs && <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{c.obs}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.minutos} min</td>
                    <td style={{ color: 'var(--txt-2)', whiteSpace: 'nowrap' }}>{textoMulta(c)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: c.fianca == null ? 'var(--danger)' : 'var(--txt-2)' }}>
                      {textoFianca(c)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </Modal>
  );
}
