import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  minhasPropriedades, ehDonoDaPropriedade, salvarPropriedadePropria, decidirPedidoCompra,
} from '../lib/db.js';
import { PROFISSOES, NIVEIS } from '../lib/constants.js';
import { recadoPara } from './Avisos.jsx';
import SeletorCivil from '../components/SeletorCivil.jsx';
import {
  Painel, Stat, Selo, Modal, AreaTexto, Icone, Vazio, Pips, Confirmar,
} from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

export const septims = (n) => `${Number(n || 0).toLocaleString('pt-BR')} Septims`;

/** Chave só de interface: sem ela, demitir alguém do meio embaralha os campos. */
let contadorChave = 0;
const chaveNova = () => `k${(contadorChave += 1)}`;

/* Aberto → Aceito → Concluído. "Aceito" é palavra dada; o estoque só baixa
   quando a entrega acontece de fato no jogo e alguém aperta Concluir. */
const TOM_PEDIDO = { Aberto: 'warn', Aceito: 'roxo', Concluído: 'ok', Recusado: 'perigo' };

/** Deixa o estoque no formato do banco: sem linha vazia, sem número em texto. */
const saneado = (estoque) => (estoque || [])
  .filter((i) => String(i?.nome || '').trim())
  .map((i) => ({
    nome: String(i.nome).trim(),
    quantidade: Math.max(0, Number(i.quantidade) || 0),
    valor: Math.max(0, Number(i.valor) || 0),
  }));

/** Confere se o estoque cobre um pedido e devolve a lista já com a baixa feita. */
function baixarEstoque(estoque, itens) {
  const restante = [...(estoque || [])].map((i) => ({ ...i }));
  for (const it of itens || []) {
    const linha = restante.find(
      (x) => String(x.nome).trim().toLowerCase() === String(it.nome).trim().toLowerCase(),
    );
    const tem = Math.max(0, Number(linha?.quantidade) || 0);
    if (!linha || Number(it.quantidade) > tem) {
      throw new Error(`Não há ${it.quantidade} de ${it.nome} em estoque — restam ${tem}.`);
    }
    linha.quantidade = tem - Number(it.quantidade);
  }
  return restante;
}

/**
 * A propriedade na mão de quem toca o negócio.
 *
 * Dono e funcionários entram aqui. O dono contrata e demite; ambos mexem
 * no estoque e atendem os pedidos que os moradores mandam. Nome, tipo,
 * local e dono da propriedade continuam sendo registro da Corte.
 */
export default function Propriedades({ usuario }) {
  const d = useDados();
  const props = useMemo(
    () => minhasPropriedades(usuario, d.propriedades || []),
    [usuario, d.propriedades],
  );

  const [aberta, setAberta] = useState(null);          // id da propriedade em foco
  const [funcionarios, setFuncionarios] = useState(null);
  const [estoque, setEstoque] = useState(null);
  const [recusar, setRecusar] = useState(null);
  const [salvo, setSalvo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');   // id do pedido em processamento
  const relogio = useRef(null);

  const avisar = (t, ms = 4500) => {
    clearTimeout(relogio.current);
    setSalvo(t);
    relogio.current = setTimeout(() => setSalvo(''), ms);
  };
  useEffect(() => () => clearTimeout(relogio.current), []);

  if (props.length === 0) {
    return (
      <Painel titulo="Nenhuma propriedade sua">
        <Vazio simb="⌂">
          Você não é dono nem funcionário de nenhuma propriedade do Hold. Quem registra o
          dono de um comércio é a Corte.
        </Vazio>
      </Painel>
    );
  }

  const prop = props.find((p) => p.id === aberta) || props[0];
  const dono = ehDonoDaPropriedade(usuario, prop);
  const equipeDaCasa = (prop.funcionarios || []).map((x, i) => ({ _k: `f${i}`, ...x }));

  const vFunc = funcionarios !== null ? funcionarios : equipeDaCasa;
  const vEst = estoque !== null ? estoque : (prop.estoque || []);
  const mexeu = funcionarios !== null || estoque !== null;

  const trocar = (id) => { setAberta(id); setFuncionarios(null); setEstoque(null); setErro(''); };
  const descartar = () => { setFuncionarios(null); setEstoque(null); setErro(''); };

  const pedidos = (d.pedidos_compra || []).filter((x) => x.propriedade_id === prop.id);
  const abertos = pedidos.filter((x) => x.status === 'Aberto');
  const naMao = pedidos.filter((x) => x.status === 'Aceito');

  /* O lucro é o que já foi entregue — pedido aceito ainda é promessa. */
  const vendas = pedidos
    .filter((x) => x.status === 'Concluído')
    .sort((a, b) => new Date(b.concluido_em || b.respondido_em) - new Date(a.concluido_em || a.respondido_em));
  const lucro = vendas.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const pecasVendidas = vendas.reduce(
    (s, x) => s + (x.itens || []).reduce((t, i) => t + (Number(i.quantidade) || 0), 0), 0);
  const aReceber = naMao.reduce((s, x) => s + (Number(x.total) || 0), 0);

  const salvar = async () => {
    setErro('');
    try {
      await salvarPropriedadePropria(usuario, prop, { funcionarios: vFunc, estoque: vEst });
      await d.recarregar();
      descartar();
      avisar(`${prop.nome} foi atualizada.`);
    } catch (ex) { setErro(ex.message || 'Não foi possível salvar agora.'); }
  };

  /**
   * Atender um pedido. Aceitar é dar a palavra: o comprador recebe o recado
   * dizendo com quem falar e onde. O estoque não se mexe aqui — a mercadoria
   * só sai da prateleira em `concluir`, depois que a entrega aconteceu no jogo.
   */
  const responder = async (pedido, status, motivo = '') => {
    setErro('');
    if (ocupado) return;
    if (pedido.status !== 'Aberto') { setErro('Este pedido já foi respondido.'); return; }
    setOcupado(pedido.id);
    try {
      // Aceitar sem ter o que entregar não ajuda ninguém: conferimos agora,
      // mesmo sem baixar nada ainda.
      if (status === 'Aceito') baixarEstoque(prop.estoque, pedido.itens);

      const lista = (pedido.itens || []).map((i) => `${i.quantidade}× ${i.nome}`).join(', ');
      await decidirPedidoCompra(usuario, prop, {
        pedido,
        patch: {
          status,
          atendido_por: usuario.nome,
          atendido_por_civil_id: usuario.civil_id || '',
          resposta: motivo,
          respondido_em: new Date().toISOString(),
        },
        avisos: pedido.comprador_civil_id ? [recadoPara(
          pedido.comprador_civil_id,
          status === 'Aceito'
            ? `Seu pedido em ${pedido.propriedade_nome} foi aceito`
            : `Seu pedido em ${pedido.propriedade_nome} foi recusado`,
          status === 'Aceito'
            ? `Procure ${usuario.nome} em ${pedido.propriedade_nome}, em ${pedido.local}, `
              + `para retirar: ${lista}. Total combinado: ${septims(pedido.total)}.`
              + (motivo ? ` Recado: ${motivo}` : '')
            : `${usuario.nome} recusou o seu pedido de ${lista} em ${pedido.propriedade_nome}.`
              + (motivo ? ` Motivo: ${motivo}` : ''),
          usuario.nome,
        )] : [],
      });
      await d.recarregar();
      avisar(status === 'Aceito'
        ? `Pedido aceito. ${pedido.comprador} foi avisado para procurar você em ${prop.nome}. `
          + 'Depois da entrega no jogo, aperte Concluir para dar baixa no estoque.'
        : `Pedido recusado. ${pedido.comprador} foi avisado.`);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível responder agora.');
    } finally {
      setOcupado('');
    }
  };

  /**
   * Concluir: a entrega aconteceu no jogo. Só agora a mercadoria sai do
   * estoque, o pedido vira venda fechada e o valor entra no lucro da casa.
   */
  const concluir = async (pedido) => {
    setErro('');
    if (ocupado) return;
    if (pedido.status !== 'Aceito') { setErro('Só um pedido aceito pode ser concluído.'); return; }
    setOcupado(pedido.id);
    try {
      // A baixa sai do que está na tela: se o dono mexeu no estoque e ainda
      // não salvou, concluir não pode devolver as peças à prateleira.
      const restante = baixarEstoque(vEst, pedido.itens);
      const lista = (pedido.itens || []).map((i) => `${i.quantidade}× ${i.nome}`).join(', ');
      await decidirPedidoCompra(usuario, prop, {
        pedido,
        patch: {
          status: 'Concluído',
          concluido_por: usuario.nome,
          concluido_por_civil_id: usuario.civil_id || '',
          concluido_em: new Date().toISOString(),
        },
        estoque: saneado(restante),
        avisos: pedido.comprador_civil_id ? [recadoPara(
          pedido.comprador_civil_id,
          `Compra concluída em ${pedido.propriedade_nome}`,
          `${usuario.nome} deu baixa na entrega de ${lista}, em ${pedido.propriedade_nome} `
          + `(${pedido.local}). Valor: ${septims(pedido.total)}. Negócio encerrado.`,
          usuario.nome,
        )] : [],
      });
      await d.recarregar();

      // O rascunho acompanha a baixa; o resto do que ele estava editando fica.
      if (estoque !== null) setEstoque(restante);
      avisar(`Pedido concluído. ${septims(pedido.total)} entraram no lucro de ${prop.nome}.`);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível concluir agora.');
    } finally {
      setOcupado('');
    }
  };

  // ---- edição das listas ----
  const setF = (i, k, v) => setFuncionarios(vFunc.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addF = () => setFuncionarios([...vFunc,
    { _k: chaveNova(), nome: '', civil_id: '', id_jogo: '', profissao: '', nivel: 'Novato', funcao: '' }]);
  const delF = (i) => setFuncionarios(vFunc.filter((_, j) => j !== i));
  const ligarF = (i, c) => setFuncionarios(vFunc.map((x, j) => (j === i
    ? { ...x, nome: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '',
      profissao: c.profissao || x.profissao, nivel: c.nivel || x.nivel }
    : x)));

  const setI = (i, k, v) => setEstoque(vEst.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addI = () => setEstoque([...vEst, { nome: '', quantidade: 1, valor: 0 }]);
  const delI = (i) => setEstoque(vEst.filter((_, j) => j !== i));

  const valorEstoque = vEst.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor) || 0), 0);

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>{prop.nome}</h1>
          <p>
            {dono
              ? 'Sua propriedade. Contrate quem trabalha aqui, mantenha o estoque com os preços e atenda os pedidos dos moradores.'
              : 'Você trabalha aqui. Pode cuidar do estoque e atender os pedidos dos moradores.'}
          </p>
        </div>
        <div className="acoes">
          <Selo tom={dono ? 'gold' : 'roxo'}>{dono ? 'Você é o dono' : 'Funcionário'}</Selo>
        </div>
      </div>
      <div className="regra" />

      {props.length > 1 && (
        <div className="abas-painel" style={{ marginBottom: 16 }}>
          {props.map((x) => (
            <button key={x.id} className={`aba-painel ${x.id === prop.id ? 'ativa' : ''}`}
                    onClick={() => trocar(x.id)}>
              <span className="aba-icone"><Icone nome="casa" tam={17} cor="var(--gold)" /></span>
              <span className="aba-txt">
                <strong>{x.nome}</strong>
                <small>{x.tipo} · {x.local}</small>
              </span>
              <span className="aba-num mono">
                {(d.pedidos_compra || []).filter((y) => y.propriedade_id === x.id && y.status === 'Aberto').length || ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {salvo && <div className="aviso-ok"><Icone nome="selo" tam={15} /> {salvo}</div>}
      {erro && <div className="login-erro" style={{ marginBottom: 16 }}>{erro}</div>}

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Pedidos abertos" valor={abertos.length}
              sub={abertos.length ? 'aguardando você' : 'nada na fila'}
              tom={abertos.length ? 'laranja' : ''} />
        <Stat rotulo="A entregar" valor={naMao.length}
              sub={naMao.length ? `${septims(aReceber)} combinados` : 'nada aceito em aberto'}
              tom={naMao.length ? 'roxo' : ''} />
        <Stat rotulo="Lucro" valor={septims(lucro)}
              sub={`${vendas.length} venda${vendas.length === 1 ? '' : 's'} concluída${vendas.length === 1 ? '' : 's'}`}
              tom="verde" />
        <Stat rotulo="Valor do estoque" valor={septims(valorEstoque)} sub="a preço de tabela" tom="roxo" />
      </div>

      {/* -------- Pedidos -------- */}
      <Painel
        titulo="Pedidos dos moradores"
        acoes={abertos.length
          ? <Selo tom="warn" ponto>{abertos.length} aberto{abertos.length === 1 ? '' : 's'}</Selo>
          : <Selo tom="ok" ponto>Nada aberto</Selo>}
      >
        <p className="painel-nota">
          Quem pede vê o seu estoque na aba <strong>Comércios</strong> e escolhe a quantidade.
          <strong> Aceitar</strong> manda um recado ao comprador pedindo que procure você aqui
          em {prop.nome}, em {prop.local}. Feita a entrega dentro do jogo, aperte
          <strong> Concluir</strong>: só então o estoque baixa e o valor entra no lucro da casa.
        </p>
        {pedidos.length === 0 ? (
          <Vazio simb="⚖">Nenhum pedido ainda.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 760 }}>
              <thead>
                <tr><th>Quem pediu</th><th>Itens</th><th>Total</th><th>Quando</th>
                  <th>Situação</th><th className="col-acoes"></th></tr>
              </thead>
              <tbody>
                {[...pedidos].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).map((x) => (
                  <tr key={x.id} className={x.status === 'Aberto' ? 'linha-pendente' : ''}>
                    <td>
                      <span className="nome-forte">{x.comprador}</span>
                      {x.comprador_id_jogo && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                          ID {x.comprador_id_jogo}
                        </div>
                      )}
                      {x.observacao && <div className="pendente-nota">“{x.observacao}”</div>}
                    </td>
                    <td>
                      {(x.itens || []).map((i, k) => (
                        <div key={k} style={{ fontSize: 12.5, color: 'var(--txt-2)' }}>
                          <span className="mono">{i.quantidade}×</span> {i.nome}
                          <span style={{ color: 'var(--txt-3)' }}> · {septims(i.valor)} cada</span>
                        </div>
                      ))}
                    </td>
                    <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(x.total)}</td>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(x.criado_em)}</td>
                    <td>
                      <Selo tom={TOM_PEDIDO[x.status]} ponto>{x.status}</Selo>
                      {x.atendido_por && (
                        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>
                          por {x.atendido_por}
                        </div>
                      )}
                    </td>
                    <td className="col-acoes">
                      {x.status === 'Aberto' && (
                        <>
                          <button className="btn pq primario" disabled={Boolean(ocupado)}
                                  onClick={() => responder(x, 'Aceito')}>
                            {ocupado === x.id ? 'Aceitando…' : 'Aceitar'}
                          </button>{' '}
                          <button className="btn pq perigo" disabled={Boolean(ocupado)}
                                  onClick={() => setRecusar(x)}>
                            Recusar
                          </button>
                        </>
                      )}
                      {x.status === 'Aceito' && (
                        <button className="btn pq primario" disabled={Boolean(ocupado)}
                                onClick={() => concluir(x)}
                                title="A entrega já aconteceu no jogo">
                          <Icone nome="selo" tam={13} /> {ocupado === x.id ? 'Concluindo…' : 'Concluir'}
                        </button>
                      )}
                      {x.status === 'Concluído' && x.concluido_em && (
                        <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                          {quando(x.concluido_em)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Lucro -------- */}
      <Painel
        titulo="Lucro da casa"
        acoes={<Selo tom={lucro ? 'ok' : 'off'} ponto>{septims(lucro)}</Selo>}
      >
        <p className="painel-nota">
          Só entra aqui o que foi <strong>concluído</strong>. Pedido aceito e ainda não entregue
          aparece como <em>a entregar</em> — palavra dada não é Septim no bolso.
        </p>
        <div className="grade g3" style={{ marginBottom: vendas.length ? 14 : 0 }}>
          <Stat rotulo="Total recebido" valor={septims(lucro)} sub="vendas concluídas" tom="verde" />
          <Stat rotulo="Peças vendidas" valor={pecasVendidas}
                sub={`em ${vendas.length} pedido${vendas.length === 1 ? '' : 's'}`} />
          <Stat rotulo="Ticket médio"
                valor={septims(vendas.length ? Math.round(lucro / vendas.length) : 0)}
                sub="por pedido concluído" tom="roxo" />
        </div>
        {vendas.length === 0 ? (
          <Vazio simb="⚱">
            Nenhuma venda concluída ainda. Aceite um pedido e, depois da entrega no jogo,
            aperte <strong>Concluir</strong>.
          </Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr><th>Quando</th><th>Comprador</th><th>Itens</th>
                  <th>Valor</th><th>Fechado por</th></tr>
              </thead>
              <tbody>
                {vendas.map((x) => (
                  <tr key={x.id}>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(x.concluido_em)}</td>
                    <td><span className="nome-forte">{x.comprador}</span></td>
                    <td style={{ fontSize: 12.5, color: 'var(--txt-2)' }}>
                      {(x.itens || []).map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}
                    </td>
                    <td className="mono" style={{ color: 'var(--ok)' }}>+{septims(x.total)}</td>
                    <td style={{ fontSize: 12, color: 'var(--txt-2)' }}>{x.concluido_por || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Estoque -------- */}
      <Painel
        titulo="Estoque e lista de preços"
        acoes={
          <button className="btn pq primario" onClick={addI}>
            <Icone nome="mais" tam={13} /> Adicionar item
          </button>
        }
      >
        <p className="painel-nota">
          O que está aqui é o que a cidade enxerga à venda, com o preço ao lado. Quantidade
          zero some da vitrine, mas continua na sua lista.
        </p>
        {vEst.length === 0 ? (
          <Vazio simb="📦">Nenhum item cadastrado. Use <strong>Adicionar item</strong>.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 560 }}>
              <thead>
                <tr><th>Item</th><th style={{ width: 130 }}>Quantidade</th>
                  <th style={{ width: 160 }}>Valor (Septims)</th><th style={{ width: 130 }}>Subtotal</th>
                  <th className="col-acoes"></th></tr>
              </thead>
              <tbody>
                {vEst.map((i, k) => (
                  <tr key={k}>
                    <td>
                      <input className="cel-input nome" value={i.nome}
                             onChange={(e) => setI(k, 'nome', e.target.value)}
                             placeholder="Ex.: Poção de Cura" />
                    </td>
                    <td>
                      <input className="cel-input mono" type="number" min="0" value={i.quantidade}
                             onChange={(e) => setI(k, 'quantidade', e.target.value)} />
                    </td>
                    <td>
                      <input className="cel-input mono" type="number" min="0" value={i.valor}
                             onChange={(e) => setI(k, 'valor', e.target.value)} />
                    </td>
                    <td className="mono" style={{ color: 'var(--txt-3)' }}>
                      {septims((Number(i.quantidade) || 0) * (Number(i.valor) || 0))}
                    </td>
                    <td className="col-acoes">
                      <button className="btn pq perigo" onClick={() => delI(k)} aria-label="Remover item">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Funcionários -------- */}
      <Painel
        titulo="Funcionários"
        acoes={dono
          ? <button className="btn pq primario" onClick={addF}>
            <Icone nome="mais" tam={13} /> Contratar
          </button>
          : <Selo tom="off">só o dono contrata</Selo>}
      >
        <p className="painel-nota">
          Quem trabalha aqui. Buscando no Registro Civil, a profissão e o nível vêm junto —
          e a <strong>função</strong> é sua para escrever: o que essa pessoa faz nesta casa.
          Funcionário também enxerga esta tela e atende pedidos.
        </p>
        {vFunc.length === 0 ? (
          <Vazio simb="⚒">
            {dono ? 'Ninguém contratado ainda.' : 'Ninguém contratado ainda.'}
          </Vazio>
        ) : dono ? (
          <ul className="lista-membros">
            {vFunc.map((f, i) => (
              <li key={f._k || i}>
                <SeletorCivil
                  compacto
                  valor={f.nome}
                  aoMudar={(n) => setFuncionarios(vFunc.map((x, j) => (j === i ? { ...x, nome: n, civil_id: '', id_jogo: '' } : x)))}
                  aoEscolher={(c) => ligarF(i, c)}
                  civis={d.civis || []}
                  vinculado={f.civil_id ? (d.civis || []).find((c) => c.id === f.civil_id) : null}
                  aoDesvincular={() => setF(i, 'civil_id', '')}
                  placeholder="Nome — busca no Registro Civil"
                />
                <select value={f.profissao || ''} onChange={(e) => setF(i, 'profissao', e.target.value)}>
                  <option value="">Profissão</option>
                  {PROFISSOES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <select value={f.nivel || 'Novato'} onChange={(e) => setF(i, 'nivel', e.target.value)}>
                  {NIVEIS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <input className="servo-funcao" value={f.funcao || ''}
                       onChange={(e) => setF(i, 'funcao', e.target.value)}
                       placeholder="Função — Balconista, Caixa, Aprendiz…" />
                <button className="btn pq perigo" onClick={() => delF(i)} aria-label="Demitir">×</button>
              </li>
            ))}
          </ul>
        ) : (
          vFunc.map((f, i) => (
            <div className="linha-nobre" key={i}>
              <Icone nome="pessoa" tam={15} cor="var(--gold)" />
              <span className="ln-nome">{f.nome}</span>
              {f.funcao && <Selo tom="gold">{f.funcao}</Selo>}
              {f.profissao && (
                <Selo>
                  {f.profissao} <Pips nivel={f.nivel} />
                </Selo>
              )}
            </div>
          ))
        )}
      </Painel>

      {mexeu && (
        <div className="barra-salvar">
          <span>Você mexeu em {prop.nome} e ainda não salvou.</span>
          <button className="btn fantasma" onClick={descartar}>Descartar</button>
          <button className="btn primario" onClick={salvar}>Salvar</button>
        </div>
      )}

      {recusar && (
        <FormRecusaPedido
          pedido={recusar}
          aoFechar={() => setRecusar(null)}
          aoConfirmar={async (motivo) => { await responder(recusar, 'Recusado', motivo); setRecusar(null); }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormRecusaPedido({ pedido, aoFechar, aoConfirmar }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      titulo={`Recusar o pedido de ${pedido.comprador}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn perigo" onClick={() => aoConfirmar(motivo)}>Recusar</button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--txt-2)', fontSize: 13, lineHeight: 1.6 }}>
        O estoque não baixa e <strong>{pedido.comprador}</strong> recebe o recado no Quadro de
        Avisos, com o motivo que você escrever.
      </p>
      <AreaTexto rotulo="Motivo (o comprador vai ler)" valor={motivo} aoMudar={setMotivo}
                 placeholder="Sem estoque suficiente, reservado para a Corte, preço combinado…" />
    </Modal>
  );
}
