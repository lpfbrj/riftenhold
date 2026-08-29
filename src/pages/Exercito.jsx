import React, { useEffect, useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  RACAS, STATUS_MILITAR, NIVEIS, NIVEL_VALOR, GRUPOS_PERICIA, TODAS_PERICIAS,
} from '../lib/constants.js';
import {
  Painel, Stat, Selo, SeloStatus, Modal, Texto, AreaTexto, Selecao,
  Icone, Vazio, Pips, Confirmar, Campo,
} from '../components/ui.jsx';
import SeletorCivil from '../components/SeletorCivil.jsx';
import FichaCidadao from '../components/FichaCidadao.jsx';
import { civilDaFicha } from '../lib/perfil.js';
import {
  divisoesAtivas, todasAsDivisoes, divisaoDe, nomeDaDivisao, capitaoDa,
  operantesDaDivisao, efetivoDaDivisao, patentesAtivas, hierarquia, patenteDe,
  nomeDaPatente, ordenarTropa, resumoDasForcas, salarioDe, soldoDe, dataBR,
  campanhaAberta, miliciaViva, septims,
} from '../lib/forcas.js';
import PainelDivisoes from './exercito/PainelDivisoes.jsx';
import PainelHierarquia from './exercito/PainelHierarquia.jsx';
import PainelMilicia from './exercito/PainelMilicia.jsx';
import PainelMissoes from './exercito/PainelMissoes.jsx';

const MAX = TODAS_PERICIAS.length * 5;

export function poderDe(guarda) {
  const p = guarda?.pericias || {};
  const soma = TODAS_PERICIAS.reduce((s, k) => s + (NIVEL_VALOR[p[k]] || 0), 0);
  return { soma, pct: Math.round((soma / MAX) * 100) };
}

const VAZIO = {
  nome: '', civil_id: '', id_jogo: '', raca: '', patente: '', patente_id: '',
  divisao: '', divisao_id: '', status: 'Operante', notas: '', salario: '',
  pago_em: null, pericias: {},
};

/** A ficha tem soldo próprio arbitrado? Zero também é um valor. */
const proprio = (ficha) => ficha?.salario !== undefined && ficha?.salario !== null
  && String(ficha.salario).trim() !== '';

/**
 * As opções de um seletor, garantindo a que a ficha já usa — uma
 * patente aposentada ou uma divisão desativada continuam sendo a
 * verdade daquele soldado, e sumir da lista faria parecer apagada.
 */
function comAtual(lista, atual, aviso) {
  const opcoes = lista.map((x) => ({ valor: x.id, rotulo: x.nome }));
  if (atual && !lista.some((x) => x.id === atual.id)) {
    opcoes.push({ valor: atual.id, rotulo: `${atual.nome} · ${aviso}` });
  }
  return opcoes;
}

const ABAS = [
  { id: 'forcas',     nome: 'Forças de Riften', icone: 'espada',     sub: 'A soma das três forças' },
  { id: 'efetivo',    nome: 'Efetivo',          icone: 'pessoa',     sub: 'O rol do Exército' },
  { id: 'divisoes',   nome: 'Divisões',         icone: 'escudo',     sub: 'Criar, editar e comandar' },
  { id: 'missoes',    nome: 'Missões',          icone: 'balanca',    sub: 'Ordens e recompensas' },
  { id: 'hierarquia', nome: 'Hierarquia',       icone: 'pergaminho', sub: 'Patentes e soldos' },
  { id: 'milicia',    nome: 'Milícia',          icone: 'estandarte', sub: 'Voluntários e convocação' },
];

export default function Exercito({ usuario }) {
  const d = useDados();
  const [aba, setAba] = useState('forcas');
  // Cada clique em "Alistar" no topo leva ao Efetivo com a ficha aberta.
  const [pedidoAlistar, setPedidoAlistar] = useState(0);

  const guardas = d.guardas || [];
  const divisoes = d.divisoes || [];
  const patentes = d.patentes || [];
  const milicia = d.milicia || [];
  const campanhas = d.campanhas || [];
  const clas = d.clas || [];
  const corte = d.corte || [];
  const missoes = d.missoes_exercito || [];

  const forcas = useMemo(
    () => resumoDasForcas({ guardas, clas, milicia }),
    [guardas, clas, milicia],
  );

  const missoesAtivas = missoes.filter((m) => ['Aberta', 'Em andamento'].includes(m.status)).length;

  const contagem = {
    forcas: forcas.total,
    efetivo: guardas.length,
    divisoes: divisoesAtivas(divisoes).length,
    missoes: missoesAtivas,
    hierarquia: patentesAtivas(patentes).length,
    milicia: miliciaViva(milicia).length,
  };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Forças de Riften</h1>
          <p>
            Exército, mesnadas das casas nobres e milícia — tudo o que arma o Hold, somado
            num lugar só. Divisões, hierarquia, missões e soldo são editados aqui pela Corte e Comando.
          </p>
        </div>
        <div className="acoes">
          <button
            className="btn primario"
            onClick={() => { setAba('efetivo'); setPedidoAlistar((n) => n + 1); }}
          >
            <Icone nome="mais" tam={15} /> Alistar
          </button>
        </div>
      </div>
      <div className="regra" />

      <nav className="abas-forca" aria-label="Seções do Exército">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`aba-forca ${aba === a.id ? 'ativa' : ''}`}
            onClick={() => setAba(a.id)}
          >
            <Icone nome={a.icone} tam={15} cor={aba === a.id ? 'var(--gold)' : 'var(--txt-3)'} />
            <span className="aba-forca-txt">
              <strong>{a.nome}</strong>
              <small>{a.sub}</small>
            </span>
            <span className="aba-forca-num mono">{contagem[a.id]}</span>
          </button>
        ))}
      </nav>

      {aba === 'forcas' && (
        <AbaForcas forcas={forcas} guardas={guardas} divisoes={divisoes}
                   milicia={milicia} campanhas={campanhas} patentes={patentes} />
      )}
      {aba === 'efetivo' && (
        <AbaEfetivo dados={d} guardas={guardas} divisoes={divisoes} patentes={patentes}
                    pedidoAlistar={pedidoAlistar} aoConsumir={() => setPedidoAlistar(0)} />
      )}
      {aba === 'divisoes' && (
        <PainelDivisoes
          dados={d}
          usuario={usuario}
          divisoes={divisoes}
          guardas={guardas}
          patentes={patentes}
          corte={corte}
          aoNavegarParaMissoes={() => setAba('missoes')}
        />
      )}
      {aba === 'missoes' && (
        <PainelMissoes
          dados={d}
          usuario={usuario}
          divisoes={divisoes}
          guardas={guardas}
          patentes={patentes}
          corte={corte}
        />
      )}
      {aba === 'hierarquia' && (
        <PainelHierarquia dados={d} patentes={patentes} guardas={guardas} />
      )}
      {aba === 'milicia' && (
        <PainelMilicia dados={d} milicia={milicia} campanhas={campanhas} civis={d.civis || []} />
      )}
    </>
  );
}

/* ============================================================
   ABA 1 — Forças de Riften
   ============================================================ */
function AbaForcas({ forcas, guardas, divisoes, milicia, campanhas, patentes }) {
  const campanha = campanhaAberta(campanhas);
  const divs = todasAsDivisoes(divisoes).filter((x) => x.ativa !== false);
  const maior = Math.max(1, ...divs.map((x) => operantesDaDivisao(x, guardas, divisoes).length));

  const barra = (parte) => `${forcas.total ? Math.round((parte / forcas.total) * 100) : 0}%`;

  return (
    <>
      <div className="grade g4" style={{ margin: '18px 0' }}>
        <Stat rotulo="Força total do Hold" valor={forcas.total}
              sub={`${forcas.prontos} prontos para marchar`} />
        <Stat rotulo="Exército de Riften" valor={forcas.exercito.total}
              sub={`${forcas.exercito.prontos} operantes`} tom="verde" />
        <Stat rotulo="Mesnadas" valor={forcas.mesnadas.total}
              sub={`${forcas.mesnadas.casas} casa(s) com bandeira`} tom="roxo" />
        <Stat rotulo="Milícia" valor={forcas.milicia.total}
              sub={`${forcas.milicia.prontos} convocado(s)`} tom="laranja" />
      </div>

      <Painel titulo="Como o Hold se arma">
        <p className="painel-nota">
          A força de Riften não é uma coisa só. O <strong>Exército</strong> é a tropa permanente,
          repartida em divisões e paga pelo tesouro. As <strong>mesnadas</strong> são os homens de
          armas das casas nobres: a casa sustenta, o Hold conta. A <strong>milícia</strong> é
          gente da cidade que se ofereceu para a guerra e só marcha quando convocada.
        </p>
        <div className="forca-barras">
          <FaixaForca nome="Exército de Riften" valor={forcas.exercito.total}
                      pct={barra(forcas.exercito.total)} cor="var(--gold)" />
          <FaixaForca nome="Mesnadas das casas" valor={forcas.mesnadas.total}
                      pct={barra(forcas.mesnadas.total)} cor="var(--purple)" />
          <FaixaForca nome="Milícia de Riften" valor={forcas.milicia.total}
                      pct={barra(forcas.milicia.total)} cor="var(--autumn)" />
        </div>
      </Painel>

      <div style={{ height: 16 }} />

      <Painel titulo={`Divisões do Exército · ${divs.length}`}>
        {divs.length === 0 ? (
          <Vazio simb="⚔">Nenhuma divisão criada. Vá em <strong>Divisões</strong> e crie a primeira.</Vazio>
        ) : (
          <div className="lista-divisoes">
            {divs.map((div) => {
              const operantes = operantesDaDivisao(div, guardas, divisoes).length;
              const total = efetivoDaDivisao(div, guardas, divisoes).length;
              const cap = capitaoDa(div, guardas);
              return (
                <article className="divisao-linha" key={div.id}>
                  <span className="divisao-marca" style={{ background: div.cor || 'var(--gold)' }}>
                    <Icone nome={div.icone || 'escudo'} tam={15} cor="#15120c" />
                  </span>
                  <div className="divisao-corpo">
                    <h4>{div.nome}</h4>
                    <p>{div.funcoes || 'Sem funções descritas.'}</p>
                    <div className="chip-lista">
                      <Selo tom={cap ? 'gold' : 'off'}>
                        {cap ? `Capitão ${cap.nome}` : 'Sem capitão'}
                      </Selo>
                      <Selo>{total} na divisão</Selo>
                      <Selo tom={operantes ? 'ok' : 'off'} ponto>{operantes} operante(s)</Selo>
                    </div>
                  </div>
                  <div className="divisao-medida">
                    <strong>{operantes}</strong>
                    <div className="divisao-barra">
                      <span style={{ width: `${(operantes / maior) * 100}%`, background: div.cor || 'var(--gold)' }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      <Painel titulo={`Mesnadas das casas nobres · ${forcas.mesnadas.total} homens de armas`}>
        {forcas.listaMesnadas.length === 0 ? (
          <Vazio simb="⚜">
            Nenhuma casa tem mesnada registrada. A casa nobre pede o Registro de Mesnada
            à Corte e depois alista os próprios homens de armas.
          </Vazio>
        ) : (
          <div className="lista-divisoes">
            {forcas.listaMesnadas.map((m) => (
              <article className="divisao-linha" key={m.id}>
                <span className="divisao-marca" style={{ background: m.cor }}>
                  <Icone nome="escudo" tam={15} cor="#15120c" />
                </span>
                <div className="divisao-corpo">
                  <h4>{m.nome}</h4>
                  <p>Mesnada da Casa {m.casa} — sustentada pela casa, contada na força do Hold.</p>
                  <div className="chip-lista">
                    {m.soldados.slice(0, 6).map((s, i) => (
                      <Selo key={`${m.id}:${i}`} tom="roxo">
                        {s.nome}{s.posto ? ` · ${s.posto}` : ''}
                      </Selo>
                    ))}
                    {m.soldados.length > 6 && <Selo>+{m.soldados.length - 6}</Selo>}
                  </div>
                </div>
                <div className="divisao-medida">
                  <strong>{m.efetivo}</strong>
                  <small>homens</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      <Painel titulo="Milícia de Riften">
        {campanha ? (
          <div className="campanha-cartaz">
            <div>
              <h4>{campanha.nome}</h4>
              <p>{campanha.motivo || 'Sem motivo declarado.'}</p>
            </div>
            <div className="chip-lista">
              <Selo tom={campanha.status === 'Em campanha' ? 'gold' : 'warn'} ponto>{campanha.status}</Selo>
              <Selo>{forcas.milicia.prontos} convocado(s)</Selo>
              <Selo tom="ok">Soldo {septims(campanha.soldo || 0)}</Selo>
            </div>
          </div>
        ) : (
          <p className="painel-nota" style={{ marginBottom: 0 }}>
            Nenhuma campanha aberta. Há <strong>{forcas.milicia.total}</strong> morador(es) na
            lista da milícia, à espera de chamado.
          </p>
        )}
      </Painel>
    </>
  );
}

function FaixaForca({ nome, valor, pct, cor }) {
  return (
    <div className="forca-faixa">
      <div className="forca-faixa-topo">
        <span>{nome}</span>
        <strong>{valor}</strong>
      </div>
      <div className="forca-faixa-barra">
        <span style={{ width: pct, background: cor }} />
      </div>
      <small>{pct} da força do Hold</small>
    </div>
  );
}

/* ============================================================
   ABA 2 — Efetivo
   ============================================================ */
function AbaEfetivo({ dados: d, guardas, divisoes, patentes, pedidoAlistar = 0, aoConsumir }) {
  const [busca, setBusca] = useState('');
  const [fPatente, setFPatente] = useState('');
  const [fDivisao, setFDivisao] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [edit, setEdit] = useState(null);
  const [ver, setVer] = useState(null);
  const [rem, setRem] = useState(null);
  const [perfil, setPerfil] = useState(null);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const filtrados = (guardas || []).filter((g) =>
      (!t || g.nome?.toLowerCase().includes(t)) &&
      (!fPatente || patenteDe(g, patentes)?.id === fPatente) &&
      (!fDivisao || divisaoDe(g, divisoes)?.id === fDivisao) &&
      (!fStatus || g.status === fStatus));
    return ordenarTropa(filtrados, patentes);
  }, [guardas, patentes, divisoes, busca, fPatente, fDivisao, fStatus]);

  const cont = (s) => (guardas || []).filter((g) => g.status === s).length;

  // O botão "Alistar" do topo da tela abre a ficha aqui dentro — e o
  // pedido é consumido na hora: sem isso, cada volta a esta aba
  // reabriria o formulário sozinha.
  useEffect(() => {
    if (!pedidoAlistar) return;
    setEdit({ ...VAZIO });
    aoConsumir?.();
  }, [pedidoAlistar, aoConsumir]);

  return (
    <>
      <div className="grade g4" style={{ margin: '18px 0' }}>
        <Stat rotulo="Efetivo total" valor={guardas.length} sub="no registro militar" />
        <Stat rotulo="Operantes" valor={cont('Operante')} sub="prontos para escala" tom="verde" />
        <Stat rotulo="Ausentes" valor={cont('Ausente')} sub="fora de serviço" tom="laranja" />
        <Stat rotulo="Aposentados" valor={cont('Aposentado')} sub="baixa honrosa" tom="roxo" />
      </div>

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do soldado…" />
        </div>
        <Selecao rotulo="Patente" valor={fPatente} aoMudar={setFPatente} vazioLabel="Todas"
                 opcoes={hierarquia(patentes).map((p) => ({ valor: p.id, rotulo: p.nome }))} />
        <Selecao rotulo="Divisão" valor={fDivisao} aoMudar={setFDivisao} vazioLabel="Todas"
                 opcoes={todasAsDivisoes(divisoes).map((x) => ({ valor: x.id, rotulo: x.nome }))} />
        <Selecao rotulo="Status" valor={fStatus} aoMudar={setFStatus} opcoes={STATUS_MILITAR} vazioLabel="Todos" />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn primario" onClick={() => setEdit({ ...VAZIO })}>
            <Icone nome="mais" tam={15} /> Alistar
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        <Painel><Vazio simb="⚔">Nenhum soldado corresponde ao filtro.</Vazio></Painel>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Raça</th><th>Patente</th><th>Divisão</th>
                <th>Status</th><th>Soldo semanal</th><th>Aptidão</th><th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((g) => {
                const { pct } = poderDe(g);
                const div = divisaoDe(g, divisoes);
                return (
                  <tr key={g.id}>
                    <td>
                      <button className="nome-forte" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              onClick={() => setVer(g)}>
                        {g.nome}
                      </button>
                    </td>
                    <td style={{ color: 'var(--txt-2)' }}>{g.raca || '—'}</td>
                    <td><Selo tom="gold">{nomeDaPatente(g, patentes) || '—'}</Selo></td>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                      {div && <i className="ponto-cor" style={{ background: div.cor || 'var(--gold)' }} />}
                      {nomeDaDivisao(g, divisoes) || '—'}
                    </td>
                    <td><SeloStatus status={g.status} /></td>
                    <td className="mono" style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                      {salarioDe(g, patentes).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 62, height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--gold-2),var(--autumn))' }} />
                        </div>
                        <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="col-acoes">
                      {civilDaFicha(g, d.civis || []) && (
                        <>
                          <button className="btn pq fantasma" title="Perfil completo"
                                  onClick={() => setPerfil(civilDaFicha(g, d.civis || []))}>
                            <Icone nome="pessoa" tam={13} />
                          </button>{' '}
                        </>
                      )}
                      <button className="btn pq fantasma" title="Editar ficha" onClick={() => setEdit(g)}>
                        <Icone nome="lapis" tam={13} />
                      </button>{' '}
                      <button className="btn pq perigo" title="Dar baixa" onClick={() => setRem(g)}>
                        <Icone nome="lixo" tam={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {perfil && <FichaCidadao civil={perfil} dados={d} aoFechar={() => setPerfil(null)} />}
      {ver && (
        <FichaGuarda
          guarda={ver}
          civil={civilDaFicha(ver, d.civis || [])}
          divisoes={divisoes}
          patentes={patentes}
          aoFechar={() => setVer(null)}
          aoEditar={() => { setEdit(ver); setVer(null); }}
          aoPerfil={(c) => { setVer(null); setPerfil(c); }}
        />
      )}
      {edit && (
        <FormGuarda
          inicial={edit}
          civis={d.civis || []}
          divisoes={divisoes}
          patentes={patentes}
          aoFechar={() => setEdit(null)}
          aoSalvar={async (v) => { await d.salvar('guardas', v); setEdit(null); }}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Remover ${rem.nome} do registro militar? Considere marcar como "Aposentado" em vez de apagar.`}
          aoConfirmar={() => d.remover('guardas', rem.id, rem.nome)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FichaGuarda({ guarda, civil, divisoes, patentes, aoFechar, aoEditar, aoPerfil }) {
  const { pct, soma } = poderDe(guarda);
  const soldo = soldoDe(guarda, patentes);
  const div = divisaoDe(guarda, divisoes);
  const cap = div ? capitaoDa(div, []) : null;
  return (
    <Modal
      titulo={guarda.nome}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          {civil && (
            <button className="btn" style={{ marginRight: 'auto' }} onClick={() => aoPerfil(civil)}>
              <Icone nome="pessoa" tam={14} /> Perfil completo
            </button>
          )}
          <button className="btn fantasma" onClick={aoFechar}>Fechar</button>
          <button className="btn primario" onClick={aoEditar}><Icone nome="lapis" tam={14} /> Editar ficha</button>
        </>
      }
    >
      <div className="chip-lista" style={{ marginBottom: 14 }}>
        <Selo tom="gold">{nomeDaPatente(guarda, patentes) || '—'}</Selo>
        <Selo>{guarda.raca || '—'}</Selo>
        {guarda.id_jogo && <Selo tom="ok"><span className="mono">ID {guarda.id_jogo}</span></Selo>}
        <Selo tom="roxo">{nomeDaDivisao(guarda, divisoes) || 'Sem divisão'}</Selo>
        <SeloStatus status={guarda.status} />
        <Selo tom="gold">Aptidão {pct}% · {soma}/{MAX}</Selo>
      </div>

      <div className="grade g3" style={{ marginBottom: 16 }}>
        <Stat rotulo="Soldo semanal" valor={septims(soldo.valor)}
              sub={proprio(guarda) ? 'arbitrado pela Corte' : 'pela patente'} />
        <Stat rotulo="Último pagamento" valor={dataBR(soldo.pagoEm)}
              sub={soldo.dataInvalida ? 'data ilegível na ficha'
                : soldo.nunca ? 'nunca recebeu' : `por ${guarda.pago_por || 'Corte'}`} />
        <Stat rotulo="Próximo pagamento" valor={soldo.proximo ? dataBR(soldo.proximo) : '—'}
              sub={soldo.vencido ? 'vencido' : `em ${soldo.dias} dia(s)`}
              tom={soldo.vencido ? 'laranja' : 'verde'} />
      </div>

      {div?.funcoes && (
        <p className="painel-nota">
          <strong>{div.nome}</strong> — {div.funcoes}
          {cap?.nome ? ` Capitão: ${cap.nome}.` : ''}
        </p>
      )}

      {guarda.notas && (
        <p style={{ color: 'var(--txt-2)', fontSize: 12.5, borderLeft: '2px solid var(--line-2)', paddingLeft: 12, margin: '0 0 16px' }}>
          {guarda.notas}
        </p>
      )}
      <div className="grade g2">
        {GRUPOS_PERICIA.map((grp) => (
          <div className="grupo-pericia" key={grp.id}>
            <h4>{grp.nome}</h4>
            {grp.pericias.map((p) => (
              <div className="pericia-linha" key={p}>
                <span className="nm">{p}</span>
                <Pips nivel={guarda.pericias?.[p]} />
                <span className="lv">{guarda.pericias?.[p] || 'N/A'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormGuarda({ inicial, civis = [], divisoes = [], patentes = [], aoFechar, aoSalvar }) {
  const patentesUteis = patentesAtivas(patentes);
  const divisoesUteis = divisoesAtivas(divisoes);
  const novaFicha = !inicial.id;
  // Sugerir a patente da base e a primeira divisão só faz sentido para
  // quem está sendo alistado agora. Numa ficha que já existe, isso
  // realocaria de mão beijada quem foi deixado de propósito sem divisão.
  const padraoPatente = patenteDe(inicial, patentes)?.id
    || (novaFicha ? patentesUteis[patentesUteis.length - 1]?.id || '' : '');
  const padraoDivisao = divisaoDe(inicial, divisoes)?.id
    || (novaFicha ? divisoesUteis[0]?.id || '' : '');

  const [v, setV] = useState({
    ...VAZIO, ...inicial,
    patente_id: padraoPatente,
    divisao_id: padraoDivisao,
    pericias: { ...(inicial.pericias || {}) },
  });
  const [ocupado, setOcupado] = useState(false);

  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const vinculado = v.civil_id ? civis.find((c) => c.id === v.civil_id) : null;
  const puxarCivil = (c) => setV((s) => ({
    ...s, civil_id: c.id, nome: c.nome, id_jogo: c.id_jogo || '', raca: c.raca || s.raca,
  }));
  const setPericia = (p, n) => setV((s) => ({ ...s, pericias: { ...s.pericias, [p]: n } }));
  const preencherGrupo = (grp, n) =>
    setV((s) => ({ ...s, pericias: { ...s.pericias, ...Object.fromEntries(grp.pericias.map((p) => [p, n])) } }));

  const patente = hierarquia(patentes).find((p) => p.id === v.patente_id) || null;
  const divisao = todasAsDivisoes(divisoes).find((x) => x.id === v.divisao_id) || null;
  const { pct } = poderDe(v);
  const soldo = salarioDe({ ...v, patente_id: patente?.id, patente: patente?.nome }, patentes);

  /** O nome da patente e o da divisão viajam junto com o id: se a
   *  Corte apagar o registro, a ficha ainda diz o que ele era. */
  const salvar = async () => {
    setOcupado(true);
    try {
      await aoSalvar({
        ...v,
        patente: patente?.nome || v.patente || '',
        divisao: divisao?.nome || v.divisao || '',
        // Em branco é "usa o da patente" — e isso se grava como nulo:
        // a coluna do banco é inteira e recusaria a string vazia.
        salario: String(v.salario ?? '').trim() === '' ? null : Math.max(0, Number(v.salario) || 0),
      });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={inicial.id ? `Ficha — ${inicial.nome}` : 'Alistar novo soldado'}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            Aptidão calculada: <strong style={{ color: 'var(--gold)' }}>{pct}%</strong>
            {' · '}Soldo: <strong style={{ color: 'var(--gold)' }}>{septims(soldo)}</strong>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado || !String(v.nome || '').trim()} onClick={salvar}>
            {ocupado ? 'Salvando…' : 'Salvar ficha'}
          </button>
        </>
      }
    >
      <SeletorCivil
        rotulo="Cidadão"
        valor={v.nome}
        aoMudar={(n) => setV((s) => ({ ...s, nome: n, civil_id: '', id_jogo: '' }))}
        aoEscolher={puxarCivil}
        civis={civis}
        vinculado={vinculado}
        aoDesvincular={() => setV((s) => ({ ...s, civil_id: '', id_jogo: '' }))}
      />
      <div style={{ height: 12 }} />
      <div className="grade g3">
        <Texto rotulo="ID do jogo" valor={v.id_jogo} aoMudar={set('id_jogo')} className="mono" placeholder="preenchido pelo Registro Civil" />
        <Selecao rotulo="Raça" valor={v.raca} aoMudar={set('raca')} opcoes={RACAS} />
        <Selecao rotulo="Patente" valor={v.patente_id} aoMudar={set('patente_id')} vazioLabel="—"
                 opcoes={comAtual(patentesUteis, patenteDe(inicial, patentes), 'fora de uso')} />
        <Selecao rotulo="Divisão" valor={v.divisao_id} aoMudar={set('divisao_id')} vazioLabel="Sem divisão"
                 opcoes={comAtual(divisoesUteis, divisaoDe(inicial, divisoes), 'desativada')} />
        <Selecao rotulo="Status" valor={v.status} aoMudar={set('status')} opcoes={STATUS_MILITAR} vazioLabel="—" />
        <Campo rotulo="Soldo próprio (Septims/semana)">
          <input
            type="number" min="0" className="mono"
            value={v.salario ?? ''}
            onChange={(e) => set('salario')(e.target.value)}
            placeholder={`vazio = ${patente?.salario ?? '—'} da patente`}
          />
        </Campo>
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Observações" valor={v.notas} aoMudar={set('notas')} placeholder="Feitos, punições, escala, ferimentos…" />

      <div style={{ height: 20 }} />
      <h4 style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
        Registro de Habilidades
      </h4>
      <div className="grade g2">
        {GRUPOS_PERICIA.map((grp) => (
          <div className="grupo-pericia" key={grp.id}>
            <h4>
              {grp.nome}
              <select
                onChange={(e) => { if (e.target.value) preencherGrupo(grp, e.target.value); e.target.value = ''; }}
                defaultValue=""
                className="mini-select"
                title="Preencher o grupo inteiro"
              >
                <option value="">preencher…</option>
                {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </h4>
            {grp.pericias.map((p) => (
              <div className="pericia-linha" key={p}>
                <span className="nm">{p}</span>
                <Pips nivel={v.pericias[p]} />
                <select
                  className="mini-select largo"
                  value={v.pericias[p] || 'N/A'}
                  onChange={(e) => setPericia(p, e.target.value)}
                >
                  {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
