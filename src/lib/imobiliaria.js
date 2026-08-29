// ============================================================
//  IMOBILIÁRIA DO HOLD
//
//  O registro de imóveis é um só — a mesma tabela de sempre. O que
//  este arquivo faz é lê-la por categoria (casa, comércio,
//  fortaleza), dizer o que está à venda e cruzar as propostas com
//  quem é dono do quê.
//
//  A regra da venda é curta: o dono anuncia, quem quiser propõe, e
//  o aceite do dono transfere o imóvel. A Corte não precisa deferir
//  — ela cadastra os imóveis e vê a escritura lavrada na Crônica.
// ============================================================
import {
  CATEGORIAS_IMOVEL, CATEGORIA_POR_ID, CATEGORIA_PADRAO, categoriaDoTipo,
} from './constants.js';

const norm = (s) => String(s || '').trim().toLowerCase();
export const septims = (n) => `${Number(n || 0).toLocaleString('pt-BR')} Septims`;

/* ============================================================
   Categoria e valor
   ============================================================ */

/** A categoria do imóvel: a gravada, ou a que o tipo dele indica. */
export function categoriaDe(prop) {
  if (!prop) return CATEGORIA_PADRAO;
  return CATEGORIA_POR_ID[prop.categoria] ? prop.categoria : categoriaDoTipo(prop.tipo);
}

export const categoriaInfo = (prop) => CATEGORIA_POR_ID[categoriaDe(prop)] || CATEGORIA_POR_ID[CATEGORIA_PADRAO];

/** A avaliação da Corte: o valor do imóvel, ou a base da categoria. */
export function avaliacaoDe(prop) {
  const v = Number(prop?.valor);
  if (Number.isFinite(v) && v > 0) return v;
  return categoriaInfo(prop).base;
}

/** O preço pedido no anúncio. Sem preço, vale a avaliação. */
export function precoDe(prop) {
  const v = Number(prop?.preco);
  if (Number.isFinite(v) && v > 0) return v;
  return avaliacaoDe(prop);
}

/** Está no mercado? */
export const estaAVenda = (prop) => Boolean(prop?.a_venda);

/** Os imóveis de uma categoria. */
export const daCategoria = (propriedades = [], categoria) =>
  (propriedades || []).filter((p) => categoriaDe(p) === categoria);

/** Quantos imóveis e quantos anúncios cada categoria tem. */
export function resumoDasCategorias(propriedades = []) {
  return CATEGORIAS_IMOVEL.map((c) => {
    const minhas = daCategoria(propriedades, c.id);
    return {
      ...c,
      total: minhas.length,
      aVenda: minhas.filter(estaAVenda).length,
      semDono: minhas.filter((p) => !String(p.proprietario || '').trim()).length,
    };
  });
}

/* ============================================================
   Quem é dono de quê
   ============================================================ */

/** Este imóvel é desta pessoa? Mesmo critério do resto do sistema. */
export function ehDono(pessoa, prop) {
  if (!pessoa || !prop) return false;
  const id = pessoa.civil_id || pessoa.id;
  if (prop.proprietario_civil_id && id) return prop.proprietario_civil_id === id;
  return Boolean(prop.proprietario) && norm(prop.proprietario) === norm(pessoa.nome);
}

/** Os imóveis registrados no nome de alguém. */
export const imoveisDe = (pessoa, propriedades = []) =>
  (propriedades || []).filter((p) => ehDono(pessoa, p));

/* ============================================================
   O mercado
   ============================================================ */

/**
 * O que está à venda, pronto para a vitrine.
 *
 * Imóvel arruinado sai do mercado: não se vende ruína como casa.
 */
export function noMercado(propriedades = [], { categoria = '', busca = '', local = '' } = {}) {
  const t = norm(busca);
  return (propriedades || [])
    .filter(estaAVenda)
    .filter((p) => p.status !== 'Arruinada')
    .filter((p) => !categoria || categoriaDe(p) === categoria)
    .filter((p) => !local || p.local === local)
    .filter((p) => !t || norm(`${p.nome} ${p.tipo} ${p.local} ${p.proprietario}`).includes(t))
    .sort((a, b) => precoDe(a) - precoDe(b));
}

/* ============================================================
   Propostas
   ============================================================ */

export const ofertasDoImovel = (ofertas = [], prop) =>
  (ofertas || [])
    .filter((o) => o.propriedade_id === prop?.id)
    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));

export const abertas = (ofertas = []) => (ofertas || []).filter((o) => o.status === 'Aberta');

/** As propostas que esta pessoa enviou. */
export const minhasOfertas = (pessoa, ofertas = []) => {
  const id = pessoa?.civil_id || pessoa?.id;
  const nome = norm(pessoa?.nome);
  return (ofertas || [])
    .filter((o) => (o.comprador_civil_id && id && o.comprador_civil_id === id) ||
                   (!o.comprador_civil_id && nome && norm(o.comprador) === nome))
    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
};

/** As propostas que chegaram para os imóveis desta pessoa. */
export function ofertasRecebidas(pessoa, propriedades = [], ofertas = []) {
  const meus = new Set(imoveisDe(pessoa, propriedades).map((p) => p.id));
  return (ofertas || [])
    .filter((o) => meus.has(o.propriedade_id))
    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
}

/**
 * Esta pessoa pode propor por este imóvel?
 * @returns {{pode:boolean, motivo:string}}
 */
export function podeOfertar(pessoa, prop, ofertas = []) {
  if (!prop) return { pode: false, motivo: 'Imóvel não encontrado.' };
  if (!estaAVenda(prop)) return { pode: false, motivo: 'Este imóvel não está à venda.' };
  if (ehDono(pessoa, prop)) return { pode: false, motivo: 'O imóvel já é seu.' };
  // Sem dono setado não há quem responda: o negócio é com a Corte.
  if (!String(prop.proprietario || '').trim() && !prop.proprietario_civil_id) {
    return { pode: false, motivo: 'Este imóvel está sem dono setado — fale com a Corte.' };
  }
  const id = pessoa?.civil_id || pessoa?.id;
  const jaTem = (ofertas || []).some(
    (o) => o.propriedade_id === prop.id && o.status === 'Aberta' &&
      ((o.comprador_civil_id && id && o.comprador_civil_id === id) ||
       (!o.comprador_civil_id && norm(o.comprador) === norm(pessoa?.nome))),
  );
  if (jaTem) return { pode: false, motivo: 'Você já tem uma proposta em pé por este imóvel.' };
  return { pode: true, motivo: '' };
}

/**
 * O que muda no imóvel quando a venda fecha: dono novo e fora do
 * mercado. A avaliação continua sendo a da Corte — o que mudou foi
 * quem tem a chave.
 */
export function comNovoDono(prop, oferta) {
  // Só os campos que a venda muda. Devolver o imóvel inteiro
  // reescreveria estoque, funcionários e ficha com o retrato que a
  // tela carregou — desfazendo o que outra pessoa salvou no meio.
  return {
    proprietario: oferta.comprador || '',
    proprietario_civil_id: oferta.comprador_civil_id || '',
    a_venda: false,
    preco: null,
    anuncio_nota: '',
    anunciada_em: null,
    vendida_em: new Date().toISOString(),
  };
}

export { CATEGORIAS_IMOVEL, CATEGORIA_POR_ID, categoriaDoTipo };
