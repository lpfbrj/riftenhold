import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  PAINEIS, PAINEL_POR_ID, SLOTS, SLOT_POR_ID, CLASSES, CLASSE_POR_ID,
  MATERIAIS_ARMA, MATERIAL_POR_ID, TIPOS_ARMA, TIPO_ARMA_POR_ID,
  EIXOS_POCAO, EIXO_POR_ID, GRUPOS_RECURSO, GRUPO_RECURSO_POR_ID,
  ARMADURAS, ARMAS, POCOES, INGREDIENTES, RECURSOS,
  CATALOGO, ITEM_POR_ID, calcularSaldos, MOTIVOS_ENTRADA, MOTIVOS_SAIDA,
  PREDIOS, PREDIO_POR_ID, PREDIO_PADRAO, predioDe, movimentosDoPredio, resumoDosPredios,
} from '../data/almoxarifado.js';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar,
} from '../components/ui.jsx';

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
});

const norm = (s) => String(s || '').toLowerCase();
const nx = (n) => Number(n || 0).toLocaleString('pt-BR');

/** Empunhadura das armas — o filtro que separa uma mão de duas. */
const MAOS = [...new Set(TIPOS_ARMA.map((t) => t.mao))];

/** Onde o prédio escolhido fica guardado entre uma visita e outra. */
const CHAVE_PREDIO = 'riften-hold:predio-logistica';
const lerPredio = () => {
  try {
    const v = sessionStorage.getItem(CHAVE_PREDIO);
    return PREDIO_POR_ID[v] ? v : '';
  } catch { return ''; }
};
const gravarPredio = (v) => {
  try {
    if (v) sessionStorage.setItem(CHAVE_PREDIO, v);
    else sessionStorage.removeItem(CHAVE_PREDIO);
  } catch { /* sem sessionStorage, a escolha vale só para esta visita */ }
};

export default function Logistica({ usuario }) {
  const d = useDados();
  const todos = d.movimentos || [];
  // O soldado dá entrada e baixa; estornar um lançamento é ato da Corte.
  const daCorte = usuario?.tipo !== 'soldado';

  const [predio, setPredio] = useState(lerPredio);
  const [painel, setPainel] = useState('equipamento');
  const [busca, setBusca] = useState('');
  const [mov, setMov] = useState(null);      // formulário de entrada/saída
  const [verItem, setVerItem] = useState(null); // extrato de um item
  const [rem, setRem] = useState(null);

  const escolher = (id) => { gravarPredio(id); setPredio(id); setBusca(''); };

  const movimentos = useMemo(() => movimentosDoPredio(todos, predio), [todos, predio]);
  const saldos = useMemo(() => calcularSaldos(todos, predio), [todos, predio]);

  const registrar = async (v) => {
    const item = ITEM_POR_ID[v.item_id];
    const qtd = Math.max(1, Number(v.quantidade) || 1);
    const em = v.em || new Date().toISOString();
    const quem = v.registrado_por || usuario?.nome || usuario?.cargo || 'Quartel General';
    const comum = {
      item_id: v.item_id,
      quantidade: qtd,
      item_nome: item?.nome || '',
      painel: item?.painel || '',
      nota: v.nota || '',
      em,
      registrado_por: quem,
    };

    // Transferir é um par de lançamentos: sai de um prédio, entra no outro.
    if (v.sentido === 'transferencia' && v.predio_destino && v.predio_destino !== predio) {
      const destino = PREDIO_POR_ID[v.predio_destino];
      const origem = PREDIO_POR_ID[predio];
      await d.salvar('movimentos', {
        ...comum,
        sentido: 'saida',
        predio,
        motivo: 'Transferência',
        destino: destino?.nome || '',
      }, `Transferência — ${item?.nome} → ${destino?.nome}`);
      await d.salvar('movimentos', {
        ...comum,
        sentido: 'entrada',
        predio: v.predio_destino,
        motivo: 'Transferência',
        destino: origem?.nome || '',
      }, `Transferência — ${item?.nome} ← ${origem?.nome}`);
      return;
    }

    await d.salvar('movimentos', {
      ...comum,
      sentido: v.sentido,
      predio,
      motivo: v.motivo || '',
      destino: v.destino || '',
    }, `${v.sentido === 'saida' ? 'Saída' : 'Entrada'} — ${item?.nome}`);
  };

  const abrirMov = (sentido, item_id = '') =>
    setMov({ sentido, item_id, quantidade: 1, motivo: '', destino: '', nota: '', predio_destino: '' });

  /* ---------- Passo 1: escolher o prédio ---------- */
  if (!predio) return <EscolhaPredio movimentos={todos} aoEscolher={escolher} />;

  const casa = PREDIO_POR_ID[predio];

  // ---- números do topo, já do prédio ----
  const doPainel = CATALOGO.filter((i) => i.painel === painel);
  const totalPecas = doPainel.reduce((s, i) => s + (saldos[i.id] || 0), 0);
  const emFalta = doPainel.filter((i) => (saldos[i.id] || 0) <= 0).length;
  const hoje = new Date().toDateString();
  const movHoje = movimentos.filter((m) => new Date(m.em).toDateString() === hoje).length;

  return (
    <>
      <div className="pg-head">
        <div>
          <button className="btn pq fantasma trocar-predio" onClick={() => escolher('')}>
            ← Trocar de prédio
          </button>
          <h1>
            <Icone nome={casa.icone} tam={20} cor="var(--gold)" /> {casa.nome}
          </h1>
          <p>
            Almoxarifado deste prédio. {casa.detalhe} Cada movimento registrado aqui mexe só
            no estoque desta casa — nada se mistura com o dos outros prédios.
          </p>
        </div>
        <div className="acoes">
          <button className="btn" onClick={() => abrirMov('saida')}>
            <Icone nome="saidaItem" tam={15} /> Registrar saída
          </button>
          <button className="btn primario" onClick={() => abrirMov('entrada')}>
            <Icone nome="entrada" tam={15} /> Registrar entrada
          </button>
        </div>
      </div>
      <div className="regra" />

      {/* -------- Atalho entre prédios -------- */}
      <div className="predio-atalhos">
        {PREDIOS.map((p) => (
          <button
            key={p.id}
            className={`predio-atalho ${p.id === predio ? 'ativo' : ''}`}
            onClick={() => escolher(p.id)}
          >
            <Icone nome={p.icone} tam={14} cor={p.id === predio ? 'var(--gold)' : 'var(--txt-3)'} />
            {p.curto}
          </button>
        ))}
      </div>

      {/* -------- Abas dos três painéis -------- */}
      <div className="abas-painel">
        {PAINEIS.map((p) => {
          const itens = CATALOGO.filter((i) => i.painel === p.id);
          const total = itens.reduce((s, i) => s + (saldos[i.id] || 0), 0);
          return (
            <button
              key={p.id}
              className={`aba-painel ${painel === p.id ? 'ativa' : ''}`}
              onClick={() => { setPainel(p.id); setBusca(''); }}
            >
              <span className="aba-icone"><Icone nome={p.icone} tam={17} cor="var(--gold)" /></span>
              <span className="aba-txt">
                <strong>{p.nome}</strong>
                <small>{p.descricao}</small>
              </span>
              <span className="aba-num mono">{nx(total)}</span>
            </button>
          );
        })}
      </div>

      <div className="grade g3" style={{ margin: '18px 0' }}>
        <Stat rotulo="Peças em estoque" valor={nx(totalPecas)}
              sub={`${PAINEL_POR_ID[painel].nome.toLowerCase()} · ${casa.curto}`} tom="verde" />
        <Stat rotulo="Itens zerados" valor={emFalta} sub="sem nenhuma unidade aqui"
              tom={emFalta ? 'laranja' : ''} />
        <Stat rotulo="Movimentos hoje" valor={movHoje} sub="entradas e saídas" tom="roxo" />
      </div>

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar no painel</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Nome do item…" />
        </div>
      </div>

      {painel === 'equipamento' && (
        <PainelEquipamento saldos={saldos} busca={busca} aoMover={abrirMov} aoVer={setVerItem} />
      )}
      {painel === 'alquimia' && (
        <PainelAlquimia saldos={saldos} busca={busca} aoMover={abrirMov} aoVer={setVerItem} />
      )}
      {painel === 'recursos' && (
        <PainelRecursos saldos={saldos} busca={busca} aoMover={abrirMov} aoVer={setVerItem} />
      )}

      <div style={{ height: 18 }} />

      {/* -------- Livro de movimentos do prédio -------- */}
      <Painel
        titulo="Livro de movimentos"
        acoes={<><Selo tom="gold">{casa.curto}</Selo>{' '}
          <Selo>{movimentos.length} lançamento{movimentos.length === 1 ? '' : 's'}</Selo></>}
      >
        {movimentos.length === 0 ? (
          <Vazio simb="⚖">Nenhuma entrada ou saída registrada neste prédio ainda.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Quando</th><th>Item</th><th>Movimento</th><th>Qtd.</th>
                  <th>Motivo</th><th>Destino / origem</th><th>Registrado por</th>
                  <th className="col-acoes"></th>
                </tr>
              </thead>
              <tbody>
                {[...movimentos]
                  .sort((a, b) => new Date(b.em) - new Date(a.em))
                  .slice(0, 40)
                  .map((m) => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(m.em)}</td>
                      <td>
                        <button className="nome-forte link-perfil"
                                onClick={() => setVerItem(ITEM_POR_ID[m.item_id] || null)}>
                          {m.item_nome || ITEM_POR_ID[m.item_id]?.nome || '—'}
                        </button>
                      </td>
                      <td>
                        <Selo tom={m.sentido === 'saida' ? 'perigo' : 'ok'} ponto>
                          {m.sentido === 'saida' ? 'Saída' : 'Entrada'}
                        </Selo>
                      </td>
                      <td className="mono" style={{ color: m.sentido === 'saida' ? 'var(--danger)' : 'var(--ok)' }}>
                        {m.sentido === 'saida' ? '−' : '+'}{m.quantidade}
                      </td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{m.motivo || '—'}</td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{m.destino || '—'}</td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{m.registrado_por || '—'}</td>
                      <td className="col-acoes">
                        {daCorte && (
                          <button className="btn pq perigo" onClick={() => setRem(m)}>
                            <Icone nome="lixo" tam={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {movimentos.length > 40 && (
              <p className="perfil-aviso" style={{ padding: '8px 12px' }}>
                Mostrando os 40 lançamentos mais recentes de {movimentos.length} neste prédio.
              </p>
            )}
          </div>
        )}
      </Painel>

      {mov && (
        <FormMovimento
          inicial={mov}
          saldos={saldos}
          painelAtual={painel}
          predio={predio}
          aoFechar={() => setMov(null)}
          aoSalvar={async (v) => { await registrar(v); setMov(null); }}
        />
      )}
      {verItem && (
        <ExtratoItem
          item={verItem}
          predio={predio}
          saldo={saldos[verItem.id] || 0}
          movimentos={movimentos.filter((m) => m.item_id === verItem.id)}
          outros={todos.filter((m) => m.item_id === verItem.id)}
          aoFechar={() => setVerItem(null)}
          aoMover={(s) => { setVerItem(null); abrirMov(s, verItem.id); }}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Apagar este lançamento de ${rem.sentido === 'saida' ? 'saída' : 'entrada'} de ${rem.quantidade}× ${rem.item_nome}? O saldo volta ao que era antes dele.`}
          aoConfirmar={() => d.remover('movimentos', rem.id)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ============================================================
   Passo 1 — de qual prédio é o almoxarifado?
   ============================================================ */
function EscolhaPredio({ movimentos, aoEscolher }) {
  const casas = useMemo(() => resumoDosPredios(movimentos), [movimentos]);
  const geral = casas.reduce((s, c) => s + c.total, 0);

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Logística</h1>
          <p>
            Cada prédio do Hold guarda o seu próprio almoxarifado. Escolha de qual casa você
            quer ver o estoque — as entradas e saídas que registrar depois valem só para ela.
          </p>
        </div>
        <div className="acoes">
          <Selo tom="gold">{nx(geral)} peças no Hold</Selo>
        </div>
      </div>
      <div className="regra" />

      <div className="predio-escolha">
        {casas.map((c) => (
          <button key={c.id} className="predio-card" onClick={() => aoEscolher(c.id)}>
            <header>
              <span className="predio-icone"><Icone nome={c.icone} tam={22} cor="var(--gold)" /></span>
              <span>
                <strong>{c.nome}</strong>
                <small>{c.resumo}</small>
              </span>
            </header>
            <p>{c.detalhe}</p>
            <div className="predio-num">
              <span className="mono grande">{nx(c.total)}</span>
              <small>peças em estoque</small>
            </div>
            <div className="predio-linhas">
              {PAINEIS.map((p) => (
                <span key={p.id} className="predio-linha">
                  <Icone nome={p.icone} tam={12} cor="var(--txt-3)" />
                  {p.nome}
                  <b className="mono">{nx(c.porPainel[p.id])}</b>
                </span>
              ))}
            </div>
            <footer>
              <Selo tom={c.lancamentos ? 'roxo' : 'off'}>
                {c.lancamentos} lançamento{c.lancamentos === 1 ? '' : 's'}
              </Selo>
              <span className="predio-entrar">Ver logística →</span>
            </footer>
          </button>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   Linha de estoque — o tijolo dos três painéis
   ============================================================ */
function LinhaEstoque({ nome, saldo, selos = [], cor, aoMover, aoVer }) {
  return (
    <div className={`estoque-linha ${saldo <= 0 ? 'zerado' : ''}`}>
      {cor && <i className="estoque-cor" style={{ background: cor }} />}
      <button className="estoque-nome" onClick={aoVer}>{nome}</button>
      <span className="estoque-selos">
        {selos.map((s, i) => <Selo key={i} tom={s.tom || ''}>{s.texto}</Selo>)}
      </span>
      <span className={`estoque-qtd mono ${saldo <= 0 ? 'zerada' : ''}`}>{saldo}</span>
      <span className="estoque-bts">
        <button className="btn pq" title="Registrar entrada" onClick={() => aoMover('entrada')}>
          <Icone nome="entrada" tam={13} />
        </button>
        <button className="btn pq" title="Registrar saída" disabled={saldo <= 0}
                onClick={() => aoMover('saida')}>
          <Icone nome="saidaItem" tam={13} />
        </button>
      </span>
    </div>
  );
}

/**
 * Bloco de estoque. Quando recebe `aoAlternar`, vira uma gaveta:
 * fechada mostra só o cabeçalho, e a página não despeja tudo de uma vez.
 */
function Bloco({ titulo, sub, acoes, aberto = true, aoAlternar, children }) {
  const dobravel = typeof aoAlternar === 'function';
  const Cab = dobravel ? 'button' : 'header';
  return (
    <section className={`estoque-bloco ${dobravel ? 'dobravel' : ''} ${aberto ? 'aberto' : 'fechado'}`}>
      <Cab
        {...(dobravel ? { type: 'button', className: 'bloco-cab', onClick: aoAlternar, 'aria-expanded': aberto } : {})}
      >
        {dobravel && <span className="bloco-seta">{aberto ? '▾' : '▸'}</span>}
        <h4>{titulo}</h4>
        {sub && <small>{sub}</small>}
        {acoes && <span className="dir">{acoes}</span>}
      </Cab>
      {aberto && <div className="estoque-lista">{children}</div>}
    </section>
  );
}

/** Controla quais gavetas estão abertas, sem encher a página. */
function useGavetas(auto = false) {
  const [abertas, setAbertas] = useState(() => new Set());
  const alternar = (id) => setAbertas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  return {
    // Busca ou filtro estreito abre sozinho — quem procura quer ver.
    aberta: (id) => auto || abertas.has(id),
    alternar,
    todas: (ids) => setAbertas(new Set(ids)),
    nenhuma: () => setAbertas(new Set()),
    algumaAberta: abertas.size > 0,
  };
}

function BotoesGaveta({ g, ids }) {
  return (
    <div className="gaveta-bts">
      <button className="btn pq fantasma" onClick={() => g.todas(ids)}>Abrir todos</button>
      <button className="btn pq fantasma" onClick={g.nenhuma}>Fechar todos</button>
    </div>
  );
}

/* ============================================================
   Painel 1 — Equipamentos da Guarda
   ============================================================ */
function PainelEquipamento({ saldos, busca, aoMover, aoVer }) {
  const [aba, setAba] = useState('armadura');
  const [classe, setClasse] = useState('');
  const [slot, setSlot] = useState('');
  const [material, setMaterial] = useState('');
  const [mao, setMao] = useState('');
  const t = norm(busca);

  const armaduras = ARMADURAS.filter((a) =>
    (!t || norm(a.nome).includes(t)) &&
    (!classe || a.classe === classe) &&
    (!slot || a.slot === slot));

  const armas = ARMAS.filter((a) =>
    (!t || norm(a.nome).includes(t)) &&
    (!material || a.material === material) &&
    (!mao || a.mao === mao));

  const totalArmadura = ARMADURAS.reduce((s, a) => s + (saldos[a.id] || 0), 0);
  const totalArma = ARMAS.reduce((s, a) => s + (saldos[a.id] || 0), 0);

  const materiais = MATERIAIS_ARMA
    .filter((m) => (!material || m.id === material))
    .map((m) => ({ ...m, itens: armas.filter((a) => a.material === m.id) }))
    .filter((m) => m.itens.length > 0);

  const g = useGavetas(Boolean(t) || materiais.length === 1);

  return (
    <>
      <div className="sub-abas">
        <button className={`sub-aba ${aba === 'armadura' ? 'ativa' : ''}`} onClick={() => setAba('armadura')}>
          <Icone nome="escudo" tam={14} /> Armaduras <b className="mono">{nx(totalArmadura)}</b>
        </button>
        <button className={`sub-aba ${aba === 'arma' ? 'ativa' : ''}`} onClick={() => setAba('arma')}>
          <Icone nome="espada" tam={14} /> Arsenal <b className="mono">{nx(totalArma)}</b>
        </button>
      </div>

      {aba === 'armadura' ? (
        <Painel
          titulo="Armaduras da Guarda"
          acoes={<><Selo tom="gold">{nx(totalArmadura)} peças</Selo> <Selo>{armaduras.length} de {ARMADURAS.length} tipos</Selo></>}
        >
          <p className="painel-nota">
            As peças fixas do fardamento, conferidas no baú deste prédio. Lendárias e comuns
            contam como a mesma peça — o que vale aqui é a quantidade.
          </p>

          <div className="barra-filtros compacta">
            <Selecao rotulo="Classe" valor={classe} aoMudar={setClasse} vazioLabel="Todas"
                     opcoes={CLASSES.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            <Selecao rotulo="Tipo (slot)" valor={slot} aoMudar={setSlot} vazioLabel="Todos"
                     opcoes={SLOTS.map((s) => ({ valor: s.id, rotulo: `${s.nome} · ${s.pt}` }))} />
          </div>

          {armaduras.length === 0 ? (
            <Vazio simb="🛡">Nenhuma peça corresponde ao filtro.</Vazio>
          ) : (
            <div className="tabela-wrap">
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Peça</th><th>Tipo</th><th>Classe</th><th>Peso</th><th>Valor</th>
                    <th style={{ textAlign: 'right' }}>Estoque</th><th className="col-acoes"></th>
                  </tr>
                </thead>
                <tbody>
                  {armaduras.map((a) => {
                    const q = saldos[a.id] || 0;
                    const cl = CLASSE_POR_ID[a.classe];
                    return (
                      <tr key={a.id} className={q <= 0 ? 'linha-zerada' : ''}>
                        <td>
                          <button className="nome-forte link-perfil" onClick={() => aoVer(a)}>{a.nome}</button>
                        </td>
                        <td>
                          <Selo>{a.slot}</Selo>{' '}
                          <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{SLOT_POR_ID[a.slot]?.pt}</span>
                        </td>
                        <td><Selo tom={cl?.tom}>{cl?.nome}</Selo></td>
                        <td className="mono" style={{ color: 'var(--txt-2)' }}>{a.peso || '—'}</td>
                        <td className="mono" style={{ color: 'var(--txt-2)' }}>{a.valor}</td>
                        <td className={`mono qtd-cel ${q <= 0 ? 'zerada' : ''}`}>{q}</td>
                        <td className="col-acoes">
                          <button className="btn pq" title="Entrada" onClick={() => aoMover('entrada', a.id)}>
                            <Icone nome="entrada" tam={13} />
                          </button>{' '}
                          <button className="btn pq" title="Saída" disabled={q <= 0}
                                  onClick={() => aoMover('saida', a.id)}>
                            <Icone nome="saidaItem" tam={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      ) : (
        <Painel
          titulo="Arsenal"
          acoes={<><Selo tom="gold">{nx(totalArma)} armas</Selo> <Selo>{armas.length} de {ARMAS.length} tipos</Selo></>}
        >
          <p className="painel-nota">
            Os seis materiais autorizados pela Corte, cada um na sua gaveta. Abra o material que
            interessa — ou filtre pela empunhadura. Ferro e Aço não têm arco na forja.
          </p>

          <div className="barra-filtros compacta">
            <Selecao rotulo="Material" valor={material} aoMudar={setMaterial} vazioLabel="Todos"
                     opcoes={MATERIAIS_ARMA.map((m) => ({ valor: m.id, rotulo: m.nome }))} />
            <Selecao rotulo="Empunhadura" valor={mao} aoMudar={setMao} vazioLabel="Todas"
                     opcoes={MAOS.map((m) => ({ valor: m, rotulo: m }))} />
            <BotoesGaveta g={g} ids={materiais.map((m) => m.id)} />
          </div>

          {materiais.length === 0 ? (
            <Vazio simb="⚔">Nenhuma arma corresponde ao filtro.</Vazio>
          ) : materiais.map((m) => {
            const total = m.itens.reduce((s, a) => s + (saldos[a.id] || 0), 0);
            return (
              <Bloco
                key={m.id}
                aberto={g.aberta(m.id)}
                aoAlternar={() => g.alternar(m.id)}
                titulo={<span className="mat-titulo"><i style={{ background: m.cor }} /> {m.nome}</span>}
                sub={`${m.itens.length} tipos`}
                acoes={<Selo tom={total ? 'gold' : 'off'}>{total} em estoque</Selo>}
              >
                {m.itens.map((a) => (
                  <LinhaEstoque
                    key={a.id}
                    nome={a.nome}
                    cor={m.cor}
                    saldo={saldos[a.id] || 0}
                    selos={[
                      { texto: TIPO_ARMA_POR_ID[a.tipo]?.nome },
                      { texto: a.mao, tom: a.mao === 'Munição' ? 'roxo' : '' },
                    ]}
                    aoVer={() => aoVer(a)}
                    aoMover={(s) => aoMover(s, a.id)}
                  />
                ))}
              </Bloco>
            );
          })}
        </Painel>
      )}
    </>
  );
}

/* ============================================================
   Painel 2 — Poções e Ingredientes
   ============================================================ */
function PainelAlquimia({ saldos, busca, aoMover, aoVer }) {
  const [aba, setAba] = useState('pocao');
  const [eixo, setEixo] = useState('');
  const t = norm(busca);

  const pocoes = POCOES.filter((p) => (!t || norm(p.nome).includes(t)) && (!eixo || p.eixo === eixo));
  const ingredientes = INGREDIENTES.filter(
    (i) => (!t || norm(i.nome).includes(t)) && (!eixo || i.eixos.includes(eixo)));

  const totalPoc = POCOES.reduce((s, p) => s + (saldos[p.id] || 0), 0);
  const totalIng = INGREDIENTES.reduce((s, i) => s + (saldos[i.id] || 0), 0);

  const eixos = EIXOS_POCAO
    .filter((e) => !eixo || e.id === eixo)
    .map((e) => ({ ...e, itens: pocoes.filter((p) => p.eixo === e.id) }))
    .filter((e) => e.itens.length > 0);

  const g = useGavetas(Boolean(t) || eixos.length === 1);

  // 49 ingredientes de uma vez é muita coisa: mostra aos poucos.
  const [teto, setTeto] = useState(18);
  const visiveis = ingredientes.slice(0, teto);

  return (
    <>
      <div className="sub-abas">
        <button className={`sub-aba ${aba === 'pocao' ? 'ativa' : ''}`} onClick={() => setAba('pocao')}>
          <Icone nome="frasco" tam={14} /> Poções <b className="mono">{nx(totalPoc)}</b>
        </button>
        <button className={`sub-aba ${aba === 'ingrediente' ? 'ativa' : ''}`}
                onClick={() => { setAba('ingrediente'); setTeto(18); }}>
          <Icone nome="pele" tam={14} /> Ingredientes <b className="mono">{nx(totalIng)}</b>
        </button>
      </div>

      <div className="barra-filtros compacta" style={{ marginBottom: 14 }}>
        <Selecao rotulo="Efeito" valor={eixo} aoMudar={setEixo} vazioLabel="Todos"
                 opcoes={EIXOS_POCAO.map((e) => ({ valor: e.id, rotulo: `${e.nome} · ${e.efeito}` }))} />
        {aba === 'pocao' && <BotoesGaveta g={g} ids={eixos.map((e) => e.id)} />}
      </div>

      {aba === 'pocao' ? (
        <Painel titulo="Poções" acoes={<Selo tom="gold">{nx(totalPoc)} frascos</Selo>}>
          <p className="painel-nota">
            Os três eixos que a Guarda consome, nos seis degraus de potência do jogo.
          </p>
          {eixos.length === 0 ? (
            <Vazio simb="🧪">Nenhuma poção corresponde ao filtro.</Vazio>
          ) : eixos.map((e) => {
            const total = e.itens.reduce((s, p) => s + (saldos[p.id] || 0), 0);
            return (
              <Bloco
                key={e.id}
                aberto={g.aberta(e.id)}
                aoAlternar={() => g.alternar(e.id)}
                titulo={<span className="mat-titulo"><i style={{ background: e.cor }} /> Poções de {e.nome}</span>}
                sub={e.efeito}
                acoes={<Selo tom={total ? 'gold' : 'off'}>{total} em estoque</Selo>}
              >
                {e.itens.map((p) => (
                  <LinhaEstoque
                    key={p.id}
                    nome={p.nome}
                    cor={e.cor}
                    saldo={saldos[p.id] || 0}
                    selos={[
                      { texto: p.degrauPt },
                      { texto: `restaura ${p.restaura}`, tom: 'ok' },
                    ]}
                    aoVer={() => aoVer(p)}
                    aoMover={(s) => aoMover(s, p.id)}
                  />
                ))}
              </Bloco>
            );
          })}
        </Painel>
      ) : (
        <Painel
          titulo="Ingredientes"
          acoes={<><Selo tom="gold">{nx(totalIng)} unidades</Selo> <Selo>{ingredientes.length} de {INGREDIENTES.length} tipos</Selo></>}
        >
          <p className="painel-nota">
            Só o que serve para produzir as poções. Um mesmo ingrediente pode servir a mais de
            um efeito — use a busca ou o filtro de efeito para chegar no que precisa.
          </p>
          {ingredientes.length === 0 ? (
            <Vazio simb="🌿">Nenhum ingrediente corresponde ao filtro.</Vazio>
          ) : (
            <>
              <div className="estoque-lista colunas">
                {visiveis.map((i) => (
                  <LinhaEstoque
                    key={i.id}
                    nome={i.nome}
                    saldo={saldos[i.id] || 0}
                    selos={i.eixos.map((x) => ({ texto: EIXO_POR_ID[x].nome, tom: 'roxo' }))}
                    aoVer={() => aoVer(i)}
                    aoMover={(s) => aoMover(s, i.id)}
                  />
                ))}
              </div>
              {ingredientes.length > visiveis.length && (
                <button className="btn ver-mais" onClick={() => setTeto((n) => n + 24)}>
                  Ver mais {Math.min(24, ingredientes.length - visiveis.length)} de {ingredientes.length - visiveis.length} restantes
                </button>
              )}
            </>
          )}
        </Painel>
      )}
    </>
  );
}

/* ============================================================
   Painel 3 — Recursos e Insumos
   ============================================================ */
function PainelRecursos({ saldos, busca, aoMover, aoVer }) {
  const [grupo, setGrupo] = useState('');
  const t = norm(busca);
  const recursos = RECURSOS.filter(
    (r) => (!t || norm(r.nome).includes(t)) && (!grupo || r.grupo === grupo));

  const grupos = GRUPOS_RECURSO
    .filter((x) => !grupo || x.id === grupo)
    .map((x) => ({ ...x, itens: recursos.filter((r) => r.grupo === x.id) }))
    .filter((x) => x.itens.length > 0);

  const g = useGavetas(Boolean(t) || grupos.length === 1);

  return (
    <Painel
      titulo="Recursos e Insumos"
      acoes={<Selo tom="gold">{nx(RECURSOS.reduce((s, r) => s + (saldos[r.id] || 0), 0))} unidades</Selo>}
    >
      <p className="painel-nota">
        O que alimenta a produção: o minério que sai da mina, o lingote que sai da fundição,
        a pele que vira couro e a tira de couro que amarra tudo.
      </p>

      <div className="barra-filtros compacta">
        <Selecao rotulo="Grupo" valor={grupo} aoMudar={setGrupo} vazioLabel="Todos"
                 opcoes={GRUPOS_RECURSO.map((x) => ({ valor: x.id, rotulo: x.nome }))} />
        <BotoesGaveta g={g} ids={grupos.map((x) => x.id)} />
      </div>

      {grupos.length === 0 ? (
        <Vazio simb="⛏">Nenhum recurso corresponde ao filtro.</Vazio>
      ) : grupos.map((x) => {
        const total = x.itens.reduce((s, r) => s + (saldos[r.id] || 0), 0);
        return (
          <Bloco
            key={x.id}
            aberto={g.aberta(x.id)}
            aoAlternar={() => g.alternar(x.id)}
            titulo={<span className="mat-titulo"><Icone nome={x.icone} tam={14} cor="var(--gold)" /> {x.nome}</span>}
            sub={`${x.itens.length} tipos`}
            acoes={<Selo tom={total ? 'gold' : 'off'}>{total} em estoque</Selo>}
          >
            {x.itens.map((r) => (
              <LinhaEstoque
                key={r.id}
                nome={r.nome}
                cor={r.cor}
                saldo={saldos[r.id] || 0}
                selos={[]}
                aoVer={() => aoVer(r)}
                aoMover={(s) => aoMover(s, r.id)}
              />
            ))}
          </Bloco>
        );
      })}
    </Painel>
  );
}

/* ============================================================
   Formulário de entrada / saída / transferência
   ============================================================ */
function FormMovimento({ inicial, saldos, painelAtual, predio, aoFechar, aoSalvar }) {
  const [v, setV] = useState(() => ({ ...inicial }));
  const [filtroPainel, setFiltroPainel] = useState(
    () => ITEM_POR_ID[inicial.item_id]?.painel || painelAtual);
  const [termo, setTermo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: x }));

  const casa = PREDIO_POR_ID[predio];
  const transf = v.sentido === 'transferencia';
  const saida = v.sentido === 'saida' || transf;
  const item = ITEM_POR_ID[v.item_id];
  const saldo = item ? (saldos[item.id] || 0) : 0;
  const qtd = Math.max(1, Number(v.quantidade) || 1);
  const depois = saida ? saldo - qtd : saldo + qtd;
  const excede = saida && qtd > saldo;

  const opcoes = useMemo(() => {
    const t = norm(termo);
    return CATALOGO
      .filter((i) => i.painel === filtroPainel)
      .filter((i) => !t || norm(i.nome).includes(t))
      .filter((i) => !saida || (saldos[i.id] || 0) > 0 || i.id === v.item_id);
  }, [filtroPainel, termo, saida, saldos, v.item_id]);

  const destinos = PREDIOS.filter((p) => p.id !== predio);
  const podeSalvar = Boolean(v.item_id) && qtd > 0 && !excede && !ocupado
    && (!transf || Boolean(v.predio_destino));

  const salvar = async () => {
    if (!podeSalvar) return;
    setOcupado(true);
    try { await aoSalvar({ ...v, quantidade: qtd }); }
    finally { setOcupado(false); }
  };

  const titulo = transf
    ? 'Transferir entre prédios'
    : saida ? 'Registrar saída do almoxarifado' : 'Registrar entrada no almoxarifado';

  return (
    <Modal
      titulo={titulo}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            A data e a hora são as do momento em que você salvar.
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className={`btn ${saida && !transf ? 'perigo' : 'primario'}`} disabled={!podeSalvar}
                  onClick={salvar}>
            {ocupado ? 'Salvando…' : transf ? 'Transferir' : saida ? 'Dar baixa' : 'Dar entrada'}
          </button>
        </>
      }
    >
      <div className="mov-predio">
        <Icone nome={casa?.icone || 'caixa'} tam={15} cor="var(--gold)" />
        <span>
          Lançamento no almoxarifado de <strong>{casa?.nome}</strong>
          {transf && v.predio_destino && (
            <> → <strong>{PREDIO_POR_ID[v.predio_destino]?.nome}</strong></>
          )}
        </span>
      </div>

      {/* Sentido */}
      <div className="troca-sentido">
        <button className={`sentido ${v.sentido === 'entrada' ? 'on entrada' : ''}`}
                onClick={() => setV((o) => ({ ...o, sentido: 'entrada', motivo: '', predio_destino: '' }))}>
          <Icone nome="entrada" tam={15} /> Entrada
        </button>
        <button className={`sentido ${v.sentido === 'saida' ? 'on saida' : ''}`}
                onClick={() => setV((o) => ({ ...o, sentido: 'saida', motivo: '', predio_destino: '' }))}>
          <Icone nome="saidaItem" tam={15} /> Saída
        </button>
        <button className={`sentido ${transf ? 'on transf' : ''}`}
                onClick={() => setV((o) => ({ ...o, sentido: 'transferencia', motivo: 'Transferência' }))}>
          <Icone nome="mapa" tam={15} /> Transferir
        </button>
      </div>

      {/* Escolha do item */}
      <div className="grade g2">
        <Selecao rotulo="Painel" valor={filtroPainel} vazioLabel="—"
                 aoMudar={(x) => { setFiltroPainel(x); setV((o) => ({ ...o, item_id: '' })); }}
                 opcoes={PAINEIS.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
        <Texto rotulo="Filtrar itens" valor={termo} aoMudar={setTermo} placeholder="Digite parte do nome…" />
      </div>

      <Selecao
        rotulo={`Item (${opcoes.length} disponíve${opcoes.length === 1 ? 'l' : 'is'})`}
        valor={v.item_id} aoMudar={set('item_id')} vazioLabel="Escolha o item…"
        opcoes={opcoes.map((i) => ({
          valor: i.id,
          rotulo: `${i.nome} — ${saldos[i.id] || 0} em estoque`,
        }))}
      />

      <div className="grade g2">
        <Texto rotulo="Quantidade" type="number" min="1" valor={v.quantidade} aoMudar={set('quantidade')} />
        {transf ? (
          <Selecao rotulo="Prédio de destino" valor={v.predio_destino} aoMudar={set('predio_destino')}
                   vazioLabel="Para onde vai…"
                   opcoes={destinos.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
        ) : (
          <Selecao rotulo="Motivo" valor={v.motivo} aoMudar={set('motivo')} vazioLabel="—"
                   opcoes={saida ? MOTIVOS_SAIDA : MOTIVOS_ENTRADA} />
        )}
      </div>

      {!transf && (
        <Texto
          rotulo={saida ? 'Destino (quem recebeu)' : 'Origem (de onde veio)'}
          valor={v.destino} aoMudar={set('destino')}
          placeholder={saida ? 'Nome do guarda, posto, patrulha…' : 'Mercador, mina, doação…'}
        />
      )}

      {item && (
        <div className={`mov-resumo ${excede ? 'erro' : saida ? 'saida' : 'entrada'}`}>
          <div className="mov-item">{item.nome}</div>
          <div className="mov-conta">
            <span className="mono">{saldo}</span>
            <span className="seta">{saida ? '−' : '+'}{qtd} →</span>
            <span className="mono forte">{Math.max(0, depois)}</span>
          </div>
          {transf && !excede && (
            <p className="mov-aviso ok">
              Sai de {casa?.nome} e entra em {PREDIO_POR_ID[v.predio_destino]?.nome || 'outro prédio'} —
              dois lançamentos, um em cada livro.
            </p>
          )}
          {excede && (
            <p className="mov-aviso">
              Só há {saldo} em estoque neste prédio. Baixe a quantidade ou registre a entrada que faltou.
            </p>
          )}
        </div>
      )}

      <AreaTexto rotulo="Observação" valor={v.nota} aoMudar={set('nota')} rows={2}
                 placeholder="Opcional — o que a Corte precisa saber sobre este movimento." />
    </Modal>
  );
}

/* ============================================================
   Extrato de um item
   ============================================================ */
function ExtratoItem({ item, predio, saldo, movimentos, outros = [], aoFechar, aoMover }) {
  const linhas = [...movimentos].sort((a, b) => new Date(b.em) - new Date(a.em));
  const entrou = movimentos.filter((m) => m.sentido !== 'saida')
    .reduce((s, m) => s + Number(m.quantidade || 0), 0);
  const saiu = movimentos.filter((m) => m.sentido === 'saida')
    .reduce((s, m) => s + Number(m.quantidade || 0), 0);
  const casa = PREDIO_POR_ID[predio];

  // Onde mais este item está guardado, para não sair comprando à toa.
  const noHold = PREDIOS.map((p) => {
    const sd = calcularSaldos(outros, p.id);
    return { ...p, saldo: sd[item.id] || 0 };
  });

  const selos = [];
  if (item.slot) selos.push({ texto: item.slot });
  if (item.classe) selos.push({ texto: CLASSE_POR_ID[item.classe]?.nome, tom: CLASSE_POR_ID[item.classe]?.tom });
  if (item.material) selos.push({ texto: MATERIAL_POR_ID[item.material]?.nome, tom: 'gold' });
  if (item.tipo) selos.push({ texto: TIPO_ARMA_POR_ID[item.tipo]?.nome });
  if (item.mao) selos.push({ texto: item.mao });
  if (item.eixo) selos.push({ texto: EIXO_POR_ID[item.eixo]?.efeito, tom: 'roxo' });
  if (item.eixos) item.eixos.forEach((e) => selos.push({ texto: EIXO_POR_ID[e].nome, tom: 'roxo' }));
  if (item.grupo) selos.push({ texto: GRUPO_RECURSO_POR_ID[item.grupo]?.nome });

  return (
    <Modal
      titulo={`Extrato — ${item.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            {PAINEL_POR_ID[item.painel]?.nome} · {casa?.nome}
          </span>
          <button className="btn" onClick={() => aoMover('saida')} disabled={saldo <= 0}>
            <Icone nome="saidaItem" tam={14} /> Saída
          </button>
          <button className="btn primario" onClick={() => aoMover('entrada')}>
            <Icone nome="entrada" tam={14} /> Entrada
          </button>
        </>
      }
    >
      <div className="chip-lista" style={{ marginBottom: 12 }}>
        {selos.filter((s) => s.texto).map((s, i) => <Selo key={i} tom={s.tom}>{s.texto}</Selo>)}
        {item.peso != null && <Selo>peso {item.peso}</Selo>}
        {item.valor != null && <Selo>{item.valor} septims</Selo>}
        {item.restaura != null && <Selo tom="ok">restaura {item.restaura}</Selo>}
      </div>

      <div className="grade g3" style={{ marginBottom: 14 }}>
        <Stat rotulo={`Em ${casa?.curto || 'estoque'}`} valor={saldo} tom={saldo > 0 ? 'verde' : 'laranja'} />
        <Stat rotulo="Total que entrou" valor={`+${entrou}`} sub="neste prédio" />
        <Stat rotulo="Total que saiu" valor={`−${saiu}`} sub="neste prédio" />
      </div>

      <div className="extrato-holds">
        {noHold.map((p) => (
          <span key={p.id} className={`extrato-hold ${p.id === predio ? 'aqui' : ''}`}>
            <Icone nome={p.icone} tam={12} cor={p.id === predio ? 'var(--gold)' : 'var(--txt-3)'} />
            {p.curto}
            <b className="mono">{p.saldo}</b>
          </span>
        ))}
      </div>

      {item.base > 0 && (
        <p className="painel-nota" style={{ marginTop: 10 }}>
          Contagem inicial do baú: <strong className="mono">{item.base}</strong>, levantada em{' '}
          {PREDIO_POR_ID[PREDIO_PADRAO]?.nome}. O saldo de cada prédio é o que entrou menos o que
          saiu por lá.
        </p>
      )}

      {linhas.length === 0 ? (
        <Vazio simb="📦">Nenhum movimento deste item neste prédio.</Vazio>
      ) : (
        <div className="tabela-wrap">
          <table style={{ minWidth: 520 }}>
            <thead>
              <tr><th>Quando</th><th>Movimento</th><th>Qtd.</th><th>Motivo</th><th>Quem</th></tr>
            </thead>
            <tbody>
              {linhas.map((m) => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(m.em)}</td>
                  <td>
                    <Selo tom={m.sentido === 'saida' ? 'perigo' : 'ok'} ponto>
                      {m.sentido === 'saida' ? 'Saída' : 'Entrada'}
                    </Selo>
                  </td>
                  <td className="mono">{m.sentido === 'saida' ? '−' : '+'}{m.quantidade}</td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                    {m.motivo || '—'}
                    {m.destino && <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{m.destino}</div>}
                  </td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{m.registrado_por || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
