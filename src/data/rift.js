// ============================================================
//  DADOS DA CORTE DE RIFTEN
//
//  Origem única: a planilha "Gestão Riften Corte".
//  Nada aqui é inventado. Campo em branco na planilha continua
//  em branco aqui.
//
//  A catalogação é estruturada: cada peça é { t: tipo, q: quantidade,
//  d: detalhe opcional }. Os tipos estão em src/data/itens.js.
// ============================================================

/** Aba "Vilareijos". A catalogação do território é do vilarejo, não de uma propriedade. */
export const ASSENTAMENTOS = [
  {
    id: 'riften',
    nome: 'Riften',
    tipo: 'Cidade',
    lorde: null,
    catalogacao: [],
    descricao: 'Capital do Hold. Sede da Corte.',
  },
  {
    id: 'ivarstead',
    nome: 'Ivarstead',
    tipo: 'Vilarejo',
    lorde: null,
    // Estruturas e cultivo da Fellstar Farm contam também como território
    // de Ivarstead. Inventários de armazenamento ficam só na ficha da fazenda.
    catalogacao: [
      { t: 'bancada', q: 1, d: 'Simple' },
      { t: 'tanning', q: 1 },
      { t: 'repolho', q: 15 },
      { t: 'batata', q: 11 },
      { t: 'trigo', q: 6 },
      { t: 'ninho', q: 4 },
      { t: 'pedra_amolar', q: 1 },
      { t: 'bloco_corte', q: 1 },
    ],
    descricao: '',
  },
  {
    id: 'shors_stone',
    nome: "Shor's Stone",
    tipo: 'Vilarejo',
    lorde: null,
    catalogacao: [
      { t: 'forja', q: 1 },
      { t: 'tanning', q: 1 },
      { t: 'pedra_amolar', q: 1 },
      { t: 'ninho', q: 2 },
      { t: 'fundicao', q: 1 },
      { t: 'mina_ferro', q: 1 },
      { t: 'bancada', q: 1 },
    ],
    descricao: '',
  },
];

/* ============================================================
   MORADORES DE DEMONSTRAÇÃO
   ============================================================
   Três moradores já aprovados, para entrar e testar sem ter de
   registrar ninguém antes. A senha dos três é `123` e o ID do
   jogo é o primeiro nome.

     Sophia  → moradora com propriedade no nome
     Aldric  → Patriarca da Casa Blackwing, com mesnada
     Varek   → Capitão do Exército (abre também o Quartel)

   Quando o Hold entrar em operação de verdade, basta apagar
   esta lista: nada mais depende dela.
   ============================================================ */

/** Data relativa ao dia em que a demonstração é aberta. */
const diasAtras = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const CIVIS_SEED = [
  {
    id: 'c-sophia', nome: 'Sophia Ravenwood', id_jogo: 'Sophia', senha_acesso: '123',
    raca: 'Bretão', profissao: 'Herbalista', nivel: 'Especialista', status: 'Aprovado',
    origem: 'natal', isencao_status: 'Não pedida', cidade_anterior: '', cidade_anterior_id: '', isencao_motivo: '', notas: 'Cultiva ervas nas encostas de Ivarstead.',
    observacao_corte: '', avaliado_por: 'Corte de Riften', avaliado_em: diasAtras(40),
    pericias: { Herbalista: 'Especialista' },
  },
  {
    id: 'c-aldric', nome: 'Aldric Blackwing', id_jogo: 'Aldric', senha_acesso: '123',
    raca: 'Nórdico', profissao: 'Ferreiro-Armamentista', nivel: 'Mestre', status: 'Aprovado',
    origem: 'natal', isencao_status: 'Não pedida', cidade_anterior: '', cidade_anterior_id: '', isencao_motivo: '', notas: 'Patriarca da Casa Blackwing.',
    observacao_corte: '', avaliado_por: 'Corte de Riften', avaliado_em: diasAtras(38),
    pericias: {},
  },
  {
    id: 'c-varek', nome: 'Varek Sombra-Rubra', id_jogo: 'Varek', senha_acesso: '123',
    raca: 'Elfo Negro', profissao: 'Caçador', nivel: 'Mestre', status: 'Aprovado',
    origem: 'natal', isencao_status: 'Não pedida', cidade_anterior: '', cidade_anterior_id: '', isencao_motivo: '', notas: 'Alistado no Exército de Riften.',
    observacao_corte: '', avaliado_por: 'Corte de Riften', avaliado_em: diasAtras(35),
    pericias: {},
  },
];

/**
 * Casas e dinastias nobres.
 * A planilha não trazia nenhuma — a Casa Blackwing existe aqui como
 * demonstração, porque é dela a Ordem do Dragão Negro, a mesnada que
 * entra na contagem das forças do Hold.
 */
export const CLAS_SEED = [
  {
    id: 'cla-blackwing',
    nome: 'Blackwing',
    lider: 'Aldric Blackwing',
    titulo_lider: 'Patriarca',
    lider_civil_id: 'c-aldric',
    lider_id_jogo: 'Aldric',
    lider_raca: 'Nórdico',
    lider_titulo: 'Lorde',
    cor: '#7c6bb0',
    brasao: null,
    lema: 'Na sombra, a asa protege',
    sede_propriedade_id: 'p13',
    sede_nome: "Filnjar's House",
    sede_tipo: 'Casa',
    membros: [
      { nome: 'Ingrid Blackwing', civil_id: '', id_jogo: '', raca: 'Nórdico', titulo: 'Lady', parentesco: 'Esposa', notas: '' },
    ],
    servos: [],
    mesnada_em: diasAtras(20),
    mesnada_nome: 'Ordem do Dragão Negro',
    soldados: [
      { nome: 'Halvar Escudo-Negro', civil_id: '', id_jogo: '', raca: 'Nórdico',   posto: 'Capitão da Ordem', notas: '' },
      { nome: 'Kjell Lâmina-Fria',   civil_id: '', id_jogo: '', raca: 'Nórdico',   posto: 'Homem de armas',   notas: '' },
      { nome: 'Ravna Olho-de-Corvo', civil_id: '', id_jogo: '', raca: 'Elfo Negro', posto: 'Batedora',        notas: '' },
      { nome: 'Torvald Punho-Rubro', civil_id: '', id_jogo: '', raca: 'Orc',        posto: 'Homem de armas',  notas: '' },
    ],
    herdeiro: {
      nome: 'Ingrid Blackwing', civil_id: '', id_jogo: '', raca: 'Nórdico',
      parentesco: 'Esposa', registrado_em: diasAtras(18),
    },
    situacao: 'Aprovada',
    status: 'Ativo',
    notas: '',
    fundada_em: diasAtras(30),
    reconhecida_por: 'Corte de Riften',
  },
];

/** Cargos da Corte — todos vagos. */
export const CORTE_SEED = [
  { cargo_id: 'jarl', nome: null, raca: null, cla_id: null, desde: null, notas: '' },
  { cargo_id: 'lorde_mao', nome: null, raca: null, cla_id: null, desde: null, notas: '' },
  { cargo_id: 'lorde_comandante', nome: null, raca: null, cla_id: null, desde: null, notas: '' },
  { cargo_id: 'mestre_moeda', nome: null, raca: null, cla_id: null, desde: null, notas: '' },
  { cargo_id: 'mago_corte', nome: null, raca: null, cla_id: null, desde: null, notas: '' },
  { cargo_id: 'alquimista_corte', nome: null, raca: null, cla_id: null, desde: null, notas: '' },
];

/**
 * Aba "Comércios" (11 linhas) + as casas listadas na aba "Vilareijos".
 * Casas NÃO aparecem na tela de Comércios — vivem no vilarejo a que pertencem.
 */
export const PROPRIEDADES_SEED = [
  {
    id: 'p1', nome: 'Black-Briar Meadery', tipo: 'Comércio', local: 'Riften',
    organizacao: '', proprietario: '', status: 'Vaga',
    catalogacao: [{ t: 'armazenamento', q: 43 }],
  },
  {
    id: 'p2', nome: "Elgrim's Elixirs", tipo: 'Comércio', local: 'Riften',
    organizacao: '', proprietario: '', status: 'Vaga',
    catalogacao: [{ t: 'lab_alquimia', q: 1 }, { t: 'caldeirao', q: 1 }, { t: 'armazenamento', q: 15 }],
  },
  {
    id: 'p3', nome: "Haelga's Bunkhouse", tipo: 'Comércio', local: 'Riften',
    organizacao: '', proprietario: '', status: 'Vaga',
    catalogacao: [{ t: 'santuario', q: 1, d: 'Dibella' }, { t: 'caldeirao', q: 1 }, { t: 'armazenamento', q: 47 }],
  },
  {
    id: 'p4', nome: 'Heartwood Mill', tipo: 'Serraria', local: '',
    organizacao: '', proprietario: '', status: 'Vaga',
    catalogacao: [
      { t: 'bloco_corte', q: 1 }, { t: 'pedra_amolar', q: 1 }, { t: 'tanning', q: 1 },
      { t: 'sawhorse', q: 1 }, { t: 'ninho', q: 2 }, { t: 'bancada', q: 1, d: 'Common' },
      { t: 'armazenamento', q: 4 },
    ],
  },
  {
    id: 'p5', nome: 'Pawned Prawn', tipo: 'Comércio', local: 'Riften',
    organizacao: '', proprietario: '', status: 'Vaga',
    catalogacao: [{ t: 'caldeirao', q: 1 }, { t: 'armazenamento', q: 16 }],
  },
  {
    id: 'p6', nome: 'The Bee and Barb', tipo: 'Taverna', local: 'Riften',
    organizacao: 'Clã LockHart', proprietario: 'Aerion Graysight', status: 'Vaga',
    catalogacao: [{ t: 'caldeirao', q: 1 }, { t: 'armazenamento', q: 32 }],
  },
  {
    id: 'p7', nome: 'The Scorched Hammer', tipo: 'Comércio', local: 'Riften',
    organizacao: '', proprietario: 'Eron Halvard', status: 'Operante',
    catalogacao: [
      { t: 'caldeirao', q: 1 }, { t: 'tanning', q: 1 },
      { t: 'pedra_amolar', q: 1 }, { t: 'armazenamento', q: 16 },
    ],
  },
  {
    id: 'p8', nome: 'Vilemyr Inn', tipo: 'Taverna', local: 'Ivarstead',
    organizacao: '', proprietario: '', status: 'Vaga',
    catalogacao: [{ t: 'armazenamento', q: 10 }],
  },
  {
    id: 'p9', nome: 'Snow-Shod Farm', tipo: 'Fazenda', local: '',
    organizacao: '', proprietario: '', status: 'Interditada',
    catalogacao: [
      { t: 'ninho', q: 2 }, { t: 'trigo', q: 4 }, { t: 'alho_poro', q: 10 },
      { t: 'batata', q: 5 }, { t: 'armazenamento', q: 12 },
    ],
  },
  {
    id: 'p10', nome: 'Sarethi Farm', tipo: 'Fazenda', local: '',
    organizacao: '', proprietario: '', status: 'Interditada',
    catalogacao: [
      { t: 'raiz_nirn', q: 7 }, { t: 'batata', q: 12 }, { t: 'cabaca', q: 7 },
      { t: 'ninho', q: 2 }, { t: 'tanning', q: 1 }, { t: 'caldeirao', q: 1 },
      { t: 'lab_alquimia', q: 1 }, { t: 'armazenamento', q: 7 },
    ],
  },
  {
    id: 'p11', nome: 'Fellstar Farm', tipo: 'Fazenda', local: 'Ivarstead',
    organizacao: '', proprietario: '', status: 'Interditada',
    catalogacao: [
      { t: 'armazenamento', q: 6 }, { t: 'bancada', q: 1, d: 'Simple' }, { t: 'tanning', q: 1 },
      { t: 'repolho', q: 15 }, { t: 'batata', q: 11 }, { t: 'trigo', q: 6 },
      { t: 'ninho', q: 4 }, { t: 'pedra_amolar', q: 1 }, { t: 'bloco_corte', q: 1 },
    ],
  },
  {
    id: 'p16', nome: 'Riften Fishery', tipo: 'Doca', local: 'Riften',
    organizacao: '', proprietario: '', status: 'Interditada',
    catalogacao: [
      { t: 'armazenamento', q: 6 },
      { t: 'peixe_assassino', q: 1 },
      { t: 'farm_salmao', q: 1 },
    ],
  },
  {
    id: 'p17', nome: 'Riften Warehouse', tipo: 'Comércio', local: 'Riften',
    organizacao: '', proprietario: '', status: 'Interditada',
    catalogacao: [{ t: 'armazenamento', q: 27 }],
  },

  // Casas — pertencem aos vilarejos, não ao comércio.
  // Duas casas já têm dono: são os moradores de demonstração.
  { id: 'p12', nome: "Klimmek's House", tipo: 'Casa', local: 'Ivarstead',    organizacao: '',      proprietario: 'Sophia Ravenwood', proprietario_civil_id: 'c-sophia', status: 'Operante', catalogacao: [] },
  { id: 'p13', nome: "Filnjar's House", tipo: 'Casa', local: "Shor's Stone", organizacao: 'Casa Blackwing', proprietario: 'Aldric Blackwing', proprietario_civil_id: 'c-aldric', status: 'Operante', catalogacao: [] },
  { id: 'p14', nome: "Odfel's House",   tipo: 'Casa', local: "Shor's Stone", organizacao: '', proprietario: '', status: 'Operante', catalogacao: [] },
  { id: 'p15', nome: "Sylgja's House",  tipo: 'Casa', local: "Shor's Stone", organizacao: '', proprietario: '', status: 'Operante', catalogacao: [] },
];

/**
 * Aba "Exército de Riften". A planilha trazia uma linha só — Thuraq
 * Drum. As demais são a tropa de demonstração, para que as divisões,
 * a hierarquia e a folha de pagamento tenham gente dentro.
 */
const M = 'Mestre', E = 'Especialista', A = 'Adepto', NA = 'N/A';
export const GUARDAS_SEED = [
  {
    id: 'g1', nome: 'Thuraq Drum', raca: 'Orc', patente: 'Soldado', patente_id: 'pat-soldado',
    divisao_id: 'div-guarda', divisao: 'Guarda da Cidade', status: 'Aposentado',
    notas: '', salario: '', pago_em: null,
    pericias: {
      Assassino: M, Batedor: M, Cavaleiro: M, Precursor: M, 'Espião': M, Bandido: M, Berserker: M, Brutamontes: M,
      Arqueiro: M, Espadachim: M, 'Lâmina': M, 'Lenhador de Guerra': M, Destruidor: M, Monge: M, Lanceiro: M, Guarda: M,
      Soldado: M, 'Cavaleiro Pesado': M, Escudeiro: M,
      Conjurador: NA, Encantador: NA, 'Místico': NA, Feiticeiro: NA, Ilusionista: NA, Curandeiro: NA,
    },
  },
  {
    id: 'g2', nome: 'Sigrid Punho-de-Ferro', raca: 'Nórdico', patente: 'Comandante', patente_id: 'pat-comandante',
    divisao_id: 'div-cavaleiros', divisao: 'Cavaleiros Negros', status: 'Operante',
    notas: 'Responde ao Jarl pelas três forças do Hold.', salario: '', pago_em: diasAtras(2),
    pericias: { Cavaleiro: M, Espadachim: M, Soldado: M, 'Cavaleiro Pesado': M, Escudeiro: E, Guarda: E },
  },
  {
    id: 'g3', nome: 'Varek Sombra-Rubra', civil_id: 'c-varek', id_jogo: 'Varek', raca: 'Elfo Negro',
    patente: 'Capitão', patente_id: 'pat-capitao',
    divisao_id: 'div-inteligencia', divisao: 'Investigação e Inteligência', status: 'Operante',
    notas: 'Capitão da Investigação. Trabalha à paisana quando o caso pede.', salario: '', pago_em: diasAtras(2),
    pericias: { 'Espião': M, Batedor: M, Assassino: E, Arqueiro: E, Ilusionista: A },
  },
  {
    id: 'g4', nome: 'Bjorn Cava-Neve', raca: 'Nórdico', patente: 'Sargento', patente_id: 'pat-sargento',
    divisao_id: 'div-guarda', divisao: 'Guarda da Cidade', status: 'Operante',
    notas: '', salario: '', pago_em: diasAtras(9),
    pericias: { Guarda: E, Soldado: E, Espadachim: A, Escudeiro: A },
  },
  {
    id: 'g5', nome: 'Ysolda Pé-Leve', raca: 'Bretão', patente: 'Soldado', patente_id: 'pat-soldado',
    divisao_id: 'div-fronteira', divisao: 'Patrulha e Caça de Fronteiras', status: 'Operante',
    notas: '', salario: '', pago_em: diasAtras(9),
    pericias: { Arqueiro: E, Batedor: E, Curandeiro: A },
  },
  {
    id: 'g6', nome: 'Marcus Vell', raca: 'Imperial', patente: 'Recruta', patente_id: 'pat-recruta',
    divisao_id: 'div-fronteira', divisao: 'Patrulha e Caça de Fronteiras', status: 'Ausente',
    notas: 'Em treinamento na guarnição de Ivarstead.', salario: '', pago_em: null,
    pericias: { Soldado: A, Lanceiro: A },
  },
];

/**
 * A lista da Milícia: moradores que se ofereceram para a guerra e
 * ficam à espera de convocação.
 */
export const MILICIA_SEED = [
  {
    id: 'mil-1', nome: 'Rurik Cava-Fundo', civil_id: '', id_jogo: '', raca: 'Nórdico',
    situacao: 'Disponível', campanha_id: null, campanha_nome: '', convocado_em: null,
    pago_em: null, notas: 'Mineiro de Shor’s Stone. Sabe usar machado.',
    criado_em: diasAtras(12),
  },
  {
    id: 'mil-2', nome: 'Mira Corta-Vento', civil_id: '', id_jogo: '', raca: 'Elfo da Floresta',
    situacao: 'Disponível', campanha_id: null, campanha_nome: '', convocado_em: null,
    pago_em: null, notas: 'Caçadora. Boa de arco e de trilha.',
    criado_em: diasAtras(6),
  },
];

/** Aba "Trabalhadores" — sem nenhuma linha preenchida. */
export const TRABALHADORES_SEED = [];
