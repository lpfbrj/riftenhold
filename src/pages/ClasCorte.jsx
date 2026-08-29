import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { listar } from '../lib/db.js';
import {
  TIPOS_GUILDA, TIPO_GUILDA_POR_ID, SITUACOES_GUILDA, SITUACAO_GUILDA_TOM,
  TIPO_LICENCA_POR_ID, STATUS_LICENCA_TOM,
} from '../lib/constants.js';
import {
  tipoDoCla, clasAprovados, clasPendentes, gentesDoCla, tamanhoDoCla, licencasDoCla,
} from '../lib/guildas.js';
import { recadoPara } from './Avisos.jsx';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar,
} from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * Os clãs, na mesa da Corte.
 *
 * O morador registra e conta a que veio; aqui a Corte lê a história
 * e a função declaradas e decide se aquilo tem lugar em Riften.
 * Reconhecido o clã, ele passa a existir no Hold — e pode receber
 * licença, que vale para todos os membros de uma vez.
 */
export default function ClasCorte({ usuario }) {
  const d = useDados();
  const guildas = d.guildas || [];
  const licencas = d.licencas || [];

  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fSituacao, setFSituacao] = useState('');
  const [julgar, setJulgar] = useState(null);   // { guilda, aprovar }
  const [ver, setVer] = useState(null);
  const [edit, setEdit] = useState(null);   // ficha aberta pela Corte
  const [rem, setRem] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const naMesa = useMemo(() => clasPendentes(guildas), [guildas]);
  const aprovados = useMemo(() => clasAprovados(guildas), [guildas]);
  const querSair = useMemo(
    () => guildas.filter((g) => g.dissolucao_pedida_em && g.situacao === 'Aprovado'),
    [guildas],
  );

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return guildas
      .filter((g) => (!fTipo || g.tipo === fTipo) &&
        (!fSituacao || (g.situacao || 'Pendente') === fSituacao) &&
        (!t || `${g.nome} ${g.lider} ${g.funcao}`.toLowerCase().includes(t)))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }, [guildas, fTipo, fSituacao, busca]);

  const porTipo = (id) => aprovados.filter((g) => g.tipo === id).length;

  /**
   * A Corte reconhece ou recusa o clã. Nos dois casos o líder é
   * avisado no Quadro de Avisos, com o parecer escrito aqui.
   */
  const decidir = async (guilda, aprovar, parecer) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      // Outra pessoa da Corte pode ter julgado enquanto esta tela
      // estava aberta: vale a linha gravada, não a que a tela trouxe.
      const gravadas = await listar('guildas').catch(() => guildas);
      const atual = gravadas.find((g) => g.id === guilda.id);
      if (!atual) { setJulgar(null); return; }
      if ((atual.situacao || 'Pendente') !== 'Pendente') {
        setJulgar(null);
        await d.recarregar();
        return;
      }

      const assinatura = usuario?.nome || usuario?.cargo || 'Corte de Riften';
      await d.salvar('guildas', {
        ...atual,
        situacao: aprovar ? 'Aprovado' : 'Recusado',
        parecer: parecer || '',
        avaliado_por: assinatura,
        avaliado_em: new Date().toISOString(),
      }, `clã ${atual.nome} — ${aprovar ? 'reconhecido' : 'recusado'}`);

      if (atual.lider_civil_id) {
        await d.salvar('avisos', recadoPara(
          atual.lider_civil_id,
          aprovar ? `Clã ${atual.nome} reconhecido` : `Clã ${atual.nome} recusado`,
          aprovar
            ? `A Corte de Riften reconheceu o clã ${atual.nome}. Ele já consta no registro do `
              + 'Hold, e você responde por ele como líder: chame membros, vincule a sede e '
              + 'administre pela aba Clãs.'
              + (parecer ? ` Parecer: ${parecer}` : '')
            : `A Corte de Riften não reconheceu o clã ${atual.nome}.`
              + (parecer ? ` Motivo: ${parecer}` : ' Nenhum motivo foi registrado.')
              + ' Você pode corrigir o registro e enviar de novo pela aba Clãs.',
          assinatura,
        ), `recado para ${atual.lider}`);
      }
      setJulgar(null);
    } finally {
      setOcupado(false);
    }
  };

  /**
   * A Corte corrige a ficha do clã — e só o que é dela: nome, tipo,
   * situação e os textos. Membros e sede são do líder, e são
   * relidos da linha gravada para não voltarem atrás.
   */
  const salvarFicha = async (v) => {
    const gravadas = await listar('guildas').catch(() => guildas);
    const atual = gravadas.find((g) => g.id === v.id) || v;
    const nome = String(v.nome || '').trim();
    const repetido = gravadas.some(
      (g) => g.id !== v.id && (g.situacao || 'Pendente') !== 'Dissolvido' &&
        String(g.nome || '').trim().toLowerCase() === nome.toLowerCase(),
    );
    if (repetido) throw new Error(`Já existe um clã chamado ${nome}.`);

    await d.salvar('guildas', {
      ...atual,
      nome,
      tipo: v.tipo,
      situacao: v.situacao,
      lema: v.lema || '',
      historia: v.historia || '',
      funcao: v.funcao || '',
      parecer: v.parecer || '',
    }, `clã ${nome}`);
    setEdit(null);
  };

  /** Dissolver apaga o clã do Hold, mas guarda a linha como dissolvida. */
  const dissolver = async (guilda) => {
    await d.salvar('guildas', {
      ...guilda,
      situacao: 'Dissolvido',
      avaliado_por: usuario?.nome || usuario?.cargo || 'Corte de Riften',
      avaliado_em: new Date().toISOString(),
    }, `clã ${guilda.nome} — dissolvido`);
    if (guilda.lider_civil_id) {
      await d.salvar('avisos', recadoPara(
        guilda.lider_civil_id,
        `Clã ${guilda.nome} dissolvido`,
        `A Corte de Riften dissolveu o clã ${guilda.nome}. Ele deixa de constar no registro do Hold.`,
        usuario?.nome || 'Corte de Riften',
      ), `recado para ${guilda.lider}`);
    }
    setRem(null);
  };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Clãs do Hold</h1>
          <p>
            As organizações que os moradores registram: sociedades, guildas comerciais, clãs de
            aventureiros e congregações religiosas. A Corte lê a história e a função declaradas
            e decide se aquilo tem lugar em Riften.
          </p>
        </div>
        <div className="acoes">
          {naMesa.length > 0
            ? <Selo tom="warn" ponto>{naMesa.length} a julgar</Selo>
            : <Selo tom="ok" ponto>Nada na mesa</Selo>}
        </div>
      </div>
      <div className="regra" />

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Clãs reconhecidos" valor={aprovados.length}
              sub={`${guildas.length} registros ao todo`} tom="verde" />
        <Stat rotulo="Aguardando aval" valor={naMesa.length}
              sub={naMesa.length ? 'na mesa da Corte' : 'nada pendente'}
              tom={naMesa.length ? 'laranja' : ''} />
        <Stat rotulo="Gente organizada"
              valor={aprovados.reduce((s, g) => s + tamanhoDoCla(g), 0)}
              sub="somando todos os clãs" tom="roxo" />
        <Stat rotulo="Licenças de clã"
              valor={licencas.filter((l) => l.titular_tipo === 'guilda' && l.status === 'Ativa').length}
              sub="ativas, valendo para os membros" tom="gold" />
      </div>

      {/* -------- Fila de reconhecimento -------- */}
      <Painel
        titulo="Registros aguardando a Corte"
        acoes={naMesa.length
          ? <Selo tom="warn" ponto>{naMesa.length} pedido{naMesa.length === 1 ? '' : 's'}</Selo>
          : <Selo tom="ok" ponto>Nada pendente</Selo>}
      >
        {naMesa.length === 0 ? (
          <Vazio simb="⚜">
            Nenhum registro na fila. Os pedidos chegam da aba Clãs dos moradores.
          </Vazio>
        ) : (
          <div className="grade g2">
            {naMesa.map((g) => {
              const t = tipoDoCla(g);
              return (
                <article className="pedido-casa" key={g.id}>
                  <header>
                    <span className="pedido-icone" style={{ borderColor: g.cor || t.cor }}>
                      {g.brasao
                        ? <img src={g.brasao} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <Icone nome={t.icone} tam={17} cor={g.cor || t.cor} />}
                    </span>
                    <div className="pedido-titulo">
                      <h4>{g.nome}</h4>
                      <small>{t.nome} · registrado por {g.lider}</small>
                    </div>
                    <Selo tom="roxo">{quando(g.criado_em)}</Selo>
                  </header>

                  {g.lema && <p className="cg-lema">“{g.lema}”</p>}

                  <div className="cla-leitura">
                    <span className="cl-rot">História</span>
                    <p>{g.historia || '—'}</p>
                    <span className="cl-rot">Função no roleplay</span>
                    <p>{g.funcao || '—'}</p>
                  </div>

                  <p className="pedido-resumo">
                    <Icone nome="livro" tam={13} /> {t.proposta}
                  </p>

                  <footer>
                    <button className="btn pq fantasma" onClick={() => setVer(g)}>Abrir ficha</button>
                    <button className="btn pq perigo" disabled={ocupado}
                            onClick={() => setJulgar({ guilda: g, aprovar: false })}>
                      Recusar
                    </button>
                    <button className="btn pq primario" disabled={ocupado}
                            onClick={() => setJulgar({ guilda: g, aprovar: true })}>
                      Reconhecer
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {querSair.length > 0 && (
          <div className="servos-bloco">
            <h4>Pedidos de dissolução</h4>
            {querSair.map((g) => (
              <div className="linha-nobre" key={g.id}>
                <Icone nome="lixo" tam={14} cor="var(--danger)" />
                <span className="ln-nome">{g.nome}</span>
                <Selo tom="perigo">{g.lider} pediu a dissolução</Selo>
                {g.dissolucao_motivo && <span className="ln-nota">{g.dissolucao_motivo}</span>}
                <span className="ln-fim">
                  <button className="btn pq perigo" onClick={() => setRem(g)}>Dissolver</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Painel>

      {/* -------- Os tipos, para a Corte lembrar do que cada um propõe -------- */}
      <div style={{ height: 16 }} />
      <Painel titulo="O que cada tipo de clã propõe">
        <div className="grade g2">
          {TIPOS_GUILDA.map((t) => (
            <article className="tipo-cla" key={t.id} style={{ '--c': t.cor }}>
              <header>
                <span className="tipo-cla-icone"><Icone nome={t.icone} tam={18} cor={t.cor} /></span>
                <h4>{t.nome}</h4>
                <Selo tom="off">{porTipo(t.id)} no Hold</Selo>
              </header>
              <p>{t.proposta}</p>
              <div className="chip-lista">
                {(t.licencas || []).map((l) => (
                  <Selo key={l} tom="gold">{TIPO_LICENCA_POR_ID[l]?.nome || l}</Selo>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Painel>

      {/* -------- Registro completo -------- */}
      <div style={{ height: 16 }} />
      <Painel titulo="Registro de clãs" acoes={<Selo tom="gold">{guildas.length} linhas</Selo>}>
        <div className="barra-filtros compacta">
          <div className="campo busca">
            <label>Buscar</label>
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
                   placeholder="Nome, líder ou função…" />
          </div>
          <Selecao rotulo="Tipo" valor={fTipo} aoMudar={setFTipo} vazioLabel="Todos"
                   opcoes={TIPOS_GUILDA.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
          <Selecao rotulo="Situação" valor={fSituacao} aoMudar={setFSituacao} vazioLabel="Todas"
                   opcoes={SITUACOES_GUILDA} />
        </div>

        {lista.length === 0 ? (
          <Vazio simb="⚜">Nenhum clã corresponde ao filtro.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Clã</th><th>Tipo</th><th>Líder</th><th>Gente</th>
                  <th>Sede</th><th>Licenças</th><th>Situação</th><th className="col-acoes"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((g) => {
                  const t = tipoDoCla(g);
                  const ativas = licencasDoCla(g, licencas).filter((l) => l.status === 'Ativa');
                  return (
                    <tr key={g.id} className={g.situacao === 'Pendente' ? 'linha-pendente' : ''}>
                      <td>
                        <button className="nome-forte link-perfil" onClick={() => setVer(g)}>{g.nome}</button>
                        {g.lema && (
                          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 2 }}>“{g.lema}”</div>
                        )}
                      </td>
                      <td><Selo tom="roxo">{t.nome}</Selo></td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{g.lider || '—'}</td>
                      <td className="mono">{tamanhoDoCla(g)}</td>
                      <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{g.propriedade_nome || '—'}</td>
                      <td>
                        {ativas.length === 0
                          ? <span style={{ color: 'var(--txt-3)', fontSize: 12 }}>nenhuma</span>
                          : <Selo tom="ok">{ativas.length}</Selo>}
                      </td>
                      <td>
                        <Selo tom={SITUACAO_GUILDA_TOM[g.situacao] || 'warn'} ponto>{g.situacao}</Selo>
                        {g.parecer && (
                          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>{g.parecer}</div>
                        )}
                      </td>
                      <td className="col-acoes">
                        <button className="btn pq" onClick={() => setEdit(g)}>
                          <Icone nome="lapis" tam={13} />
                        </button>{' '}
                        {g.situacao !== 'Dissolvido' && (
                          <button className="btn pq perigo" onClick={() => setRem(g)}>
                            <Icone nome="lixo" tam={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      {julgar && (
        <FormJulgarCla
          guilda={julgar.guilda}
          aprovar={julgar.aprovar}
          ocupado={ocupado}
          aoFechar={() => setJulgar(null)}
          aoConfirmar={(parecer) => decidir(julgar.guilda, julgar.aprovar, parecer)}
        />
      )}
      {ver && <FichaClaCorte guilda={ver} licencas={licencas} aoFechar={() => setVer(null)} />}
      {edit && (
        <FormClaCorte
          inicial={edit}
          guildas={guildas}
          aoFechar={() => setEdit(null)}
          aoSalvar={salvarFicha}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Dissolver o clã ${rem.nome}? Ele sai do registro do Hold, e as licenças em nome dele deixam de valer para os membros.`}
          rotulo="Dissolver"
          aoConfirmar={() => dissolver(rem)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormJulgarCla({ guilda, aprovar, ocupado, aoFechar, aoConfirmar }) {
  const [parecer, setParecer] = useState('');
  const t = tipoDoCla(guilda);
  return (
    <Modal
      titulo={`${aprovar ? 'Reconhecer' : 'Recusar'} — ${guilda.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            {t.nome} · registrado por {guilda.lider}
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className={`btn ${aprovar ? 'primario' : 'perigo'}`} disabled={ocupado}
                  onClick={() => aoConfirmar(parecer)}>
            {ocupado ? 'Registrando…' : aprovar ? 'Reconhecer o clã' : 'Recusar o registro'}
          </button>
        </>
      }
    >
      <p className="painel-nota">
        {aprovar
          ? <>O clã passa a constar no registro do Hold, e <strong>{guilda.lider}</strong> responde
             por ele como líder: chama membros, vincula a sede e recebe as licenças que a Corte
             emitir em nome do clã.</>
          : <><strong>{guilda.lider}</strong> é avisado no Quadro de Avisos com o motivo que você
             escrever, e pode corrigir o registro e enviar de novo.</>}
      </p>
      <div className="cla-leitura">
        <span className="cl-rot">História declarada</span>
        <p>{guilda.historia || '—'}</p>
        <span className="cl-rot">Função declarada</span>
        <p>{guilda.funcao || '—'}</p>
      </div>
      <AreaTexto
        rotulo={aprovar ? 'Parecer da Corte (opcional)' : 'Motivo (o líder vai ler)'}
        valor={parecer}
        aoMudar={setParecer}
        placeholder={aprovar
          ? 'Condições, o que a Corte espera do clã, o que será cobrado…'
          : 'O que falta para a Corte reconhecer.'}
        maxLength={400}
      />
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FichaClaCorte({ guilda, licencas, aoFechar }) {
  const t = tipoDoCla(guilda);
  const doCla = licencasDoCla(guilda, licencas);
  return (
    <Modal
      titulo={`Clã ${guilda.nome}`}
      largo
      aoFechar={aoFechar}
      rodape={<button className="btn primario" onClick={aoFechar}>Fechar</button>}
    >
      <div className="casa-resumo">
        <span className="casa-brasao grande" style={{ borderColor: guilda.cor || t.cor }}>
          {guilda.brasao
            ? <img src={guilda.brasao} alt="" />
            : <Icone nome={t.icone} tam={34} cor={guilda.cor || t.cor} />}
        </span>
        <div>
          <h3>{guilda.nome}</h3>
          {guilda.lema && <p className="casa-lema">“{guilda.lema}”</p>}
          <div className="chip-lista" style={{ marginTop: 6 }}>
            <Selo tom="roxo">{t.nome}</Selo>
            <Selo tom="gold">Líder: {guilda.lider}</Selo>
            <Selo tom={SITUACAO_GUILDA_TOM[guilda.situacao] || 'warn'} ponto>{guilda.situacao}</Selo>
            {guilda.propriedade_nome && <Selo>Sede: {guilda.propriedade_nome}</Selo>}
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />
      <h4 className="bloco-titulo">História</h4>
      <p className="cla-texto">{guilda.historia || '—'}</p>
      <h4 className="bloco-titulo">Função no roleplay de Riften</h4>
      <p className="cla-texto">{guilda.funcao || '—'}</p>

      <h4 className="bloco-titulo">Gente do clã ({tamanhoDoCla(guilda)})</h4>
      {gentesDoCla(guilda).map((g) => (
        <div className={`linha-nobre ${g.lidera ? 'destaque' : ''}`} key={g.chave}>
          <Icone nome={g.lidera ? 'coroa' : 'pessoa'} tam={15}
                 cor={g.lidera ? 'var(--gold)' : 'var(--purple)'} />
          <span className="ln-nome">{g.nome}</span>
          <Selo tom={g.lidera ? 'gold' : ''}>{g.cargo}</Selo>
          {g.id_jogo && <span className="selo mono">ID {g.id_jogo}</span>}
          {g.notas && <span className="ln-nota">{g.notas}</span>}
        </div>
      ))}

      <h4 className="bloco-titulo">Licenças em nome do clã</h4>
      {doCla.length === 0 ? (
        <p className="painel-nota">
          Nenhuma. Um {t.nome.toLowerCase()} costuma pedir{' '}
          {(t.licencas || []).map((l) => TIPO_LICENCA_POR_ID[l]?.nome).filter(Boolean).join(' ou ')}.
        </p>
      ) : doCla.map((l) => (
        <div className="perfil-linha destaque" key={l.id}>
          <Icone nome={TIPO_LICENCA_POR_ID[l.tipo]?.icone || 'pergaminho'} tam={15} cor="var(--gold)" />
          <span style={{ fontSize: 14 }}>{TIPO_LICENCA_POR_ID[l.tipo]?.nome || l.tipo}</span>
          <span className="selo mono">{l.numero}</span>
          <Selo tom={STATUS_LICENCA_TOM[l.status]} ponto>{l.status}</Selo>
          <Selo tom="roxo">vale para {tamanhoDoCla(guilda)} pessoa{tamanhoDoCla(guilda) === 1 ? '' : 's'}</Selo>
        </div>
      ))}
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormClaCorte({ inicial, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }));

  const salvar = async () => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try { await aoSalvar(v); }
    catch (ex) { setErro(ex.message || 'Não foi possível salvar agora.'); }
    finally { setOcupado(false); }
  };

  return (
    <Modal
      titulo={`Ficha do clã — ${inicial.nome}`}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!String(v.nome || '').trim() || ocupado}
                  onClick={salvar}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      {erro && <div className="login-erro">{erro}</div>}
      <p className="painel-nota">
        A Corte pode corrigir o registro de um clã — nome, tipo, situação e o texto que ele
        declarou. Membros e sede são do líder, e não se mexem daqui.
      </p>
      <div className="grade g3">
        <Texto rotulo="Nome do clã" valor={v.nome} aoMudar={set('nome')} maxLength={50} />
        <Selecao rotulo="Tipo" valor={v.tipo} aoMudar={set('tipo')}
                 opcoes={TIPOS_GUILDA.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
        <Selecao rotulo="Situação" valor={v.situacao} aoMudar={set('situacao')}
                 opcoes={SITUACOES_GUILDA} />
      </div>
      <Texto rotulo="Lema" valor={v.lema || ''} aoMudar={set('lema')} maxLength={60} />
      <AreaTexto rotulo="História" valor={v.historia || ''} aoMudar={set('historia')} rows={4} />
      <AreaTexto rotulo="Função no roleplay" valor={v.funcao || ''} aoMudar={set('funcao')} rows={3} />
      <AreaTexto rotulo="Parecer da Corte" valor={v.parecer || ''} aoMudar={set('parecer')} />
    </Modal>
  );
}
