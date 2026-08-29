import React, { useMemo, useState } from 'react';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Campo, Confirmar,
} from '../../components/ui.jsx';
import SeletorCivil from '../../components/SeletorCivil.jsx';
import {
  STATUS_COBRANCA, STATUS_COBRANCA_TOM, ORIGENS_COBRANCA, DEVEDORES,
} from '../../lib/constants.js';
import {
  emAberto, declaradas, pagas, somaDe, origemDe, dataHora, septims,
} from '../../lib/tesouraria.js';
import { emitirCobranca, confirmarCobranca, recusarDeclaracao, cancelarCobranca } from '../../lib/db.js';

const VAZIA = {
  origem: 'titulo', titulo: '', descricao: '', valor: '',
  devedor_tipo: 'civil', devedor_id: null, devedor_nome: '',
};

/**
 * Tudo que o Hold tem a receber, venha de onde vier.
 *
 * O jogador paga dentro do jogo e declara aqui; a Corte confere e
 * confirma, e é a confirmação que vira dinheiro no cofre. Quem
 * declarou nunca é quem confirma.
 */
export default function PainelCobrancas({
  dados: d, cobrancas = [], civis = [], propriedades = [], clas = [], usuario,
}) {
  const [fStatus, setFStatus] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [busca, setBusca] = useState('');
  const [nova, setNova] = useState(null);
  const [julgar, setJulgar] = useState(null);   // { cobranca, confirmar: bool }
  const [cancelar, setCancelar] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const autor = usuario?.nome || usuario?.cargo || 'Corte';

  const abertas = useMemo(() => emAberto(cobrancas), [cobrancas]);
  const naMesa = useMemo(() => declaradas(cobrancas), [cobrancas]);
  const quitadas = useMemo(() => pagas(cobrancas), [cobrancas]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return [...(cobrancas || [])]
      .filter((c) =>
        (!fStatus || (c.status || 'Em aberto') === fStatus) &&
        (!fOrigem || c.origem === fOrigem) &&
        (!t || [c.numero, c.titulo, c.devedor_nome].some(
          (x) => String(x || '').toLowerCase().includes(t))))
      .sort((a, b) => {
        // O que espera decisão da Corte vem primeiro — é o que ela
        // abriu esta tela para fazer.
        const peso = (c) => (c.status === 'Pagamento declarado' ? 0
          : (c.status || 'Em aberto') === 'Em aberto' ? 1 : 2);
        return peso(a) - peso(b) ||
          new Date(b.criado_em || 0) - new Date(a.criado_em || 0);
      });
  }, [cobrancas, fStatus, fOrigem, busca]);

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
      <div className="grade g4" style={{ margin: '18px 0' }}>
        <Stat rotulo="A receber" valor={septims(somaDe(abertas))}
              sub={`${abertas.length} em aberto`} tom={abertas.length ? 'laranja' : ''} />
        <Stat rotulo="Esperando conferência" valor={naMesa.length}
              sub="pagamentos declarados pelos moradores" tom={naMesa.length ? 'roxo' : ''} />
        <Stat rotulo="Já arrecadado" valor={septims(somaDe(quitadas))}
              sub={`${quitadas.length} cobrança(s) quitada(s)`} tom="verde" />
        <Stat rotulo="Emitidas" valor={(cobrancas || []).length} sub="desde a abertura do livro" />
      </div>

      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      {naMesa.length > 0 && (
        <>
          <Painel titulo={`Pagamentos declarados · ${naMesa.length}`}>
            <p className="painel-nota">
              Estes moradores dizem que pagaram dentro do jogo. Confira no cofre e confirme —
              é a confirmação que faz o dinheiro entrar no livro-caixa.
            </p>
            <div className="lista-divisoes">
              {naMesa.map((c) => (
                <article className="divisao-linha" key={c.id}>
                  <span className="divisao-marca" style={{ background: 'var(--purple)' }}>
                    <Icone nome="moeda" tam={15} cor="#15120c" />
                  </span>
                  <div className="divisao-corpo">
                    <h4>{c.numero} · {c.titulo} <Selo tom="gold">{septims(c.valor)}</Selo></h4>
                    <p>
                      {c.devedor_nome || 'sem devedor'} declarou o pagamento em {dataHora(c.declarado_em)}.
                      {c.declarado_nota ? ` Recado: “${c.declarado_nota}”` : ''}
                    </p>
                  </div>
                  <div className="divisao-acoes">
                    <button className="btn pq primario" disabled={ocupado}
                            onClick={() => setJulgar({ cobranca: c, confirmar: true })}>
                      Confirmar
                    </button>
                    <button className="btn pq perigo" disabled={ocupado}
                            onClick={() => setJulgar({ cobranca: c, confirmar: false })}>
                      Não recebi
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </Painel>
          <div style={{ height: 16 }} />
        </>
      )}

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Número, motivo ou devedor…" />
        </div>
        <Selecao rotulo="Situação" valor={fStatus} aoMudar={setFStatus}
                 opcoes={STATUS_COBRANCA} vazioLabel="Todas" />
        <Selecao rotulo="Origem" valor={fOrigem} aoMudar={setFOrigem} vazioLabel="Todas"
                 opcoes={ORIGENS_COBRANCA.map((o) => ({ valor: o.id, rotulo: o.nome }))} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn primario" onClick={() => setNova({ ...VAZIA })}>
            <Icone nome="mais" tam={15} /> Lavrar título
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        <Painel>
          <Vazio simb="◈">
            {(cobrancas || []).length
              ? 'Nenhuma cobrança corresponde ao filtro.'
              : 'Nada a receber. As cobranças nascem sozinhas quando a Corte multa, emite '
                + 'licença, vende imóvel ou defere um ato da Chancelaria.'}
          </Vazio>
        </Painel>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th><th>Do que se trata</th><th>Origem</th>
                <th>Quem deve</th><th>Valor</th><th>Situação</th><th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="mono" style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{c.numero}</td>
                  <td>
                    <span className="nome-forte">{c.titulo}</span>
                    {c.descricao && <small className="sub-linha">{c.descricao}</small>}
                  </td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{origemDe(c).nome}</td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{c.devedor_nome || '—'}</td>
                  <td className="mono" style={{ color: 'var(--gold-2)' }}>
                    {Number(c.valor || 0).toLocaleString('pt-BR')}
                  </td>
                  <td>
                    <Selo tom={STATUS_COBRANCA_TOM[c.status] || 'warn'} ponto>
                      {c.status || 'Em aberto'}
                    </Selo>
                  </td>
                  <td className="col-acoes">
                    {c.status === 'Pagamento declarado' && (
                      <>
                        <button className="btn pq primario" disabled={ocupado}
                                onClick={() => setJulgar({ cobranca: c, confirmar: true })}>
                          Confirmar
                        </button>{' '}
                      </>
                    )}
                    {(c.status || 'Em aberto') === 'Em aberto' && (
                      <>
                        <button className="btn pq" disabled={ocupado}
                                title="Recebi por fora — dar por paga"
                                onClick={() => setJulgar({ cobranca: c, confirmar: true })}>
                          Dar por paga
                        </button>{' '}
                        <button className="btn pq perigo" disabled={ocupado}
                                title="Cancelar a cobrança" onClick={() => setCancelar(c)}>
                          <Icone nome="lixo" tam={13} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nova && (
        <FormTitulo
          inicial={nova}
          civis={civis}
          propriedades={propriedades}
          clas={clas}
          aoFechar={() => setNova(null)}
          aoSalvar={async (v) => {
            await emitirCobranca({ ...v, referencia_tipo: 'titulo', referencia_id: null }, autor);
            await d.recarregar();
            setNova(null);
          }}
        />
      )}

      {julgar && (
        <FormJulgar
          cobranca={julgar.cobranca}
          confirmar={julgar.confirmar}
          aoFechar={() => setJulgar(null)}
          aoDecidir={async (parecer) => {
            await proteger(() => (julgar.confirmar
              ? confirmarCobranca(julgar.cobranca, { por: autor, parecer })
              : recusarDeclaracao(julgar.cobranca, { por: autor, parecer })));
            setJulgar(null);
          }}
        />
      )}

      {cancelar && (
        <Confirmar
          mensagem={`Cancelar a cobrança ${cancelar.numero} de ${septims(cancelar.valor)}? `
            + 'Ela deixa de ser devida e some da conta do morador.'}
          rotulo="Cancelar cobrança"
          aoConfirmar={() => proteger(() => cancelarCobranca(cancelar, { por: autor }))}
          aoFechar={() => setCancelar(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormJulgar({ cobranca, confirmar, aoFechar, aoDecidir }) {
  const [parecer, setParecer] = useState('');
  const [ocupado, setOcupado] = useState(false);

  return (
    <Modal
      titulo={confirmar ? `Confirmar ${cobranca.numero}` : `Recusar a declaração de ${cobranca.numero}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            {septims(cobranca.valor)} · {cobranca.devedor_nome || 'sem devedor'}
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Voltar</button>
          <button className={`btn ${confirmar ? 'primario' : 'perigo'}`} disabled={ocupado}
                  onClick={async () => { setOcupado(true); await aoDecidir(parecer); }}>
            {ocupado ? 'Registrando…' : confirmar ? 'Confirmar pagamento' : 'Recusar declaração'}
          </button>
        </>
      }
    >
      <p className="painel-nota">
        {confirmar
          ? 'Confirmar lança o valor como entrada no livro-caixa do cofre, no seu nome. '
            + 'Depois disso a cobrança não pode mais ser cancelada.'
          : 'A cobrança volta a ficar em aberto e o morador é avisado. Escreva o motivo — '
            + 'é o que ele vai ler.'}
      </p>
      <div className="chip-lista" style={{ marginBottom: 12 }}>
        <Selo tom="gold">{cobranca.titulo}</Selo>
        <Selo>{origemDe(cobranca).nome}</Selo>
        {cobranca.declarado_em && <Selo tom="roxo">declarado em {dataHora(cobranca.declarado_em)}</Selo>}
      </div>
      {cobranca.declarado_nota && (
        <p style={{ color: 'var(--txt-2)', fontSize: 12.5, borderLeft: '2px solid var(--line-2)',
                    paddingLeft: 12, margin: '0 0 14px' }}>
          {cobranca.declarado_nota}
        </p>
      )}
      <AreaTexto rotulo={confirmar ? 'Observação (opcional)' : 'Motivo da recusa'}
                 valor={parecer} aoMudar={setParecer} rows={3}
                 placeholder={confirmar ? 'Conferido no cofre por…' : 'Não encontrei o valor no cofre…'} />
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormTitulo({ inicial, civis = [], propriedades = [], clas = [], aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }));

  const trocarDevedor = (tipo) =>
    setV((s) => ({ ...s, devedor_tipo: tipo, devedor_id: null, devedor_nome: '' }));

  const enviar = async () => {
    if (!String(v.titulo || '').trim()) { setErro('Diga do que se trata a cobrança.'); return; }
    if (!Math.round(Number(v.valor) || 0)) { setErro('Diga quanto está sendo cobrado.'); return; }
    if (!String(v.devedor_nome || '').trim()) { setErro('Diga quem deve.'); return; }
    setOcupado(true);
    setErro('');
    try { await aoSalvar(v); }
    catch (e) { setErro(e.message || 'Não consegui lavrar o título.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo="Lavrar título de dívida"
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Lavrando…' : 'Lavrar cobrança'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <p className="painel-nota">
        A cobrança que a Corte lavra à mão, quando a dívida não nasce de outro sistema:
        tributo atrasado, dano ao patrimônio, acordo firmado em audiência.
      </p>

      <Campo rotulo="Quem deve">
        <div className="chip-lista">
          {DEVEDORES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`origem-op ${v.devedor_tipo === t.id ? 'ativo' : ''}`}
              onClick={() => trocarDevedor(t.id)}
            >
              <Icone nome={t.icone} tam={14} cor={v.devedor_tipo === t.id ? 'var(--gold)' : 'var(--txt-3)'} />
              <strong>{t.nome}</strong>
            </button>
          ))}
        </div>
      </Campo>

      <div style={{ height: 12 }} />

      {v.devedor_tipo === 'civil' ? (
        <SeletorCivil
          rotulo="Morador"
          valor={v.devedor_nome}
          aoMudar={(n) => setV((s) => ({ ...s, devedor_nome: n, devedor_id: null }))}
          aoEscolher={(c) => setV((s) => ({ ...s, devedor_nome: c.nome, devedor_id: c.id }))}
          civis={civis}
          vinculado={v.devedor_id ? civis.find((c) => c.id === v.devedor_id) : null}
          aoDesvincular={() => setV((s) => ({ ...s, devedor_id: null }))}
        />
      ) : (
        <Selecao
          rotulo={v.devedor_tipo === 'propriedade' ? 'Propriedade' : 'Casa nobre'}
          valor={v.devedor_id || ''}
          aoMudar={(id) => {
            const fonte = v.devedor_tipo === 'propriedade' ? propriedades : clas;
            const alvo = fonte.find((x) => x.id === id);
            setV((s) => ({
              ...s,
              devedor_id: id || null,
              devedor_nome: alvo ? (v.devedor_tipo === 'casa' ? `Casa ${alvo.nome}` : alvo.nome) : '',
            }));
          }}
          vazioLabel="— escolha —"
          opcoes={(v.devedor_tipo === 'propriedade' ? propriedades : clas)
            .map((x) => ({ valor: x.id, rotulo: v.devedor_tipo === 'casa' ? `Casa ${x.nome}` : x.nome }))}
        />
      )}

      <div style={{ height: 12 }} />
      <div className="grade g2">
        <Texto rotulo="Do que se trata" valor={v.titulo} aoMudar={set('titulo')}
               placeholder="Tributo do trimestre, dano ao muro…" />
        <Campo rotulo="Valor (Septims)">
          <input type="number" min="0" className="mono" value={v.valor ?? ''}
                 onChange={(e) => set('valor')(e.target.value)} />
        </Campo>
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Explicação da cobrança" valor={v.descricao} aoMudar={set('descricao')} rows={3}
                 placeholder="O texto que o morador vai ler na aba Cobranças dele." />
    </Modal>
  );
}
