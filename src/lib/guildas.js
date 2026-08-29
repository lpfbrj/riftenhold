// ============================================================
//  CLÃS DO HOLD
//
//  O clã é a organização dos moradores — sociedade, guilda
//  comercial, bando de aventureiros ou congregação religiosa. Um
//  morador registra, a Corte reconhece, e a partir daí o líder
//  administra os membros e o que é do clã.
//
//  Não confundir com as Casas Nobres: aquelas são linhagem e
//  vivem na tabela `clas`. Estas vivem em `guildas`, e a palavra
//  que o Hold usa para elas é "clã".
//
//  A licença é o ponto onde os dois mundos se encontram: uma
//  licença emitida para o clã vale para todo membro dele.
// ============================================================
import { TIPO_GUILDA_POR_ID, TIPOS_GUILDA } from './constants.js';

const norm = (s) => String(s || '').trim().toLowerCase();

/* ============================================================
   Tipo e situação
   ============================================================ */

export const tipoDoCla = (guilda) =>
  TIPO_GUILDA_POR_ID[guilda?.tipo] || TIPOS_GUILDA[0];

/** Clã que a Corte reconheceu — o único que vale lá fora. */
export const ehAprovado = (g) => (g?.situacao || 'Pendente') === 'Aprovado';
export const clasAprovados = (guildas = []) => (guildas || []).filter(ehAprovado);
export const clasPendentes = (guildas = []) =>
  (guildas || []).filter((g) => (g?.situacao || 'Pendente') === 'Pendente');

/* ============================================================
   Gente do clã
   ============================================================ */

/** Ele lidera este clã? */
export function ehLider(pessoa, guilda) {
  if (!pessoa || !guilda) return false;
  const id = pessoa.civil_id || pessoa.id;
  if (guilda.lider_civil_id && id) return guilda.lider_civil_id === id;
  return Boolean(guilda.lider) && norm(guilda.lider) === norm(pessoa.nome);
}

/** Ele é membro — líder ou não — deste clã? */
export function ehMembro(pessoa, guilda) {
  if (ehLider(pessoa, guilda)) return true;
  const id = pessoa?.civil_id || pessoa?.id;
  const nome = norm(pessoa?.nome);
  return (guilda?.membros || []).some(
    (m) => (m.civil_id && id && m.civil_id === id) ||
           (!m.civil_id && nome && norm(m.nome) === nome),
  );
}

/** Todos os clãs que esta pessoa lidera e que ainda existem. */
export const clasQueLidera = (pessoa, guildas = []) =>
  (guildas || []).filter((g) => ehLider(pessoa, g) && (g.situacao || 'Pendente') !== 'Dissolvido');

/**
 * O clã que esta pessoa lidera. Entre um recusado e um vivo, vale o
 * vivo: é ele que a tela precisa mostrar.
 */
export function claQueLidera(pessoa, guildas = []) {
  const meus = clasQueLidera(pessoa, guildas);
  return meus.find(ehAprovado)
    || meus.find((g) => (g.situacao || 'Pendente') === 'Pendente')
    || meus[0]
    || null;
}

/** Todos os clãs de que esta pessoa participa, já reconhecidos. */
export const clasDe = (pessoa, guildas = []) =>
  clasAprovados(guildas).filter((g) => ehMembro(pessoa, g));

/** Quanta gente o clã reúne, contando o líder. */
export const tamanhoDoCla = (guilda) => 1 + (guilda?.membros || []).length;

/**
 * Uma linha por pessoa do clã, líder primeiro — para listar sem
 * repetir a mesma lógica em cada tela.
 */
export function gentesDoCla(guilda) {
  if (!guilda) return [];
  const linhas = [{
    chave: `${guilda.id}:lider`,
    nome: guilda.lider || '',
    civil_id: guilda.lider_civil_id || '',
    id_jogo: guilda.lider_id_jogo || '',
    cargo: 'Líder',
    lidera: true,
    notas: '',
  }];
  (guilda.membros || []).forEach((m, i) => {
    if (!m?.nome || !String(m.nome).trim()) return;
    linhas.push({
      chave: `${guilda.id}:m${i}`,
      indice: i,
      nome: m.nome,
      civil_id: m.civil_id || '',
      id_jogo: m.id_jogo || '',
      cargo: m.cargo || 'Membro',
      lidera: false,
      notas: m.notas || '',
    });
  });
  return linhas;
}

/* ============================================================
   Licenças — onde o clã cobre o morador
   ============================================================ */

/** A licença é de um clã? */
export const ehDoCla = (licenca) => licenca?.titular_tipo === 'guilda' && Boolean(licenca?.guilda_id);

/** A licença pertence diretamente a esta pessoa? */
export function licencaPessoal(licenca, civil) {
  if (ehDoCla(licenca)) return false;
  if (licenca.civil_id && civil?.id) return licenca.civil_id === civil.id;
  return !licenca.civil_id && Boolean(licenca.titular) && norm(licenca.titular) === norm(civil?.nome);
}

/**
 * Todas as licenças que valem para alguém: as emitidas no nome
 * dele, mais as do clã de que ele participa. Cada linha ganha
 * `porCla` com o nome do clã, para a tela dizer de onde vem.
 */
export function licencasDe(civil, licencas = [], guildas = []) {
  if (!civil) return [];
  const meus = clasDe(civil, guildas);
  const porId = new Map(meus.map((g) => [g.id, g]));
  return (licencas || [])
    .filter((l) => licencaPessoal(l, civil) || (ehDoCla(l) && porId.has(l.guilda_id)))
    .map((l) => (ehDoCla(l) && porId.has(l.guilda_id)
      ? { ...l, porCla: porId.get(l.guilda_id).nome }
      : l));
}

/** As licenças de um clã. */
export const licencasDoCla = (guilda, licencas = []) =>
  (licencas || []).filter((l) => ehDoCla(l) && l.guilda_id === guilda?.id);

/**
 * Os tipos de licença que combinam com o tipo do clã — sugestão
 * para a Corte, não trava: a Corte emite o que quiser a quem quiser.
 */
export const licencasSugeridas = (guilda) => tipoDoCla(guilda).licencas || [];

/* ============================================================
   Regras de registro
   ============================================================ */

/**
 * Esta pessoa pode registrar um clã agora?
 * @returns {{pode:boolean, motivo:string}}
 */
export function podeRegistrarCla(pessoa, guildas = []) {
  // Qualquer clã seu que esteja de pé barra um segundo registro —
  // basta um recusado no meio da lista para o `find` antigo deixar
  // passar, e o líder acumular clãs.
  const meus = clasQueLidera(pessoa, guildas);
  const pendente = meus.find((g) => (g.situacao || 'Pendente') === 'Pendente');
  if (pendente) return { pode: false, motivo: 'Você já tem um registro de clã na mesa da Corte.' };
  const aprovado = meus.find(ehAprovado);
  if (aprovado) return { pode: false, motivo: `Você já lidera o clã ${aprovado.nome}.` };
  return { pode: true, motivo: '' };
}

/** Nome livre? Dois clãs com o mesmo nome confundem o Hold. */
export const nomeDisponivel = (nome, guildas = [], exceto = null) =>
  !(guildas || []).some(
    (g) => g.id !== exceto &&
      (g.situacao || 'Pendente') !== 'Dissolvido' &&
      norm(g.nome) === norm(nome),
  );

export { TIPOS_GUILDA, TIPO_GUILDA_POR_ID };
