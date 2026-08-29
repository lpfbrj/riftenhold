import React, { useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { cobrarTaxaDaChancelaria } from '../lib/db.js';
import {
  RACAS, TITULOS_LIDER, TITULOS_NOBREZA, TITULO_NOBREZA_TOM, ehResidencia,
  TIPOS_PEDIDO_CASA, PEDIDO_CASA_POR_ID, STATUS_PEDIDO_CASA_TOM, SITUACAO_CASA_TOM, MAX_LEMA,
} from '../lib/constants.js';
import { listaNobreza, casaDoVilarejo, listaServos, tituloDe } from '../lib/nobreza.js';
import {
  casasAprovadas, aplicarPedido, resumoDoPedido, todasAsAliancas, aliancasDe,
  sedeDe, septims, limparLema,
} from '../lib/casas.js';
import { cargosDaCorte, idNovoCargo, proximaOrdem, cargoDeFabrica } from '../lib/corte.js';
import { apagarRegistro, limparRegistros } from '../lib/db.js';
import { recadoPara } from './Avisos.jsx';
import { prepararBrasao, LADO_BRASAO, MAX_ARQUIVO_MB } from '../lib/imagem.js';
import { lerCatalogacao, totalItens, mesclarItens } from '../data/itens.js';
import { Catalogo, EditorCatalogo } from '../components/Catalogo.jsx';
import FormPropriedade, { PROPRIEDADE_VAZIA } from '../components/FormPropriedade.jsx';
import SeletorCivil from '../components/SeletorCivil.jsx';
import FichaCidadao from '../components/FichaCidadao.jsx';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar, Campo,
} from '../components/ui.jsx';

const data = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

/** Chave só de interface, para o React não trocar as linhas de lugar. */
let contadorChave = 0;
const chaveNova = () => `k${(contadorChave += 1)}`;

export default function Palacio({ usuario }) {
  const d = useDados();
  const [editCargo, setEditCargo] = useState(null);
  const [defCargo, setDefCargo] = useState(null);   // criar / editar o cargo em si
  const [remCargo, setRemCargo] = useState(null);
  const [verCla, setVerCla] = useState(null);
  const [remCla, setRemCla] = useState(null);
  const [verVila, setVerVila] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [erroChancela, setErroChancela] = useState('');

  const porCargo = useMemo(
    () => Object.fromEntries((d.corte || []).map((c) => [c.cargo_id || c.id, c])),
    [d.corte],
  );
  const clasPorId = useMemo(
    () => Object.fromEntries((d.clas || []).map((c) => [c.id, c])),
    [d.clas],
  );

  // Os cargos como a Corte os definiu: os seis de fábrica, com as
  // personalizações por cima, mais os que ela mesma criou.
  const cargos = useMemo(() => cargosDaCorte(d.corte || []), [d.corte]);
  const preenchidos = cargos.filter((c) => porCargo[c.id]?.nome).length;
  const clas = d.clas || [];
  // A casa recém-fundada só entra nas listas do Hold depois do aval:
  // até lá ela vive na Chancelaria e na tela de quem a fundou.
  const clasVivas = useMemo(() => casasAprovadas(clas), [clas]);
  const totalMembros = clasVivas.reduce((s, c) => s + (c.membros?.length || 0), 0);
  const assentamentos = d.assentamentos || [];
  // Riften é a sede do Jarl, não um vilarejo com Lorde nomeado.
  const vilarejos = assentamentos.filter((a) => a.tipo !== 'Cidade');
  const semLorde = vilarejos.filter((a) => !a.lorde).length;

  /**
   * A Corte julga a indicação de um Patriarca.
   *
   * Aprovar faz o indicado entrar na casa como Nobre — daí em diante a
   * Nobreza de Riften o enxerga. Recusar tira o pedido da lista e deixa
   * um recado no Quadro de Avisos para quem indicou.
   */
  const julgarPedido = async (pedido, status, observacao) => {
   try {
    if (status === 'Aprovado') {
      const cla = clas.find((c) => c.id === pedido.cla_id);
      if (cla) {
        const jaEsta = (cla.membros || []).some(
          (m) => (pedido.civil_id && m.civil_id === pedido.civil_id) ||
                 String(m.nome || '').trim().toLowerCase() === String(pedido.nome || '').trim().toLowerCase(),
        );
        if (!jaEsta) {
          await d.salvar('clas', {
            ...cla,
            membros: [...(cla.membros || []), {
              nome: pedido.nome, civil_id: pedido.civil_id || '',
              id_jogo: pedido.id_jogo || '', raca: pedido.raca || '',
              titulo: 'Nobre', notas: pedido.parentesco || '',
            }],
          }, `${pedido.nome} entra na Casa ${cla.nome}`);
        }
      }
    }

    const assinatura = usuario?.nome || usuario?.cargo || 'Corte';
    await d.salvar('pedidos_dinastia', {
      ...pedido, status,
      observacao_corte: observacao || '',
      avaliado_por: assinatura,
      avaliado_em: new Date().toISOString(),
    }, `${pedido.nome} — ${status.toLowerCase()}`);

    // O Patriarca fica sabendo pelo Quadro de Avisos, no acesso dele.
    if (pedido.pedido_por_civil_id) {
      const aprovado = status === 'Aprovado';
      await d.salvar('avisos', recadoPara(
        pedido.pedido_por_civil_id,
        aprovado
          ? `${pedido.nome} entrou na Casa ${pedido.cla_nome}`
          : `A Corte recusou a entrada de ${pedido.nome} na Casa ${pedido.cla_nome}`,
        aprovado
          ? `A Corte aprovou a sua indicação. ${pedido.nome} passa a constar como Nobre da Casa ${pedido.cla_nome} na Nobreza de Riften.`
          : `A Corte recusou a sua indicação de ${pedido.nome} para a Casa ${pedido.cla_nome}.` +
            (observacao ? ` Motivo: ${observacao}` : ' Nenhum motivo foi registrado.'),
        assinatura,
      ), `recado para ${pedido.pedido_por}`);
    }
   } catch (e) {
   // O quadro da página só enxerga o que passa por `d.salvar`. A
   // cobrança da taxa é chamada direto, então o motivo dela viria a
   // morrer aqui — e a Corte acharia que cobrou quando não cobrou.
   setErroChancela(e.message || 'Não consegui concluir o julgamento.');
 }
  };

  /**
   * A Corte julga um ato da Chancelaria da Nobreza.
   *
   * Deferir aplica o efeito na hora — a casa passa a existir, ganha
   * insígnia nova, herdeiro, mesnada ou sede. A aliança não muda casa
   * nenhuma: ela se lê do próprio pedido deferido, nas duas pontas.
   */
  const julgarChancela = async (pedido, deferido, parecer = '') => {
   try {
    // A linha pode ter sido julgada por outra pessoa da Corte enquanto
    // esta tela estava aberta: julgar duas vezes reescreveria a data da
    // mesnada, do herdeiro, e cobraria a taxa de novo.
    const atual = (d.pedidos_casa || []).find((x) => x.id === pedido.id) || pedido;
    if (atual.status !== 'Pendente') return;

    const assinatura = usuario?.nome || usuario?.cargo || 'Corte de Riften';
    const cla = clas.find((c) => c.id === pedido.cla_id) || null;

    const patch = aplicarPedido(pedido, cla, deferido, assinatura);
    if (patch) await d.salvar('clas', patch, `Casa ${patch.nome}`);

    const julgado = await d.salvar('pedidos_casa', {
      ...pedido,
      status: deferido ? 'Deferido' : 'Indeferido',
      parecer: parecer || '',
      avaliado_por: assinatura,
      avaliado_em: new Date().toISOString(),
    }, `${PEDIDO_CASA_POR_ID[pedido.tipo]?.nome || pedido.tipo} — ${deferido ? 'deferido' : 'indeferido'}`);

    // A taxa da Chancelaria era escrita na tela e nunca cobrada. Agora
    // o deferimento lavra a cobrança — e só o deferimento: pedido
    // indeferido não custa nada a quem pediu.
    if (deferido && Number(pedido.custo) > 0) {
      await cobrarTaxaDaChancelaria(julgado?.id ? julgado : pedido, assinatura);
      // Sem recarregar, a cobrança recém-lavrada só apareceria na
      // Tesouraria depois de trocar de tela.
      await d.recarregar();
    }

    const ato = PEDIDO_CASA_POR_ID[pedido.tipo]?.nome || 'Pedido';
    const titulo = deferido ? `${ato} deferido` : `${ato} indeferido`;
    const corpo = (quem) => (deferido
      ? `A Corte de Riften deferiu ${quem}.` + (parecer ? ` Parecer: ${parecer}` : '')
      : `A Corte de Riften indeferiu ${quem}.` +
        (parecer ? ` Motivo: ${parecer}` : ' Nenhum motivo foi registrado.'));

    const alvo = (pedido.tipo === 'nobreza'
      ? 'o seu pedido de título de nobreza'
      : `o pedido de ${ato.toLowerCase()} da Casa ${pedido.cla_nome}`);

    if (pedido.civil_id) {
      await d.salvar('avisos', recadoPara(pedido.civil_id, titulo, corpo(alvo), assinatura),
        `recado para ${pedido.pedido_por}`);
    }
    // Na aliança as duas casas precisam saber.
    if (pedido.tipo === 'alianca' && pedido.alvo_cla_id) {
      const outra = clas.find((c) => c.id === pedido.alvo_cla_id);
      if (outra?.lider_civil_id) {
        await d.salvar('avisos', recadoPara(
          outra.lider_civil_id, titulo,
          corpo(`a aliança entre a Casa ${pedido.cla_nome} e a Casa ${outra.nome}`),
          assinatura,
        ), `recado para ${outra.lider}`);
      }
    }
   } catch { /* o quadro de erro da página já mostra o motivo */ }
  };

  /**
   * Criar ou reescrever um cargo.
   *
   * A linha da Corte é a linha do cargo, então a personalização mora nela:
   * `titulo` e `descricao` por cima do que veio de fábrica. Cargo novo é
   * uma linha nova, com um id tirado do próprio nome.
   */
  const salvarDefinicao = async (v) => {
    const novo = !v.id;
    const id = v.id || idNovoCargo(v.nome, d.corte || []);
    const anterior = porCargo[id] || {};
    await d.salvar('corte', {
      ...anterior,
      id, cargo_id: id,
      titulo: String(v.nome || '').trim(),
      descricao: String(v.descricao || '').trim(),
      ordem: Number(v.ordem) || proximaOrdem(d.corte || []),
    }, `cargo ${v.nome}`);
    setDefCargo(null);
  };

  /** Extinguir um cargo criado pela Corte. Os seis de fábrica não saem. */
  const extinguirCargo = async (cargo) => {
    await d.remover('corte', cargo.id, `cargo ${cargo.nome}`);
    setRemCargo(null);
    setDefCargo(null);
  };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Palácio do Jarl</h1>
          <p>Cargos da Corte, casas nobres e a administração dos assentamentos do Hold.</p>
        </div>
      </div>
      <div className="regra" />

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Cargos da Corte" valor={`${preenchidos}/${cargos.length}`}
              sub={`${cargos.length - preenchidos} em aberto`} />
        <Stat rotulo="Casas nobres" valor={clas.length} sub="dinastias registradas" tom="roxo" />
        <Stat rotulo="Membros das casas" valor={totalMembros} sub="pessoas vinculadas" tom="laranja" />
        <Stat rotulo="Vilarejos" valor={vilarejos.length} sub={semLorde ? `${semLorde} sem Lorde` : 'todos com Lorde'} tom="verde" />
      </div>

      {/* -------- Cargos -------- */}
      <Painel
        titulo="A Corte"
        acoes={
          <>
            <Selo tom="gold">{preenchidos} nomeados</Selo>
            <button className="btn pq primario"
                    onClick={() => setDefCargo({ ordem: proximaOrdem(d.corte || []) })}>
              <Icone nome="mais" tam={13} /> Novo cargo
            </button>
          </>
        }
      >
        <div className="grade g3">
          {cargos.map((cargo) => {
            const o = porCargo[cargo.id] || {};
            const cla = o.cla_id ? clasPorId[o.cla_id] : null;
            // No cartão vale o título de nobreza de quem ocupa o cargo — é o
            // que diz alguma coisa sobre ele na Corte. A raça está na ficha.
            const titulo = o.nome ? tituloDe({ id: o.civil_id, nome: o.nome }, clas) : '';
            return (
              <article key={cargo.id} className={`cargo-card ${o.nome ? '' : 'vago'}`}>
                <div className="cargo-nome">
                  {cargo.nome}
                  <button className="cargo-def" title="Editar este cargo"
                          onClick={() => setDefCargo({ ...cargo, linha: o })}>
                    <Icone nome="lapis" tam={12} />
                  </button>
                </div>
                <div className={`ocupante ${o.nome ? '' : 'vazio'}`}>{o.nome || 'Cargo vago'}</div>
                <div className="desc">{cargo.descricao}</div>
                <div className="rodape">
                  {titulo && <Selo tom={TITULO_NOBREZA_TOM[titulo]}>{titulo}</Selo>}
                  {cla && <Selo tom="roxo">{cla.nome}</Selo>}
                  {o.desde && <Selo>desde {o.desde}</Selo>}
                  <button
                    className="btn pq fantasma"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setEditCargo({ cargo, dados: { ...o, cargo_id: cargo.id, id: cargo.id } })}
                  >
                    <Icone nome="lapis" tam={13} /> {o.nome ? 'Alterar' : 'Nomear'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Painel>

      {/* -------- Chancelaria da Nobreza -------- */}
      <div style={{ height: 16 }} />
      {erroChancela && (
        <div className="login-erro" style={{ marginBottom: 14 }}>{erroChancela}</div>
      )}
      <PainelChancelaria
        pedidos={d.pedidos_casa || []}
        clas={clas}
        civis={d.civis || []}
        propriedades={d.propriedades || []}
        aoJulgar={julgarChancela}
        aoAbrirCasa={(cla_id) => setVerCla(clas.find((c) => c.id === cla_id) || null)}
      />

      {/* -------- Casas nobres -------- */}
      <div style={{ height: 16 }} />
      <Painel
        titulo="Casas & Dinastias Nobres"
        acoes={
          <button className="btn pq primario" onClick={() => setVerCla({ titulo_lider: 'Patriarca', membros: [] })}>
            <Icone nome="mais" tam={13} /> Nova casa
          </button>
        }
      >
        {clasVivas.length === 0 ? (
          <Vazio simb="⚜">
            Nenhuma casa registrada. Use <strong>Nova casa</strong> para cadastrar as dinastias de Riften,
            seu patriarca e seus membros.
          </Vazio>
        ) : (
          <div className="grade-clas">
            {[...clasVivas].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map((c) => {
              const n = c.membros?.length || 0;
              return (
                <article key={c.id} className="cla-card">
                  <span className="cla-listra" style={{ background: c.cor || '#7c6bb0' }} />
                  <button className="cla-abrir" onClick={() => setVerCla(c)} title={`Abrir ${c.nome}`}>
                    <span className="cla-brasao">
                      {c.brasao
                        ? <img src={c.brasao} alt="" />
                        : <Icone nome="estandarte" tam={30} cor="var(--line-2)" />}
                    </span>
                    <span className="cla-corpo">
                      <span className="cla-nome">{c.nome}</span>
                      <span className="cla-lider">
                        {c.lider
                          ? <>{c.titulo_lider || 'Patriarca'}: <b>{c.lider}</b></>
                          : <i>Sem patriarca definido</i>}
                      </span>
                      <span className="cla-membros">
                        <Icone nome="pessoa" tam={12} /> {n} membro{n === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                  <button
                    className="cla-remover"
                    onClick={() => setRemCla(c)}
                    title={`Dissolver ${c.nome}`}
                    aria-label={`Dissolver ${c.nome}`}
                  >
                    <Icone nome="lixo" tam={14} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </Painel>

      {/* -------- Nobreza -------- */}
      <div style={{ height: 16 }} />
      <PainelNobreza
        clas={clasVivas}
        civis={d.civis || []}
        pedidos={(d.pedidos_dinastia || []).filter((x) => x.status === 'Pendente')}
        aoJulgar={julgarPedido}
        aoAbrirCasa={(cla_id) => setVerCla(clas.find((c) => c.id === cla_id) || null)}
        aoAbrirPerfil={setPerfil}
      />

      {/* -------- Assentamentos -------- */}
      <div style={{ height: 16 }} />
      <Painel
        titulo="Vilarejos & Lordes Nomeados"
        acoes={semLorde > 0 ? <Selo tom="warn" ponto>{semLorde} sem Lorde</Selo> : <Selo tom="ok" ponto>Todos nomeados</Selo>}
      >
        <div className="grade g2">
          {vilarejos.map((a) => {
            const props = (d.propriedades || []).filter((p) => p.local === a.nome);
            const cat = lerCatalogacao(a.catalogacao);
            // Quem detém o vilarejo é a casa do Lorde empossado nele.
            const casa = casaDoVilarejo(a, clas);
            return (
              <button key={a.id} className="vila-card" onClick={() => setVerVila(a)}>
                <span className="vila-topo">
                  <Icone nome="vila" tam={20} cor="var(--gold)" />
                  <span className="vila-nome">{a.nome}</span>
                  <span className="selo">{a.tipo}</span>
                </span>
                <span className="vila-linha">
                  {a.lorde
                    ? <span className="selo gold">Lorde: {a.lorde}</span>
                    : <span className="selo warn"><i className="ponto" />Sem Lorde nomeado</span>}
                  {casa && (
                    <span className="selo roxo">
                      <i className="cor-ponto" style={{ background: casa.cor }} /> Casa {casa.nome}
                    </span>
                  )}
                  {a.lorde && !casa && <span className="selo">Lorde sem casa nobre</span>}
                  <span className="selo">
                    <Icone nome="casa" tam={11} /> {props.length} propriedade{props.length === 1 ? '' : 's'}
                  </span>
                  {cat.length > 0 && <span className="selo gold">{totalItens(cat)} peças no território</span>}
                </span>
                {cat.length > 0 && <Catalogo itens={cat} limite={5} />}
              </button>
            );
          })}
        </div>
      </Painel>

      {/* -------- Crônica -------- */}
      <div style={{ height: 16 }} />
      <Cronica registros={d.registros || []} aoMudar={d.recarregar} />

      {/* -------- Modais -------- */}
      {editCargo && (
        <FormCargo
          cargo={editCargo.cargo}
          inicial={editCargo.dados}
          clas={clas}
          civis={d.civis || []}
          aoFechar={() => setEditCargo(null)}
          aoSalvar={async (v) => { await d.salvar('corte', v, `${editCargo.cargo.nome}: ${v.nome || 'vago'}`); setEditCargo(null); }}
        />
      )}
      {defCargo && (
        <FormDefinicaoCargo
          inicial={defCargo}
          ocupado={Boolean(defCargo.linha?.nome)}
          aoFechar={() => setDefCargo(null)}
          aoSalvar={salvarDefinicao}
          aoExtinguir={defCargo.id && !cargoDeFabrica(defCargo.id)
            // Fecha a ficha do cargo antes de perguntar: dois modais
            // empilhados só confundem quem está decidindo.
            ? () => { setRemCargo(defCargo); setDefCargo(null); }
            : null}
        />
      )}
      {remCargo && (
        <Confirmar
          mensagem={`Extinguir o cargo "${remCargo.nome}"? Ele sai da Corte, junto com a nomeação que houver nele.`}
          aoFechar={() => setRemCargo(null)}
          aoConfirmar={() => extinguirCargo(remCargo)}
        />
      )}
      {verCla && (
        <FichaCla
          inicial={verCla}
          aoFechar={() => setVerCla(null)}
          civis={d.civis || []}
          aoSalvar={async (v) => {
            try {
              // `_k` é chave de tela: não vai para o banco.
              await d.salvar('clas', {
                ...v,
                membros: (v.membros || []).map(({ _k, ...m }) => m),
                servos: (v.servos || []).map(({ _k, ...x }) => x),
              });
              setVerCla(null);
            } catch { /* a mensagem já está no quadro de erro da página */ }
          }}
          aoRemover={(c) => { setVerCla(null); setRemCla(c); }}
        />
      )}
      {remCla && (
        <Confirmar
          mensagem={`Dissolver o registro de ${remCla.nome}? Os membros cadastrados nela vão junto.`}
          aoConfirmar={() => d.remover('clas', remCla.id, remCla.nome)}
          aoFechar={() => setRemCla(null)}
        />
      )}
      {verVila && (
        <FichaVila
          inicial={verVila}
          propriedades={(d.propriedades || []).filter((p) => p.local === verVila.nome)}
          locais={assentamentos.map((a) => a.nome)}
          organizacoes={clas.map((c) => c.nome)}
          civis={d.civis || []}
          clas={clas}
          aoFechar={() => setVerVila(null)}
          aoSalvarVila={async (v) => { await d.salvar('assentamentos', v, v.nome); setVerVila(null); }}
          aoSalvarProp={async (p) => { await d.salvar('propriedades', p); }}
          aoRemoverProp={async (p) => { await d.remover('propriedades', p.id, p.nome); }}
        />
      )}
      {perfil && (
        <FichaCidadao civil={perfil} dados={d} aoFechar={() => setPerfil(null)} />
      )}
    </>
  );
}

/* ============================================================
   Crônica da Corte — o livro de atos.

   Dez por página: a crônica cresce sem parar, e uma lista sem fim
   empurra o resto da tela para longe. Apagar é da Corte: um ato de
   cada vez, ou o livro inteiro de uma vez.
   ============================================================ */
const POR_PAGINA = 10;

function Cronica({ registros, aoMudar }) {
  const [pagina, setPagina] = useState(1);
  const [limpar, setLimpar] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [fAutor, setFAutor] = useState('');
  const [fEntidade, setFEntidade] = useState('');

  const autores = useMemo(
    () => [...new Set(registros.map((r) => r.autor).filter(Boolean))].sort(), [registros],
  );
  const entidades = useMemo(
    () => [...new Set(registros.map((r) => r.entidade).filter(Boolean))].sort(), [registros],
  );

  const ordenados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return [...registros]
      .filter((r) => (!fAutor || r.autor === fAutor) && (!fEntidade || r.entidade === fEntidade))
      .filter((r) => !t || `${r.autor} ${r.acao} ${r.entidade} ${r.alvo}`.toLowerCase().includes(t))
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  }, [registros, busca, fAutor, fEntidade]);
  const paginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  // A página some quando o último ato dela é apagado — voltamos para a anterior.
  const atual = Math.min(pagina, paginas);
  const visiveis = ordenados.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  const apagarUm = async (r) => {
    setErro('');
    try { await apagarRegistro(r.id); await aoMudar(); }
    catch (ex) { setErro(ex.message || 'Não consegui apagar este ato.'); }
  };
  const apagarTudo = async () => {
    setErro('');
    try { await limparRegistros(); await aoMudar(); setPagina(1); }
    catch (ex) { setErro(ex.message || 'Não consegui limpar a crônica.'); }
    setLimpar(false);
  };

  return (
    <Painel
      titulo="Crônica da Corte"
      acoes={
        <>
          <Selo>
            {ordenados.length === registros.length
              ? `${registros.length} atos`
              : `${ordenados.length} de ${registros.length}`}
          </Selo>
          {registros.length > 0 && (
            <button className="btn pq fantasma" onClick={() => setLimpar(true)}>
              <Icone nome="lixo" tam={13} /> Limpar tudo
            </button>
          )}
        </>
      }
    >
      {registros.length > 0 && (
        <div className="barra-filtros" style={{ marginBottom: 12 }}>
          <div className="campo busca">
            <label>Buscar</label>
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                   placeholder="Quem, o quê, sobre quem…" />
          </div>
          <Selecao rotulo="Autor" valor={fAutor}
                   aoMudar={(x) => { setFAutor(x); setPagina(1); }}
                   opcoes={autores} vazioLabel="Todos" />
          <Selecao rotulo="Registro" valor={fEntidade}
                   aoMudar={(x) => { setFEntidade(x); setPagina(1); }}
                   opcoes={entidades} vazioLabel="Todos" />
        </div>
      )}
      {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      {ordenados.length === 0 ? (
        <Vazio simb="✒">
          {registros.length
            ? 'Nenhum ato com esse filtro.'
            : 'Nenhum ato registrado. Toda edição feita no sistema aparece aqui.'}
        </Vazio>
      ) : (
        <>
          <div className="cronica">
            {visiveis.map((r) => (
              <div className="cronica-item" key={r.id}>
                <span className="quando">
                  {new Date(r.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>
                  <span className="quem">{r.autor}</span> {r.acao} em <em>{r.entidade}</em>
                  {r.alvo ? <> — <strong style={{ color: 'var(--txt)' }}>{r.alvo}</strong></> : null}
                </span>
                <button className="cronica-x" title="Apagar este ato" onClick={() => apagarUm(r)}>
                  <Icone nome="lixo" tam={13} />
                </button>
              </div>
            ))}
          </div>

          {paginas > 1 && (
            <div className="paginacao">
              <button className="btn pq fantasma" disabled={atual === 1}
                      onClick={() => setPagina(atual - 1)}>Anterior</button>
              <span className="paginacao-n">
                Página <b>{atual}</b> de {paginas}
              </span>
              <button className="btn pq fantasma" disabled={atual === paginas}
                      onClick={() => setPagina(atual + 1)}>Próxima</button>
            </div>
          )}
        </>
      )}

      {limpar && (
        <Confirmar
          mensagem={`Isto apaga os ${registros.length} atos do livro. O que foi registrado nas fichas continua no lugar — some só o histórico de quem mexeu.`}
          aoFechar={() => setLimpar(false)}
          aoConfirmar={apagarTudo}
        />
      )}
    </Painel>
  );
}

/* ============================================================
   Recusar a indicação de um Patriarca. A recusa tira o pedido da
   lista e deixa um recado no Quadro de Avisos para quem indicou.
   ============================================================ */
function FormRecusaPedido({ pedido, aoFechar, aoConfirmar }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      titulo={`Recusar — ${pedido.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn perigo" onClick={() => aoConfirmar(motivo)}>Recusar o pedido</button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--txt-2)', fontSize: 13, lineHeight: 1.6 }}>
        A pessoa não entra na Casa {pedido.cla_nome} e não vira nobre. O pedido sai desta
        lista, e <strong>{pedido.pedido_por}</strong> recebe o recado no Quadro de Avisos,
        com o motivo que você escrever aqui.
      </p>
      <AreaTexto rotulo="Motivo (quem indicou vai ler)" valor={motivo} aoMudar={setMotivo}
                 placeholder="Linhagem não comprovada, casa já numerosa, pendência com a Corte…" />
    </Modal>
  );
}

/* ============================================================
   NOBREZA DE RIFTEN

   A lista sai das casas: quem está numa dinastia está aqui. O título
   de liderança fica no quadro da casa; o que se edita aqui é o título
   pessoal — Nobre, Lorde, Lady ou Thane.
   ============================================================ */
/* ============================================================
   CHANCELARIA DA NOBREZA
   Onde a Corte lavra — ou nega — cada passo da nobreza. Toda linha
   aqui tem uma taxa, e nada acontece no Hold sem passar por ela.
   ============================================================ */
function PainelChancelaria({ pedidos = [], clas = [], civis = [], propriedades = [], aoJulgar, aoAbrirCasa }) {
  const [fTipo, setFTipo] = useState('');
  const [julgando, setJulgando] = useState(null);   // { pedido, deferir }
  const [ocupado, setOcupado] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);

  const naMesa = useMemo(
    () => pedidos
      .filter((x) => x.status === 'Pendente')
      .filter((x) => !fTipo || x.tipo === fTipo)
      .sort((a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0)),
    [pedidos, fTipo],
  );
  const esperandoCasa = useMemo(
    () => pedidos.filter((x) => x.status === 'Aguardando casa'), [pedidos],
  );
  const julgados = useMemo(
    () => pedidos
      .filter((x) => x.status === 'Deferido' || x.status === 'Indeferido')
      .sort((a, b) => new Date(b.avaliado_em || 0) - new Date(a.avaliado_em || 0))
      .slice(0, 12),
    [pedidos],
  );
  const aliancas = useMemo(() => todasAsAliancas(pedidos, clas), [pedidos, clas]);
  const arrecadacao = naMesa.reduce((s, x) => s + Number(x.custo || 0), 0);

  const decidir = async (parecer) => {
    if (!julgando || ocupado) return;
    setOcupado(true);
    try {
      await aoJulgar(julgando.pedido, julgando.deferir, parecer);
      setJulgando(null);
    } finally {
      setOcupado(false);
    }
  };

  const contagem = (tipo) => pedidos.filter((x) => x.status === 'Pendente' && x.tipo === tipo).length;

  return (
    <Painel
      titulo="Chancelaria da Nobreza"
      acoes={
        <>
          {naMesa.length
            ? <Selo tom="warn" ponto>{naMesa.length} a julgar</Selo>
            : <Selo tom="ok" ponto>Nada na mesa</Selo>}
          {arrecadacao > 0 && <Selo tom="gold">{septims(arrecadacao)} em taxas</Selo>}
        </>
      }
    >
      <p className="painel-nota">
        Cada passo da nobreza passa por aqui, e cada um tem a sua taxa: título de nobreza{' '}
        {septims(PEDIDO_CASA_POR_ID.nobreza.custo)} · insígnia {septims(PEDIDO_CASA_POR_ID.insignia.custo)} ·
        herdeiro {septims(PEDIDO_CASA_POR_ID.herdeiro.custo)} · mesnada {septims(PEDIDO_CASA_POR_ID.mesnada.custo)} ·
        aliança {septims(PEDIDO_CASA_POR_ID.alianca.custo)} · sede {septims(PEDIDO_CASA_POR_ID.sede.custo)}.
        A fundação da casa não tem taxa — o que ela pede é o reconhecimento.
      </p>

      <div className="barra-filtros compacta">
        <Selecao
          rotulo="Ato" valor={fTipo} aoMudar={setFTipo} vazioLabel={`Todos (${naMesa.length})`}
          opcoes={TIPOS_PEDIDO_CASA
            .filter((t) => contagem(t.id) > 0)
            .map((t) => ({ valor: t.id, rotulo: `${t.curto} (${contagem(t.id)})` }))}
        />
        {julgados.length > 0 && (
          <div className="gaveta-bts">
            <button className="btn pq fantasma" onClick={() => setVerHistorico((x) => !x)}>
              {verHistorico ? 'Ocultar julgados' : `Ver últimos julgados (${julgados.length})`}
            </button>
          </div>
        )}
      </div>

      {naMesa.length === 0 ? (
        <Vazio simb="⚖">
          Nenhum ato aguardando a Corte. Os pedidos chegam das fichas dos moradores e das
          telas de Dinastia.
        </Vazio>
      ) : (
        <div className="grade g2">
          {naMesa.map((x) => {
            const modelo = PEDIDO_CASA_POR_ID[x.tipo];
            const casa = clas.find((c) => c.id === x.cla_id) || null;
            const pedinte = civis.find((c) => c.id === x.civil_id) || null;
            return (
              <article className="pedido-casa" key={x.id}>
                <header>
                  <span className="pedido-icone" style={{ borderColor: casa?.cor || 'var(--gold-dim)' }}>
                    <Icone nome={modelo?.icone || 'pergaminho'} tam={17} cor="var(--gold)" />
                  </span>
                  <div className="pedido-titulo">
                    <h4>{modelo?.nome || x.tipo}</h4>
                    <small>
                      {x.cla_nome ? `Casa ${x.cla_nome}` : 'Morador do Hold'} ·{' '}
                      {x.pedido_por || '—'}
                      {pedinte?.id_jogo ? ` · ID ${pedinte.id_jogo}` : ''}
                    </small>
                  </div>
                  <Selo tom="gold" className="pedido-taxa">{septims(x.custo)}</Selo>
                </header>

                <p className="pedido-resumo">{resumoDoPedido(x, clas)}</p>

                {x.tipo === 'insignia' && (
                  <div className="insignia-troca">
                    <span className="brasao-mini" style={{ borderColor: casa?.cor }}>
                      {casa?.brasao
                        ? <img src={casa.brasao} alt="" />
                        : <Icone nome="estandarte" tam={18} cor="var(--line-2)" />}
                    </span>
                    <span className="seta">→</span>
                    <span className="brasao-mini" style={{ borderColor: x.dados?.cor }}>
                      {x.dados?.brasao
                        ? <img src={x.dados.brasao} alt="" />
                        : <Icone nome="estandarte" tam={18} cor="var(--line-2)" />}
                    </span>
                    <span className="insignia-lemas">
                      <small>{casa?.lema ? `“${casa.lema}”` : 'sem lema'}</small>
                      <strong>{x.dados?.lema ? `“${x.dados.lema}”` : 'sem lema'}</strong>
                    </span>
                  </div>
                )}

                {x.tipo === 'fundacao' && casa && (
                  <div className="fundacao-previa">
                    <span className="casa-brasao" style={{ borderColor: casa.cor }}>
                      {casa.brasao
                        ? <img src={casa.brasao} alt="" />
                        : <Icone nome="estandarte" tam={22} cor={casa.cor} />}
                    </span>
                    <div>
                      <strong>Casa {casa.nome}</strong>
                      {casa.lema && <em>“{casa.lema}”</em>}
                      <div className="chip-lista" style={{ marginTop: 5 }}>
                        <Selo tom="gold">{casa.titulo_lider}: {casa.lider}</Selo>
                        {sedeDe(casa, propriedades) && (
                          <Selo tom="roxo">Sede: {sedeDe(casa, propriedades).nome}</Selo>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {x.tipo === 'alianca' && (
                  <p className="pedido-aceite">
                    <Icone nome="selo" tam={13} cor="var(--ok)" /> A Casa {x.alvo_cla_nome} já
                    aceitou{x.respondido_por ? ` — ${x.respondido_por}` : ''}.
                  </p>
                )}

                {x.motivo && <p className="pedido-motivo">“{x.motivo}”</p>}

                <footer>
                  <span className="pedido-data">{data(x.criado_em)}</span>
                  {casa && (
                    <button className="btn pq fantasma" onClick={() => aoAbrirCasa(casa.id)}>
                      Abrir a casa
                    </button>
                  )}
                  <button className="btn pq perigo" onClick={() => setJulgando({ pedido: x, deferir: false })}>
                    Indeferir
                  </button>
                  <button className="btn pq primario" onClick={() => setJulgando({ pedido: x, deferir: true })}>
                    Deferir
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {esperandoCasa.length > 0 && (
        <div className="servos-bloco">
          <h4>Propostas entre casas, ainda sem resposta</h4>
          <div className="estoque-lista colunas">
            {esperandoCasa.map((x) => (
              <div className="linha-nobre" key={x.id}>
                <Icone nome="selo" tam={14} cor="var(--purple)" />
                <span className="ln-nome">Casa {x.cla_nome} ⟶ Casa {x.alvo_cla_nome}</span>
                <Selo tom="roxo">Aguardando a casa convidada</Selo>
                <span className="ln-fim">{data(x.criado_em)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {aliancas.length > 0 && (
        <div className="servos-bloco">
          <h4>Alianças em vigor</h4>
          <div className="estoque-lista colunas">
            {aliancas.map((a) => (
              <div className="linha-nobre" key={a.id}>
                <Icone nome="selo" tam={14} cor="var(--ok)" />
                <span className="ln-nome">Casa {a.casas[0]} ⟷ Casa {a.casas[1]}</span>
                <span className="ln-fim">desde {data(a.desde)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {verHistorico && julgados.length > 0 && (
        <div className="tabela-wrap" style={{ marginTop: 14 }}>
          <table style={{ minWidth: 720 }}>
            <thead>
              <tr><th>Ato</th><th>Casa / morador</th><th>Taxa</th><th>Julgado</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {julgados.map((x) => (
                <tr key={x.id}>
                  <td className="nome-forte">{PEDIDO_CASA_POR_ID[x.tipo]?.nome || x.tipo}</td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                    {x.cla_nome ? `Casa ${x.cla_nome}` : x.pedido_por}
                  </td>
                  <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(x.custo)}</td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{data(x.avaliado_em)}</td>
                  <td>
                    <Selo tom={STATUS_PEDIDO_CASA_TOM[x.status]} ponto>{x.status}</Selo>
                    {x.parecer && (
                      <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>{x.parecer}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {julgando && (
        <FormJulgarChancela
          pedido={julgando.pedido}
          deferir={julgando.deferir}
          ocupado={ocupado}
          aoFechar={() => setJulgando(null)}
          aoConfirmar={decidir}
        />
      )}
    </Painel>
  );
}

function FormJulgarChancela({ pedido, deferir, ocupado, aoFechar, aoConfirmar }) {
  const [parecer, setParecer] = useState('');
  const modelo = PEDIDO_CASA_POR_ID[pedido.tipo];
  return (
    <Modal
      titulo={`${deferir ? 'Deferir' : 'Indeferir'} — ${modelo?.nome || pedido.tipo}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span className="taxa-rodape">
            Taxa: <strong>{septims(pedido.custo)}</strong>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className={`btn ${deferir ? 'primario' : 'perigo'}`} disabled={ocupado}
                  onClick={() => aoConfirmar(parecer)}>
            {ocupado ? 'Registrando…' : deferir ? 'Deferir o pedido' : 'Indeferir o pedido'}
          </button>
        </>
      }
    >
      <p className="painel-nota">
        {pedido.cla_nome ? <>Casa <strong>{pedido.cla_nome}</strong> · </> : null}
        Pedido de <strong>{pedido.pedido_por}</strong>.{' '}
        {deferir
          ? 'Ao deferir, o ato passa a valer na hora e o pedinte é avisado no Quadro de Avisos.'
          : 'O pedinte é avisado no Quadro de Avisos, com o motivo que você escrever.'}
      </p>
      {pedido.motivo && <p className="perfil-nota-corte">“{pedido.motivo}”</p>}
      <AreaTexto
        rotulo={deferir ? 'Parecer da Corte (opcional)' : 'Motivo (quem pediu vai ler)'}
        valor={parecer}
        aoMudar={setParecer}
        placeholder={deferir
          ? 'Condições, prazos, o que a Corte espera da casa…'
          : 'O que falta para a Corte deferir.'}
        maxLength={400}
      />
    </Modal>
  );
}

function PainelNobreza({ clas, civis, pedidos = [], aoJulgar, aoAbrirCasa, aoAbrirPerfil }) {
  const [busca, setBusca] = useState('');
  const [fTitulo, setFTitulo] = useState('');
  const [fCasa, setFCasa] = useState('');
  const [recusar, setRecusar] = useState(null);

  const todos = useMemo(() => listaNobreza(clas), [clas]);
  const servos = useMemo(() => listaServos(clas), [clas]);
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return todos.filter((n) =>
      (!t || `${n.nome} ${n.casa} ${n.id_jogo}`.toLowerCase().includes(t)) &&
      (!fTitulo || n.titulo === fTitulo) &&
      (!fCasa || n.cla_id === fCasa));
  }, [todos, busca, fTitulo, fCasa]);

  // A contagem do seletor acompanha o filtro de casa e a busca: dizer
  // "Nobre (12)" com 3 linhas na tela é mentira útil para ninguém.
  const noRecorte = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return todos.filter((n) =>
      (!t || `${n.nome} ${n.casa} ${n.id_jogo}`.toLowerCase().includes(t)) &&
      (!fCasa || n.cla_id === fCasa));
  }, [todos, busca, fCasa]);
  const porTitulo = (t) => noRecorte.filter((n) => n.titulo === t).length;
  const civilDe = (linha) => (linha.civil_id
    ? civis.find((c) => c.id === linha.civil_id)
    : civis.find((c) => c.nome?.trim().toLowerCase() === linha.nome.trim().toLowerCase())) || null;

  // As indicações dos Patriarcas entram como linhas pendentes, no topo da
  // lista: quem julga é a Corte, e é aqui que ela julga.
  // Pendentes e servos obedecem à mesma busca e ao mesmo filtro de casa.
  const aguardando = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pedidos.filter((x) =>
      (!fCasa || x.cla_id === fCasa) &&
      (!t || `${x.nome} ${x.cla_nome} ${x.pedido_por}`.toLowerCase().includes(t)));
  }, [pedidos, busca, fCasa]);
  const servosVisiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return servos.filter((x) =>
      (!fCasa || x.cla_id === fCasa) &&
      (!t || `${x.nome} ${x.casa} ${x.funcao}`.toLowerCase().includes(t)));
  }, [servos, busca, fCasa]);
  const corDaCasa = (cla_id) => clas.find((c) => c.id === cla_id)?.cor || '#7c6bb0';
  // Vazio de verdade é não haver nada cadastrado — não "o filtro não achou".
  const vazio = todos.length === 0 && pedidos.length === 0;

  return (
    <Painel
      titulo="Nobreza de Riften"
      acoes={
        <>
          {aguardando.length > 0 && (
            <Selo tom="warn" ponto>{aguardando.length} aguardando aval</Selo>
          )}
          <Selo tom="roxo">{todos.length} {todos.length === 1 ? 'nobre' : 'nobres'}</Selo>
        </>
      }
    >
      <p className="painel-nota">
        Toda pessoa vinculada a uma casa entra nesta lista. As indicações que os Patriarcas
        mandam da Cidade de Riften chegam aqui em cima como <strong>pendentes</strong>: aprovar
        faz a pessoa entrar na casa como Nobre; recusar tira o pedido da lista e avisa quem
        indicou pelo Quadro de Avisos. O título de cada nobre é editado na ficha da casa, em
        <strong> Casas &amp; Dinastias Nobres</strong>. Quem não pertence a casa nenhuma é
        Plebeu e não aparece aqui.
      </p>

      {vazio ? (
        <Vazio simb="⚜">
          Ninguém na Nobreza ainda. Registre uma casa e adicione o Patriarca ou Matriarca e
          seus membros — eles aparecem aqui automaticamente.
        </Vazio>
      ) : (
        <>
          <div className="barra-filtros compacta">
            <div className="campo busca">
              <label>Buscar</label>
              <input value={busca} onChange={(e) => setBusca(e.target.value)}
                     placeholder="Nome ou família…" />
            </div>
            <Selecao rotulo="Título" valor={fTitulo} aoMudar={setFTitulo} vazioLabel="Todos"
                     opcoes={TITULOS_NOBREZA.map((t) => ({ valor: t, rotulo: `${t} (${porTitulo(t)})` }))} />
            <Selecao rotulo="Família" valor={fCasa} aoMudar={setFCasa} vazioLabel="Todas"
                     opcoes={[...clas].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                       .map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          </div>

          {lista.length === 0 && aguardando.length === 0 ? (
            <Vazio simb="⚜">Nenhum nobre corresponde ao filtro.</Vazio>
          ) : (
            <div className="tabela-wrap">
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr><th>Nome</th><th>Família</th><th>Título</th><th className="col-acoes"></th></tr>
                </thead>
                <tbody>
                  {aguardando.map((x) => (
                    <tr key={x.id} className="linha-pendente">
                      <td>
                        <span className="nome-forte">{x.nome}</span>
                        <div className="chip-lista" style={{ marginTop: 4 }}>
                          <Selo tom="warn" ponto>Aguardando aval</Selo>
                          <Selo>indicado por {x.pedido_por}</Selo>
                          {x.parentesco && <Selo>{x.parentesco}</Selo>}
                        </div>
                        {x.justificativa && (
                          <div className="pendente-nota">“{x.justificativa}”</div>
                        )}
                      </td>
                      <td>
                        <button className="casa-link" onClick={() => aoAbrirCasa(x.cla_id)}>
                          <i className="cor-ponto" style={{ background: corDaCasa(x.cla_id) }} />
                          {x.cla_nome}
                        </button>
                      </td>
                      <td><Selo tom="off">Nobre, se aprovado</Selo></td>
                      <td className="col-acoes">
                        <button className="btn pq primario" onClick={() => aoJulgar(x, 'Aprovado')}>
                          Aprovar
                        </button>{' '}
                        <button className="btn pq perigo" onClick={() => setRecusar(x)}>
                          Recusar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lista.map((n) => {
                    const civil = civilDe(n);
                    return (
                      <tr key={n.chave}>
                        <td>
                          {civil
                            ? <button className="nome-forte link-perfil" onClick={() => aoAbrirPerfil(civil)}
                                      title="Abrir perfil completo">{n.nome}</button>
                            : <span className="nome-forte">{n.nome}</span>}
                          <div className="chip-lista" style={{ marginTop: 4 }}>
                            <Selo tom={n.lideranca ? 'gold' : ''}>
                              {n.lideranca ? `${n.lideranca} da Dinastia` : 'Membro da Dinastia'}
                            </Selo>
                          </div>
                        </td>
                        <td>
                          <button className="casa-link" onClick={() => aoAbrirCasa(n.cla_id)}>
                            <i className="cor-ponto" style={{ background: n.cor }} />
                            {n.casa}
                          </button>
                        </td>
                        <td><Selo tom={TITULO_NOBREZA_TOM[n.titulo]}>{n.titulo}</Selo></td>
                        <td className="col-acoes">
                          <button className="btn pq fantasma" onClick={() => aoAbrirCasa(n.cla_id)}
                                  title={`Editar o título na ficha da Casa ${n.casa}`}>
                            <Icone nome="lapis" tam={13} /> Na casa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {recusar && (
        <FormRecusaPedido
          pedido={recusar}
          aoFechar={() => setRecusar(null)}
          aoConfirmar={async (motivo) => { await aoJulgar(recusar, 'Recusado', motivo); setRecusar(null); }}
        />
      )}

      {servos.length > 0 && (
        <div className="servos-bloco">
          <h4>
            <Icone nome="martelo" tam={14} cor="var(--txt-3)" /> Servos das casas
            <span className="selo off">
              {servosVisiveis.length === servos.length
                ? servos.length
                : `${servosVisiveis.length} de ${servos.length}`}
            </span>
          </h4>
          <p className="painel-nota" style={{ marginBottom: 8 }}>
            Estes <strong>não são nobres</strong> — servem a uma casa e continuam Plebeus.
            Ficam aqui só para a Corte saber quem serve a quem.
          </p>
          <div className="estoque-lista colunas">
            {servosVisiveis.map((x) => (
              <div className="linha-nobre" key={x.chave}>
                <i className="cor-ponto" style={{ background: x.cor }} />
                <span className="ln-nome">{x.nome}</span>
                <Selo>{x.funcao || 'Sem função descrita'}</Selo>
                <Selo tom="off">Casa {x.casa}</Selo>
              </div>
            ))}
            {servosVisiveis.length === 0 && (
              <p className="painel-nota" style={{ margin: 0 }}>Nenhum servo com esse filtro.</p>
            )}
          </div>
        </div>
      )}
    </Painel>
  );
}

/* ============================================================ */
/* ============================================================
   O cargo em si — nome, descrição e a ordem em que aparece.
   Os seis de fábrica podem ser renomeados e reescritos, mas não
   extintos: eles se reconstroem a partir da lista do sistema.
   ============================================================ */
function FormDefinicaoCargo({ inicial, ocupado, aoFechar, aoSalvar, aoExtinguir }) {
  const novo = !inicial.id;
  const [v, setV] = useState({
    id: inicial.id || '',
    nome: inicial.nome || '',
    descricao: inicial.descricao || '',
    ordem: inicial.ordem || 1,
  });
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Modal
      titulo={novo ? 'Novo cargo da Corte' : `Editar o cargo — ${inicial.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          {aoExtinguir && (
            <button className="btn perigo" style={{ marginRight: 'auto' }} onClick={aoExtinguir}>
              Extinguir cargo
            </button>
          )}
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!String(v.nome || '').trim()} onClick={() => aoSalvar(v)}>
            {novo ? 'Criar cargo' : 'Salvar cargo'}
          </button>
        </>
      }
    >
      <div className="grade g2">
        <Texto rotulo="Nome do cargo" valor={v.nome} aoMudar={set('nome')}
               placeholder="Ex.: Mestre dos Sussurros" />
        <Texto rotulo="Ordem no quadro" valor={v.ordem} aoMudar={set('ordem')}
               type="number" min="1" />
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="O que o cargo responde" valor={v.descricao} aoMudar={set('descricao')}
                 placeholder="Uma linha dizendo do que esta pessoa cuida no Hold." />
      <p className="ajuda">
        <Icone nome="livro" tam={13} /> Aqui se define o cargo. Quem o ocupa é decidido
        no botão <strong>Nomear</strong> do quadro.
        {!novo && !aoExtinguir && ' Este é um dos cargos do sistema: pode ser renomeado, mas não extinto.'}
        {ocupado && aoExtinguir && ' Este cargo está ocupado — extingui-lo desfaz a nomeação.'}
      </p>
    </Modal>
  );
}

function FormCargo({ cargo, inicial, clas, civis = [], aoFechar, aoSalvar }) {
  const [v, setV] = useState({
    id: cargo.id, cargo_id: cargo.id,
    nome: inicial.nome || '', raca: inicial.raca || '', civil_id: inicial.civil_id || '',
    id_jogo: inicial.id_jogo || '',
    cla_id: inicial.cla_id || '', desde: inicial.desde || '', notas: inicial.notas || '',
  });
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const vinculado = v.civil_id ? civis.find((c) => c.id === v.civil_id) : null;

  return (
    <Modal
      titulo={`Nomear — ${cargo.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" onClick={() => aoSalvar({ ...v, cla_id: v.cla_id || null })}>Confirmar nomeação</button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--txt-3)', fontSize: 12.5 }}>{cargo.descricao}</p>
      <SeletorCivil
        rotulo="Nomeado"
        valor={v.nome}
        aoMudar={(n) => setV((s) => ({ ...s, nome: n, civil_id: '', id_jogo: '' }))}
        aoEscolher={(c) => setV((s) => ({ ...s, nome: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '', raca: c.raca || s.raca }))}
        civis={civis}
        vinculado={vinculado}
        aoDesvincular={() => setV((s) => ({ ...s, civil_id: '', id_jogo: '' }))}
        placeholder="Busque no Registro Civil, ou deixe vazio para cargo vago"
      />
      <div style={{ height: 12 }} />
      <div className="grade g2">
        <Selecao rotulo="Raça" valor={v.raca} aoMudar={set('raca')} opcoes={RACAS} />
        <Selecao
          rotulo="Casa nobre"
          valor={v.cla_id}
          aoMudar={set('cla_id')}
          opcoes={clas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          vazioLabel="Sem vínculo"
        />
        <Texto rotulo="Nomeado desde" valor={v.desde} aoMudar={set('desde')} placeholder="4E 201" />
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Observações da Corte" valor={v.notas} aoMudar={set('notas')} />
    </Modal>
  );
}

/* ============================================================ */
function FichaCla({ inicial, civis = [], aoFechar, aoSalvar, aoRemover }) {
  const [v, setV] = useState({
    id: inicial.id, nome: inicial.nome || '', lider: inicial.lider || '',
    titulo_lider: TITULOS_LIDER.includes(inicial.titulo_lider) ? inicial.titulo_lider : 'Patriarca',
    lider_civil_id: inicial.lider_civil_id || '',
    lider_id_jogo: inicial.lider_id_jogo || '',
    lider_raca: inicial.lider_raca || '',
    lider_titulo: TITULOS_NOBREZA.includes(inicial.lider_titulo) ? inicial.lider_titulo : 'Nobre',
    cor: inicial.cor || '#7c6bb0',
    brasao: inicial.brasao || null, notas: inicial.notas || '',
    membros: Array.isArray(inicial.membros)
      ? inicial.membros.map((m) => ({
        ...m,
        _k: m._k || chaveNova(),
        titulo: TITULOS_NOBREZA.includes(m.titulo) ? m.titulo : 'Nobre',
      }))
      : [],
    servos: Array.isArray(inicial.servos)
      ? inicial.servos.map((x) => ({ ...x, _k: x._k || chaveNova() }))
      : [],
  });
  const [erroImg, setErroImg] = useState('');
  const [avisoImg, setAvisoImg] = useState('');
  const entrada = useRef(null);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  async function subirBrasao(e) {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setErroImg(''); setAvisoImg('');
    try {
      const { dataUrl, temFundo } = await prepararBrasao(arq);
      set('brasao')(dataUrl);
      if (temFundo) {
        setAvisoImg('Esse desenho parece ter fundo. O quadro fica melhor com o brasão recortado, em PNG transparente.');
      }
    } catch (ex) { setErroImg(ex.message); }
  }

  // Todo mundo entra na casa como Nobre; elevar é ato da Corte.
  const addMembro = () =>
    setV((s) => ({ ...s, membros: [...s.membros, { nome: '', titulo: 'Nobre', raca: '', notas: '', _k: chaveNova() }] }));
  const setMembro = (i, campo, val) =>
    setV((s) => ({
      ...s,
      membros: s.membros.map((m, j) => (j === i ? { ...m, [campo]: val } : m)),
    }));
  /** Escolher alguém do Registro Civil traz raça e ID do jogo junto. */
  const ligarMembro = (i, civil) =>
    setV((s) => ({
      ...s,
      membros: s.membros.map((m, j) => (j === i
        ? { ...m, nome: civil.nome, civil_id: civil.id, id_jogo: civil.id_jogo || '', raca: civil.raca || m.raca }
        : m)),
    }));
  const desligarMembro = (i) =>
    setV((s) => ({ ...s, membros: s.membros.map((m, j) => (j === i ? { ...m, civil_id: '', id_jogo: '' } : m)) }));
  const delMembro = (i) =>
    setV((s) => ({ ...s, membros: s.membros.filter((_, j) => j !== i) }));

  const liderVinculado = v.lider_civil_id ? civis.find((c) => c.id === v.lider_civil_id) : null;

  // Servos: quem serve a casa sem pertencer à linhagem. Não são nobres.
  const addServo = () =>
    setV((s) => ({ ...s, servos: [...s.servos, { nome: '', civil_id: '', id_jogo: '', raca: '', funcao: '', notas: '', _k: chaveNova() }] }));
  const setServo = (i, campo, val) =>
    setV((s) => ({ ...s, servos: s.servos.map((x, j) => (j === i ? { ...x, [campo]: val } : x)) }));
  const ligarServo = (i, civil) =>
    setV((s) => ({
      ...s,
      servos: s.servos.map((x, j) => (j === i
        ? { ...x, nome: civil.nome, civil_id: civil.id, id_jogo: civil.id_jogo || '', raca: civil.raca || x.raca }
        : x)),
    }));
  const delServo = (i) => setV((s) => ({ ...s, servos: s.servos.filter((_, j) => j !== i) }));

  return (
    <Modal
      titulo={inicial.id ? v.nome || 'Casa nobre' : 'Registrar nova casa'}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          {inicial.id && (
            <button className="btn perigo" style={{ marginRight: 'auto' }} onClick={() => aoRemover(inicial)}>
              Dissolver casa
            </button>
          )}
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!String(v.nome || '').trim()} onClick={() => aoSalvar(v)}>Salvar</button>
        </>
      }
    >
      <div className="cla-editor">
        <div className="cla-brasao-edit">
          <div className="brasao-quadro" style={{ borderColor: v.cor }}>
            {v.brasao
              ? <img src={v.brasao} alt="Brasão da casa" />
              : <Icone nome="estandarte" tam={44} cor="var(--line-2)" />}
          </div>
          <input ref={entrada} type="file" accept="image/png,image/webp,image/svg+xml"
                 onChange={subirBrasao} style={{ display: 'none' }} />
          <button className="btn pq" onClick={() => entrada.current?.click()}>
            {v.brasao ? 'Trocar brasão' : 'Enviar brasão'}
          </button>
          {v.brasao && (
            <button className="btn pq fantasma" onClick={() => { set('brasao')(null); setAvisoImg(''); }}>Remover</button>
          )}
          <p className="brasao-regra">
            PNG ou WEBP <b>sem fundo</b>, até {MAX_ARQUIVO_MB} MB.
            O desenho é ajustado sozinho para {LADO_BRASAO}×{LADO_BRASAO} px.
          </p>
          {avisoImg && <p className="brasao-alerta">{avisoImg}</p>}
          {erroImg && <p style={{ color: 'var(--danger)', fontSize: 11.5, margin: 0 }}>{erroImg}</p>}
        </div>

        <div className="cla-campos">
          <div className="grade g2">
            <Texto rotulo="Nome da casa" valor={v.nome} aoMudar={set('nome')} placeholder="Clã ..." />
            <Campo rotulo="Cor do estandarte">
              <input type="color" value={v.cor} onChange={(e) => set('cor')(e.target.value)} style={{ height: 38, padding: 3 }} />
            </Campo>
          </div>
          <div style={{ height: 12 }} />
          <SeletorCivil
            rotulo="Chefe da casa"
            valor={v.lider}
            aoMudar={(n) => setV((s) => ({ ...s, lider: n, lider_civil_id: '', lider_id_jogo: '', lider_raca: '' }))}
            aoEscolher={(c) => setV((s) => ({
              ...s, lider: c.nome, lider_civil_id: c.id,
              lider_id_jogo: c.id_jogo || '', lider_raca: c.raca || s.lider_raca,
            }))}
            civis={civis}
            vinculado={liderVinculado}
            aoDesvincular={() => setV((s) => ({ ...s, lider_civil_id: '', lider_id_jogo: '' }))}
            placeholder="Busque no Registro Civil pelo nome ou pelo ID do jogo…"
          />
          <div style={{ height: 12 }} />
          <div className="grade g2">
            <Selecao rotulo="Liderança" valor={v.titulo_lider} aoMudar={set('titulo_lider')}
                     opcoes={TITULOS_LIDER} vazioLabel="—" />
            <Selecao rotulo="Título na Nobreza" valor={v.lider_titulo} aoMudar={set('lider_titulo')}
                     opcoes={TITULOS_NOBREZA} vazioLabel="—" />
          </div>
          <p className="ajuda">
            Chefe de casa é <strong>Patriarca</strong> ou <strong>Matriarca</strong>, e nada além disso.
            Na Nobreza de Riften ele conta com o título pessoal ao lado — Nobre, salvo se a Corte
            o elevar.
          </p>
          <div style={{ height: 12 }} />
          <AreaTexto rotulo="Notas" valor={v.notas} aoMudar={set('notas')} />
        </div>
      </div>

      <div style={{ height: 20 }} />
      <div className="editor-cat-h">
        <label>Membros da dinastia</label>
        <span className="selo">{v.membros.length}</span>
        <button className="btn pq primario" onClick={addMembro}>+ Adicionar membro</button>
      </div>

      {v.membros.length === 0 ? (
        <p className="cat-vazio">
          Nenhum membro cadastrado nesta casa. Quem entrar aqui passa a constar na
          Nobreza de Riften.
        </p>
      ) : (
        <ul className="lista-membros">
          {v.membros.map((m, i) => (
            <li key={m._k || i}>
              <SeletorCivil
                compacto
                valor={m.nome}
                aoMudar={(n) => setV((s) => ({
                  ...s,
                  membros: s.membros.map((x, j) => (j === i ? { ...x, nome: n, civil_id: '', id_jogo: '' } : x)),
                }))}
                aoEscolher={(c) => ligarMembro(i, c)}
                civis={civis}
                vinculado={m.civil_id ? civis.find((c) => c.id === m.civil_id) : null}
                aoDesvincular={() => desligarMembro(i)}
                placeholder="Nome — busca no Registro Civil"
              />
              <select value={m.titulo || 'Nobre'} onChange={(e) => setMembro(i, 'titulo', e.target.value)}
                      title="Título na Nobreza de Riften">
                {TITULOS_NOBREZA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={m.raca || ''} onChange={(e) => setMembro(i, 'raca', e.target.value)}>
                <option value="">Raça</option>
                {RACAS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={m.notas || ''} onChange={(e) => setMembro(i, 'notas', e.target.value)} placeholder="Observação" />
              <button className="btn pq perigo" onClick={() => delMembro(i)} aria-label="Remover membro">×</button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ height: 20 }} />
      <div className="editor-cat-h">
        <label>Servos da casa</label>
        <span className="selo">{v.servos.length}</span>
        <button className="btn pq" onClick={addServo}>+ Registrar servo</button>
      </div>
      <p className="cat-ajuda">
        Servo serve à casa sem pertencer à linhagem. <strong>Não é nobre</strong>: fica de
        fora da Nobreza de Riften e consta como Plebeu. O Patriarca também registra os seus
        pela Cidade de Riften.
      </p>

      {v.servos.length === 0 ? (
        <p className="cat-vazio">Nenhum servo registrado nesta casa.</p>
      ) : (
        <ul className="lista-membros">
          {v.servos.map((x, i) => (
            <li key={x._k || i}>
              <SeletorCivil
                compacto
                valor={x.nome}
                aoMudar={(n) => setV((s) => ({
                  ...s, servos: s.servos.map((y, j) => (j === i ? { ...y, nome: n, civil_id: '', id_jogo: '' } : y)),
                }))}
                aoEscolher={(c) => ligarServo(i, c)}
                civis={civis}
                vinculado={x.civil_id ? civis.find((c) => c.id === x.civil_id) : null}
                aoDesvincular={() => setServo(i, 'civil_id', '')}
                placeholder="Nome — busca no Registro Civil"
              />
              <input value={x.funcao || ''} onChange={(e) => setServo(i, 'funcao', e.target.value)}
                     placeholder="Função — Guarda, Mordomo, Emissário…" className="servo-funcao" />
              <select value={x.raca || ''} onChange={(e) => setServo(i, 'raca', e.target.value)}>
                <option value="">Raça</option>
                {RACAS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={x.notas || ''} onChange={(e) => setServo(i, 'notas', e.target.value)} placeholder="Observação" />
              <span className="selo off">Plebeu</span>
              <button className="btn pq perigo" onClick={() => delServo(i)} aria-label="Dispensar servo">×</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ============================================================ */
function FichaVila({
  inicial, propriedades, locais, organizacoes, civis = [], clas = [],
  aoFechar, aoSalvarVila, aoSalvarProp, aoRemoverProp,
}) {
  const [v, setV] = useState({
    ...inicial,
    catalogacao: lerCatalogacao(inicial.catalogacao),
    lorde: inicial.lorde || '',
    lorde_civil_id: inicial.lorde_civil_id || '',
    lorde_id_jogo: inicial.lorde_id_jogo || '',
    lorde_raca: inicial.lorde_raca || '',
    descricao: inicial.descricao || '',
  });
  const [prop, setProp] = useState(null);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const lordeVinculado = v.lorde_civil_id ? civis.find((c) => c.id === v.lorde_civil_id) : null;
  const casa = casaDoVilarejo(v, clas);

  return (
    <>
      <Modal
        titulo={`${inicial.nome} — administração`}
        largo
        aoFechar={aoFechar}
        rodape={
          <>
            <button className="btn fantasma" onClick={aoFechar}>Fechar</button>
            <button className="btn primario" onClick={() => aoSalvarVila(v)}>Salvar assentamento</button>
          </>
        }
      >
        <SeletorCivil
          rotulo="Lorde nomeado"
          valor={v.lorde}
          aoMudar={(n) => setV((s) => ({ ...s, lorde: n, lorde_civil_id: '', lorde_id_jogo: '' }))}
          aoEscolher={(c) => setV((s) => ({
            ...s, lorde: c.nome, lorde_civil_id: c.id,
            lorde_id_jogo: c.id_jogo || '', lorde_raca: c.raca || s.lorde_raca,
          }))}
          civis={civis}
          vinculado={lordeVinculado}
          aoDesvincular={() => setV((s) => ({ ...s, lorde_civil_id: '', lorde_id_jogo: '' }))}
          placeholder="Busque no Registro Civil, ou deixe vazio se o posto está vago"
        />
        <p className="ajuda">
          {casa ? (
            <>
              <i className="cor-ponto" style={{ background: casa.cor, marginRight: 6 }} />
              O vilarejo passa a ser detido pela <strong>Casa {casa.nome}</strong>, a casa do
              Lorde empossado. Trocar o Lorde troca a casa junto.
            </>
          ) : v.lorde ? (
            <>Este Lorde não pertence a nenhuma casa nobre, então o vilarejo não fica sob
            estandarte de dinastia nenhuma.</>
          ) : (
            <>Empossar um Lorde que pertença a uma casa nobre coloca o vilarejo sob o
            estandarte dela.</>
          )}
        </p>
        <div style={{ height: 12 }} />
        <div className="grade g2">
          <Texto rotulo="Tipo" valor={v.tipo} aoMudar={set('tipo')} />
        </div>
        <div style={{ height: 12 }} />
        <AreaTexto rotulo="Descrição" valor={v.descricao} aoMudar={set('descricao')} />

        <div style={{ height: 20 }} />
        <div className="editor-cat-h" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>
            O território soma o que existe nas propriedades daqui — menos os inventários,
            que ficam só na ficha de cada uma.
          </span>
          <button
            className="btn pq"
            style={{ marginLeft: 'auto' }}
            title="Substitui a catalogação do território pela soma dos itens das propriedades deste assentamento, ignorando inventários de armazenamento."
            onClick={() =>
              set('catalogacao')(propriedades.reduce((acc, p) => mesclarItens(acc, p.catalogacao), []))
            }
          >
            Puxar das propriedades
          </button>
        </div>
        <EditorCatalogo valor={v.catalogacao} aoMudar={set('catalogacao')} titulo="Catalogação do território" />

        <div style={{ height: 22 }} />
        <div className="editor-cat-h">
          <label>Propriedades em {inicial.nome}</label>
          <span className="selo">{propriedades.length}</span>
          <button
            className="btn pq primario"
            onClick={() => setProp({ ...PROPRIEDADE_VAZIA, local: inicial.nome, categoria: 'casa', tipo: 'Casa', valor: null })}
          >
            + Adicionar propriedade
          </button>
        </div>

        {propriedades.length === 0 ? (
          <p className="cat-vazio">Nenhuma propriedade registrada neste assentamento.</p>
        ) : (
          <ul className="lista-props">
            {propriedades.map((p) => {
              const cat = lerCatalogacao(p.catalogacao);
              return (
                <li key={p.id}>
                  <button className="prop-linha" onClick={() => setProp(p)}>
                    <Icone nome={ehResidencia(p.tipo) ? 'casa' : 'moeda'} tam={17} cor="var(--gold)" />
                    <span className="prop-nome">{p.nome}</span>
                    <span className="selo">{p.tipo}</span>
                    {p.proprietario
                      ? <span className="selo gold">{p.proprietario}</span>
                      : <span className="selo warn"><i className="ponto" />Sem dono</span>}
                    <Icone nome="lapis" tam={13} cor="var(--txt-3)" />
                    {cat.length > 0 && <span className="prop-cat"><Catalogo itens={cat} limite={5} /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {prop && (
        <FormPropriedade
          inicial={prop}
          locais={locais}
          organizacoes={organizacoes}
          civis={civis}
          aoFechar={() => setProp(null)}
          aoSalvar={async (x) => { await aoSalvarProp(x); setProp(null); }}
          aoRemover={async (x) => { await aoRemoverProp(x); setProp(null); }}
        />
      )}
    </>
  );
}
