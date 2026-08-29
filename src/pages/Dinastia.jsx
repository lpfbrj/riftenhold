import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  salvarDinastiaPropria, pedirMembroDinastia, cancelarPedidoDinastia,
  fundarCasaNobre, refundarCasa, pedirDaCasa, responderAlianca, cancelarPedidoCasa,
} from '../lib/db.js';
import {
  TITULO_NOBREZA_TOM, PLEBEU, RACAS, TITULOS_LIDER, MAX_LEMA,
  PEDIDO_CASA_POR_ID, STATUS_PEDIDO_CASA_TOM, SITUACAO_CASA_TOM,
} from '../lib/constants.js';
import { tituloValido } from '../lib/nobreza.js';
import {
  nobrezaDoCivil, casaFundadaPor, propriedadesDe, pedidosDaCasa, aliancasDe,
  sedeDe, temMesnada, herdeiroDe, limparLema, septims, casasAprovadas,
  podeAbrirPedido, resumoDoPedido,
} from '../lib/casas.js';
import { prepararBrasao, LADO_BRASAO, MAX_ARQUIVO_MB } from '../lib/imagem.js';
import SeletorCivil from '../components/SeletorCivil.jsx';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Campo, Confirmar,
} from '../components/ui.jsx';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

const TOM_PEDIDO = { Pendente: 'warn', Aprovado: 'ok', Recusado: 'perigo' };

/** Chave só de interface: sem ela, remover uma linha do meio embaralha os campos. */
let contadorChave = 0;
const chaveNova = () => `k${(contadorChave += 1)}`;

const ABAS = [
  { id: 'casa', nome: 'A casa', icone: 'estandarte' },
  { id: 'membros', nome: 'Membros', icone: 'pessoa' },
  { id: 'herdeiro', nome: 'Herdeiro', icone: 'pergaminho' },
  { id: 'mesnada', nome: 'Mesnada', icone: 'escudo' },
  { id: 'aliancas', nome: 'Alianças', icone: 'selo' },
  { id: 'servos', nome: 'Servos', icone: 'chave' },
  { id: 'pedidos', nome: 'Pedidos', icone: 'balanca' },
];

/**
 * A casa na mão de quem a chefia.
 *
 * O que a casa faz sozinha: notas, servos e — com mesnada concedida —
 * os homens de armas. O que passa pela Corte, com taxa: a fundação, a
 * troca de insígnia, o herdeiro, a mesnada, a aliança e a sede.
 */
export default function Dinastia({ usuario }) {
  const d = useDados();
  const clas = d.clas || [];
  const propriedades = d.propriedades || [];
  const pedidosCasa = d.pedidos_casa || [];

  const civil = useMemo(
    () => ({ civil_id: usuario?.civil_id, nome: usuario?.nome }),
    [usuario?.civil_id, usuario?.nome],
  );
  const casa = useMemo(() => casaFundadaPor(civil, clas), [civil, clas]);
  const nobreza = useMemo(
    () => nobrezaDoCivil(civil, { pedidos: pedidosCasa, propriedades }),
    [civil, pedidosCasa, propriedades],
  );

  /* ---------- Sem casa ---------- */
  if (!casa) {
    if (!nobreza.nobre) {
      return (
        <Painel titulo="Nenhuma casa sob seu comando">
          <Vazio simb="⚜">
            Você não chefia nenhuma dinastia de Riften. Para fundar a sua, peça primeiro o
            <strong> título de nobreza</strong> na sua ficha — ele custa{' '}
            {septims(PEDIDO_CASA_POR_ID.nobreza.custo)} e exige ao menos uma propriedade
            registrada em seu nome.
          </Vazio>
        </Painel>
      );
    }
    return <FundarCasa usuario={usuario} civil={civil} />;
  }

  /* ---------- Casa esperando o aval, ou recusada ---------- */
  const situacao = casa.situacao || 'Aprovada';
  if (situacao !== 'Aprovada') {
    return <CasaEmJulgamento usuario={usuario} civil={civil} casa={casa} />;
  }

  return <CasaViva usuario={usuario} civil={civil} casa={casa} />;
}

/* ============================================================
   Fundação da casa
   ============================================================ */
function FundarCasa({ usuario, civil }) {
  const d = useDados();
  const propriedades = d.propriedades || [];
  const minhas = useMemo(() => propriedadesDe(civil, propriedades), [civil, propriedades]);

  const [v, setV] = useState({
    nome: '', lema: '', titulo_lider: 'Patriarca', cor: '#7c6bb0',
    brasao: null, sede_propriedade_id: minhas[0]?.id || '', notas: '',
  });
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const entrada = useRef(null);
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }));

  async function subirBrasao(e) {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setErro(''); setAviso('');
    try {
      const { dataUrl, temFundo } = await prepararBrasao(arq);
      setV((s) => ({ ...s, brasao: dataUrl }));
      if (temFundo) setAviso('Esse desenho parece ter fundo. O quadro fica melhor com o brasão recortado, em PNG transparente.');
    } catch (ex) { setErro(ex.message); }
  }

  const enviar = async () => {
    setErro('');
    setOcupado(true);
    try {
      await fundarCasaNobre(usuario, v, {
        propriedades, pedidos: d.pedidos_casa || [], clas: d.clas || [],
      });
      await d.recarregar();
    } catch (ex) {
      setErro(ex.message || 'Não foi possível fundar a casa agora.');
    } finally {
      setOcupado(false);
    }
  };

  const pronto = Boolean(String(v.nome).trim()) && Boolean(v.sede_propriedade_id);

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Fundar a sua casa nobre</h1>
          <p>
            A Corte reconheceu a sua nobreza. Agora dê nome, rosto e sede à dinastia — o que
            você escrever aqui vai à Corte para ser lavrado. A casa só passa a existir depois
            do aval.
          </p>
        </div>
        <div className="acoes"><Selo tom="ok" ponto>Título de nobreza concedido</Selo></div>
      </div>
      <div className="regra" />

      {erro && <div className="login-erro" style={{ marginBottom: 16 }}>{erro}</div>}

      <Painel titulo="A casa" acoes={<Selo tom="gold">Sem taxa de fundação</Selo>}>
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
              <button className="btn pq fantasma" onClick={() => setV((s) => ({ ...s, brasao: null }))}>
                Remover
              </button>
            )}
            <p className="brasao-regra">
              PNG ou WEBP <b>sem fundo</b>, até {MAX_ARQUIVO_MB} MB. O desenho é ajustado
              sozinho para {LADO_BRASAO}×{LADO_BRASAO} px.
            </p>
            {aviso && <p className="brasao-alerta">{aviso}</p>}
          </div>

          <div className="cla-campos">
            <div className="grade g2">
              <Texto rotulo="Nome da casa" valor={v.nome} aoMudar={set('nome')}
                     placeholder="Corvo-Negro, Pedra-Fria…" maxLength={40} />
              <Selecao rotulo="Como você chefia" valor={v.titulo_lider} aoMudar={set('titulo_lider')}
                       opcoes={TITULOS_LIDER} />
            </div>
            <CampoLema valor={v.lema} aoMudar={set('lema')} />
            <div className="grade g2">
              <Campo rotulo="Cor do estandarte">
                <input type="color" value={v.cor} onChange={(e) => set('cor')(e.target.value)}
                       style={{ height: 38, padding: 3 }} />
              </Campo>
              <Selecao
                rotulo="Sede principal da casa"
                valor={v.sede_propriedade_id}
                aoMudar={set('sede_propriedade_id')}
                vazioLabel="Escolha a propriedade…"
                opcoes={minhas.map((p) => ({ valor: p.id, rotulo: `${p.nome} — ${p.tipo}` }))}
              />
            </div>
            <p className="ajuda">
              <Icone nome="livro" tam={13} /> A sede é a propriedade que responde pela casa.
              Trocá-la depois custa {septims(PEDIDO_CASA_POR_ID.sede.custo)} e só é possível
              para quem tem mais de uma propriedade registrada.
            </p>
            <div style={{ height: 12 }} />
            <AreaTexto rotulo="Sobre a casa (a Corte vai ler)" valor={v.notas} aoMudar={set('notas')}
                       placeholder="História da dinastia, o que ela faz no Hold, a que se propõe…" />
          </div>
        </div>

        <footer className="ficha-acoes">
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            Herdeiro, mesnada e alianças só depois que a casa for reconhecida.
          </span>
          <button className="btn primario" disabled={!pronto || ocupado} onClick={enviar}>
            {ocupado ? 'Enviando…' : 'Enviar à Corte'}
          </button>
        </footer>
      </Painel>
    </>
  );
}

/** O lema, com o contador à vista — 40 caracteres e nada mais. */
function CampoLema({ valor, aoMudar }) {
  const restam = MAX_LEMA - String(valor || '').length;
  return (
    <div className="campo">
      <label>Lema da família</label>
      <input
        value={valor || ''}
        onChange={(e) => aoMudar(e.target.value.slice(0, MAX_LEMA))}
        placeholder="Uma frase curta, para o estandarte"
        maxLength={MAX_LEMA}
        className="campo-lema"
      />
      <p className="ajuda">
        <Icone nome="pergaminho" tam={13} /> {restam} caractere{restam === 1 ? '' : 's'} restante
        {restam === 1 ? '' : 's'} de {MAX_LEMA}.
      </p>
    </div>
  );
}

/* ============================================================
   A casa fundada, esperando a Corte
   ============================================================ */
function CasaEmJulgamento({ usuario, civil, casa }) {
  const d = useDados();
  const propriedades = d.propriedades || [];
  const pedidos = pedidosDaCasa(casa, d.pedidos_casa || []);
  const fundacao = pedidos.find((x) => x.tipo === 'fundacao') || null;
  const recusada = (casa.situacao || '') === 'Recusada';
  const [refazendo, setRefazendo] = useState(false);
  const sede = sedeDe(casa, propriedades);

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Casa {casa.nome}</h1>
          <p>
            {recusada
              ? 'A Corte não reconheceu a casa. Leia o parecer, ajuste o que for preciso e envie de novo.'
              : 'A fundação está na mesa da Corte. Enquanto não houver aval, a casa não entra na Nobreza de Riften nem aparece na lista pública.'}
          </p>
        </div>
        <div className="acoes">
          <Selo tom={SITUACAO_CASA_TOM[casa.situacao] || 'warn'} ponto>
            {recusada ? 'Fundação recusada' : 'Aguardando a Corte'}
          </Selo>
        </div>
      </div>
      <div className="regra" />

      <Painel titulo="O que foi enviado">
        <div className="casa-resumo">
          <span className="casa-brasao grande" style={{ borderColor: casa.cor }}>
            {casa.brasao
              ? <img src={casa.brasao} alt="" />
              : <Icone nome="estandarte" tam={34} cor={casa.cor} />}
          </span>
          <div>
            <h3>Casa {casa.nome}</h3>
            {casa.lema && <p className="casa-lema">“{casa.lema}”</p>}
            <div className="chip-lista" style={{ marginTop: 6 }}>
              <Selo tom="gold">{casa.titulo_lider || 'Patriarca'}: {casa.lider}</Selo>
              {sede && <Selo tom="roxo">Sede: {sede.nome}</Selo>}
              <Selo>Enviada em {quando(fundacao?.criado_em || casa.criado_em)}</Selo>
            </div>
          </div>
        </div>
        {casa.notas && <p className="painel-nota" style={{ marginTop: 12 }}>{casa.notas}</p>}
        {fundacao?.parecer && (
          <p className="perfil-nota-corte" style={{ marginTop: 10 }}>
            <strong>Parecer da Corte:</strong> {fundacao.parecer}
          </p>
        )}
        {recusada && !refazendo && (
          <div style={{ marginTop: 12 }}>
            <button className="btn primario" onClick={() => setRefazendo(true)}>
              <Icone nome="lapis" tam={14} /> Refazer a fundação
            </button>
          </div>
        )}
      </Painel>

      {refazendo && (
        <FormRefundar
          casa={casa}
          civil={civil}
          usuario={usuario}
          aoFechar={() => setRefazendo(false)}
        />
      )}
    </>
  );
}

function FormRefundar({ casa, civil, usuario, aoFechar }) {
  const d = useDados();
  const propriedades = d.propriedades || [];
  const minhas = propriedadesDe(civil, propriedades);
  const [v, setV] = useState({
    nome: casa.nome, lema: casa.lema || '', cor: casa.cor || '#7c6bb0',
    brasao: casa.brasao || null,
    sede_propriedade_id: casa.sede_propriedade_id || minhas[0]?.id || '',
    notas: casa.notas || '',
  });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }));

  const enviar = async () => {
    setErro('');
    setOcupado(true);
    try {
      await refundarCasa(usuario, casa, v, { propriedades, clas: d.clas || [] });
      await d.recarregar();
      aoFechar();
    } catch (ex) {
      setErro(ex.message || 'Não foi possível enviar agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={`Refazer a fundação — Casa ${casa.nome}`}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            Volta para a fila da Corte, sem taxa.
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Enviando…' : 'Enviar de novo'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro">{erro}</div>}
      <Texto rotulo="Nome da casa" valor={v.nome} aoMudar={set('nome')} maxLength={40} />
      <CampoLema valor={v.lema} aoMudar={set('lema')} />
      <Selecao
        rotulo="Sede principal"
        valor={v.sede_propriedade_id}
        aoMudar={set('sede_propriedade_id')}
        vazioLabel="Escolha a propriedade…"
        opcoes={minhas.map((p) => ({ valor: p.id, rotulo: `${p.nome} — ${p.tipo}` }))}
      />
      <AreaTexto rotulo="Sobre a casa" valor={v.notas} aoMudar={set('notas')} />
    </Modal>
  );
}

/* ============================================================
   A casa reconhecida
   ============================================================ */
function CasaViva({ usuario, civil, casa }) {
  const d = useDados();
  const clas = d.clas || [];
  const propriedades = d.propriedades || [];
  const todosPedidos = d.pedidos_casa || [];

  const servosDaCasa = useMemo(
    () => (casa.servos || []).map((x, i) => ({ _k: `s${i}`, ...x })), [casa],
  );
  const soldadosDaCasa = useMemo(
    () => (casa.soldados || []).map((x, i) => ({ _k: `m${i}`, ...x })), [casa],
  );

  const [aba, setAba] = useState('casa');
  const [notas, setNotas] = useState(null);
  const [servos, setServos] = useState(null);
  const [soldados, setSoldados] = useState(null);
  const [mesnadaNome, setMesnadaNome] = useState(null);
  const [indicar, setIndicar] = useState(null);
  const [remPedido, setRemPedido] = useState(null);
  const [remChancela, setRemChancela] = useState(null);
  const [pedir, setPedir] = useState(null);   // tipo de pedido aberto no modal
  const [salvo, setSalvo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const relogio = useRef(null);

  const avisar = (texto, ms = 4500) => {
    clearTimeout(relogio.current);
    setSalvo(texto);
    relogio.current = setTimeout(() => setSalvo(''), ms);
  };
  useEffect(() => () => clearTimeout(relogio.current), []);

  const vNotas = notas !== null ? notas : (casa.notas || '');
  const vServos = servos !== null ? servos : servosDaCasa;
  const vSoldados = soldados !== null ? soldados : soldadosDaCasa;
  const vMesnadaNome = mesnadaNome !== null ? mesnadaNome : (casa.mesnada_nome || '');
  // O nome da mesnada compara valor, não "foi tocado": digitar e
  // apagar não pode deixar a barra de "não salvou" acesa para sempre.
  const mexeu = notas !== null || servos !== null || soldados !== null
    || (mesnadaNome !== null && mesnadaNome !== (casa.mesnada_nome || ''));

  const pedidosMembro = (d.pedidos_dinastia || []).filter((x) => x.cla_id === casa.id);
  const pendentesMembro = pedidosMembro.filter((x) => x.status === 'Pendente');
  const chancela = pedidosDaCasa(casa, todosPedidos);
  const propostasRecebidas = chancela.filter(
    (x) => x.tipo === 'alianca' && x.status === 'Aguardando casa' && x.alvo_cla_id === casa.id,
  );
  const naCorte = chancela.filter((x) => x.status === 'Pendente');
  const aliadas = aliancasDe(casa, todosPedidos, clas);
  const membros = casa.membros || [];
  const sede = sedeDe(casa, propriedades);
  const herdeiro = herdeiroDe(casa);
  const comMesnada = temMesnada(casa);
  const minhasProps = propriedadesDe(
    { civil_id: casa.lider_civil_id, nome: casa.lider }, propriedades,
  );

  const descartar = () => {
    setNotas(null); setServos(null); setSoldados(null); setMesnadaNome(null); setErro('');
  };

  const salvar = async () => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await salvarDinastiaPropria(usuario, casa, {
        notas: vNotas, servos: vServos, soldados: vSoldados, mesnada_nome: vMesnadaNome,
      });
      await d.recarregar();
      descartar();
      avisar('A casa foi atualizada. A Corte já enxerga a mudança.');
    } catch (ex) {
      setErro(ex.message || 'Não foi possível salvar agora.');
    } finally {
      setOcupado(false);
    }
  };

  /** Aceitar ou recusar uma proposta de aliança, sem clique dobrado. */
  const responder = async (proposta, aceitar) => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await responderAlianca(usuario, casa, proposta, aceitar);
      await d.recarregar();
      avisar(aceitar
        ? `Aceite registrado. A Corte vai lavrar o pacto com a Casa ${proposta.cla_nome}.`
        : `Proposta da Casa ${proposta.cla_nome} recusada.`);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível responder agora.');
      await d.recarregar();
    } finally {
      setOcupado(false);
    }
  };

  /** Abre o modal de um pedido, ou explica por que não dá. */
  const abrirPedido = (tipo, alvo = null) => {
    const { pode, motivo } = podeAbrirPedido(tipo, {
      cla: casa, propriedades, pedidos: todosPedidos, alvo,
    });
    if (!pode) { setErro(motivo); return; }
    setErro('');
    setPedir({ tipo, alvo });
  };

  const enviarPedido = async (tipo, dados) => {
    await pedirDaCasa(usuario, casa, tipo, dados, {
      propriedades, pedidos: todosPedidos, clas,
    });
    await d.recarregar();
    setPedir(null);
    avisar(tipo === 'alianca'
      ? 'Proposta enviada. A outra casa responde antes de a Corte julgar.'
      : `Pedido enviado à Corte — ${PEDIDO_CASA_POR_ID[tipo].nome}.`);
  };

  /* ---- edição de listas ---- */
  const mudarLinha = (lista, set, i, campo, val) =>
    set(lista.map((s, j) => (j === i ? { ...s, [campo]: val } : s)));
  const ligarLinha = (lista, set, i, c) =>
    set(lista.map((s, j) => (j === i
      ? { ...s, nome: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '', raca: c.raca || s.raca }
      : s)));
  const novaLinha = (campo) =>
    ({ _k: chaveNova(), nome: '', civil_id: '', id_jogo: '', raca: '', [campo]: '', notas: '' });

  const contaAba = {
    membros: membros.length || null,
    aliancas: propostasRecebidas.length || null,
    pedidos: (naCorte.length + pendentesMembro.length) || null,
    servos: vServos.length || null,
    mesnada: comMesnada ? (vSoldados.length || null) : null,
  };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Casa {casa.nome}</h1>
          {casa.lema && <p className="casa-lema no-topo">“{casa.lema}”</p>}
          <p>
            A sua dinastia. Notas, servos e homens de armas são seus para cuidar. Insígnia,
            herdeiro, mesnada, aliança e sede passam pela Corte, cada um com a sua taxa.
          </p>
        </div>
        <div className="acoes">
          <button className="btn primario" onClick={() => setIndicar({ nome: '', parentesco: '', justificativa: '' })}>
            <Icone nome="mais" tam={15} /> Indicar novo membro
          </button>
        </div>
      </div>
      <div className="regra" />

      {salvo && <div className="aviso-ok"><Icone nome="selo" tam={15} /> {salvo}</div>}
      {erro && <div className="login-erro" style={{ marginBottom: 16 }}>{erro}</div>}

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Membros da dinastia" valor={membros.length} sub="nobres da casa" tom="roxo" />
        <Stat rotulo="Casas aliadas" valor={aliadas.length}
              sub={aliadas.length ? 'pactos lavrados' : 'nenhum pacto'} tom={aliadas.length ? 'verde' : ''} />
        <Stat rotulo="Mesnada" valor={comMesnada ? vSoldados.length : '—'}
              sub={comMesnada ? 'homens de armas' : 'não registrada'} tom={comMesnada ? 'gold' : ''} />
        <Stat rotulo="Pedidos na Corte" valor={naCorte.length + pendentesMembro.length}
              sub={naCorte.length + pendentesMembro.length ? 'aguardando aval' : 'nada pendente'}
              tom={naCorte.length + pendentesMembro.length ? 'laranja' : ''} />
      </div>

      {/* -------- Abas -------- */}
      <div className="sub-abas">
        {ABAS.map((a) => (
          <button key={a.id} className={`sub-aba ${aba === a.id ? 'ativa' : ''}`}
                  onClick={() => setAba(a.id)}>
            <Icone nome={a.icone} tam={14} /> {a.nome}
            {contaAba[a.id] ? <b className="mono">{contaAba[a.id]}</b> : null}
          </button>
        ))}
      </div>

      {/* ================= A casa ================= */}
      {aba === 'casa' && (
        <>
          <Painel
            titulo="Estandarte da casa"
            acoes={
              <button className="btn pq" onClick={() => abrirPedido('insignia')}>
                <Icone nome="lapis" tam={13} /> Pedir alteração ({septims(PEDIDO_CASA_POR_ID.insignia.custo)})
              </button>
            }
          >
            <p className="painel-nota">
              Brasão e lema são o rosto da dinastia perante o Hold. Depois de fundada a casa,
              trocá-los é ato da Corte: o pedido custa{' '}
              <strong>{septims(PEDIDO_CASA_POR_ID.insignia.custo)}</strong>.
            </p>
            <div className="casa-resumo">
              <span className="casa-brasao grande" style={{ borderColor: casa.cor }}>
                {casa.brasao
                  ? <img src={casa.brasao} alt="" />
                  : <Icone nome="estandarte" tam={34} cor={casa.cor} />}
              </span>
              <div>
                <h3>Casa {casa.nome}</h3>
                <p className="casa-lema">
                  {casa.lema ? `“${casa.lema}”` : <i>Sem lema registrado</i>}
                </p>
                <div className="chip-lista" style={{ marginTop: 6 }}>
                  <Selo tom="gold">{casa.titulo_lider || 'Patriarca'}: {casa.lider}</Selo>
                  <Selo tom={TITULO_NOBREZA_TOM[tituloValido(casa.lider_titulo)]}>
                    {tituloValido(casa.lider_titulo)}
                  </Selo>
                  <Selo tom="ok">Reconhecida em {quando(casa.fundada_em)}</Selo>
                </div>
              </div>
            </div>
          </Painel>

          <div style={{ height: 16 }} />

          <Painel
            titulo="Sede principal"
            acoes={
              <button className="btn pq" onClick={() => abrirPedido('sede')}>
                <Icone nome="casa" tam={13} /> Transferir sede ({septims(PEDIDO_CASA_POR_ID.sede.custo)})
              </button>
            }
          >
            <p className="painel-nota">
              A propriedade que responde pela casa. Só se transfere a sede quem tem
              <strong> mais de uma propriedade</strong> registrada em seu nome, e a mudança
              custa <strong>{septims(PEDIDO_CASA_POR_ID.sede.custo)}</strong>.
            </p>
            {sede ? (
              <div className="linha-nobre destaque">
                <Icone nome="casa" tam={15} cor="var(--gold)" />
                <span className="ln-nome">{sede.nome}</span>
                {sede.tipo && <Selo>{sede.tipo}</Selo>}
                {sede.local && <Selo tom="roxo">{sede.local}</Selo>}
                <span className="ln-fim">sede da casa</span>
              </div>
            ) : (
              <Vazio simb="🏰">Nenhuma sede registrada.</Vazio>
            )}
            <p className="ajuda" style={{ marginTop: 10 }}>
              <Icone nome="livro" tam={13} /> Você tem {minhasProps.length} propriedade
              {minhasProps.length === 1 ? '' : 's'} em seu nome.
              {minhasProps.length < 2 && ' Registre outra junto à Corte para poder transferir a sede.'}
            </p>
          </Painel>

          <div style={{ height: 16 }} />

          <Painel titulo="Sobre a casa">
            <p className="painel-nota">
              A crônica da dinastia, escrita por você. Isto não passa pela Corte.
            </p>
            <AreaTexto rotulo="História da casa" valor={vNotas} aoMudar={setNotas}
                       placeholder="Origem da linhagem, feitos, o que a casa faz no Hold…" />
          </Painel>
        </>
      )}

      {/* ================= Membros ================= */}
      {aba === 'membros' && (
        <Painel
          titulo="Membros da dinastia"
          acoes={<Selo tom="roxo">{membros.length} {membros.length === 1 ? 'nobre' : 'nobres'}</Selo>}
        >
          <p className="painel-nota">
            Quem está aqui é nobre de Riften e consta na lista da Corte. Para trazer mais
            alguém, use <strong>Indicar novo membro</strong> — a Corte julga o pedido.
            Desligar alguém da casa também é ato da Corte.
          </p>
          <div className="linha-nobre destaque">
            <Icone nome="coroa" tam={15} cor="var(--gold)" />
            <span className="ln-nome">{casa.lider}</span>
            <Selo tom="gold">{casa.titulo_lider || 'Patriarca'} da Dinastia</Selo>
            <Selo tom={TITULO_NOBREZA_TOM[tituloValido(casa.lider_titulo)]}>
              {tituloValido(casa.lider_titulo)}
            </Selo>
            <span className="ln-fim">você</span>
          </div>
          {membros.length === 0 ? (
            <p className="cat-vazio">Nenhum membro além de você nesta casa.</p>
          ) : membros.map((m, i) => (
            <div className="linha-nobre" key={i}>
              <Icone nome="pessoa" tam={15} cor="var(--purple)" />
              <span className="ln-nome">{m.nome}</span>
              <Selo>Membro da Dinastia</Selo>
              <Selo tom={TITULO_NOBREZA_TOM[tituloValido(m.titulo)]}>{tituloValido(m.titulo)}</Selo>
              {herdeiro && herdeiro.nome === m.nome && <Selo tom="gold">Herdeiro Oficial</Selo>}
              {m.notas && <span className="ln-nota">{m.notas}</span>}
            </div>
          ))}
        </Painel>
      )}

      {/* ================= Herdeiro ================= */}
      {aba === 'herdeiro' && (
        <Painel
          titulo="Herdeiro Oficial"
          acoes={herdeiro
            ? <button className="btn pq" onClick={() => abrirPedido('herdeiro')}>
                <Icone nome="lapis" tam={13} /> Trocar ({septims(PEDIDO_CASA_POR_ID.herdeiro.custo)})
              </button>
            : <Selo tom="off">{septims(PEDIDO_CASA_POR_ID.herdeiro.custo)}</Selo>}
        >
          <p className="painel-nota">
            Quem responde pela casa quando o {(casa.titulo_lider || 'Patriarca').toLowerCase()} falta.
            O registro é ato da Corte e custa{' '}
            <strong>{septims(PEDIDO_CASA_POR_ID.herdeiro.custo)}</strong>.
          </p>
          {herdeiro ? (
            <>
              <div className="linha-nobre destaque">
                <Icone nome="pergaminho" tam={15} cor="var(--gold)" />
                <span className="ln-nome">{herdeiro.nome}</span>
                {herdeiro.parentesco && <Selo tom="roxo">{herdeiro.parentesco}</Selo>}
                {herdeiro.raca && <Selo>{herdeiro.raca}</Selo>}
                <span className="ln-fim">desde {quando(herdeiro.registrado_em)}</span>
              </div>
              <p className="ajuda" style={{ marginTop: 10 }}>
                <Icone nome="livro" tam={13} /> Trocar o herdeiro é um novo pedido, com a
                mesma taxa.
              </p>
            </>
          ) : (
            <>
              <Vazio simb="✒">
                A casa ainda não tem herdeiro registrado.
              </Vazio>
              <div style={{ marginTop: 12 }}>
                <button className="btn primario" onClick={() => abrirPedido('herdeiro')}>
                  <Icone nome="pergaminho" tam={14} /> Registrar herdeiro ({septims(PEDIDO_CASA_POR_ID.herdeiro.custo)})
                </button>
              </div>
            </>
          )}
        </Painel>
      )}

      {/* ================= Mesnada ================= */}
      {aba === 'mesnada' && (
        <Painel
          titulo="Mesnada da casa"
          acoes={comMesnada
            ? (
              <button className="btn pq primario"
                      onClick={() => setSoldados([...vSoldados, novaLinha('posto')])}>
                <Icone nome="mais" tam={13} /> Registrar soldado
              </button>
            )
            : <Selo tom="off">{septims(PEDIDO_CASA_POR_ID.mesnada.custo)}</Selo>}
        >
          <p className="painel-nota">
            A mesnada é o direito de manter <strong>homens de armas</strong> sob a bandeira da
            casa. Concedida pela Corte por{' '}
            <strong>{septims(PEDIDO_CASA_POR_ID.mesnada.custo)}</strong>, ela abre este
            registro: cada soldado alistado responde à sua dinastia, e não à Guarda do Hold.
          </p>

          {!comMesnada ? (
            <>
              <Vazio simb="🛡">
                A casa ainda não tem mesnada. Sem ela, ninguém pode ser alistado sob a sua
                bandeira.
              </Vazio>
              <div style={{ marginTop: 12 }}>
                <button className="btn primario" onClick={() => abrirPedido('mesnada')}>
                  <Icone nome="escudo" tam={14} /> Pedir Registro de Mesnada ({septims(PEDIDO_CASA_POR_ID.mesnada.custo)})
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="linha-nobre destaque" style={{ marginBottom: 10 }}>
                <Icone nome="escudo" tam={15} cor="var(--gold)" />
                <span className="ln-nome">Mesnada reconhecida</span>
                <Selo tom="ok">desde {quando(casa.mesnada_em)}</Selo>
                <span className="ln-fim">{vSoldados.length} sob a bandeira</span>
              </div>

              <Texto
                rotulo="Nome da mesnada"
                valor={vMesnadaNome}
                aoMudar={setMesnadaNome}
                maxLength={60}
                placeholder={`Mesnada da Casa ${casa.nome}`}
              />
              <p className="painel-nota" style={{ margin: '6px 0 14px' }}>
                É por este nome que a Corte conta a sua tropa nas forças de Riften — como a
                Ordem do Dragão Negro, mesnada da Casa Blackwing. Em branco, ela aparece
                apenas como <em>Mesnada da Casa {casa.nome}</em>.
              </p>

              {vSoldados.length === 0 ? (
                <Vazio simb="⚔">
                  Nenhum soldado alistado. Use <strong>Registrar soldado</strong> e dê a cada um
                  o seu posto.
                </Vazio>
              ) : (
                <ul className="lista-membros">
                  {vSoldados.map((s, i) => (
                    <li key={s._k || i}>
                      <SeletorCivil
                        compacto
                        valor={s.nome}
                        aoMudar={(n) => setSoldados(vSoldados.map((x, j) => (j === i ? { ...x, nome: n, civil_id: '', id_jogo: '' } : x)))}
                        aoEscolher={(c) => ligarLinha(vSoldados, setSoldados, i, c)}
                        civis={d.civis || []}
                        vinculado={s.civil_id ? (d.civis || []).find((c) => c.id === s.civil_id) : null}
                        aoDesvincular={() => mudarLinha(vSoldados, setSoldados, i, 'civil_id', '')}
                        placeholder="Nome — busca no Registro Civil"
                      />
                      <input
                        value={s.posto || ''}
                        onChange={(e) => mudarLinha(vSoldados, setSoldados, i, 'posto', e.target.value)}
                        placeholder="Posto — Capitão, Arqueiro, Escudeiro…"
                        className="servo-funcao"
                      />
                      <select value={s.raca || ''}
                              onChange={(e) => mudarLinha(vSoldados, setSoldados, i, 'raca', e.target.value)}>
                        <option value="">Raça</option>
                        {RACAS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input value={s.notas || ''}
                             onChange={(e) => mudarLinha(vSoldados, setSoldados, i, 'notas', e.target.value)}
                             placeholder="Observação" />
                      <Selo tom="gold">Homem de armas</Selo>
                      <button className="btn pq perigo" aria-label="Dispensar soldado"
                              onClick={() => setSoldados(vSoldados.filter((_, j) => j !== i))}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Painel>
      )}

      {/* ================= Alianças ================= */}
      {aba === 'aliancas' && (
        <>
          {propostasRecebidas.length > 0 && (
            <>
              <Painel
                titulo="Propostas recebidas"
                acoes={<Selo tom="roxo" ponto>{propostasRecebidas.length} a responder</Selo>}
              >
                <p className="painel-nota">
                  Outra casa quer se aliar à sua. Só depois do seu aceite o pacto sobe para a
                  Corte lavrar — e a taxa é de quem propôs.
                </p>
                {propostasRecebidas.map((x) => (
                  <article className="proposta-alianca" key={x.id}>
                    <header>
                      <Icone nome="selo" tam={16} cor="var(--purple)" />
                      <h4>Casa {x.cla_nome}</h4>
                      <Selo tom="roxo">{septims(x.custo)}</Selo>
                      <Selo>{quando(x.criado_em)}</Selo>
                    </header>
                    {x.motivo && <p>“{x.motivo}”</p>}
                    <footer>
                      <button className="btn pq perigo" disabled={ocupado}
                              onClick={() => responder(x, false)}>Recusar</button>
                      <button className="btn pq primario" disabled={ocupado}
                              onClick={() => responder(x, true)}>Aceitar</button>
                    </footer>
                  </article>
                ))}
              </Painel>
              <div style={{ height: 16 }} />
            </>
          )}

          <Painel
            titulo="Alianças da casa"
            acoes={
              <button className="btn pq primario" onClick={() => setPedir({ tipo: 'alianca' })}>
                <Icone nome="mais" tam={13} /> Propor aliança ({septims(PEDIDO_CASA_POR_ID.alianca.custo)})
              </button>
            }
          >
            <p className="painel-nota">
              Um pacto declarado entre duas casas. Quem propõe paga{' '}
              <strong>{septims(PEDIDO_CASA_POR_ID.alianca.custo)}</strong>; a casa convidada
              precisa aceitar, e a Corte lavra. Depois disso a aliança aparece nas duas casas.
            </p>
            {aliadas.length === 0 ? (
              <Vazio simb="⚭">Nenhuma aliança em vigor.</Vazio>
            ) : (
              <div className="grade g2">
                {aliadas.map((a) => (
                  <article className="casa-aliada" key={a.cla_id}>
                    <span className="cor-ponto" style={{ background: a.cor }} />
                    <div>
                      <strong>Casa {a.nome}</strong>
                      <small>aliada desde {quando(a.desde)}</small>
                    </div>
                    <Selo tom="ok" ponto>Pacto lavrado</Selo>
                  </article>
                ))}
              </div>
            )}
          </Painel>
        </>
      )}

      {/* ================= Servos ================= */}
      {aba === 'servos' && (
        <Painel
          titulo="Servos da casa"
          acoes={
            <button className="btn pq primario" onClick={() => setServos([...vServos, novaLinha('funcao')])}>
              <Icone nome="mais" tam={13} /> Registrar servo
            </button>
          }
        >
          <p className="painel-nota">
            Quem serve a casa sem pertencer à linhagem: mordomos, emissários, criados.
            <strong> Servo não é nobre</strong> — não entra na Nobreza de Riften e continua
            Plebeu. Você registra e dispensa por conta própria, sem passar pela Corte.
            Homem de armas é outra coisa: vive na aba Mesnada.
          </p>
          {vServos.length === 0 ? (
            <Vazio simb="⚒">
              Nenhum servo registrado. Use <strong>Registrar servo</strong> e descreva a função
              de cada um com suas palavras.
            </Vazio>
          ) : (
            <ul className="lista-membros">
              {vServos.map((s, i) => (
                <li key={s._k || i}>
                  <SeletorCivil
                    compacto
                    valor={s.nome}
                    aoMudar={(n) => setServos(vServos.map((x, j) => (j === i ? { ...x, nome: n, civil_id: '', id_jogo: '' } : x)))}
                    aoEscolher={(c) => ligarLinha(vServos, setServos, i, c)}
                    civis={d.civis || []}
                    vinculado={s.civil_id ? (d.civis || []).find((c) => c.id === s.civil_id) : null}
                    aoDesvincular={() => mudarLinha(vServos, setServos, i, 'civil_id', '')}
                    placeholder="Nome — busca no Registro Civil"
                  />
                  <input
                    value={s.funcao || ''}
                    onChange={(e) => mudarLinha(vServos, setServos, i, 'funcao', e.target.value)}
                    placeholder="Função — Mordomo, Emissário, Criado…"
                    className="servo-funcao"
                  />
                  <select value={s.raca || ''}
                          onChange={(e) => mudarLinha(vServos, setServos, i, 'raca', e.target.value)}>
                    <option value="">Raça</option>
                    {RACAS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input value={s.notas || ''}
                         onChange={(e) => mudarLinha(vServos, setServos, i, 'notas', e.target.value)}
                         placeholder="Observação" />
                  <Selo tom="off">{PLEBEU}</Selo>
                  <button className="btn pq perigo" aria-label="Dispensar servo"
                          onClick={() => setServos(vServos.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      )}

      {/* ================= Pedidos ================= */}
      {aba === 'pedidos' && (
        <>
          <Painel
            titulo="Pedidos à Chancelaria"
            acoes={naCorte.length
              ? <Selo tom="warn" ponto>{naCorte.length} na mesa da Corte</Selo>
              : <Selo tom="ok" ponto>Nada pendente</Selo>}
          >
            <p className="painel-nota">
              Tudo que a casa pediu à Corte, com a taxa de cada ato. Enquanto o pedido não for
              julgado, você pode desistir dele — a fundação é a única que não volta atrás.
            </p>
            {chancela.length === 0 ? (
              <Vazio simb="⚖">Nenhum pedido registrado por esta casa.</Vazio>
            ) : (
              <div className="tabela-wrap">
                <table style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th>Ato</th><th>Detalhe</th><th>Taxa</th><th>Enviado</th>
                      <th>Situação</th><th className="col-acoes"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {chancela.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <span className="nome-forte">{PEDIDO_CASA_POR_ID[x.tipo]?.nome || x.tipo}</span>
                          {x.alvo_cla_id === casa.id && (
                            <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>
                              proposta da Casa {x.cla_nome}
                            </div>
                          )}
                        </td>
                        <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                          {resumoDoPedido(x, clas)}
                        </td>
                        <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(x.custo)}</td>
                        <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(x.criado_em)}</td>
                        <td>
                          <Selo tom={STATUS_PEDIDO_CASA_TOM[x.status]} ponto>{x.status}</Selo>
                          {x.parecer && (
                            <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>
                              {x.parecer}
                            </div>
                          )}
                        </td>
                        <td className="col-acoes">
                          {x.tipo !== 'fundacao' &&
                           x.cla_id === casa.id &&
                           (x.status === 'Pendente' || x.status === 'Aguardando casa') && (
                            <button className="btn pq fantasma" onClick={() => setRemChancela(x)}>
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          <div style={{ height: 16 }} />

          <Painel
            titulo="Indicações de membros"
            acoes={pendentesMembro.length
              ? <Selo tom="warn" ponto>{pendentesMembro.length} aguardando</Selo>
              : <Selo tom="ok" ponto>Nada pendente</Selo>}
          >
            {pedidosMembro.length === 0 ? (
              <Vazio simb="⚜">Nenhuma indicação enviada.</Vazio>
            ) : (
              <div className="tabela-wrap">
                <table style={{ minWidth: 660 }}>
                  <thead>
                    <tr><th>Indicado</th><th>Parentesco</th><th>Enviado</th><th>Situação</th><th className="col-acoes"></th></tr>
                  </thead>
                  <tbody>
                    {[...pedidosMembro].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).map((x) => (
                      <tr key={x.id}>
                        <td>
                          <span className="nome-forte">{x.nome}</span>
                          {x.justificativa && (
                            <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>
                              “{x.justificativa}”
                            </div>
                          )}
                        </td>
                        <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{x.parentesco || '—'}</td>
                        <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{quando(x.criado_em)}</td>
                        <td>
                          <Selo tom={TOM_PEDIDO[x.status]} ponto>{x.status}</Selo>
                          {x.observacao_corte && (
                            <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 3 }}>
                              {x.observacao_corte}
                            </div>
                          )}
                        </td>
                        <td className="col-acoes">
                          {x.status === 'Pendente' && (
                            <button className="btn pq fantasma" onClick={() => setRemPedido(x)}>
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </>
      )}

      {mexeu && (
        <div className="barra-salvar">
          <span>Você mexeu na casa e ainda não salvou.</span>
          <button className="btn fantasma" onClick={descartar}>Descartar</button>
          <button className="btn primario" disabled={ocupado} onClick={salvar}>
            {ocupado ? 'Salvando…' : 'Salvar a casa'}
          </button>
        </div>
      )}

      {pedir && (
        <FormPedidoCasa
          tipo={pedir.tipo}
          casa={casa}
          civis={d.civis || []}
          clas={clas}
          propriedades={minhasProps}
          pedidos={todosPedidos}
          aoFechar={() => setPedir(null)}
          aoEnviar={enviarPedido}
        />
      )}

      {indicar && (
        <FormIndicacao
          casa={casa}
          civis={d.civis || []}
          aoFechar={() => setIndicar(null)}
          aoEnviar={async (v) => {
            setErro('');
            try {
              await pedirMembroDinastia(usuario, casa, v);
              await d.recarregar();
              setIndicar(null);
              avisar(`Pedido enviado. A Corte vai julgar a entrada de ${v.nome} na casa.`, 6000);
            } catch (ex) {
              throw new Error(ex.message || 'Não foi possível enviar o pedido.');
            }
          }}
        />
      )}
      {remPedido && (
        <Confirmar
          mensagem={`Cancelar o pedido de entrada de ${remPedido.nome} na Casa ${casa.nome}?`}
          rotulo="Cancelar pedido"
          aoConfirmar={async () => {
            try {
              await cancelarPedidoDinastia(usuario, remPedido);
              await d.recarregar();
              avisar('Pedido cancelado.');
            } catch (ex) {
              setErro(ex.message || 'Não foi possível cancelar agora.');
              await d.recarregar();
            }
          }}
          aoFechar={() => setRemPedido(null)}
        />
      )}
      {remChancela && (
        <Confirmar
          mensagem={`Desistir do pedido de ${PEDIDO_CASA_POR_ID[remChancela.tipo]?.nome?.toLowerCase() || remChancela.tipo}? A taxa de ${septims(remChancela.custo)} não chega a ser cobrada.`}
          rotulo="Desistir"
          aoConfirmar={async () => {
            try {
              await cancelarPedidoCasa(usuario, remChancela);
              await d.recarregar();
              avisar('Pedido retirado da Chancelaria.');
            } catch (ex) {
              setErro(ex.message || 'Não foi possível cancelar agora.');
              await d.recarregar();
            }
          }}
          aoFechar={() => setRemChancela(null)}
        />
      )}
    </>
  );
}

/* ============================================================
   Um pedido à Chancelaria — o modal muda com o tipo
   ============================================================ */
function FormPedidoCasa({ tipo, casa, civis, clas, propriedades, pedidos, aoFechar, aoEnviar }) {
  const modelo = PEDIDO_CASA_POR_ID[tipo];
  const [v, setV] = useState(() => ({
    motivo: '',
    // insígnia
    lema: casa.lema || '', cor: casa.cor || '#7c6bb0', brasao: casa.brasao || null,
    // herdeiro
    nome: '', civil_id: '', id_jogo: '', raca: '', parentesco: '',
    // sede
    sede_propriedade_id: '',
    // aliança
    alvo_cla_id: '',
  }));
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const entrada = useRef(null);
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }));

  const candidatas = useMemo(
    () => casasAprovadas(clas).filter((c) => c.id !== casa.id),
    [clas, casa.id],
  );

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

  const pronto = tipo === 'herdeiro' ? Boolean(String(v.nome).trim())
    : tipo === 'sede' ? Boolean(v.sede_propriedade_id)
    : tipo === 'alianca' ? Boolean(v.alvo_cla_id)
    : true;

  const enviar = async () => {
    setErro('');
    setOcupado(true);
    try {
      await aoEnviar(tipo, v);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível enviar o pedido.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={`${modelo.nome} — Casa ${casa.nome}`}
      largo={tipo === 'insignia'}
      aoFechar={aoFechar}
      rodape={
        <>
          <span className="taxa-rodape">
            Taxa deste ato: <strong>{septims(modelo.custo)}</strong>
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!pronto || ocupado} onClick={enviar}>
            {ocupado ? 'Enviando…' : tipo === 'alianca' ? 'Propor aliança' : 'Enviar à Corte'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro">{erro}</div>}
      <p className="painel-nota">{modelo.resumo} {modelo.exige}</p>

      {tipo === 'insignia' && (
        <div className="cla-editor">
          <div className="cla-brasao-edit">
            <div className="brasao-quadro" style={{ borderColor: v.cor }}>
              {v.brasao
                ? <img src={v.brasao} alt="" />
                : <Icone nome="estandarte" tam={40} cor="var(--line-2)" />}
            </div>
            <input ref={entrada} type="file" accept="image/png,image/webp,image/svg+xml"
                   onChange={subirBrasao} style={{ display: 'none' }} />
            <button className="btn pq" onClick={() => entrada.current?.click()}>Trocar brasão</button>
            {v.brasao && (
              <button className="btn pq fantasma" onClick={() => setV((s) => ({ ...s, brasao: null }))}>
                Remover
              </button>
            )}
            <p className="brasao-regra">PNG ou WEBP sem fundo, até {MAX_ARQUIVO_MB} MB.</p>
            {aviso && <p className="brasao-alerta">{aviso}</p>}
          </div>
          <div className="cla-campos">
            <CampoLema valor={v.lema} aoMudar={set('lema')} />
            <Campo rotulo="Cor do estandarte">
              <input type="color" value={v.cor} onChange={(e) => set('cor')(e.target.value)}
                     style={{ height: 38, padding: 3 }} />
            </Campo>
          </div>
        </div>
      )}

      {tipo === 'herdeiro' && (
        <>
          <SeletorCivil
            rotulo="Quem será o herdeiro"
            valor={v.nome}
            aoMudar={(n) => setV((s) => ({ ...s, nome: n, civil_id: '', id_jogo: '' }))}
            aoEscolher={(c) => setV((s) => ({
              ...s, nome: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '', raca: c.raca || s.raca,
            }))}
            civis={civis}
            vinculado={v.civil_id ? civis.find((c) => c.id === v.civil_id) : null}
            aoDesvincular={() => setV((s) => ({ ...s, civil_id: '' }))}
            placeholder="Nome — busca no Registro Civil"
          />
          <Texto rotulo="Parentesco ou vínculo" valor={v.parentesco} aoMudar={set('parentesco')}
                 placeholder="Filho mais velho, sobrinha, afilhado…" />
        </>
      )}

      {tipo === 'sede' && (
        <Selecao
          rotulo="Nova sede principal"
          valor={v.sede_propriedade_id}
          aoMudar={set('sede_propriedade_id')}
          vazioLabel="Escolha a propriedade…"
          opcoes={propriedades
            .filter((p) => p.id !== casa.sede_propriedade_id)
            .map((p) => ({ valor: p.id, rotulo: `${p.nome} — ${p.tipo}` }))}
        />
      )}

      {tipo === 'alianca' && (
        <Selecao
          rotulo="Com qual casa"
          valor={v.alvo_cla_id}
          aoMudar={set('alvo_cla_id')}
          vazioLabel="Escolha a casa…"
          opcoes={candidatas.map((c) => ({ valor: c.id, rotulo: `Casa ${c.nome}` }))}
        />
      )}

      <AreaTexto
        rotulo={tipo === 'alianca' ? 'O que você propõe (a outra casa vai ler)' : 'Justificativa (a Corte vai ler)'}
        valor={v.motivo}
        aoMudar={set('motivo')}
        placeholder={tipo === 'alianca'
          ? 'Comércio, defesa mútua, casamento entre as linhagens…'
          : 'Por que a Corte deve deferir este pedido.'}
        maxLength={400}
      />
    </Modal>
  );
}

/* ------------------------------------------------------------ */
function FormIndicacao({ casa, civis, aoFechar, aoEnviar }) {
  const [v, setV] = useState({ nome: '', civil_id: '', id_jogo: '', raca: '', parentesco: '', justificativa: '' });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const vinculado = v.civil_id ? civis.find((c) => c.id === v.civil_id) : null;

  const enviar = async () => {
    setErro('');
    setOcupado(true);
    try {
      await aoEnviar(v);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível enviar o pedido.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={`Indicar novo membro — Casa ${casa.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            Vai para a Corte, não entra direto.
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado || !String(v.nome).trim()} onClick={enviar}>
            {ocupado ? 'Enviando…' : 'Enviar à Corte'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro">{erro}</div>}
      <SeletorCivil
        rotulo="Quem você quer trazer"
        valor={v.nome}
        aoMudar={(n) => setV((s) => ({ ...s, nome: n, civil_id: '', id_jogo: '' }))}
        aoEscolher={(c) => setV((s) => ({
          ...s, nome: c.nome, civil_id: c.id, id_jogo: c.id_jogo || '', raca: c.raca || s.raca,
        }))}
        civis={civis}
        vinculado={vinculado}
        aoDesvincular={() => setV((s) => ({ ...s, civil_id: '' }))}
        placeholder="Nome — busca no Registro Civil"
      />
      <Texto rotulo="Parentesco ou vínculo" valor={v.parentesco}
             aoMudar={(x) => setV((s) => ({ ...s, parentesco: x }))}
             placeholder="Filho mais velho, prima, afilhado, aliado de armas…" />
      <AreaTexto rotulo="Por que a Corte deve aceitar" valor={v.justificativa}
                 aoMudar={(x) => setV((s) => ({ ...s, justificativa: x }))}
                 placeholder="O que essa pessoa é da casa, o que ela traz para a dinastia…" />
    </Modal>
  );
}
