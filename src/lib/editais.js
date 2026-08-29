// ============================================================
//  EDITAIS E CONTRATOS — as regras de quem pode responder o quê
//
//  Um edital diz o que o Hold precisa e a quem se dirige. Este
//  arquivo é o porteiro: dado um edital e uma pessoa, ele responde
//  se ela entra, por qual porta (como trabalhador ou por um dos
//  comércios dela) e, quando não entra, **por quê** — a recusa sem
//  explicação é o que faz o jogador achar que o sistema quebrou.
//
//  Nada aqui grava nada. São contas sobre o que já existe: o
//  Registro Civil, os trabalhadores, as propriedades e as fichas
//  militares. Assim as regras valem igual na tela e no banco.
// ============================================================
import { NIVEL_VALOR, PRAZO_PESO, PROFISSOES } from './constants.js';
import { ehDonoDaPropriedade, ehFuncionario } from './db.js';

const norm = (s) => String(s || '').trim().toLowerCase();
const mesmo = (a, b) => norm(a) === norm(b) && norm(a) !== '';

/** Número de protocolo do próximo edital: EDT-001, EDT-002… */
export function proximoNumero(editais = []) {
  const maior = editais.reduce((m, e) => {
    const n = Number(String(e.numero || '').replace(/\D/g, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `EDT-${String(maior + 1).padStart(3, '0')}`;
}

/** O que a pessoa faz da vida, segundo os arquivos do Hold. */
export function trabalhoDe(sessao, d = {}) {
  const eu = (d.civis || []).find((c) => c.id === sessao?.civil_id) || null;
  // O registro de Trabalhadores é o oficial; a ficha civil serve de reserva.
  const ficha = (d.trabalhadores || []).find(
    (t) => (t.civil_id && t.civil_id === sessao?.civil_id) || (!t.civil_id && mesmo(t.nome, sessao?.nome)),
  ) || null;
  const profissao = ficha?.profissao || eu?.profissao || '';
  const nivel = ficha?.nivel || eu?.nivel || 'N/A';
  return profissao ? { profissao, nivel, oficial: Boolean(ficha) } : null;
}

/** A ficha militar da pessoa, quando existe — as perícias aferidas. */
export function militarDe(sessao, d = {}) {
  return (d.guardas || []).find(
    (g) => g.id === sessao?.guarda_id || (g.civil_id && g.civil_id === sessao?.civil_id) ||
           (g.id_jogo && mesmo(g.id_jogo, sessao?.id_jogo)),
  ) || null;
}

/**
 * As habilidades de uma pessoa, vindas das duas fontes que existem.
 *
 * A ficha civil guarda o que ela **declara** — qualquer morador pode
 * preencher, e é o que permite concorrer a um recrutamento ou oferecer
 * escolta sem passar pelo Quartel primeiro. A ficha militar guarda o que
 * o Quartel **aferiu**. Onde as duas falam, vale a do Quartel: contra a
 * aferição não adianta declarar.
 */
export function periciasDe(sessao, d = {}) {
  const eu = (d.civis || []).find((c) => c.id === sessao?.civil_id) || null;
  const militar = militarDe(sessao, d);
  const declaradas = eu?.pericias || {};
  const aferidas = militar?.pericias || {};
  const juntas = { ...declaradas };
  for (const [k, v] of Object.entries(aferidas)) {
    if (v && v !== 'N/A') juntas[k] = v;
  }
  return {
    pericias: juntas,
    declaradas,
    aferidas,
    temFicha: Boolean(militar),
    alguma: Object.values(juntas).some((v) => v && v !== 'N/A'),
  };
}

/** As profissões que um comércio consegue oferecer: as do dono e as da equipe. */
export function profissoesDaCasa(prop) {
  const lista = (prop?.funcionarios || []).map((f) => f.profissao).filter(Boolean);
  return [...new Set(lista)];
}

/** O melhor nível que a casa tem naquela profissão (ou no geral). */
function melhorNivelDaCasa(prop, profissoes = []) {
  const equipe = (prop?.funcionarios || [])
    .filter((f) => profissoes.length === 0 || profissoes.includes(f.profissao));
  return equipe.reduce((m, f) => Math.max(m, NIVEL_VALOR[f.nivel] || 0), 0);
}

/** Perícias que faltam para o exigido, com o que a pessoa tem hoje. */
export function periciasEmFalta(edital, pericias = {}) {
  return Object.entries(edital?.pericias_min || {})
    .filter(([, exigido]) => (NIVEL_VALOR[exigido] || 0) > 0)
    .map(([nome, exigido]) => ({
      nome, exigido, tem: pericias[nome] || 'N/A',
      falta: (NIVEL_VALOR[pericias[nome]] || 0) < (NIVEL_VALOR[exigido] || 0),
    }))
    .filter((x) => x.falta);
}

/** Os prazos que este edital aceita — nada mais lento que o teto dele. */
export const prazosAceitos = (edital) => Object.entries(PRAZO_PESO)
  .filter(([, peso]) => peso <= (PRAZO_PESO[edital?.prazo_max] || 3))
  .map(([nome]) => nome);

/**
 * O parecer sobre uma pessoa diante de um edital.
 *
 * Devolve as duas vias possíveis — a de trabalhador e a de cada
 * comércio dela — cada uma com `ok` e, quando falso, o motivo em
 * palavras que o jogador entende.
 */
export function elegibilidade(edital, sessao, d = {}) {
  const aceita = edital?.aceita || [];
  const profissoes = (edital?.profissoes || []).filter(Boolean);
  const minimo = NIVEL_VALOR[edital?.nivel_minimo] || 0;

  const jaEnviou = (d.propostas || []).find(
    (p) => p.edital_id === edital?.id && p.candidato_civil_id === sessao?.civil_id,
  ) || null;

  const trabalho = trabalhoDe(sessao, d);
  // Habilidade sai da ficha da pessoa: o que ela declarou em Minha ficha,
  // com o que o Quartel aferiu por cima. Assim a inscrição num recrutamento
  // é automática — quem tem, concorre; quem não tem, sabe o que preencher.
  const ficha = periciasDe(sessao, d);
  const pericias = ficha.pericias;

  const viaTrabalhador = (() => {
    if (!aceita.includes('trabalhador')) {
      return { permitido: false, ok: false, motivo: 'Este edital é só para comércios.' };
    }
    if (!trabalho) {
      return { permitido: true, ok: false,
        motivo: 'Você ainda não tem profissão no Registro Civil. Preencha a sua ficha antes de concorrer.' };
    }
    if (profissoes.length && !profissoes.includes(trabalho.profissao)) {
      return { permitido: true, ok: false,
        motivo: `O edital pede ${profissoes.join(', ')} — sua profissão é ${trabalho.profissao}.` };
    }
    if ((NIVEL_VALOR[trabalho.nivel] || 0) < minimo) {
      return { permitido: true, ok: false,
        motivo: `O edital pede nível ${edital.nivel_minimo} ou acima — o seu é ${trabalho.nivel}.` };
    }
    const faltam = periciasEmFalta(edital, pericias);
    if (faltam.length) {
      if (!ficha.alguma) {
        return { permitido: true, ok: false,
          motivo: 'Você ainda não registrou habilidades. Preencha o quadro de habilidades em '
            + 'Minha ficha e a sua inscrição passa a valer automaticamente.' };
      }
      return { permitido: true, ok: false,
        motivo: `Suas habilidades não alcançam: ${faltam.map((f) => `${f.nome} ${f.exigido} (você tem ${f.tem})`).join(', ')}.` };
    }
    return { permitido: true, ok: true, motivo: '', trabalho };
  })();

  // As casas dela, uma a uma. Cada uma entra ou fica de fora por conta própria.
  const minhas = (d.propriedades || []).filter(
    (p) => ehDonoDaPropriedade(sessao, p) || ehFuncionario(sessao, p),
  );
  const viaPropriedades = !aceita.includes('propriedade') ? [] : minhas.map((prop) => {
    if (edital.propriedade_id && edital.propriedade_id === prop.id) {
      return { prop, ok: false, motivo: 'A casa que abriu o edital não concorre nele.' };
    }
    if (prop.status === 'Interditada' || prop.status === 'Arruinada') {
      return { prop, ok: false, motivo: `${prop.nome} está ${String(prop.status).toLowerCase()} e não pode assumir contratos.` };
    }
    const daCasa = profissoesDaCasa(prop);
    if (profissoes.length && !profissoes.some((x) => daCasa.includes(x))) {
      return { prop, ok: false,
        motivo: `${prop.nome} não tem ninguém de ${profissoes.join(', ')} na equipe.` };
    }
    if (minimo > 0 && melhorNivelDaCasa(prop, profissoes) < minimo) {
      return { prop, ok: false,
        motivo: `A equipe de ${prop.nome} não alcança o nível ${edital.nivel_minimo}.` };
    }
    return { prop, ok: true, motivo: '' };
  });

  const semCasa = aceita.includes('propriedade') && minhas.length === 0
    ? 'Você não responde por nenhuma propriedade — este edital é para comércios.'
    : '';

  const aberto = edital?.status === 'Aberto';
  const proprio = ehOrgaoDoEdital(edital, sessao, d);

  return {
    aberto,
    proprio,
    jaEnviou,
    trabalhador: viaTrabalhador,
    propriedades: viaPropriedades,
    semCasa,
    pericias,
    ficha,
    periciasAferidas: ficha.temFicha,
    pode: aberto && !proprio && !jaEnviou &&
      (viaTrabalhador.ok || viaPropriedades.some((x) => x.ok)),
  };
}

/** Esta pessoa está do lado de quem abriu o edital? */
export function ehOrgaoDoEdital(edital, sessao, d = {}) {
  if (!edital || !sessao) return false;
  if (sessao.tipo === 'corte') return edital.orgao_tipo === 'corte';
  if (sessao.tipo === 'soldado') return edital.orgao_tipo === 'quartel';
  if (edital.orgao_tipo !== 'propriedade') return false;
  const prop = (d.propriedades || []).find((p) => p.id === edital.propriedade_id);
  return Boolean(prop) && (ehDonoDaPropriedade(sessao, prop) || ehFuncionario(sessao, prop));
}

/** Os editais que esta pessoa administra (é o órgão que os abriu). */
export const meusEditais = (sessao, d = {}) =>
  (d.editais || []).filter((e) => ehOrgaoDoEdital(e, sessao, d));

/** Uma linha curta com o objeto do edital, para listas e avisos. */
export function objetoDoEdital(edital) {
  if (!edital) return '';
  if (edital.tipo === 'Fornecimento') {
    const itens = (edital.itens || []).filter((i) => i.nome);
    if (!itens.length) return edital.titulo || '';
    return itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ');
  }
  if (edital.tipo === 'Recrutamento') {
    const v = Number(edital.vagas) || 0;
    return v ? `${v} vaga${v === 1 ? '' : 's'}` : edital.titulo || '';
  }
  return edital.titulo || '';
}

/** Profissões oferecidas nos filtros: as do Hold, mais as já usadas. */
export const profissoesConhecidas = (d = {}) => [...new Set([
  ...PROFISSOES,
  ...(d.trabalhadores || []).map((t) => t.profissao).filter(Boolean),
])].sort((a, b) => a.localeCompare(b));
