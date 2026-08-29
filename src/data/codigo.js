// ============================================================
//  CÓDIGO DE RIFTEN
//  Promulgado por Artorias Blackwing, Jarl de Riften,
//  em nome de Sua Majestade o Rei Jarehk, da Coroa de Valois.
//
//  Transcrição das penas para uso no Registro de Prisões:
//  escolher o crime já traz tempo de prisão, multa e fiança.
//  Valores em Septims. `multa: null` = pena não pecuniária
//  (o texto está em `multaTexto`). `fianca: null` = sem fiança.
// ============================================================

export const SECOES_CODIGO = [
  { id: 'leves',     nome: 'Crimes Leves',     titulo: 'Título III · I',   tom: 'warn' },
  { id: 'graves',    nome: 'Crimes Graves',    titulo: 'Título III · II',  tom: 'laranja' },
  { id: 'hediondos', nome: 'Crimes Hediondos', titulo: 'Título III · III', tom: 'perigo' },
  { id: 'armas',     nome: 'Das Armas',        titulo: 'Título VI',        tom: 'roxo' },
  { id: 'minas',     nome: 'Das Minas',        titulo: 'Título VIII',      tom: 'gold' },
  { id: 'comercio',  nome: 'Do Comércio',      titulo: 'Título XII',       tom: 'gold' },
];

export const CRIMES = [
  // ---- Título III · I — Crimes Leves ----
  { id: 'c07', artigo: 'Art. 7º',  secao: 'leves', nome: 'Perturbação da ordem pública',  minutos: 5,  multa: 300,  fianca: 600 },
  { id: 'c08', artigo: 'Art. 8º',  secao: 'leves', nome: 'Embriaguez causando desordem',  minutos: 5,  multa: 400,  fianca: 800 },
  { id: 'c09', artigo: 'Art. 9º',  secao: 'leves', nome: 'Desacato sem violência',        minutos: 10, multa: 500,  fianca: 1000 },
  { id: 'c10', artigo: 'Art. 10º', secao: 'leves', nome: 'Pequeno furto',                 minutos: 10, multa: 700,  fianca: 1500,
    obs: 'Além da restituição do bem.' },

  // ---- Título III · II — Crimes Graves ----
  { id: 'c11', artigo: 'Art. 11º', secao: 'graves', nome: 'Roubo',                 minutos: 20, multa: 2500, fianca: 5000 },
  { id: 'c12', artigo: 'Art. 12º', secao: 'graves', nome: 'Agressão',              minutos: 20, multa: 2000, fianca: 4000 },
  { id: 'c13', artigo: 'Art. 13º', secao: 'graves', nome: 'Extorsão',              minutos: 25, multa: 3000, fianca: 6000 },
  { id: 'c14', artigo: 'Art. 14º', secao: 'graves', nome: 'Corrupção',             minutos: 30, multa: 5000, fianca: 10000 },
  { id: 'c15', artigo: 'Art. 15º', secao: 'graves', nome: 'Incêndio criminoso',    minutos: 30, multa: 6000, fianca: 12000 },
  { id: 'c16', artigo: 'Art. 16º', secao: 'graves', nome: 'Formação de quadrilha', minutos: 35, multa: 8000, fianca: 15000 },

  // ---- Título III · III — Crimes Hediondos ----
  { id: 'c17', artigo: 'Art. 17º', secao: 'hediondos', nome: 'Assassinato',                minutos: 60, multa: null, multaTexto: '—',                 fianca: null },
  { id: 'c18', artigo: 'Art. 18º', secao: 'hediondos', nome: 'Tentativa de golpe',         minutos: 60, multa: null, multaTexto: 'Confisco de bens',  fianca: null },
  { id: 'c19', artigo: 'Art. 19º', secao: 'hediondos', nome: 'Espionagem',                 minutos: 45, multa: 10000,                                  fianca: null },
  { id: 'c20', artigo: 'Art. 20º', secao: 'hediondos', nome: 'Traição à Coroa',            minutos: 60, multa: null, multaTexto: 'Confisco total',    fianca: null },
  { id: 'c21', artigo: 'Art. 21º', secao: 'hediondos', nome: 'Terrorismo',                 minutos: 60, multa: null, multaTexto: 'Confisco total',    fianca: null },
  { id: 'c22', artigo: 'Art. 22º', secao: 'hediondos', nome: 'Assassinato de Guarda',      minutos: 60, multa: null, multaTexto: '—',                 fianca: null },
  { id: 'c23', artigo: 'Art. 23º', secao: 'hediondos', nome: 'Atentado contra Autoridades', minutos: 60, multa: null, multaTexto: 'Confisco de bens', fianca: null },
  { id: 'c24', artigo: 'Art. 24º', secao: 'hediondos', nome: 'Furto de minério da Coroa',  minutos: 30, multa: 5000,                                   fianca: 10000 },

  // ---- Título VI — Das Armas ----
  { id: 'a11a', artigo: 'Art. 11º-A', secao: 'armas', nome: 'Sacar arma sem justificativa',        minutos: 10, multa: 1000, fianca: 2000 },
  { id: 'a11b', artigo: 'Art. 11º-B', secao: 'armas', nome: 'Ameaça com arma',                     minutos: 15, multa: 1500, fianca: 3000 },
  { id: 'a11c', artigo: 'Art. 11º-C', secao: 'armas', nome: 'Porte de arma exibida sem necessidade', minutos: 5, multa: 500, fianca: 1000 },
  { id: 'a11d', artigo: 'Art. 11º-D', secao: 'armas', nome: 'Ameaçar outro cidadão',               minutos: 15, multa: 1500, fianca: 3000 },
  { id: 'a11e', artigo: 'Art. 11º-E', secao: 'armas', nome: 'Descumprimento de ordem de guarda',   minutos: 10, multa: 800,  fianca: 1600 },

  // ---- Título VIII — Das Minas ----
  { id: 'm13', artigo: 'Art. 13º', secao: 'minas', nome: 'Mineração sem autorização',  minutos: 15, multa: 2000, fianca: 4000 },
  { id: 'm14', artigo: 'Art. 14º', secao: 'minas', nome: 'Furto de minério da Coroa',  minutos: 30, multa: 5000, fianca: 10000 },

  // ---- Título XII — Do Comércio (Art. 18º) ----
  { id: 'x18a', artigo: 'Art. 18º', secao: 'comercio', nome: 'Vender produtos roubados',        minutos: 15, multa: 2500, fianca: 5000 },
  { id: 'x18b', artigo: 'Art. 18º', secao: 'comercio', nome: 'Falsificar mercadorias',          minutos: 20, multa: 3500, fianca: 7000 },
  { id: 'x18c', artigo: 'Art. 18º', secao: 'comercio', nome: 'Fraudar impostos',                minutos: 25, multa: 5000, fianca: 10000 },
  { id: 'x18d', artigo: 'Art. 18º', secao: 'comercio', nome: 'Manipular preços de forma abusiva', minutos: 15, multa: 2500, fianca: 5000 },
];

export const CRIME_POR_ID = Object.fromEntries(CRIMES.map((c) => [c.id, c]));
export const SECAO_POR_ID = Object.fromEntries(SECOES_CODIGO.map((s) => [s.id, s]));

/** Tempos de pena previstos no Código, para o seletor manual. */
export const TEMPOS_PENA = [...new Set(CRIMES.map((c) => c.minutos))].sort((a, b) => a - b);

export const septims = (n) =>
  n == null ? null : `${Number(n).toLocaleString('pt-BR')} Septims`;

export const textoMulta = (crime) =>
  !crime ? '—' : crime.multa != null ? septims(crime.multa) : (crime.multaTexto || '—');

export const textoFianca = (crime) =>
  !crime ? '—' : crime.fianca != null ? septims(crime.fianca) : 'Sem fiança';
