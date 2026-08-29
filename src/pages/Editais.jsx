import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  minhasPropriedades, ehDonoDaPropriedade, normalizarEdital,
  abrirEditalPropriedade, enviarProposta, retirarProposta, decidirEditalPropriedade,
} from '../lib/db.js';
import {
  TIPOS_EDITAL, TIPO_EDITAL_POR_ID, MODALIDADES, PRAZOS, PRAZO_TOM, NIVEIS, NIVEL_VALOR,
  PROFISSOES, GRUPOS_PERICIA, STATUS_EDITAL_TOM, STATUS_PROPOSTA_TOM, ORGAOS,
} from '../lib/constants.js';
import {
  elegibilidade, meusEditais, proximoNumero, objetoDoEdital, prazosAceitos,
  trabalhoDe, periciasEmFalta,
} from '../lib/editais.js';
import { recadoPara } from './Avisos.jsx';
import { septims } from './Propriedades.jsx';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Campo, Icone, Vazio, Pips, Confirmar,
} from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

const EM_CONTRATO = ['Contratado', 'Cumprido', 'Rompido'];

/**
 * EDITAIS E CONTRATOS
 *
 * O canal por onde o Hold pede e a cidade se oferece. Palácio, Quartel
 * e os comércios abrem editais; trabalhadores e comércios respondem com
 * preço e prazo; a proposta escolhida vira contrato.
 *
 * A mesma tela serve as três portas — muda o que cada uma pode fazer:
 *   · Corte    — abre em nome do Palácio, julga o que é seu, vê tudo
 *                e pode encerrar qualquer edital do Hold.
 *   · Quartel  — abre em nome do Quartel General e julga o que é seu.
 *   · Morador  — responde aos editais e, se for dono de propriedade,
 *                abre editais em nome dela (só para trabalhadores).
 */
export default function Editais({ usuario }) {
  const d = useDados();
  const daCorte = usuario.tipo === 'corte';
  const doQuartel = usuario.tipo === 'soldado';
  const morador = usuario.tipo === 'cidadao';

  const props = useMemo(
    () => minhasPropriedades(usuario, d.propriedades || []), [usuario, d.propriedades],
  );
  const casasQueMando = props.filter((p) => ehDonoDaPropriedade(usuario, p));

  const [abrindo, setAbrindo] = useState(null);
  const [aberto, setAberto] = useState(null);     // id do edital em foco
  const [confirmar, setConfirmar] = useState(null);
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [soMeus, setSoMeus] = useState(false);
  const [fContrato, setFContrato] = useState('');
  const [salvo, setSalvo] = useState('');
  const [erro, setErro] = useState('');
  const relogio = useRef(null);

  const avisar = (t, ms = 5000) => {
    clearTimeout(relogio.current);
    setSalvo(t);
    relogio.current = setTimeout(() => setSalvo(''), ms);
  };
  useEffect(() => () => clearTimeout(relogio.current), []);

  const editais = d.editais || [];
  const propostas = d.propostas || [];
  const meus = useMemo(() => meusEditais(usuario, d), [usuario, d]);
  const meusIds = meus.map((e) => e.id);
  const emFoco = editais.find((e) => e.id === aberto) || null;

  const propostasDe = (edital) => propostas.filter((p) => p.edital_id === edital?.id);
  const minhasPropostas = propostas.filter((p) => p.candidato_civil_id === usuario.civil_id);

  const abertos = editais.filter((e) => e.status === 'Aberto');
  const contratos = editais.filter((e) => EM_CONTRATO.includes(e.status));
  const contratosVisiveis = contratos.filter((e) => !fContrato || e.status === fContrato);
  const aguardando = propostas.filter(
    (p) => p.status === 'Enviada' && meusIds.includes(p.edital_id),
  );

  const podeAbrir = daCorte || doQuartel || casasQueMando.length > 0;

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return abertos
      .filter((e) => (!fTipo || e.tipo === fTipo))
      .filter((e) => (!soMeus || meusIds.includes(e.id)))
      .filter((e) => !t || [e.numero, e.titulo, e.orgao_nome, objetoDoEdital(e)]
        .join(' ').toLowerCase().includes(t))
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  }, [abertos, busca, fTipo, soMeus, meusIds]);

  /* -------- gravação, por porta --------
     A Corte e o Quartel gravam direto. O morador que responde por uma
     propriedade passa pela função que confere o vínculo dele com a casa. */
  const aplicar = async ({ edital, patchEdital = null, patchesPropostas = [], avisos = [], rotulo }) => {
    if (morador && edital.orgao_tipo === 'propriedade') {
      const prop = props.find((p) => p.id === edital.propriedade_id);
      await decidirEditalPropriedade(usuario, prop, {
        edital, patchEdital, propostas: patchesPropostas, avisos,
      });
      await d.recarregar();
      return;
    }
    for (const p of patchesPropostas) {
      const atual = propostas.find((x) => x.id === p.id);
      if (atual) await d.salvar('propostas', { ...atual, ...p.patch }, rotulo);
    }
    if (patchEdital) await d.salvar('editais', { ...edital, ...patchEdital }, rotulo || edital.titulo);
    for (const a of avisos) await d.salvar('avisos', a, a.titulo);
  };

  /* -------- abrir um edital -------- */
  const abrir = async (v) => {
    setErro('');
    const numero = proximoNumero(editais);
    const chamada = recadoPara('', `Edital ${numero} — ${v.titulo}`, textoDoChamado(v, numero), v.orgao_nome);
    try {
      if (v.orgao_tipo === 'propriedade') {
        const prop = casasQueMando.find((p) => p.id === v.propriedade_id);
        if (!prop) throw new Error('Escolha por qual propriedade você está abrindo o edital.');
        await abrirEditalPropriedade(usuario, prop, { ...v, numero }, chamada);
        await d.recarregar();
      } else {
        const edital = normalizarEdital({ ...v, numero }, {
          orgao_tipo: v.orgao_tipo,
          orgao_nome: ORGAOS[v.orgao_tipo].nome,
          local: 'Riften',
          autor: usuario.nome,
          autor_civil_id: usuario.civil_id || '',
        });
        await d.salvar('editais', edital, `${numero} — ${edital.titulo}`);
        await d.salvar('avisos', chamada, chamada.titulo);
      }
      setAbrindo(null);
      avisar(`Edital ${numero} publicado. O chamado já está no Quadro de Avisos de todo o Hold.`);
    } catch (ex) { setErro(ex.message || 'Não foi possível abrir o edital agora.'); }
  };

  /* -------- julgar uma proposta --------
     Um edital de várias vagas continua aberto enquanto sobrarem vagas:
     só quando a última é preenchida ele vira contrato e as propostas
     que restaram são dispensadas de uma vez. */
  const [julgando, setJulgando] = useState('');

  const julgar = async (edital, proposta, aceitar, motivo = '') => {
    setErro('');
    if (julgando) return;
    if (edital.status !== 'Aberto') {
      setErro('Este edital não está mais aberto.');
      return;
    }
    const agora = new Date().toISOString();
    const quem = proposta.como === 'propriedade' ? proposta.propriedade_nome : proposta.candidato;
    // Recado pessoal só existe com destinatário: sem civil_id, o aviso viraria
    // publicação para o Hold inteiro.
    const recado = (civil, titulo, texto) => (civil
      ? [recadoPara(civil, titulo, texto, edital.orgao_nome)] : []);

    setJulgando(proposta.id);
    try {
      if (!aceitar) {
        await aplicar({
          edital,
          patchesPropostas: [{ id: proposta.id, patch: { status: 'Recusada', resposta: motivo, respondido_em: agora } }],
          avisos: recado(proposta.candidato_civil_id,
            `Proposta recusada no edital ${edital.numero}`,
            `${edital.orgao_nome} recusou a sua proposta para "${edital.titulo}".`
            + (motivo ? ` Motivo: ${motivo}` : '')),
          rotulo: `${edital.numero} — proposta recusada`,
        });
        avisar(`Proposta de ${quem} recusada. ${proposta.candidato} foi avisado no Quadro de Avisos.`);
        return;
      }

      const aceitasAntes = propostasDe(edital).filter((p) => p.status === 'Aceita').length;
      const vagas = Math.max(1, Number(edital.vagas) || 1);
      const ultima = aceitasAntes + 1 >= vagas;
      const pendentes = propostasDe(edital)
        .filter((p) => p.id !== proposta.id && p.status === 'Enviada');
      const dispensadas = ultima ? pendentes : [];

      await aplicar({
        edital,
        patchEdital: ultima ? {
          status: 'Contratado',
          contratado_em: agora,
          proposta_id: proposta.id,
          contratado: quem,
          contratado_civil_id: proposta.candidato_civil_id || '',
          contratado_como: proposta.como,
          valor: proposta.preco || 0,
          prazo_contratado: proposta.prazo,
        } : null,
        patchesPropostas: [
          { id: proposta.id, patch: { status: 'Aceita', resposta: motivo, respondido_em: agora } },
          ...dispensadas.map((p) => ({
            id: p.id,
            patch: { status: 'Recusada', respondido_em: agora, resposta: 'Outra proposta foi escolhida.' },
          })),
        ],
        avisos: [
          ...recado(proposta.candidato_civil_id,
            `Contrato firmado — edital ${edital.numero}`,
            `${edital.orgao_nome} escolheu a sua proposta para "${edital.titulo}"`
            + (proposta.preco ? `, por ${septims(proposta.preco)}` : '')
            + `, com entrega ${String(proposta.prazo).toLowerCase()}. `
            + `Procure ${edital.autor || edital.orgao_nome} para cumprir o combinado.`),
          ...dispensadas.flatMap((p) => recado(p.candidato_civil_id,
            `Edital ${edital.numero} encerrado`,
            `O edital "${edital.titulo}" foi contratado com outra proposta. `
            + 'Obrigado por concorrer — fique de olho nos próximos chamados.')),
        ],
        rotulo: `${edital.numero} — contratado com ${quem}`,
      });

      const restam = vagas - (aceitasAntes + 1);
      avisar(ultima
        ? `Contrato firmado com ${quem}.`
          + (dispensadas.length ? ` As outras ${dispensadas.length} propostas foram dispensadas.` : '')
        : `${quem} foi contratado. Ainda ${restam === 1 ? 'resta 1 vaga' : `restam ${restam} vagas`} neste edital.`);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível registrar a decisão agora.');
    } finally {
      setJulgando('');
    }
  };

  /* -------- encerrar: cumprido, rompido ou cancelado -------- */
  const encerrar = async (edital, status, motivo = '') => {
    setErro('');
    const agora = new Date().toISOString();
    const texto = {
      Cumprido: `O contrato do edital "${edital.titulo}" foi dado por cumprido por ${edital.orgao_nome}. Obrigado pelo serviço prestado ao Hold.`,
      Rompido: `${edital.orgao_nome} rompeu o contrato do edital "${edital.titulo}".${motivo ? ` Motivo: ${motivo}` : ''}`,
      Cancelado: `${edital.orgao_nome} cancelou o edital "${edital.titulo}".${motivo ? ` Motivo: ${motivo}` : ''}`,
    }[status];

    const pendentes = status === 'Cancelado'
      ? propostasDe(edital).filter((p) => p.status === 'Enviada')
      : [];
    const destinos = status === 'Cancelado'
      ? pendentes.map((p) => p.candidato_civil_id)
      : [edital.contratado_civil_id];

    try {
      await aplicar({
        edital,
        patchEdital: {
          status,
          encerrado_em: agora,
          motivo_encerramento: motivo,
        },
        patchesPropostas: pendentes.map((p) => ({
          id: p.id, patch: { status: 'Recusada', respondido_em: agora, resposta: 'Edital cancelado.' },
        })),
        avisos: destinos.filter(Boolean).map(
          (civil) => recadoPara(civil, `Edital ${edital.numero} — ${status.toLowerCase()}`, texto, edital.orgao_nome),
        ),
        rotulo: `${edital.numero} — ${status.toLowerCase()}`,
      });
      avisar(`Edital ${edital.numero} ${status.toLowerCase()}.`);
      return true;
    } catch (ex) {
      setErro(ex.message || 'Não foi possível encerrar agora.');
      return false;
    }
  };

  /* -------- propor e desistir -------- */
  const propor = async (edital, v) => {
    setErro('');
    try {
      await enviarProposta(usuario, edital, v);
      await d.recarregar();
      avisar(`Proposta enviada ao edital ${edital.numero}. ${edital.orgao_nome} vai avaliar.`);
    } catch (ex) { setErro(ex.message || 'Não foi possível enviar a proposta agora.'); throw ex; }
  };
  const desistir = async (proposta) => {
    setErro('');
    try {
      await retirarProposta(usuario, proposta);
      await d.recarregar();
      avisar('Proposta retirada.');
    } catch (ex) { setErro(ex.message || 'Não foi possível retirar agora.'); }
  };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Editais e Contratos</h1>
          <p>
            {daCorte && 'O que o Hold pede e quem se ofereceu. O Palácio publica os seus chamados, acompanha os do Quartel e dos comércios, e guarda o registro dos contratos.'}
            {doQuartel && 'O Quartel abre chamados de fornecimento, serviço e recrutamento. Quem se inscreve são trabalhadores e comércios da cidade.'}
            {morador && 'Os chamados abertos em Riften. Concorra como trabalhador ou por um dos seus comércios — cada edital diz a quem se dirige.'}
          </p>
        </div>
        {podeAbrir && (
          <div className="acoes">
            <button className="btn primario" onClick={() => setAbrindo({})}>
              <Icone nome="mais" tam={15} /> Abrir edital
            </button>
          </div>
        )}
      </div>
      <div className="regra" />

      {salvo && <div className="aviso-ok"><Icone nome="selo" tam={15} /> {salvo}</div>}
      {erro && <div className="login-erro" style={{ marginBottom: 16 }}>{erro}</div>}

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Editais abertos" valor={abertos.length}
              sub={abertos.length ? 'chamados no Hold' : 'nada aberto'} tom={abertos.length ? 'laranja' : ''} />
        {meus.length > 0 || !morador ? (
          <Stat rotulo="Propostas a julgar" valor={aguardando.length}
                sub={aguardando.length ? 'esperando você' : 'nada na fila'}
                tom={aguardando.length ? 'roxo' : ''} />
        ) : (
          <Stat rotulo="Minhas propostas" valor={minhasPropostas.length}
                sub={minhasPropostas.filter((p) => p.status === 'Enviada').length
                  ? `${minhasPropostas.filter((p) => p.status === 'Enviada').length} aguardando resposta`
                  : 'nada em aberto'}
                tom={minhasPropostas.some((p) => p.status === 'Enviada') ? 'roxo' : ''} />
        )}
        <Stat rotulo="Contratos em andamento"
              valor={contratos.filter((e) => e.status === 'Contratado').length}
              sub="firmados e não cumpridos" tom="verde" />
        <Stat rotulo="Contratos cumpridos"
              valor={contratos.filter((e) => e.status === 'Cumprido').length}
              sub="a palavra dada, cumprida" />
      </div>

      {/* -------- Editais abertos -------- */}
      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Número, título, objeto ou órgão…" />
        </div>
        <Selecao rotulo="Tipo" valor={fTipo} aoMudar={setFTipo}
                 opcoes={TIPOS_EDITAL.map((t) => t.id)} vazioLabel="Todos" />
        {meus.length > 0 && (
          <button className={`btn ${soMeus ? 'primario' : 'fantasma'}`}
                  onClick={() => setSoMeus(!soMeus)}>
            Só os meus
          </button>
        )}
      </div>

      <Painel
        titulo="Editais abertos"
        acoes={
          <Selo tom={visiveis.length ? 'warn' : 'off'} ponto>
            {visiveis.length === abertos.length
              ? `${visiveis.length} na praça`
              : `${visiveis.length} de ${abertos.length}`}
          </Selo>
        }
      >
        {visiveis.length === 0 ? (
          <Vazio simb="§">
            {abertos.length
              ? 'Nenhum edital com esse filtro.'
              : 'Nenhum edital aberto. Quando o Palácio, o Quartel ou um comércio precisar de algo, o chamado aparece aqui.'}
          </Vazio>
        ) : (
          <div className="edital-grade">
            {visiveis.map((e) => (
              <CartaoEdital
                key={e.id}
                edital={e}
                propostas={propostasDe(e)}
                meu={meusIds.includes(e.id)}
                parecer={morador ? elegibilidade(e, usuario, d) : null}
                aoAbrir={() => setAberto(e.id)}
              />
            ))}
          </div>
        )}
      </Painel>

      {/* -------- Minhas propostas -------- */}
      {morador && minhasPropostas.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Painel titulo="Minhas propostas" acoes={<Selo>{minhasPropostas.length}</Selo>}>
            <div className="tabela-wrap">
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr><th>Edital</th><th>Como</th><th>Preço</th><th>Prazo</th>
                    <th>Situação</th><th className="col-acoes"></th></tr>
                </thead>
                <tbody>
                  {[...minhasPropostas]
                    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
                    .map((p) => {
                      const ed = editais.find((x) => x.id === p.edital_id);
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className="nome-forte">{p.edital_titulo}</span>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                              {p.edital_numero} · {ed?.orgao_nome || '—'}
                            </div>
                          </td>
                          <td>
                            {p.como === 'propriedade'
                              ? <Selo tom="gold">{p.propriedade_nome}</Selo>
                              : <Selo>{p.profissao || 'Trabalhador'}</Selo>}
                          </td>
                          <td className="mono" style={{ color: 'var(--gold-2)' }}>
                            {p.preco ? septims(p.preco) : '—'}
                          </td>
                          <td><Selo tom={PRAZO_TOM[p.prazo]}>{p.prazo}</Selo></td>
                          <td>
                            <Selo tom={STATUS_PROPOSTA_TOM[p.status]} ponto>{p.status}</Selo>
                            {p.resposta && <div className="pendente-nota">“{p.resposta}”</div>}
                          </td>
                          <td className="col-acoes">
                            <button className="btn pq fantasma" onClick={() => setAberto(p.edital_id)}>Ver</button>
                            {p.status === 'Enviada' && (
                              <>
                                {' '}
                                <button className="btn pq perigo"
                                        onClick={() => setConfirmar({
                                          mensagem: `Retirar a sua proposta do edital ${p.edital_numero}?`,
                                          rotulo: 'Retirar proposta',
                                          acao: () => desistir(p),
                                        })}>
                                  Retirar
                                </button>
                              </>
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

      {/* -------- Contratos -------- */}
      <div style={{ height: 16 }} />
      <Painel
        titulo="Contratos do Hold"
        acoes={
          <>
            <select value={fContrato} onChange={(e) => setFContrato(e.target.value)}>
              <option value="">Todas as situações</option>
              {EM_CONTRATO.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <Selo tom={contratos.length ? 'ok' : 'off'} ponto>
              {contratos.length} registrado{contratos.length === 1 ? '' : 's'}
            </Selo>
          </>
        }
      >
        <p className="painel-nota">
          Todo edital adjudicado vira contrato e fica aqui — quem assumiu, por quanto e em que
          prazo. Quem abriu o edital é quem dá por <strong>cumprido</strong>.
        </p>
        {contratosVisiveis.length === 0 ? (
          <Vazio simb="⚖">
            {contratos.length ? 'Nenhum contrato nessa situação.' : 'Nenhum contrato firmado ainda.'}
          </Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 860 }}>
              <thead>
                <tr><th>Edital</th><th>Órgão</th><th>Contratado</th><th>Valor</th>
                  <th>Prazo</th><th>Situação</th><th className="col-acoes"></th></tr>
              </thead>
              <tbody>
                {[...contratosVisiveis]
                  .sort((a, b) => new Date(b.contratado_em || 0) - new Date(a.contratado_em || 0))
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span className="nome-forte">{e.titulo}</span>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                          {e.numero} · {objetoDoEdital(e)}
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--txt-2)' }}>{e.orgao_nome}</td>
                      <td>
                        <span className="nome-forte">{e.contratado || '—'}</span>
                        <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                          {e.contratado_como === 'propriedade' ? 'comércio' : 'trabalhador'}
                        </div>
                      </td>
                      <td className="mono" style={{ color: 'var(--gold-2)' }}>
                        {e.valor ? septims(e.valor) : '—'}
                      </td>
                      <td><Selo tom={PRAZO_TOM[e.prazo_contratado]}>{e.prazo_contratado || '—'}</Selo></td>
                      <td>
                        <Selo tom={STATUS_EDITAL_TOM[e.status]} ponto>{e.status}</Selo>
                        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>
                          {quando(e.encerrado_em || e.contratado_em)}
                        </div>
                      </td>
                      <td className="col-acoes">
                        <button className="btn pq fantasma" onClick={() => setAberto(e.id)}>Abrir</button>
                        {e.status === 'Contratado' && meusIds.includes(e.id) && (
                          <>
                            {' '}
                            <button className="btn pq primario"
                                    onClick={() => setConfirmar({
                                      mensagem: `Dar por cumprido o contrato do edital ${e.numero} com ${e.contratado}? `
                                        + 'O contratado é avisado no Quadro de Avisos.',
                                      rotulo: 'Dar por cumprido',
                                      tom: 'primario',
                                      acao: () => encerrar(e, 'Cumprido'),
                                    })}>
                              <Icone nome="selo" tam={13} /> Cumprido
                            </button>{' '}
                            <button className="btn pq perigo"
                                    onClick={() => setConfirmar({
                                      mensagem: `Romper o contrato do edital ${e.numero} com ${e.contratado}? O contratado é avisado no Quadro de Avisos.`,
                                      rotulo: 'Romper contrato',
                                      acao: () => encerrar(e, 'Rompido'),
                                    })}>
                              Romper
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
      </Painel>

      {/* -------- Modais -------- */}
      {abrindo && (
        <FormEdital
          usuario={usuario}
          casas={casasQueMando}
          numero={proximoNumero(editais)}
          aoFechar={() => setAbrindo(null)}
          aoSalvar={abrir}
        />
      )}
      {emFoco && (
        <FichaEdital
          edital={emFoco}
          propostas={propostasDe(emFoco)}
          usuario={usuario}
          dados={d}
          meu={meusIds.includes(emFoco.id)}
          julgando={julgando}
          erro={erro}
          podeCancelar={meusIds.includes(emFoco.id) || daCorte}
          aoConfirmarAcao={setConfirmar}
          aoFechar={() => setAberto(null)}
          aoJulgar={julgar}
          aoEncerrar={encerrar}
          aoPropor={propor}
          aoDesistir={desistir}
        />
      )}
      {confirmar && (
        <Confirmar
          mensagem={confirmar.mensagem}
          rotulo={confirmar.rotulo}
          tom={confirmar.tom}
          aoFechar={() => setConfirmar(null)}
          aoConfirmar={() => confirmar.acao()}
        />
      )}
    </>
  );
}

/** O texto do chamado que vai ao Quadro de Avisos de todo o Hold. */
function textoDoChamado(v, numero) {
  const quem = (v.tipo === 'Recrutamento' ? ['trabalhador'] : (v.aceita || []))
    .map((m) => MODALIDADES.find((x) => x.id === m)?.nome || m).join(' e ');
  const partes = [
    `${v.orgao_nome} abriu o edital ${numero} (${v.tipo}): ${objetoDoEdital(v) || v.titulo}.`,
    `Podem responder: ${quem || '—'}.`,
  ];
  if ((v.profissoes || []).length) partes.push(`Profissões aceitas: ${v.profissoes.join(', ')}.`);
  if (v.nivel_minimo && v.nivel_minimo !== 'N/A') partes.push(`Nível mínimo: ${v.nivel_minimo}.`);
  if (Number(v.teto) > 0) partes.push(`Teto: ${septims(v.teto)}.`);
  partes.push(`Entrega até: ${v.prazo_max}.`);
  if (v.descricao) partes.push(v.descricao);
  partes.push('As inscrições são feitas na aba Editais e Contratos.');
  return partes.join(' ');
}

/* ============================================================
   O cartão do edital na praça
   ============================================================ */
function CartaoEdital({ edital, propostas, meu, parecer, aoAbrir }) {
  const tipo = TIPO_EDITAL_POR_ID[edital.tipo] || {};
  const orgao = ORGAOS[edital.orgao_tipo] || ORGAOS.corte;
  const enviadas = propostas.filter((p) => p.status === 'Enviada').length;

  return (
    <button className={`edital-card ${meu ? 'meu' : ''}`} onClick={aoAbrir}>
      <div className="ed-topo">
        <span className="ed-icone"><Icone nome={tipo.icone || 'pergaminho'} tam={17} cor="var(--gold)" /></span>
        <span className="ed-num mono">{edital.numero}</span>
        <Selo tom="roxo">{edital.tipo}</Selo>
        {meu && <Selo tom="gold">seu edital</Selo>}
      </div>

      <div className="ed-titulo">{edital.titulo}</div>
      <div className="ed-orgao">
        <Icone nome={orgao.icone} tam={13} cor="var(--txt-3)" /> {edital.orgao_nome}
      </div>

      <div className="ed-objeto">{objetoDoEdital(edital)}</div>

      <div className="ed-chips">
        {(edital.aceita || []).map((m) => (
          <Selo key={m}>{MODALIDADES.find((x) => x.id === m)?.nome || m}</Selo>
        ))}
        {(edital.profissoes || []).map((p) => <Selo key={p} tom="gold">{p}</Selo>)}
        {edital.nivel_minimo && edital.nivel_minimo !== 'N/A' && (
          <Selo tom="ok">{edital.nivel_minimo}+</Selo>
        )}
        {Object.keys(edital.pericias_min || {}).length > 0 && (
          <Selo tom="roxo">{Object.keys(edital.pericias_min).length} perícia(s)</Selo>
        )}
      </div>

      <div className="ed-rodape">
        <span className={`selo ${PRAZO_TOM[edital.prazo_max] || ''}`}>{edital.prazo_max}</span>
        {edital.teto > 0 && <span className="ed-teto mono">teto {septims(edital.teto)}</span>}
        <span className="ed-props">
          {enviadas ? `${enviadas} proposta${enviadas === 1 ? '' : 's'}` : 'sem propostas'}
        </span>
      </div>

      {parecer && (
        <div className={`ed-parecer ${parecer.pode ? 'pode' : ''}`}>
          {parecer.proprio ? 'Você abriu este edital.'
            : parecer.jaEnviou ? `Você já concorreu — proposta ${parecer.jaEnviou.status.toLowerCase()}.`
              : parecer.pode ? 'Você pode concorrer.'
                : primeiroMotivo(parecer)}
        </div>
      )}
    </button>
  );
}

/** A explicação mais útil de por que a pessoa não pode concorrer. */
function primeiroMotivo(parecer) {
  if (parecer.trabalhador.permitido && parecer.trabalhador.motivo) return parecer.trabalhador.motivo;
  if (parecer.semCasa) return parecer.semCasa;
  const casa = parecer.propriedades.find((x) => !x.ok);
  if (casa) return casa.motivo;
  return 'Você não atende aos requisitos deste edital.';
}

/* ============================================================
   A ficha do edital: o chamado inteiro, as propostas e a decisão
   ============================================================ */
function FichaEdital({
  edital, propostas, usuario, dados, meu, podeCancelar, julgando, aoConfirmarAcao, erro,
  aoFechar, aoJulgar, aoEncerrar, aoPropor, aoDesistir,
}) {
  const tipo = TIPO_EDITAL_POR_ID[edital.tipo] || {};
  const morador = usuario.tipo === 'cidadao';
  const parecer = morador ? elegibilidade(edital, usuario, dados) : null;
  const [recusando, setRecusando] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  return (
    <Modal titulo={`${edital.numero} — ${edital.titulo}`} largo aoFechar={aoFechar}
      rodape={
        <>
          {meu && edital.status === 'Aberto' && (
            <button className="btn perigo" style={{ marginRight: 'auto' }} onClick={() => setCancelando(true)}>
              Cancelar edital
            </button>
          )}
          {!meu && podeCancelar && edital.status === 'Aberto' && (
            <button className="btn perigo" style={{ marginRight: 'auto' }} onClick={() => setCancelando(true)}>
              Encerrar pela Corte
            </button>
          )}
          <button className="btn fantasma" onClick={aoFechar}>Fechar</button>
        </>
      }
    >
      {/* O quadro de erro da página fica atrás do modal: repetimos aqui. */}
      {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="ed-ficha-topo">
        <Selo tom="roxo">{edital.tipo}</Selo>
        <Selo tom={STATUS_EDITAL_TOM[edital.status]} ponto>{edital.status}</Selo>
        <Selo><Icone nome={(ORGAOS[edital.orgao_tipo] || ORGAOS.corte).icone} tam={12} /> {edital.orgao_nome}</Selo>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--txt-3)' }}>
          aberto em {quando(edital.criado_em)}{edital.autor ? ` por ${edital.autor}` : ''}
        </span>
      </div>

      {edital.descricao && <p className="ed-descricao">{edital.descricao}</p>}

      <div className="grade g2" style={{ marginBottom: 14 }}>
        <div className="ed-bloco">
          <h4>O que se pede</h4>
          {tipo.temItens ? (
            <ul className="ed-itens">
              {(edital.itens || []).map((i, k) => (
                <li key={k}><span className="mono">{i.quantidade}×</span> {i.nome}</li>
              ))}
            </ul>
          ) : (
            <p>
              {edital.vagas > 0 ? `${edital.vagas} vaga${edital.vagas === 1 ? '' : 's'}. ` : ''}
              {tipo.resumo}
            </p>
          )}
          <div className="ed-chips" style={{ marginTop: 8 }}>
            <Selo tom={PRAZO_TOM[edital.prazo_max]}>Entrega até: {edital.prazo_max}</Selo>
            {edital.teto > 0 && <Selo tom="gold">Teto {septims(edital.teto)}</Selo>}
          </div>
        </div>

        <div className="ed-bloco">
          <h4>Quem pode responder</h4>
          <div className="ed-chips">
            {(edital.aceita || []).map((m) => {
              const mod = MODALIDADES.find((x) => x.id === m);
              return <Selo key={m} tom="ok"><Icone nome={mod?.icone || 'pessoa'} tam={12} /> {mod?.nome || m}</Selo>;
            })}
          </div>
          <ul className="ed-req">
            <li>
              <strong>Profissões:</strong>{' '}
              {(edital.profissoes || []).length ? edital.profissoes.join(', ') : 'qualquer uma'}
            </li>
            <li>
              <strong>Nível mínimo:</strong>{' '}
              {edital.nivel_minimo && edital.nivel_minimo !== 'N/A' ? edital.nivel_minimo : 'sem exigência'}
            </li>
            {Object.keys(edital.pericias_min || {}).length > 0 && (
              <li>
                <strong>Habilidades:</strong>
                <div className="ed-pericias">
                  {Object.entries(edital.pericias_min).map(([nome, nivel]) => (
                    <span className="ed-pericia" key={nome}>
                      {nome} <Pips nivel={nivel} /> <i>{nivel}</i>
                    </span>
                  ))}
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* ---- o contrato, quando já existe ---- */}
      {EM_CONTRATO.includes(edital.status) && (
        <div className={`ed-contrato ${edital.status.toLowerCase()}`}>
          <Icone nome="selo" tam={16} cor="var(--gold)" />
          <span>
            Contratado com <strong>{edital.contratado}</strong>
            {edital.valor ? ` por ${septims(edital.valor)}` : ''}
            {edital.prazo_contratado ? `, entrega ${String(edital.prazo_contratado).toLowerCase()}` : ''}
            {' '}— {quando(edital.contratado_em)}.
            {edital.status !== 'Contratado' && ` Contrato ${edital.status.toLowerCase()} em ${quando(edital.encerrado_em)}.`}
            {edital.motivo_encerramento ? ` Motivo: ${edital.motivo_encerramento}` : ''}
          </span>
          {meu && edital.status === 'Contratado' && (
            <button className="btn pq primario" style={{ marginLeft: 'auto' }}
                    onClick={() => aoConfirmarAcao({
                      mensagem: `Dar por cumprido o contrato do edital ${edital.numero} com ${edital.contratado}? `
                        + 'O contratado é avisado no Quadro de Avisos e o contrato se encerra.',
                      rotulo: 'Dar por cumprido',
                      tom: 'primario',
                      acao: () => aoEncerrar(edital, 'Cumprido'),
                    })}>
              Dar por cumprido
            </button>
          )}
        </div>
      )}

      {/* ---- propostas: o dono do edital julga ---- */}
      {meu ? (
        <Painel titulo={`Propostas recebidas (${propostas.length})`} className="chapado">
          {propostas.length === 0 ? (
            <Vazio simb="✒">Ninguém se inscreveu ainda.</Vazio>
          ) : (
            <div className="tabela-wrap">
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr><th>Quem</th><th>Como</th><th>Preço</th><th>Prazo</th>
                    <th>Situação</th><th className="col-acoes"></th></tr>
                </thead>
                <tbody>
                  {[...propostas]
                    .sort((a, b) => (a.preco || 0) - (b.preco || 0))
                    .map((p) => (
                      <tr key={p.id} className={p.status === 'Enviada' ? 'linha-pendente' : ''}>
                        <td>
                          <span className="nome-forte">{p.candidato}</span>
                          {p.candidato_id_jogo && (
                            <div className="mono" style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                              ID {p.candidato_id_jogo}
                            </div>
                          )}
                          {p.mensagem && <div className="pendente-nota">“{p.mensagem}”</div>}
                          {Object.keys(p.pericias || {}).length > 0 && (
                            <div className="ed-pericias" style={{ marginTop: 5 }}>
                              {Object.entries(p.pericias).map(([n, v]) => (
                                <span className="ed-pericia" key={n}>{n} <Pips nivel={v} /></span>
                              ))}
                              <span className="ed-aferido">
                                {p.pericias_aferidas ? 'aferidas pelo Quartel' : 'declaradas pelo candidato'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          {p.como === 'propriedade'
                            ? <Selo tom="gold">{p.propriedade_nome}</Selo>
                            : <Selo>{p.profissao || 'Trabalhador'}{p.nivel ? ` · ${p.nivel}` : ''}</Selo>}
                        </td>
                        <td className="mono" style={{ color: 'var(--gold-2)' }}>
                          {p.preco ? septims(p.preco) : '—'}
                        </td>
                        <td><Selo tom={PRAZO_TOM[p.prazo]}>{p.prazo}</Selo></td>
                        <td>
                          <Selo tom={STATUS_PROPOSTA_TOM[p.status]} ponto>{p.status}</Selo>
                          {p.resposta && <div className="pendente-nota">“{p.resposta}”</div>}
                        </td>
                        <td className="col-acoes">
                          {p.status === 'Enviada' && edital.status === 'Aberto' && (
                            <>
                              <button className="btn pq primario" disabled={Boolean(julgando)}
                                      onClick={() => aoJulgar(edital, p, true)}>
                                {julgando === p.id ? 'Contratando…' : 'Contratar'}
                              </button>{' '}
                              <button className="btn pq perigo" disabled={Boolean(julgando)}
                                      onClick={() => setRecusando(p)}>
                                Recusar
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
        </Painel>
      ) : morador ? (
        <AreaDoCandidato
          edital={edital} parecer={parecer} usuario={usuario} dados={dados}
          minha={parecer?.jaEnviou} aoPropor={aoPropor} aoDesistir={aoDesistir}
        />
      ) : (
        <Painel titulo={`Propostas recebidas (${propostas.length})`} className="chapado">
          <p className="painel-nota">
            Este edital é de {edital.orgao_nome} — quem julga as propostas é quem o abriu.
          </p>
        </Painel>
      )}

      {recusando && (
        <FormRecusa
          proposta={recusando}
          aoFechar={() => setRecusando(null)}
          aoConfirmar={async (motivo) => { await aoJulgar(edital, recusando, false, motivo); setRecusando(null); }}
        />
      )}
      {cancelando && (
        <FormRecusa
          titulo={`Cancelar o edital ${edital.numero}`}
          texto="O chamado sai da praça e quem estava inscrito é avisado no Quadro de Avisos."
          rotulo="Cancelar edital"
          aoFechar={() => setCancelando(false)}
          aoConfirmar={async (motivo) => {
            const deu = await aoEncerrar(edital, 'Cancelado', motivo);
            setCancelando(false);
            if (deu) aoFechar();
          }}
        />
      )}
    </Modal>
  );
}

/* ============================================================
   O lado do candidato: o parecer e o formulário da proposta
   ============================================================ */
function AreaDoCandidato({ edital, parecer, usuario, dados, minha, aoPropor, aoDesistir }) {
  const tipo = TIPO_EDITAL_POR_ID[edital.tipo] || {};
  const trabalho = trabalhoDe(usuario, dados);
  const exigidas = Object.keys(edital.pericias_min || {});
  // As habilidades vêm da ficha da pessoa — declaradas por ela em Minha
  // ficha, com o que o Quartel aferiu por cima. Nada é redigitado aqui.
  const ficha = parecer.ficha;

  const vias = [
    ...(parecer.trabalhador.permitido
      ? [{ id: 'trabalhador', rotulo: trabalho ? `Como trabalhador — ${trabalho.profissao} (${trabalho.nivel})` : 'Como trabalhador',
        ok: parecer.trabalhador.ok, motivo: parecer.trabalhador.motivo }]
      : []),
    ...parecer.propriedades.map((x) => ({
      id: `prop:${x.prop.id}`, rotulo: `Por ${x.prop.nome} — ${x.prop.tipo} em ${x.prop.local}`,
      ok: x.ok, motivo: x.motivo, prop: x.prop,
    })),
  ];
  const primeira = vias.find((v) => v.ok);
  const [via, setVia] = useState(primeira?.id || '');
  const [preco, setPreco] = useState('');
  const [prazo, setPrazo] = useState(prazosAceitos(edital)[0] || 'Imediata');
  const [mensagem, setMensagem] = useState('');
  // Fora do recrutamento, anexar as habilidades é escolha dele: serve para
  // quem quer oferecer escolta, guarda-costas, caçada — trabalho de braço.
  const [anexar, setAnexar] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (minha) {
    return (
      <Painel titulo="A sua proposta" className="chapado">
        <div className="ed-minha">
          <Selo tom={STATUS_PROPOSTA_TOM[minha.status]} ponto>{minha.status}</Selo>
          <span>
            {minha.como === 'propriedade' ? `Por ${minha.propriedade_nome}` : 'Como trabalhador'}
            {minha.preco ? ` · ${septims(minha.preco)}` : ''} · entrega {String(minha.prazo).toLowerCase()}
          </span>
          {minha.status === 'Enviada' && (
            <button className="btn pq perigo" style={{ marginLeft: 'auto' }}
                    onClick={() => aoDesistir(minha)}>Retirar proposta</button>
          )}
        </div>
        {minha.mensagem && <p className="ed-descricao">“{minha.mensagem}”</p>}
        {minha.resposta && <p className="ed-descricao">Resposta do órgão: “{minha.resposta}”</p>}
      </Painel>
    );
  }

  if (edital.status !== 'Aberto') {
    return (
      <Painel titulo="Inscrições encerradas" className="chapado">
        <Vazio simb="⌛">Este edital não recebe mais propostas.</Vazio>
      </Painel>
    );
  }

  if (parecer.proprio) {
    return (
      <Painel titulo="Este edital é seu" className="chapado">
        <Vazio simb="§">Quem abre o chamado não concorre nele.</Vazio>
      </Painel>
    );
  }

  const enviar = async () => {
    setErro('');
    const escolhida = vias.find((v) => v.id === via);
    if (!escolhida?.ok) { setErro('Escolha uma via pela qual você pode concorrer.'); return; }

    // Perícia exigida é exigida — e quem responde por isso é a ficha dela.
    const faltam = periciasEmFalta(edital, ficha.pericias);
    if (faltam.length) {
      setErro(`Falta habilidade: ${faltam.map((f) => `${f.nome} (pede ${f.exigido}, você tem ${f.tem})`).join('; ')}. `
        + 'Atualize o quadro de habilidades em Minha ficha.');
      return;
    }

    setEnviando(true);
    try {
      await aoPropor(edital, {
        como: escolhida.prop ? 'propriedade' : 'trabalhador',
        propriedade_id: escolhida.prop?.id || '',
        propriedade_nome: escolhida.prop?.nome || '',
        profissao: escolhida.prop ? '' : (trabalho?.profissao || ''),
        nivel: escolhida.prop ? '' : (trabalho?.nivel || ''),
        pericias: exigidas.length
          ? Object.fromEntries(exigidas.map((p) => [p, ficha.pericias[p] || 'N/A']))
          : (anexar ? ficha.pericias : {}),
        pericias_aferidas: ficha.temFicha,
        preco: tipo.temPreco ? Number(preco) : 0,
        prazo,
        mensagem,
      });
    } catch (ex) {
      // O banner do pai fica atrás do modal: a mensagem tem de vir aqui.
      setErro(ex.message || 'Não foi possível enviar a proposta agora.');
    }
    setEnviando(false);
  };

  return (
    <Painel titulo="Concorrer a este edital" className="chapado">
      <div className="ed-vias">
        {vias.length === 0 && (
          <p className="ed-bloqueio">
            {parecer.semCasa || 'Este edital não se dirige a você.'}
          </p>
        )}
        {vias.map((v) => (
          <label key={v.id} className={`ed-via ${v.ok ? '' : 'bloqueada'} ${via === v.id ? 'ativa' : ''}`}>
            <input type="radio" name="via" value={v.id} disabled={!v.ok}
                   checked={via === v.id} onChange={() => setVia(v.id)} />
            <span>
              <strong>{v.rotulo}</strong>
              {!v.ok && <em>{v.motivo}</em>}
            </span>
          </label>
        ))}
      </div>

      {vias.some((v) => v.ok) && (
        <>
          <div className="grade g3" style={{ marginTop: 12 }}>
            {tipo.temPreco && (
              <Texto rotulo={`Seu preço em Septims${edital.teto > 0 ? ` (teto ${edital.teto})` : ''}`}
                     valor={preco} aoMudar={setPreco} type="number" min="0" placeholder="0" />
            )}
            <Selecao rotulo="Prazo que você promete" valor={prazo} aoMudar={setPrazo}
                     opcoes={prazosAceitos(edital)} vazioLabel="—" />
          </div>

          {exigidas.length > 0 ? (
            <div className="ed-bloco" style={{ marginTop: 12 }}>
              <h4>Habilidades exigidas</h4>
              <p className="painel-nota" style={{ marginTop: 0 }}>
                {ficha.temFicha
                  ? 'Vão as habilidades que o Quartel aferiu na sua ficha militar.'
                  : 'Vão as habilidades que você registrou em Minha ficha. Para mudar o que '
                    + 'segue na proposta, atualize lá — aqui elas entram sozinhas.'}
              </p>
              <div className="ed-pericias">
                {exigidas.map((p) => {
                  const tem = ficha.pericias[p] || 'N/A';
                  const falta = (NIVEL_VALOR[tem] || 0) < (NIVEL_VALOR[edital.pericias_min[p]] || 0);
                  return (
                    <span className={`ed-pericia ${falta ? 'falta' : 'atende'}`} key={p}>
                      {p} <Pips nivel={tem} />
                      <i>pede {edital.pericias_min[p]}</i>
                    </span>
                  );
                })}
              </div>
              <span className="ed-aferido">
                {ficha.temFicha ? 'aferidas pelo Quartel' : 'declaradas na sua ficha'}
              </span>
            </div>
          ) : ficha.alguma && (
            <label className="ed-anexo">
              <input type="checkbox" checked={anexar} onChange={() => setAnexar(!anexar)} />
              <span>
                <strong>Anexar as minhas habilidades a esta proposta</strong>
                <em>
                  Opcional. Serve quando o trabalho pede braço treinado — escolta, caçada,
                  guarda — e você quer que o órgão veja o que sabe fazer.
                </em>
              </span>
            </label>
          )}

          <AreaTexto rotulo="Recado ao órgão (opcional)" valor={mensagem} aoMudar={setMensagem}
                     placeholder="Como pretende entregar, condições, o que já tem em mãos…" />

          {erro && <div className="login-erro" style={{ marginTop: 10 }}>{erro}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn primario" disabled={enviando} onClick={enviar}>
              <Icone nome="pergaminho" tam={14} /> {enviando ? 'Enviando…' : 'Enviar proposta'}
            </button>
          </div>
        </>
      )}
    </Painel>
  );
}

/* ============================================================
   Formulário de abertura
   ============================================================ */
const EDITAL_VAZIO = {
  titulo: '', tipo: 'Fornecimento', descricao: '',
  itens: [{ nome: '', quantidade: 1 }], vagas: 1, teto: '',
  prazo_max: 'Em até 1 mês', aceita: ['trabalhador', 'propriedade'],
  profissoes: [], nivel_minimo: 'N/A', pericias_min: {},
};

function FormEdital({ usuario, casas, numero, aoFechar, aoSalvar }) {
  const daCorte = usuario.tipo === 'corte';
  const doQuartel = usuario.tipo === 'soldado';
  const orgaoFixo = daCorte ? 'corte' : doQuartel ? 'quartel' : 'propriedade';

  const [v, setV] = useState({
    ...EDITAL_VAZIO,
    orgao_tipo: orgaoFixo,
    propriedade_id: orgaoFixo === 'propriedade' ? (casas[0]?.id || '') : '',
    // Uma casa chama gente para trabalhar; não abre concorrência a outras casas.
    aceita: orgaoFixo === 'propriedade' ? ['trabalhador'] : EDITAL_VAZIO.aceita,
  });
  const [erro, setErro] = useState('');
  const [publicando, setPublicando] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const tipo = TIPO_EDITAL_POR_ID[v.tipo] || {};
  const soTrabalhador = orgaoFixo === 'propriedade' || v.tipo === 'Recrutamento';
  const casa = casas.find((c) => c.id === v.propriedade_id);
  const orgaoNome = orgaoFixo === 'propriedade' ? (casa?.nome || '') : ORGAOS[orgaoFixo].nome;

  const alternar = (lista, x) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

  const salvar = async () => {
    setErro('');
    // Quantidade em branco viraria 1 sem ninguém perceber.
    const semQuantidade = tipo.temItens && v.itens.some(
      (i) => String(i.nome || '').trim() && !(Number(i.quantidade) > 0),
    );
    if (semQuantidade) { setErro('Diga quanto se pede de cada item.'); return; }

    setPublicando(true);
    try {
      await aoSalvar({ ...v, orgao_nome: orgaoNome });
    } catch (ex) {
      setErro(ex.message || 'Não foi possível abrir o edital.');
    } finally {
      setPublicando(false);
    }
  };

  return (
    <Modal
      titulo={`Abrir edital ${numero}`}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!String(v.titulo || '').trim() || publicando}
                  onClick={salvar}>
            {publicando ? 'Publicando…' : 'Publicar edital'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="ed-tipos">
        {TIPOS_EDITAL.map((t) => (
          <button key={t.id} className={`ed-tipo ${v.tipo === t.id ? 'ativo' : ''}`}
                  onClick={() => setV((s) => ({
                    ...s, tipo: t.id,
                    aceita: t.id === 'Recrutamento' || orgaoFixo === 'propriedade' ? ['trabalhador'] : s.aceita,
                  }))}>
            <Icone nome={t.icone} tam={18} cor={v.tipo === t.id ? 'var(--gold)' : 'var(--txt-3)'} />
            <strong>{t.id}</strong>
            <span>{t.resumo}</span>
          </button>
        ))}
      </div>

      <div className="grade g2">
        <Texto rotulo="Título do chamado" valor={v.titulo} aoMudar={set('titulo')}
               placeholder="Ex.: Fornecimento de lingotes de ébano" />
        {orgaoFixo === 'propriedade' ? (
          <Selecao rotulo="Em nome de" valor={v.propriedade_id} aoMudar={set('propriedade_id')}
                   opcoes={casas.map((c) => ({ valor: c.id, rotulo: `${c.nome} — ${c.local}` }))}
                   vazioLabel="Escolha a propriedade" />
        ) : (
          <Campo rotulo="Em nome de">
            <input value={orgaoNome} readOnly className="travado" />
          </Campo>
        )}
      </div>

      <AreaTexto rotulo="Descrição" valor={v.descricao} aoMudar={set('descricao')}
                 placeholder="O contexto do chamado, onde entregar, com quem falar…" />

      {tipo.temItens && (
        <div className="ed-bloco">
          <h4>O que se pede</h4>
          <ul className="lista-membros">
            {v.itens.map((i, k) => (
              <li key={k}>
                <input value={i.nome} placeholder="Item — Ex.: Lingote de Ébano"
                       onChange={(e) => set('itens')(v.itens.map((x, j) => (j === k ? { ...x, nome: e.target.value } : x)))} />
                <input type="number" min="1" value={i.quantidade} style={{ maxWidth: 110 }}
                       onChange={(e) => set('itens')(v.itens.map((x, j) => (j === k ? { ...x, quantidade: e.target.value } : x)))} />
                <button className="btn pq perigo" aria-label="Remover item"
                        onClick={() => set('itens')(v.itens.filter((_, j) => j !== k))}>×</button>
              </li>
            ))}
          </ul>
          <button className="btn pq" onClick={() => set('itens')([...v.itens, { nome: '', quantidade: 1 }])}>
            <Icone nome="mais" tam={13} /> Acrescentar item
          </button>
        </div>
      )}

      <div className="grade g3">
        {tipo.temVagas && (
          <Texto rotulo="Vagas" valor={v.vagas} aoMudar={set('vagas')} type="number" min="0" />
        )}
        {tipo.temPreco && (
          <Texto rotulo="Teto em Septims (0 = sem teto)" valor={v.teto} aoMudar={set('teto')}
                 type="number" min="0" placeholder="0" />
        )}
        <Selecao rotulo="Prazo máximo aceito" valor={v.prazo_max} aoMudar={set('prazo_max')}
                 opcoes={PRAZOS} vazioLabel="—" />
      </div>

      <div className="ed-bloco">
        <h4>Quem pode responder</h4>
        {soTrabalhador ? (
          <p className="painel-nota" style={{ marginTop: 0 }}>
            {v.tipo === 'Recrutamento'
              ? 'Recrutamento é chamado por gente: só trabalhadores se inscrevem.'
              : 'Um comércio chama trabalhadores — não abre concorrência a outros comércios.'}
          </p>
        ) : (
          <div className="ed-modalidades">
            {MODALIDADES.map((m) => (
              <label key={m.id} className={`ed-modalidade ${v.aceita.includes(m.id) ? 'ativa' : ''}`}>
                <input type="checkbox" checked={v.aceita.includes(m.id)}
                       onChange={() => set('aceita')(alternar(v.aceita, m.id))} />
                <span>
                  <strong><Icone nome={m.icone} tam={13} /> {m.nome}</strong>
                  <em>{m.ajuda}</em>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="grade g2" style={{ marginTop: 10 }}>
          <Campo rotulo="Profissões aceitas (nenhuma marcada = qualquer uma)">
            <div className="ed-profissoes">
              {PROFISSOES.map((p) => (
                <button key={p} type="button"
                        className={`chip-op ${v.profissoes.includes(p) ? 'ativo' : ''}`}
                        onClick={() => set('profissoes')(alternar(v.profissoes, p))}>
                  {p}
                </button>
              ))}
            </div>
          </Campo>
          <Selecao rotulo="Nível mínimo" valor={v.nivel_minimo} aoMudar={set('nivel_minimo')}
                   opcoes={NIVEIS} vazioLabel="Sem exigência" />
        </div>
        <p className="ajuda">
          <Icone nome="livro" tam={13} /> Para um comércio, o nível e a profissão valem para a
          equipe dele: basta ter alguém que atenda ao pedido.
        </p>
      </div>

      {tipo.temPericias && (
        <div className="ed-bloco">
          <h4>Habilidades exigidas</h4>
          <p className="painel-nota" style={{ marginTop: 0 }}>
            Marque o nível mínimo em cada habilidade. Quem tem ficha militar entra com o que o
            Quartel já aferiu; quem não tem declara na inscrição.
          </p>
          {GRUPOS_PERICIA.map((g) => (
            <div className="ed-grupo" key={g.id}>
              <span className="ed-grupo-nome">{g.nome}</span>
              <div className="ed-grupo-lista">
                {g.pericias.map((p) => (
                  <label className="ed-pericia-campo" key={p}>
                    <span>{p}</span>
                    <select value={v.pericias_min[p] || 'N/A'}
                            onChange={(e) => set('pericias_min')({ ...v.pericias_min, [p]: e.target.value })}>
                      {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormRecusa({
  proposta, titulo, texto, rotulo = 'Recusar', aoFechar, aoConfirmar,
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      titulo={titulo || `Recusar a proposta de ${proposta?.candidato}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Voltar</button>
          <button className="btn perigo" onClick={() => aoConfirmar(motivo)}>{rotulo}</button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--txt-2)', fontSize: 13, lineHeight: 1.6 }}>
        {texto || 'Quem propôs recebe o recado no Quadro de Avisos, com o motivo que você escrever.'}
      </p>
      <AreaTexto rotulo="Motivo (o candidato vai ler)" valor={motivo} aoMudar={setMotivo}
                 placeholder="Preço acima do combinado, prazo longo demais, vaga preenchida…" />
    </Modal>
  );
}
