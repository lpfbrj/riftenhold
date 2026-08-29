import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  registrarCla, reenviarCla, salvarClaProprio, pedirDissolucao, minhasPropriedades,
} from '../lib/db.js';
import {
  TIPOS_GUILDA, TIPO_GUILDA_POR_ID, SITUACAO_GUILDA_TOM, CARGOS_GUILDA,
  TIPO_LICENCA_POR_ID, STATUS_LICENCA_TOM, recursoDaLicenca,
} from '../lib/constants.js';
import {
  tipoDoCla, clasAprovados, claQueLidera, clasDe, ehLider, ehMembro, ehAprovado,
  gentesDoCla, tamanhoDoCla, licencasDoCla, podeRegistrarCla,
} from '../lib/guildas.js';
import { prepararBrasao, LADO_BRASAO, MAX_ARQUIVO_MB } from '../lib/imagem.js';
import SeletorCivil from '../components/SeletorCivil.jsx';
import {
  Painel, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Campo,
} from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

let contadorChave = 0;
const chaveNova = () => `g${(contadorChave += 1)}`;

/**
 * Os clãs de Riften, na tela do morador.
 *
 * Quem quiser registra o seu: diz o tipo, conta a história e
 * explica a função dele no roleplay do Hold. A Corte reconhece ou
 * recusa. Reconhecido, quem registrou lidera — chama membros,
 * vincula uma propriedade sua e responde pelas licenças do clã,
 * que valem para todo mundo que estiver dentro.
 */
export default function Clas({ usuario }) {
  const d = useDados();
  const guildas = d.guildas || [];
  const licencas = d.licencas || [];

  const meuCla = useMemo(() => claQueLidera(usuario, guildas), [usuario, guildas]);
  const ondeSouMembro = useMemo(
    () => clasDe(usuario, guildas).filter((g) => !ehLider(usuario, g)),
    [usuario, guildas],
  );
  const doHold = useMemo(() => clasAprovados(guildas), [guildas]);

  const [registrar, setRegistrar] = useState(false);
  const [verCla, setVerCla] = useState(null);
  const [fTipo, setFTipo] = useState('');
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return doHold
      .filter((g) => (!fTipo || g.tipo === fTipo) &&
        (!t || `${g.nome} ${g.lider} ${g.funcao}`.toLowerCase().includes(t)))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }, [doHold, fTipo, busca]);

  const podeAbrir = podeRegistrarCla(usuario, guildas);

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Clãs de Riften</h1>
          <p>
            As organizações do Hold: sociedades, guildas comerciais, clãs de aventureiros e
            congregações religiosas. Qualquer morador registrado pode fundar o seu — a Corte
            lê a história e a função que você declarar, e então reconhece ou recusa.
          </p>
        </div>
        <div className="acoes">
          {podeAbrir.pode && (
            <button className="btn primario" onClick={() => setRegistrar(true)}>
              <Icone nome="mais" tam={15} /> Registrar um clã
            </button>
          )}
        </div>
      </div>
      <div className="regra" />

      {/* -------- O meu clã -------- */}
      {meuCla
        ? <MeuCla usuario={usuario} guilda={meuCla} />
        : (
          <Painel titulo="Nenhum clã sob sua liderança">
            <p className="painel-nota">
              Um clã é o jeito de um grupo existir oficialmente em Riften: ele aparece no
              registro do Hold, recebe licenças da Corte — que valem para todos os membros —
              e pode ter uma propriedade sua como sede.
            </p>
            <div className="grade g2">
              {TIPOS_GUILDA.map((t) => (
                <article className="tipo-cla" key={t.id} style={{ '--c': t.cor }}>
                  <header>
                    <span className="tipo-cla-icone"><Icone nome={t.icone} tam={18} cor={t.cor} /></span>
                    <h4>{t.nome}</h4>
                  </header>
                  <p>{t.proposta}</p>
                  <ul className="tipo-cla-ganchos">
                    {t.ganchos.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </article>
              ))}
            </div>
            {podeAbrir.pode ? (
              <div style={{ marginTop: 14 }}>
                <button className="btn primario" onClick={() => setRegistrar(true)}>
                  <Icone nome="estandarte" tam={14} /> Registrar o meu clã
                </button>
              </div>
            ) : (
              <p className="painel-nota" style={{ marginBottom: 0 }}>{podeAbrir.motivo}</p>
            )}
          </Painel>
        )}

      {/* -------- Onde sou membro -------- */}
      {ondeSouMembro.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Painel titulo="Clãs de que faço parte" acoes={<Selo tom="roxo">{ondeSouMembro.length}</Selo>}>
            {ondeSouMembro.map((g) => {
              const t = tipoDoCla(g);
              const minhas = licencasDoCla(g, licencas).filter((l) => l.status === 'Ativa');
              return (
                <div className="linha-nobre destaque" key={g.id}>
                  <Icone nome={t.icone} tam={15} cor={g.cor || t.cor} />
                  <button className="ln-nome link-perfil" onClick={() => setVerCla(g)}>{g.nome}</button>
                  <Selo tom="roxo">{t.nome}</Selo>
                  <Selo>Líder: {g.lider}</Selo>
                  {minhas.length > 0 && (
                    <Selo tom="ok">{minhas.length} licença{minhas.length === 1 ? '' : 's'} que vale para você</Selo>
                  )}
                </div>
              );
            })}
          </Painel>
        </>
      )}

      {/* -------- Diretório -------- */}
      <div style={{ height: 16 }} />
      <Painel
        titulo="Clãs reconhecidos pela Corte"
        acoes={<Selo tom="gold">{doHold.length} no Hold</Selo>}
      >
        <div className="barra-filtros compacta">
          <div className="campo busca">
            <label>Buscar</label>
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
                   placeholder="Nome, líder ou função…" />
          </div>
          <Selecao rotulo="Tipo" valor={fTipo} aoMudar={setFTipo} vazioLabel="Todos"
                   opcoes={TIPOS_GUILDA.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
        </div>

        {lista.length === 0 ? (
          <Vazio simb="⚜">
            {doHold.length === 0
              ? 'Nenhum clã reconhecido ainda. O primeiro pode ser o seu.'
              : 'Nenhum clã corresponde ao filtro.'}
          </Vazio>
        ) : (
          <div className="grade g2">
            {lista.map((g) => {
              const t = tipoDoCla(g);
              const ativas = licencasDoCla(g, licencas).filter((l) => l.status === 'Ativa');
              return (
                <article className="cla-guilda" key={g.id} style={{ '--c': g.cor || t.cor }}>
                  <span className="cg-listra" />
                  <header>
                    <span className="cg-brasao">
                      {g.brasao
                        ? <img src={g.brasao} alt="" />
                        : <Icone nome={t.icone} tam={22} cor={g.cor || t.cor} />}
                    </span>
                    <div>
                      <h3>{g.nome}</h3>
                      <span className="cg-sub">{t.nome} · {tamanhoDoCla(g)} membro{tamanhoDoCla(g) === 1 ? '' : 's'}</span>
                    </div>
                  </header>
                  {g.lema && <p className="cg-lema">“{g.lema}”</p>}
                  <p className="cg-funcao">{g.funcao}</p>
                  <div className="chip-lista">
                    <Selo tom="gold">Líder: {g.lider}</Selo>
                    {g.propriedade_nome && <Selo tom="roxo">Sede: {g.propriedade_nome}</Selo>}
                    {ativas.length > 0 && <Selo tom="ok">{ativas.length} licença{ativas.length === 1 ? '' : 's'}</Selo>}
                    {ehMembro(usuario, g) && <Selo tom="ok" ponto>Você é daqui</Selo>}
                  </div>
                  <footer>
                    <button className="btn pq" onClick={() => setVerCla(g)}>
                      <Icone nome="livro" tam={13} /> Ler a história
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </Painel>

      {registrar && (
        <FormRegistroCla
          usuario={usuario}
          guildas={guildas}
          aoFechar={() => setRegistrar(false)}
        />
      )}
      {verCla && (
        <FichaDoCla guilda={verCla} licencas={licencas} aoFechar={() => setVerCla(null)} />
      )}
    </>
  );
}

/* ============================================================
   O clã de quem lidera
   ============================================================ */
function MeuCla({ usuario, guilda }) {
  const d = useDados();
  const propriedades = d.propriedades || [];
  const licencas = d.licencas || [];
  const t = tipoDoCla(guilda);

  const minhasProps = useMemo(
    () => minhasPropriedades(usuario, propriedades).filter(
      (p) => p.proprietario_civil_id === usuario.civil_id ||
        String(p.proprietario || '').trim().toLowerCase() === String(usuario.nome || '').trim().toLowerCase(),
    ),
    [usuario, propriedades],
  );
  const membrosDaCasa = useMemo(
    () => (guilda.membros || []).map((m, i) => ({ _k: `m${i}`, ...m })), [guilda],
  );

  const [membros, setMembros] = useState(null);
  const [historia, setHistoria] = useState(null);
  const [funcao, setFuncao] = useState(null);
  const [sede, setSede] = useState(null);
  const [reenviando, setReenviando] = useState(false);
  const [dissolver, setDissolver] = useState(false);
  const [salvo, setSalvo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const relogio = useRef(null);
  useEffect(() => () => clearTimeout(relogio.current), []);

  const avisar = (texto) => {
    clearTimeout(relogio.current);
    setSalvo(texto);
    relogio.current = setTimeout(() => setSalvo(''), 4500);
  };

  const vMembros = membros !== null ? membros : membrosDaCasa;
  const vHistoria = historia !== null ? historia : (guilda.historia || '');
  const vFuncao = funcao !== null ? funcao : (guilda.funcao || '');
  const vSede = sede !== null ? sede : (guilda.propriedade_id || '');
  const mexeu = membros !== null || historia !== null || funcao !== null || sede !== null;
  const descartar = () => { setMembros(null); setHistoria(null); setFuncao(null); setSede(null); setErro(''); };

  const aprovado = ehAprovado(guilda);
  const recusado = (guilda.situacao || '') === 'Recusado';
  const doCla = licencasDoCla(guilda, licencas);

  const salvar = async () => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await salvarClaProprio(usuario, guilda, {
        membros: vMembros, historia: vHistoria, funcao: vFuncao, propriedade_id: vSede || null,
      }, propriedades);
      await d.recarregar();
      descartar();
      avisar('O clã foi atualizado.');
    } catch (ex) {
      setErro(ex.message || 'Não foi possível salvar agora.');
    } finally {
      setOcupado(false);
    }
  };

  const mudar = (i, campo, val) =>
    setMembros(vMembros.map((m, j) => (j === i ? { ...m, [campo]: val } : m)));
  const ligar = (i, c) =>
    setMembros(vMembros.map((m, j) => (j === i
      ? { ...m, nome: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '' } : m)));

  return (
    <>
      <Painel
        titulo={`Clã ${guilda.nome}`}
        acoes={
          <>
            <Selo tom="roxo">{t.nome}</Selo>{' '}
            <Selo tom={SITUACAO_GUILDA_TOM[guilda.situacao] || 'warn'} ponto>{guilda.situacao}</Selo>
          </>
        }
      >
        {salvo && <div className="aviso-ok"><Icone nome="selo" tam={15} /> {salvo}</div>}
        {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}

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
              <Selo tom="gold">Líder: {guilda.lider}</Selo>
              <Selo>{tamanhoDoCla(guilda)} membro{tamanhoDoCla(guilda) === 1 ? '' : 's'}</Selo>
              {guilda.propriedade_nome && <Selo tom="roxo">Sede: {guilda.propriedade_nome}</Selo>}
              <Selo tom="off">Registrado em {quando(guilda.criado_em)}</Selo>
            </div>
          </div>
        </div>

        {!aprovado && (
          <p className="painel-nota" style={{ marginTop: 12, marginBottom: 0 }}>
            {recusado
              ? 'A Corte não reconheceu o clã. Leia o parecer, ajuste o que for preciso e envie de novo.'
              : 'O registro está na mesa da Corte. Enquanto não houver reconhecimento, o clã não aparece no Hold nem recebe licença.'}
          </p>
        )}
        {guilda.parecer && (
          <p className="perfil-nota-corte" style={{ marginTop: 10 }}>
            <strong>Parecer da Corte:</strong> {guilda.parecer}
          </p>
        )}
        {recusado && (
          <div style={{ marginTop: 12 }}>
            <button className="btn primario" onClick={() => setReenviando(true)}>
              <Icone nome="lapis" tam={14} /> Corrigir e reenviar
            </button>
          </div>
        )}
      </Painel>

      {aprovado && (
        <>
          <div style={{ height: 16 }} />
          <Painel
            titulo="Membros do clã"
            acoes={
              <button className="btn pq primario"
                      onClick={() => setMembros([...vMembros, {
                        _k: chaveNova(), nome: '', civil_id: '', id_jogo: '', cargo: 'Membro', notas: '',
                      }])}>
                <Icone nome="mais" tam={13} /> Chamar alguém
              </button>
            }
          >
            <p className="painel-nota">
              Quem entra no clã passa a valer-se das licenças dele. Você chama e dispensa por
              conta própria — o clã é seu para administrar.
            </p>
            <div className="linha-nobre destaque">
              <Icone nome="coroa" tam={15} cor="var(--gold)" />
              <span className="ln-nome">{guilda.lider}</span>
              <Selo tom="gold">Líder</Selo>
              <span className="ln-fim">você</span>
            </div>
            {vMembros.length === 0 ? (
              <Vazio simb="⚜">Nenhum membro além de você. Use <strong>Chamar alguém</strong>.</Vazio>
            ) : (
              <ul className="lista-membros">
                {vMembros.map((m, i) => (
                  <li key={m._k || i}>
                    <SeletorCivil
                      compacto
                      valor={m.nome}
                      aoMudar={(n) => setMembros(vMembros.map((x, j) => (j === i ? { ...x, nome: n, civil_id: '', id_jogo: '' } : x)))}
                      aoEscolher={(c) => ligar(i, c)}
                      civis={d.civis || []}
                      vinculado={m.civil_id ? (d.civis || []).find((c) => c.id === m.civil_id) : null}
                      aoDesvincular={() => mudar(i, 'civil_id', '')}
                      placeholder="Nome — busca no Registro Civil"
                    />
                    <select value={m.cargo || 'Membro'} onChange={(e) => mudar(i, 'cargo', e.target.value)}>
                      {CARGOS_GUILDA.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={m.notas || ''} onChange={(e) => mudar(i, 'notas', e.target.value)}
                           placeholder="Observação" />
                    <button className="btn pq perigo" aria-label="Dispensar membro"
                            onClick={() => setMembros(vMembros.filter((_, j) => j !== i))}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </Painel>

          <div style={{ height: 16 }} />
          <Painel
            titulo="Sede e história"
            acoes={
              guilda.dissolucao_pedida_em
                ? <Selo tom="perigo" ponto>Dissolução pedida</Selo>
                : (
                  <button className="btn pq perigo" onClick={() => setDissolver(true)}>
                    Pedir dissolução
                  </button>
                )
            }
          >
            <Selecao
              rotulo="Propriedade do clã"
              valor={vSede}
              aoMudar={setSede}
              vazioLabel="Nenhuma — o clã não tem sede"
              opcoes={minhasProps.map((p) => ({ valor: p.id, rotulo: `${p.nome} — ${p.tipo}` }))}
            />
            <p className="ajuda">
              <Icone nome="livro" tam={13} /> Só se vincula ao clã uma propriedade registrada em
              seu nome. Você tem {minhasProps.length} disponíve{minhasProps.length === 1 ? 'l' : 'is'}.
            </p>
            <div style={{ height: 12 }} />
            <AreaTexto rotulo="História do clã" valor={vHistoria} aoMudar={setHistoria}
                       placeholder="De onde veio, como se formou, o que já fez no Hold…" />
            <div style={{ height: 10 }} />
            <AreaTexto rotulo="Função no roleplay de Riften" valor={vFuncao} aoMudar={setFuncao}
                       placeholder="O que o clã se propõe a fazer na cidade e nas estradas…" />
          </Painel>

          <div style={{ height: 16 }} />
          <Painel
            titulo="Licenças do clã"
            acoes={<Selo tom={doCla.length ? 'ok' : 'off'} ponto>
              {doCla.length} emitida{doCla.length === 1 ? '' : 's'}
            </Selo>}
          >
            <p className="painel-nota">
              A licença emitida para o clã <strong>vale para todos os membros</strong> — ninguém
              precisa tirar a sua. Quem emite é a Corte; peça pelo Quadro de Avisos ou por um edital.
            </p>
            {doCla.length === 0 ? (
              <Vazio simb="⚖">
                Nenhuma licença em nome do clã. Um {t.nome.toLowerCase()} costuma pedir{' '}
                {(t.licencas || []).map((l) => TIPO_LICENCA_POR_ID[l]?.nome).filter(Boolean).join(' ou ')}.
              </Vazio>
            ) : doCla.map((l) => (
              <LinhaLicenca key={l.id} licenca={l} />
            ))}
          </Painel>
        </>
      )}

      {mexeu && (
        <div className="barra-salvar">
          <span>Você mexeu no clã e ainda não salvou.</span>
          <button className="btn fantasma" onClick={descartar}>Descartar</button>
          <button className="btn primario" disabled={ocupado} onClick={salvar}>
            {ocupado ? 'Salvando…' : 'Salvar o clã'}
          </button>
        </div>
      )}

      {dissolver && (
        <FormDissolucao
          guilda={guilda}
          aoFechar={() => setDissolver(false)}
          aoEnviar={async (motivo) => {
            await pedirDissolucao(usuario, guilda, motivo);
            await d.recarregar();
            setDissolver(false);
            avisar('A Corte foi avisada do pedido de dissolução.');
          }}
        />
      )}

      {reenviando && (
        <FormRegistroCla
          usuario={usuario}
          guildas={d.guildas || []}
          inicial={guilda}
          aoFechar={() => setReenviando(false)}
        />
      )}
    </>
  );
}

/** Uma licença, como o clã e o morador a enxergam. */
export function LinhaLicenca({ licenca }) {
  const tipo = TIPO_LICENCA_POR_ID[licenca.tipo];
  return (
    <div className="perfil-imovel">
      <div className="perfil-linha destaque">
        <Icone nome={tipo?.icone || 'pergaminho'} tam={15} cor="var(--gold)" />
        <span style={{ fontSize: 15 }}>{tipo?.nome || licenca.tipo}</span>
        <span className="selo mono">{licenca.numero}</span>
        <Selo tom={STATUS_LICENCA_TOM[licenca.status]} ponto>{licenca.status}</Selo>
        {licenca.escolta && <Selo tom="roxo">{tipo?.escolta?.rotulo || 'Com escolta'}</Selo>}
        {licenca.porCla && <Selo tom="gold">pelo clã {licenca.porCla}</Selo>}
      </div>
      {(licenca.cobertura || []).length > 0 && (
        <div className="chip-lista" style={{ marginTop: 6 }}>
          {(licenca.cobertura || []).map((c) => (
            <Selo key={c} tom="gold">{tipo?.coberturas.find((x) => x.id === c)?.nome || c}</Selo>
          ))}
        </div>
      )}
      {(licenca.recursos || []).length > 0 && (
        <div className="cat-chips" style={{ marginTop: 6 }}>
          {(licenca.recursos || []).map((r) => {
            const m = recursoDaLicenca(licenca.tipo, r);
            return (
              <span className="cat-chip" key={r} style={{ '--c': m.cor }}>
                <i className="minerio-ponto" /> {m.nome}
              </span>
            );
          })}
        </div>
      )}
      {licenca.validade && (
        <p className="ajuda" style={{ marginTop: 6 }}>Validade: {licenca.validade}</p>
      )}
    </div>
  );
}

/* ============================================================
   Pedir à Corte que dissolva o clã
   ============================================================ */
function FormDissolucao({ guilda, aoFechar, aoEnviar }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try { await aoEnviar(motivo); }
    catch (ex) { setErro(ex.message || 'Não foi possível pedir agora.'); }
    finally { setOcupado(false); }
  };

  return (
    <Modal
      titulo={`Dissolver o clã ${guilda.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            Quem dissolve é a Corte. Você pede.
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn perigo" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Enviando…' : 'Pedir dissolução'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro">{erro}</div>}
      <p className="painel-nota">
        Dissolvido, o clã sai do registro do Hold: os membros deixam de constar nele e as
        licenças em nome do clã param de valer para eles. O pedido vai à Corte, que decide.
      </p>
      <AreaTexto
        rotulo="Por que dissolver (a Corte vai ler)"
        valor={motivo}
        aoMudar={setMotivo}
        placeholder="O clã se desfez, mudou de propósito, ficou sem gente…"
        maxLength={300}
      />
    </Modal>
  );
}

/* ============================================================
   Registrar (ou corrigir) um clã
   ============================================================ */
function FormRegistroCla({ usuario, guildas, inicial = null, aoFechar }) {
  const d = useDados();
  const [v, setV] = useState(() => ({
    nome: inicial?.nome || '',
    tipo: inicial?.tipo || 'sociedade',
    lema: inicial?.lema || '',
    cor: inicial?.cor || TIPOS_GUILDA[0].cor,
    brasao: inicial?.brasao || null,
    historia: inicial?.historia || '',
    funcao: inicial?.funcao || '',
  }));
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const entrada = useRef(null);
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }));
  const t = TIPO_GUILDA_POR_ID[v.tipo] || TIPOS_GUILDA[0];

  /** Trocar o tipo troca a cor sugerida, se a cor ainda era a do tipo anterior. */
  const trocarTipo = (id) => setV((s) => {
    const novo = TIPO_GUILDA_POR_ID[id];
    const anterior = TIPO_GUILDA_POR_ID[s.tipo];
    return { ...s, tipo: id, cor: s.cor === anterior?.cor ? novo.cor : s.cor };
  });

  async function subirBrasao(e) {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setErro(''); setAviso('');
    try {
      const { dataUrl, temFundo } = await prepararBrasao(arq);
      setV((s) => ({ ...s, brasao: dataUrl }));
      if (temFundo) setAviso('Esse desenho parece ter fundo. O quadro fica melhor em PNG transparente.');
    } catch (ex) { setErro(ex.message); }
  }

  const pronto = Boolean(String(v.nome).trim()) && Boolean(String(v.historia).trim())
    && Boolean(String(v.funcao).trim());

  const enviar = async () => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      if (inicial) await reenviarCla(usuario, inicial, v);
      else await registrarCla(usuario, v, guildas);
      await d.recarregar();
      aoFechar();
    } catch (ex) {
      setErro(ex.message || 'Não foi possível registrar agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={inicial ? `Corrigir o registro — ${inicial.nome}` : 'Registrar um clã'}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            Vai à Corte para reconhecimento. Sem taxa.
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!pronto || ocupado} onClick={enviar}>
            {ocupado ? 'Enviando…' : 'Enviar à Corte'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro">{erro}</div>}

      <div className="campo">
        <label>Que tipo de clã é este</label>
        <div className="origem-escolha tipos-cla">
          {TIPOS_GUILDA.map((x) => (
            <button
              type="button"
              key={x.id}
              className={`origem-op ${v.tipo === x.id ? 'ativo' : ''}`}
              onClick={() => trocarTipo(x.id)}
            >
              <Icone nome={x.icone} tam={17} cor={v.tipo === x.id ? x.cor : 'var(--txt-3)'} />
              <strong>{x.nome}</strong>
              <span>{x.resumo}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="perfil-nota-corte" style={{ marginTop: 4 }}>{t.proposta}</p>

      <div className="cla-editor" style={{ marginTop: 12 }}>
        <div className="cla-brasao-edit">
          <div className="brasao-quadro" style={{ borderColor: v.cor }}>
            {v.brasao
              ? <img src={v.brasao} alt="" />
              : <Icone nome={t.icone} tam={40} cor="var(--line-2)" />}
          </div>
          <input ref={entrada} type="file" accept="image/png,image/webp,image/svg+xml"
                 onChange={subirBrasao} style={{ display: 'none' }} />
          <button className="btn pq" onClick={() => entrada.current?.click()}>
            {v.brasao ? 'Trocar símbolo' : 'Enviar símbolo'}
          </button>
          {v.brasao && (
            <button className="btn pq fantasma" onClick={() => setV((s) => ({ ...s, brasao: null }))}>
              Remover
            </button>
          )}
          <p className="brasao-regra">
            PNG ou WEBP <b>sem fundo</b>, até {MAX_ARQUIVO_MB} MB — ajustado para{' '}
            {LADO_BRASAO}×{LADO_BRASAO} px.
          </p>
          {aviso && <p className="brasao-alerta">{aviso}</p>}
        </div>

        <div className="cla-campos">
          <div className="grade g2">
            <Texto rotulo="Nome do clã" valor={v.nome} aoMudar={set('nome')}
                   placeholder="Companhia da Lanterna, Filhos de Mara…" maxLength={50} />
            <Campo rotulo="Cor do clã">
              <input type="color" value={v.cor} onChange={(e) => set('cor')(e.target.value)}
                     style={{ height: 38, padding: 3 }} />
            </Campo>
          </div>
          <Texto rotulo="Lema (opcional)" valor={v.lema} aoMudar={set('lema')}
                 placeholder="Uma frase curta" maxLength={60} />
        </div>
      </div>

      <div style={{ height: 12 }} />
      <AreaTexto
        rotulo="História do clã"
        valor={v.historia}
        aoMudar={set('historia')}
        placeholder="Como o clã nasceu, quem o fundou, o que já viveu antes de chegar a Riften…"
        rows={4}
      />
      <div style={{ height: 10 }} />
      <AreaTexto
        rotulo="Função do clã no roleplay de Riften"
        valor={v.funcao}
        aoMudar={set('funcao')}
        placeholder={`O que o clã se propõe a fazer no Hold. Ex.: ${t.ganchos[0]}.`}
        rows={4}
      />
      <p className="ajuda">
        <Icone nome="livro" tam={13} /> A Corte lê estes dois textos para decidir. Diga o que o
        clã faz na prática — é isso que dá lugar a ele na cidade.
      </p>
    </Modal>
  );
}

/* ============================================================
   A ficha pública de um clã
   ============================================================ */
function FichaDoCla({ guilda, licencas, aoFechar }) {
  const t = tipoDoCla(guilda);
  const ativas = licencasDoCla(guilda, licencas).filter((l) => l.status === 'Ativa');
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
            {guilda.propriedade_nome && <Selo>Sede: {guilda.propriedade_nome}</Selo>}
            <Selo tom="off">Reconhecido em {quando(guilda.avaliado_em || guilda.criado_em)}</Selo>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <h4 className="bloco-titulo">História</h4>
      <p className="cla-texto">{guilda.historia || '—'}</p>

      <h4 className="bloco-titulo">Função no roleplay de Riften</h4>
      <p className="cla-texto">{guilda.funcao || '—'}</p>

      <h4 className="bloco-titulo">Gente do clã</h4>
      {gentesDoCla(guilda).map((g) => (
        <div className={`linha-nobre ${g.lidera ? 'destaque' : ''}`} key={g.chave}>
          <Icone nome={g.lidera ? 'coroa' : 'pessoa'} tam={15}
                 cor={g.lidera ? 'var(--gold)' : 'var(--purple)'} />
          <span className="ln-nome">{g.nome}</span>
          <Selo tom={g.lidera ? 'gold' : ''}>{g.cargo}</Selo>
          {g.notas && <span className="ln-nota">{g.notas}</span>}
        </div>
      ))}

      {ativas.length > 0 && (
        <>
          <h4 className="bloco-titulo">Licenças do clã</h4>
          <p className="painel-nota">Estas licenças valem para todos os membros do clã.</p>
          {ativas.map((l) => <LinhaLicenca key={l.id} licenca={l} />)}
        </>
      )}
    </Modal>
  );
}
