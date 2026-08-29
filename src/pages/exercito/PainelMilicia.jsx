import React, { useState } from 'react';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Icone, Vazio, Confirmar, Campo, Selecao,
} from '../../components/ui.jsx';
import SeletorCivil from '../../components/SeletorCivil.jsx';
import {
  RACAS, SITUACAO_MILICIA_TOM, STATUS_CAMPANHA_TOM, SOLDO_MILICIA,
} from '../../lib/constants.js';
import {
  miliciaViva, miliciaDisponivel, miliciaConvocada, campanhaAberta,
  campanhasEncerradas, convocadosDa, dataBR, septims,
} from '../../lib/forcas.js';
import {
  abrirCampanha, convocarMilicianos, liberarMiliciano, encerrarCampanha,
} from '../../lib/db.js';

const VAZIO = {
  nome: '', civil_id: '', id_jogo: '', raca: '', situacao: 'Disponível',
  campanha_id: null, campanha_nome: '', convocado_em: null, pago_em: null, notas: '',
};

/**
 * A Milícia: gente da cidade que se ofereceu para a guerra.
 *
 * Fora de campanha ela é só uma lista. Quando a Corte abre uma
 * convocação, os escolhidos passam a Convocados e entram na conta
 * das forças prontas do Hold; encerrada a campanha, todos voltam
 * à vida civil de uma vez.
 */
export default function PainelMilicia({ dados: d, milicia = [], campanhas = [], civis = [] }) {
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);
  const [nova, setNova] = useState(null);
  const [encerrar, setEncerrar] = useState(null);
  const [marcados, setMarcados] = useState([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const campanha = campanhaAberta(campanhas);
  const vivos = miliciaViva(milicia);
  const disponiveis = miliciaDisponivel(milicia);
  const convocados = miliciaConvocada(milicia);
  const anteriores = campanhasEncerradas(campanhas);
  // O dispensado continua no rol da Corte — some da contagem, não da vista.
  const noRol = [...(milicia || [])].sort(
    (a, b) => String(a.nome || '').localeCompare(String(b.nome || '')),
  );
  // Só se convoca quem está disponível: a marcação de alguém que saiu
  // da lista, ou que outra pessoa já chamou, é descartada aqui.
  const marcadosValidos = marcados.filter((id) => disponiveis.some((m) => m.id === id));

  /**
   * Roda a ação e recarrega — inclusive quando ela falha no meio.
   * Metade do trabalho feito e a tela mostrando o estado anterior é
   * o caminho mais curto para a Corte repetir o que já aconteceu.
   */
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

  const alternar = (id) =>
    setMarcados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const convocar = () => proteger(async () => {
    if (!campanha) throw new Error('Abra uma convocação antes de chamar a milícia.');
    if (!marcadosValidos.length) throw new Error('Marque quem será convocado.');
    await convocarMilicianos(campanha, marcadosValidos);
    setMarcados([]);
  });

  /**
   * A Corte edita a identificação do miliciano — nunca a situação:
   * essa é da convocação, e reescrevê-la a partir de um formulário
   * aberto há dez minutos re-convocaria quem foi dispensado no meio.
   */
  const salvar = async (v) => {
    const campos = {
      nome: String(v.nome || '').trim(),
      civil_id: v.civil_id || '',
      id_jogo: v.id_jogo || '',
      raca: v.raca || '',
      notas: String(v.notas || '').trim(),
    };
    await d.salvar('milicia', v.id
      ? { id: v.id, ...campos }
      : { ...VAZIO, ...campos }, campos.nome);
    setEdit(null);
  };

  return (
    <>
      <div className="grade g3" style={{ margin: '18px 0' }}>
        <Stat rotulo="Na lista da milícia" valor={vivos.length} sub="moradores voluntários" />
        <Stat rotulo="Disponíveis" valor={disponiveis.length} sub="à espera de chamado" tom="verde" />
        <Stat rotulo="Convocados" valor={convocados.length}
              sub={campanha ? campanha.nome : 'nenhuma campanha aberta'} tom="laranja" />
      </div>

      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      <Painel
        titulo="Convocação"
        acoes={
          campanha ? (
            <button className="btn pq perigo" disabled={ocupado} onClick={() => setEncerrar(campanha)}>
              Encerrar campanha
            </button>
          ) : (
            <button className="btn primario pq" onClick={() => setNova({ nome: '', motivo: '', soldo: SOLDO_MILICIA })}>
              <Icone nome="mais" tam={14} /> Abrir convocação
            </button>
          )
        }
      >
        {campanha ? (
          <>
            <div className="campanha-cartaz">
              <div>
                <h4>{campanha.nome}</h4>
                <p>{campanha.motivo || 'Sem motivo declarado.'}</p>
              </div>
              <div className="chip-lista">
                <Selo tom={STATUS_CAMPANHA_TOM[campanha.status] || ''} ponto>{campanha.status}</Selo>
                <Selo>Aberta em {dataBR(campanha.aberta_em)}</Selo>
                <Selo tom="gold">Soldo de campanha {septims(campanha.soldo || 0)}</Selo>
                <Selo tom="ok">{convocadosDa(campanha, milicia).length} convocado(s)</Selo>
              </div>
            </div>
            <p className="painel-nota">
              Marque na lista abaixo quem deve atender ao chamado. Encerrar a campanha devolve
              todos os convocados à vida civil de uma vez.
            </p>
          </>
        ) : (
          <Vazio simb="⚑">
            Nenhuma campanha aberta. A milícia só marcha quando a Corte convoca — abra uma
            convocação para chamar os voluntários.
          </Vazio>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      <Painel
        titulo={`Lista da milícia · ${vivos.length}`}
        acoes={
          <>
            {campanha && (
              <button className="btn primario pq" disabled={ocupado || !marcadosValidos.length} onClick={convocar}>
                <Icone nome="estandarte" tam={14} /> Convocar marcados ({marcadosValidos.length})
              </button>
            )}{' '}
            <button className="btn pq" onClick={() => setEdit({ ...VAZIO })}>
              <Icone nome="mais" tam={14} /> Inscrever morador
            </button>
          </>
        }
      >
        {noRol.length === 0 ? (
          <Vazio simb="⚑">
            Ninguém na lista. O morador se inscreve pela própria ficha, na Cidade de Riften,
            e a Corte também pode inscrever alguém por aqui.
          </Vazio>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  {campanha && <th style={{ width: 34 }}></th>}
                  <th>Nome</th><th>Raça</th><th>Situação</th><th>Campanha</th>
                  <th>Observação</th><th className="col-acoes"></th>
                </tr>
              </thead>
              <tbody>
                {noRol.map((m) => (
                  <tr key={m.id}>
                    {campanha && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Convocar ${m.nome}`}
                          disabled={(m.situacao || 'Disponível') !== 'Disponível'}
                          checked={marcadosValidos.includes(m.id)}
                          onChange={() => alternar(m.id)}
                        />
                      </td>
                    )}
                    <td className="nome-forte">{m.nome}</td>
                    <td style={{ color: 'var(--txt-2)' }}>{m.raca || '—'}</td>
                    <td>
                      <Selo tom={SITUACAO_MILICIA_TOM[m.situacao] || ''} ponto>
                        {m.situacao || 'Disponível'}
                      </Selo>
                    </td>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                      {m.campanha_nome || '—'}
                      {m.convocado_em && <small className="sub-linha">desde {dataBR(m.convocado_em)}</small>}
                    </td>
                    <td style={{ color: 'var(--txt-3)', fontSize: 12 }}>{m.notas || '—'}</td>
                    <td className="col-acoes">
                      {m.situacao === 'Convocado' && (
                        <>
                          <button className="btn pq fantasma" title="Dispensar da campanha" disabled={ocupado}
                                  onClick={() => proteger(() => liberarMiliciano(m.id))}>
                            Dispensar
                          </button>{' '}
                        </>
                      )}
                      <button className="btn pq fantasma" title="Editar inscrição" onClick={() => setEdit(m)}>
                        <Icone nome="lapis" tam={13} />
                      </button>{' '}
                      <button className="btn pq perigo" title="Tirar da lista" onClick={() => setRem(m)}>
                        <Icone nome="lixo" tam={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      {anteriores.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Painel titulo={`Campanhas encerradas · ${anteriores.length}`}>
            <ul className="lista-membros">
              {anteriores.map((c) => (
                <li key={c.id}>
                  <span className="m-nome">{c.nome}</span>
                  <Selo tom="off">{dataBR(c.aberta_em)} → {dataBR(c.encerrada_em)}</Selo>
                  <span style={{ color: 'var(--txt-3)', fontSize: 12 }}>{c.motivo || ''}</span>
                </li>
              ))}
            </ul>
          </Painel>
        </>
      )}

      {nova && (
        <FormCampanha
          inicial={nova}
          aoFechar={() => setNova(null)}
          aoSalvar={async (v) => {
            await abrirCampanha(v);
            await d.recarregar();
            setNova(null);
          }}
        />
      )}
      {edit && (
        <FormMiliciano
          inicial={edit}
          civis={civis}
          aoFechar={() => setEdit(null)}
          aoSalvar={salvar}
        />
      )}
      {encerrar && (
        <Confirmar
          mensagem={`Encerrar a campanha "${encerrar.nome}"? Todos os convocados voltam à condição de disponíveis.`}
          rotulo="Encerrar"
          tom="primario"
          aoConfirmar={() => proteger(() => encerrarCampanha(encerrar))}
          aoFechar={() => setEncerrar(null)}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Tirar ${rem.nome} da lista da milícia?`}
          aoConfirmar={() => d.remover('milicia', rem.id, rem.nome)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormCampanha({ inicial, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const enviar = async () => {
    if (!String(v.nome || '').trim()) { setErro('Dê um nome à convocação.'); return; }
    setOcupado(true);
    setErro('');
    try { await aoSalvar(v); }
    catch (e) { setErro(e.message || 'Não consegui abrir a campanha.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo="Abrir convocação"
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Abrindo…' : 'Abrir convocação'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <Texto rotulo="Nome da campanha" valor={v.nome} aoMudar={set('nome')}
             placeholder="Defesa da Estrada do Rift, Cerco a Shor’s Stone…" />
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Motivo da convocação" valor={v.motivo} aoMudar={set('motivo')} rows={3}
                 placeholder="Por que o Hold precisa da milícia agora." />
      <div style={{ height: 12 }} />
      <Campo rotulo="Soldo de campanha (Septims por semana)">
        <input type="number" min="0" className="mono" value={v.soldo ?? ''}
               onChange={(e) => set('soldo')(e.target.value)} />
      </Campo>
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormMiliciano({ inicial, civis = [], aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...VAZIO, ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const vinculado = v.civil_id ? civis.find((c) => c.id === v.civil_id) : null;

  const enviar = async () => {
    if (!String(v.nome || '').trim()) { setErro('Diga quem se alista.'); return; }
    setOcupado(true);
    setErro('');
    try { await aoSalvar(v); }
    catch (e) { setErro(e.message || 'Não consegui salvar.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo={inicial.id ? `Miliciano — ${inicial.nome}` : 'Inscrever na milícia'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Salvando…' : 'Salvar inscrição'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <SeletorCivil
        rotulo="Morador"
        valor={v.nome}
        aoMudar={(n) => setV((s) => ({ ...s, nome: n, civil_id: '', id_jogo: '' }))}
        aoEscolher={(c) => setV((s) => ({
          ...s, civil_id: c.id, nome: c.nome, id_jogo: c.id_jogo || '', raca: c.raca || s.raca,
        }))}
        civis={civis}
        vinculado={vinculado}
        aoDesvincular={() => setV((s) => ({ ...s, civil_id: '', id_jogo: '' }))}
      />
      <div style={{ height: 12 }} />
      <div className="grade g2">
        <Selecao rotulo="Raça" valor={v.raca} aoMudar={set('raca')} opcoes={RACAS} />
        <Texto rotulo="ID do jogo" valor={v.id_jogo} aoMudar={set('id_jogo')} className="mono"
               placeholder="preenchido pelo Registro Civil" />
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Observação" valor={v.notas} aoMudar={set('notas')} rows={2}
                 placeholder="O que ele sabe fazer, com o que pode ajudar…" />
    </Modal>
  );
}
