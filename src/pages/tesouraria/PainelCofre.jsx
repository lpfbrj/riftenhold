import React, { useMemo, useState } from 'react';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Icone, Vazio, Campo,
} from '../../components/ui.jsx';
import {
  estadoDoCofre, porOrigem, totaisDeSempre, precosPorGrupo,
  emAberto, somaDe, dataOuTraco, septims,
} from '../../lib/tesouraria.js';
import { declararSaldo } from '../../lib/db.js';

/**
 * O cofre de Riften.
 *
 * O número grande é sempre "o último saldo que a Corte declarou,
 * mais o que entrou e saiu desde então". A plataforma não enxerga o
 * jogo, então ela nunca finge saber o saldo sozinha — e diz na tela
 * de quando é a última declaração, para ninguém confiar num número
 * velho sem perceber.
 */
export default function PainelCofre({ dados: d, cofre = [], cobrancas = [], precos = [], usuario }) {
  const [declarar, setDeclarar] = useState(null);
  const [erro, setErro] = useState('');
  const autor = usuario?.nome || usuario?.cargo || 'Corte';

  const estado = useMemo(() => estadoDoCofre(cofre), [cofre]);
  const sempre = useMemo(() => totaisDeSempre(cofre), [cofre]);
  const receita = useMemo(() => porOrigem(cofre, 'entrada'), [cofre]);
  const despesa = useMemo(() => porOrigem(cofre, 'saida'), [cofre]);
  const aReceber = useMemo(() => somaDe(emAberto(cobrancas)), [cobrancas]);

  return (
    <>
      <div className="cofre-hero">
        <div className="cofre-valor">
          <span className="cofre-rot">Saldo do cofre de Riften</span>
          <strong>{septims(estado.saldo)}</strong>
          {estado.semDeclaracao ? (
            <span className="cofre-sub alerta">
              A Corte ainda não declarou o saldo. Enquanto isso, o número acima é só a soma
              do que a plataforma registrou.
            </span>
          ) : (
            <span className="cofre-sub">
              Última declaração: <strong>{septims(estado.declarado)}</strong> em{' '}
              {dataOuTraco(estado.declaradoEm)} por {estado.declaradoPor || 'Corte'}
              {estado.razao ? ` — “${estado.razao}”` : ''}
            </span>
          )}
        </div>
        <button
          className="btn primario"
          onClick={async () => {
            // Relê antes de abrir: alguém da Corte pode ter confirmado
            // uma cobrança agora há pouco, e declarar por cima do
            // número velho apagaria a entrada dela do saldo.
            await d.recarregar().catch(() => {});
            setDeclarar({ razao: '' });
          }}
        >
          <Icone nome="moeda" tam={15} /> Declarar saldo
        </button>
      </div>

      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Entrou desde a declaração" valor={septims(estado.entradas)}
              sub={`${estado.movimentos.filter((m) => m.tipo === 'entrada').length} lançamento(s)`} tom="verde" />
        <Stat rotulo="Saiu desde a declaração" valor={septims(estado.saidas)}
              sub={`${estado.movimentos.filter((m) => m.tipo === 'saida').length} lançamento(s)`} tom="laranja" />
        <Stat rotulo="A receber" valor={septims(aReceber)}
              sub={`${emAberto(cobrancas).length} cobrança(s) em aberto`} tom="roxo" />
        <Stat rotulo="Arrecadado desde sempre" valor={septims(sempre.entradas)}
              sub={`${septims(sempre.saidas)} em despesas`} />
      </div>

      <Grafico
        titulo="Arrecadação por origem"
        nota="Só entra aqui a cobrança que a Corte confirmou como paga. O extrato completo,
              linha a linha, está na aba Livro-caixa."
        dados={receita}
        cor="var(--gold)"
        vazio="Nenhuma receita registrada ainda."
      />

      <div style={{ height: 16 }} />

      <Grafico
        titulo="Despesas por destino"
        nota="Soldo da tropa, compras, retiradas para o jogo e a cidadania que o Hold paga
              por quem não tem como pagar."
        dados={despesa}
        cor="var(--autumn)"
        vazio="Nenhuma despesa registrada ainda."
      />

      <div style={{ height: 16 }} />

      <PainelPrecos dados={d} precos={precos} autor={autor} aoErro={setErro} />

      {declarar && (
        <FormDeclaracao
          inicial={declarar}
          atual={estado}
          aoFechar={() => setDeclarar(null)}
          aoSalvar={async (v) => {
            await declararSaldo(v, autor);
            await d.recarregar();
            setDeclarar(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------
   O gráfico.

   Barras horizontais, uma série só, ordenadas da maior para a
   menor e com o nome escrito em cada linha — a identidade vem do
   rótulo, não da cor, então uma cor só basta e o daltônico lê
   igual. O valor usa a cor de texto; a cor fica na barra.
   ------------------------------------------------------------ */
function Grafico({ titulo, nota, dados, cor, vazio }) {
  const maior = Math.max(1, ...dados.fatias.map((f) => f.valor));
  return (
    <Painel
      titulo={titulo}
      acoes={dados.total > 0 && <Selo tom="gold">{septims(dados.total)}</Selo>}
    >
      <p className="painel-nota">{nota}</p>
      {dados.fatias.length === 0 ? (
        <Vazio simb="◈">{vazio}</Vazio>
      ) : (
        <ul className="grafico-origens">
          {dados.fatias.map((f) => (
            <li key={f.id} title={`${f.nome}: ${septims(f.valor)} · ${f.pct}%`}>
              <span className="go-icone"><Icone nome={f.icone} tam={14} cor="var(--txt-3)" /></span>
              <span className="go-nome">{f.nome}</span>
              <span className="go-barra">
                <span style={{ width: `${(f.valor / maior) * 100}%`, background: cor }} />
              </span>
              <span className="go-valor mono">{Number(f.valor).toLocaleString('pt-BR')}</span>
              <span className="go-pct">{f.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}

/* ------------------------------------------------------------ */
function PainelPrecos({ dados: d, precos, autor, aoErro }) {
  const [rascunho, setRascunho] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const grupos = useMemo(() => precosPorGrupo(precos), [precos]);

  const salvar = async (item, valor) => {
    setOcupado(true);
    aoErro('');
    try {
      // A linha da tabela é identificada pela chave, não pela ordem:
      // trocar o preço da licença de culto não pode mexer no da mina.
      const existente = (precos || []).find((p) => p.chave === item.chave);
      await d.salvar('precos', {
        ...(existente || {}),
        chave: item.chave,
        nome: item.nome,
        grupo: item.grupo,
        valor: Math.max(0, Math.round(Number(valor) || 0)),
        definido_por: autor,
        definido_em: new Date().toISOString(),
      }, item.nome);
      setRascunho(null);
    } catch (e) {
      aoErro(e.message || 'Não consegui salvar o preço.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Painel titulo="Tabela de preços do Hold">
      <p className="painel-nota">
        O que a Corte cobra por cada coisa. É este valor que a tela sugere na hora de emitir
        — quem emite ainda pode mudar naquela emissão, se o caso pedir.
      </p>
      {grupos.map(({ grupo, itens }) => (
        <div className="preco-grupo" key={grupo}>
          <h4>{grupo}</h4>
          <ul className="lista-precos">
            {itens.map((item) => {
              const editando = rascunho?.chave === item.chave;
              return (
                <li key={item.chave}>
                  <span className="pr-nome">{item.nome}</span>
                  {editando ? (
                    <>
                      <input
                        type="number" min="0" className="mono pr-input"
                        value={rascunho.valor}
                        autoFocus
                        onChange={(e) => setRascunho((s) => ({ ...s, valor: e.target.value }))}
                      />
                      <button className="btn pq primario" disabled={ocupado}
                              onClick={() => salvar(item, rascunho.valor)}>Salvar</button>
                      <button className="btn pq fantasma" onClick={() => setRascunho(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="pr-valor mono">{septims(item.valor)}</span>
                      {item.alterado && <Selo tom="roxo">alterado pela Corte</Selo>}
                      <button className="btn pq fantasma" title="Mudar o preço"
                              onClick={() => setRascunho({ chave: item.chave, valor: item.valor })}>
                        <Icone nome="lapis" tam={13} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Painel>
  );
}

/* ------------------------------------------------------------ */
function FormDeclaracao({ inicial, atual, aoFechar, aoSalvar }) {
  // O campo nasce com o saldo recém-relido, não com o que a tela
  // mostrava quando foi aberta.
  const [v, setV] = useState({ saldo: atual.saldo, ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const novo = Math.max(0, Math.round(Number(v.saldo) || 0));
  const diferenca = novo - atual.saldo;

  const enviar = async () => {
    if (!String(v.razao || '').trim()) {
      setErro('Escreva por que o saldo está sendo atualizado — é isso que fica no log.');
      return;
    }
    setOcupado(true);
    setErro('');
    try { await aoSalvar({ saldo: novo, razao: v.razao }); }
    catch (e) { setErro(e.message || 'Não consegui declarar o saldo.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo="Declarar o saldo do cofre"
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Declarando…' : 'Declarar saldo'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <p className="painel-nota">
        A plataforma não conversa com o jogo, então o número certo é o que vocês conferem
        lá dentro. Declarar o saldo não apaga nada: entra como um lançamento no livro-caixa,
        com a razão escrita e o seu nome.
      </p>
      <Campo rotulo="Saldo real do cofre (Septims)">
        <input type="number" min="0" className="mono" value={v.saldo ?? ''}
               onChange={(e) => setV((s) => ({ ...s, saldo: e.target.value }))} />
      </Campo>
      <p className="painel-nota" style={{ margin: '8px 0 12px' }}>
        A plataforma vinha marcando <strong>{septims(atual.saldo)}</strong>.{' '}
        {diferenca === 0
          ? 'A declaração confirma o mesmo valor.'
          : diferenca > 0
            ? `A declaração acrescenta ${septims(diferenca)}.`
            : `A declaração tira ${septims(Math.abs(diferenca))}.`}
      </p>
      <AreaTexto
        rotulo="Razão da atualização"
        valor={v.razao}
        aoMudar={(x) => setV((s) => ({ ...s, razao: x }))}
        rows={3}
        placeholder="Conferência do cofre em jogo, entrada de imposto, gasto não registrado…"
      />
    </Modal>
  );
}
