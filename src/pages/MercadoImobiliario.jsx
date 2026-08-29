import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  anunciarImovel, retirarAnuncio, enviarOferta, retirarOferta, responderOferta,
} from '../lib/db.js';
import { CATEGORIAS_IMOVEL, STATUS_OFERTA_TOM } from '../lib/constants.js';
import {
  categoriaDe, categoriaInfo, avaliacaoDe, precoDe, estaAVenda, noMercado,
  imoveisDe, ofertasDoImovel, abertas, minhasOfertas, ofertasRecebidas,
  podeOfertar, septims,
} from '../lib/imobiliaria.js';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar,
} from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * O Mercado Imobiliário do Hold.
 *
 * Aqui o morador vê o que está à venda — casas, comércios e
 * fortalezas —, propõe pelo que quiser, anuncia o que é dele e
 * responde a quem propôs. O aceite do dono fecha a venda: o imóvel
 * troca de nome na hora e a Corte vê a escritura na Crônica.
 */
export default function MercadoImobiliario({ usuario }) {
  const d = useDados();
  const propriedades = d.propriedades || [];
  const ofertas = d.ofertas || [];

  const [categoria, setCategoria] = useState('casa');
  const [busca, setBusca] = useState('');
  const [fLocal, setFLocal] = useState('');
  const [ofertar, setOfertar] = useState(null);   // imóvel alvo da proposta
  const [anunciar, setAnunciar] = useState(null); // imóvel a anunciar
  const [responder, setResponder] = useState(null); // { oferta, aceitar }
  const [retirar, setRetirar] = useState(null);   // anúncio a retirar
  const [desistir, setDesistir] = useState(null); // proposta minha a retirar
  const [salvo, setSalvo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const relogio = useRef(null);

  const avisar = (texto, ms = 4500) => {
    clearTimeout(relogio.current);
    setSalvo(texto);
    relogio.current = setTimeout(() => setSalvo(''), ms);
  };
  useEffect(() => () => clearTimeout(relogio.current), []);

  const meus = useMemo(() => imoveisDe(usuario, propriedades), [usuario, propriedades]);
  const enviadas = useMemo(() => minhasOfertas(usuario, ofertas), [usuario, ofertas]);
  const recebidas = useMemo(
    () => ofertasRecebidas(usuario, propriedades, ofertas), [usuario, propriedades, ofertas],
  );
  const recebidasAbertas = abertas(recebidas);
  const enviadasAbertas = abertas(enviadas);

  // A vitrine e o número do topo contam a mesma coisa: imóvel
  // arruinado não entra no mercado, e por isso também não conta.
  const emMercado = useMemo(() => noMercado(propriedades), [propriedades]);
  const locais = useMemo(
    () => [...new Set(emMercado.map((p) => p.local).filter(Boolean))].sort(),
    [emMercado],
  );
  const vitrine = useMemo(
    () => noMercado(propriedades, { categoria, busca, local: fLocal }),
    [propriedades, categoria, busca, fLocal],
  );
  const totalAVenda = emMercado.length;
  const porCategoria = (id) => noMercado(propriedades, { categoria: id }).length;

  const comErro = (fn) => async (...args) => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try { await fn(...args); }
    catch (ex) { setErro(ex.message || 'Não foi possível concluir agora.'); await d.recarregar(); }
    finally { setOcupado(false); }
  };

  const fazerOferta = comErro(async (imovel, v) => {
    await enviarOferta(usuario, imovel, v);
    await d.recarregar();
    setOfertar(null);
    avisar(`Proposta enviada ao dono de ${imovel.nome}.`);
  });

  const publicar = comErro(async (imovel, v) => {
    await anunciarImovel(usuario, imovel, v);
    await d.recarregar();
    setAnunciar(null);
    avisar(`${imovel.nome} está no Mercado Imobiliário por ${septims(v.preco)}.`);
  });

  const tirarDoMercado = comErro(async (imovel) => {
    await retirarAnuncio(usuario, imovel);
    await d.recarregar();
    avisar(`${imovel.nome} saiu do mercado.`);
  });

  const decidir = comErro(async (oferta, aceitar, resposta) => {
    const imovel = propriedades.find((p) => p.id === oferta.propriedade_id);
    if (!imovel) throw new Error('Este imóvel não está mais no registro do Hold.');
    await responderOferta(usuario, imovel, oferta, aceitar, resposta);
    await d.recarregar();
    setResponder(null);
    avisar(aceitar
      ? `Venda fechada: ${imovel.nome} passa para ${oferta.comprador}.`
      : `Proposta de ${oferta.comprador} recusada.`);
  });

  const desistirDaOferta = comErro(async (oferta) => {
    await retirarOferta(usuario, oferta);
    await d.recarregar();
    avisar('Proposta retirada.');
  });

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Mercado Imobiliário</h1>
          <p>
            Onde os imóveis do Hold trocam de mão. A Corte cadastra e avalia; o dono anuncia
            pelo preço que quiser; quem se interessa manda proposta. O aceite do dono fecha
            a venda na hora, e a escritura vai para a Crônica da Corte.
          </p>
        </div>
        <div className="acoes">
          {meus.length > 0 && (
            <button className="btn primario" onClick={() => setAnunciar(meus[0])}>
              <Icone nome="moeda" tam={15} /> Anunciar um imóvel meu
            </button>
          )}
        </div>
      </div>
      <div className="regra" />

      {salvo && <div className="aviso-ok"><Icone nome="selo" tam={15} /> {salvo}</div>}
      {erro && <div className="login-erro" style={{ marginBottom: 16 }}>{erro}</div>}

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Imóveis à venda" valor={totalAVenda}
              sub={totalAVenda ? 'no Hold inteiro' : 'nada no mercado'} tom="verde" />
        <Stat rotulo="Meus imóveis" valor={meus.length}
              sub={`${meus.filter(estaAVenda).length} anunciado${meus.filter(estaAVenda).length === 1 ? '' : 's'}`}
              tom="gold" />
        <Stat rotulo="Propostas recebidas" valor={recebidasAbertas.length}
              sub={recebidasAbertas.length ? 'esperando você' : 'nada a responder'}
              tom={recebidasAbertas.length ? 'laranja' : ''} />
        <Stat rotulo="Propostas enviadas" valor={enviadasAbertas.length}
              sub={enviadasAbertas.length ? 'aguardando o dono' : 'nenhuma em pé'} tom="roxo" />
      </div>

      {/* -------- Propostas recebidas -------- */}
      {recebidasAbertas.length > 0 && (
        <>
          <Painel
            titulo="Propostas pelos seus imóveis"
            acoes={<Selo tom="warn" ponto>{recebidasAbertas.length} a responder</Selo>}
          >
            <p className="painel-nota">
              Aceitar transfere o imóvel na hora, e as outras propostas por ele caem junto.
            </p>
            <div className="grade g2">
              {recebidasAbertas.map((o) => {
                const imovel = propriedades.find((p) => p.id === o.propriedade_id);
                const pedido = imovel ? precoDe(imovel) : o.preco_pedido;
                const diferenca = Number(o.valor) - Number(pedido || 0);
                return (
                  <article className="oferta-card" key={o.id}>
                    <header>
                      <Icone nome="moeda" tam={16} cor="var(--gold)" />
                      <h4>{o.propriedade_nome}</h4>
                      <Selo tom="gold">{septims(o.valor)}</Selo>
                    </header>
                    <p className="oferta-de">
                      Proposta de <strong>{o.comprador}</strong>
                      {o.comprador_id_jogo && <span className="mono"> · ID {o.comprador_id_jogo}</span>}
                    </p>
                    <div className="chip-lista">
                      <Selo>Você pede {septims(pedido)}</Selo>
                      {diferenca !== 0 && (
                        <Selo tom={diferenca > 0 ? 'ok' : 'perigo'}>
                          {diferenca > 0 ? '+' : '−'}{septims(Math.abs(diferenca))}
                        </Selo>
                      )}
                      <Selo tom="off">{quando(o.criado_em)}</Selo>
                    </div>
                    {o.mensagem && <p className="oferta-recado">“{o.mensagem}”</p>}
                    <footer>
                      <button className="btn pq perigo" disabled={ocupado}
                              onClick={() => setResponder({ oferta: o, aceitar: false })}>
                        Recusar
                      </button>
                      <button className="btn pq primario" disabled={ocupado}
                              onClick={() => setResponder({ oferta: o, aceitar: true })}>
                        Aceitar e vender
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </Painel>
          <div style={{ height: 16 }} />
        </>
      )}

      {/* -------- Abas das categorias -------- */}
      <div className="abas-painel">
        {CATEGORIAS_IMOVEL.map((c) => (
          <button
            key={c.id}
            className={`aba-painel ${categoria === c.id ? 'ativa' : ''}`}
            onClick={() => { setCategoria(c.id); setBusca(''); }}
          >
            <span className="aba-icone"><Icone nome={c.icone} tam={17} cor="var(--gold)" /></span>
            <span className="aba-txt">
              <strong>{c.nome}</strong>
              <small>{c.resumo}</small>
            </span>
            <span className="aba-num mono">{porCategoria(c.id)}</span>
          </button>
        ))}
      </div>

      <div className="barra-filtros" style={{ marginTop: 16 }}>
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Nome do imóvel, tipo ou dono…" />
        </div>
        <Selecao rotulo="Onde" valor={fLocal} aoMudar={setFLocal} vazioLabel="Todo o Hold"
                 opcoes={locais} />
      </div>

      {vitrine.length === 0 ? (
        <Painel>
          <Vazio simb="⌂">
            Nenhum{categoriaInfo({ categoria }).artigo === 'a' ? 'a' : ''} {' '}
            {CATEGORIAS_IMOVEL.find((c) => c.id === categoria)?.singular.toLowerCase()} à venda
            no momento. Quando um dono anunciar, aparece aqui.
          </Vazio>
        </Painel>
      ) : (
        <div className="grade g2">
          {vitrine.map((p) => {
            const cat = categoriaInfo(p);
            const meu = imoveisDe(usuario, [p]).length > 0;
            const { pode, motivo } = podeOfertar(usuario, p, ofertas);
            const propostas = abertas(ofertasDoImovel(ofertas, p)).length;
            return (
              <article className="imovel-card" key={p.id}>
                <span className="imovel-listra" />
                <header>
                  <span className="imovel-icone"><Icone nome={cat.icone} tam={19} cor="var(--gold)" /></span>
                  <div>
                    <h3>{p.nome}</h3>
                    <span className="imovel-sub">{p.tipo} · {p.local || 'fora dos assentamentos'}</span>
                  </div>
                  <span className="imovel-preco mono">{septims(precoDe(p))}</span>
                </header>

                <div className="chip-lista">
                  <Selo tom="roxo">{cat.singular}</Selo>
                  <Selo>{p.status}</Selo>
                  <Selo tom="off">Avaliação da Corte: {septims(avaliacaoDe(p))}</Selo>
                  {p.proprietario
                    ? <Selo tom="gold">Dono: {p.proprietario}</Selo>
                    : <Selo tom="warn" ponto>Sem dono setado</Selo>}
                  {propostas > 0 && (
                    <Selo tom="laranja">{propostas} proposta{propostas === 1 ? '' : 's'}</Selo>
                  )}
                </div>

                {p.anuncio_nota && <p className="imovel-nota">“{p.anuncio_nota}”</p>}

                <footer>
                  <span className="imovel-desde">Anunciado em {quando(p.anunciada_em)}</span>
                  {meu ? (
                    <>
                      <button className="btn pq fantasma" disabled={ocupado}
                              onClick={() => setRetirar(p)}>Retirar do mercado</button>
                      <button className="btn pq" onClick={() => setAnunciar(p)}>Mudar o preço</button>
                    </>
                  ) : (
                    <button className="btn pq primario" disabled={!pode || ocupado}
                            title={pode ? '' : motivo}
                            onClick={() => setOfertar(p)}>
                      <Icone nome="moeda" tam={13} /> Fazer proposta
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {/* -------- Meus imóveis -------- */}
      {meus.length > 0 && (
        <>
          <div style={{ height: 18 }} />
          <Painel
            titulo="Meus imóveis"
            acoes={<Selo tom="gold">{meus.length} em seu nome</Selo>}
          >
            <p className="painel-nota">
              O que está registrado no seu nome. Anunciar é seu direito de dono — a Corte não
              precisa autorizar a venda, ela só registra o que aconteceu.
            </p>
            <div className="tabela-wrap">
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Imóvel</th><th>Categoria</th><th>Onde</th>
                    <th>Avaliação</th><th>No mercado</th><th className="col-acoes"></th>
                  </tr>
                </thead>
                <tbody>
                  {meus.map((p) => {
                    const propostas = abertas(ofertasDoImovel(ofertas, p)).length;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="nome-forte">{p.nome}</span>
                          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 2 }}>{p.tipo}</div>
                        </td>
                        <td><Selo tom="roxo">{categoriaInfo(p).singular}</Selo></td>
                        <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{p.local || '—'}</td>
                        <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(avaliacaoDe(p))}</td>
                        <td>
                          {estaAVenda(p) ? (
                            <>
                              <Selo tom={p.status === 'Arruinada' ? 'warn' : 'ok'} ponto>
                                À venda por {septims(precoDe(p))}
                              </Selo>
                              {p.status === 'Arruinada' && (
                                <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 3 }}>
                                  fora da vitrine enquanto estiver arruinado
                                </div>
                              )}
                              {propostas > 0 && (
                                <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 3 }}>
                                  {propostas} proposta{propostas === 1 ? '' : 's'} esperando
                                </div>
                              )}
                            </>
                          ) : <Selo tom="off">Fora do mercado</Selo>}
                        </td>
                        <td className="col-acoes">
                          {estaAVenda(p) ? (
                            <>
                              <button className="btn pq" onClick={() => setAnunciar(p)}>Preço</button>{' '}
                              <button className="btn pq fantasma" onClick={() => setRetirar(p)}>Retirar</button>
                            </>
                          ) : (
                            <button className="btn pq primario" onClick={() => setAnunciar(p)}>
                              Pôr à venda
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Painel>
        </>
      )}

      {/* -------- Minhas propostas -------- */}
      {enviadas.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Painel
            titulo="Minhas propostas"
            acoes={enviadasAbertas.length
              ? <Selo tom="warn" ponto>{enviadasAbertas.length} aguardando</Selo>
              : <Selo tom="ok" ponto>Nada em aberto</Selo>}
          >
            <div className="tabela-wrap">
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Imóvel</th><th>Dono</th><th>Minha oferta</th>
                    <th>Quando</th><th>Situação</th><th className="col-acoes"></th>
                  </tr>
                </thead>
                <tbody>
                  {enviadas.slice(0, 20).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span className="nome-forte">{o.propriedade_nome}</span>
                        <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 2 }}>
                          {o.tipo}{o.local ? ` · ${o.local}` : ''}
                        </div>
                      </td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{o.dono || '—'}</td>
                      <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(o.valor)}</td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(o.criado_em)}</td>
                      <td>
                        <Selo tom={STATUS_OFERTA_TOM[o.status]} ponto>{o.status}</Selo>
                        {o.resposta && (
                          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>
                            {o.resposta}
                          </div>
                        )}
                      </td>
                      <td className="col-acoes">
                        {o.status === 'Aberta' && (
                          <button className="btn pq fantasma" onClick={() => setDesistir(o)}>
                            Retirar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </>
      )}

      {/* -------- Modais -------- */}
      {ofertar && (
        <FormOferta
          imovel={ofertar}
          aoFechar={() => setOfertar(null)}
          aoEnviar={(v) => fazerOferta(ofertar, v)}
          ocupado={ocupado}
        />
      )}
      {anunciar && (
        <FormAnuncio
          imoveis={meus}
          inicial={anunciar}
          aoFechar={() => setAnunciar(null)}
          aoAnunciar={(imovel, v) => publicar(imovel, v)}
          ocupado={ocupado}
        />
      )}
      {responder && (
        <FormResposta
          oferta={responder.oferta}
          aceitar={responder.aceitar}
          ocupado={ocupado}
          aoFechar={() => setResponder(null)}
          aoConfirmar={(texto) => decidir(responder.oferta, responder.aceitar, texto)}
        />
      )}
      {retirar && (
        <Confirmar
          mensagem={`Tirar ${retirar.nome} do Mercado Imobiliário? As propostas em aberto por ele são encerradas.`}
          rotulo="Retirar do mercado"
          aoConfirmar={() => tirarDoMercado(retirar)}
          aoFechar={() => setRetirar(null)}
        />
      )}
      {desistir && (
        <Confirmar
          mensagem={`Retirar a sua proposta de ${septims(desistir.valor)} por ${desistir.propriedade_nome}?`}
          rotulo="Retirar proposta"
          aoConfirmar={() => desistirDaOferta(desistir)}
          aoFechar={() => setDesistir(null)}
        />
      )}
    </>
  );
}

/* ============================================================
   Fazer uma proposta
   ============================================================ */
function FormOferta({ imovel, aoFechar, aoEnviar, ocupado }) {
  const pedido = precoDe(imovel);
  const [v, setV] = useState({ valor: String(pedido), mensagem: '' });
  const quanto = Math.max(0, Math.round(Number(v.valor) || 0));
  const diferenca = quanto - pedido;

  return (
    <Modal
      titulo={`Proposta por ${imovel.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span className="taxa-rodape">
            Pedido do dono: <strong>{septims(pedido)}</strong>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!quanto || ocupado}
                  onClick={() => aoEnviar({ valor: quanto, mensagem: v.mensagem })}>
            {ocupado ? 'Enviando…' : 'Enviar proposta'}
          </button>
        </>
      }
    >
      <p className="painel-nota">
        {imovel.tipo} em {imovel.local || 'lugar não assentado'}, de{' '}
        <strong>{imovel.proprietario || 'dono não setado'}</strong>. A proposta vai direto para
        ele — quem aceita ou recusa é o dono, e o aceite transfere o imóvel na hora.
      </p>
      {imovel.anuncio_nota && <p className="perfil-nota-corte">“{imovel.anuncio_nota}”</p>}

      <Texto rotulo="Quanto você oferece (Septims)" type="number" min="1"
             valor={v.valor} aoMudar={(x) => setV((s) => ({ ...s, valor: x }))} />

      {quanto > 0 && (
        <div className={`mov-resumo ${diferenca < 0 ? 'saida' : 'entrada'}`}>
          <div className="mov-item">{imovel.nome}</div>
          <div className="mov-conta">
            <span className="mono">{septims(pedido)}</span>
            <span className="seta">→</span>
            <span className="mono forte">{septims(quanto)}</span>
          </div>
          {diferenca !== 0 && (
            <p className="mov-aviso ok">
              {diferenca > 0
                ? `Você está oferecendo ${septims(diferenca)} acima do pedido.`
                : `Você está oferecendo ${septims(-diferenca)} abaixo do pedido — o dono pode recusar.`}
            </p>
          )}
        </div>
      )}

      <AreaTexto
        rotulo="Recado para o dono (opcional)"
        valor={v.mensagem}
        aoMudar={(x) => setV((s) => ({ ...s, mensagem: x }))}
        placeholder="Por que você quer este imóvel, como pretende pagar, o que oferece junto…"
        maxLength={400}
      />
    </Modal>
  );
}

/* ============================================================
   Anunciar (ou mudar o preço)
   ============================================================ */
function FormAnuncio({ imoveis, inicial, aoFechar, aoAnunciar, ocupado }) {
  const [id, setId] = useState(inicial?.id || imoveis[0]?.id || '');
  const imovel = imoveis.find((p) => p.id === id) || inicial;
  const [v, setV] = useState({
    preco: String(inicial?.preco || avaliacaoDe(inicial)),
    nota: inicial?.anuncio_nota || '',
  });

  /** Trocar de imóvel na lista traz o preço daquele imóvel junto. */
  const trocar = (novo) => {
    setId(novo);
    const p = imoveis.find((x) => x.id === novo);
    if (p) setV({ preco: String(p.preco || avaliacaoDe(p)), nota: p.anuncio_nota || '' });
  };

  const preco = Math.max(0, Math.round(Number(v.preco) || 0));
  const avaliacao = imovel ? avaliacaoDe(imovel) : 0;
  const acima = preco - avaliacao;

  return (
    <Modal
      titulo={imovel && estaAVenda(imovel) ? `Preço de ${imovel.nome}` : 'Pôr um imóvel à venda'}
      aoFechar={aoFechar}
      rodape={
        <>
          <span className="taxa-rodape">
            Avaliação da Corte: <strong>{septims(avaliacao)}</strong>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!preco || !imovel || ocupado}
                  onClick={() => aoAnunciar(imovel, { preco, nota: v.nota })}>
            {ocupado ? 'Anunciando…' : estaAVenda(imovel) ? 'Salvar o preço' : 'Anunciar'}
          </button>
        </>
      }
    >
      <p className="painel-nota">
        O preço é seu para definir — a avaliação da Corte é só referência. Enquanto o anúncio
        estiver de pé, qualquer morador cadastrado pode mandar proposta.
      </p>

      {imoveis.length > 1 && (
        <Selecao
          rotulo="Qual imóvel"
          valor={id}
          aoMudar={trocar}
          opcoes={imoveis.map((p) => ({
            valor: p.id,
            rotulo: `${p.nome} — ${p.tipo}${estaAVenda(p) ? ' · já anunciado' : ''}`,
          }))}
        />
      )}

      <Texto rotulo="Preço pedido (Septims)" type="number" min="1"
             valor={v.preco} aoMudar={(x) => setV((s) => ({ ...s, preco: x }))} />

      {preco > 0 && acima !== 0 && (
        <p className="ajuda">
          <Icone nome="livro" tam={13} /> {acima > 0
            ? `${septims(acima)} acima da avaliação da Corte.`
            : `${septims(-acima)} abaixo da avaliação da Corte.`}
        </p>
      )}

      <AreaTexto
        rotulo="Sobre o imóvel (opcional)"
        valor={v.nota}
        aoMudar={(x) => setV((s) => ({ ...s, nota: x }))}
        placeholder="O que tem dentro, por que está vendendo, o que espera do comprador…"
        maxLength={300}
      />
    </Modal>
  );
}

/* ============================================================
   Aceitar ou recusar uma proposta
   ============================================================ */
function FormResposta({ oferta, aceitar, ocupado, aoFechar, aoConfirmar }) {
  const [texto, setTexto] = useState('');
  return (
    <Modal
      titulo={`${aceitar ? 'Aceitar' : 'Recusar'} — ${oferta.propriedade_nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span className="taxa-rodape">
            Proposta: <strong>{septims(oferta.valor)}</strong>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className={`btn ${aceitar ? 'primario' : 'perigo'}`} disabled={ocupado}
                  onClick={() => aoConfirmar(texto)}>
            {ocupado ? 'Registrando…' : aceitar ? 'Fechar a venda' : 'Recusar a proposta'}
          </button>
        </>
      }
    >
      <p className="painel-nota">
        {aceitar
          ? <>Ao aceitar, <strong>{oferta.propriedade_nome}</strong> passa para{' '}
             <strong>{oferta.comprador}</strong> na hora, sai do mercado e as outras propostas
             por ele são encerradas. A venda fica lavrada na Crônica da Corte.</>
          : <><strong>{oferta.comprador}</strong> é avisado no Quadro de Avisos, com o motivo que
             você escrever. O imóvel continua anunciado.</>}
      </p>
      {oferta.mensagem && <p className="perfil-nota-corte">“{oferta.mensagem}”</p>}
      <AreaTexto
        rotulo={aceitar ? 'Recado para o comprador (opcional)' : 'Motivo (o proponente vai ler)'}
        valor={texto}
        aoMudar={setTexto}
        placeholder={aceitar
          ? 'Onde entregar as chaves, o que fica no imóvel…'
          : 'Por que a proposta não serve.'}
        maxLength={400}
      />
    </Modal>
  );
}
