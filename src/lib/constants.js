// ============================================================
//  Riften Hold — Constantes de domínio
//  Extraídas por engenharia reversa da planilha "Gestão Riften Corte"
//  (listas de validação de dados).
// ============================================================

export const RACAS = [
  'Alto Elfo', 'Argoniano', 'Bretão', 'Elfo da Floresta', 'Elfo Negro',
  'Imperial', 'Khajiit', 'Nórdico', 'Orc', 'Redguard',
];

// ------------------------------------------------------------
//  FORÇAS DE RIFTEN
//
//  A força do Hold não é uma coisa só. São três, e a Corte
//  precisa enxergar as três somadas:
//
//    Exército de Riften — a tropa permanente, paga pelo Hold e
//      repartida em Divisões, cada uma com seu capitão.
//    Mesnadas — os homens de armas das casas nobres. A casa os
//      registra e os sustenta; o Hold os conta.
//    Milícia — moradores que se oferecem para a guerra. Ficam na
//      lista até serem convocados para uma campanha, e voltam à
//      vida civil quando ela termina.
//
//  Divisões e patentes NÃO são fixas: vivem em tabelas próprias
//  e a Corte cria, renomeia e reordena como quiser. As listas
//  abaixo são só a semente do primeiro dia.
// ------------------------------------------------------------
export const STATUS_MILITAR = ['Operante', 'Ausente', 'Aposentado'];

export const STATUS_COR = {
  Operante: 'ok',
  Ausente: 'warn',
  Aposentado: 'off',
};

/** As três forças que somam o poderio do Hold. */
export const FORCAS = [
  {
    id: 'exercito',
    nome: 'Exército de Riften',
    curto: 'Exército',
    icone: 'espada',
    cor: '#d8b163',
    resumo: 'Tropa permanente do Hold, dividida em divisões e paga pelo tesouro.',
  },
  {
    id: 'mesnadas',
    nome: 'Mesnadas das Casas',
    curto: 'Mesnadas',
    icone: 'escudo',
    cor: '#9384d1',
    resumo: 'Homens de armas das casas nobres. A casa sustenta; o Hold conta.',
  },
  {
    id: 'milicia',
    nome: 'Milícia de Riften',
    curto: 'Milícia',
    icone: 'estandarte',
    cor: '#c9743a',
    resumo: 'Moradores voluntários, convocados só quando a campanha exige.',
  },
];

export const FORCA_POR_ID = Object.fromEntries(FORCAS.map((f) => [f.id, f]));

/** Cores e ícones que a Corte escolhe ao criar uma divisão. */
export const CORES_DIVISAO = [
  { id: '#d8b163', nome: 'Ouro' },
  { id: '#9384d1', nome: 'Púrpura' },
  { id: '#c9743a', nome: 'Outono' },
  { id: '#6f9f6a', nome: 'Verde' },
  { id: '#7ea6c4', nome: 'Gelo' },
  { id: '#b4574f', nome: 'Sangue' },
];

export const ICONES_DIVISAO = [
  { id: 'espada', nome: 'Espada' },
  { id: 'escudo', nome: 'Escudo' },
  { id: 'arco', nome: 'Arco' },
  { id: 'estandarte', nome: 'Estandarte' },
  { id: 'busca', nome: 'Olho' },
  { id: 'grades', nome: 'Grades' },
  { id: 'coroa', nome: 'Coroa' },
  { id: 'vila', nome: 'Fronteira' },
];

/**
 * As divisões do primeiro dia. Depois disso quem manda é a tabela
 * `divisoes` — a Corte cria, renomeia e dissolve à vontade.
 */
export const DIVISOES_SEED = [
  {
    id: 'div-guarda', nome: 'Guarda da Cidade', ordem: 1, cor: '#d8b163', icone: 'escudo', ativa: true,
    capitao_id: 'g4', capitao: 'Bjorn Cava-Neve',
    funcoes: 'Portões, muralhas e ruas de Riften. Ronda diurna e noturna, prisão em flagrante e escolta de presos até as celas.',
  },
  {
    id: 'div-cavaleiros', nome: 'Cavaleiros Negros', ordem: 2, cor: '#9384d1', icone: 'espada', ativa: true,
    capitao_id: 'g2', capitao: 'Sigrid Punho-de-Ferro',
    funcoes: 'Tropa de choque do Jarl. Vai à frente em campanha e responde às ameaças que a Guarda não segura sozinha.',
  },
  {
    id: 'div-inteligencia', nome: 'Investigação e Inteligência', ordem: 3, cor: '#7ea6c4', icone: 'busca', ativa: true,
    capitao_id: 'g3', capitao: 'Varek Sombra-Rubra',
    funcoes: 'Apura crimes, segue rastros e informa a Corte. Trabalha à paisana quando o caso pede.',
  },
  {
    id: 'div-fronteira', nome: 'Patrulha e Caça de Fronteiras', ordem: 4, cor: '#6f9f6a', icone: 'vila', ativa: true,
    capitao_id: '', capitao: '',
    funcoes: 'Estradas do Rift, Ivarstead e Shor’s Stone. Caça bandidos e feras, e escolta caravanas.',
  },
];

/**
 * A hierarquia do primeiro dia. `ordem` é o peso: quanto maior,
 * mais alto o posto. `salario` é o soldo semanal em Septims.
 */
export const PATENTES_SEED = [
  { id: 'pat-recruta',    nome: 'Recruta',    ordem: 1, salario: 150,  ativa: true, descricao: 'Em treinamento. Não comanda ninguém.' },
  { id: 'pat-soldado',    nome: 'Soldado',    ordem: 2, salario: 300,  ativa: true, descricao: 'Tropa de linha, escalado para ronda e campanha.' },
  { id: 'pat-sargento',   nome: 'Sargento',   ordem: 3, salario: 500,  ativa: true, descricao: 'Toma conta de um punhado de soldados na escala.' },
  { id: 'pat-capitao',    nome: 'Capitão',    ordem: 4, salario: 900,  ativa: true, descricao: 'Comanda uma divisão e responde por ela ao Lorde Comandante.' },
  { id: 'pat-comandante', nome: 'Comandante', ordem: 5, salario: 1500, ativa: true, descricao: 'Lorde Comandante das forças do Hold.' },
];

/** Enquanto a tabela de patentes não carrega, a tela ainda precisa de uma lista. */
export const PATENTES = PATENTES_SEED.map((p) => p.nome);
export const PATENTE_PESO = Object.fromEntries(PATENTES_SEED.map((p) => [p.nome, p.ordem]));
export const DIVISOES = DIVISOES_SEED.map((d) => d.nome);

/** O soldo de quem entra sem patente cadastrada. */
export const SALARIO_PADRAO = 300;

/** O ciclo do pagamento: pagou hoje, só paga de novo daqui a uma semana. */
export const CICLO_SALARIO = 7;

// --- Milícia -------------------------------------------------
export const SITUACOES_MILICIA = ['Disponível', 'Convocado', 'Dispensado'];
export const SITUACAO_MILICIA_TOM = {
  'Disponível': 'ok', Convocado: 'gold', Dispensado: 'off',
};

export const STATUS_CAMPANHA = ['Preparação', 'Em campanha', 'Encerrada'];
export const STATUS_CAMPANHA_TOM = {
  'Preparação': 'warn', 'Em campanha': 'gold', Encerrada: 'off',
};

/** Soldo de campanha sugerido para o miliciano convocado. */
export const SOLDO_MILICIA = 200;

// --- Perícias ------------------------------------------------
// Níveis na ordem de progressão (a planilha listava em ordem alfabética).
export const NIVEIS = ['N/A', 'Novato', 'Aprendiz', 'Adepto', 'Especialista', 'Mestre'];
export const NIVEL_VALOR = { 'N/A': 0, Novato: 1, Aprendiz: 2, Adepto: 3, Especialista: 4, Mestre: 5 };

export const GRUPOS_PERICIA = [
  {
    id: 'uma_mao',
    nome: 'Armas de Uma Mão',
    icone: 'sword',
    pericias: ['Assassino', 'Batedor', 'Cavaleiro', 'Precursor', 'Espião', 'Bandido', 'Berserker', 'Brutamontes'],
  },
  {
    id: 'duas_maos',
    nome: 'Armas de Duas Mãos',
    icone: 'axe',
    pericias: ['Arqueiro', 'Espadachim', 'Lâmina', 'Lenhador de Guerra', 'Destruidor', 'Monge', 'Lanceiro', 'Guarda'],
  },
  {
    id: 'armaduras',
    nome: 'Armaduras',
    icone: 'shield',
    pericias: ['Soldado', 'Cavaleiro Pesado', 'Escudeiro'],
  },
  {
    id: 'magias',
    nome: 'Magias',
    icone: 'spell',
    pericias: ['Conjurador', 'Encantador', 'Místico', 'Feiticeiro', 'Ilusionista', 'Curandeiro'],
  },
];

export const TODAS_PERICIAS = GRUPOS_PERICIA.flatMap((g) => g.pericias);

// --- Trabalho civil -----------------------------------------
export const PROFISSOES = [
  'Alfaiate-Curtidor', 'Alquimista', 'Caçador', 'Cozinheiro', 'Fazendeiro',
  'Ferreiro-Armamentista', 'Ferreiro-Armeiro', 'Herbalista', 'Joalheiro',
  'Lenhador', 'Minerador',
];

// --- Corte ---------------------------------------------------
// Os seis cargos definidos pela Corte. Para acrescentar outro,
// basta incluir aqui (o id vira a chave no banco).
export const CARGOS_CORTE = [
  { id: 'jarl', nome: 'Jarl', ordem: 1, descricao: 'Soberano do Hold de Riften.' },
  { id: 'lorde_mao', nome: 'Lorde Mão', ordem: 2, descricao: 'Braço direito do Jarl. Responde pelas questões de nobreza.' },
  { id: 'lorde_comandante', nome: 'Lorde Comandante', ordem: 3, descricao: 'Comanda o Exército de Riften e a Guarda da Cidade.' },
  { id: 'mestre_moeda', nome: 'Mestre da Moeda', ordem: 4, descricao: 'Responde pelo tesouro e pelas concessões de comércio.' },
  { id: 'mago_corte', nome: 'Mago da Corte', ordem: 5, descricao: 'Conselheiro arcano do Hold.' },
  { id: 'alquimista_corte', nome: 'Alquimista da Corte', ordem: 6, descricao: 'Responde pela alquimia e pelo herbalismo da Corte.' },
];

// Títulos de nobreza atribuíveis a personagens fora dos cargos executivos.
/**
 * Quem chefia a casa é Patriarca ou Matriarca. Não há outro título de liderança —
 * é o que distingue o chefe da dinastia, e nada mais.
 */
export const TITULOS_LIDER = ['Patriarca', 'Matriarca'];

/**
 * Os títulos da Nobreza de Riften. Quem entra numa casa entra como Nobre;
 * a Corte é quem eleva a Lorde, Lady ou Thane. Quem não está em casa
 * nenhuma é Plebeu — não é título, é a ausência de um.
 */
export const TITULOS_NOBREZA = ['Nobre', 'Lorde', 'Lady', 'Thane'];
export const PLEBEU = 'Plebeu';
export const TITULO_NOBREZA_TOM = {
  Nobre: 'roxo', Lorde: 'gold', Lady: 'gold', Thane: 'ok', [PLEBEU]: 'off',
};

export const STATUS_CLA = ['Ativo', 'Em ascensão', 'Em declínio', 'Exilado', 'Extinto'];

// ------------------------------------------------------------
//  CHANCELARIA DA NOBREZA
//
//  Nada na nobreza acontece sozinho: tudo passa por um pedido à
//  Corte, e todo pedido tem uma taxa em Septims. É a Corte que
//  defere ou indefere, sempre com parecer escrito.
//
//  O caminho é sempre o mesmo:
//    civil com propriedade → pede nobreza (50.000)
//    nobre                 → funda a casa (aval, sem taxa)
//    casa fundada          → herdeiro, mesnada, aliança, sede, insígnia
// ------------------------------------------------------------
export const SITUACOES_CASA = ['Pendente', 'Aprovada', 'Recusada'];
export const SITUACAO_CASA_TOM = { Pendente: 'warn', Aprovada: 'ok', Recusada: 'perigo' };

/** O lema da casa é uma frase curta — cabe num estandarte. */
export const MAX_LEMA = 40;

export const TIPOS_PEDIDO_CASA = [
  {
    id: 'nobreza',
    nome: 'Título de nobreza',
    curto: 'Nobreza',
    custo: 50000,
    icone: 'coroa',
    resumo: 'Direito de fundar a própria casa nobre.',
    exige: 'Ter ao menos uma propriedade registrada em seu nome — casa, comércio ou fortaleza.',
  },
  {
    id: 'fundacao',
    nome: 'Fundação de casa nobre',
    curto: 'Fundação',
    custo: 0,
    icone: 'estandarte',
    resumo: 'A casa só existe depois que a Corte reconhece o nome, o brasão e a sede.',
    exige: 'Ter o título de nobreza concedido.',
  },
  {
    id: 'insignia',
    nome: 'Alteração de brasão ou lema',
    curto: 'Insígnia',
    custo: 5000,
    icone: 'estandarte',
    resumo: 'Trocar o estandarte da casa depois de fundada.',
    exige: 'Casa reconhecida pela Corte.',
  },
  {
    id: 'herdeiro',
    nome: 'Registro de Herdeiro Oficial',
    curto: 'Herdeiro',
    custo: 3500,
    icone: 'pergaminho',
    resumo: 'Quem responde pela casa quando o chefe falta.',
    exige: 'Casa reconhecida. Não se registra herdeiro antes da casa existir.',
  },
  {
    id: 'mesnada',
    nome: 'Registro de Mesnada',
    curto: 'Mesnada',
    custo: 10000,
    icone: 'escudo',
    resumo: 'Direito de manter homens de armas sob a bandeira da casa.',
    exige: 'Casa reconhecida pela Corte.',
  },
  {
    id: 'alianca',
    nome: 'Aliança entre casas',
    curto: 'Aliança',
    custo: 10000,
    icone: 'selo',
    resumo: 'Pacto declarado entre duas casas, lavrado pela Corte.',
    exige: 'A casa convidada precisa aceitar antes de a Corte julgar.',
  },
  {
    id: 'sede',
    nome: 'Transferência de sede',
    curto: 'Sede',
    custo: 8000,
    icone: 'casa',
    resumo: 'Mudar qual propriedade é a sede principal da casa.',
    exige: 'Ter mais de uma propriedade registrada em seu nome.',
  },
];
export const PEDIDO_CASA_POR_ID = Object.fromEntries(TIPOS_PEDIDO_CASA.map((t) => [t.id, t]));
export const TAXA_DE = (tipo) => PEDIDO_CASA_POR_ID[tipo]?.custo ?? 0;

export const STATUS_PEDIDO_CASA = ['Rascunho', 'Aguardando casa', 'Pendente', 'Deferido', 'Indeferido', 'Recusado pela casa'];
export const STATUS_PEDIDO_CASA_TOM = {
  Rascunho: 'off',
  'Aguardando casa': 'roxo',
  Pendente: 'warn',
  Deferido: 'ok',
  Indeferido: 'perigo',
  'Recusado pela casa': 'perigo',
};

// --- Propriedades -------------------------------------------
// Tipos que aparecem na tela de Comércios.
export const TIPOS_COMERCIO = [
  'Comércio', 'Taverna', 'Fazenda', 'Serraria', 'Mina', 'Doca', 'Estábulo', 'Oficina',
];
// Tipos residenciais — vivem dentro do vilarejo, não no comércio.
export const TIPOS_RESIDENCIA = ['Casa', 'Solar', 'Cabana', 'Mansão'];
// O que é defesa ou bem institucional do Hold.
export const TIPOS_FORTALEZA = [
  'Forte', 'Torre', 'Fortaleza', 'Posto Avançado', 'Propriedade da Corte', 'Templo',
];
export const TIPOS_PROPRIEDADE = [...TIPOS_RESIDENCIA, ...TIPOS_COMERCIO, ...TIPOS_FORTALEZA];
export const ehResidencia = (tipo) => TIPOS_RESIDENCIA.includes(tipo);

export const STATUS_PROPRIEDADE = ['Operante', 'Vaga', 'Interditada', 'Em obras', 'Arruinada'];

// ------------------------------------------------------------
//  IMOBILIÁRIA
//
//  Todo imóvel do Hold cai em uma de três categorias, e é por elas
//  que a Corte cadastra e o morador procura. Cada categoria tem uma
//  avaliação-base: o valor que a Corte atribui ao imóvel quando ele
//  entra no registro. É sugestão, não trava — a Corte muda por
//  imóvel, e o dono pede o preço que quiser ao anunciar.
// ------------------------------------------------------------
export const CATEGORIAS_IMOVEL = [
  {
    id: 'casa',
    nome: 'Casas',
    singular: 'Casa',
    artigo: 'a',
    icone: 'casa',
    base: 15000,
    tipos: TIPOS_RESIDENCIA,
    resumo: 'Moradias do Hold — onde os moradores vivem.',
  },
  {
    id: 'comercio',
    nome: 'Comércios',
    singular: 'Comércio',
    artigo: 'o',
    icone: 'moeda',
    base: 40000,
    tipos: TIPOS_COMERCIO,
    resumo: 'Casas de negócio: o que produz, vende ou hospeda.',
  },
  {
    id: 'fortaleza',
    nome: 'Fortalezas',
    singular: 'Fortaleza',
    artigo: 'a',
    icone: 'escudo',
    base: 80000,
    tipos: TIPOS_FORTALEZA,
    resumo: 'Defesas e bens institucionais do Hold.',
  },
];
export const CATEGORIA_POR_ID = Object.fromEntries(CATEGORIAS_IMOVEL.map((c) => [c.id, c]));
export const CATEGORIA_PADRAO = 'comercio';

/** A categoria de um tipo de imóvel, para o que foi cadastrado antes disto. */
export function categoriaDoTipo(tipo) {
  const achada = CATEGORIAS_IMOVEL.find((c) => c.tipos.includes(tipo));
  return achada ? achada.id : CATEGORIA_PADRAO;
}

/** Situação de uma proposta de compra. */
export const STATUS_OFERTA = ['Aberta', 'Aceita', 'Recusada', 'Retirada'];
export const STATUS_OFERTA_TOM = {
  Aberta: 'warn', Aceita: 'ok', Recusada: 'perigo', Retirada: 'off',
};

// --- Registro Civil ------------------------------------------
export const STATUS_CIVIL = ['Pendente', 'Aprovado', 'Recusado'];
export const STATUS_CIVIL_TOM = { Pendente: 'warn', Aprovado: 'ok', Recusado: 'perigo' };

// ------------------------------------------------------------
//  CIDADANIA
//  Quem nasceu em Riften já é do Hold. Quem vem de outra cidade
//  está transferindo a cidadania — e aí pode precisar de isenção,
//  que é ato da Corte: ela concede ou nega, com parecer.
// ------------------------------------------------------------
export const ORIGENS = [
  {
    id: 'natal',
    nome: 'Riften é minha Cidade Natal',
    resumo: 'Nasci e fui criado no Hold — não há cidadania anterior a desfazer.',
    icone: 'casa',
  },
  {
    id: 'transferencia',
    nome: 'Venho de outra Cidade',
    resumo: 'Estou transferindo minha cidadania para Riften — a troca custa 5.000 septims.',
    icone: 'mapa',
  },
];
export const ORIGEM_POR_ID = Object.fromEntries(ORIGENS.map((o) => [o.id, o]));

/** Quanto custa, no jogo, trocar de cidadania. */
export const CUSTO_CIDADANIA = 5000;
export const CUSTO_CIDADANIA_TXT = '5.000 septims';

/**
 * A regra da isenção, escrita uma vez só e repetida em todo lugar que
 * fala dela: registro público, quadro da Corte e ficha do morador.
 */
export const REGRA_ISENCAO =
  'A troca de cidadania custa 5.000 septims. A isenção existe para quem não tem '
  + 'condições de pagar esse valor. Se você ainda tem a troca gratuita disponível '
  + 'no sistema do jogo, use ela e não solicite isenção.';

/** Estado do pedido de isenção. "Não pedida" é a ausência de pedido. */
export const SEM_ISENCAO = 'Não pedida';
export const STATUS_ISENCAO = [SEM_ISENCAO, 'Pendente', 'Concedida', 'Negada'];
export const STATUS_ISENCAO_TOM = {
  [SEM_ISENCAO]: 'off', Pendente: 'warn', Concedida: 'ok', Negada: 'perigo',
};

/** Onde o morador encontra o ID dentro do jogo. */
export const ONDE_ACHAR_ID = 'No jogo: tecla K → aba CONTA → CONFIG.';

// ============================================================
//  EMISSÃO DE LICENÇAS
// ============================================================

export const STATUS_LICENCA = ['Ativa', 'Suspensa', 'Revogada', 'Expirada'];
export const STATUS_LICENCA_TOM = {
  Ativa: 'ok', Suspensa: 'warn', Revogada: 'perigo', Expirada: 'off',
};

/** Minérios que a Corte pode autorizar. A cor é a do minério no jogo. */
export const MINERIOS = [
  { id: 'ferro',       nome: 'Ferro',        cor: '#8d8d94' },
  { id: 'corindon',    nome: 'Coríndon',     cor: '#c2603f' },
  { id: 'mercurio',    nome: 'Mercúrio',     cor: '#b6c2ca' },
  { id: 'prata',       nome: 'Prata',        cor: '#d2d7dc' },
  { id: 'ouro',        nome: 'Ouro',         cor: '#d8b163' },
  { id: 'oricalco',    nome: 'Oricalco',     cor: '#7f9c5a' },
  { id: 'pedra_lua',   nome: 'Pedra da Lua', cor: '#9db8d8' },
  { id: 'malaquita',   nome: 'Malaquita',    cor: '#4fae8f' },
  { id: 'ebano',       nome: 'Ébano',        cor: '#7a6a88' },
];
export const MINERIO_POR_ID = Object.fromEntries(MINERIOS.map((m) => [m.id, m]));

/**
 * Tipos de licença. Cada tipo define o que pode ser habilitado nela.
 * Para criar um tipo novo, acrescente uma entrada aqui — a tela se adapta.
 */
export const TIPOS_LICENCA = [
  {
    id: 'mineracao',
    prefixo: 'MIN',
    nome: 'Licença de Mineração',
    icone: 'picareta',
    resumo: 'Autoriza extração mineral no território do Hold.',
    coberturas: [
      { id: 'veios', nome: 'Exploração dos Veios de Minérios' },
      { id: 'minas', nome: 'Exploração das Minas' },
    ],
    // Recursos que a licença pode liberar (aqui, os minérios).
    recursos: MINERIOS,
    rotuloRecursos: 'Minérios autorizados',
    escolta: {
      rotulo: 'Direito a escolta',
      descricao: 'Escolta da Guarda até o veio de minério ou a mina, conforme o acordo.',
    },
  },
  {
    id: 'comercio',
    prefixo: 'COM',
    nome: 'Licença de Comércio e Caravanas',
    icone: 'moeda',
    resumo: 'Autoriza vender no Hold e mover caravanas pelas estradas da Rift.',
    coberturas: [
      { id: 'feira', nome: 'Venda em feira e praça' },
      { id: 'caravana', nome: 'Caravana pelas estradas do Hold' },
      { id: 'fora', nome: 'Rota para fora da Rift' },
      { id: 'entreposto', nome: 'Entreposto e armazenagem' },
    ],
    recursos: [],
    rotuloRecursos: 'Mercadorias autorizadas',
    escolta: {
      rotulo: 'Escolta de caravana',
      descricao: 'Guarda acompanhando a carga até a divisa do Hold, conforme o acordo.',
    },
  },
  {
    id: 'exploracao',
    prefixo: 'EXP',
    nome: 'Licença de Exploração e Caça',
    icone: 'espada',
    resumo: 'Autoriza entrar em ruínas e cavernas do Hold, e caçar o que ameaça as estradas.',
    coberturas: [
      { id: 'cavernas', nome: 'Cavernas e covis' },
      { id: 'ruinas', nome: 'Ruínas nórdicas e cripta' },
      { id: 'caca', nome: 'Caça de feras e bandidos' },
      { id: 'resgate', nome: 'Resgate e recuperação de bens' },
    ],
    recursos: [],
    rotuloRecursos: 'Trofeus e despojos autorizados',
    escolta: {
      rotulo: 'Apoio da Guarda',
      descricao: 'A Guarda dá cobertura na boca da caverna, sem entrar com o grupo.',
    },
  },
  {
    id: 'culto',
    prefixo: 'CUL',
    nome: 'Licença de Culto',
    icone: 'pergaminho',
    resumo: 'Autoriza culto e rito no Hold — a Corte tolera a fé, mas quer saber qual.',
    coberturas: [
      { id: 'templo', nome: 'Templo ou santuário próprio' },
      { id: 'publico', nome: 'Rito em praça pública' },
      { id: 'peregrinacao', nome: 'Peregrinação pelas estradas' },
      { id: 'sepultamento', nome: 'Sepultamento e ritos fúnebres' },
    ],
    recursos: [],
    rotuloRecursos: 'Ritos autorizados',
    escolta: {
      rotulo: 'Proteção da Guarda no rito',
      descricao: 'A Guarda mantém a ordem em rito público, quando a Corte julgar necessário.',
    },
  },
];
export const TIPO_LICENCA_POR_ID = Object.fromEntries(TIPOS_LICENCA.map((t) => [t.id, t]));

/**
 * Um recurso da licença — o minério, a mercadoria, o rito. Cada tipo
 * traz a sua própria lista; sem ela, vale o id escrito.
 */
export function recursoDaLicenca(tipoId, recursoId) {
  const tipo = TIPO_LICENCA_POR_ID[tipoId];
  const achado = (tipo?.recursos || []).find((r) => r.id === recursoId);
  return achado || MINERIO_POR_ID[recursoId] || { id: recursoId, nome: recursoId, cor: '#8d8d94' };
}

/** Quem pode ser titular de uma licença. */
export const TITULARES_LICENCA = [
  { id: 'civil', nome: 'Morador', resumo: 'Vale para a pessoa nomeada.' },
  { id: 'guilda', nome: 'Clã', resumo: 'Vale para o clã e para todos os membros dele.' },
];

// ============================================================
//  CLÃS E GUILDAS
//
//  O clã é a organização dos moradores: um grupo que se registra
//  na Corte, diz a que veio e recebe (ou não) o reconhecimento.
//  Não confundir com as Casas Nobres — aquelas são linhagem, e
//  vivem na tabela `clas`. Estas vivem em `guildas`.
//
//  Cada tipo carrega uma proposta de roleplay diferente: é o que
//  o clã se propõe a fazer no Hold, e o que a Corte cobra dele.
// ============================================================
export const TIPOS_GUILDA = [
  {
    id: 'sociedade',
    nome: 'Sociedade',
    artigo: 'a',
    icone: 'selo',
    cor: '#9384d1',
    resumo: 'Associação civil de interesse comum.',
    proposta: 'Gente que se junta por um propósito que não é lucro nem aventura: um grêmio '
      + 'de ofício, uma ordem de estudos, uma sociedade de auxílio mútuo, um conselho de '
      + 'bairro. O roleplay é de convívio, política miúda e influência dentro do Hold.',
    ganchos: [
      'Grêmio de ofício que arbitra disputas entre artesãos',
      'Sociedade de auxílio aos que voltam da prisão',
      'Círculo de estudos e biblioteca da cidade',
      'Ordem de etiqueta e mediação entre casas',
    ],
    licencas: ['comercio'],
  },
  {
    id: 'comercial',
    nome: 'Guilda Comercial',
    artigo: 'a',
    icone: 'moeda',
    cor: '#d8b163',
    resumo: 'Comércio, caravanas e rotas.',
    proposta: 'A guilda que move mercadoria. O roleplay gira em torno de caravanas, rotas, '
      + 'preços, entrepostos e contratos de fornecimento — e dos riscos da estrada: bandidos, '
      + 'neve, taxa de passagem e concorrente mal-intencionado.',
    ganchos: [
      'Caravana regular entre Riften e Ivarstead',
      'Entreposto que compra a produção das fazendas',
      'Contrato de fornecimento com o Quartel',
      'Rota nova pela estrada do leste, ainda perigosa',
    ],
    licencas: ['comercio', 'mineracao'],
  },
  {
    id: 'aventureiro',
    nome: 'Clã de Aventureiros',
    artigo: 'o',
    icone: 'espada',
    cor: '#c9743a',
    resumo: 'Escolta, exploração e caça.',
    proposta: 'O bando que aceita o serviço que ninguém quer. O roleplay é de escolta de '
      + 'caravana, exploração de caverna e ruína, caça a feras e bandidos, resgate de gente '
      + 'e de bens — trabalho pago por contrato, com risco de não voltar.',
    ganchos: [
      'Escolta armada para caravanas e peregrinos',
      'Limpeza de covil que ameaça um vilarejo',
      'Exploração de cripta nórdica a pedido da Corte',
      'Caça a bandido com preço na cabeça',
    ],
    licencas: ['exploracao', 'mineracao'],
  },
  {
    id: 'religioso',
    nome: 'Clã Religioso',
    artigo: 'o',
    icone: 'pergaminho',
    cor: '#86a95d',
    resumo: 'Culto, rito e fé — divina ou daédrica.',
    proposta: 'A congregação em torno de uma fé: culto a um dos Divinos, devoção a um '
      + 'Daedra, ordem monástica ou seita fechada. O roleplay é de rito, pregação, '
      + 'peregrinação e do atrito que a fé provoca — a Corte tolera o culto declarado, '
      + 'e desconfia do que se esconde.',
    ganchos: [
      'Culto a Mara com casamentos e bênçãos na cidade',
      'Devoção discreta a um Daedra, tolerada sob vigilância',
      'Ordem que cuida dos mortos e das criptas do Hold',
      'Peregrinação anual a um santuário na montanha',
    ],
    licencas: ['culto'],
  },
];
export const TIPO_GUILDA_POR_ID = Object.fromEntries(TIPOS_GUILDA.map((t) => [t.id, t]));

export const SITUACOES_GUILDA = ['Pendente', 'Aprovado', 'Recusado', 'Dissolvido'];
export const SITUACAO_GUILDA_TOM = {
  Pendente: 'warn', Aprovado: 'ok', Recusado: 'perigo', Dissolvido: 'off',
};

/** Cargos dentro do clã. O líder é sempre quem registrou. */
export const CARGOS_GUILDA = ['Membro', 'Braço-direito', 'Veterano', 'Iniciado', 'Emissário'];

// ============================================================
//  REGISTRO DE PRISÕES
// ============================================================

/** Os nove Holds — exatamente estes nomes, nada além disso. */
export const HOLDS = [
  { id: 'windhelm',   nome: 'Windhelm' },
  { id: 'falkreath',  nome: 'Falkreath' },
  { id: 'solitude',   nome: 'Solitude' },
  { id: 'morthal',    nome: 'Morthal' },
  { id: 'dawnstar',   nome: 'Dawnstar' },
  { id: 'markarth',   nome: 'Markarth' },
  { id: 'riften',     nome: 'Riften' },
  { id: 'whiterun',   nome: 'Whiterun' },
  { id: 'winterhold', nome: 'Winterhold' },
];
export const HOLD_POR_ID = Object.fromEntries(HOLDS.map((h) => [h.id, h]));
export const rotuloHold = (id) => HOLD_POR_ID[id]?.nome || id || '—';

// ============================================================
//  EDITAIS E CONTRATOS
//  O Hold pede, a cidade se oferece. Palácio, Quartel e os próprios
//  comércios abrem editais; trabalhadores e comércios se inscrevem
//  com preço e prazo, e a proposta escolhida vira contrato.
// ============================================================

/** O que um edital pede. */
export const TIPOS_EDITAL = [
  {
    id: 'Fornecimento',
    icone: 'caixa',
    resumo: 'O Hold precisa de itens entregues — minérios, lingotes, poções, mantimentos.',
    temItens: true, temPreco: true, temVagas: false, temPericias: false,
  },
  {
    id: 'Serviço',
    icone: 'martelo',
    resumo: 'Um trabalho a ser feito — obra, escolta, reparo, colheita.',
    temItens: false, temPreco: true, temVagas: true, temPericias: false,
  },
  {
    id: 'Recrutamento',
    icone: 'escudo',
    resumo: 'Chamado por gente: vagas de trabalho ou alistamento, com exigência de habilidade.',
    temItens: false, temPreco: false, temVagas: true, temPericias: true,
  },
];
export const TIPO_EDITAL_POR_ID = Object.fromEntries(TIPOS_EDITAL.map((t) => [t.id, t]));

/**
 * Quem pode responder. Recrutamento é sempre só de pessoas: comércio
 * nenhum veste uma armadura.
 */
export const MODALIDADES = [
  { id: 'trabalhador', nome: 'Trabalhadores', icone: 'pessoa',
    ajuda: 'Moradores com profissão no Registro Civil.' },
  { id: 'propriedade', nome: 'Comércios', icone: 'casa',
    ajuda: 'Quem responde por uma propriedade — dono ou funcionário.' },
];

/** Quando a coisa chega. O edital fixa o teto; a proposta oferece o seu. */
export const PRAZOS = ['Imediata', 'Em até 7 dias', 'Em até 1 mês'];
export const PRAZO_PESO = { Imediata: 1, 'Em até 7 dias': 2, 'Em até 1 mês': 3 };
export const PRAZO_TOM = { Imediata: 'ok', 'Em até 7 dias': 'warn', 'Em até 1 mês': '' };

export const STATUS_EDITAL = ['Aberto', 'Contratado', 'Cumprido', 'Rompido', 'Cancelado'];
export const STATUS_EDITAL_TOM = {
  Aberto: 'warn', Contratado: 'roxo', Cumprido: 'ok', Rompido: 'perigo', Cancelado: 'off',
};

export const STATUS_PROPOSTA = ['Enviada', 'Aceita', 'Recusada'];
export const STATUS_PROPOSTA_TOM = { Enviada: 'warn', Aceita: 'ok', Recusada: 'perigo' };

/** Os órgãos que abrem edital, e como assinam. */
export const ORGAOS = {
  corte: { nome: 'Palácio do Jarl', icone: 'coroa' },
  quartel: { nome: 'Quartel General', icone: 'espada' },
  propriedade: { nome: 'Comércio', icone: 'casa' },
};

export const STATUS_PRISAO = ['Cumprindo pena', 'Sentença cumprida', 'Solto sob fiança', 'Anulada'];
export const STATUS_PRISAO_TOM = {
  'Cumprindo pena': 'warn',
  'Sentença cumprida': 'ok',
  'Solto sob fiança': 'roxo',
  Anulada: 'off',
};

// ------------------------------------------------------------
//  TESOURARIA DO HOLD
//
//  O cofre não é um campo que alguém edita: é um livro-caixa. Cada
//  linha tem data, valor, origem e autor, e o saldo é a soma. Como
//  a plataforma não conversa com o jogo, a Corte declara o saldo
//  real quando quiser — e a declaração também é uma linha, com a
//  razão escrita. Assim é impossível mexer no cofre sem rastro.
//
//  Do lado do dinheiro que entra, tudo é a mesma coisa: uma
//  COBRANÇA. A multa da prisão, a fiança, a licença emitida, o
//  imóvel vendido pelo Palácio, a taxa da chancelaria e o título
//  que a Corte lavra à mão são todos o mesmo registro, com origens
//  diferentes. Só a cobrança confirmada vira dinheiro no cofre.
// ------------------------------------------------------------

/** Os três tipos de linha do livro-caixa. */
export const TIPOS_LANCAMENTO = ['entrada', 'saida', 'ajuste'];

/**
 * De onde o dinheiro veio ou para onde foi. `sinal` diz se a origem
 * é de receita (+1) ou de despesa (−1); o ajuste não tem sinal fixo.
 */
export const ORIGENS_COFRE = [
  { id: 'multa',        nome: 'Multas',                  sinal: 1,  icone: 'grades',     cor: '#b4574f' },
  { id: 'fianca',       nome: 'Fianças',                 sinal: 1,  icone: 'chave',      cor: '#c9743a' },
  { id: 'licenca',      nome: 'Licenças',                sinal: 1,  icone: 'pergaminho', cor: '#d8b163' },
  { id: 'imovel',       nome: 'Venda de imóveis',        sinal: 1,  icone: 'casa',       cor: '#6f9f6a' },
  { id: 'transmissao',  nome: 'Escrituras',              sinal: 1,  icone: 'selo',       cor: '#7ea6c4' },
  { id: 'chancelaria',  nome: 'Taxas da nobreza',        sinal: 1,  icone: 'coroa',      cor: '#9384d1' },
  { id: 'titulo',       nome: 'Títulos de dívida',       sinal: 1,  icone: 'balanca',    cor: '#c9a227' },
  { id: 'folha',        nome: 'Soldo da tropa',          sinal: -1, icone: 'espada',     cor: '#b4574f' },
  { id: 'cidadania',    nome: 'Cidadania paga pelo Hold', sinal: -1, icone: 'pessoa',    cor: '#9384d1' },
  { id: 'compra',       nome: 'Compras e suprimentos',   sinal: -1, icone: 'caixa',      cor: '#c9743a' },
  { id: 'retirada',     nome: 'Retiradas para o jogo',   sinal: -1, icone: 'saidaItem',  cor: '#7b7266' },
  { id: 'obra',         nome: 'Obras e reparos',         sinal: -1, icone: 'martelo',    cor: '#6f9f6a' },
  { id: 'outro',        nome: 'Outros',                  sinal: 0,  icone: 'moeda',      cor: '#7b7266' },
  { id: 'ajuste',       nome: 'Ajuste de saldo',         sinal: 0,  icone: 'balanca',    cor: '#7ea6c4' },
];
export const ORIGEM_COFRE_POR_ID = Object.fromEntries(ORIGENS_COFRE.map((o) => [o.id, o]));

/** As origens que a Corte escolhe ao registrar uma saída à mão. */
export const ORIGENS_SAIDA = ORIGENS_COFRE.filter(
  (o) => ['cidadania', 'compra', 'retirada', 'obra', 'outro'].includes(o.id),
);

/** As origens que geram cobrança — receita, portanto. */
export const ORIGENS_COBRANCA = ORIGENS_COFRE.filter((o) => o.sinal === 1);

/**
 * O caminho de uma cobrança. O jogador paga dentro do jogo e declara
 * aqui; quem confirma é sempre a Corte, e é a confirmação que vira
 * dinheiro no cofre.
 */
export const STATUS_COBRANCA = ['Em aberto', 'Pagamento declarado', 'Paga', 'Cancelada'];
export const STATUS_COBRANCA_TOM = {
  'Em aberto': 'warn',
  'Pagamento declarado': 'roxo',
  Paga: 'ok',
  Cancelada: 'off',
};

/** Quem pode dever ao Hold. */
export const DEVEDORES = [
  { id: 'civil',       nome: 'Morador',        icone: 'pessoa',      tabela: 'civis' },
  { id: 'propriedade', nome: 'Propriedade',    icone: 'casa',        tabela: 'propriedades' },
  { id: 'casa',        nome: 'Casa nobre',     icone: 'estandarte',  tabela: 'clas' },
];
export const DEVEDOR_POR_ID = Object.fromEntries(DEVEDORES.map((x) => [x.id, x]));

/**
 * A tabela de preços do Hold, editável pela Tesouraria. A chave é
 * `sistema:item`; o que está aqui é só o valor do primeiro dia, e a
 * linha gravada em `precos` manda quando existe.
 */
export const PRECOS_PADRAO = [
  { chave: 'licenca:mineracao',  nome: 'Licença de Mineração',            valor: 2500, grupo: 'Licenças' },
  { chave: 'licenca:comercio',   nome: 'Licença de Comércio e Caravanas', valor: 3500, grupo: 'Licenças' },
  { chave: 'licenca:exploracao', nome: 'Licença de Exploração e Caça',    valor: 2000, grupo: 'Licenças' },
  { chave: 'licenca:culto',      nome: 'Licença de Culto',                valor: 1500, grupo: 'Licenças' },
  { chave: 'imovel:transmissao', nome: 'Escritura de venda entre jogadores', valor: 2000, grupo: 'Imobiliária' },
  { chave: 'cidadania:troca',    nome: 'Troca de cidadania',              valor: CUSTO_CIDADANIA, grupo: 'Registro Civil' },
];
export const PRECO_PADRAO_POR_CHAVE = Object.fromEntries(PRECOS_PADRAO.map((p) => [p.chave, p]));
