import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { pedirCompra, ehDonoDaPropriedade, ehFuncionario } from '../lib/db.js';
import { septims } from './Propriedades.jsx';
import { Painel, Stat, Selo, Modal, AreaTexto, Selecao, Icone, Vazio, Pips } from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

const TOM_PEDIDO = { Aberto: 'warn', Aceito: 'roxo', Concluído: 'ok', Recusado: 'perigo' };

/**
 * A cidade vista de fora do balcão.
 *
 * O morador vê o que cada comércio tem à venda, quem é o dono e quem
 * atende ali, escolhe as quantidades e manda o pedido. Quem recebe é
 * o dono, na tela de Propriedades dele.
 */
export default function ComerciosCidade({ usuario }) {
  const d = useDados();
  const [busca, setBusca] = useState('');
  const [fLocal, setFLocal] = useState('');
  const [pedir, setPedir] = useState(null);

  const abertos = useMemo(() => (d.propriedades || [])
    // Casa interditada ou arruinada não atende — a mesma regra dos editais.
    .filter((p) => p.status !== 'Interditada' && p.status !== 'Arruinada')
    .filter((p) => (p.estoque || []).some((i) => (Number(i.quantidade) || 0) > 0))
    .filter((p) => !fLocal || p.local === fLocal)
    .filter((p) => {
      const t = busca.trim().toLowerCase();
      if (!t) return true;
      return `${p.nome} ${p.proprietario} ${p.local}`.toLowerCase().includes(t) ||
        (p.estoque || []).some((i) => String(i.nome).toLowerCase().includes(t));
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')), [d.propriedades, busca, fLocal]);

  const meus = (d.pedidos_compra || [])
    .filter((x) => x.comprador_civil_id === usuario.civil_id)
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  const meusAbertos = meus.filter((x) => x.status === 'Aberto');

  const locais = [...new Set((d.propriedades || []).map((p) => p.local).filter(Boolean))].sort();
  // Os números do topo falam do Hold inteiro; os filtros mexem só na vitrine.
  const todosAbertos = (d.propriedades || []).filter(
    (p) => p.status !== 'Interditada' && p.status !== 'Arruinada' &&
           (p.estoque || []).some((i) => (Number(i.quantidade) || 0) > 0));
  const itensAVenda = todosAbertos.reduce(
    (s, p) => s + (p.estoque || []).filter((i) => (Number(i.quantidade) || 0) > 0).length, 0);

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Comércios da cidade</h1>
          <p>
            O que os comércios de Riften têm à venda. Escolha o que quer e mande o pedido —
            quem toca a casa recebe, e você é avisado no Quadro de Avisos quando responderem.
          </p>
        </div>
      </div>
      <div className="regra" />

      <div className="grade g3" style={{ marginBottom: 18 }}>
        <Stat rotulo="Comércios abertos" valor={todosAbertos.length} sub="com algo em estoque" tom="verde" />
        <Stat rotulo="Itens à venda" valor={itensAVenda} sub="no Hold inteiro" tom="roxo" />
        <Stat rotulo="Seus pedidos" valor={meus.length}
              sub={meusAbertos.length ? `${meusAbertos.length} aguardando resposta` : 'nada em aberto'}
              tom={meusAbertos.length ? 'laranja' : ''} />
      </div>

      {/* -------- Meus pedidos -------- */}
      {meus.length > 0 && (
        <>
          <Painel
            titulo="Meus pedidos"
            acoes={meusAbertos.length
              ? <Selo tom="warn" ponto>{meusAbertos.length} aguardando</Selo>
              : <Selo tom="ok" ponto>Nada em aberto</Selo>}
          >
            <div className="tabela-wrap">
              <table style={{ minWidth: 700 }}>
                <thead>
                  <tr><th>Comércio</th><th>Itens</th><th>Total</th><th>Quando</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {meus.slice(0, 20).map((x) => (
                    <tr key={x.id}>
                      <td>
                        <span className="nome-forte">{x.propriedade_nome}</span>
                        <div style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>{x.local}</div>
                      </td>
                      <td>
                        {(x.itens || []).map((i, k) => (
                          <div key={k} style={{ fontSize: 12.5, color: 'var(--txt-2)' }}>
                            <span className="mono">{i.quantidade}×</span> {i.nome}
                          </div>
                        ))}
                      </td>
                      <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(x.total)}</td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(x.criado_em)}</td>
                      <td>
                        <Selo tom={TOM_PEDIDO[x.status]} ponto>{x.status}</Selo>
                        {x.atendido_por && (
                          <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>
                            {x.status === 'Aceito' && `procure ${x.atendido_por}`}
                            {x.status === 'Concluído' && `entregue por ${x.concluido_por || x.atendido_por}`}
                            {x.status === 'Recusado' && `por ${x.atendido_por}`}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meus.length > 20 && (
              <p className="painel-nota" style={{ margin: '10px 0 0' }}>
                Mostrando os 20 pedidos mais recentes, de {meus.length}.
              </p>
            )}
          </Painel>
          <div style={{ height: 16 }} />
        </>
      )}

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Comércio, dono ou item…" />
        </div>
        <Selecao rotulo="Onde" valor={fLocal} aoMudar={setFLocal} opcoes={locais} vazioLabel="Todo o Hold" />
      </div>

      {abertos.length === 0 ? (
        <Painel>
          <Vazio simb="⚖">
            Nenhum comércio com estoque no momento. Quando um dono cadastrar itens, eles
            aparecem aqui.
          </Vazio>
        </Painel>
      ) : (
        <div className="grade g2">
          {abertos.map((p) => {
            const meu = ehDonoDaPropriedade(usuario, p) || ehFuncionario(usuario, p);
            const itens = (p.estoque || []).filter((i) => (Number(i.quantidade) || 0) > 0);
            return (
              <article className="loja-card" key={p.id}>
                <header>
                  <span className="loja-icone"><Icone nome="moeda" tam={19} cor="var(--gold)" /></span>
                  <div>
                    <h3>{p.nome}</h3>
                    <span className="loja-sub">
                      {p.tipo} · {p.local}
                      {p.proprietario ? <> · de <b>{p.proprietario}</b></> : <> · <i>sem dono setado</i></>}
                    </span>
                  </div>
                  {meu && <Selo tom="roxo">sua casa</Selo>}
                </header>

                {(p.funcionarios || []).length > 0 && (
                  <div className="loja-equipe">
                    <span className="loja-rot">Quem atende</span>
                    <div className="chip-lista">
                      {(p.funcionarios || []).map((f, k) => (
                        <span className="selo" key={k}>
                          {f.nome}{f.funcao ? ` · ${f.funcao}` : ''}
                          {f.profissao && <> <Pips nivel={f.nivel} /></>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="loja-itens">
                  <span className="loja-rot">À venda</span>
                  {itens.map((i, k) => (
                    <div className="loja-item" key={k}>
                      <span className="li-nome">{i.nome}</span>
                      <span className="li-qtd mono">{i.quantidade} em estoque</span>
                      <span className="li-valor mono">{septims(i.valor)}</span>
                    </div>
                  ))}
                </div>

                <footer>
                  <button className="btn pq primario" onClick={() => setPedir(p)}>
                    <Icone nome="pergaminho" tam={13} /> Solicitar pedido
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {pedir && (
        <FormPedido
          prop={pedir}
          aoFechar={() => setPedir(null)}
          aoEnviar={async (itens, obs) => {
            await pedirCompra(usuario, pedir, itens, obs);
            await d.recarregar();
            setPedir(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormPedido({ prop, aoFechar, aoEnviar }) {
  const disponiveis = (prop.estoque || []).filter((i) => (Number(i.quantidade) || 0) > 0);
  const [qtd, setQtd] = useState(() => disponiveis.map(() => 0));
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const escolhidos = disponiveis
    .map((i, k) => ({ nome: i.nome, valor: Number(i.valor) || 0, quantidade: Number(qtd[k]) || 0 }))
    .filter((i) => i.quantidade > 0);
  const total = escolhidos.reduce((s, i) => s + i.quantidade * i.valor, 0);

  const mudar = (k, max, valor) => {
    const n = Math.max(0, Math.min(max, Number(valor) || 0));
    setQtd((s) => s.map((x, j) => (j === k ? n : x)));
  };

  const enviar = async () => {
    setErro('');
    setOcupado(true);
    try { await aoEnviar(escolhidos, obs); }
    catch (ex) { setErro(ex.message || 'Não foi possível enviar o pedido.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo={`Pedido — ${prop.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--gold-2)', fontSize: 13 }}>
            Total: <strong className="mono">{septims(total)}</strong>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={escolhidos.length === 0 || ocupado} onClick={enviar}>
            {ocupado ? 'Enviando…' : 'Enviar pedido'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      <p style={{ marginTop: 0, color: 'var(--txt-2)', fontSize: 13, lineHeight: 1.6 }}>
        {prop.proprietario ? <>Casa de <strong>{prop.proprietario}</strong>, em {prop.local}. </> : <>Em {prop.local}. </>}
        Escolha as quantidades — o limite é o que há em estoque. Quem atende recebe o pedido
        e responde; você fica sabendo pelo Quadro de Avisos.
      </p>

      <div className="tabela-wrap">
        <table style={{ minWidth: 460 }}>
          <thead>
            <tr><th>Item</th><th>Preço</th><th>Em estoque</th><th style={{ width: 120 }}>Quero</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            {disponiveis.map((i, k) => {
              const max = Number(i.quantidade) || 0;
              const n = Number(qtd[k]) || 0;
              return (
                <tr key={`${i.nome}-${k}`} className={n > 0 ? 'linha-pendente' : ''}>
                  <td><span className="nome-forte">{i.nome}</span></td>
                  <td className="mono" style={{ color: 'var(--txt-2)' }}>{septims(i.valor)}</td>
                  <td className="mono" style={{ color: 'var(--txt-3)' }}>{max}</td>
                  <td>
                    <input className="cel-input mono" type="number" min="0" max={max} value={n}
                           onChange={(e) => mudar(k, max, e.target.value)} />
                  </td>
                  <td className="mono" style={{ color: n ? 'var(--gold-2)' : 'var(--txt-3)' }}>
                    {septims(n * (Number(i.valor) || 0))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Recado para quem atende (opcional)" valor={obs} aoMudar={setObs} rows={2}
                 placeholder="Quando você passa lá, combinação de preço, o que for." />
    </Modal>
  );
}
