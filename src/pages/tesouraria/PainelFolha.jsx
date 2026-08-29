import React, { useMemo, useState } from 'react';
import { Painel, Stat, Selo, Icone, Vazio, Confirmar } from '../../components/ui.jsx';
import { CICLO_SALARIO } from '../../lib/constants.js';
import {
  folhaDoHold, soldoDe, nomeDaPatente, nomeDaDivisao, dataBR, somarDias,
  campanhaAberta, convocadosDa, septims,
} from '../../lib/forcas.js';
import { registrarPagamento, pagarFolha } from '../../lib/db.js';

/**
 * A folha do Hold — o soldo da tropa, pago pelo cofre.
 *
 * O *quanto* cada patente ganha continua sendo do Quartel, junto da
 * hierarquia: é doutrina militar. O *ato de pagar* mora aqui, porque
 * pagar é gastar dinheiro público — e cada pagamento vira uma saída
 * no livro-caixa, com o nome de quem pagou.
 *
 * O soldo é semanal: pagou hoje, o próximo só cai daqui a sete dias
 * — pagou em 25/08, o próximo é 01/09. Quem está aposentado sai da
 * folha; miliciano só entra enquanto está convocado, e aí quem paga
 * é o soldo da campanha.
 */
export default function PainelFolha({
  dados: d, guardas = [], patentes = [], milicia = [], campanhas = [], usuario,
}) {
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [feito, setFeito] = useState('');

  const autor = usuario?.nome || usuario?.cargo || 'Corte';
  const folha = useMemo(() => folhaDoHold(guardas, patentes), [guardas, patentes]);

  const campanha = campanhaAberta(campanhas);
  // Só paga quem foi chamado para a campanha que está de pé. Um
  // "Convocado" solto — de uma campanha apagada — não entra na folha
  // de uma guerra a que ele nunca foi.
  const convocados = useMemo(() => convocadosDa(campanha, milicia), [campanha, milicia]);
  const soldoCampanha = Math.max(0, Number(campanha?.soldo) || 0);

  const linhasMilicia = useMemo(
    () => convocados.map((m) => ({ ficha: m, ...soldoDe({ ...m, salario: soldoCampanha }, []) })),
    [convocados, soldoCampanha],
  );
  const miliciaVencida = linhasMilicia.filter((l) => l.vencido);

  /**
   * Recarrega mesmo quando falha: a folha é paga linha a linha, e
   * uma falha no meio deixa parte do dinheiro já registrado. A tela
   * tem de mostrar o que de fato aconteceu, ou a Corte paga de novo.
   */
  const proteger = async (fn, recado) => {
    setOcupado(true);
    setErro('');
    setFeito('');
    try {
      await fn();
      if (recado) setFeito(recado);
    } catch (e) {
      setErro(e.message || 'Não consegui registrar o pagamento.');
    } finally {
      await d.recarregar().catch(() => {});
      setOcupado(false);
    }
  };

  const proximoEm = () => dataBR(somarDias(new Date(), CICLO_SALARIO));

  const pagarUm = (linha, tabela) => proteger(
    () => registrarPagamento(linha.ficha.id, { valor: linha.valor, por: autor, tabela }),
    `Soldo de ${linha.ficha.nome} registrado — próximo pagamento em ${proximoEm()}.`,
  );

  const pagarTodos = () => proteger(async () => {
    const doExercito = folha.linhas.filter((l) => l.vencido).map((l) => ({ id: l.ficha.id, valor: l.valor }));
    const daMilicia = miliciaVencida.map((l) => ({ id: l.ficha.id, valor: l.valor }));
    const tropa = await pagarFolha(doExercito, { por: autor, tabela: 'guardas' });
    const chamados = await pagarFolha(daMilicia, { por: autor, tabela: 'milicia' });
    const falhas = [...tropa.falhas, ...chamados.falhas];
    setFeito(`Folha paga: ${tropa.pagos + chamados.pagos} soldo(s) registrado(s).`);
    if (falhas.length) {
      // Quem falhou não pode sumir do relato: o resto foi pago, e
      // repetir a folha inteira pagaria duas vezes.
      throw new Error(`${falhas.length} soldo(s) não puderam ser registrados: ${falhas[0].motivo}`);
    }
  });

  const totalVencido = folha.aPagar + miliciaVencida.reduce((s, l) => s + l.valor, 0);

  return (
    <>
      <div className="grade g4" style={{ margin: '18px 0' }}>
        <Stat rotulo="Folha semanal" valor={septims(folha.semanal + soldoCampanha * convocados.length)}
              sub="Exército e milícia convocada" />
        <Stat rotulo="Vencidos agora" valor={folha.vencidos + miliciaVencida.length}
              sub="soldos a pagar hoje" tom={totalVencido ? 'laranja' : 'verde'} />
        <Stat rotulo="A desembolsar" valor={septims(totalVencido)} sub="soma dos vencidos" tom="roxo" />
        <Stat rotulo="Ciclo do pagamento" valor={`${CICLO_SALARIO} dias`} sub="uma semana entre soldos" tom="verde" />
      </div>

      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      {feito && <div className="aviso-ok"><Icone nome="moeda" tam={14} /> {feito}</div>}

      <Painel
        titulo="Folha do Exército"
        acoes={
          <button className="btn primario pq"
                  disabled={ocupado || !(folha.vencidos + miliciaVencida.length)}
                  onClick={() => setConfirmar(true)}>
            <Icone nome="moeda" tam={14} /> Pagar todos os vencidos
          </button>
        }
      >
        <p className="painel-nota">
          O soldo é semanal. Registrado o pagamento, a data do próximo é a de hoje mais{' '}
          {CICLO_SALARIO} dias — e até lá o soldado não entra de novo na lista de vencidos.
          Cada soldo pago sai do cofre e aparece no livro-caixa.
        </p>

        {folha.linhas.length === 0 ? (
          <Vazio simb="◈">Ninguém em serviço no Exército.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Soldado</th><th>Patente</th><th>Divisão</th><th>Soldo</th>
                  <th>Último pagamento</th><th>Próximo pagamento</th><th>Situação</th>
                  <th className="col-acoes"></th>
                </tr>
              </thead>
              <tbody>
                {folha.linhas.map((l) => (
                  <LinhaSoldo
                    key={l.ficha.id}
                    linha={l}
                    patente={nomeDaPatente(l.ficha, patentes)}
                    divisao={nomeDaDivisao(l.ficha, d.divisoes || [])}
                    ocupado={ocupado}
                    aoPagar={() => pagarUm(l, 'guardas')}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      <Painel titulo="Soldo de campanha — milícia convocada">
        {!campanha || convocados.length === 0 ? (
          <p className="painel-nota" style={{ marginBottom: 0 }}>
            Nenhum miliciano convocado. A milícia só recebe enquanto está em campanha.
          </p>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Miliciano</th><th>Campanha</th><th>Soldo</th>
                  <th>Último pagamento</th><th>Próximo pagamento</th><th>Situação</th>
                  <th className="col-acoes"></th>
                </tr>
              </thead>
              <tbody>
                {linhasMilicia.map((l) => (
                  <LinhaSoldo
                    key={l.ficha.id}
                    linha={l}
                    patente={l.ficha.campanha_nome || campanha.nome}
                    ocupado={ocupado}
                    aoPagar={() => pagarUm(l, 'milicia')}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      {confirmar && (
        <Confirmar
          mensagem={`Registrar o pagamento de ${folha.vencidos + miliciaVencida.length} soldo(s), num total de ${septims(totalVencido)}?`}
          rotulo="Pagar"
          tom="primario"
          aoConfirmar={pagarTodos}
          aoFechar={() => setConfirmar(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function LinhaSoldo({ linha, patente, divisao, ocupado, aoPagar }) {
  const { ficha, valor, pagoEm, proximo, dias, vencido, nunca } = linha;
  return (
    <tr className={vencido ? 'linha-vencida' : ''}>
      <td className="nome-forte">{ficha.nome}</td>
      <td><Selo tom="gold">{patente || '—'}</Selo></td>
      {divisao !== undefined && (
        <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{divisao || '—'}</td>
      )}
      <td className="mono" style={{ color: 'var(--gold-2)' }}>{valor.toLocaleString('pt-BR')}</td>
      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{nunca ? 'nunca' : dataBR(pagoEm)}</td>
      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{proximo ? dataBR(proximo) : '—'}</td>
      <td>
        {nunca ? <Selo tom="warn" ponto>Nunca pago</Selo>
          : vencido ? <Selo tom="perigo" ponto>Vencido há {Math.abs(dias)} dia(s)</Selo>
            : <Selo tom="ok" ponto>Em dia · faltam {dias} dia(s)</Selo>}
      </td>
      <td className="col-acoes">
        <button className="btn pq primario" disabled={ocupado || !vencido} onClick={aoPagar}
                title={vencido ? 'Registrar pagamento' : 'Só depois da semana fechar'}>
          Pagar
        </button>
      </td>
    </tr>
  );
}
