import React, { useState } from 'react';
import {
  Painel, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar, Campo, Stat,
} from '../../components/ui.jsx';
import { CORES_DIVISAO, ICONES_DIVISAO, STATUS_CONVITE_DIVISAO_TOM } from '../../lib/constants.js';
import {
  todasAsDivisoes, efetivoDaDivisao, operantesDaDivisao, capitaoDa,
  nomeDivisaoLivre, ordenarTropa, nomeDaPatente, ehLordeComandante,
  ehCapitaoDaDivisao, fichaMilitarDe, dataBR,
} from '../../lib/forcas.js';
import {
  enviarConviteDivisao, cancelarConviteDivisao, dispensarGuardaDaDivisao,
} from '../../lib/db.js';

const VAZIA = {
  nome: '', funcoes: '', capitao_id: '', capitao: '',
  cor: CORES_DIVISAO[0].id, icone: 'escudo', ordem: 0, ativa: true,
};

/**
 * O painel de administração das Divisões do Exército.
 *
 * Regras de autoridade:
 * - Criar e dissolver divisão: exclusivo do Palácio ou do Lorde Comandante no Quartel.
 * - Capitão da divisão: administra a própria divisão (convida soldados, aceita/dispensa e emite missões).
 */
export default function PainelDivisoes({
  dados: d,
  usuario,
  divisoes = [],
  guardas = [],
  patentes = [],
  corte = [],
  aoNavegarParaMissoes,
}) {
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);
  const [divGerenciando, setDivGerenciando] = useState(null);
  const [convidarPara, setConvidarPara] = useState(null);
  const [dispensarAlvo, setDispensarAlvo] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const convites = d.convites_divisao || [];
  const eComandante = ehLordeComandante(usuario, { corte, guardas, patentes });
  const fichaEu = fichaMilitarDe(usuario, guardas);

  const lista = todasAsDivisoes(divisoes);
  const emServico = guardas.filter((g) => g.status !== 'Aposentado');
  const tropa = ordenarTropa(emServico, patentes);

  /** O capitão aposentado continua sendo o capitão até a Corte trocar. */
  const capitaes = (div) => {
    const cap = capitaoDa(div, guardas);
    if (!cap?.id || tropa.some((g) => g.id === cap.id)) return tropa;
    return [...tropa, { ...cap, aposentado: true }];
  };

  const gravar = async (patch, rotulo) => {
    setErro('');
    setSucesso('');
    setOcupado(true);
    try {
      await d.salvar('divisoes', patch, rotulo);
    } catch (e) {
      setErro(e.message || 'Não consegui salvar a divisão.');
    } finally {
      setOcupado(false);
    }
  };

  const mover = async (indice, passo) => {
    const destino = indice + passo;
    if (ocupado || destino < 0 || destino >= lista.length) return;
    const nova = [...lista];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    setErro('');
    setOcupado(true);
    try {
      for (let i = 0; i < nova.length; i += 1) {
        if (Number(nova[i].ordem) === i + 1) continue;
        await d.salvar('divisoes', { id: nova[i].id, ordem: i + 1 }, nova[i].nome);
      }
    } catch (e) {
      setErro(e.message || 'Não consegui reordenar as divisões.');
    } finally {
      setOcupado(false);
    }
  };

  const apontarCapitao = async (div, guardaId) => {
    if (ocupado) return;
    const escolhido = guardas.find((g) => g.id === guardaId) || null;
    await gravar(
      { id: div.id, capitao_id: escolhido?.id || '', capitao: escolhido?.nome || '' },
      `${div.nome} — capitão`,
    );
  };

  const salvar = async (v) => {
    if (!nomeDivisaoLivre(v.nome, divisoes, v.id)) {
      throw new Error('Já existe uma divisão com esse nome.');
    }
    const escolhido = guardas.find((g) => g.id === v.capitao_id) || null;
    await d.salvar('divisoes', {
      ...v,
      nome: String(v.nome).trim(),
      funcoes: String(v.funcoes || '').trim(),
      capitao: escolhido?.nome || '',
      capitao_id: escolhido?.id || '',
      ordem: v.id ? v.ordem : lista.length + 1,
    }, v.nome);
    setEdit(null);
  };

  const apagar = async (div) => {
    setErro('');
    try {
      await d.remover('divisoes', div.id, div.nome);
    } catch (e) {
      setErro(e.message || 'Não consegui dissolver a divisão.');
    }
  };

  const aoDispensarSoldado = async () => {
    if (!dispensarAlvo || ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await dispensarGuardaDaDivisao(dispensarAlvo.id, usuario?.nome);
      await d.recarregar();
      setSucesso(`Soldado ${dispensarAlvo.nome} foi dispensado da divisão.`);
      setDispensarAlvo(null);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível dispensar o soldado.');
    } finally {
      setOcupado(false);
    }
  };

  const aoCancelarConvite = async (conviteId) => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await cancelarConviteDivisao(conviteId);
      await d.recarregar();
      setSucesso('Convite cancelado com sucesso.');
    } catch (ex) {
      setErro(ex.message || 'Não foi possível cancelar o convite.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <div style={{ height: 18 }} />
      <Painel
        titulo={`Divisões do Exército · ${lista.length}`}
        acoes={
          eComandante ? (
            <button className="btn primario pq" disabled={ocupado} onClick={() => setEdit({ ...VAZIA })}>
              <Icone nome="mais" tam={14} /> Nova divisão
            </button>
          ) : (
            <Selo tom="off">Criação restrita ao Lorde Comandante</Selo>
          )
        }
      >
        <p className="painel-nota">
          As divisões organizam as tropas do Hold sob o comando de seus Capitães. Capitães
          têm autonomia para gerenciar seu efetivo, convidar soldados, dispensar combatentes
          e emitir missões operacionais. A criação e dissolução de divisões são de autoridade do
          Lorde Comandante e do Palácio.
        </p>

        {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
        {sucesso && <div className="login-sucesso" style={{ marginBottom: 14 }}>{sucesso}</div>}

        {lista.length === 0 ? (
          <Vazio simb="⚔">Nenhuma divisão criada ainda.</Vazio>
        ) : (
          <div className="lista-divisoes">
            {lista.map((div, i) => {
              const efetivo = efetivoDaDivisao(div, guardas, divisoes);
              const operantes = operantesDaDivisao(div, guardas, divisoes).length;
              const cap = capitaoDa(div, guardas);
              const ehCapitaoDesta = ehCapitaoDaDivisao(usuario, div, { guardas, corte, patentes });
              const podeAdministrar = eComandante || ehCapitaoDesta;
              const convitesDaDivisao = convites.filter((c) => c.divisao_id === div.id && c.status === 'Pendente');

              return (
                <article className={`divisao-linha editavel ${div.ativa === false ? 'inativa' : ''}`} key={div.id}>
                  <span className="divisao-marca" style={{ background: div.cor || 'var(--gold)' }}>
                    <Icone nome={div.icone || 'escudo'} tam={15} cor="#15120c" />
                  </span>

                  <div className="divisao-corpo">
                    <h4>
                      {div.nome}
                      {div.ativa === false && <Selo tom="off">Desativada</Selo>}
                      {ehCapitaoDesta && <Selo tom="gold">Sua Divisão (Capitão)</Selo>}
                    </h4>
                    <p>{div.funcoes || 'Sem funções descritas — clique em editar e escreva o que esta divisão faz.'}</p>
                    
                    <div className="divisao-capitao">
                      {eComandante ? (
                        <Campo rotulo="Capitão da divisão">
                          <select
                            value={cap?.id || ''}
                            disabled={ocupado}
                            onChange={(e) => apontarCapitao(div, e.target.value)}
                          >
                            <option value="">— sem capitão —</option>
                            {capitaes(div).map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.nome} · {nomeDaPatente(g, patentes) || 'sem patente'}
                                {g.aposentado ? ' · aposentado' : ''}
                              </option>
                            ))}
                          </select>
                        </Campo>
                      ) : (
                        <div className="campo">
                          <span className="campo-rotulo">Capitão da divisão</span>
                          <span className="campo-valor-estatico">
                            {cap ? `${cap.nome} (${nomeDaPatente(cap, patentes) || 'Oficial'})` : '— sem capitão designado —'}
                          </span>
                        </div>
                      )}

                      <div className="chip-lista">
                        <Selo>{efetivo.length} na divisão</Selo>
                        <Selo tom={operantes ? 'ok' : 'off'} ponto>{operantes} operante(s)</Selo>
                        {convitesDaDivisao.length > 0 && (
                          <Selo tom="warn">{convitesDaDivisao.length} convite(s) pendente(s)</Selo>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="divisao-acoes">
                    {/* Botão de Gestão de Efetivo da Divisão */}
                    <button
                      className="btn pq primario"
                      title="Gerenciar soldados e convites desta divisão"
                      onClick={() => setDivGerenciando(div)}
                    >
                      <Icone nome="pessoa" tam={13} /> {podeAdministrar ? 'Administrar Tropa' : 'Ver Tropa'}
                    </button>

                    {podeAdministrar && (
                      <button
                        className="btn pq"
                        title="Convidar soldado para esta divisão"
                        onClick={() => setConvidarPara(div)}
                      >
                        <Icone nome="mais" tam={13} /> Convidar
                      </button>
                    )}

                    {eComandante && (
                      <>
                        <button className="btn pq fantasma" title="Subir na ordem"
                                disabled={ocupado || i === 0} onClick={() => mover(i, -1)}>↑</button>
                        <button className="btn pq fantasma" title="Descer na ordem"
                                disabled={ocupado || i === lista.length - 1} onClick={() => mover(i, 1)}>↓</button>
                        <button className="btn pq fantasma" title="Editar divisão" onClick={() => setEdit(div)}>
                          <Icone nome="lapis" tam={13} />
                        </button>
                        <button
                          className="btn pq"
                          disabled={ocupado}
                          title={div.ativa === false ? 'Reativar' : 'Desativar'}
                          onClick={() => gravar({ id: div.id, ativa: div.ativa === false }, div.nome)}
                        >
                          {div.ativa === false ? 'Reativar' : 'Desativar'}
                        </button>
                        <button
                          className="btn pq perigo"
                          title={efetivo.length ? 'Há soldados nesta divisão' : 'Dissolver divisão'}
                          disabled={ocupado || efetivo.length > 0}
                          onClick={() => setRem(div)}
                        >
                          <Icone nome="lixo" tam={13} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Painel>

      {/* Modal de Administração da Tropa da Divisão */}
      {divGerenciando && (
        <ModalGerenciarDivisao
          divisao={divGerenciando}
          guardas={guardas}
          patentes={patentes}
          convites={convites.filter((c) => c.divisao_id === divGerenciando.id)}
          podeAdministrar={eComandante || ehCapitaoDaDivisao(usuario, divGerenciando, { guardas, corte, patentes })}
          aoFechar={() => setDivGerenciando(null)}
          aoConvidar={() => {
            const d = divGerenciando;
            setDivGerenciando(null);
            setConvidarPara(d);
          }}
          aoDispensar={(soldado) => {
            setDispensarAlvo(soldado);
          }}
          aoCancelarConvite={aoCancelarConvite}
          aoEmitirMissao={() => {
            setDivGerenciando(null);
            if (aoNavegarParaMissoes) aoNavegarParaMissoes(divGerenciando.id);
          }}
        />
      )}

      {/* Modal de Enviar Convite */}
      {convidarPara && (
        <ModalConvidarSoldado
          divisao={convidarPara}
          guardasDisponiveis={guardas.filter((g) => g.status !== 'Aposentado' && g.divisao_id !== convidarPara.id)}
          patentes={patentes}
          usuario={usuario}
          remetenteFicha={fichaEu}
          aoFechar={() => setConvidarPara(null)}
          aoEnviar={async ({ guarda, mensagem }) => {
            await enviarConviteDivisao({
              divisao: convidarPara,
              guarda,
              remetente: fichaEu || { nome: usuario?.nome || 'Capitão', cargo: usuario?.cargo || 'Capitão' },
              mensagem,
            });
            await d.recarregar();
            setSucesso(`Convite enviado com sucesso para ${guarda.nome}.`);
            setConvidarPara(null);
          }}
        />
      )}

      {/* Confirmação de Dispensa de Soldado da Divisão */}
      {dispensarAlvo && (
        <Confirmar
          mensagem={`Tem certeza que deseja dispensar ${dispensarAlvo.nome} desta divisão? O soldado permanecerá no Exército como combatente geral sem divisão designada.`}
          rotulo="Dispensar da Divisão"
          aoConfirmar={aoDispensarSoldado}
          aoFechar={() => setDispensarAlvo(null)}
        />
      )}

      {edit && (
        <FormDivisao
          inicial={edit}
          tropa={capitaes(edit)}
          patentes={patentes}
          aoFechar={() => setEdit(null)}
          aoSalvar={salvar}
        />
      )}

      {rem && (
        <Confirmar
          mensagem={`Dissolver a divisão ${rem.nome}? O registro some da lista de divisões.`}
          rotulo="Dissolver"
          aoConfirmar={() => apagar(rem)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------
   Modal de Gestão Completa de Efetivo e Convites da Divisão
   ------------------------------------------------------------ */
function ModalGerenciarDivisao({
  divisao,
  guardas = [],
  patentes = [],
  convites = [],
  podeAdministrar,
  aoFechar,
  aoConvidar,
  aoDispensar,
  aoCancelarConvite,
  aoEmitirMissao,
}) {
  const membros = guardas.filter((g) => g.divisao_id === divisao.id && g.status !== 'Aposentado');
  const pendentes = convites.filter((c) => c.status === 'Pendente');

  return (
    <Modal
      titulo={`Efetivo da Divisão — ${divisao.nome}`}
      aoFechar={aoFechar}
      rodape={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {podeAdministrar && (
              <button className="btn pq" onClick={aoEmitirMissao}>
                <Icone nome="balanca" tam={13} /> Emitir Missão para a Divisão
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {podeAdministrar && (
              <button className="btn primario pq" onClick={aoConvidar}>
                <Icone nome="mais" tam={13} /> Convidar Soldado
              </button>
            )}
            <button className="btn fantasma pq" onClick={aoFechar}>Fechar</button>
          </div>
        </div>
      }
    >
      <div className="grade g3" style={{ marginBottom: 14 }}>
        <Stat rotulo="Soldados Alocados" valor={membros.length} tom="gold" />
        <Stat rotulo="Convites Pendentes" valor={pendentes.length} tom="laranja" />
        <Stat rotulo="Capitão Responsável" valor={divisao.capitao || 'Sem capitão'} tom="roxo" />
      </div>

      <h4 style={{ margin: '14px 0 8px', color: 'var(--txt-1)' }}>Soldados na Divisão ({membros.length})</h4>
      {membros.length === 0 ? (
        <Vazio simb="🛡">Nenhum soldado alocado nesta divisão no momento.</Vazio>
      ) : (
        <div className="tabela-rol" style={{ marginBottom: 18 }}>
          <table className="tabela-dados" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Soldado</th>
                <th>Patente</th>
                <th>Status</th>
                {podeAdministrar && <th style={{ textAlign: 'right' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.nome}</strong>
                    {m.id === divisao.capitao_id && <Selo tom="gold" estilo={{ marginLeft: 6 }}>Capitão</Selo>}
                  </td>
                  <td>{nomeDaPatente(m, patentes) || 'Soldado'}</td>
                  <td><Selo tom={m.status === 'Operante' ? 'ok' : 'off'}>{m.status}</Selo></td>
                  {podeAdministrar && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn pq perigo"
                        title="Dispensar soldado da divisão"
                        onClick={() => aoDispensar(m)}
                      >
                        Dispensar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Convites Pendentes */}
      <h4 style={{ margin: '18px 0 8px', color: 'var(--txt-1)' }}>Convites de Ingresso ({convites.length})</h4>
      {convites.length === 0 ? (
        <p className="ajuda">Nenhum convite emitido para esta divisão.</p>
      ) : (
        <div className="lista-convites-divisao" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {convites.map((c) => (
            <div key={c.id} className="convite-item" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6,
            }}>
              <div>
                <strong>{c.guarda_nome}</strong>
                <span style={{ margin: '0 8px', color: 'var(--txt-3)' }}>·</span>
                <Selo tom={STATUS_CONVITE_DIVISAO_TOM[c.status] || 'off'} ponto>{c.status}</Selo>
                {c.mensagem && <small style={{ display: 'block', color: 'var(--txt-2)' }}>"{c.mensagem}"</small>}
                <small style={{ color: 'var(--txt-3)' }}>Enviado por {c.remetente_nome} em {dataBR(c.criado_em)}</small>
              </div>

              {podeAdministrar && c.status === 'Pendente' && (
                <button
                  className="btn pq perigo"
                  onClick={() => aoCancelarConvite(c.id)}
                >
                  Cancelar Convite
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------
   Modal de Envio de Convite para Soldado
   ------------------------------------------------------------ */
function ModalConvidarSoldado({ divisao, guardasDisponiveis = [], patentes = [], usuario, remetenteFicha, aoFechar, aoEnviar }) {
  const [guardaId, setGuardaId] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    if (!guardaId) {
      setErro('Selecione o soldado a convidar.');
      return;
    }
    const guarda = guardasDisponiveis.find((g) => g.id === guardaId);
    if (!guarda) {
      setErro('Soldado inválido.');
      return;
    }

    setOcupado(true);
    setErro('');
    try {
      await aoEnviar({ guarda, mensagem });
    } catch (e) {
      setErro(e.message || 'Não foi possível enviar o convite.');
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={`Convidar Soldado para ${divisao.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado || !guardasDisponiveis.length} onClick={enviar}>
            {ocupado ? 'Enviando…' : 'Enviar Convite'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      <p className="ajuda" style={{ marginBottom: 14 }}>
        O soldado receberá o convite oficial em seu Registro Militar e no Quadro de Avisos.
        Ele poderá aceitar para ingressar na divisão ou recusar a proposta.
      </p>

      {guardasDisponiveis.length === 0 ? (
        <Vazio simb="🛡">Todos os soldados em serviço já estão nesta divisão.</Vazio>
      ) : (
        <>
          <Selecao
            rotulo="Soldado a ser convidado"
            valor={guardaId}
            aoMudar={setGuardaId}
            vazioLabel="— escolha um soldado —"
            opcoes={guardasDisponiveis.map((g) => ({
              valor: g.id,
              rotulo: `${g.nome} · ${nomeDaPatente(g, patentes) || 'Soldado'} ${g.divisao ? `(atualmente em: ${g.divisao})` : '(sem divisão)'}`,
            }))}
          />

          <div style={{ height: 14 }} />
          <AreaTexto
            rotulo="Mensagem do Comando / Capitão (opcional)"
            valor={mensagem}
            aoMudar={setMensagem}
            rows={3}
            placeholder="Ex.: 'A Divisão convoca sua destreza para nossas fileiras…'"
          />
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormDivisao({ inicial, tropa = [], patentes = [], aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...VAZIA, ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const enviar = async () => {
    if (!String(v.nome || '').trim()) { setErro('Dê um nome à divisão.'); return; }
    setOcupado(true);
    setErro('');
    try { await aoSalvar(v); }
    catch (e) { setErro(e.message || 'Não consegui salvar.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo={inicial.id ? `Divisão — ${inicial.nome}` : 'Nova divisão'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Salvando…' : 'Salvar divisão'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <Texto rotulo="Nome da divisão" valor={v.nome} aoMudar={set('nome')} placeholder="Guarda da Cidade, Cavaleiros Negros…" />
      <div style={{ height: 12 }} />
      <AreaTexto
        rotulo="Funções da divisão"
        valor={v.funcoes}
        aoMudar={set('funcoes')}
        rows={3}
        placeholder="O que esta divisão faz no dia a dia do Hold — ronda, fronteira, investigação, choque…"
      />
      <div style={{ height: 12 }} />
      <Selecao
        rotulo="Capitão da divisão"
        valor={v.capitao_id}
        aoMudar={set('capitao_id')}
        vazioLabel="— sem capitão —"
        opcoes={tropa.map((g) => ({ valor: g.id, rotulo: `${g.nome} · ${nomeDaPatente(g, patentes) || 'sem patente'}` }))}
      />

      <div style={{ height: 16 }} />
      <Campo rotulo="Cor do estandarte">
        <div className="paleta">
          {CORES_DIVISAO.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`paleta-cor ${v.cor === c.id ? 'ativa' : ''}`}
              style={{ background: c.id }}
              title={c.nome}
              onClick={() => set('cor')(c.id)}
            />
          ))}
        </div>
      </Campo>

      <div style={{ height: 12 }} />
      <Campo rotulo="Símbolo">
        <div className="paleta">
          {ICONES_DIVISAO.map((ic) => (
            <button
              key={ic.id}
              type="button"
              className={`paleta-icone ${v.icone === ic.id ? 'ativa' : ''}`}
              title={ic.nome}
              onClick={() => set('icone')(ic.id)}
            >
              <Icone nome={ic.id} tam={16} cor={v.icone === ic.id ? 'var(--gold)' : 'var(--txt-3)'} />
            </button>
          ))}
        </div>
      </Campo>

      <div style={{ height: 12 }} />
      <label className="linha-check">
        <input type="checkbox" checked={v.ativa !== false} onChange={(e) => set('ativa')(e.target.checked)} />
        <span>Divisão ativa — aparece na escala e recebe novos alistados.</span>
      </label>
    </Modal>
  );
}
