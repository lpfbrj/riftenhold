// ============================================================
//  FORÇAS DE RIFTEN
//
//  Tudo o que as telas precisam saber sobre a tropa é derivado
//  aqui — nada de repetir contagem em cada painel.
//
//  São três forças e elas somam:
//    Exército  → tabela `guardas`, repartida pelas `divisoes`
//    Mesnadas  → `clas.soldados` das casas com mesnada concedida
//    Milícia   → tabela `milicia`, convocada por uma `campanha`
//
//  Divisões e patentes são editáveis pela Corte e vivem em tabelas
//  próprias. Aqui não há semente de reserva: tabela vazia é tabela
//  vazia, e a tela mostra o vazio. Fingir que as divisões do
//  primeiro dia ainda existem faria a tela oferecer botões que
//  gravariam registros fantasma.
// ============================================================
import { SALARIO_PADRAO, CICLO_SALARIO, STATUS_MILITAR } from './constants.js';

const norm = (s) => String(s || '').trim().toLowerCase();
const num = (v, padrao = 0) => (Number.isFinite(Number(v)) ? Number(v) : padrao);

/* ============================================================
   Divisões
   ============================================================ */

/** Todas as divisões cadastradas, na ordem da Corte. */
export function todasAsDivisoes(divisoes = []) {
  return [...(divisoes || [])].sort(
    (a, b) => num(a.ordem) - num(b.ordem) || String(a.nome || '').localeCompare(String(b.nome || '')),
  );
}

/** Só as que estão de pé — é nelas que se aloca soldado. */
export const divisoesAtivas = (divisoes = []) =>
  todasAsDivisoes(divisoes).filter((d) => d.ativa !== false);

/**
 * A divisão de um soldado. O vínculo forte é o `divisao_id`; o nome
 * só vale para as fichas antigas, gravadas antes de a divisão virar
 * registro próprio.
 */
export function divisaoDe(guarda, divisoes = []) {
  if (!guarda) return null;
  const lista = todasAsDivisoes(divisoes);
  if (guarda.divisao_id) return lista.find((d) => d.id === guarda.divisao_id) || null;
  if (!guarda.divisao) return null;
  return lista.find((d) => norm(d.nome) === norm(guarda.divisao)) || null;
}

/** O nome que a tela mostra — mesmo quando a divisão foi dissolvida. */
export const nomeDaDivisao = (guarda, divisoes = []) =>
  divisaoDe(guarda, divisoes)?.nome || guarda?.divisao || '';

/** Quem serve nesta divisão. */
export const efetivoDaDivisao = (divisao, guardas = [], divisoes = []) =>
  (guardas || []).filter((g) => divisaoDe(g, divisoes)?.id === divisao?.id);

/** Quantos estão prontos para escala nesta divisão. */
export const operantesDaDivisao = (divisao, guardas = [], divisoes = []) =>
  efetivoDaDivisao(divisao, guardas, divisoes).filter((g) => g.status === 'Operante');

/**
 * O capitão da divisão. A Corte aponta pelo id da ficha militar;
 * se a ficha sumiu, ainda resta o nome que ficou gravado.
 */
export function capitaoDa(divisao, guardas = []) {
  if (!divisao) return null;
  if (divisao.capitao_id) {
    const achado = (guardas || []).find((g) => g.id === divisao.capitao_id);
    if (achado) return achado;
  }
  if (!divisao.capitao) return null;
  return (guardas || []).find((g) => norm(g.nome) === norm(divisao.capitao))
    || { nome: divisao.capitao, avulso: true };
}

/** Nome disponível? Duas divisões com o mesmo nome confundem a escala. */
export const nomeDivisaoLivre = (nome, divisoes = [], exceto = null) =>
  !(divisoes || []).some((d) => d.id !== exceto && norm(d.nome) === norm(nome));

/* ============================================================
   Patentes — a hierarquia
   ============================================================ */

/** Da mais alta para a mais baixa: é assim que a hierarquia se lê. */
export function hierarquia(patentes = []) {
  return [...(patentes || [])].sort(
    (a, b) => num(b.ordem) - num(a.ordem) || String(a.nome || '').localeCompare(String(b.nome || '')),
  );
}

/** Da base ao topo — a ordem de quem sobe de posto. */
export const escadaDePatentes = (patentes = []) => [...hierarquia(patentes)].reverse();

/** Só as patentes em uso. */
export const patentesAtivas = (patentes = []) =>
  hierarquia(patentes).filter((p) => p.ativa !== false);

/** A patente de uma ficha, pelo id gravado ou pelo nome. */
export function patenteDe(pessoa, patentes = []) {
  if (!pessoa) return null;
  const lista = hierarquia(patentes);
  if (pessoa.patente_id) {
    const achada = lista.find((p) => p.id === pessoa.patente_id);
    if (achada) return achada;
  }
  if (!pessoa.patente) return null;
  return lista.find((p) => norm(p.nome) === norm(pessoa.patente)) || null;
}

export const nomeDaPatente = (pessoa, patentes = []) =>
  patenteDe(pessoa, patentes)?.nome || pessoa?.patente || '';

/** O peso da patente — usado para ordenar a tropa do topo para a base. */
export const pesoDaPatente = (pessoa, patentes = []) => num(patenteDe(pessoa, patentes)?.ordem, 0);

/** Quantos soldados usam esta patente. */
export const efetivoDaPatente = (patente, guardas = [], patentes = []) =>
  (guardas || []).filter((g) => patenteDe(g, patentes)?.id === patente?.id);

export const nomePatenteLivre = (nome, patentes = [], exceto = null) =>
  !(patentes || []).some((p) => p.id !== exceto && norm(p.nome) === norm(nome));

/** A tropa ordenada como se lê num rol: patente alta primeiro, depois nome. */
export const ordenarTropa = (guardas = [], patentes = []) =>
  [...(guardas || [])].sort(
    (a, b) => pesoDaPatente(b, patentes) - pesoDaPatente(a, patentes) ||
              String(a.nome || '').localeCompare(String(b.nome || '')),
  );

/* ============================================================
   Mesnadas — a tropa das casas nobres
   ============================================================ */

/** A casa tem mesnada concedida pela Corte? */
export const casaComMesnada = (cla) =>
  Boolean(cla?.mesnada_em) && (cla?.situacao || 'Aprovada') === 'Aprovada';

/** O nome da mesnada — a casa batiza; se não batizou, a Corte a chama pela casa. */
export const nomeDaMesnada = (cla) =>
  String(cla?.mesnada_nome || '').trim() || `Mesnada da Casa ${cla?.nome || ''}`.trim();

/**
 * Uma linha por mesnada do Hold, já com a tropa contada.
 * @returns {Array<{id, nome, casa, casa_id, cor, soldados, efetivo}>}
 */
export function mesnadasDoHold(clas = []) {
  return (clas || [])
    .filter(casaComMesnada)
    .map((c) => {
      const soldados = (c.soldados || []).filter((s) => String(s?.nome || '').trim());
      return {
        id: c.id,
        casa_id: c.id,
        casa: c.nome || '',
        nome: nomeDaMesnada(c),
        cor: c.cor || '#9384d1',
        soldados,
        efetivo: soldados.length,
      };
    })
    .sort((a, b) => b.efetivo - a.efetivo || a.nome.localeCompare(b.nome));
}

/* ============================================================
   Milícia — o chamado
   ============================================================ */

export const miliciaViva = (milicia = []) =>
  (milicia || []).filter((m) => (m.situacao || 'Disponível') !== 'Dispensado');

export const miliciaDisponivel = (milicia = []) =>
  (milicia || []).filter((m) => (m.situacao || 'Disponível') === 'Disponível');

export const miliciaConvocada = (milicia = []) =>
  (milicia || []).filter((m) => m.situacao === 'Convocado');

/** A campanha aberta — só existe uma de cada vez em pé. */
export const campanhaAberta = (campanhas = []) =>
  (campanhas || []).find((c) => c.status === 'Em campanha')
  || (campanhas || []).find((c) => (c.status || 'Preparação') === 'Preparação')
  || null;

export const campanhasEncerradas = (campanhas = []) =>
  (campanhas || []).filter((c) => c.status === 'Encerrada');

/** Os convocados de uma campanha. */
export const convocadosDa = (campanha, milicia = []) =>
  (milicia || []).filter((m) => m.campanha_id && m.campanha_id === campanha?.id);

/** Esta pessoa já está na lista da milícia? */
export function naMilicia(pessoa, milicia = []) {
  if (!pessoa) return null;
  const id = pessoa.civil_id || pessoa.id;
  return (milicia || []).find(
    (m) => (m.civil_id && id && m.civil_id === id) ||
           (!m.civil_id && norm(m.nome) === norm(pessoa.nome)),
  ) || null;
}

/* ============================================================
   A soma — o que a Corte quer ver de uma vez
   ============================================================ */

/**
 * O poderio do Hold, força por força.
 * `prontos` é quem de fato pode marchar hoje: soldado operante,
 * homem de armas da casa e miliciano convocado.
 */
export function resumoDasForcas({ guardas = [], clas = [], milicia = [] } = {}) {
  const todos = guardas || [];
  // Aposentado é registro, não força: entra no rol, não na conta de
  // quem o Hold pode pôr em campo.
  const tropa = todos.filter((g) => g.status !== 'Aposentado');
  const operantes = tropa.filter((g) => g.status === 'Operante');
  const mesnadas = mesnadasDoHold(clas);
  const homensDeArmas = mesnadas.reduce((s, m) => s + m.efetivo, 0);
  const convocados = miliciaConvocada(milicia);
  const voluntarios = miliciaViva(milicia);

  const exercito = { total: tropa.length, prontos: operantes.length };
  const forcaMesnadas = { total: homensDeArmas, prontos: homensDeArmas, casas: mesnadas.length };
  const forcaMilicia = { total: voluntarios.length, prontos: convocados.length };

  return {
    exercito,
    mesnadas: forcaMesnadas,
    milicia: forcaMilicia,
    listaMesnadas: mesnadas,
    total: exercito.total + forcaMesnadas.total + forcaMilicia.total,
    prontos: exercito.prontos + forcaMesnadas.prontos + forcaMilicia.prontos,
    registro: todos.length,
    porStatus: Object.fromEntries(
      STATUS_MILITAR.map((s) => [s, todos.filter((g) => g.status === s).length]),
    ),
  };
}

/* ============================================================
   Datas e soldo
   ============================================================ */

const DIA = 24 * 60 * 60 * 1000;

/** Meia-noite: o soldo se conta em dias, não em horas. */
function diaDe(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const hoje = () => diaDe(new Date());

/**
 * Soma dias no calendário, não em milissegundos: onde há horário de
 * verão, uma semana chega a ter 167 ou 169 horas, e somar 7×24h
 * devolveria o dia anterior.
 */
export function somarDias(valor, dias) {
  const d = diaDe(valor);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

/** Quantos dias faltam (negativo quando já passou). */
export function diasAte(valor) {
  const d = diaDe(valor);
  if (!d) return null;
  return Math.round((d.getTime() - hoje().getTime()) / DIA);
}

/** 25/08/2026 — do jeito que a Corte escreve. */
export function dataBR(valor) {
  const d = diaDe(valor);
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** O soldo semanal de uma ficha: o dela, se a Corte arbitrou; senão o da patente. */
export function salarioDe(pessoa, patentes = []) {
  const proprio = pessoa?.salario;
  if (proprio !== undefined && proprio !== null && String(proprio) !== '') {
    return Math.max(0, num(proprio, 0));
  }
  const patente = patenteDe(pessoa, patentes);
  if (patente && patente.salario !== undefined && patente.salario !== null && String(patente.salario) !== '') {
    return Math.max(0, num(patente.salario, SALARIO_PADRAO));
  }
  return SALARIO_PADRAO;
}

/**
 * A situação do pagamento de uma ficha.
 *
 * Pagou dia 25/08 → o próximo cai em 01/09, e até lá não se paga
 * de novo. `dias` conta quanto falta; negativo é atraso.
 *
 * @returns {{valor:number, pagoEm:string|null, proximo:Date|null,
 *            dias:number|null, vencido:boolean, nunca:boolean}}
 */
export function soldoDe(pessoa, patentes = []) {
  const valor = salarioDe(pessoa, patentes);
  const bruto = pessoa?.pago_em || null;
  // Data ilegível, ou no futuro (relógio errado, importação torta):
  // vale como se nunca tivesse sido pago. Do contrário o soldado
  // ficaria "em dia" para sempre, sem a Corte poder corrigir.
  const legivel = bruto && diaDe(bruto) ? bruto : null;
  const pagoEm = legivel && diasAte(legivel) <= 0 ? legivel : null;
  const proximo = pagoEm ? somarDias(pagoEm, CICLO_SALARIO) : null;
  const dias = proximo ? diasAte(proximo) : null;
  return {
    valor,
    pagoEm,
    proximo,
    dias,
    vencido: !pagoEm || dias <= 0,
    nunca: !pagoEm,
    // A Corte precisa saber que havia uma data e ela não presta.
    dataInvalida: Boolean(bruto) && !pagoEm,
  };
}

/** Quem entra na folha do Hold: a tropa que não está aposentada. */
export const naFolha = (guardas = []) => (guardas || []).filter((g) => g.status !== 'Aposentado');

/**
 * A folha da semana, já ordenada por quem está mais atrasado.
 * @returns {{linhas:Array, semanal:number, aPagar:number, vencidos:number}}
 */
export function folhaDoHold(guardas = [], patentes = []) {
  const linhas = naFolha(guardas)
    .map((g) => ({ ficha: g, ...soldoDe(g, patentes) }))
    .sort((a, b) => {
      const da = a.dias === null ? -9999 : a.dias;
      const db = b.dias === null ? -9999 : b.dias;
      return da - db || String(a.ficha.nome || '').localeCompare(String(b.ficha.nome || ''));
    });
  const vencidas = linhas.filter((l) => l.vencido);
  return {
    linhas,
    semanal: linhas.reduce((s, l) => s + l.valor, 0),
    aPagar: vencidas.reduce((s, l) => s + l.valor, 0),
    vencidos: vencidas.length,
  };
}

export const septims = (n) => `${Number(n || 0).toLocaleString('pt-BR')} Septims`;

/* ============================================================
   Comando, Permissões e Administração do Quartel
   ============================================================ */

/**
 * Encontra a ficha militar de um usuário logado (seja civil_id, guarda_id ou id_jogo).
 */
export function fichaMilitarDe(usuario, guardas = []) {
  if (!usuario) return null;
  const idJogo = norm(usuario.id_jogo);
  const civilId = usuario.civil_id;
  const guardaId = usuario.guarda_id;
  const nome = norm(usuario.nome);

  return (guardas || []).find((g) => (
    (guardaId && g.id === guardaId) ||
    (civilId && g.civil_id && g.civil_id === civilId) ||
    (idJogo && g.id_jogo && norm(g.id_jogo) === idJogo) ||
    (nome && norm(g.nome) === nome)
  )) || null;
}

/**
 * Verifica se o usuário é o Lorde Comandante do Hold (ou membro da Corte / Jarl).
 * O cargo "lorde_comandante" na tabela `corte` define quem comanda.
 */
export function ehLordeComandante(usuario, { corte = [], guardas = [], patentes = [] } = {}) {
  if (!usuario) return false;
  if (usuario.tipo === 'corte') return true;
  if (norm(usuario.cargo) === 'lorde comandante' || norm(usuario.papel) === 'jarl') return true;

  const cargoComandante = (corte || []).find((c) => (c.cargo_id || c.id) === 'lorde_comandante');
  if (cargoComandante?.nome) {
    if (usuario.civil_id && cargoComandante.civil_id && usuario.civil_id === cargoComandante.civil_id) return true;
    if (usuario.id_jogo && cargoComandante.id_jogo && norm(usuario.id_jogo) === norm(cargoComandante.id_jogo)) return true;
    if (usuario.nome && norm(usuario.nome) === norm(cargoComandante.nome)) return true;
  }

  const ficha = fichaMilitarDe(usuario, guardas);
  if (ficha) {
    if (norm(ficha.patente) === 'comandante' || ficha.patente_id === 'pat-comandante') return true;
    if (cargoComandante?.nome && norm(ficha.nome) === norm(cargoComandante.nome)) return true;
  }

  return false;
}

/**
 * Verifica se o usuário é Capitão de uma divisão específica.
 * Lorde Comandante também possui autoridade de comando geral.
 */
export function ehCapitaoDaDivisao(usuario, divisao, { guardas = [], corte = [], patentes = [] } = {}) {
  if (!usuario || !divisao) return false;
  if (ehLordeComandante(usuario, { corte, guardas, patentes })) return true;

  const ficha = fichaMilitarDe(usuario, guardas);
  const capId = divisao.capitao_id;
  const capNome = norm(divisao.capitao);

  if (ficha) {
    if (capId && (ficha.id === capId || ficha.civil_id === capId)) return true;
    if (capNome && norm(ficha.nome) === capNome) return true;
  }

  if (capId && (usuario.guarda_id === capId || usuario.civil_id === capId)) return true;
  if (capNome && usuario.nome && norm(usuario.nome) === capNome) return true;

  return false;
}

/**
 * Divisões que o usuário administra (como Capitão ou Lorde Comandante).
 */
export function divisoesQueComanda(usuario, { divisoes = [], guardas = [], corte = [], patentes = [] } = {}) {
  const ativas = divisoesAtivas(divisoes);
  if (ehLordeComandante(usuario, { corte, guardas, patentes })) return ativas;
  return ativas.filter((d) => ehCapitaoDaDivisao(usuario, d, { guardas, corte, patentes }));
}

/** Só o Palácio ou o Lorde Comandante pode criar nova divisão. */
export const podeCriarDivisao = (usuario, d = {}) => ehLordeComandante(usuario, d);

/** Só o Palácio ou o Lorde Comandante pode dissolver divisão. */
export const podeDissolverDivisao = (usuario, d = {}) => ehLordeComandante(usuario, d);

/** Só o Lorde Comandante ou a Corte pode transferir soldados diretamente entre divisões sem convite. */
export const podeTransferirSoldado = (usuario, d = {}) => ehLordeComandante(usuario, d);

/** Capitão administra a própria divisão (convida, aceita, dispensa, emite missão). */
export const podeAdministrarDivisao = (usuario, divisao, d = {}) =>
  ehCapitaoDaDivisao(usuario, divisao, d);

/**
 * Convites de divisão pendentes para um determinado soldado.
 */
export function convitesPendentesDoSoldado(usuario, { convites = [], guardas = [] } = {}) {
  const ficha = fichaMilitarDe(usuario, guardas);
  if (!ficha && !usuario?.civil_id && !usuario?.guarda_id) return [];

  return (convites || []).filter((c) => {
    if (c.status !== 'Pendente') return false;
    if (ficha && c.guarda_id && c.guarda_id === ficha.id) return true;
    if (ficha?.civil_id && c.civil_id && c.civil_id === ficha.civil_id) return true;
    if (usuario.civil_id && c.civil_id && c.civil_id === usuario.civil_id) return true;
    if (usuario.guarda_id && c.guarda_id && c.guarda_id === usuario.guarda_id) return true;
    if (ficha?.nome && c.guarda_nome && norm(ficha.nome) === norm(c.guarda_nome)) return true;
    return false;
  });
}

/**
 * Convites emitidos por uma divisão (ou por um capitão).
 */
export const convitesDaDivisao = (divisao, convites = []) =>
  (convites || []).filter((c) => c.divisao_id === divisao?.id);

/**
 * Gera o próximo código de missão sequencial: MIS-0001, MIS-0002...
 */
export function proximoNumeroMissao(missoes = []) {
  const max = (missoes || []).reduce((acc, m) => {
    const match = String(m.numero || '').match(/MIS-(\d+)/i);
    if (match) {
      const n = parseInt(match[1], 10);
      return n > acc ? n : acc;
    }
    return acc;
  }, 0);
  return `MIS-${String(max + 1).padStart(4, '0')}`;
}

/**
 * Filtra as missões que um usuário/soldado tem permissão para visualizar.
 */
export function missoesVisiveis(usuario, { missoes = [], divisoes = [], guardas = [], corte = [], patentes = [] } = {}) {
  if (ehLordeComandante(usuario, { corte, guardas, patentes })) {
    return [...(missoes || [])].sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
  }

  const ficha = fichaMilitarDe(usuario, guardas);
  const minhaDiv = ficha ? divisaoDe(ficha, divisoes) : null;
  const divsComandadas = divisoesQueComanda(usuario, { divisoes, guardas, corte, patentes });
  const idsComandadas = new Set(divsComandadas.map((d) => d.id));

  return (missoes || []).filter((m) => {
    if (m.visibilidade === 'exercito' || !m.visibilidade) return true;
    if (minhaDiv && m.divisao_id === minhaDiv.id) return true;
    if (idsComandadas.has(m.divisao_id)) return true;
    return false;
  }).sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
}

/**
 * Verifica se um soldado pode se inscrever em uma missão.
 */
export function podeSeInscreverNaMissao(missao, usuario, { guardas = [], divisoes = [] } = {}) {
  if (!missao || missao.status !== 'Aberta') {
    return { pode: false, motivo: 'Esta missão não está aberta para inscrições.' };
  }

  const ficha = fichaMilitarDe(usuario, guardas);
  if (!ficha) {
    return { pode: false, motivo: 'Apenas soldados com registro militar no Exército podem se voluntariar.' };
  }

  if (ficha.status === 'Aposentado') {
    return { pode: false, motivo: 'Soldados aposentados não participam de operações ativas.' };
  }

  const participantes = missao.participantes || [];
  const jaInscrito = participantes.some((p) => p.guarda_id === ficha.id || (p.civil_id && p.civil_id === ficha.civil_id));
  if (jaInscrito) {
    return { pode: false, motivo: 'Você já está inscrito nesta missão.' };
  }

  if (missao.vagas && Number(missao.vagas) > 0 && participantes.length >= Number(missao.vagas)) {
    return { pode: false, motivo: 'Todas as vagas desta missão já foram preenchidas.' };
  }

  if (missao.inscricao === 'divisao') {
    const minhaDiv = divisaoDe(ficha, divisoes);
    if (!minhaDiv || minhaDiv.id !== missao.divisao_id) {
      return { pode: false, motivo: `Inscrição restrita aos membros da divisão ${missao.divisao_nome || 'emissora'}.` };
    }
  }

  return { pode: true };
}

export { CICLO_SALARIO };

