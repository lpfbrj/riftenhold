// ============================================================
//  ALMOXARIFADO DO QUARTEL GENERAL
//
//  O catálogo de tudo que entra e sai do depósito da Guarda.
//  Três painéis:
//    · equipamento — armaduras (fixas, conferidas nos prints) e armas
//    · alquimia    — poções e ingredientes
//    · recursos    — minérios, lingotes, peles e couro
//
//  `base` é a contagem que veio do baú no dia do inventário.
//  A partir dela, cada entrada/saída registrada move o saldo.
// ============================================================

/** Os três painéis da Logística. */
export const PAINEIS = [
  {
    id: 'equipamento',
    nome: 'Equipamentos da Guarda',
    descricao: 'Armaduras da Guarda de Riften e o armamento do arsenal.',
    icone: 'escudo',
  },
  {
    id: 'alquimia',
    nome: 'Poções e Ingredientes',
    descricao: 'Poções de uso da Guarda e os ingredientes para produzi-las.',
    icone: 'frasco',
  },
  {
    id: 'recursos',
    nome: 'Recursos e Insumos',
    descricao: 'Minérios, lingotes, peles e couro para produção.',
    icone: 'picareta',
  },
];
export const PAINEL_POR_ID = Object.fromEntries(PAINEIS.map((p) => [p.id, p]));

// ------------------------------------------------------------
//  Slots de equipamento (a coluna TYPE do inventário do jogo)
// ------------------------------------------------------------
export const SLOTS = [
  { id: 'Body', nome: 'Body', pt: 'Torso' },
  { id: 'Head', nome: 'Head', pt: 'Cabeça' },
  { id: 'Hands', nome: 'Hands', pt: 'Mãos' },
  { id: 'Feet', nome: 'Feet', pt: 'Pés' },
  { id: 'Cloak', nome: 'Cloak', pt: 'Manto' },
  { id: 'Shield', nome: 'Shield', pt: 'Escudo' },
];
export const SLOT_POR_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

/** Classe da peça. `null` em armas e itens sem classe de armadura. */
export const CLASSES = [
  { id: 'pesada', nome: 'Armadura Pesada', tom: 'perigo' },
  { id: 'leve', nome: 'Armadura Leve', tom: 'ok' },
  { id: 'roupa', nome: 'Roupa', tom: 'roxo' },
];
export const CLASSE_POR_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// ============================================================
//  1 · ARMADURAS DA GUARDA
//
//  Conferidas peça a peça nos dois prints do baú. As variantes
//  Lendárias foram somadas à peça comum — é a mesma peça, e o
//  que importa aqui é a contagem.
//    Botas de Pelo ............ 16 + 1 + 1 (Lendário)  = 18
//    Riften Boots .............  1 + 33               = 34
//    Riften Cloak ............. 32 + 1                = 33
//    Riften Gauntlets ......... 30 + 1                = 31
//    Riften Guard Cloak .......  1 + 33               = 34
//    Riften Guard's Armor ..... 42 + 1                = 43
//    Riften Guard's Helmet ....  1 + 44               = 45
//    Riften Guard's Shield .... 75 + 1 + 1 (Lendário) = 77
//    Riften Heavy Armor .......  1 + 34               = 35
//    Riften Heavy Helmet ......  1 + 45 + 1 (Lendário)= 47
//    Riften Helmet ............ 40 + 1                = 41
//    Riften Light Armor ....... 48 + 1 + 2 (Lendário) = 51
//    Riften Shield ............  1 + 62 + 1 (Lendário)= 64
// ============================================================

export const ARMADURAS = [
  { id: 'arm-botas-pelo',    nome: 'Botas de Pelo',        slot: 'Feet',   classe: 'leve',   peso: 2,  valor: 5,   base: 18 },
  { id: 'arm-riften-boots',  nome: 'Riften Boots',         slot: 'Feet',   classe: 'leve',   peso: 6,  valor: 40,  base: 34 },
  { id: 'arm-riften-cloak',  nome: 'Riften Cloak',         slot: 'Cloak',  classe: 'roupa',  peso: 2,  valor: 25,  base: 33 },
  { id: 'arm-riften-gaunt',  nome: 'Riften Gauntlets',     slot: 'Hands',  classe: 'leve',   peso: 5,  valor: 40,  base: 31 },
  { id: 'arm-guard-cloak',   nome: 'Riften Guard Cloak',   slot: 'Cloak',  classe: 'roupa',  peso: 0,  valor: 25,  base: 34 },
  { id: 'arm-guard-armor',   nome: "Riften Guard's Armor", slot: 'Body',   classe: 'leve',   peso: 6,  valor: 75,  base: 43 },
  { id: 'arm-guard-helmet',  nome: "Riften Guard's Helmet",slot: 'Head',   classe: 'leve',   peso: 2,  valor: 35,  base: 45 },
  { id: 'arm-guard-shield',  nome: "Riften Guard's Shield",slot: 'Shield', classe: 'leve',   peso: 3,  valor: 40,  base: 77 },
  { id: 'arm-heavy-armor',   nome: 'Riften Heavy Armor',   slot: 'Body',   classe: 'pesada', peso: 25, valor: 220, base: 35 },
  { id: 'arm-heavy-helmet',  nome: 'Riften Heavy Helmet',  slot: 'Head',   classe: 'pesada', peso: 5,  valor: 130, base: 47 },
  { id: 'arm-riften-helmet', nome: 'Riften Helmet',        slot: 'Head',   classe: 'leve',   peso: 5,  valor: 100, base: 41 },
  { id: 'arm-light-armor',   nome: 'Riften Light Armor',   slot: 'Body',   classe: 'leve',   peso: 7,  valor: 220, base: 51 },
  { id: 'arm-riften-shield', nome: 'Riften Shield',        slot: 'Shield', classe: 'leve',   peso: 12, valor: 70,  base: 64 },
];

// ============================================================
//  2 · ARMAS
//
//  Os seis materiais autorizados pela Corte. Nada dáedrico.
//  Ferro e Aço não têm arco na forja de Skyrim — por isso a
//  linha do arco não aparece nesses dois materiais.
// ============================================================

export const MATERIAIS_ARMA = [
  { id: 'ferro',   nome: 'Ferro',   cor: '#8f8f96' },
  { id: 'aco',     nome: 'Aço',     cor: '#b9c2cc' },
  { id: 'elfico',  nome: 'Élfico',  cor: '#c9d98f' },
  { id: 'cristal', nome: 'Cristal', cor: '#6fd0a8' },
  { id: 'nordico', nome: 'Nórdico', cor: '#9ec4d8' },
  { id: 'ebano',   nome: 'Ébano',   cor: '#8d7fb5' },
];
export const MATERIAL_POR_ID = Object.fromEntries(MATERIAIS_ARMA.map((m) => [m.id, m]));

export const TIPOS_ARMA = [
  { id: 'adaga',    nome: 'Adaga',            en: 'Dagger',     mao: 'Uma mão' },
  { id: 'espada',   nome: 'Espada',           en: 'Sword',      mao: 'Uma mão' },
  { id: 'machado',  nome: 'Machado de Guerra',en: 'War Axe',    mao: 'Uma mão' },
  { id: 'maca',     nome: 'Maça',             en: 'Mace',       mao: 'Uma mão' },
  { id: 'espadao',  nome: 'Espadão',          en: 'Greatsword', mao: 'Duas mãos' },
  { id: 'machadao', nome: 'Machado de Batalha', en: 'Battleaxe',mao: 'Duas mãos' },
  { id: 'martelo',  nome: 'Martelo de Guerra',en: 'Warhammer',  mao: 'Duas mãos' },
  { id: 'arco',     nome: 'Arco',             en: 'Bow',        mao: 'À distância' },
  { id: 'flecha',   nome: 'Flechas',          en: 'Arrows',     mao: 'Munição' },
];
export const TIPO_ARMA_POR_ID = Object.fromEntries(TIPOS_ARMA.map((t) => [t.id, t]));

/** Ferro e Aço não têm arco no jogo base; os demais materiais têm. */
const SEM_ARCO = new Set(['ferro', 'aco']);

export const ARMAS = MATERIAIS_ARMA.flatMap((m) =>
  TIPOS_ARMA
    .filter((t) => !(t.id === 'arco' && SEM_ARCO.has(m.id)))
    .map((t) => ({
      id: `arma-${m.id}-${t.id}`,
      nome: `${t.en === 'Arrows' ? `${rotuloMaterialEn(m.id)} Arrow` : `${rotuloMaterialEn(m.id)} ${t.en}`}`,
      material: m.id,
      tipo: t.id,
      mao: t.mao,
      base: 0,
    })),
);

/** O nome do material como aparece no jogo. */
function rotuloMaterialEn(id) {
  return { ferro: 'Iron', aco: 'Steel', elfico: 'Elven', cristal: 'Glass', nordico: 'Nordic', ebano: 'Ebony' }[id];
}
export { rotuloMaterialEn };

// ============================================================
//  3 · POÇÕES
//
//  Os três eixos que a Guarda consome: Vida, Vigor e Magia,
//  nos seis degraus de potência do jogo.
// ============================================================

export const EIXOS_POCAO = [
  { id: 'vida',   nome: 'Vida',   efeito: 'Restore Health',  cor: '#c0524f' },
  { id: 'magia',  nome: 'Magia',  efeito: 'Restore Magicka', cor: '#5f7fc8' },
  { id: 'vigor',  nome: 'Vigor',  efeito: 'Restore Stamina', cor: '#5aa46a' },
];
export const EIXO_POR_ID = Object.fromEntries(EIXOS_POCAO.map((e) => [e.id, e]));

const DEGRAUS = [
  { id: 'minor',     rotulo: 'Minor',     pt: 'Menor' },
  { id: 'comum',     rotulo: '',          pt: 'Comum' },
  { id: 'plentiful', rotulo: 'Plentiful', pt: 'Abundante' },
  { id: 'vigorous',  rotulo: 'Vigorous',  pt: 'Vigorosa' },
  { id: 'extreme',   rotulo: 'Extreme',   pt: 'Extrema' },
  { id: 'ultimate',  rotulo: 'Ultimate',  pt: 'Suprema' },
];

const SUFIXO = { vida: 'Healing', magia: 'Magicka', vigor: 'Stamina' };
const RESTAURA = {
  vida:  { minor: 25, comum: 50, plentiful: 75, vigorous: 100, extreme: 150, ultimate: 200 },
  magia: { minor: 25, comum: 50, plentiful: 75, vigorous: 100, extreme: 150, ultimate: 200 },
  vigor: { minor: 25, comum: 50, plentiful: 75, vigorous: 100, extreme: 150, ultimate: 200 },
};

export const POCOES = EIXOS_POCAO.flatMap((e) =>
  DEGRAUS.map((d) => ({
    id: `poc-${e.id}-${d.id}`,
    nome: `Potion of ${d.rotulo ? `${d.rotulo} ` : ''}${SUFIXO[e.id]}`,
    eixo: e.id,
    degrau: d.id,
    degrauPt: d.pt,
    restaura: RESTAURA[e.id][d.id],
    base: 0,
  })),
);

// ============================================================
//  4 · INGREDIENTES
//
//  Só os que servem à produção das três poções acima. Um mesmo
//  ingrediente pode servir a mais de um eixo (Blue Dartwing,
//  Charred Skeever Hide, Eye of Sabre Cat…).
// ============================================================

const ING_VIDA = [
  'Blisterwort', 'Blue Dartwing', 'Blue Mountain Flower', 'Butterfly Wing',
  'Charred Skeever Hide', 'Daedra Heart', 'Eye of Sabre Cat', 'Imp Stool',
  'Rock Warbler Egg', 'Swamp Fungal Pod', 'Wheat',
  'Ash Hopper Jelly', 'Felsaad Tern Feathers',
];

const ING_MAGIA = [
  'Briar Heart', 'Creep Cluster', 'Dwarven Oil', 'Ectoplasm', 'Elves Ear',
  'Fire Salts', 'Frost Salts', 'Giant Lichen', 'Grass Pod', 'Human Flesh',
  'Moon Sugar', 'Mora Tapinella', 'Pearl', 'Red Mountain Flower', 'Taproot',
  'Vampire Dust', 'White Cap',
  'Bog Beacon', 'Emperor Parasol Moss', 'Felsaad Tern Feathers',
];

const ING_VIGOR = [
  'Abecean Longfin', 'Bear Claws', 'Bee', 'Blue Dartwing', 'Charred Skeever Hide',
  'Eye of Sabre Cat', 'Hawk Beak', 'Histcarp', 'Honeycomb', 'Large Antlers',
  'Mudcrab Chitin', 'Orange Dartwing', 'Pearl', 'Pine Thrush Egg',
  'Purple Mountain Flower', 'Sabre Cat Tooth', 'Salmon Roe', 'Silverside Perch',
  'Small Pearl', 'Torchbug Thorax', 'Wisp Wrappings',
];

const chave = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const mapaIng = new Map();
for (const [eixo, lista] of [['vida', ING_VIDA], ['magia', ING_MAGIA], ['vigor', ING_VIGOR]]) {
  for (const nome of lista) {
    const k = chave(nome);
    if (!mapaIng.has(k)) mapaIng.set(k, { id: `ing-${k}`, nome, eixos: [], base: 0 });
    mapaIng.get(k).eixos.push(eixo);
  }
}
export const INGREDIENTES = [...mapaIng.values()].sort((a, b) => a.nome.localeCompare(b.nome));

// Emperor Parasol Moss e Bog Beacon vêm de Solstheim; ficam listados
// porque a Guarda compra ingrediente de mercador, não só de coleta.

// ============================================================
//  5 · RECURSOS E INSUMOS
// ============================================================

export const GRUPOS_RECURSO = [
  { id: 'minerio', nome: 'Minérios', icone: 'picareta' },
  { id: 'lingote', nome: 'Lingotes', icone: 'bigorna' },
  { id: 'pele', nome: 'Peles', icone: 'pele' },
  { id: 'couro', nome: 'Couro', icone: 'pele' },
];
export const GRUPO_RECURSO_POR_ID = Object.fromEntries(GRUPOS_RECURSO.map((g) => [g.id, g]));

const minerio = (nome, cor) => ({ id: `rec-min-${chave(nome)}`, nome, grupo: 'minerio', cor, base: 0 });
const lingote = (nome, cor) => ({ id: `rec-lin-${chave(nome)}`, nome, grupo: 'lingote', cor, base: 0 });
const pele = (nome) => ({ id: `rec-pel-${chave(nome)}`, nome, grupo: 'pele', base: 0 });
const couro = (nome) => ({ id: `rec-cou-${chave(nome)}`, nome, grupo: 'couro', base: 0 });

export const RECURSOS = [
  // Minérios — os mesmos nove da Licença de Mineração.
  minerio('Iron Ore', '#8f8f96'),
  minerio('Corundum Ore', '#b98a52'),
  minerio('Quicksilver Ore', '#c9ccd6'),
  minerio('Silver Ore', '#cdd3dc'),
  minerio('Gold Ore', '#d8b163'),
  minerio('Orichalcum Ore', '#7fa06b'),
  minerio('Moonstone Ore', '#cfe0c8'),
  minerio('Malachite Ore', '#6fd0a8'),
  minerio('Ebony Ore', '#8d7fb5'),
  // Lingotes — o que sai da fundição.
  lingote('Iron Ingot', '#8f8f96'),
  lingote('Steel Ingot', '#b9c2cc'),
  lingote('Corundum Ingot', '#b98a52'),
  lingote('Quicksilver Ingot', '#c9ccd6'),
  lingote('Silver Ingot', '#cdd3dc'),
  lingote('Gold Ingot', '#d8b163'),
  lingote('Orichalcum Ingot', '#7fa06b'),
  lingote('Moonstone Ingot', '#cfe0c8'),
  lingote('Refined Malachite', '#6fd0a8'),
  lingote('Ebony Ingot', '#8d7fb5'),
  lingote('Dwarven Metal Ingot', '#c2a05a'),
  // Peles, couro e tiras.
  pele('Deer Hide'), pele('Goat Hide'), pele('Cow Hide'), pele('Horse Hide'),
  pele('Sabre Cat Pelt'), pele('Bear Pelt'), pele('Wolf Pelt'), pele('Fox Pelt'),
  couro('Leather'), couro('Leather Strips'),
];

// ============================================================
//  CATÁLOGO ÚNICO
// ============================================================

/** Todo item do almoxarifado, com o painel e a linha a que pertence. */
export const CATALOGO = [
  ...ARMADURAS.map((a) => ({ ...a, painel: 'equipamento', linha: 'armadura' })),
  ...ARMAS.map((a) => ({ ...a, painel: 'equipamento', linha: 'arma' })),
  ...POCOES.map((p) => ({ ...p, painel: 'alquimia', linha: 'pocao' })),
  ...INGREDIENTES.map((i) => ({ ...i, painel: 'alquimia', linha: 'ingrediente' })),
  ...RECURSOS.map((r) => ({ ...r, painel: 'recursos', linha: 'recurso' })),
];
export const ITEM_POR_ID = Object.fromEntries(CATALOGO.map((i) => [i.id, i]));

// ============================================================
//  6 · PRÉDIOS
//
//  Cada prédio do Hold guarda o seu próprio almoxarifado. Todo
//  movimento pertence a um prédio; os lançamentos antigos, feitos
//  antes desta divisão, contam para o Quartel — que é onde o
//  inventário original foi levantado.
// ============================================================
export const PREDIOS = [
  {
    id: 'mistveil_barracks',
    nome: 'Mistveil Keep Barracks',
    curto: 'Barracas',
    icone: 'escudo',
    resumo: 'Quartel General da Guarda',
    detalhe: 'Fardamento de serviço, arsenal de patrulha e as poções que a Guarda leva na cintura.',
    // O inventário-base do baú foi contado aqui.
    base: true,
  },
  {
    id: 'mistveil_keep',
    nome: 'Mistveil Keep',
    curto: 'Mistveil',
    icone: 'coroa',
    resumo: 'Sede do Jarl e da Corte',
    detalhe: 'Reserva da Corte: o que o Palácio guarda para si, para presentes e para cerimônia.',
  },
  {
    id: 'fort_greenwall',
    nome: 'Fort Greenwall',
    curto: 'Greenwall',
    icone: 'estandarte',
    resumo: 'Guarnição da estrada leste',
    detalhe: 'O que sustenta a tropa fora dos muros: reposição, insumo e munição de forte.',
  },
];
export const PREDIO_POR_ID = Object.fromEntries(PREDIOS.map((p) => [p.id, p]));
/** O prédio onde o inventário-base foi contado. */
export const PREDIO_PADRAO = (PREDIOS.find((p) => p.base) || PREDIOS[0]).id;

/** Lançamento antigo, sem prédio marcado, é do Quartel. */
export const predioDe = (m) => (PREDIO_POR_ID[m?.predio] ? m.predio : PREDIO_PADRAO);

/** Os movimentos de um prédio. Sem prédio, devolve todos. */
export const movimentosDoPredio = (movimentos = [], predio = null) =>
  (predio ? movimentos.filter((m) => predioDe(m) === predio) : movimentos);

/**
 * Saldo de cada item: a contagem-base mais tudo que entrou e saiu.
 *
 * Com um prédio, conta só o que passou por ele — e a contagem-base
 * só entra no prédio onde o inventário foi levantado, para o mesmo
 * baú não ser contado três vezes.
 */
export function calcularSaldos(movimentos = [], predio = null) {
  const comBase = !predio || Boolean(PREDIO_POR_ID[predio]?.base);
  const saldo = Object.fromEntries(CATALOGO.map((i) => [i.id, comBase ? (i.base || 0) : 0]));
  for (const m of movimentosDoPredio(movimentos, predio)) {
    if (!(m.item_id in saldo)) continue;
    const q = Number(m.quantidade) || 0;
    saldo[m.item_id] += m.sentido === 'saida' ? -q : q;
  }
  return saldo;
}

/** Quanto cada prédio tem, somando tudo — para os cartões da escolha. */
export function resumoDosPredios(movimentos = []) {
  return PREDIOS.map((p) => {
    const saldos = calcularSaldos(movimentos, p.id);
    const total = CATALOGO.reduce((s, i) => s + (saldos[i.id] || 0), 0);
    const porPainel = Object.fromEntries(PAINEIS.map((pn) => [
      pn.id,
      CATALOGO.filter((i) => i.painel === pn.id).reduce((s, i) => s + (saldos[i.id] || 0), 0),
    ]));
    return {
      ...p,
      total,
      porPainel,
      lancamentos: movimentosDoPredio(movimentos, p.id).length,
      zerados: CATALOGO.filter((i) => (saldos[i.id] || 0) <= 0).length,
    };
  });
}

export const MOTIVOS_ENTRADA = ['Compra', 'Produção', 'Doação', 'Apreensão', 'Devolução', 'Ajuste de inventário'];
export const MOTIVOS_SAIDA = ['Equipar guarda', 'Consumo', 'Produção', 'Venda', 'Perda', 'Ajuste de inventário'];
