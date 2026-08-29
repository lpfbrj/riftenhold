import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { salvarPericiasProprias, responderConviteDivisao, desinscreverDeMissao } from '../lib/db.js';
import { NIVEIS, GRUPOS_PERICIA, CICLO_SALARIO, STATUS_MISSAO_TOM } from '../lib/constants.js';
import { poderDe } from './Exercito.jsx';
import { Painel, Stat, Selo, Icone, Vazio, Pips, Confirmar } from '../components/ui.jsx';
import {
  divisaoDe, nomeDaDivisao, nomeDaPatente, capitaoDa, soldoDe, dataBR, septims,
  convitesPendentesDoSoldado,
} from '../lib/forcas.js';

/**
 * A ficha militar do próprio soldado. Patente, divisão, soldo e status
 * são decisão do comando — ele lê, não muda.
 *
 * Além das habilidades e soldo, o soldado gerencia:
 * - Convites de Divisão: Aceita ou recusa convites enviados pelos capitães.
 * - Missões Atribuídas e Voluntariadas: Acompanha suas missões e recompensas.
 */
export default function MinhaFichaMilitar({ usuario }) {
  const d = useDados();
  const guardas = d.guardas || [];
  const divisoes = d.divisoes || [];
  const patentes = d.patentes || [];
  const convites = d.convites_divisao || [];
  const missoes = d.missoes_exercito || [];

  const eu = useMemo(() => guardas.find(
    (g) => g.id === usuario.guarda_id ||
           g.civil_id === usuario.civil_id ||
           (g.id_jogo && String(g.id_jogo).toLowerCase() === String(usuario.id_jogo || '').toLowerCase()),
  ) || null, [guardas, usuario]);

  const [rascunho, setRascunho] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const relogio = useRef(null);
  useEffect(() => () => clearTimeout(relogio.current), []);

  if (!eu) {
    return (
      <Painel titulo="Ficha militar não encontrada">
        <Vazio simb="⚔">
          Seu alistamento não está mais no Exército de Riften. Procure o Lorde Comandante.
        </Vazio>
      </Painel>
    );
  }

  const minhaDivisao = divisaoDe(eu, divisoes);
  const capitao = minhaDivisao ? capitaoDa(minhaDivisao, guardas) : null;
  const soldo = soldoDe(eu, patentes);
  const meusConvites = convitesPendentesDoSoldado(eu, convites);

  // Minhas missões inscritas
  const minhasMissoes = missoes.filter(
    (m) => Array.isArray(m.participantes) && m.participantes.some((p) => p.guarda_id === eu.id),
  );

  const editando = rascunho !== null;
  const pericias = editando ? rascunho.pericias : (eu.pericias || {});
  const { pct } = poderDe({ pericias });
  const atual = poderDe(eu).pct;

  const setPericia = (p, n) =>
    setRascunho((s) => ({ ...s, pericias: { ...s.pericias, [p]: n } }));
  const preencherGrupo = (grp, n) =>
    setRascunho((s) => ({
      ...s, pericias: { ...s.pericias, ...Object.fromEntries(grp.pericias.map((p) => [p, n])) },
    }));

  const salvar = async () => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await salvarPericiasProprias(usuario, eu.id, rascunho.pericias, rascunho.notas);
      await d.recarregar();
      setRascunho(null);
      setSalvo(true);
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setSalvo(false), 3500);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível salvar agora.');
    } finally {
      setOcupado(false);
    }
  };

  const aoResponderConvite = async (conviteId, resposta, divNome) => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await responderConviteDivisao({
        conviteId,
        resposta,
        usuario,
        divisaoNome: divNome,
      });
      await d.recarregar();
      setMensagemSucesso(
        resposta === 'aceitar'
          ? `Convite aceito! Você agora faz parte da divisão ${divNome}.`
          : 'Convite recusado com sucesso.',
      );
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setMensagemSucesso(''), 4000);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível responder ao convite.');
    } finally {
      setOcupado(false);
    }
  };

  const aoCancelarInscricaoMissao = async (missaoId) => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await desinscreverDeMissao(missaoId, eu.id);
      await d.recarregar();
      setMensagemSucesso('Inscrição cancelada com sucesso.');
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setMensagemSucesso(''), 3500);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível cancelar a inscrição.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Meu registro militar</h1>
          <p>
            Patente, divisão e soldo são do comando — quem muda isso é o Lorde
            Comandante. As habilidades e missões são suas: mantenha-as em dia.
          </p>
        </div>
        {!editando && (
          <div className="acoes">
            <button
              className="btn primario"
              onClick={() => setRascunho({ pericias: { ...(eu.pericias || {}) }, notas: eu.notas || '' })}
            >
              <Icone nome="lapis" tam={15} /> Editar habilidades
            </button>
          </div>
        )}
      </div>
      <div className="regra" />

      {salvo && (
        <div className="aviso-ok" style={{ marginBottom: 16 }}>
          <Icone nome="selo" tam={15} /> Habilidades salvas. O comando já enxerga a atualização.
        </div>
      )}

      {mensagemSucesso && (
        <div className="aviso-ok" style={{ marginBottom: 16 }}>
          <Icone nome="selo" tam={15} /> {mensagemSucesso}
        </div>
      )}

      {erro && (
        <div className="login-erro" style={{ marginBottom: 16 }}>
          {erro}
        </div>
      )}

      {/* Convites de Divisão Pendentes */}
      {meusConvites.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Painel titulo={`Convites de Divisão Pendentes · ${meusConvites.length}`} destaque>
            <p className="painel-nota">
              Capitães de Divisão convocaram você para integrar suas fileiras. Analise o convite e escolha aceitar ou recusar:
            </p>

            <div className="lista-convites-pendentes" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {meusConvites.map((c) => {
                const divAlvo = divisoes.find((d) => d.id === c.divisao_id);
                return (
                  <div
                    key={c.id}
                    className="convite-card"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                      padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 8, borderLeft: `4px solid ${divAlvo?.cor || 'var(--gold)'}`,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>
                        Convite para: <strong>{c.divisao_nome}</strong>
                      </h4>
                      <p style={{ margin: 0, color: 'var(--txt-2)', fontSize: 13 }}>
                        Enviado por <strong>{c.remetente_nome}</strong> ({c.remetente_cargo || 'Capitão'}) em {dataBR(c.criado_em)}
                      </p>
                      {c.mensagem && (
                        <p style={{ margin: '6px 0 0', fontStyle: 'italic', color: 'var(--txt-1)', fontSize: 13 }}>
                          "{c.mensagem}"
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn primario pq"
                        disabled={ocupado}
                        onClick={() => aoResponderConvite(c.id, 'aceitar', c.divisao_nome)}
                      >
                        <Icone nome="selo" tam={13} /> Aceitar e Ingressar
                      </button>
                      <button
                        className="btn perigo pq"
                        disabled={ocupado}
                        onClick={() => aoResponderConvite(c.id, 'recusar', c.divisao_nome)}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Painel>
        </div>
      )}

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Patente" valor={nomeDaPatente(eu, patentes) || '—'} sub="definida pelo comando" tom="verde" />
        <Stat rotulo="Divisão" valor={nomeDaDivisao(eu, divisoes) || '—'}
              sub={capitao ? `Capitão ${capitao.nome}` : (minhaDivisao ? 'sem capitão' : 'sem divisão alocada')} tom="roxo" />
        <Stat rotulo="Situação" valor={eu.status || '—'} sub="no Exército"
              tom={eu.status === 'Operante' ? 'verde' : 'laranja'} />
        <Stat rotulo="Aptidão" valor={`${editando ? pct : atual}%`}
              sub={editando && pct !== atual ? `era ${atual}%` : 'média das 25 perícias'} tom="laranja" />
      </div>

      <Painel
        titulo="Identificação"
        acoes={<Selo tom="ok"><span className="mono">ID {eu.id_jogo || usuario.id_jogo}</span></Selo>}
      >
        <div className="grade g4">
          <Dado rotulo="Nome" valor={eu.nome} />
          <Dado rotulo="Raça" valor={eu.raca} />
          <Dado rotulo="Patente" valor={nomeDaPatente(eu, patentes)} />
          <Dado rotulo="Divisão" valor={nomeDaDivisao(eu, divisoes) || 'Nenhuma (Combatente Geral)'} />
        </div>
        {minhaDivisao?.funcoes && (
          <p className="painel-nota" style={{ margin: '12px 0 0' }}>
            <strong>{minhaDivisao.nome}</strong> — {minhaDivisao.funcoes}
          </p>
        )}
        <p className="ajuda" style={{ marginTop: 10 }}>
          <Icone nome="livro" tam={13} /> Seus dados civis — nome, raça, ofício, propriedades —
          ficam na Cidade de Riften, e você entra lá com estas mesmas credenciais.
        </p>
      </Painel>

      <div style={{ height: 16 }} />

      {/* Minhas Missões */}
      <Painel titulo={`Minhas Missões Militares · ${minhasMissoes.length}`}>
        {minhasMissoes.length === 0 ? (
          <Vazio simb="⚔">Você não está inscrito em nenhuma missão no momento. Acesse o Quartel &gt; Missões para se voluntariar.</Vazio>
        ) : (
          <div className="lista-minhas-missoes" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {minhasMissoes.map((m) => (
              <div
                key={m.id}
                className="minha-missao-item"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                  padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 6,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--txt-1)' }}>{m.numero || 'MIS'}</span>
                    <strong style={{ fontSize: 15 }}>{m.titulo}</strong>
                    <Selo tom={STATUS_MISSAO_TOM[m.status] || 'warn'} ponto>{m.status}</Selo>
                  </div>
                  <p style={{ margin: 0, color: 'var(--txt-2)', fontSize: 13 }}>
                    <strong>Objetivo:</strong> {m.objetivo}
                  </p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--txt-3)' }}>
                    <span>Recompensa: <strong style={{ color: 'var(--gold)' }}>{septims(m.recompensa)}</strong></span>
                    <span>Prazo: <strong>{m.prazo ? dataBR(m.prazo) : 'Sem prazo'}</strong></span>
                    <span>Divisão: <strong>{m.divisao_nome || 'Geral'}</strong></span>
                  </div>
                </div>

                <div>
                  {m.status === 'Aberta' && (
                    <button
                      className="btn perigo pq"
                      disabled={ocupado}
                      onClick={() => aoCancelarInscricaoMissao(m.id)}
                    >
                      Cancelar Inscrição
                    </button>
                  )}
                  {m.status === 'Concluída' && (
                    <Selo tom="ok">Recompensa Homologada</Selo>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      <Painel
        titulo="Registro de Habilidades"
        acoes={editando
          ? <Selo tom="warn" ponto>Editando</Selo>
          : <Selo>{GRUPOS_PERICIA.reduce((s, g) => s + g.pericias.length, 0)} perícias</Selo>}
      >
        {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}

        <div className="grade g2">
          {GRUPOS_PERICIA.map((grp) => (
            <div className="grupo-pericia" key={grp.id}>
              <h4>
                {grp.nome}
                {editando && (
                  <select
                    onChange={(e) => { if (e.target.value) preencherGrupo(grp, e.target.value); e.target.value = ''; }}
                    defaultValue=""
                    className="mini-select"
                    title="Preencher o grupo inteiro"
                  >
                    <option value="">preencher…</option>
                    {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
              </h4>
              {grp.pericias.map((p) => (
                <div className="pericia-linha" key={p}>
                  <span className="nm">{p}</span>
                  <Pips nivel={pericias[p]} />
                  {editando ? (
                    <select
                      value={pericias[p] || 'N/A'}
                      onChange={(e) => setPericia(p, e.target.value)}
                      className="mini-select largo"
                    >
                      {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <span className="lv">{pericias[p] || 'N/A'}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {editando && (
          <footer className="ficha-acoes">
            <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
              Aptidão com estas mudanças: <strong style={{ color: 'var(--gold)' }}>{pct}%</strong>
            </span>
            <button className="btn fantasma" onClick={() => { setRascunho(null); setErro(''); }}>Cancelar</button>
            <button className="btn primario" disabled={ocupado} onClick={salvar}>
              {ocupado ? 'Salvando…' : 'Salvar habilidades'}
            </button>
          </footer>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      <Painel titulo="Meu soldo">
        <div className="grade g3">
          <Stat rotulo="Soldo semanal" valor={septims(soldo.valor)} sub="pago pelo tesouro do Hold" />
          <Stat rotulo="Último pagamento" valor={dataBR(soldo.pagoEm)}
                sub={soldo.nunca ? 'você ainda não recebeu' : `registrado por ${eu.pago_por || 'Corte'}`} />
          <Stat rotulo="Próximo pagamento" valor={soldo.proximo ? dataBR(soldo.proximo) : '—'}
                sub={soldo.nunca ? 'assim que o comando pagar'
                  : soldo.vencido ? 'vencido — procure o comando'
                    : `em ${soldo.dias} dia(s)`}
                tom={soldo.vencido ? 'laranja' : 'verde'} />
        </div>
        <p className="ajuda" style={{ marginTop: 10 }}>
          <Icone nome="moeda" tam={13} /> O soldo é semanal: cada pagamento vale por
          {' '}{CICLO_SALARIO} dias.
        </p>
      </Painel>

      <div style={{ height: 16 }} />

      <Painel titulo="Observações do comando">
        {eu.notas
          ? <p style={{ margin: 0, color: 'var(--txt-2)', fontSize: 13, lineHeight: 1.6 }}>{eu.notas}</p>
          : <Vazio simb="✦">Nada anotado na sua ficha.</Vazio>}
      </Painel>
    </>
  );
}

function Dado({ rotulo, valor }) {
  return (
    <div className="dado">
      <span className="dado-rot">{rotulo}</span>
      <span className="dado-val">{valor || '—'}</span>
    </div>
  );
}
