// ============================================================
//  NOBREZA DE RIFTEN
//
//  A lista de nobres não é uma tabela à parte: ela é lida das casas.
//  Toda pessoa vinculada a uma dinastia — o Patriarca ou Matriarca e
//  cada membro — entra na Nobreza. O título de liderança fica na casa;
//  na Nobreza o que vale é o título pessoal: Nobre, Lorde, Lady ou Thane.
//
//  Quem não está em casa nenhuma é Plebeu.
// ============================================================
import { TITULOS_NOBREZA, PLEBEU } from './constants.js';

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * A casa fundada por um nobre nasce aguardando o aval da Corte, e
 * casa sem aval não existe para o Hold: ninguém entra na Nobreza por
 * ela, ela não serve vilarejo e não tem servos reconhecidos. Todo o
 * resto deste arquivo lê as casas por aqui, para a regra valer em
 * qualquer tela sem que nenhuma precise lembrar dela.
 */
const reconhecidas = (clas = []) =>
  (clas || []).filter((c) => (c.situacao || 'Aprovada') === 'Aprovada');

/** Se o título gravado não é um dos quatro, vale Nobre. */
export const tituloValido = (t) => (TITULOS_NOBREZA.includes(t) ? t : TITULOS_NOBREZA[0]);

/**
 * Todos os nobres do Hold, em uma lista só.
 *
 * Cada linha aponta de volta para onde mora o dado (`origem`), para que a
 * Corte possa mudar o título aqui e a alteração cair na casa certa:
 *   · { origem: 'lider' }            → grava em cla.lider_titulo
 *   · { origem: 'membro', indice: n} → grava em cla.membros[n].titulo
 */
export function listaNobreza(clas = []) {
  const linhas = [];
  for (const cla of reconhecidas(clas)) {
    if (cla.lider && String(cla.lider).trim()) {
      linhas.push({
        chave: `${cla.id}:lider`,
        origem: 'lider',
        cla_id: cla.id,
        casa: cla.nome,
        cor: cla.cor || '#7c6bb0',
        nome: cla.lider,
        civil_id: cla.lider_civil_id || '',
        id_jogo: cla.lider_id_jogo || '',
        raca: cla.lider_raca || '',
        titulo: tituloValido(cla.lider_titulo),
        // O título de liderança acompanha a linha, mas não é o título de nobreza.
        lideranca: cla.titulo_lider || 'Patriarca',
        notas: '',
      });
    }
    (cla.membros || []).forEach((m, i) => {
      if (!m?.nome || !String(m.nome).trim()) return;
      linhas.push({
        chave: `${cla.id}:m${i}`,
        origem: 'membro',
        indice: i,
        cla_id: cla.id,
        casa: cla.nome,
        cor: cla.cor || '#7c6bb0',
        nome: m.nome,
        civil_id: m.civil_id || '',
        id_jogo: m.id_jogo || '',
        raca: m.raca || '',
        titulo: tituloValido(m.titulo),
        lideranca: '',
        notas: m.notas || '',
      });
    });
  }
  const texto = (x) => String(x || '');
  return linhas.sort((a, b) =>
    texto(a.casa).localeCompare(texto(b.casa)) ||
    (a.lideranca ? -1 : b.lideranca ? 1 : 0) ||
    texto(a.nome).localeCompare(texto(b.nome)));
}

/** Devolve a casa com o título trocado, pronta para salvar. */
export function comTituloTrocado(cla, linha, titulo) {
  const t = tituloValido(titulo);
  if (linha.origem === 'lider') return { ...cla, lider_titulo: t };
  return {
    ...cla,
    membros: (cla.membros || []).map((m, i) => (i === linha.indice ? { ...m, titulo: t } : m)),
  };
}

/**
 * A posição de uma pessoa na Nobreza.
 * @returns {{titulo:string, casa:string, cla_id:string, lideranca:string}|null}
 *          `null` quando ela não pertence a casa nenhuma — ou seja, Plebeu.
 */
export function nobrezaDe(pessoa, clas = []) {
  if (!pessoa) return null;
  const id = pessoa.id || pessoa.civil_id;
  const nome = norm(pessoa.nome);
  for (const linha of listaNobreza(clas)) {
    const bate = (linha.civil_id && id && linha.civil_id === id) ||
                 (!linha.civil_id && nome && norm(linha.nome) === nome);
    if (bate) {
      return {
        titulo: linha.titulo, casa: linha.casa,
        cla_id: linha.cla_id, cor: linha.cor, lideranca: linha.lideranca,
      };
    }
  }
  return null;
}

/** O título que aparece na ficha: um dos quatro, ou Plebeu. */
export const tituloDe = (pessoa, clas = []) => nobrezaDe(pessoa, clas)?.titulo || PLEBEU;

/**
 * A casa que detém um vilarejo: é a casa do Lorde empossado ali.
 * Vale para o Patriarca e para qualquer membro — quem responde pelo
 * vilarejo leva o estandarte da própria dinastia.
 *
 * @returns {{nome:string, cla_id:string, cor:string, titulo:string, lideranca:string}|null}
 */
export function casaDoVilarejo(assentamento, clas = []) {
  if (!assentamento?.lorde) return null;
  const pos = nobrezaDe(
    { id: assentamento.lorde_civil_id, nome: assentamento.lorde },
    clas,
  );
  if (!pos) return null;
  return {
    nome: pos.casa, cla_id: pos.cla_id, cor: pos.cor,
    titulo: pos.titulo, lideranca: pos.lideranca,
  };
}

/**
 * Servo de uma casa. Servo **não** é nobre: ele não entra na Nobreza de
 * Riften e continua Plebeu. O que a casa registra é o serviço — a função
 * que ele exerce ali, escrita pelo próprio Patriarca.
 *
 * @returns {{casa:string, cla_id:string, cor:string, funcao:string}|null}
 */
export function servicoDe(pessoa, clas = []) {
  if (!pessoa) return null;
  const id = pessoa.id || pessoa.civil_id;
  const nome = norm(pessoa.nome);
  for (const cla of reconhecidas(clas)) {
    const s = (cla.servos || []).find(
      (x) => (x.civil_id && id && x.civil_id === id) ||
             (!x.civil_id && nome && norm(x.nome) === nome),
    );
    if (s) {
      return { casa: cla.nome, cla_id: cla.id, cor: cla.cor || '#7c6bb0', funcao: s.funcao || '' };
    }
  }
  return null;
}

/** Todos os servos do Hold, com a casa a que servem. */
export function listaServos(clas = []) {
  const linhas = [];
  for (const cla of reconhecidas(clas)) {
    (cla.servos || []).forEach((s, i) => {
      if (!s?.nome || !String(s.nome).trim()) return;
      linhas.push({
        chave: `${cla.id}:s${i}`, cla_id: cla.id, casa: cla.nome,
        cor: cla.cor || '#7c6bb0', nome: s.nome, civil_id: s.civil_id || '',
        funcao: s.funcao || '', notas: s.notas || '',
      });
    });
  }
    return linhas.sort((a, b) =>
    String(a.casa || '').localeCompare(String(b.casa || '')) ||
    String(a.nome || '').localeCompare(String(b.nome || '')));
}
