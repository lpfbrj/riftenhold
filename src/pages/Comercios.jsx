import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  cobrarAquisicaoDeImovel, escriturasPendentes, aprovarTransmissao,
  recusarTransmissao, precoDaEscritura,
} from '../lib/db.js';
import {
  STATUS_PROPRIEDADE, CATEGORIAS_IMOVEL, CATEGORIA_POR_ID, STATUS_OFERTA_TOM,
} from '../lib/constants.js';
import {
  categoriaDe, categoriaInfo, avaliacaoDe, precoDe, estaAVenda,
  daCategoria, resumoDasCategorias, ofertasDoImovel, abertas, septims,
} from '../lib/imobiliaria.js';
import { lerCatalogacao, totalItens } from '../data/itens.js';
import { Catalogo } from '../components/Catalogo.jsx';
import FormPropriedade, { PROPRIEDADE_VAZIA } from '../components/FormPropriedade.jsx';
import {
  Painel, Stat, Selo, Icone, Vazio, Confirmar, Selecao, Modal, AreaTexto, Campo,
} from '../components/ui.jsx';
import { septims as emSeptims, dataOuTraco } from '../lib/tesouraria.js';

const tomStatus = (s) =>
  s === 'Operante' ? 'ok' : s === 'Vaga' ? 'warn' : s === 'Interditada' || s === 'Arruinada' ? 'perigo' : '';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * A Imobiliária da Corte.
 *
 * Todo imóvel do Hold é cadastrado aqui, dividido em casas,
 * comércios e fortalezas. A Corte registra e avalia cada um; a
 * venda em si acontece entre os moradores, no Mercado Imobiliário,
 * e a Corte acompanha o que está anunciado e o que foi proposto.
 */
export default function Comercios({ usuario }) {
  const d = useDados();
  const [categoria, setCategoria] = useState('comercio');
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fLocal, setFLocal] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);

  const propriedades = d.propriedades || [];
  const ofertas = d.ofertas || [];
  const info = CATEGORIA_POR_ID[categoria];

  const resumo = useMemo(() => resumoDasCategorias(propriedades), [propriedades]);
  const daAba = useMemo(() => daCategoria(propriedades, categoria), [propriedades, categoria]);

  const locais = useMemo(
    () => (d.assentamentos || []).map((a) => a.nome),
    [d.assentamentos],
  );

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return daAba
      .filter((p) =>
        (!t || `${p.nome} ${p.proprietario} ${p.organizacao}`.toLowerCase().includes(t)) &&
        (!fTipo || p.tipo === fTipo) &&
        (!fLocal || p.local === fLocal) &&
        (!fStatus || p.status === fStatus))
      .sort((a, b) => (a.local || '').localeCompare(b.local || '') || (a.nome || '').localeCompare(b.nome || ''));
  }, [daAba, busca, fTipo, fLocal, fStatus]);

  const operantes = daAba.filter((p) => p.status === 'Operante').length;
  const semDono = daAba.filter((p) => !p.proprietario?.trim()).length;
  const aVenda = daAba.filter(estaAVenda).length;
  const patrimonio = daAba.reduce((s, p) => s + avaliacaoDe(p), 0);

  // O mercado inteiro, para a Corte acompanhar sem entrar em cada ficha.
  const anunciados = propriedades.filter(estaAVenda);
  const propostasAbertas = abertas(ofertas);

  /**
   * Tirar um imóvel do registro encerra as propostas por ele — sem
   * isso, elas ficariam penduradas sem imóvel e sem ninguém para
   * responder, contando para sempre no quadro do mercado.
   */
  const apagarImovel = async (p) => {
    // Some com o imóvel, some com o que estava pendurado nele: as
    // propostas abertas e também a venda aceita esperando escritura.
    // Deixar uma "Aceita" para trás faria a Corte cobrar a taxa de uma
    // escritura que nunca poderia ser lavrada.
    const pendentesDoImovel = ofertasDoImovel(ofertas, p)
      .filter((o) => ['Aberta', 'Aceita'].includes(o.status));
    for (const o of pendentesDoImovel) {
      if (o.status === 'Aceita') {
        await recusarTransmissao(o, {
          por: usuario?.nome || usuario?.cargo || 'Corte de Riften',
          parecer: 'O imóvel saiu do registro do Hold.',
        }).catch(() => {});
        continue;
      }
      await d.salvar('ofertas', {
        ...o,
        status: 'Recusada',
        resposta: 'O imóvel saiu do registro do Hold.',
        respondido_por: 'Corte de Riften',
        respondido_em: new Date().toISOString(),
      });
    }
    await d.remover('propriedades', p.id, p.nome);
  };

  /** Imóvel novo já nasce na categoria da aba, com o tipo e a base dela. */
  const novoImovel = () => setEdit({
    ...PROPRIEDADE_VAZIA,
    categoria,
    tipo: info.tipos[0],
    valor: info.base,
  });

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Imobiliária do Hold</h1>
          <p>
            O registro de todos os imóveis de Riften — casas, comércios e fortalezas. Aqui a
            Corte cadastra, avalia e diz de quem é cada um. A compra e venda acontece entre os
            moradores, no Mercado Imobiliário.
          </p>
        </div>
        <div className="acoes">
          <button className="btn primario" onClick={novoImovel}>
            <Icone nome="mais" tam={15} /> {info.singular === 'Casa' ? 'Nova casa' : `Novo ${info.singular.toLowerCase()}`}
          </button>
        </div>
      </div>
      <div className="regra" />

      {/* -------- Abas das categorias -------- */}
      <div className="abas-painel">
        {resumo.map((c) => (
          <button
            key={c.id}
            className={`aba-painel ${categoria === c.id ? 'ativa' : ''}`}
            onClick={() => { setCategoria(c.id); setBusca(''); setFTipo(''); }}
          >
            <span className="aba-icone"><Icone nome={c.icone} tam={17} cor="var(--gold)" /></span>
            <span className="aba-txt">
              <strong>{c.nome}</strong>
              <small>{c.aVenda ? `${c.aVenda} à venda · base ${septims(c.base)}` : `base ${septims(c.base)}`}</small>
            </span>
            <span className="aba-num mono">{c.total}</span>
          </button>
        ))}
      </div>

      <div className="grade g4" style={{ margin: '18px 0' }}>
        <Stat rotulo={info.nome} valor={daAba.length} sub={`${propriedades.length} imóveis no Hold`} />
        <Stat rotulo="Operantes" valor={operantes} sub={`${daAba.length - operantes} fora de operação`} tom="verde" />
        <Stat rotulo="Sem proprietário" valor={semDono} sub="aguardando concessão" tom={semDono ? 'laranja' : ''} />
        <Stat rotulo="Patrimônio avaliado" valor={septims(patrimonio)}
              sub={aVenda ? `${aVenda} no mercado` : 'nada anunciado'} tom="roxo" />
      </div>

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Imóvel, dono ou clã…" />
        </div>
        <Selecao rotulo="Tipo" valor={fTipo} aoMudar={setFTipo} opcoes={info.tipos} vazioLabel="Todos" />
        <Selecao rotulo="Local" valor={fLocal} aoMudar={setFLocal} opcoes={locais} vazioLabel="Todos" />
        <Selecao rotulo="Situação" valor={fStatus} aoMudar={setFStatus} opcoes={STATUS_PROPRIEDADE} vazioLabel="Todas" />
      </div>

      {lista.length === 0 ? (
        <Painel><Vazio simb="⌂">Nenhum imóvel desta categoria corresponde ao filtro.</Vazio></Painel>
      ) : (
        <div className="grade g2">
          {lista.map((p) => {
            const cat = lerCatalogacao(p.catalogacao);
            const propostas = abertas(ofertasDoImovel(ofertas, p)).length;
            return (
              <article key={p.id} className="prop-card">
                <header>
                  <Icone nome={categoriaInfo(p).icone} tam={18} cor="var(--gold)" />
                  <h3>{p.nome}</h3>
                  <Selo tom={tomStatus(p.status)} ponto>{p.status}</Selo>
                </header>

                <div className="chip-lista">
                  <Selo>{p.tipo}</Selo>
                  {p.local && <Selo>{p.local}</Selo>}
                  {p.organizacao && <Selo tom="roxo">{p.organizacao}</Selo>}
                  {p.proprietario
                    ? <Selo tom="gold"><Icone nome="pessoa" tam={11} /> {p.proprietario}</Selo>
                    : <Selo tom="warn" ponto>Sem dono setado</Selo>}
                </div>

                <div className="chip-lista">
                  <Selo tom="off">Avaliação: {septims(avaliacaoDe(p))}</Selo>
                  {estaAVenda(p) && <Selo tom="ok" ponto>À venda por {septims(precoDe(p))}</Selo>}
                  {propostas > 0 && (
                    <Selo tom="laranja">{propostas} proposta{propostas === 1 ? '' : 's'}</Selo>
                  )}
                </div>

                {cat.length > 0 && (
                  <div className="prop-cat-bloco">
                    <div className="prop-cat-h">
                      <span>Catalogação</span>
                      <span className="selo gold">{totalItens(cat)} peças · {cat.length} tipos</span>
                    </div>
                    <Catalogo itens={cat} />
                  </div>
                )}

                <footer>
                  <button className="btn pq" onClick={() => setEdit(p)}>
                    <Icone nome="lapis" tam={13} /> Abrir ficha
                  </button>
                  <button className="btn pq perigo" onClick={() => setRem(p)}>
                    <Icone nome="lixo" tam={13} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {/* -------- Escrituras esperando a Corte -------- */}
      <div style={{ height: 18 }} />
      <PainelEscrituras
        dados={d}
        ofertas={d.ofertas || []}
        precos={d.precos || []}
        cobrancas={d.cobrancas || []}
        usuario={usuario}
      />

      {/* -------- O mercado, visto de cima -------- */}
      <div style={{ height: 18 }} />
      <Painel
        titulo="No Mercado Imobiliário"
        acoes={
          <>
            <Selo tom={anunciados.length ? 'ok' : 'off'} ponto>
              {anunciados.length} anunciado{anunciados.length === 1 ? '' : 's'}
            </Selo>{' '}
            <Selo tom={propostasAbertas.length ? 'warn' : 'off'}>
              {propostasAbertas.length} proposta{propostasAbertas.length === 1 ? '' : 's'}
            </Selo>
          </>
        }
      >
        <p className="painel-nota">
          O que os moradores puseram à venda e as propostas em curso. A Corte não decide a
          venda — quem aceita é o dono —, mas toda escritura fechada fica lavrada na Crônica.
        </p>
        {anunciados.length === 0 ? (
          <Vazio simb="⌂">Nenhum imóvel anunciado no momento.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Imóvel</th><th>Categoria</th><th>Dono</th>
                  <th>Avaliação</th><th>Preço pedido</th><th>Propostas</th><th>Desde</th>
                </tr>
              </thead>
              <tbody>
                {anunciados.map((p) => {
                  const doImovel = abertas(ofertasDoImovel(ofertas, p));
                  const maior = doImovel.reduce((s, o) => Math.max(s, Number(o.valor) || 0), 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <button className="nome-forte link-perfil" onClick={() => setEdit(p)}>{p.nome}</button>
                        <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 2 }}>
                          {p.tipo}{p.local ? ` · ${p.local}` : ''}
                        </div>
                      </td>
                      <td><Selo tom="roxo">{categoriaInfo(p).singular}</Selo></td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{p.proprietario || '—'}</td>
                      <td className="mono" style={{ color: 'var(--txt-2)' }}>{septims(avaliacaoDe(p))}</td>
                      <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(precoDe(p))}</td>
                      <td>
                        {doImovel.length === 0
                          ? <span style={{ color: 'var(--txt-3)', fontSize: 12 }}>nenhuma</span>
                          : (
                            <>
                              <Selo tom="warn">{doImovel.length} em aberto</Selo>
                              <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>
                                maior: {septims(maior)}
                              </div>
                            </>
                          )}
                      </td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(p.anunciada_em)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {ofertas.length > 0 && (
          <div className="servos-bloco">
            <h4>Últimas propostas do Hold</h4>
            <div className="tabela-wrap">
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr><th>Imóvel</th><th>Quem propôs</th><th>Valor</th><th>Quando</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {[...ofertas]
                    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
                    .slice(0, 12)
                    .map((o) => (
                      <tr key={o.id}>
                        <td className="nome-forte">{o.propriedade_nome}</td>
                        <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                          {o.comprador}
                          {o.dono && <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>de {o.dono}</div>}
                        </td>
                        <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(o.valor)}</td>
                        <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(o.criado_em)}</td>
                        <td>
                          <Selo tom={STATUS_OFERTA_TOM[o.status]} ponto>{o.status}</Selo>
                          {o.resposta && (
                            <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>{o.resposta}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Painel>

      {edit && (
        <FormPropriedade
          inicial={edit}
          categoriaPadrao={categoria}
          locais={locais}
          organizacoes={(d.clas || []).map((c) => c.nome)}
          civis={d.civis || []}
          aoFechar={() => setEdit(null)}
          aoSalvar={async (v) => {
            // `cobrar_aquisicao` é do formulário, não da ficha: sai daqui
            // e vira cobrança, em vez de virar coluna na propriedade.
            const { cobrar_aquisicao: cobrar, ...ficha } = v;
            const gravada = await d.salvar('propriedades', ficha);
            // Concessão do Palácio a um jogador: o valor pago vira
            // cobrança rastreável, e é a única venda de imóvel que
            // entra no cofre do Hold.
            if (cobrar && gravada?.id) {
              await cobrarAquisicaoDeImovel({ ...ficha, id: gravada.id }, {
                valor: cobrar,
                autor: usuario?.nome || usuario?.cargo || 'Corte',
              });
              await d.recarregar();
            }
            setEdit(null);
          }}
          aoRemover={(p) => { setEdit(null); setRem(p); }}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Remover ${rem.nome} do registro de imóveis?${
            abertas(ofertasDoImovel(ofertas, rem)).length
              ? ' As propostas em aberto por ele são encerradas.' : ''}`}
          aoConfirmar={() => apagarImovel(rem)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ============================================================
   ESCRITURAS — o pedaço da venda entre jogadores que é da Corte

   O dono aceitou a proposta, mas o imóvel só troca de dono quando a
   Corte lavra. Ela pode lavrar de graça ou cobrar a taxa de
   transmissão — e, havendo taxa, a propriedade passa quando o
   pagamento for confirmado, não antes.
   ============================================================ */
function PainelEscrituras({ dados: d, ofertas, precos, cobrancas = [], usuario }) {
  const [lavrar, setLavrar] = useState(null);
  const [recusar, setRecusar] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const autor = usuario?.nome || usuario?.cargo || 'Corte de Riften';
  const fila = useMemo(() => escriturasPendentes(ofertas), [ofertas]);
  const taxaPadrao = precoDaEscritura(precos);

  const proteger = async (fn) => {
    setOcupado(true);
    setErro('');
    try { await fn(); }
    catch (e) { setErro(e.message || 'Não consegui concluir.'); }
    finally {
      await d.recarregar().catch(() => {});
      setOcupado(false);
    }
  };

  return (
    <>
      <Painel
        titulo={`Escrituras a lavrar · ${fila.length}`}
        acoes={fila.length > 0 && <Selo tom="warn" ponto>{fila.length} aguardando</Selo>}
      >
        <p className="painel-nota">
          Venda entre jogadores é negócio deles — mas quem passa a propriedade é a Corte.
          Aqui ela lavra a escritura, cobrando ou não a taxa de transmissão. Com taxa, o
          imóvel só muda de nome depois que o pagamento é confirmado na Tesouraria.
        </p>
        {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

        {fila.length === 0 ? (
          <Vazio simb="◈">Nenhuma venda esperando escritura.</Vazio>
        ) : (
          <div className="lista-divisoes">
            {fila.map((o) => {
              // Uma taxa lavrada e depois cancelada não pode deixar a
              // venda presa: o que trava o botão é a cobrança viva, não
              // a lembrança de que um dia houve uma.
              const taxa = o.cobranca_id
                ? cobrancas.find((c) => c.id === o.cobranca_id)
                : null;
              const esperandoPagamento = Boolean(taxa) && taxa.status !== 'Cancelada';
              return (
              <article className="divisao-linha" key={o.id}>
                <span className="divisao-marca" style={{ background: 'var(--gold)' }}>
                  <Icone nome="selo" tam={15} cor="#15120c" />
                </span>
                <div className="divisao-corpo">
                  <h4>{o.propriedade_nome} <Selo tom="gold">{emSeptims(o.valor)}</Selo></h4>
                  <p>
                    {o.dono || 'sem dono registrado'} vendeu a {o.comprador}.
                    {o.respondido_em ? ` Aceite em ${dataOuTraco(o.respondido_em)}.` : ''}
                    {esperandoPagamento
                      ? ` A taxa ${taxa.numero} foi lavrada e aguarda pagamento na Tesouraria.`
                      : taxa ? ' A taxa foi cancelada — pode lavrar de novo.' : ''}
                  </p>
                </div>
                <div className="divisao-acoes">
                  <button className="btn pq primario" disabled={ocupado || esperandoPagamento}
                          title={esperandoPagamento
                            ? 'A escritura sai quando a Tesouraria confirmar o pagamento da taxa'
                            : 'Lavrar a escritura'}
                          onClick={() => setLavrar({ oferta: o, taxa: taxaPadrao })}>
                    Lavrar
                  </button>
                  <button className="btn pq perigo" disabled={ocupado}
                          onClick={() => setRecusar(o)}>
                    Recusar
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </Painel>

      {lavrar && (
        <FormEscritura
          inicial={lavrar}
          aoFechar={() => setLavrar(null)}
          aoLavrar={async (taxa) => {
            await proteger(() => aprovarTransmissao(lavrar.oferta, { taxa, por: autor }));
            setLavrar(null);
          }}
        />
      )}
      {recusar && (
        <Confirmar
          mensagem={`Recusar a escritura de ${recusar.propriedade_nome}? A venda não acontece e o imóvel continua com ${recusar.dono || 'o dono atual'}.`}
          rotulo="Recusar escritura"
          aoConfirmar={() => proteger(() => recusarTransmissao(recusar, { por: autor }))}
          aoFechar={() => setRecusar(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormEscritura({ inicial, aoFechar, aoLavrar }) {
  const [taxa, setTaxa] = useState(inicial.taxa);
  const [ocupado, setOcupado] = useState(false);
  const quanto = Math.max(0, Math.round(Number(taxa) || 0));
  const { oferta } = inicial;

  return (
    <Modal
      titulo={`Escritura — ${oferta.propriedade_nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado}
                  onClick={async () => { setOcupado(true); await aoLavrar(quanto); }}>
            {ocupado ? 'Lavrando…' : quanto ? 'Cobrar a taxa' : 'Lavrar sem taxa'}
          </button>
        </>
      }
    >
      <div className="chip-lista" style={{ marginBottom: 14 }}>
        <Selo tom="gold">{emSeptims(oferta.valor)}</Selo>
        <Selo>{oferta.dono} → {oferta.comprador}</Selo>
      </div>
      <Campo rotulo="Taxa de transmissão (Septims)">
        <input type="number" min="0" className="mono" value={taxa ?? ''}
               onChange={(e) => setTaxa(e.target.value)} autoFocus />
      </Campo>
      <p className="painel-nota" style={{ margin: '8px 0 0' }}>
        {quanto
          ? `Nasce uma cobrança de ${emSeptims(quanto)} em nome de ${oferta.comprador}. `
            + 'O imóvel passa para ele quando a Tesouraria confirmar o pagamento.'
          : 'Sem taxa, a escritura é lavrada agora e o imóvel passa na hora para '
            + `${oferta.comprador}.`}
      </p>
    </Modal>
  );
}
