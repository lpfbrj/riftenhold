// ============================================================
//  CASAS NOBRES — o que se deriva dos pedidos
//
//  A regra da casa é a mesma do resto do Hold: não duplicar o que
//  já está gravado em outro lugar. Quem é nobre sai dos pedidos
//  deferidos; a aliança entre duas casas sai do pedido de aliança
//  deferido; a mesnada e o herdeiro moram na própria casa, porque
//  são coisas que o Patriarca administra depois de autorizado.
// ============================================================
import {
  PEDIDO_CASA_POR_ID, TAXA_DE, MAX_LEMA, SITUACOES_CASA,
} from './constants.js';

const norm = (s) => String(s || '').trim().toLowerCase();
export const septims = (n) => `${Number(n || 0).toLocaleString('pt-BR')} Septims`;

/** A taxa de um tipo de pedido, já escrita. */
export const taxaTexto = (tipo) => septims(TAXA_DE(tipo));

/** O rótulo humano de um pedido. */
export const nomeDoPedido = (tipo) => PEDIDO_CASA_POR_ID[tipo]?.nome || tipo;

/* ============================================================
   Propriedades — a porta de entrada da nobreza
   ============================================================ */

/**
 * As propriedades registradas no nome de alguém. É o que abre o
 * direito de pedir nobreza, e é de onde sai a sede da casa.
 */
export function propriedadesDe(pessoa, propriedades = []) {
  if (!pessoa) return [];
  const id = pessoa.civil_id || pessoa.id;
  const nome = norm(pessoa.nome);
  return propriedades.filter(
    (p) => (p.proprietario_civil_id && id && p.proprietario_civil_id === id) ||
           // Sem vínculo de um lado ou do outro, o nome é o que resta.
           ((!p.proprietario_civil_id || !id) && nome && norm(p.proprietario) === nome),
  );
}

/* ============================================================
   Pedidos
   ============================================================ */

const doTipo = (pedidos, tipo) => (pedidos || []).filter((x) => x.tipo === tipo);

/** Os pedidos abertos por uma pessoa, do mais novo para o mais velho. */
export function pedidosDe(pessoa, pedidos = []) {
  const id = pessoa?.civil_id || pessoa?.id;
  const nome = norm(pessoa?.nome);
  return (pedidos || [])
    .filter((x) => (x.civil_id && id && x.civil_id === id) ||
                   (!x.civil_id && nome && norm(x.pedido_por) === nome))
    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
}

/** Os pedidos de uma casa — os que ela abriu e os que ela recebeu. */
export function pedidosDaCasa(cla, pedidos = []) {
  if (!cla?.id) return [];
  return (pedidos || [])
    .filter((x) => x.cla_id === cla.id || x.alvo_cla_id === cla.id)
    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
}

/** Pedidos parados na mesa da Corte. */
export const pedidosNaCorte = (pedidos = []) => (pedidos || [])
  .filter((x) => x.status === 'Pendente')
  .sort((a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0));

/** Já existe pedido em pé deste tipo? Serve para não pedir duas vezes. */
export function temPedidoAberto(pedidos = [], tipo, cla_id = null) {
  return (pedidos || []).some(
    (x) => x.tipo === tipo &&
      (x.status === 'Pendente' || x.status === 'Aguardando casa') &&
      (!cla_id || x.cla_id === cla_id),
  );
}

/* ============================================================
   Nobreza de uma pessoa
   ============================================================ */

/**
 * A situação do civil diante da Corte quanto ao título de nobreza.
 *
 * @returns {{
 *   temPropriedade: boolean, propriedades: Array, status: string,
 *   nobre: boolean, pendente: boolean, negado: boolean,
 *   podePedir: boolean, parecer: string, motivo: string, pedido: object|null
 * }}
 */
export function nobrezaDoCivil(pessoa, { pedidos = [], propriedades = [] } = {}) {
  const minhas = propriedadesDe(pessoa, propriedades);
  const meus = doTipo(pedidosDe(pessoa, pedidos), 'nobreza');
  const deferido = meus.find((x) => x.status === 'Deferido') || null;
  const pendente = meus.find((x) => x.status === 'Pendente') || null;
  const ultimo = deferido || pendente || meus[0] || null;
  const status = deferido ? 'Deferido' : pendente ? 'Pendente' : (ultimo?.status || 'Não pedida');
  return {
    propriedades: minhas,
    temPropriedade: minhas.length > 0,
    status,
    nobre: Boolean(deferido),
    pendente: Boolean(pendente),
    negado: status === 'Indeferido',
    podePedir: minhas.length > 0 && !deferido && !pendente,
    parecer: ultimo?.parecer || '',
    motivo: ultimo?.motivo || '',
    pedido: ultimo,
  };
}

/* ============================================================
   A casa
   ============================================================ */

/** Casas que a Corte já reconheceu — as únicas que valem lá fora. */
export const casasAprovadas = (clas = []) =>
  (clas || []).filter((c) => (c.situacao || 'Aprovada') === 'Aprovada');

/** A casa que a pessoa fundou, aprovada ou ainda esperando. */
export function casaFundadaPor(pessoa, clas = []) {
  const id = pessoa?.civil_id || pessoa?.id;
  const nome = norm(pessoa?.nome);
  return (clas || []).find(
    (c) => (c.lider_civil_id && id && c.lider_civil_id === id) ||
           (!c.lider_civil_id && nome && norm(c.lider) === nome),
  ) || null;
}

/** O lema, cortado no tamanho que cabe no estandarte. */
export const limparLema = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEMA);

/** A casa tem direito a homens de armas? */
export const temMesnada = (cla) => Boolean(cla?.mesnada_em);

/** O herdeiro registrado, se houver. */
export const herdeiroDe = (cla) => (cla?.herdeiro?.nome ? cla.herdeiro : null);

/** A sede principal da casa, buscada na lista de propriedades. */
export function sedeDe(cla, propriedades = []) {
  if (!cla) return null;
  const p = (propriedades || []).find((x) => x.id === cla.sede_propriedade_id);
  if (p) return p;
  return cla.sede_nome ? { nome: cla.sede_nome, tipo: cla.sede_tipo || '', local: '' } : null;
}

/* ============================================================
   Alianças
   ============================================================ */

/**
 * As alianças em vigor de uma casa: pedidos de aliança deferidos
 * pela Corte, em qualquer das duas pontas.
 *
 * @returns {Array<{cla_id, nome, cor, desde, pedido_id}>}
 */
export function aliancasDe(cla, pedidos = [], clas = []) {
  if (!cla?.id) return [];
  const casa = (id) => (clas || []).find((c) => c.id === id) || null;
  const vistas = new Set();
  const linhas = [];
  for (const x of doTipo(pedidos, 'alianca')) {
    if (x.status !== 'Deferido') continue;
    const outra = x.cla_id === cla.id ? x.alvo_cla_id
      : x.alvo_cla_id === cla.id ? x.cla_id
      : null;
    if (!outra || vistas.has(outra)) continue;
    vistas.add(outra);
    const c = casa(outra);
    // Sem a linha da casa, vale o nome guardado da ponta certa.
    const guardado = outra === x.alvo_cla_id ? x.alvo_cla_nome : x.cla_nome;
    linhas.push({
      cla_id: outra,
      nome: c?.nome || guardado || 'Casa desconhecida',
      cor: c?.cor || '#7c6bb0',
      desde: x.avaliado_em || x.criado_em || '',
      pedido_id: x.id,
    });
  }
  return linhas.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

/** Todas as alianças do Hold, para a Corte ver de cima. */
export function todasAsAliancas(pedidos = [], clas = []) {
  const nome = (id) => (clas || []).find((c) => c.id === id)?.nome || '—';
  return doTipo(pedidos, 'alianca')
    .filter((x) => x.status === 'Deferido')
    .map((x) => ({
      id: x.id,
      casas: [nome(x.cla_id), nome(x.alvo_cla_id)],
      desde: x.avaliado_em || x.criado_em || '',
    }))
    .sort((a, b) => a.casas[0].localeCompare(b.casas[0]));
}

/** Duas casas já são aliadas? Evita pedido repetido. */
export const jaSaoAliadas = (a, b, pedidos = []) =>
  doTipo(pedidos, 'alianca').some(
    (x) => x.status === 'Deferido' &&
      ((x.cla_id === a && x.alvo_cla_id === b) || (x.cla_id === b && x.alvo_cla_id === a)),
  );

/* ============================================================
   Validação, num lugar só
   ============================================================ */

/**
 * Diz se um pedido pode ser aberto agora — a mesma resposta que o
 * botão da tela e a camada de dados usam, para não divergirem.
 *
 * @returns {{pode:boolean, motivo:string}}
 */
export function podeAbrirPedido(tipo, { cla = null, civil = null, propriedades = [], pedidos = [], alvo = null } = {}) {
  const nao = (motivo) => ({ pode: false, motivo });
  const sim = { pode: true, motivo: '' };

  if (!PEDIDO_CASA_POR_ID[tipo]) return nao('Tipo de pedido desconhecido.');

  if (tipo === 'nobreza') {
    const n = nobrezaDoCivil(civil, { pedidos, propriedades });
    if (n.nobre) return nao('Você já tem o título de nobreza.');
    if (n.pendente) return nao('Já há um pedido de nobreza seu na mesa da Corte.');
    if (!n.temPropriedade) return nao('É preciso ter ao menos uma propriedade registrada em seu nome.');
    return sim;
  }

  // Daqui para baixo tudo depende de uma casa reconhecida.
  if (!cla) return nao('É preciso ter uma casa.');
  if ((cla.situacao || 'Aprovada') !== 'Aprovada') {
    return nao('A casa ainda aguarda o reconhecimento da Corte.');
  }
  if (temPedidoAberto(pedidos, tipo, cla.id)) {
    return nao('Já há um pedido deste tipo em andamento.');
  }

  if (tipo === 'mesnada' && temMesnada(cla)) return nao('A casa já tem mesnada registrada.');

  if (tipo === 'sede') {
    const minhas = propriedadesDe({ civil_id: cla.lider_civil_id, nome: cla.lider }, propriedades);
    if (minhas.length < 2) {
      return nao('Só se muda a sede quem tem mais de uma propriedade registrada.');
    }
  }

  if (tipo === 'alianca') {
    if (!alvo?.id) return nao('Escolha a casa com quem quer se aliar.');
    if (alvo.id === cla.id) return nao('Uma casa não se alia a si mesma.');
    if ((alvo.situacao || 'Aprovada') !== 'Aprovada') return nao('A outra casa ainda não foi reconhecida.');
    if (jaSaoAliadas(cla.id, alvo.id, pedidos)) return nao(`A casa ${alvo.nome} já é aliada.`);
    const emCurso = doTipo(pedidos, 'alianca').some(
      (x) => (x.status === 'Pendente' || x.status === 'Aguardando casa') &&
        ((x.cla_id === cla.id && x.alvo_cla_id === alvo.id) ||
         (x.cla_id === alvo.id && x.alvo_cla_id === cla.id)),
    );
    if (emCurso) return nao(`Já há uma proposta em curso com a casa ${alvo.nome}.`);
  }

  return sim;
}

/* ============================================================
   O efeito do julgamento
   ============================================================ */

/**
 * O que muda na casa quando a Corte julga um pedido.
 *
 * Devolve a casa já corrigida, ou `null` quando o julgamento não
 * mexe em casa nenhuma — é o caso do título de nobreza e da
 * aliança, que se leem dos próprios pedidos.
 *
 * @param {object} pedido  a linha de pedidos_casa
 * @param {object} cla     a casa a que o pedido se refere
 * @param {boolean} deferido
 */
export function aplicarPedido(pedido, cla, deferido, quem = 'Corte de Riften') {
  if (!pedido) return null;
  const agora = new Date().toISOString();
  const d = pedido.dados || {};

  if (pedido.tipo === 'fundacao') {
    if (!cla) return null;
    return deferido
      ? { ...cla, situacao: 'Aprovada', fundada_em: agora, reconhecida_por: quem }
      : { ...cla, situacao: 'Recusada' };
  }

  if (!deferido || !cla) return null;

  switch (pedido.tipo) {
    case 'insignia':
      return {
        ...cla,
        // Tirar o brasão é gravar `null` — e `null` é resposta, não ausência.
        brasao: 'brasao' in d ? d.brasao : (cla.brasao ?? null),
        cor: d.cor || cla.cor,
        lema: limparLema(d.lema ?? cla.lema),
      };
    case 'herdeiro':
      return {
        ...cla,
        herdeiro: {
          nome: d.nome || '',
          civil_id: d.civil_id || '',
          id_jogo: d.id_jogo || '',
          raca: d.raca || '',
          parentesco: d.parentesco || '',
          registrado_em: agora,
        },
      };
    case 'mesnada':
      return { ...cla, mesnada_em: agora, soldados: cla.soldados || [] };
    case 'sede':
      return {
        ...cla,
        sede_propriedade_id: d.sede_propriedade_id || cla.sede_propriedade_id,
        sede_nome: d.sede_nome || cla.sede_nome,
        sede_tipo: d.sede_tipo || '',
      };
    default:
      return null;
  }
}

/** Uma linha de resumo do pedido, para a Corte ler sem abrir nada. */
export function resumoDoPedido(pedido, clas = []) {
  const d = pedido?.dados || {};
  switch (pedido?.tipo) {
    case 'nobreza': {
      const n = (d.propriedades || []).length;
      return n ? `${n} propriedade${n === 1 ? '' : 's'} em seu nome` : 'Sem propriedade declarada';
    }
    case 'fundacao':
      return `Sede: ${d.sede || '—'}${d.lema ? ` · “${d.lema}”` : ''}`;
    case 'insignia':
      return d.lema ? `Novo lema: “${d.lema}”` : 'Novo brasão da casa';
    case 'herdeiro':
      return `${d.nome || '—'}${d.parentesco ? ` · ${d.parentesco}` : ''}`;
    case 'mesnada':
      return 'Homens de armas sob a bandeira da casa';
    case 'sede':
      return `Nova sede: ${d.sede_nome || '—'}`;
    case 'alianca': {
      const nome = (id) => (clas || []).find((c) => c.id === id)?.nome;
      return `${nome(pedido.cla_id) || pedido.cla_nome} ⟷ ${nome(pedido.alvo_cla_id) || pedido.alvo_cla_nome}`;
    }
    default:
      return '';
  }
}

export { SITUACOES_CASA };
