import React, { useEffect, useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  Painel, Stat, Selo, Modal, AreaTexto, Icone, Vazio,
} from '../components/ui.jsx';
import { STATUS_COBRANCA_TOM } from '../lib/constants.js';
import {
  pendentes, pagas, somaDe, podeDeclarar, origemDe, dataOuTraco, septims,
} from '../lib/tesouraria.js';
import { declararPagamento, minhasCobrancas } from '../lib/db.js';

/**
 * O que o morador deve ao Hold.
 *
 * Reúne três coisas que ele veria espalhadas: o que está no nome
 * dele, o que é das propriedades registradas em seu nome e o que é
 * da casa nobre que ele chefia.
 *
 * Ele paga dentro do jogo e declara aqui. Quem confirma é sempre a
 * Corte — ninguém quita a própria dívida.
 */
export default function Cobrancas({ usuario }) {
  const d = useDados();
  const [declarar, setDeclarar] = useState(null);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');

  // No modo local a conta sai do que já está carregado; com banco de
  // verdade o morador é anônimo e não enxerga a tabela, então quem
  // responde é a função `minhas_cobrancas`. `minhasCobrancas` esconde
  // a diferença — a tela é a mesma nos dois casos.
  const [minhas, setMinhas] = useState([]);
  const contexto = useMemo(
    () => ({ cobrancas: d.cobrancas || [], propriedades: d.propriedades || [], clas: d.clas || [] }),
    [d.cobrancas, d.propriedades, d.clas],
  );
  useEffect(() => {
    let vivo = true;
    minhasCobrancas(usuario, contexto)
      .then((lista) => { if (vivo) setMinhas(lista); })
      .catch((e) => { if (vivo) setErro(e.message || 'Não consegui ler suas cobranças.'); });
    return () => { vivo = false; };
  }, [usuario, contexto]);

  const devendo = pendentes(minhas);
  const quitadas = pagas(minhas);
  const emAbertoDeVerdade = devendo.filter((c) => (c.status || 'Em aberto') === 'Em aberto');

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Cobranças</h1>
          <p>
            O que a Corte tem a receber de você, das suas propriedades e da sua casa. Pague
            dentro do jogo e declare aqui — alguém da Corte confere e dá baixa.
          </p>
        </div>
      </div>
      <div className="regra" />

      {feito && <div className="aviso-ok"><Icone nome="selo" tam={15} /> {feito}</div>}
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      <div className="grade g3" style={{ marginBottom: 18 }}>
        <Stat rotulo="Em aberto" valor={septims(somaDe(emAbertoDeVerdade))}
              sub={emAbertoDeVerdade.length
                ? `${emAbertoDeVerdade.length} pendência(s)`
                : 'nada devendo'}
              tom={emAbertoDeVerdade.length ? 'laranja' : 'verde'} />
        <Stat rotulo="Aguardando a Corte" valor={devendo.length - emAbertoDeVerdade.length}
              sub="pagamentos que você já declarou" tom="roxo" />
        <Stat rotulo="Já quitado" valor={septims(somaDe(quitadas))}
              sub={`${quitadas.length} cobrança(s)`} />
      </div>

      <Painel titulo={`Pendências · ${devendo.length}`}>
        {devendo.length === 0 ? (
          <Vazio simb="✦">
            Você não deve nada ao Hold. Multas, licenças, taxas da nobreza e escrituras
            aparecem aqui assim que a Corte as lavra.
          </Vazio>
        ) : (
          <div className="lista-divisoes">
            {devendo.map((c) => {
              const { pode, motivo } = podeDeclarar(c);
              return (
                <article className="divisao-linha" key={c.id}>
                  <span className="divisao-marca" style={{ background: 'var(--gold)' }}>
                    <Icone nome={origemDe(c).icone} tam={15} cor="#15120c" />
                  </span>
                  <div className="divisao-corpo">
                    <h4>
                      {c.titulo}
                      <Selo tom="gold">{septims(c.valor)}</Selo>
                      <Selo tom={STATUS_COBRANCA_TOM[c.status] || 'warn'} ponto>
                        {c.status || 'Em aberto'}
                      </Selo>
                    </h4>
                    <p>{c.descricao || 'Sem detalhamento.'}</p>
                    <div className="chip-lista">
                      <Selo>{c.numero}</Selo>
                      <Selo tom="roxo">{c.deQuem}</Selo>
                      <Selo>{origemDe(c).nome}</Selo>
                      <Selo tom="off">lavrada em {dataOuTraco(c.criado_em)}</Selo>
                    </div>
                    {c.status === 'Pagamento declarado' && (
                      <p className="painel-nota" style={{ margin: '4px 0 0' }}>
                        Você declarou o pagamento em {dataOuTraco(c.declarado_em)}. A Corte
                        ainda vai conferir no cofre.
                      </p>
                    )}
                    {c.parecer && (
                      <p className="perfil-aviso">Recado da Corte: {c.parecer}</p>
                    )}
                  </div>
                  <div className="divisao-acoes">
                    <button className="btn pq primario" disabled={!pode} title={motivo}
                            onClick={() => setDeclarar(c)}>
                      Já paguei
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Painel>

      {quitadas.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Painel titulo={`Quitadas · ${quitadas.length}`}>
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nº</th><th>Do que se tratava</th><th>De quem</th>
                    <th>Valor</th><th>Confirmada em</th>
                  </tr>
                </thead>
                <tbody>
                  {quitadas.map((c) => (
                    <tr key={c.id}>
                      <td className="mono" style={{ color: 'var(--txt-3)', fontSize: 12 }}>{c.numero}</td>
                      <td className="nome-forte">{c.titulo}</td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{c.deQuem}</td>
                      <td className="mono" style={{ color: 'var(--txt-2)' }}>
                        {Number(c.valor || 0).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ color: 'var(--txt-3)', fontSize: 12 }}>
                        {dataOuTraco(c.confirmado_em)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </>
      )}

      {declarar && (
        <FormDeclarar
          cobranca={declarar}
          aoFechar={() => setDeclarar(null)}
          aoEnviar={async (nota) => {
            setErro('');
            await declararPagamento(usuario, declarar, nota);
            await d.recarregar();
            setDeclarar(null);
            setFeito('Pagamento declarado. A Corte vai conferir e dar baixa.');
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormDeclarar({ cobranca, aoFechar, aoEnviar }) {
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    setOcupado(true);
    setErro('');
    try { await aoEnviar(nota); }
    catch (e) { setErro(e.message || 'Não consegui declarar o pagamento.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo={`Declarar pagamento — ${cobranca.numero}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            {septims(cobranca.valor)}
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Declarando…' : 'Declarar que paguei'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <p className="painel-nota">
        Declare só depois de ter pago de verdade dentro do jogo. A cobrança fica marcada
        como <strong>Pagamento declarado</strong> até alguém da Corte conferir o cofre —
        e só então ela é dada por quitada.
      </p>
      <div className="chip-lista" style={{ marginBottom: 12 }}>
        <Selo tom="gold">{cobranca.titulo}</Selo>
        <Selo>{cobranca.deQuem}</Selo>
      </div>
      <AreaTexto
        rotulo="Recado para a Corte (opcional)"
        valor={nota}
        aoMudar={setNota}
        rows={3}
        placeholder="Paguei ao Mestre da Moeda ontem à noite, na presença de…"
      />
    </Modal>
  );
}
