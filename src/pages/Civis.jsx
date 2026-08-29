import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  RACAS, PROFISSOES, NIVEIS, STATUS_CIVIL, STATUS_CIVIL_TOM, ONDE_ACHAR_ID,
  ORIGENS, SEM_ISENCAO, REGRA_ISENCAO, STATUS_ISENCAO, STATUS_ISENCAO_TOM,
} from '../lib/constants.js';
import {
  CIDADES_DE_ORIGEM, OUTRO_LUGAR, nomeDaCidade, cidadaniaDe, isencoesPendentes,
} from '../lib/cidadania.js';
import { recadoPara } from './Avisos.jsx';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Pips, Confirmar,
} from '../components/ui.jsx';
import FichaCidadao from '../components/FichaCidadao.jsx';
import { montarPerfil, papeisDe } from '../lib/perfil.js';
import { gerarSenha } from '../lib/senha.js';
import { copiarTexto } from '../lib/copiar.js';

const VAZIO = {
  nome: '', id_jogo: '', raca: '', profissao: '', nivel: 'Novato', notas: '',
  observacao_corte: '', status: 'Aprovado',
  origem: 'natal', cidade_anterior_id: '', cidade_anterior: '',
  isencao_status: SEM_ISENCAO, isencao_motivo: '',
};

export default function Civis({ usuario }) {
  const d = useDados();
  const [busca, setBusca] = useState('');
  const [fProf, setFProf] = useState('');
  const [fStatus, setFStatus] = useState('Aprovado');
  const [fOrigem, setFOrigem] = useState('');
  const [julgarIsencao, setJulgarIsencao] = useState(null);
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);
  const [recusar, setRecusar] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [credencial, setCredencial] = useState(null); // civil recém-aprovado, para entregar a senha

  const civis = d.civis || [];
  const pendentes = civis.filter((c) => c.status === 'Pendente');
  const aprovados = civis.filter((c) => c.status === 'Aprovado');
  const recusados = civis.filter((c) => c.status === 'Recusado');
  const pedindoIsencao = isencoesPendentes(civis);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return civis
      .filter((c) => c.status !== 'Pendente')
      .filter((c) =>
        (!t || `${c.nome} ${c.id_jogo} ${c.cidade_anterior || ''}`.toLowerCase().includes(t)) &&
        (!fProf || c.profissao === fProf) &&
        (!fOrigem || (c.origem || 'natal') === fOrigem) &&
        (!fStatus || c.status === fStatus))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [civis, busca, fProf, fOrigem, fStatus]);

  const avaliar = async (civil, status, observacao = '') => {
   try {
    // Aprovar é o que dá acesso ao morador: aqui nasce a senha que a Corte
    // entrega em mãos, e que ele usa junto com o ID do jogo para entrar.
    const senha = status === 'Aprovado' ? (civil.senha_acesso || gerarSenha()) : civil.senha_acesso || '';
    await d.salvar('civis', {
      ...civil,
      status,
      senha_acesso: senha,
      observacao_corte: observacao || civil.observacao_corte || '',
      avaliado_por: usuario?.nome || usuario?.cargo || 'Corte',
      avaliado_em: new Date().toISOString(),
    }, `${civil.nome} — ${status.toLowerCase()}`);
    if (status === 'Aprovado') setCredencial({ ...civil, senha_acesso: senha });
   } catch { /* o quadro de erro da página já mostra o motivo */ }
  };

  /**
   * A Corte decide a isenção de cidadania.
   *
   * Conceder desfaz o vínculo com a cidade anterior; negar deixa a
   * transferência registrada, mas sem isenção. Nos dois casos o morador
   * é avisado no Quadro de Avisos, com o parecer que a Corte escrever.
   */
  const decidirIsencao = async (civil, status, parecer = '') => {
   try {
    const assinatura = usuario?.nome || usuario?.cargo || 'Corte de Riften';
    await d.salvar('civis', {
      ...civil,
      isencao_status: status,
      isencao_parecer: parecer,
      isencao_por: assinatura,
      isencao_em: new Date().toISOString(),
    }, `${civil.nome} — isenção ${status.toLowerCase()}`);

    if (civil.id) {
      const concedida = status === 'Concedida';
      await d.salvar('avisos', recadoPara(
        civil.id,
        concedida
          ? 'Isenção de cidadania concedida'
          : 'Isenção de cidadania negada',
        concedida
          ? `A Corte de Riften concedeu a sua isenção. O vínculo com ${civil.cidade_anterior || 'a cidade anterior'} `
            + 'está desfeito, e a sua cidadania passa a ser deste Hold.'
            + (parecer ? ` Parecer: ${parecer}` : '')
          : `A Corte de Riften negou a sua isenção de cidadania.`
            + (parecer ? ` Motivo: ${parecer}` : ' Nenhum motivo foi registrado.')
            + ' Você pode pedir de novo pela sua ficha, com outra justificativa.',
        assinatura,
      ), `recado para ${civil.nome}`);
    }
    setJulgarIsencao(null);
   } catch { /* o quadro de erro da página já mostra o motivo */ }
  };

  /** Emite uma senha nova — para quem perdeu a que recebeu. */
  const regerarSenha = async (civil) => {
    const senha = gerarSenha();
    await d.salvar('civis', { ...civil, senha_acesso: senha }, `${civil.nome} — nova senha de acesso`);
    setCredencial({ ...civil, senha_acesso: senha, refeita: true });
  };

  /** Leva um cidadão aprovado direto para a lista de trabalhadores, com os dados prontos. */
  const contratar = async (civil) => {
   try {
    await d.salvar('trabalhadores', {
      nome: civil.nome,
      civil_id: civil.id,
      id_jogo: civil.id_jogo,
      raca: civil.raca || '',
      profissao: civil.profissao || '',
      nivel: civil.nivel || 'Novato',
      local: 'Riften',
      vinculo: '',
      notas: '',
    }, civil.nome);
   } catch { /* o quadro de erro da página já mostra o motivo */ }
  };

  const jaTrabalhador = (civil) =>
    (d.trabalhadores || []).some((t) => t.civil_id === civil.id || (t.id_jogo && t.id_jogo === civil.id_jogo));

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Registro Civil</h1>
          <p>
            Moradores que se cadastraram pelo portal. Nada entra na lista oficial sem o aval da
            Corte — e o que é aprovado passa a ser consultável por todos os outros registros do Hold.
          </p>
        </div>
        <div className="acoes">
          <button className="btn primario" onClick={() => setEdit({ ...VAZIO })}>
            <Icone nome="mais" tam={15} /> Registrar direto
          </button>
        </div>
      </div>
      <div className="regra" />

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Aguardando aval" valor={pendentes.length} sub={pendentes.length ? 'pedidos na fila' : 'fila vazia'} tom="laranja" />
        <Stat rotulo="Cidadãos" valor={aprovados.length} sub="reconhecidos pela Corte" tom="verde" />
        <Stat rotulo="Com ofício" valor={aprovados.filter((c) => c.profissao).length} sub="declararam profissão" />
        <Stat rotulo="Isenções a decidir" valor={pedindoIsencao.length}
              sub={pedindoIsencao.length ? 'transferências de cidadania' : 'nada pendente'}
              tom={pedindoIsencao.length ? 'roxo' : ''} />
      </div>

      {/* -------- Fila de aprovação -------- */}
      <Painel
        titulo="Fila de aprovação"
        acoes={pendentes.length
          ? <Selo tom="warn" ponto>{pendentes.length} aguardando</Selo>
          : <Selo tom="ok" ponto>Nada pendente</Selo>}
      >
        {pendentes.length === 0 ? (
          <Vazio simb="✓">Nenhum pedido aguardando. Novos cadastros do portal aparecem aqui.</Vazio>
        ) : (
          <div className="grade g2">
            {pendentes.map((c) => (
              <article key={c.id} className="civil-pedido">
                <header>
                  <Icone nome="pessoa" tam={17} cor="var(--warn)" />
                  <h3>{c.nome}</h3>
                  <span className="selo mono">ID {c.id_jogo}</span>
                </header>
                <div className="chip-lista">
                  {c.raca && <Selo>{c.raca}</Selo>}
                  {c.profissao
                    ? <Selo tom="gold">{c.profissao}</Selo>
                    : <Selo>Sem ofício declarado</Selo>}
                  {c.profissao && (
                    <span className="selo"><Pips nivel={c.nivel} /> {c.nivel}</span>
                  )}
                  {cidadaniaDe(c).transferido
                    ? <Selo tom="roxo">Vindo de {cidadaniaDe(c).cidade || 'outra cidade'}</Selo>
                    : <Selo tom="ok">Natural de Riften</Selo>}
                  {cidadaniaDe(c).pendente && <Selo tom="warn" ponto>Pede isenção</Selo>}
                </div>
                {cidadaniaDe(c).pendente && cidadaniaDe(c).motivo && (
                  <p className="civil-notas">Isenção: “{cidadaniaDe(c).motivo}”</p>
                )}
                {c.notas && <p className="civil-notas">“{c.notas}”</p>}
                <footer>
                  <button className="btn pq primario" onClick={() => avaliar(c, 'Aprovado')}>
                    Aprovar
                  </button>
                  <button className="btn pq" onClick={() => setEdit(c)}>
                    <Icone nome="lapis" tam={13} /> Ajustar antes
                  </button>
                  <button className="btn pq perigo" style={{ marginLeft: 'auto' }} onClick={() => setRecusar(c)}>
                    Recusar
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Isenções de cidadania -------- */}
      <Painel
        titulo="Isenções de cidadania"
        acoes={pedindoIsencao.length
          ? <Selo tom="warn" ponto>{pedindoIsencao.length} a decidir</Selo>
          : <Selo tom="ok" ponto>Nada a decidir</Selo>}
      >
        <p className="painel-nota">
          Quem transfere a cidadania de outra cidade pode pedir <strong>isenção</strong> para
          desfazer o vínculo anterior. {REGRA_ISENCAO} Conceder ou negar é ato da Corte — nos
          dois casos o morador é avisado no Quadro de Avisos, com o parecer escrito aqui.
        </p>
        {pedindoIsencao.length === 0 ? (
          <Vazio simb="⚖">
            Nenhuma isenção aguardando decisão. Os pedidos chegam pelo Registro Civil ou pela
            ficha do próprio morador.
          </Vazio>
        ) : (
          <div className="grade g2">
            {pedindoIsencao.map((c) => (
              <article className="isencao-card" key={c.id}>
                <header>
                  <Icone nome="pergaminho" tam={16} cor="var(--warn)" />
                  <h3>{c.nome}</h3>
                  <span className="selo mono">ID {c.id_jogo}</span>
                  <Selo tom="roxo">{c.cidade_anterior || 'outra cidade'}</Selo>
                  <Selo tom={STATUS_CIVIL_TOM[c.status]} ponto>{c.status}</Selo>
                </header>
                {c.isencao_motivo
                  ? <p className="motivo">“{c.isencao_motivo}”</p>
                  : <p className="motivo">Sem justificativa escrita.</p>}
                <footer>
                  <button className="btn pq primario"
                          onClick={() => setJulgarIsencao({ civil: c, status: 'Concedida' })}>
                    Conceder isenção
                  </button>
                  <button className="btn pq perigo"
                          onClick={() => setJulgarIsencao({ civil: c, status: 'Negada' })}>
                    Negar
                  </button>
                  <button className="btn pq fantasma" style={{ marginLeft: 'auto' }}
                          onClick={() => setPerfil(c)}>
                    <Icone nome="pessoa" tam={13} /> Perfil
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Lista oficial -------- */}
      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou ID do jogo…" />
        </div>
        <Selecao rotulo="Profissão" valor={fProf} aoMudar={setFProf} opcoes={PROFISSOES} vazioLabel="Todas" />
        <Selecao rotulo="Cidadania" valor={fOrigem} aoMudar={setFOrigem}
                 opcoes={ORIGENS.map((o) => ({ valor: o.id, rotulo: o.id === 'natal' ? 'Natural de Riften' : 'Transferida' }))}
                 vazioLabel="Todas" />
        <Selecao rotulo="Situação" valor={fStatus} aoMudar={setFStatus} opcoes={STATUS_CIVIL.filter((s) => s !== 'Pendente')} vazioLabel="Todas" />
      </div>

      {lista.length === 0 ? (
        <Painel>
          <Vazio simb="⚑">
            Nenhum cidadão nesta lista ainda. Aprove um pedido da fila, ou use
            <strong> Registrar direto</strong> para cadastrar você mesmo.
          </Vazio>
        </Painel>
      ) : (
        <div className="tabela-wrap">
          <table style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Cidadão</th><th>ID do jogo</th><th>Cidadania</th><th>Ofício</th>
                <th>Nível</th><th>Situação</th><th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button className="nome-forte link-perfil" onClick={() => setPerfil(c)} title="Abrir perfil completo">
                      {c.nome}
                    </button>
                    <div className="chip-lista" style={{ marginTop: 4 }}>
                      {papeisDe(montarPerfil(c, d)).slice(0, 3).map((p, i) => (
                        <Selo key={i} tom={p.tom}>{p.texto}</Selo>
                      ))}
                    </div>
                  </td>
                  <td><span className="mono" style={{ color: 'var(--txt-2)' }}>{c.id_jogo}</span></td>
                  <td>
                    {(() => {
                      const cid = cidadaniaDe(c);
                      return (
                        <>
                          <div style={{ fontSize: 12.5, color: 'var(--txt-2)' }}>
                            {cid.transferido ? (cid.cidade || 'Outra cidade') : 'Natural de Riften'}
                          </div>
                          {cid.transferido && cid.isencao !== SEM_ISENCAO && (
                            <Selo tom={STATUS_ISENCAO_TOM[cid.isencao]}>Isenção {cid.isencao.toLowerCase()}</Selo>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td>{c.profissao ? <Selo tom="gold">{c.profissao}</Selo> : <span style={{ color: 'var(--txt-3)' }}>—</span>}</td>
                  <td>
                    {c.profissao ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Pips nivel={c.nivel} />
                        <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>{c.nivel}</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td><Selo tom={STATUS_CIVIL_TOM[c.status]} ponto>{c.status}</Selo></td>
                  <td className="col-acoes">
                    {c.status === 'Aprovado' && c.profissao && !jaTrabalhador(c) && (
                      <>
                        <button className="btn pq" onClick={() => contratar(c)} title="Cria a ficha de trabalhador com estes dados">
                          <Icone nome="martelo" tam={13} /> Contratar
                        </button>{' '}
                      </>
                    )}
                    {c.status === 'Aprovado' && (
                      <>
                        <button className="btn pq fantasma" onClick={() => setCredencial(c)}
                                title="Ver as credenciais de acesso deste cidadão">
                          <Icone nome="chave" tam={13} />
                        </button>{' '}
                      </>
                    )}
                    <button className="btn pq fantasma" onClick={() => setPerfil(c)} title="Perfil completo">
                      <Icone nome="pessoa" tam={13} />
                    </button>{' '}
                    <button className="btn pq fantasma" onClick={() => setEdit(c)}><Icone nome="lapis" tam={13} /></button>{' '}
                    <button className="btn pq perigo" onClick={() => setRem(c)}><Icone nome="lixo" tam={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {julgarIsencao && (
        <FormIsencao
          civil={julgarIsencao.civil}
          status={julgarIsencao.status}
          aoFechar={() => setJulgarIsencao(null)}
          aoConfirmar={(parecer) => decidirIsencao(julgarIsencao.civil, julgarIsencao.status, parecer)}
        />
      )}
      {perfil && (
        <FichaCidadao
          civil={perfil}
          dados={d}
          aoFechar={() => setPerfil(null)}
          aoEditar={(c) => { setPerfil(null); setEdit(c); }}
        />
      )}
      {edit && (
        <FormCivil
          inicial={edit}
          aoFechar={() => setEdit(null)}
          aoSalvar={async (v) => {
            // Cidadão cadastrado direto pela Corte já nasce aprovado; sem senha
            // ele não conseguiria entrar, e o quadro de credenciais mostrava vazio.
            const senha = v.status === 'Aprovado' ? (v.senha_acesso || gerarSenha()) : (v.senha_acesso || '');
            const salvo = await d.salvar('civis', { ...v, senha_acesso: senha });
            setEdit(null);
            if (!v.id && v.status === 'Aprovado') {
              setCredencial({ ...v, ...salvo, senha_acesso: senha });
            }
          }}
        />
      )}
      {recusar && (
        <FormRecusa
          civil={recusar}
          aoFechar={() => setRecusar(null)}
          aoConfirmar={async (motivo) => { await avaliar(recusar, 'Recusado', motivo); setRecusar(null); }}
        />
      )}
      {credencial && (
        <Credenciais
          civil={credencial}
          refeita={credencial.refeita}
          aoRegerar={() => regerarSenha(credencial)}
          aoFechar={() => setCredencial(null)}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Apagar o registro de ${rem.nome} do Registro Civil? As fichas que já citam este cidadão continuam existindo.`}
          aoConfirmar={() => d.remover('civis', rem.id, rem.nome)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
/** O parecer da Corte sobre uma isenção de cidadania. */
function FormIsencao({ civil, status, aoFechar, aoConfirmar }) {
  const [parecer, setParecer] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const concede = status === 'Concedida';

  const confirmar = async () => {
    setOcupado(true);
    await aoConfirmar(parecer);
    setOcupado(false);
  };

  return (
    <Modal
      titulo={`${concede ? 'Conceder' : 'Negar'} isenção — ${civil.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Voltar</button>
          <button className={`btn ${concede ? 'primario' : 'perigo'}`} disabled={ocupado} onClick={confirmar}>
            {ocupado ? 'Registrando…' : (concede ? 'Conceder isenção' : 'Negar isenção')}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--txt-2)', fontSize: 13, lineHeight: 1.6 }}>
        {concede
          ? `A isenção desfaz o vínculo de ${civil.nome} com ${civil.cidade_anterior || 'a cidade anterior'}. `
            + 'A cidadania passa a ser de Riften.'
          : `A transferência continua registrada, mas sem isenção. ${civil.nome} pode pedir de novo, `
            + 'com outra justificativa.'}
        {' '}Ele recebe o recado no Quadro de Avisos.
      </p>
      {civil.isencao_motivo && (
        <p className="perfil-fala" style={{ marginTop: 0 }}>“{civil.isencao_motivo}”</p>
      )}
      <AreaTexto rotulo="Parecer da Corte (o morador vai ler)" valor={parecer} aoMudar={setParecer}
                 placeholder={concede
                   ? 'Condições, prazo, o que o Hold espera em troca…'
                   : 'Dívida pendente na cidade de origem, falta de provas, juramento em vigor…'} />
    </Modal>
  );
}

/* ------------------------------------------------------------ */
/**
 * As credenciais do morador, para a Corte entregar em mãos.
 * O login dele é o ID do jogo; a senha é esta, gerada na aprovação.
 */
function Credenciais({ civil, refeita, aoRegerar, aoFechar }) {
  const [copiado, setCopiado] = useState('');
  const relogio = useRef(null);
  useEffect(() => () => clearTimeout(relogio.current), []);

  const copiar = async (texto, qual) => {
    const deu = await copiarTexto(texto);
    clearTimeout(relogio.current);
    // Quando não dá para copiar, dizemos isso em vez de fingir que deu.
    setCopiado(deu ? qual : `falhou:${qual}`);
    relogio.current = setTimeout(() => setCopiado(''), 2600);
  };
  const marca = (qual, ok, erro = 'copie à mão') => (
    copiado === qual ? ok : copiado === `falhou:${qual}` ? erro : null
  );
  const tudo = `Riften — acesso de ${civil.nome}\nID do jogo: ${civil.id_jogo}\nSenha: ${civil.senha_acesso}`;

  return (
    <Modal
      titulo={refeita ? `Nova senha — ${civil.nome}` : `Credenciais — ${civil.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" style={{ marginRight: 'auto' }} onClick={aoRegerar}>
            <Icone nome="chave" tam={14} /> Emitir senha nova
          </button>
          <button className="btn" onClick={() => copiar(tudo, 'tudo')}>
            {marca('tudo', 'Copiado!', 'Selecione e copie') || 'Copiar tudo'}
          </button>
          <button className="btn primario" onClick={aoFechar}>Entendido</button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--txt-2)', fontSize: 13, lineHeight: 1.6 }}>
        {refeita
          ? 'A senha anterior deixou de valer. Entregue esta ao morador.'
          : 'Registro aprovado. Entregue estas credenciais ao morador — é com elas que ele entra na Cidade de Riften e, se for alistado, no Quartel General.'}
      </p>

      <div className="credencial">
        <div className="credencial-linha">
          <span className="cred-rot">Login (ID do jogo)</span>
          <span className="cred-val mono">{civil.id_jogo}</span>
          <button className="btn pq fantasma" onClick={() => copiar(civil.id_jogo, 'id')}>
            {marca('id', '✓', '✕') || 'copiar'}
          </button>
        </div>
        <div className="credencial-linha senha">
          <span className="cred-rot">Senha de acesso</span>
          <span className="cred-val mono grande">{civil.senha_acesso}</span>
          <button className="btn pq fantasma" onClick={() => copiar(civil.senha_acesso, 'senha')}>
            {marca('senha', '✓', '✕') || 'copiar'}
          </button>
        </div>
      </div>

      <p className="ajuda" style={{ marginTop: 12 }}>
        <Icone nome="livro" tam={13} /> A senha não distingue maiúsculas de minúsculas e os
        hífens são opcionais — <code>rftk7qm284</code> entra igual a <code>RFT-K7QM-284</code>.
        Se o morador perdê-la, use <strong>Emitir senha nova</strong>.
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormCivil({ inicial, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...VAZIO, ...inicial });
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal
      titulo={inicial.id ? `Cidadão — ${inicial.nome}` : 'Registrar cidadão'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!String(v.nome || '').trim() || !String(v.id_jogo || '').trim()} onClick={() => aoSalvar(v)}>
            Salvar
          </button>
        </>
      }
    >
      <div className="grade g2">
        <Texto rotulo="Nome do personagem" valor={v.nome} aoMudar={set('nome')} />
        <Texto rotulo="ID do jogo" valor={v.id_jogo} aoMudar={set('id_jogo')} className="mono" />
        <Selecao rotulo="Raça" valor={v.raca} aoMudar={set('raca')} opcoes={RACAS} />
        <Selecao rotulo="Profissão" valor={v.profissao} aoMudar={set('profissao')} opcoes={PROFISSOES} vazioLabel="Nenhuma" />
        <Selecao rotulo="Nível" valor={v.nivel} aoMudar={set('nivel')} opcoes={NIVEIS} vazioLabel="—" />
        <Selecao rotulo="Situação" valor={v.status} aoMudar={set('status')} opcoes={STATUS_CIVIL} vazioLabel="—" />
      </div>
      <p className="ajuda" style={{ marginTop: 8 }}>
        <Icone nome="livro" tam={13} /> {ONDE_ACHAR_ID}
      </p>

      {/* -------- Cidadania -------- */}
      <div style={{ height: 12 }} />
      <div className="campo">
        <span>Cidadania</span>
        <div className="origem-escolha">
          {ORIGENS.map((o) => (
            <button type="button" key={o.id}
                    className={`origem-op ${(v.origem || 'natal') === o.id ? 'ativo' : ''}`}
                    onClick={() => setV((s) => ({
                      ...s,
                      origem: o.id,
                      ...(o.id === 'natal'
                        ? { cidade_anterior_id: '', cidade_anterior: '', isencao_status: SEM_ISENCAO, isencao_motivo: '' }
                        : {}),
                    }))}>
              <Icone nome={o.icone} tam={16} cor={(v.origem || 'natal') === o.id ? 'var(--gold)' : 'var(--txt-3)'} />
              <strong>{o.nome}</strong>
            </button>
          ))}
        </div>
      </div>
      {v.origem === 'transferencia' && (
        <div className="bloco-transferencia">
          <div className="grade g2">
            <Selecao rotulo="Cidade anterior" valor={v.cidade_anterior_id}
                     aoMudar={(x) => setV((s) => ({
                       ...s, cidade_anterior_id: x,
                       cidade_anterior: x === OUTRO_LUGAR ? '' : nomeDaCidade(x, ''),
                     }))}
                     opcoes={[
                       ...CIDADES_DE_ORIGEM.map((h) => ({ valor: h.id, rotulo: h.nome })),
                       { valor: OUTRO_LUGAR, rotulo: 'Outro lugar de Tamriel' },
                     ]}
                     vazioLabel="—" />
            {v.cidade_anterior_id === OUTRO_LUGAR
              ? <Texto rotulo="Qual lugar" valor={v.cidade_anterior} aoMudar={set('cidade_anterior')} />
              : <Selecao rotulo="Isenção" valor={v.isencao_status || SEM_ISENCAO}
                         aoMudar={set('isencao_status')} opcoes={STATUS_ISENCAO} vazioLabel="—" />}
          </div>
          {v.cidade_anterior_id === OUTRO_LUGAR && (
            <Selecao rotulo="Isenção" valor={v.isencao_status || SEM_ISENCAO}
                     aoMudar={set('isencao_status')} opcoes={STATUS_ISENCAO} vazioLabel="—" />
          )}
          <AreaTexto rotulo="Justificativa do pedido de isenção" valor={v.isencao_motivo}
                     aoMudar={set('isencao_motivo')} rows={2} />
        </div>
      )}

      <div style={{ height: 12 }} />
      <AreaTexto rotulo="O que o morador escreveu" valor={v.notas} aoMudar={set('notas')} />
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Observação da Corte" valor={v.observacao_corte} aoMudar={set('observacao_corte')} />
    </Modal>
  );
}

function FormRecusa({ civil, aoFechar, aoConfirmar }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      titulo={`Recusar — ${civil.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn perigo" onClick={() => aoConfirmar(motivo)}>Recusar pedido</button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--txt-2)', fontSize: 13 }}>
        O pedido sai da fila e fica arquivado como recusado. O morador pode se cadastrar de novo.
      </p>
      <AreaTexto rotulo="Motivo (fica no arquivo da Corte)" valor={motivo} aoMudar={setMotivo}
                 placeholder="ID não confere, personagem duplicado, dados incompletos…" />
    </Modal>
  );
}
