// ============================================================
//  CATÁLOGO DE ITENS
//  Cada estrutura, planta ou recurso que uma propriedade ou um
//  território pode ter. É o vocabulário da "Catalogação".
//
//  Um item catalogado é { t: <id do tipo>, q: <quantidade>, d?: <detalhe> }
//  Ex.: { t: 'santuario', q: 1, d: 'Dibella' }
// ============================================================

export const CATEGORIAS = [
  { id: 'oficina',       nome: 'Oficina',        cor: '#c9743a' },
  { id: 'armazenamento', nome: 'Armazenamento',  cor: '#d8b163' },
  { id: 'cultivo',       nome: 'Cultivo',        cor: '#8fa84e' },
  { id: 'criacao',       nome: 'Criação',        cor: '#c2a05a' },
  { id: 'recurso',       nome: 'Recurso',        cor: '#8d8d94' },
  { id: 'culto',         nome: 'Culto',          cor: '#9384d1' },
];

/** d = path SVG em viewBox 0 0 24 24, traçado (sem preenchimento). */
export const TIPOS_ITEM = [
  // --- Oficina ---
  { id: 'forja',        nome: 'Forja de Ferreiro',      cat: 'oficina', d: 'M3 9h10l4 3-4 1H8l-2 4H6l1-4H4a1.5 1.5 0 0 1 0-4zM7 20h10' },
  { id: 'fundicao',     nome: 'Fundição (Smelter)',     cat: 'oficina', d: 'M6 21V9l6-4 6 4v12zM10 21v-5h4v5M9 4l1-2M15 4l1-2' },
  { id: 'bancada',      nome: 'Bancada de Trabalho',    cat: 'oficina', d: 'M3 9h18M5 9v11M19 9v11M7 5h7l1 4H6z' },
  { id: 'pedra_amolar', nome: 'Pedra de Amolar',        cat: 'oficina', d: 'M12 13a5 5 0 1 0 0-.01M4 21h16M7 21l3-4M17 21l-3-4M12 8V4' },
  { id: 'tanning',      nome: 'Tanning Rack',           cat: 'oficina', d: 'M4 4v17M20 4v17M4 5h16M7 8h10l-1 9H8z' },
  { id: 'bloco_corte',  nome: 'Bloco para Cortar Madeira', cat: 'oficina', d: 'M4 16h10v5H4zM9 16V9M14 3l6 6-2 2-6-6z' },
  { id: 'sawhorse',     nome: 'Sawhorse',               cat: 'oficina', d: 'M5 21l4-13M19 21l-4-13M6 13h12M9 4h6l-1 4h-4z' },
  { id: 'lab_alquimia', nome: 'Laboratório de Alquimia', cat: 'oficina', d: 'M10 3h4v6l4 9a2 2 0 0 1-2 3H8a2 2 0 0 1-2-3l4-9zM8 15h8' },
  { id: 'caldeirao',    nome: 'Caldeirão',              cat: 'oficina', d: 'M5 10h14v2a7 7 0 0 1-14 0zM3 10h18M8 7l1 3M16 7l-1 3' },
  { id: 'encantamento', nome: 'Mesa de Encantamento',   cat: 'oficina', d: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM5 18h14v3H5z' },

  // --- Armazenamento ---
  { id: 'armazenamento', nome: 'Inventário para Armazenamento', cat: 'armazenamento', d: 'M3 9h18v11H3zM3 13h18M10 13h4v3h-4zM5 9V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2' },

  // --- Cultivo ---
  { id: 'trigo',      nome: 'Trigo',           cat: 'cultivo', d: 'M12 21V9M12 9l3-3-3-3-3 3zM12 13l4-2M12 13l-4-2M12 17l4-2M12 17l-4-2' },
  { id: 'alho_poro',  nome: 'Alho-poró',       cat: 'cultivo', d: 'M12 21V8M9 8c0-4 3-6 3-6s3 2 3 6M9 8h6M10 21h4' },
  { id: 'batata',     nome: 'Planta da Batata', cat: 'cultivo', d: 'M6 14a6 5 0 1 0 12 0 6 5 0 0 0-12 0M9 12h.01M14 16h.01M13 12h.01M12 4v5M12 9l3-3' },
  { id: 'repolho',    nome: 'Repolho',         cat: 'cultivo', d: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 4c-3 4-3 12 0 16M12 4c3 4 3 12 0 16M4 12h16' },
  { id: 'cabaca',     nome: 'Cabaça',          cat: 'cultivo', d: 'M8 21a5 6 0 0 0 8 0c2-3 1-9-4-9s-6 6-4 9zM12 12V7a3 3 0 0 1 3-3' },
  { id: 'raiz_nirn',  nome: 'Raiz de Nirn',    cat: 'cultivo', d: 'M12 21v-8M12 13c-4 0-5-3-5-6 3 0 5 2 5 6zM12 13c4 0 5-3 5-6-3 0-5 2-5 6zM12 5V3M9 21h6' },

  // --- Criação ---
  { id: 'ninho',   nome: 'Ninho de Galinha', cat: 'criacao', d: 'M3 15a9 5 0 0 0 18 0zM8 13a4 4 0 0 1 8 0M12 9.5a2 2.6 0 1 0 .01 0' },
  { id: 'colmeia', nome: 'Colmeia',          cat: 'criacao', d: 'M4 14a8 8 0 0 1 16 0M6 7h12M5 11h14M4 15h16M6 19h12M6 19v2h12v-2' },
  { id: 'peixe_assassino', nome: 'Peixe Assassino', cat: 'criacao', d: 'M20 12c0 2.8-3.4 5-8 5s-8-2.2-8-5 3.4-5 8-5 8 2.2 8 5zM4 12 1 8.5v7zM16 10.5h.01M7.5 12l1.8-1.6 1.8 1.6 1.8-1.6 1.8 1.6' },
  { id: 'farm_salmao',     nome: 'Farm de Carne de Salmão', cat: 'criacao', d: 'M19 9c1.8 0 3 1.3 3 3s-1.2 3-3 3c-3 0-5.5-1.3-6.5-3 1-1.7 3.5-3 6.5-3zM12.5 12 10 10v4zM19.5 11.3h.01M3 4v16M3 8h5M3 13h5M3 18h5' },

  // --- Recurso ---
  { id: 'mina_ferro', nome: 'Mina de Ferro',  cat: 'recurso', d: 'M4 21l9-9M3 8c4-4 12-4 16 0M11 4c-2 4-2 8 0 10M14 11l6 6-2 2-6-6' },
  { id: 'veio',       nome: 'Veio de Minério', cat: 'recurso', d: 'M5 12l4-7 6 2 4 6-4 7H8zM9 5l2 5M15 7l-4 3M11 10l-6 2M11 10l4 6' },
  { id: 'poco',       nome: 'Poço',           cat: 'recurso', d: 'M4 10h16l-2 11H6zM3 10l9-6 9 6M8 10v11M16 10v11' },

  // --- Culto ---
  { id: 'santuario', nome: 'Santuário', cat: 'culto', d: 'M12 3l7 6v12H5V9zM12 8v8M9 12h6' },

  // --- Coringa ---
  { id: 'outro', nome: 'Outro', cat: 'recurso', d: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10' },
];

export const ITEM_POR_ID = Object.fromEntries(TIPOS_ITEM.map((t) => [t.id, t]));
export const COR_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.cor]));

export const nomeItem = (item) => {
  const t = ITEM_POR_ID[item.t];
  const base = t ? t.nome : 'Item';
  return item.d ? `${base} (${item.d})` : base;
};

export const corItem = (item) => COR_CATEGORIA[ITEM_POR_ID[item.t]?.cat] || '#8d8d94';

/** Total de peças catalogadas — serve de "riqueza" da propriedade. */
export const totalItens = (lista) =>
  (Array.isArray(lista) ? lista : []).reduce((s, i) => s + (Number(i.q) || 0), 0);

/** Normaliza catalogação vinda do banco (pode chegar como texto JSON). */
export function lerCatalogacao(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string' && valor.trim().startsWith('[')) {
    try { return JSON.parse(valor); } catch { return []; }
  }
  return [];
}

/**
 * Soma duas listas de catalogação, juntando peças do mesmo tipo e detalhe.
 * `ignorar` deixa de fora tipos que não fazem sentido no território
 * (armazenamento, por exemplo, é da propriedade e não do vilarejo).
 */
export function mesclarItens(base, extras, ignorar = ['armazenamento']) {
  const saida = lerCatalogacao(base).map((i) => ({ ...i }));
  for (const it of lerCatalogacao(extras)) {
    if (ignorar.includes(it.t)) continue;
    const i = saida.findIndex((x) => x.t === it.t && (x.d || '') === (it.d || ''));
    if (i >= 0) saida[i].q = (Number(saida[i].q) || 0) + (Number(it.q) || 0);
    else saida.push({ ...it });
  }
  return saida;
}
