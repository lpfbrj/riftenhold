// ============================================================
//  Camada de dados
//  - Com VITE_SUPABASE_URL/KEY definidos  → fala com o Supabase.
//  - Sem credenciais                      → MODO DEMONSTRAÇÃO local.
//  A API é idêntica nos dois casos, então nenhuma tela precisa saber.
// ============================================================
import { supabase, SUPABASE_ATIVO, MODO } from './supabase.js';
import { mesmaSenha, mesmoId } from './senha.js';
import {
  CLAS_SEED, CORTE_SEED, PROPRIEDADES_SEED, GUARDAS_SEED, CIVIS_SEED,
  TRABALHADORES_SEED, ASSENTAMENTOS, MILICIA_SEED,
} from '../data/rift.js';
import { DIVISOES_SEED, PATENTES_SEED, SOLDO_MILICIA } from './constants.js';
import { soldoDe, dataBR } from './forcas.js';
import { PRAZO_PESO, TAXA_DE, PEDIDO_CASA_POR_ID } from './constants.js';
import { normalizarCidadania } from './cidadania.js';
import {
  podeAbrirPedido, propriedadesDe, nobrezaDoCivil, casaFundadaPor, limparLema,
} from './casas.js';
import { podeOfertar, categoriaDe, precoDe, comNovoDono } from './imobiliaria.js';
import { podeRegistrarCla, nomeDisponivel, ehLider, ehAprovado } from './guildas.js';
import {
  cobrancaDoFato, proximoNumero as proximoNumeroCobranca,
  podeDeclarar as podeDeclararPagamento, precoDe as precoDaTabela, cobrancasDe,
  rotularMinhas,
} from './tesouraria.js';
import { TIPO_GUILDA_POR_ID } from './constants.js';

export { MODO, SUPABASE_ATIVO };

const CHAVE = 'riften-hold:v1';

// ---------- armazenamento local resiliente ----------
const memoria = { valor: null };

export const TABELAS_LOCAIS = [
  'civis', 'clas', 'corte', 'guardas', 'divisoes', 'patentes', 'milicia', 'campanhas', 'cofre', 'cobrancas', 'precos', 'prisoes', 'movimentos', 'trabalhadores', 'pedidos_dinastia', 'avisos', 'pedidos_compra', 'editais', 'propostas', 'propriedades', 'assentamentos', 'licencas', 'registros', 'pedidos_casa', 'ofertas', 'guildas',
];

/**
 * Conserta dados já gravados no navegador.
 * Uma versão anterior chegou a salvar registros sem id — e sem id o sistema
 * não conseguia atualizar (criava uma cópia) nem remover. Aqui todo registro
 * ganha um id próprio, e ids repetidos são desempatados.
 */
function sanear(estado) {
  const saneado = { ...estadoInicial(), ...estado };
  let mudou = false;
  for (const tabela of TABELAS_LOCAIS) {
    const linhas = Array.isArray(saneado[tabela]) ? saneado[tabela] : [];
    if (!Array.isArray(saneado[tabela])) mudou = true;
    const vistos = new Set();
    saneado[tabela] = linhas.filter(Boolean).map((linha) => {
      // Na Corte quem identifica a linha é o cargo: só existe um Jarl.
      // Dar um id aleatório aqui fazia a nomeação criar uma segunda linha
      // do mesmo cargo, e a ficha do nomeado passava a ler a linha vazia.
      const atual = tabela === 'corte' ? (linha.cargo_id || linha.id) : linha.id;
      const valido = atual != null && atual !== '' && !vistos.has(atual);
      const id = valido ? atual : uid();
      if (!valido || linha.id !== id) mudou = true;
      vistos.add(id);
      return linha.id === id ? linha : { ...linha, id };
    });
  }
  saneado.corte = juntarCargos(saneado.corte, () => { mudou = true; });
  saneado.seed_versao = estado.seed_versao;
  return { saneado, mudou };
}

/**
 * Junta linhas repetidas do mesmo cargo, mantendo a que tem alguém nomeado.
 * Conserta o estrago de quando cada nomeação criava uma linha nova.
 */
function juntarCargos(linhas, avisar) {
  if (!Array.isArray(linhas)) return [];
  const porCargo = new Map();
  for (const linha of linhas) {
    const chave = linha.cargo_id || linha.id;
    const anterior = porCargo.get(chave);
    if (!anterior) { porCargo.set(chave, linha); continue; }
    avisar();
    // Entre a linha vazia e a preenchida, fica a preenchida.
    const melhor = linha.nome ? { ...anterior, ...linha } : { ...linha, ...anterior };
    porCargo.set(chave, { ...melhor, id: chave, cargo_id: chave });
  }
  return [...porCargo.values()];
}

/**
 * Atualizações que a Corte determinou depois que o sistema já estava em uso.
 * Rodam uma vez só, marcadas por `seed_versao`, e mexem apenas nos registros
 * nomeados aqui — o resto do que vocês cadastraram fica intacto.
 */
export const VERSAO_SEED = 5;

const MUDANCAS = [
  {
    versao: 2,
    // Dois comércios que faltavam no levantamento.
    incluir: ['Riften Fishery', 'Riften Warehouse'],
    // Situação declarada pela Corte.
    status: {
      Interditada: ['Snow-Shod Farm', 'Sarethi Farm', 'Fellstar Farm', 'Riften Fishery', 'Riften Warehouse'],
      Vaga: ['Black-Briar Meadery', "Elgrim's Elixirs", "Haelga's Bunkhouse",
             'Heartwood Mill', 'Pawned Prawn', 'The Bee and Barb', 'Vilemyr Inn'],
    },
  },
  {
    versao: 3,
    // A Corte fechou os títulos: chefe de casa é Patriarca ou Matriarca, e
    // ninguém mais; na Nobreza valem Nobre, Lorde, Lady e Thane.
    normalizarTitulos: true,
  },
  {
    versao: 4,
    // As forças de Riften ganharam divisões e patentes editáveis, milícia
    // e folha de pagamento — e três moradores de demonstração para entrar
    // e testar sem cadastrar ninguém antes.
    semearForcas: true,
  },
  {
    versao: 5,
    // A Tesouraria: livro-caixa do cofre, cobranças e tabela de preços.
    // Nada é semeado — o livro começa vazio, na primeira declaração de
    // saldo. Gerar cobrança retroativa criaria dívida de mentira para
    // quem já pagou dentro do jogo.
    abrirTesouraria: true,
  },
];

const mesmoNome = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const TITULOS_LIDER_OK = ['Patriarca', 'Matriarca'];
const TITULOS_NOBREZA_OK = ['Nobre', 'Lorde', 'Lady', 'Thane'];

function normalizarCla(cla) {
  return {
    ...cla,
    titulo_lider: TITULOS_LIDER_OK.includes(cla.titulo_lider) ? cla.titulo_lider : 'Patriarca',
    lider_titulo: TITULOS_NOBREZA_OK.includes(cla.lider_titulo) ? cla.lider_titulo : 'Nobre',
    membros: (cla.membros || []).map((m) => ({
      ...m,
      titulo: TITULOS_NOBREZA_OK.includes(m.titulo) ? m.titulo : 'Nobre',
    })),
  };
}

/**
 * Acrescenta as linhas da semente que ainda não existem, sem mexer
 * em nada que já esteja lá — nem pelo id, nem pelo nome.
 */
function juntarPorId(estado, tabela, semente = []) {
  const atuais = Array.isArray(estado[tabela]) ? estado[tabela] : [];
  const faltando = semente.filter(
    (linha) => !atuais.some((x) => x.id === linha.id || mesmoNome(x.nome, linha.nome)),
  );
  if (faltando.length) estado[tabela] = [...atuais, ...faltando.map((l) => ({ ...l }))];
  else estado[tabela] = atuais;
}

function migrar(estado) {
  const de = Number(estado.seed_versao) || 1;
  if (de >= VERSAO_SEED) return false;

  for (const m of MUDANCAS.filter((x) => x.versao > de)) {
    for (const nome of m.incluir || []) {
      if ((estado.propriedades || []).some((p) => mesmoNome(p.nome, nome))) continue;
      const modelo = PROPRIEDADES_SEED.find((p) => mesmoNome(p.nome, nome));
      if (modelo) estado.propriedades = [...(estado.propriedades || []), { ...modelo, id: uid() }];
    }
    for (const [status, nomes] of Object.entries(m.status || {})) {
      estado.propriedades = (estado.propriedades || []).map(
        (p) => (nomes.some((n) => mesmoNome(p.nome, n)) ? { ...p, status } : p),
      );
    }
    if (m.normalizarTitulos) {
      estado.clas = (estado.clas || []).map(normalizarCla);
    }
    if (m.abrirTesouraria) {
      for (const tabela of ['cofre', 'cobrancas', 'precos']) {
        if (!Array.isArray(estado[tabela])) estado[tabela] = [];
      }
    }
    if (m.semearForcas) {
      // Tabela nova e ainda vazia recebe a semente; tabela em uso não
      // é tocada — a Corte já reorganizou as dela.
      if (!(estado.divisoes || []).length) estado.divisoes = DIVISOES_SEED.map((d) => ({ ...d }));
      if (!(estado.patentes || []).length) estado.patentes = PATENTES_SEED.map((p) => ({ ...p }));
      if (!Array.isArray(estado.campanhas)) estado.campanhas = [];
      // Os moradores de demonstração entram sem mexer em nada que a
      // Corte já tenha cadastrado — só o que falta é acrescentado.
      juntarPorId(estado, 'civis', CIVIS_SEED);
      juntarPorId(estado, 'clas', CLAS_SEED);
      juntarPorId(estado, 'guardas', GUARDAS_SEED);
      juntarPorId(estado, 'milicia', MILICIA_SEED);
      // Sophia e Aldric vêm com casa no nome — sem isso ela não pede
      // nobreza e a sede da Casa Blackwing aponta para o vazio.
      estado.propriedades = (estado.propriedades || []).map((p) => {
        const modelo = PROPRIEDADES_SEED.find((x) => x.id === p.id && x.proprietario_civil_id);
        if (!modelo || p.proprietario_civil_id || String(p.proprietario || '').trim()) return p;
        return {
          ...p,
          proprietario: modelo.proprietario,
          proprietario_civil_id: modelo.proprietario_civil_id,
          organizacao: p.organizacao || modelo.organizacao || '',
        };
      });
    }
  }
  estado.seed_versao = VERSAO_SEED;
  return true;
}

function lerLocal() {
  if (memoria.valor) return memoria.valor;
  let bruto = null;
  try { bruto = localStorage.getItem(CHAVE); } catch { /* storage bloqueado */ }
  let estado;
  try { estado = bruto ? JSON.parse(bruto) : estadoInicial(); }
  catch { estado = estadoInicial(); }
  const { saneado, mudou } = sanear(estado);
  const migrou = migrar(saneado);
  memoria.valor = saneado;
  // Grava também na primeira vez, para o estado inicial existir de fato.
  if (mudou || migrou || !bruto) gravarLocal(saneado);
  return memoria.valor;
}

function gravarLocal(estado) {
  memoria.valor = estado;
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); return true; }
  catch { return false; } // sem espaço no navegador: segue só em memória
}

function estadoInicial() {
  return {
    civis: CIVIS_SEED.map((c) => ({ ...c })),
    clas: CLAS_SEED.map((c) => ({ ...c })),
    corte: CORTE_SEED.map((c) => ({ ...c, id: c.cargo_id })),
    guardas: GUARDAS_SEED.map((g) => ({ ...g })),
    divisoes: DIVISOES_SEED.map((d) => ({ ...d })),
    patentes: PATENTES_SEED.map((p) => ({ ...p })),
    milicia: MILICIA_SEED.map((m) => ({ ...m })),
    campanhas: [],
    cofre: [],
    cobrancas: [],
    precos: [],
    trabalhadores: TRABALHADORES_SEED.map((t) => ({ ...t })),
    propriedades: PROPRIEDADES_SEED.map((p) => ({ ...p })),
    assentamentos: ASSENTAMENTOS.map((a) => ({ ...a })),
    licencas: [],
    prisoes: [],
    movimentos: [],
    pedidos_dinastia: [],
    avisos: [],
    pedidos_compra: [],
    editais: [],
    propostas: [],
    registros: [],
    pedidos_casa: [],
    ofertas: [],
    guildas: [],
    seed_versao: VERSAO_SEED,
  };
}

export function reiniciarDemo() {
  gravarLocal(estadoInicial());
}

// ---------- API pública ----------
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id' + Math.random().toString(36).slice(2));

export async function listar(tabela) {
  if (SUPABASE_ATIVO) {
    const { data, error } = await supabase.from(tabela).select('*');
    if (error) throw error;
    return (data || []).map((r) => (tabela === 'corte' ? { ...r, id: r.cargo_id } : r));
  }
  return structuredClone(lerLocal()[tabela] || []);
}

/** Descarta chaves com undefined — um `id: undefined` vindo de um formulário
 *  novo sobrescrevia o id gerado e criava um registro duplicado a cada salvamento. */
const limpar = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export async function inserir(tabela, linha) {
  const dados = limpar(linha);
  if (SUPABASE_ATIVO) {
    if (dados.id == null || dados.id === '') delete dados.id; // deixa o banco gerar
    const { data, error } = await supabase.from(tabela).insert(dados).select().single();
    if (error) throw error;
    return data;
  }
  const estado = lerLocal();
  const nova = { ...dados, id: dados.id || uid() };
  estado[tabela] = [...(estado[tabela] || []), nova];
  gravarLocal(estado);
  return nova;
}

export async function atualizar(tabela, id, patch) {
  if (SUPABASE_ATIVO) {
    const chave = tabela === 'corte' ? 'cargo_id' : 'id';
    const { data, error } = await supabase.from(tabela).update(patch).eq(chave, id).select().single();
    if (error) throw error;
    return data;
  }
  const estado = lerLocal();
  const dados = limpar(patch);
  estado[tabela] = (estado[tabela] || []).map((r) => (r.id === id ? { ...r, ...dados } : r));
  gravarLocal(estado);
  return estado[tabela].find((r) => r.id === id);
}

/** Insere se não existir, senão atualiza. Usado pelos cargos da Corte. */
export async function salvar(tabela, registro) {
  const existe = registro.id != null && String(registro.id).length > 0;
  if (!existe) return inserir(tabela, registro);
  if (SUPABASE_ATIVO && tabela === 'corte') {
    const { data, error } = await supabase.from(tabela).upsert(registro).select().single();
    if (error) throw error;
    return { ...data, id: data.cargo_id };
  }
  const { id, ...patch } = registro;
  const atual = await listar(tabela);
  if (!atual.some((r) => r.id === id)) return inserir(tabela, registro);
  return atualizar(tabela, id, patch);
}

export async function remover(tabela, id) {
  // Sem identificador não dá para saber o que apagar — melhor recusar do que
  // varrer todos os registros parecidos.
  if (id == null || id === '') {
    throw new Error('Este registro está sem identificador. Recarregue a página — o sistema corrige sozinho — e tente de novo.');
  }
  if (SUPABASE_ATIVO) {
    const chave = tabela === 'corte' ? 'cargo_id' : 'id';
    const { error } = await supabase.from(tabela).delete().eq(chave, id);
    if (error) throw error;
    return;
  }
  const estado = lerLocal();
  estado[tabela] = (estado[tabela] || []).filter((r) => r.id !== id);
  gravarLocal(estado);
}

/**
 * Envio público do Registro Civil.
 * Não exige login: qualquer morador pode se inscrever, e o pedido entra
 * como "Pendente" até a Corte aprovar.
 */
export async function enviarRegistroCivil(dados) {
  const cidadania = normalizarCidadania(dados);
  const linha = {
    nome: String(dados.nome || '').trim(),
    id_jogo: String(dados.id_jogo || '').trim(),
    raca: dados.raca || '',
    profissao: dados.profissao || '',
    nivel: dados.nivel || 'Novato',
    notas: dados.notas || '',
    ...cidadania,
    isencao_pedida_em: cidadania.isencao_status === 'Pendente' ? new Date().toISOString() : null,
    status: 'Pendente',
  };
  if (!linha.nome) throw new Error('Informe o nome do personagem.');
  if (!linha.id_jogo) throw new Error('Informe o ID do jogo.');
  if (linha.origem === 'transferencia' && !linha.cidade_anterior) {
    throw new Error('Diga de qual cidade você está vindo.');
  }
  if (linha.isencao_status === 'Pendente' && !linha.isencao_motivo) {
    throw new Error('Explique por que você precisa da isenção de cidadania.');
  }
  return inserir('civis', linha);
}

/**
 * O morador pedindo a isenção depois — quem se registrou como
 * transferido e na hora não pediu, ou teve o pedido negado e quer
 * tentar de novo com outra justificativa.
 */
export async function pedirIsencaoCidadania(sessao, motivo) {
  const texto = String(motivo || '').trim();
  if (!texto) throw new Error('Explique por que você precisa da isenção.');

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('pedir_isencao_cidadania', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_motivo: texto,
    });
    if (error) throw new Error(error.message || 'Não foi possível enviar o pedido agora.');
    return true;
  }

  const eu = (await listar('civis')).find((c) => c.id === sessao.civil_id);
  if (!eu) throw new Error('Sua ficha não foi encontrada.');
  if (eu.origem !== 'transferencia') {
    throw new Error('A isenção é só para quem está transferindo a cidadania de outra cidade.');
  }
  if (eu.isencao_status === 'Pendente') throw new Error('Você já tem um pedido em análise.');
  if (eu.isencao_status === 'Concedida') throw new Error('Sua isenção já foi concedida.');

  await atualizar('civis', sessao.civil_id, {
    isencao_status: 'Pendente',
    isencao_motivo: texto,
    isencao_pedida_em: new Date().toISOString(),
    isencao_parecer: '',
  });
  return true;
}


// ============================================================
//  CLÃS DO HOLD
//
//  O morador registra o clã e diz a que ele veio; a Corte
//  reconhece ou recusa. Reconhecido, quem registrou vira o líder:
//  administra os membros e vincula uma propriedade sua ao clã.
//
//  A Corte, do lado dela, edita e dissolve pela tela de Clãs —
//  entra autenticada e usa o `salvar` comum.
// ============================================================

/** Um membro do clã, sempre no mesmo formato. */
const gentedoCla = (lista = []) => (lista || [])
  .filter((m) => String(m?.nome || '').trim())
  .map((m) => ({
    nome: String(m.nome).trim(),
    civil_id: m.civil_id || '',
    id_jogo: m.id_jogo || '',
    cargo: String(m.cargo || 'Membro').trim() || 'Membro',
    notas: String(m.notas || '').trim(),
    entrou_em: m.entrou_em || new Date().toISOString(),
  }));

/**
 * Registrar um clã. Nasce Pendente: sem o reconhecimento da Corte
 * ele não aparece no Hold nem recebe licença.
 */
export async function registrarCla(sessao, dados = {}, guildas = []) {
  const civil = { civil_id: sessao?.civil_id, nome: sessao?.nome };
  const atuais = await listar('guildas').catch(() => guildas);
  const { pode, motivo } = podeRegistrarCla(civil, atuais);
  if (!pode) throw new Error(motivo);

  const nome = String(dados.nome || '').trim();
  if (!nome) throw new Error('Dê um nome ao clã.');
  if (!nomeDisponivel(nome, atuais)) throw new Error(`Já existe um clã chamado ${nome}.`);
  if (!TIPO_GUILDA_POR_ID[dados.tipo]) throw new Error('Escolha o tipo do clã.');
  const historia = String(dados.historia || '').trim();
  const funcao = String(dados.funcao || '').trim();
  if (!historia) throw new Error('Conte a história do clã — é o que a Corte vai ler.');
  if (!funcao) throw new Error('Diga qual a função do clã no roleplay de Riften.');

  const cla = {
    nome,
    tipo: dados.tipo,
    lema: String(dados.lema || '').trim().slice(0, 60),
    cor: dados.cor || TIPO_GUILDA_POR_ID[dados.tipo].cor,
    brasao: dados.brasao || null,
    historia,
    funcao,
    lider: sessao.nome,
    lider_civil_id: sessao.civil_id || '',
    lider_id_jogo: sessao.id_jogo || '',
    membros: [],
    propriedade_id: null,
    propriedade_nome: '',
    situacao: 'Pendente',
    parecer: '',
    criado_em: new Date().toISOString(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('registrar_cla', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha,
      p_nome: cla.nome, p_tipo: cla.tipo, p_lema: cla.lema, p_cor: cla.cor,
      p_brasao: cla.brasao, p_historia: cla.historia, p_funcao: cla.funcao,
    });
    if (error) throw new Error('Não foi possível registrar o clã agora.');
    return cla;
  }
  return inserir('guildas', cla);
}

/** O clã recusado voltando à fila, corrigido. */
export async function reenviarCla(sessao, guilda, dados = {}) {
  // Vale o que está gravado: a Corte pode ter reconhecido o clã
  // enquanto a tela do líder ainda mostrava a recusa.
  const atuais = await listar('guildas').catch(() => []);
  const atual = atuais.find((g) => g.id === guilda.id) || guilda;
  if (!ehLider(sessao, atual)) throw new Error('Só o líder responde pelo clã.');
  if ((atual.situacao || '') !== 'Recusado') {
    throw new Error('Só se reenvia o registro de um clã recusado.');
  }
  const nome = String(dados.nome || '').trim();
  if (!nome) throw new Error('Dê um nome ao clã.');
  if (!nomeDisponivel(nome, atuais, atual.id)) throw new Error(`Já existe um clã chamado ${nome}.`);

  const patch = {
    nome,
    tipo: TIPO_GUILDA_POR_ID[dados.tipo] ? dados.tipo : atual.tipo,
    lema: String(dados.lema || '').trim().slice(0, 60),
    cor: dados.cor || atual.cor,
    brasao: dados.brasao ?? atual.brasao ?? null,
    historia: String(dados.historia || '').trim(),
    funcao: String(dados.funcao || '').trim(),
    situacao: 'Pendente',
    // O parecer velho era da recusa: com o registro refeito, ele
    // não vale mais e não pode ficar colado no pedido novo.
    parecer: '',
    avaliado_por: null,
    avaliado_em: null,
  };
  if (!patch.historia || !patch.funcao) {
    throw new Error('A história e a função do clã não podem ficar em branco.');
  }

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('reenviar_cla', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_guilda_id: atual.id,
      p_nome: patch.nome, p_tipo: patch.tipo, p_lema: patch.lema, p_cor: patch.cor,
      p_brasao: patch.brasao, p_historia: patch.historia, p_funcao: patch.funcao,
    });
    if (error) throw new Error('Não foi possível reenviar agora.');
    return patch;
  }
  return atualizar('guildas', atual.id, patch);
}

/**
 * O líder administrando o clã: membros, propriedade vinculada e o
 * texto do clã. Nome, tipo e situação são registro da Corte.
 */
export async function salvarClaProprio(sessao, guilda, campos = {}, propriedades = []) {
  const atual = (await listar('guildas').catch(() => [])).find((g) => g.id === guilda.id) || guilda;
  if (!ehLider(sessao, atual)) throw new Error('Só o líder administra o clã.');
  if (!ehAprovado(atual)) throw new Error('O clã ainda aguarda o reconhecimento da Corte.');

  const patch = {
    historia: String(campos.historia ?? atual.historia ?? '').trim(),
    funcao: String(campos.funcao ?? atual.funcao ?? '').trim(),
    membros: gentedoCla(campos.membros ?? atual.membros),
  };

  // A propriedade do clã tem de ser de alguém da casa: só o líder
  // vincula, e só o que está no nome dele.
  if (campos.propriedade_id !== undefined) {
    if (!campos.propriedade_id) {
      patch.propriedade_id = null;
      patch.propriedade_nome = '';
    } else {
      const imovel = (propriedades || []).find((p) => p.id === campos.propriedade_id);
      if (!imovel) throw new Error('Escolha uma propriedade do registro do Hold.');
      if (!ehDonoDaPropriedade(sessao, imovel)) {
        throw new Error('Só se vincula ao clã uma propriedade registrada em seu nome.');
      }
      patch.propriedade_id = imovel.id;
      patch.propriedade_nome = imovel.nome;
    }
  }

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('salvar_cla_lider', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_guilda_id: atual.id,
      p_historia: patch.historia, p_funcao: patch.funcao, p_membros: patch.membros,
      p_propriedade_id: patch.propriedade_id === undefined ? atual.propriedade_id : patch.propriedade_id,
    });
    if (error) throw new Error('Não foi possível salvar o clã agora.');
    return patch;
  }
  return atualizar('guildas', atual.id, patch);
}

/** Sair do clã que você lidera é dissolvê-lo — e isso é ato da Corte. */
export async function pedirDissolucao(sessao, guilda, motivo = '') {
  const atual = (await listar('guildas').catch(() => [])).find((g) => g.id === guilda.id) || guilda;
  if (!ehLider(sessao, atual)) throw new Error('Só o líder pede a dissolução.');
  const patch = {
    dissolucao_pedida_em: new Date().toISOString(),
    dissolucao_motivo: String(motivo || '').trim(),
  };
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('pedir_dissolucao_cla', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_guilda_id: guilda.id,
      p_motivo: patch.dissolucao_motivo,
    });
    if (error) throw new Error('Não foi possível pedir a dissolução agora.');
    return patch;
  }
  return atualizar('guildas', guilda.id, patch);
}

/**
 * Confere se um ID de jogo já foi registrado.
 * Só funciona quando há acesso de leitura (modo demonstração ou Corte logada) —
 * no envio público quem barra a repetição é a restrição UNIQUE do banco.
 */
export async function idJogoJaUsado(idJogo) {
  const alvo = String(idJogo || '').trim().toLowerCase();
  if (!alvo) return false;
  try {
    const civis = await listar('civis');
    return civis.some((c) => String(c.id_jogo || '').toLowerCase() === alvo);
  } catch {
    return false; // sem permissão de leitura: o banco decide
  }
}

/** Crônica da Corte: quem mexeu em quê. */
export async function registrar(autor, acao, entidade, alvo, detalhe = '') {
  const linha = { autor, acao, entidade, alvo, detalhe, criado_em: new Date().toISOString() };
  try {
    if (SUPABASE_ATIVO) {
      await supabase.from('registros').insert({ autor, acao, entidade, alvo, detalhe });
      return;
    }
    const estado = lerLocal();
    estado.registros = [{ id: uid(), ...linha }, ...(estado.registros || [])].slice(0, 300);
    gravarLocal(estado);
  } catch { /* a crônica nunca deve travar uma edição */ }
}

/**
 * Apagar da crônica.
 *
 * Sai por fora de `remover()` de propósito: apagar um ato do livro não é
 * um ato que mereça outra linha no mesmo livro — senão a crônica nunca
 * esvazia, ela só troca de conteúdo.
 */
export async function apagarRegistro(id) {
  if (!id) throw new Error('Este ato está sem identificador.');
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.from('registros').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const estado = lerLocal();
  estado.registros = (estado.registros || []).filter((r) => r.id !== id);
  gravarLocal(estado);
}

/** Limpar a crônica inteira. */
export async function limparRegistros() {
  if (SUPABASE_ATIVO) {
    // Sem `where` o PostgREST recusa o delete; este filtro pega todas as linhas.
    const { error } = await supabase.from('registros').delete().not('id', 'is', null);
    if (error) throw error;
    return;
  }
  const estado = lerLocal();
  estado.registros = [];
  gravarLocal(estado);
}

/**
 * Login do morador e do soldado: ID do jogo + a senha que a Corte gerou.
 *
 * No modo demonstração a conferência é feita aqui mesmo, sobre os dados do
 * navegador. Com Supabase, quem confere é a função `acesso_cidadao` no banco
 * (SECURITY DEFINER) — o anônimo não enxerga a tabela `civis`, só recebe de
 * volta a linha da própria pessoa quando ID e senha batem.
 */
export async function autenticarCidadao(idJogo, senha) {
  const id = String(idJogo || '').trim();
  if (!id) throw new Error('Informe o ID do jogo.');
  if (!senha) throw new Error('Informe a senha entregue pela Corte.');

  if (SUPABASE_ATIVO) {
    const { data, error } = await supabase.rpc('acesso_cidadao', {
      p_id_jogo: id, p_senha: String(senha),
    });
    if (error) throw new Error('Não foi possível conferir suas credenciais agora.');
    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha) throw new Error('ID ou senha não conferem.');
    return linha;
  }

  const civis = await listar('civis');
  const achado = civis.find((c) => mesmoId(c.id_jogo, id));
  if (!achado || !mesmaSenha(achado.senha_acesso, senha)) {
    throw new Error('ID ou senha não conferem.');
  }
  if (achado.status !== 'Aprovado') {
    throw new Error('Seu registro ainda não foi aprovado pela Corte.');
  }
  return achado;
}

/**
 * O morador salvando a própria ficha.
 * Só estes campos mudam — situação, ID do jogo, senha e observação da Corte
 * continuam sendo decisão da Corte.
 */
export async function salvarFichaPropria(sessao, campos) {
  const patch = {
    nome: String(campos.nome || '').trim(),
    raca: campos.raca || '',
    profissao: campos.profissao || '',
    nivel: campos.nivel || 'Novato',
    notas: campos.notas || '',
  };
  if (!patch.nome) throw new Error('O nome do personagem não pode ficar em branco.');

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('salvar_ficha_cidadao', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, ...prefixar(patch),
    });
    if (error) throw new Error('Não foi possível salvar sua ficha agora.');
    return patch;
  }
  return atualizar('civis', sessao.civil_id, patch);
}

/**
 * O morador salvando as próprias habilidades.
 *
 * Ninguém é obrigado a preencher — quem preenche é porque quer se
 * candidatar a alguma coisa: um recrutamento do Quartel, um serviço de
 * escolta, um contrato que peça braço treinado. O que está aqui é
 * **declarado** por ele; o que o Quartel afere fica na ficha militar,
 * e é essa que prevalece para quem tem as duas.
 */
export async function salvarPericiasCidadao(sessao, pericias) {
  const limpas = {};
  for (const [k, v] of Object.entries(pericias || {})) {
    if (v && v !== 'N/A') limpas[k] = v;
  }
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('salvar_pericias_cidadao', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_pericias: limpas,
    });
    if (error) throw new Error('Não foi possível salvar suas habilidades agora.');
    return limpas;
  }
  await atualizar('civis', sessao.civil_id, { pericias: limpas });
  return limpas;
}

/** O soldado salvando as próprias habilidades. */
export async function salvarPericiasProprias(sessao, guardaId, pericias, notas) {
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('salvar_pericias_soldado', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_pericias: pericias,
    });
    if (error) throw new Error('Não foi possível salvar suas habilidades agora.');
    return pericias;
  }
  return atualizar('guardas', guardaId, { pericias, notas });
}

const prefixar = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`p_${k}`, v]));

// ============================================================
//  A DINASTIA NA MÃO DO PATRIARCA
//
//  O chefe da casa administra a própria dinastia pela Cidade de
//  Riften. Ele mexe direto no que é da casa — brasão, cor, notas e
//  os servos — mas **não** entra membro sozinho: membro vira nobre,
//  e nobreza é ato da Corte. Por isso o pedido vai para uma fila.
// ============================================================

/** Ele é o chefe desta casa? */
export function ehChefeDaCasa(sessao, cla) {
  if (!sessao || !cla) return false;
  if (cla.lider_civil_id) return cla.lider_civil_id === sessao.civil_id;
  return Boolean(cla.lider) &&
    String(cla.lider).trim().toLowerCase() === String(sessao.nome || '').trim().toLowerCase();
}

/** A casa que esta pessoa chefia, se chefiar alguma. */
export const casaQueChefia = (sessao, clas = []) => clas.find((c) => ehChefeDaCasa(sessao, c)) || null;

/** Gente da casa — servo ou homem de armas — sempre no mesmo formato. */
const gente = (lista = [], campo) => (lista || [])
  .filter((s) => String(s?.nome || '').trim())
  .map((s) => ({
    nome: String(s.nome).trim(),
    civil_id: s.civil_id || '',
    id_jogo: s.id_jogo || '',
    raca: s.raca || '',
    [campo]: String(s[campo] || '').trim(),
    notas: s.notas || '',
  }));

/**
 * O patriarca salvando o que é da casa no dia a dia: as notas, os
 * servos e — se a casa tiver mesnada — os homens de armas.
 *
 * Brasão e lema **não** entram aqui: depois que a casa é fundada, a
 * insígnia só muda por pedido à Corte, com taxa.
 */
export async function salvarDinastiaPropria(sessao, cla, campos) {
  if (!ehChefeDaCasa(sessao, cla)) {
    throw new Error('Só o Patriarca ou a Matriarca administra a casa.');
  }
  const patch = {
    notas: campos.notas || '',
    servos: gente(campos.servos, 'funcao'),
  };
  // Sem mesnada registrada, a casa não guarda homens de armas — nem
  // batiza uma bandeira que ainda não existe.
  if (cla.mesnada_em) {
    patch.soldados = gente(campos.soldados, 'posto');
    if (campos.mesnada_nome !== undefined) {
      patch.mesnada_nome = String(campos.mesnada_nome || '').trim().slice(0, 60);
    }
  }

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('salvar_dinastia_patriarca', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_cla_id: cla.id,
      p_brasao: cla.brasao ?? null, p_cor: cla.cor || '#7c6bb0',
      p_notas: patch.notas, p_servos: patch.servos,
      p_soldados: patch.soldados || null,
      p_mesnada_nome: patch.mesnada_nome === undefined ? null : patch.mesnada_nome,
    });
    if (error) throw new Error('Não foi possível salvar a casa agora.');
    return patch;
  }
  return atualizar('clas', cla.id, patch);
}

/** O patriarca indicando alguém para a dinastia. Vai para a fila da Corte. */
export async function pedirMembroDinastia(sessao, cla, indicado) {
  if (!ehChefeDaCasa(sessao, cla)) {
    throw new Error('Só o Patriarca ou a Matriarca indica novos membros.');
  }
  const nome = String(indicado?.nome || '').trim();
  if (!nome) throw new Error('Informe quem você quer trazer para a casa.');

  const jaEsta = (cla.membros || []).some(
    (m) => (indicado.civil_id && m.civil_id === indicado.civil_id) ||
           String(m.nome || '').trim().toLowerCase() === nome.toLowerCase(),
  );
  if (jaEsta) throw new Error(`${nome} já é membro desta casa.`);

  const pedido = {
    cla_id: cla.id,
    cla_nome: cla.nome,
    nome,
    civil_id: indicado.civil_id || '',
    id_jogo: indicado.id_jogo || '',
    raca: indicado.raca || '',
    parentesco: String(indicado.parentesco || '').trim(),
    justificativa: String(indicado.justificativa || '').trim(),
    status: 'Pendente',
    pedido_por: sessao.nome,
    pedido_por_civil_id: sessao.civil_id || '',
    criado_em: new Date().toISOString(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('pedir_membro_dinastia', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_cla_id: cla.id,
      p_nome: pedido.nome, p_civil_id: pedido.civil_id || null,
      p_parentesco: pedido.parentesco, p_justificativa: pedido.justificativa,
    });
    if (error) throw new Error('Não foi possível enviar o pedido agora.');
    return pedido;
  }
  return inserir('pedidos_dinastia', pedido);
}

/** O patriarca desistindo de um pedido que ainda não foi julgado. */
export async function cancelarPedidoDinastia(sessao, pedido) {
  if (pedido.status !== 'Pendente') throw new Error('Este pedido já foi julgado pela Corte.');
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('cancelar_pedido_dinastia', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_pedido_id: pedido.id,
    });
    if (error) throw new Error('Não foi possível cancelar o pedido agora.');
    return true;
  }
  return remover('pedidos_dinastia', pedido.id);
}

// ============================================================
//  CHANCELARIA DA NOBREZA
//
//  Todo passo da nobreza é um pedido com taxa, e todo pedido é
//  julgado pela Corte. O morador com propriedade pede o título; o
//  nobre funda a casa; a casa fundada pede herdeiro, mesnada,
//  aliança, sede e troca de insígnia.
//
//  Aqui só se **abre** o pedido. Quem defere é a Corte, no Palácio.
// ============================================================

/** Um pedido novo, com os campos que toda linha da chancelaria tem. */
function novoPedido(sessao, tipo, extra = {}) {
  return {
    tipo,
    custo: TAXA_DE(tipo),
    status: 'Pendente',
    motivo: '',
    parecer: '',
    pedido_por: sessao?.nome || '',
    civil_id: sessao?.civil_id || '',
    id_jogo: sessao?.id_jogo || '',
    cla_id: null,
    cla_nome: '',
    alvo_cla_id: null,
    alvo_cla_nome: '',
    dados: {},
    criado_em: new Date().toISOString(),
    ...extra,
  };
}

async function gravarPedido(pedido, rpc, argumentos) {
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc(rpc, argumentos);
    if (error) throw new Error('Não foi possível enviar o pedido agora.');
    return pedido;
  }
  return inserir('pedidos_casa', pedido);
}

/**
 * O morador pedindo o título de nobreza. Só pede quem tem
 * propriedade registrada em seu nome — casa, comércio ou fortaleza.
 */
export async function pedirNobreza(sessao, { motivo = '', propriedades = [] } = {}) {
  const civil = { civil_id: sessao?.civil_id, nome: sessao?.nome };
  const pedidos = await listar('pedidos_casa').catch(() => []);
  const { pode, motivo: barrado } = podeAbrirPedido('nobreza', { civil, propriedades, pedidos });
  if (!pode) throw new Error(barrado);

  const minhas = propriedadesDe(civil, propriedades);
  const pedido = novoPedido(sessao, 'nobreza', {
    motivo: String(motivo || '').trim(),
    dados: {
      propriedades: minhas.map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo })),
    },
  });
  return gravarPedido(pedido, 'pedir_nobreza', {
    p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_motivo: pedido.motivo,
  });
}

/**
 * O nobre fundando a casa. A casa nasce **pendente**: ela não entra
 * na Nobreza nem na lista pública enquanto a Corte não reconhecer.
 */
export async function fundarCasaNobre(sessao, dados = {}, contexto = {}) {
  const { propriedades = [] } = contexto;
  // Fundar é irreversível: a conferência é contra o que está gravado
  // agora, e não contra o retrato que a tela carregou.
  const pedidos = await listar('pedidos_casa').catch(() => contexto.pedidos || []);
  const clas = await listar('clas').catch(() => contexto.clas || []);
  const civil = { civil_id: sessao?.civil_id, nome: sessao?.nome };
  const n = nobrezaDoCivil(civil, { pedidos, propriedades });
  if (!n.nobre) throw new Error('É preciso ter o título de nobreza para fundar uma casa.');
  if (casaFundadaPor(civil, clas)) throw new Error('Você já tem uma casa.');

  const nome = String(dados.nome || '').trim();
  if (!nome) throw new Error('Dê um nome à casa.');
  if ((clas || []).some((c) => String(c.nome || '').trim().toLowerCase() === nome.toLowerCase())) {
    throw new Error(`Já existe uma Casa ${nome} no Hold.`);
  }
  const sede = (propriedades || []).find((p) => p.id === dados.sede_propriedade_id);
  if (!sede) throw new Error('Escolha qual propriedade será a sede principal da casa.');
  if (!propriedadesDe(civil, propriedades).some((p) => p.id === sede.id)) {
    throw new Error('A sede tem de ser uma propriedade registrada em seu nome.');
  }

  const casa = {
    nome,
    lider: sessao.nome,
    titulo_lider: dados.titulo_lider === 'Matriarca' ? 'Matriarca' : 'Patriarca',
    lider_civil_id: sessao.civil_id || '',
    lider_id_jogo: sessao.id_jogo || '',
    lider_raca: dados.raca || '',
    lider_titulo: 'Nobre',
    cor: dados.cor || '#7c6bb0',
    brasao: dados.brasao || null,
    lema: limparLema(dados.lema),
    sede_propriedade_id: sede.id,
    sede_nome: sede.nome,
    sede_tipo: sede.tipo || '',
    membros: [],
    servos: [],
    soldados: [],
    herdeiro: null,
    mesnada_em: null,
    situacao: 'Pendente',
    notas: String(dados.notas || '').trim(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('fundar_casa_nobre', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha,
      p_nome: casa.nome, p_titulo_lider: casa.titulo_lider, p_cor: casa.cor,
      p_brasao: casa.brasao, p_lema: casa.lema,
      p_sede_id: casa.sede_propriedade_id, p_notas: casa.notas,
    });
    if (error) throw new Error('Não foi possível fundar a casa agora.');
    return casa;
  }

  const gravada = await inserir('clas', casa);
  await inserir('pedidos_casa', novoPedido(sessao, 'fundacao', {
    cla_id: gravada.id,
    cla_nome: gravada.nome,
    motivo: casa.notas,
    dados: { lema: casa.lema, sede: sede.nome, sede_tipo: sede.tipo || '' },
  }));
  return gravada;
}

/**
 * A casa recusada voltando à fila. Corrige o que a Corte apontou e
 * envia de novo — sem taxa, porque a fundação nunca teve uma.
 */
export async function refundarCasa(sessao, cla, dados = {}, contexto = {}) {
  if (!ehChefeDaCasa(sessao, cla)) throw new Error('Só quem fundou a casa refaz o pedido.');
  if ((cla.situacao || 'Aprovada') !== 'Recusada') {
    throw new Error('Só se refaz a fundação de uma casa recusada.');
  }
  const { propriedades = [], clas = [] } = contexto;
  const nome = String(dados.nome || '').trim();
  if (!nome) throw new Error('Dê um nome à casa.');
  const repetido = (clas || []).some(
    (c) => c.id !== cla.id && String(c.nome || '').trim().toLowerCase() === nome.toLowerCase(),
  );
  if (repetido) throw new Error(`Já existe uma Casa ${nome} no Hold.`);

  const sede = (propriedades || []).find((p) => p.id === dados.sede_propriedade_id);
  if (!sede) throw new Error('Escolha qual propriedade será a sede principal da casa.');
  const minhas = propriedadesDe({ civil_id: cla.lider_civil_id, nome: cla.lider }, propriedades);
  if (!minhas.some((p) => p.id === sede.id)) {
    throw new Error('A sede tem de ser uma propriedade registrada em seu nome.');
  }

  const patch = {
    nome,
    lema: limparLema(dados.lema),
    cor: dados.cor || cla.cor,
    brasao: dados.brasao ?? cla.brasao ?? null,
    sede_propriedade_id: sede.id,
    sede_nome: sede.nome,
    sede_tipo: sede.tipo || '',
    notas: String(dados.notas || '').trim(),
    situacao: 'Pendente',
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('refundar_casa', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_cla_id: cla.id,
      p_nome: patch.nome, p_cor: patch.cor, p_brasao: patch.brasao,
      p_lema: patch.lema, p_sede_id: sede.id, p_notas: patch.notas,
    });
    if (error) throw new Error('Não foi possível reenviar a fundação agora.');
    return patch;
  }

  const atualizada = await atualizar('clas', cla.id, patch);
  await inserir('pedidos_casa', novoPedido(sessao, 'fundacao', {
    cla_id: cla.id,
    cla_nome: patch.nome,
    motivo: patch.notas,
    dados: { lema: patch.lema, sede: sede.nome, sede_tipo: sede.tipo || '', refeita: true },
  }));
  return atualizada;
}

/**
 * Os pedidos que a casa fundada abre: insígnia, herdeiro, mesnada,
 * sede e aliança. A aliança nasce esperando a outra casa; os demais
 * já vão direto para a mesa da Corte.
 */
export async function pedirDaCasa(sessao, cla, tipo, dados = {}, contexto = {}) {
  if (!ehChefeDaCasa(sessao, cla)) {
    throw new Error('Só o Patriarca ou a Matriarca fala pela casa.');
  }
  const { propriedades = [] } = contexto;
  // O mesmo cuidado da fundação: duas abas abertas não podem virar
  // dois pedidos do mesmo ato, cada um com a sua taxa.
  const pedidos = await listar('pedidos_casa').catch(() => contexto.pedidos || []);
  const clas = contexto.clas || [];
  const alvo = tipo === 'alianca'
    ? (clas || []).find((c) => c.id === dados.alvo_cla_id) || null
    : null;
  const { pode, motivo } = podeAbrirPedido(tipo, { cla, propriedades, pedidos, alvo });
  if (!pode) throw new Error(motivo);

  const extra = {
    cla_id: cla.id,
    cla_nome: cla.nome,
    motivo: String(dados.motivo || '').trim(),
    dados: {},
  };

  if (tipo === 'insignia') {
    const lema = limparLema(dados.lema ?? cla.lema);
    const brasao = dados.brasao === undefined ? cla.brasao : dados.brasao;
    const cor = dados.cor || cla.cor || '#7c6bb0';
    const mudou = lema !== (cla.lema || '') || brasao !== (cla.brasao || null) || cor !== (cla.cor || '');
    if (!mudou) throw new Error('Nada mudou no estandarte — não há o que pedir.');
    extra.dados = { lema, brasao, cor };
  }

  if (tipo === 'herdeiro') {
    const nome = String(dados.nome || '').trim();
    if (!nome) throw new Error('Informe quem será o herdeiro.');
    extra.dados = {
      nome,
      civil_id: dados.civil_id || '',
      id_jogo: dados.id_jogo || '',
      raca: dados.raca || '',
      parentesco: String(dados.parentesco || '').trim(),
    };
  }

  if (tipo === 'sede') {
    const sede = (propriedades || []).find((p) => p.id === dados.sede_propriedade_id);
    if (!sede) throw new Error('Escolha a nova sede.');
    if (sede.id === cla.sede_propriedade_id) throw new Error('Esta já é a sede da casa.');
    const minhas = propriedadesDe({ civil_id: cla.lider_civil_id, nome: cla.lider }, propriedades);
    if (!minhas.some((p) => p.id === sede.id)) {
      throw new Error('A sede tem de ser uma propriedade registrada em seu nome.');
    }
    extra.dados = { sede_propriedade_id: sede.id, sede_nome: sede.nome, sede_tipo: sede.tipo || '' };
  }

  if (tipo === 'alianca') {
    extra.alvo_cla_id = alvo.id;
    extra.alvo_cla_nome = alvo.nome;
    // A casa convidada fala primeiro; só depois a Corte lavra o pacto.
    extra.status = 'Aguardando casa';
  }

  const pedido = novoPedido(sessao, tipo, extra);

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('pedir_da_casa', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_cla_id: cla.id,
      p_tipo: tipo, p_motivo: pedido.motivo, p_dados: pedido.dados,
      p_alvo_cla_id: pedido.alvo_cla_id,
    });
    if (error) throw new Error('Não foi possível enviar o pedido agora.');
    return pedido;
  }
  return inserir('pedidos_casa', pedido);
}

/** A casa convidada aceitando ou recusando uma proposta de aliança. */
export async function responderAlianca(sessao, cla, pedido, aceitar) {
  if (!ehChefeDaCasa(sessao, cla)) {
    throw new Error('Só o Patriarca ou a Matriarca responde por uma aliança.');
  }
  if (pedido.alvo_cla_id !== cla.id) throw new Error('Esta proposta não é da sua casa.');
  // O botão pode ter sido clicado duas vezes: vale o estado gravado.
  const agora = (await listar('pedidos_casa').catch(() => []))
    .find((x) => x.id === pedido.id) || pedido;
  if (agora.status !== 'Aguardando casa') throw new Error('Esta proposta já foi respondida.');

  const patch = {
    status: aceitar ? 'Pendente' : 'Recusado pela casa',
    respondido_em: new Date().toISOString(),
    respondido_por: sessao.nome,
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('responder_alianca', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha,
      p_pedido_id: pedido.id, p_aceitar: Boolean(aceitar),
    });
    if (error) throw new Error('Não foi possível responder agora.');
    return patch;
  }
  return atualizar('pedidos_casa', pedido.id, patch);
}

/** Desistir de um pedido que a Corte ainda não julgou. */
export async function cancelarPedidoCasa(sessao, pedido) {
  if (pedido.status !== 'Pendente' && pedido.status !== 'Aguardando casa') {
    throw new Error('Este pedido já foi julgado.');
  }
  const meu = (pedido.civil_id && pedido.civil_id === sessao?.civil_id) ||
    String(pedido.pedido_por || '').trim().toLowerCase() === String(sessao?.nome || '').trim().toLowerCase();
  if (!meu) throw new Error('Este pedido não é seu.');
  // A fundação é o nascimento da casa: desistir dela apagaria a casa junto.
  if (pedido.tipo === 'fundacao') throw new Error('A fundação já está na mesa da Corte.');

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('cancelar_pedido_casa', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_pedido_id: pedido.id,
    });
    if (error) throw new Error('Não foi possível cancelar o pedido agora.');
    return true;
  }
  return remover('pedidos_casa', pedido.id);
}

// ============================================================
//  A PROPRIEDADE NA MÃO DE QUEM É DONO
//
//  Dono e funcionários administram a propriedade pela Cidade de
//  Riften: quem trabalha ali, o que há em estoque e por quanto, e
//  os pedidos que os moradores fazem. O resto da ficha — nome,
//  tipo, local, dono, catalogação — continua sendo da Corte.
// ============================================================

const mesmoTexto = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** Esta pessoa é a dona da propriedade? */
export function ehDonoDaPropriedade(sessao, prop) {
  if (!sessao || !prop) return false;
  if (prop.proprietario_civil_id) return prop.proprietario_civil_id === sessao.civil_id;
  return Boolean(prop.proprietario) && mesmoTexto(prop.proprietario, sessao.nome);
}

/** Esta pessoa trabalha na propriedade? */
export function ehFuncionario(sessao, prop) {
  if (!sessao || !prop) return false;
  return (prop.funcionarios || []).some(
    (f) => (f.civil_id && f.civil_id === sessao.civil_id) ||
           (!f.civil_id && mesmoTexto(f.nome, sessao.nome)),
  );
}

/** As propriedades que esta pessoa administra: as dela e as em que trabalha. */
export const minhasPropriedades = (sessao, propriedades = []) =>
  propriedades.filter((p) => ehDonoDaPropriedade(sessao, p) || ehFuncionario(sessao, p));

/** O saldo de um item, pelo nome, dentro do estoque da propriedade. */
export const emEstoque = (prop, nomeItem) => {
  const i = (prop?.estoque || []).find((x) => mesmoTexto(x.nome, nomeItem));
  return Math.max(0, Number(i?.quantidade) || 0);
};

/** O dono ou um funcionário salvando o que é da casa de negócio. */
export async function salvarPropriedadePropria(sessao, prop, campos) {
  if (!ehDonoDaPropriedade(sessao, prop) && !ehFuncionario(sessao, prop)) {
    throw new Error('Só o dono e os funcionários administram esta propriedade.');
  }
  // Contratar e demitir é do dono; o funcionário mexe no estoque.
  const soDono = ehDonoDaPropriedade(sessao, prop);
  const patch = {
    estoque: (campos.estoque || [])
      .filter((i) => String(i?.nome || '').trim())
      .map((i) => ({
        nome: String(i.nome).trim(),
        quantidade: Math.max(0, Number(i.quantidade) || 0),
        valor: Math.max(0, Number(i.valor) || 0),
      })),
  };
  if (soDono) {
    patch.funcionarios = (campos.funcionarios || [])
      .filter((f) => String(f?.nome || '').trim())
      .map((f) => ({
        nome: String(f.nome).trim(),
        civil_id: f.civil_id || '',
        id_jogo: f.id_jogo || '',
        profissao: f.profissao || '',
        nivel: f.nivel || 'Novato',
        funcao: String(f.funcao || '').trim(),
      }));
  }

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('salvar_propriedade_dono', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: prop.id,
      p_estoque: patch.estoque, p_funcionarios: patch.funcionarios ?? null,
    });
    if (error) throw new Error('Não foi possível salvar a propriedade agora.');
    return patch;
  }
  return atualizar('propriedades', prop.id, patch);
}

/** Um morador pedindo itens a um comércio. Vira ticket para o dono atender. */
export async function pedirCompra(sessao, prop, itens, observacao = '') {
  const linhas = (itens || [])
    .map((i) => ({
      nome: String(i.nome || '').trim(),
      quantidade: Math.max(0, Number(i.quantidade) || 0),
      valor: Math.max(0, Number(i.valor) || 0),
    }))
    .filter((i) => i.nome && i.quantidade > 0);
  if (linhas.length === 0) throw new Error('Escolha ao menos um item e a quantidade.');

  for (const i of linhas) {
    const tem = emEstoque(prop, i.nome);
    if (i.quantidade > tem) {
      throw new Error(`${prop.nome} tem só ${tem} de ${i.nome} em estoque.`);
    }
  }

  const pedido = {
    propriedade_id: prop.id,
    propriedade_nome: prop.nome,
    local: prop.local || 'Riften',
    dono: prop.proprietario || '',
    dono_civil_id: prop.proprietario_civil_id || '',
    comprador: sessao.nome,
    comprador_civil_id: sessao.civil_id || '',
    comprador_id_jogo: sessao.id_jogo || '',
    itens: linhas,
    total: linhas.reduce((s, i) => s + i.quantidade * i.valor, 0),
    observacao: String(observacao || '').trim(),
    status: 'Aberto',
    criado_em: new Date().toISOString(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('pedir_compra', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: prop.id,
      p_itens: linhas, p_observacao: pedido.observacao,
    });
    if (error) throw new Error('Não foi possível enviar o pedido agora.');
    return pedido;
  }
  return inserir('pedidos_compra', pedido);
}

/**
 * Responder ou concluir um pedido de compra.
 *
 * Passa pela mesma porta que o resto do que a casa faz: confere o vínculo
 * de quem está mexendo antes de gravar. Sem isto, dono e funcionário
 * escreviam direto nas tabelas — o que funciona na demonstração, mas
 * bateria na RLS assim que houvesse banco de verdade.
 */
export async function decidirPedidoCompra(sessao, prop, { pedido, patch, estoque = null, avisos = [] }) {
  if (!ehDonoDaPropriedade(sessao, prop) && !ehFuncionario(sessao, prop)) {
    throw new Error('Só o dono e os funcionários atendem os pedidos desta casa.');
  }
  if (pedido?.propriedade_id !== prop.id) {
    throw new Error('Este pedido não é desta propriedade.');
  }

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('decidir_pedido_compra', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: prop.id,
      p_pedido_id: pedido.id, p_pedido: patch, p_estoque: estoque, p_avisos: avisos,
    });
    if (error) throw new Error('Não foi possível registrar a decisão agora.');
    return true;
  }
  await atualizar('pedidos_compra', pedido.id, patch);
  if (estoque) await atualizar('propriedades', prop.id, { estoque });
  for (const a of avisos) await inserir('avisos', a);
  return true;
}

// ============================================================
//  MERCADO IMOBILIÁRIO
//
//  A Corte cadastra os imóveis; o mercado é entre os moradores. O
//  dono anuncia o que é dele, quem quiser manda proposta, e o
//  aceite do dono fecha a venda na hora: o imóvel troca de nome,
//  as outras propostas caem, os dois lados são avisados e a
//  escritura fica lavrada na Crônica da Corte.
// ============================================================

/**
 * O imóvel como está gravado agora.
 *
 * As telas guardam um retrato da tabela, e entre carregar a tela e
 * clicar o botão o dono pode ter mudado, o anúncio pode ter caído e
 * o imóvel pode ter sido vendido. Toda decisão do mercado confere
 * contra a linha gravada, não contra o retrato.
 */
async function imovelAgora(prop) {
  const todos = await listar('propriedades').catch(() => null);
  if (!todos) return prop;
  const achado = todos.find((p) => p.id === prop?.id);
  if (!achado) throw new Error('Este imóvel não está mais no registro do Hold.');
  return achado;
}

/** Um recado no Quadro de Avisos, no formato da tabela. */
const recadoDe = (destino, titulo, texto, autor) => ({
  titulo, texto, destino_civil_id: destino || '', autor,
  criado_em: new Date().toISOString(),
});

/** Anunciar um imóvel. Só o dono anuncia o que é dele. */
export async function anunciarImovel(sessao, prop, { preco, nota = '' } = {}) {
  const imovel = await imovelAgora(prop);
  if (!ehDonoDaPropriedade(sessao, imovel)) {
    throw new Error('Só o dono põe o imóvel à venda.');
  }
  const valor = Math.max(0, Math.round(Number(preco) || 0));
  if (!valor) throw new Error('Diga por quanto você quer vender.');
  const patch = {
    a_venda: true,
    preco: valor,
    anuncio_nota: String(nota || '').trim(),
    anunciada_em: new Date().toISOString(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('anunciar_imovel', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: prop.id,
      p_preco: valor, p_nota: patch.anuncio_nota,
    });
    if (error) throw new Error('Não foi possível anunciar agora.');
    return patch;
  }
  const feito = await atualizar('propriedades', imovel.id, patch);
  await registrar(sessao.nome, 'anunciou à venda', 'imóvel', imovel.nome,
    `${valor.toLocaleString('pt-BR')} Septims`);
  return feito;
}

/**
 * Retirar o anúncio. As propostas abertas caem junto — proposta
 * sem anúncio ficaria pendurada, sem ninguém para responder.
 */
export async function retirarAnuncio(sessao, prop) {
  const imovel = await imovelAgora(prop);
  if (!ehDonoDaPropriedade(sessao, imovel)) {
    throw new Error('Só o dono retira o próprio anúncio.');
  }
  const patch = { a_venda: false, preco: null, anuncio_nota: '', anunciada_em: null };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('retirar_anuncio', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: prop.id,
    });
    if (error) throw new Error('Não foi possível retirar o anúncio agora.');
    return patch;
  }

  await atualizar('propriedades', imovel.id, patch);
  const todas = await listar('ofertas').catch(() => []);
  const quando = new Date().toISOString();
  for (const o of todas) {
    if (o.propriedade_id !== imovel.id || o.status !== 'Aberta') continue;
    await atualizar('ofertas', o.id, {
      status: 'Recusada',
      resposta: 'O anúncio foi retirado do mercado.',
      respondido_por: sessao.nome,
      respondido_em: quando,
    });
    if (o.comprador_civil_id) {
      await inserir('avisos', recadoDe(
        o.comprador_civil_id,
        `Anúncio retirado — ${imovel.nome}`,
        `${sessao.nome} tirou ${imovel.nome} do Mercado Imobiliário, e a sua proposta foi encerrada.`,
        sessao.nome,
      ));
    }
  }
  await registrar(sessao.nome, 'retirou do mercado', 'imóvel', imovel.nome, '');
  return patch;
}

/** Mandar uma proposta por um imóvel anunciado. */
export async function enviarOferta(sessao, prop, { valor, mensagem = '' } = {}) {
  const imovel = await imovelAgora(prop);
  const ofertas = await listar('ofertas').catch(() => []);
  const { pode, motivo } = podeOfertar(sessao, imovel, ofertas);
  if (!pode) throw new Error(motivo);

  const quanto = Math.max(0, Math.round(Number(valor) || 0));
  if (!quanto) throw new Error('Diga quanto você oferece.');

  const oferta = {
    propriedade_id: imovel.id,
    propriedade_nome: imovel.nome,
    categoria: categoriaDe(imovel),
    tipo: imovel.tipo || '',
    local: imovel.local || '',
    preco_pedido: precoDe(imovel),
    dono: imovel.proprietario || '',
    dono_civil_id: imovel.proprietario_civil_id || '',
    comprador: sessao.nome,
    comprador_civil_id: sessao.civil_id || '',
    comprador_id_jogo: sessao.id_jogo || '',
    valor: quanto,
    mensagem: String(mensagem || '').trim(),
    status: 'Aberta',
    resposta: '',
    criado_em: new Date().toISOString(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('enviar_oferta', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: imovel.id,
      p_valor: quanto, p_mensagem: oferta.mensagem,
    });
    if (error) throw new Error('Não foi possível enviar a proposta agora.');
    return oferta;
  }

  const gravada = await inserir('ofertas', oferta);
  if (imovel.proprietario_civil_id) {
    await inserir('avisos', recadoDe(
      imovel.proprietario_civil_id,
      `Proposta por ${imovel.nome}`,
      `${sessao.nome} ofereceu ${quanto.toLocaleString('pt-BR')} Septims pelo seu imóvel `
      + `${imovel.nome}. Responda pelo Mercado Imobiliário.`
      + (oferta.mensagem ? ` Recado: “${oferta.mensagem}”` : ''),
      sessao.nome,
    ));
  }
  return gravada;
}

/** Desistir de uma proposta que o dono ainda não respondeu. */
export async function retirarOferta(sessao, oferta) {
  // Vale o que está gravado: o dono pode ter aceitado enquanto a
  // tela do comprador ainda mostrava o botão de retirar.
  const todas = await listar('ofertas').catch(() => []);
  const atual = todas.find((o) => o.id === oferta.id) || oferta;
  const minha = atual.comprador_civil_id
    ? atual.comprador_civil_id === sessao?.civil_id
    : String(atual.comprador || '').trim().toLowerCase() === String(sessao?.nome || '').trim().toLowerCase();
  if (!minha) throw new Error('Esta proposta não é sua.');
  if (atual.status !== 'Aberta') throw new Error('Esta proposta já foi respondida.');

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('retirar_oferta', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_oferta_id: oferta.id,
    });
    if (error) throw new Error('Não foi possível retirar a proposta agora.');
    return true;
  }
  return atualizar('ofertas', oferta.id, {
    status: 'Retirada', respondido_em: new Date().toISOString(),
  });
}

/**
 * O dono respondendo uma proposta.
 *
 * Aceitar **não** fecha a venda: o negócio é entre os dois, mas quem
 * lavra a escritura é a Corte, que pode cobrar a taxa de transmissão
 * antes de passar o imóvel. Até lá a proposta fica Aceita, o imóvel
 * continua no nome do vendedor e as outras propostas seguem de pé —
 * se a Corte recusar, o negócio simplesmente não aconteceu.
 */
export async function responderOferta(sessao, prop, oferta, aceitar, resposta = '') {
  // Imóvel e proposta relidos: entre carregar a tela e clicar, o
  // imóvel pode ter trocado de dono e a proposta pode ter caído.
  const imovel = await imovelAgora(prop);
  if (!ehDonoDaPropriedade(sessao, imovel)) {
    throw new Error('Só o dono responde às propostas do imóvel.');
  }
  if (oferta.propriedade_id !== imovel.id) throw new Error('Esta proposta não é deste imóvel.');
  const todas = await listar('ofertas').catch(() => []);
  const atual = todas.find((o) => o.id === oferta.id) || oferta;
  if (atual.status !== 'Aberta') throw new Error('Esta proposta já foi respondida.');

  const quando = new Date().toISOString();
  const parecer = String(resposta || '').trim();

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('responder_oferta', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: imovel.id,
      p_oferta_id: atual.id, p_aceitar: Boolean(aceitar), p_resposta: parecer,
    });
    if (error) throw new Error('Não foi possível responder agora.');
    return true;
  }

  await atualizar('ofertas', atual.id, {
    status: aceitar ? 'Aceita' : 'Recusada',
    resposta: parecer,
    respondido_por: sessao.nome,
    respondido_em: quando,
  });

  const avisar = (destino, titulo, texto) => (destino
    ? inserir('avisos', recadoDe(destino, titulo, texto, sessao.nome))
    : Promise.resolve());

  if (!aceitar) {
    await avisar(
      atual.comprador_civil_id,
      `Proposta recusada — ${imovel.nome}`,
      `${sessao.nome} recusou a sua proposta por ${imovel.nome}.`
      + (parecer ? ` Motivo: ${parecer}` : ''),
    );
    return true;
  }

  // Aceite registrado. O imóvel só troca de dono quando a Corte
  // lavrar a escritura — e, se houver taxa, quando ela for paga.
  await avisar(
    atual.comprador_civil_id,
    `Proposta aceita — ${imovel.nome}`,
    `${sessao.nome} aceitou a sua proposta de ${Number(atual.valor).toLocaleString('pt-BR')} `
    + `Septims por ${imovel.nome}. Falta a Corte lavrar a escritura — se houver taxa de `
    + `transmissão, ela aparecerá em Cobranças, e o imóvel passa para o seu nome quando `
    + `o pagamento for confirmado.`
    + (parecer ? ` Recado do vendedor: “${parecer}”` : ''),
  );
  await registrar(
    sessao.nome, 'aceitou proposta', 'imóvel', imovel.nome,
    `${Number(atual.valor).toLocaleString('pt-BR')} Septims de ${atual.comprador} — aguarda escritura`,
  );
  return true;
}

/* ------------------------------------------------------------
   A escritura — o pedaço da venda que é da Corte
   ------------------------------------------------------------ */

/** As vendas aceitas pelo dono e ainda por lavrar. */
export const escriturasPendentes = (ofertas = []) =>
  (ofertas || []).filter((o) => o.status === 'Aceita');

/**
 * Passa o imóvel para o comprador e encerra as outras propostas.
 * É chamada quando a Corte lavra sem taxa, ou quando a taxa de
 * transmissão é confirmada como paga.
 */
export async function lavrarEscritura(oferta, por = 'Corte de Riften') {
  const imovel = (await listar('propriedades').catch(() => []))
    .find((p) => p.id === oferta.propriedade_id);
  if (!imovel) throw new Error('O imóvel desta venda não está mais no registro do Hold.');
  const todas = await listar('ofertas').catch(() => []);
  const atual = todas.find((o) => o.id === oferta.id) || oferta;
  if (atual.status === 'Lavrada') return true;      // já passou por aqui
  if (atual.status !== 'Aceita') throw new Error('Esta venda não está aguardando escritura.');

  const quando = new Date().toISOString();
  await atualizar('propriedades', imovel.id, comNovoDono(imovel, atual));
  await atualizar('ofertas', atual.id, {
    status: 'Lavrada', lavrada_em: quando, lavrada_por: String(por),
  });

  const avisar = (destino, titulo, texto) => (destino
    ? inserir('avisos', recadoDe(destino, titulo, texto, por))
    : Promise.resolve());

  for (const o of todas) {
    if (o.id === atual.id || o.propriedade_id !== imovel.id) continue;
    if (!['Aberta', 'Aceita'].includes(o.status)) continue;
    await atualizar('ofertas', o.id, {
      status: 'Recusada',
      resposta: 'O imóvel foi vendido a outro comprador.',
      respondido_por: String(por),
      respondido_em: quando,
    });
    await avisar(
      o.comprador_civil_id,
      `Imóvel vendido — ${imovel.nome}`,
      `${imovel.nome} foi vendido a outro comprador, e a sua proposta foi encerrada.`,
    );
  }

  await avisar(
    atual.comprador_civil_id,
    `Escritura lavrada — ${imovel.nome}`,
    `A Corte lavrou a escritura: ${imovel.nome} passa a constar em seu nome no registro do Hold.`,
  );
  await avisar(
    atual.dono_civil_id,
    `Venda concluída — ${imovel.nome}`,
    `A Corte lavrou a escritura de ${imovel.nome} para ${atual.comprador}.`,
  );
  await registrar(String(por), 'lavrou escritura', 'imóvel', imovel.nome,
    `${Number(atual.valor).toLocaleString('pt-BR')} Septims — ${atual.dono} → ${atual.comprador}`);
  return true;
}

/**
 * A Corte aprova a venda entre jogadores.
 *
 * Sem taxa, a escritura é lavrada na hora. Com taxa, nasce uma
 * cobrança para o comprador e o imóvel só troca de dono quando a
 * Corte confirmar que ela foi paga.
 */
export async function aprovarTransmissao(oferta, { taxa = 0, por = 'Corte de Riften' } = {}) {
  const quanto = inteiroPositivo(taxa);
  const todas = await listar('ofertas').catch(() => []);
  const atual = todas.find((o) => o.id === oferta?.id);
  if (!atual) throw new Error('Esta venda não está mais nos arquivos da Corte.');
  if (atual.status !== 'Aceita') throw new Error('Esta venda não está aguardando escritura.');

  if (!quanto) return lavrarEscritura(atual, por);

  const cobranca = await emitirCobranca({
    origem: 'transmissao',
    titulo: `Escritura de ${atual.propriedade_nome}`,
    descricao: `Taxa de transmissão da venda de ${atual.propriedade_nome}, de ${atual.dono} `
      + `para ${atual.comprador}, por ${Number(atual.valor).toLocaleString('pt-BR')} Septims. `
      + 'O imóvel passa para o comprador quando a Corte confirmar o pagamento.',
    valor: quanto,
    devedor_tipo: 'civil',
    devedor_id: atual.comprador_civil_id || null,
    devedor_nome: atual.comprador || '',
    referencia_tipo: 'oferta',
    referencia_id: atual.id,
  }, por);

  await atualizar('ofertas', atual.id, { cobranca_id: cobranca?.id || null });
  return cobranca;
}

/** A Corte recusa a venda: a proposta cai e o imóvel volta ao mercado. */
export async function recusarTransmissao(oferta, { por = 'Corte de Riften', parecer = '' } = {}) {
  const atual = (await listar('ofertas').catch(() => [])).find((o) => o.id === oferta?.id);
  if (!atual) throw new Error('Esta venda não está mais nos arquivos da Corte.');
  if (atual.status !== 'Aceita') throw new Error('Esta venda não está aguardando escritura.');
  const motivo = String(parecer || '').trim();
  // Recusar a escritura derruba a taxa junto: cobrar pela passagem de
  // um imóvel que não vai passar seria cobrar por nada.
  if (atual.cobranca_id) {
    const taxa = (await listar('cobrancas').catch(() => []))
      .find((c) => c.id === atual.cobranca_id);
    if (taxa && taxa.status !== 'Paga') {
      await cancelarCobranca(taxa, { por, motivo: 'A Corte não lavrou a escritura desta venda.' });
    }
  }
  await atualizar('ofertas', atual.id, {
    status: 'Recusada',
    cobranca_id: null,
    resposta: motivo || 'A Corte não lavrou a escritura desta venda.',
    respondido_por: String(por),
    respondido_em: new Date().toISOString(),
  });
  for (const [destino, titulo] of [
    [atual.comprador_civil_id, `Escritura recusada — ${atual.propriedade_nome}`],
    [atual.dono_civil_id, `Escritura recusada — ${atual.propriedade_nome}`],
  ]) {
    if (!destino) continue;
    await inserir('avisos', recadoDe(destino, titulo,
      `A Corte não lavrou a escritura desta venda.${motivo ? ` Motivo: ${motivo}` : ''}`, por));
  }
  return true;
}

// ============================================================
//  EDITAIS E CONTRATOS
//
//  Palácio, Quartel e comércios abrem editais; trabalhadores e
//  comércios respondem com preço e prazo. A proposta escolhida vira
//  contrato, e o contrato se encerra quando o órgão dá por cumprido.
//
//  Quem tem login da Corte grava direto (as telas usam `salvar`).
//  Morador e soldado passam por estas funções, que conferem o
//  vínculo antes — e, no Supabase, por RPCs que conferem de novo.
// ============================================================

/** Deixa um edital no formato do banco, venha ele de que porta vier. */
export function normalizarEdital(dados, orgao) {
  const tipo = dados.tipo || 'Fornecimento';
  const titulo = String(dados.titulo || '').trim();
  if (!titulo) throw new Error('Dê um título ao edital — é por ele que a cidade reconhece o chamado.');

  const aceita = (dados.aceita || []).filter((x) => x === 'trabalhador' || x === 'propriedade');
  // Recrutamento é chamado por gente: comércio não veste armadura.
  const quem = tipo === 'Recrutamento' ? ['trabalhador'] : aceita;
  if (quem.length === 0) throw new Error('Diga a quem o edital se dirige: trabalhadores, comércios ou os dois.');

  const itens = tipo === 'Fornecimento'
    ? (dados.itens || [])
      .map((i) => ({ nome: String(i.nome || '').trim(), quantidade: Math.max(1, Number(i.quantidade) || 0) }))
      .filter((i) => i.nome)
    : [];
  if (tipo === 'Fornecimento' && itens.length === 0) {
    throw new Error('Um edital de fornecimento precisa dizer o que se pede, e quanto.');
  }

  const pericias = {};
  for (const [k, v] of Object.entries(dados.pericias_min || {})) {
    if (v && v !== 'N/A') pericias[k] = v;
  }

  return {
    numero: dados.numero || '',
    titulo,
    tipo,
    descricao: String(dados.descricao || '').trim(),
    itens,
    vagas: tipo === 'Fornecimento' ? 0 : Math.max(0, Number(dados.vagas) || 0),
    teto: tipo === 'Recrutamento' ? 0 : Math.max(0, Number(dados.teto) || 0),
    prazo_max: dados.prazo_max || 'Em até 1 mês',
    aceita: quem,
    profissoes: (dados.profissoes || []).filter(Boolean),
    nivel_minimo: dados.nivel_minimo || 'N/A',
    pericias_min: tipo === 'Recrutamento' ? pericias : {},
    orgao_tipo: orgao.orgao_tipo,
    orgao_nome: orgao.orgao_nome,
    propriedade_id: orgao.propriedade_id || '',
    local: orgao.local || 'Riften',
    autor: orgao.autor || '',
    autor_civil_id: orgao.autor_civil_id || '',
    status: 'Aberto',
    criado_em: new Date().toISOString(),
  };
}

/** O dono de uma propriedade abrindo edital em nome da casa. */
export async function abrirEditalPropriedade(sessao, prop, dados, aviso = null) {
  if (!ehDonoDaPropriedade(sessao, prop)) {
    throw new Error('Só o dono da propriedade abre editais em nome dela.');
  }
  // Uma casa chama gente para trabalhar ou fornecer; não chama concorrente.
  const edital = normalizarEdital({ ...dados, aceita: ['trabalhador'] }, {
    orgao_tipo: 'propriedade',
    orgao_nome: prop.nome,
    propriedade_id: prop.id,
    local: prop.local || 'Riften',
    autor: sessao.nome,
    autor_civil_id: sessao.civil_id || '',
  });

  if (SUPABASE_ATIVO) {
    const { data, error } = await supabase.rpc('abrir_edital_propriedade', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: prop.id,
      p_edital: edital, p_aviso: aviso,
    });
    if (error) throw new Error('Não foi possível abrir o edital agora.');
    return data;
  }
  const novo = await inserir('editais', edital);
  if (aviso) await inserir('avisos', aviso);
  return novo;
}

/** Uma proposta: preço, prazo e o que mais o edital exigir. */
export async function enviarProposta(sessao, edital, dados) {
  if (edital.status !== 'Aberto') throw new Error('Este edital não está mais aberto.');
  const como = dados.como === 'propriedade' ? 'propriedade' : 'trabalhador';
  if (!(edital.aceita || []).includes(como)) {
    throw new Error('Este edital não aceita esse tipo de candidato.');
  }
  const prazo = dados.prazo || 'Imediata';
  if ((PRAZO_PESO[prazo] || 9) > (PRAZO_PESO[edital.prazo_max] || 3)) {
    throw new Error(`O edital aceita no máximo "${edital.prazo_max}".`);
  }

  const preco = Math.max(0, Number(dados.preco) || 0);
  if (edital.tipo !== 'Recrutamento') {
    if (preco <= 0) throw new Error('Diga por quanto você faz.');
    if (edital.teto > 0 && preco > edital.teto) {
      throw new Error(`O teto do edital é de ${edital.teto} Septims.`);
    }
  }

  // Uma proposta por pessoa em cada edital. A tela já esconde o formulário
  // de quem concorreu, mas duas abas abertas passariam por cima disso.
  try {
    const jaTem = (await listar('propostas')).some(
      (x) => x.edital_id === edital.id && x.candidato_civil_id === sessao.civil_id &&
             x.status !== 'Recusada',
    );
    if (jaTem) throw new Error('Você já tem uma proposta neste edital. Retire a anterior para mandar outra.');
  } catch (ex) {
    if (/já tem uma proposta/.test(ex.message || '')) throw ex;
    /* sem leitura da tabela (Supabase anônimo): quem barra é o índice único */
  }

  const proposta = {
    edital_id: edital.id,
    edital_numero: edital.numero || '',
    edital_titulo: edital.titulo,
    como,
    candidato: sessao.nome,
    candidato_civil_id: sessao.civil_id || '',
    candidato_id_jogo: sessao.id_jogo || '',
    propriedade_id: como === 'propriedade' ? (dados.propriedade_id || '') : '',
    propriedade_nome: como === 'propriedade' ? (dados.propriedade_nome || '') : '',
    profissao: dados.profissao || '',
    nivel: dados.nivel || '',
    pericias: dados.pericias || {},
    pericias_aferidas: Boolean(dados.pericias_aferidas),
    preco: edital.tipo === 'Recrutamento' ? 0 : preco,
    prazo,
    mensagem: String(dados.mensagem || '').trim(),
    status: 'Enviada',
    criado_em: new Date().toISOString(),
  };
  if (como === 'propriedade' && !proposta.propriedade_id) {
    throw new Error('Escolha por qual propriedade você está concorrendo.');
  }

  if (SUPABASE_ATIVO) {
    const { data, error } = await supabase.rpc('enviar_proposta', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha,
      p_edital_id: edital.id, p_proposta: proposta,
    });
    if (error) throw new Error(error.message || 'Não foi possível enviar a proposta agora.');
    return data;
  }
  return inserir('propostas', proposta);
}

/** Desistir da própria proposta, enquanto ninguém a julgou. */
export async function retirarProposta(sessao, proposta) {
  if (proposta.candidato_civil_id !== sessao.civil_id) {
    throw new Error('Esta proposta não é sua.');
  }
  if (proposta.status !== 'Enviada') throw new Error('Esta proposta já foi julgada.');
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('retirar_proposta', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_proposta_id: proposta.id,
    });
    if (error) throw new Error('Não foi possível retirar a proposta agora.');
    return true;
  }
  return remover('propostas', proposta.id);
}

/**
 * O dono julgando uma proposta feita ao edital da casa dele, ou dando
 * o contrato por cumprido. A Corte e o Quartel fazem o mesmo pelas
 * telas próprias, que já gravam autenticadas.
 */
export async function decidirEditalPropriedade(sessao, prop, decisao) {
  const { edital, patchEdital = null, propostas = [], avisos = [] } = decisao || {};
  if (!ehDonoDaPropriedade(sessao, prop) && !ehFuncionario(sessao, prop)) {
    throw new Error('Só quem responde pela propriedade decide os editais dela.');
  }
  if (edital?.propriedade_id !== prop.id) {
    throw new Error('Este edital não é desta propriedade.');
  }
  // Confere o estado atual antes de decidir: entre abrir a tela e clicar,
  // alguém pode ter fechado o edital.
  if (patchEdital?.status === 'Contratado') {
    const atual = (await listar('editais').catch(() => [])).find((e) => e.id === edital.id);
    if (atual && atual.status !== 'Aberto') {
      throw new Error('Este edital já foi encerrado por outra pessoa.');
    }
  }

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('decidir_edital_propriedade', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_prop_id: prop.id,
      p_edital_id: edital.id, p_edital: patchEdital,
      p_propostas: propostas, p_avisos: avisos,
    });
    if (error) throw new Error('Não foi possível registrar a decisão agora.');
    return true;
  }
  for (const p of propostas) await atualizar('propostas', p.id, p.patch);
  if (patchEdital) await atualizar('editais', edital.id, patchEdital);
  for (const a of avisos) await inserir('avisos', a);
  return true;
}

// ============================================================
//  FORÇAS DE RIFTEN
//
//  Divisões e patentes são registros comuns: a Corte cria e edita
//  pelo `salvar`/`remover` de sempre. O que mora aqui é o que tem
//  regra própria — o soldo, a convocação da milícia e a porta do
//  morador que quer se alistar nela.
// ============================================================

const agoraISO = () => new Date().toISOString();

/**
 * Registra o pagamento do soldo de uma ficha militar.
 * Relê a linha antes de gravar e mexe só no que muda: outra pessoa
 * pode ter promovido o soldado enquanto esta tela estava aberta.
 */
export async function registrarPagamento(guardaId, { valor = 0, por = 'Corte', tabela = 'guardas' } = {}) {
  if (!guardaId) throw new Error('Sem a ficha não dá para registrar o pagamento.');
  const atual = (await listar(tabela).catch(() => [])).find((g) => g.id === guardaId);
  if (!atual) throw new Error('Esta ficha não está mais no registro — recarregue a página.');
  // A semana é a trava: se o soldo desta ficha ainda está em dia, alguém
  // já pagou — de outra aba, ou no clique anterior. Não se paga duas vezes.
  const situacao = soldoDe(atual, await listar('patentes').catch(() => []));
  if (!situacao.vencido) {
    throw new Error(
      `O soldo de ${atual.nome} já foi pago em ${dataBR(situacao.pagoEm)} — o próximo cai em ${dataBR(situacao.proximo)}.`,
    );
  }
  const quanto = Math.max(0, Number(valor) || 0);
  const patch = {
    pago_em: agoraISO(),
    pago_valor: quanto,
    pago_por: String(por || 'Corte'),
  };
  // O livro-caixa primeiro. Marcar a ficha como paga antes e falhar
  // depois deixaria o soldado fora da lista de vencidos por uma
  // semana, sem que o cofre tivesse sido debitado.
  if (quanto) {
    await lancarNoCofre({
      tipo: 'saida',
      valor: quanto,
      origem: 'folha',
      descricao: `Soldo de ${atual.nome}`
        + (tabela === 'milicia' ? ' (milícia convocada)' : ''),
      autor: por,
      referencia_tipo: tabela === 'milicia' ? 'miliciano' : 'guarda',
      referencia_id: guardaId,
    });
  }
  return atualizar(tabela, guardaId, patch);
}

/**
 * Paga de uma vez todo mundo que está com o soldo vencido.
 * @param {Array<{id:string, valor:number}>} linhas
 * @returns {Promise<number>} quantos foram pagos
 */
export async function pagarFolha(linhas = [], { por = 'Corte', tabela = 'guardas' } = {}) {
  let pagos = 0;
  const falhas = [];
  for (const l of linhas) {
    if (!l?.id) continue;
    try {
      await registrarPagamento(l.id, { valor: l.valor, por, tabela });
      pagos += 1;
    } catch (e) {
      // Uma linha que falha não pode abortar a folha inteira: o que já
      // foi pago está pago, e repetir pagaria de novo.
      falhas.push({ id: l.id, motivo: e.message || 'falhou' });
    }
  }
  return { pagos, falhas };
}

/* ---------------- Milícia: a convocação ---------------- */

/** Abre uma convocação. Só uma campanha fica de pé por vez. */
export async function abrirCampanha({ nome, motivo = '', soldo = SOLDO_MILICIA } = {}) {
  const titulo = String(nome || '').trim();
  if (!titulo) throw new Error('Dê um nome à convocação.');
  const abertas = (await listar('campanhas').catch(() => []))
    .filter((c) => (c.status || 'Preparação') !== 'Encerrada');
  if (abertas.length) {
    throw new Error(`A campanha "${abertas[0].nome}" ainda está aberta. Encerre-a antes de convocar outra.`);
  }
  return inserir('campanhas', {
    nome: titulo,
    motivo: String(motivo || '').trim(),
    soldo: Math.max(0, Number(soldo) || 0),
    status: 'Preparação',
    aberta_em: agoraISO(),
    encerrada_em: null,
  });
}

/** Chama milicianos para a campanha. */
export async function convocarMilicianos(campanha, ids = []) {
  if (!campanha?.id) throw new Error('Escolha a campanha antes de convocar.');
  const atual = (await listar('campanhas').catch(() => [])).find((c) => c.id === campanha.id);
  if (!atual) throw new Error('Esta campanha não existe mais.');
  if (atual.status === 'Encerrada') throw new Error('Esta campanha já foi encerrada.');
  const lista = await listar('milicia').catch(() => []);
  let convocados = 0;
  for (const id of ids) {
    const m = lista.find((x) => x.id === id);
    if (!m || m.situacao === 'Convocado') continue;
    await atualizar('milicia', id, {
      situacao: 'Convocado',
      campanha_id: atual.id,
      campanha_nome: atual.nome,
      convocado_em: agoraISO(),
      // O soldo é da campanha: quem entra numa nova entra sem
      // pagamento anterior pendurado, ou passaria a semana sem receber.
      pago_em: null,
      pago_valor: null,
    });
    convocados += 1;
  }
  if (convocados && atual.status !== 'Em campanha') {
    await atualizar('campanhas', atual.id, { status: 'Em campanha' });
  }
  return convocados;
}

/** Dispensa um miliciano da campanha, sem tirá-lo da lista. */
export async function liberarMiliciano(id) {
  if (!id) return null;
  return atualizar('milicia', id, {
    situacao: 'Disponível', campanha_id: null, campanha_nome: '', convocado_em: null,
    pago_em: null, pago_valor: null,
  });
}

/** Encerra a campanha e devolve todo mundo à vida civil. */
export async function encerrarCampanha(campanha) {
  if (!campanha?.id) throw new Error('Escolha a campanha a encerrar.');
  const lista = await listar('milicia').catch(() => []);
  const campanhas = await listar('campanhas').catch(() => []);
  const existe = new Set(campanhas.filter((c) => c.id !== campanha.id).map((c) => c.id));
  for (const m of lista) {
    const daCampanha = m.campanha_id === campanha.id;
    // Convocado cuja campanha sumiu ficaria preso a uma guerra que não
    // existe: nem sai da milícia, nem pode ser chamado de novo.
    const orfao = m.situacao === 'Convocado' && (!m.campanha_id || !existe.has(m.campanha_id));
    if (daCampanha || orfao) await liberarMiliciano(m.id);
  }
  return atualizar('campanhas', campanha.id, { status: 'Encerrada', encerrada_em: agoraISO() });
}

/* ---------------- Milícia: a porta do morador ---------------- */

/** O morador se oferece para a milícia. */
export async function alistarNaMilicia(sessao, { notas = '' } = {}) {
  if (!sessao?.civil_id) throw new Error('Só morador registrado se alista na milícia.');
  const lista = await listar('milicia').catch(() => []);
  const meu = lista.find(
    (m) => (m.civil_id && m.civil_id === sessao.civil_id) ||
           (!m.civil_id && mesmoTexto(m.nome, sessao.nome)),
  );
  if (meu && meu.situacao !== 'Dispensado') throw new Error('Você já está na lista da milícia.');

  const linha = {
    nome: sessao.nome,
    civil_id: sessao.civil_id,
    id_jogo: sessao.id_jogo || '',
    raca: sessao.raca || '',
    situacao: 'Disponível',
    campanha_id: null,
    campanha_nome: '',
    convocado_em: null,
    pago_em: null,
    notas: String(notas || '').trim(),
    criado_em: agoraISO(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('alistar_milicia', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha, p_notas: linha.notas,
    });
    if (error) throw new Error('Não foi possível registrar seu alistamento agora.');
    return linha;
  }
  if (meu) {
    // A linha já existia (a Corte inscreveu à mão, ou ele foi
    // dispensado e voltou): adota-se, sem perder a data em que ele
    // se ofereceu pela primeira vez nem a observação já escrita.
    const { id: _ignora, criado_em: _antes, ...campos } = linha;
    return atualizar('milicia', meu.id, {
      ...campos,
      notas: campos.notas || meu.notas || '',
    });
  }
  return inserir('milicia', linha);
}

/** O morador sai da lista — mas não no meio de uma campanha. */
export async function sairDaMilicia(sessao) {
  if (!sessao?.civil_id) throw new Error('Só morador registrado mexe na própria inscrição.');
  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('sair_milicia', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha,
    });
    if (error) throw new Error('Não foi possível sair da milícia agora.');
    return true;
  }
  const lista = await listar('milicia').catch(() => []);
  const meu = lista.find(
    (m) => (m.civil_id && m.civil_id === sessao.civil_id) ||
           (!m.civil_id && mesmoTexto(m.nome, sessao.nome)),
  );
  if (!meu) throw new Error('Você não está na lista da milícia.');
  if (meu.situacao === 'Convocado') {
    throw new Error('Você está convocado para uma campanha. Fale com o Lorde Comandante antes de sair.');
  }
  await remover('milicia', meu.id);
  return true;
}

// ============================================================
//  TESOURARIA DO HOLD
//
//  Duas regras governam tudo aqui.
//
//  1. Ninguém escreve um saldo. Escreve-se um LANÇAMENTO no
//     livro-caixa, e o saldo é a soma. A declaração de saldo — que
//     a Corte faz para bater com o jogo — também é um lançamento,
//     com a razão escrita. Não existe caminho para mexer no cofre
//     sem deixar rastro.
//
//  2. Receita nenhuma entra no cofre sem passar por uma COBRANÇA
//     confirmada. O morador declara que pagou dentro do jogo; quem
//     confirma é a Corte. Ninguém quita a própria dívida.
// ============================================================

const inteiroPositivo = (v) => Math.max(0, Math.round(Number(v) || 0));

/**
 * Uma linha no livro-caixa. Sempre passa por aqui — é o único lugar
 * do sistema que faz o cofre andar.
 *
 * @param {'entrada'|'saida'|'ajuste'} tipo
 */
export async function lancarNoCofre({
  tipo, valor, origem = 'outro', descricao = '', autor = 'Corte',
  cobranca_id = null, referencia_tipo = '', referencia_id = null, saldo_declarado = null,
} = {}) {
  if (!['entrada', 'saida', 'ajuste'].includes(tipo)) {
    throw new Error('Lançamento sem tipo — não sei se é entrada, saída ou ajuste.');
  }
  const texto = String(descricao || '').trim();
  if (!texto) throw new Error('Todo lançamento precisa dizer a que se refere.');

  // Uma cobrança confirmada gera UMA entrada. Duas pessoas da Corte
  // clicando "Confirmar" ao mesmo tempo passariam as duas pela
  // checagem de status; é aqui, no funil, que a segunda para.
  if (cobranca_id && tipo === 'entrada') {
    const jaLancada = (await listar('cofre').catch(() => []))
      .some((l) => l.cobranca_id === cobranca_id && l.tipo === 'entrada');
    if (jaLancada) {
      throw new Error('Esta cobrança já entrou no livro-caixa — alguém da Corte confirmou antes.');
    }
  }

  const linha = {
    tipo,
    valor: inteiroPositivo(valor),
    origem,
    descricao: texto,
    autor: String(autor || 'Corte'),
    cobranca_id,
    referencia_tipo,
    referencia_id,
    saldo_declarado: tipo === 'ajuste' ? inteiroPositivo(saldo_declarado) : null,
  };
  // No banco quem carimba a hora é o servidor: um relógio adiantado no
  // navegador de alguém da Corte poria o ajuste "no futuro" e apagaria
  // do saldo tudo que entrou antes dele.
  if (!SUPABASE_ATIVO) linha.criado_em = new Date().toISOString();
  const gravada = await inserir('cofre', linha);
  await registrar(linha.autor, tipo === 'saida' ? 'pagou' : tipo === 'ajuste' ? 'declarou saldo' : 'recebeu',
    'cofre', texto, `${linha.valor.toLocaleString('pt-BR')} Septims`);
  return gravada;
}

/**
 * A Corte declara quanto há de verdade no cofre. Como a plataforma
 * não enxerga o jogo, esta é a única âncora — e ela exige razão
 * escrita, porque é a única coisa que explica um salto no saldo.
 */
export async function declararSaldo({ saldo, razao }, autor = 'Corte') {
  const texto = String(razao || '').trim();
  if (!texto) throw new Error('Escreva a razão da atualização do saldo.');
  return lancarNoCofre({
    tipo: 'ajuste',
    valor: 0,
    origem: 'ajuste',
    descricao: texto,
    saldo_declarado: saldo,
    autor,
  });
}

/** Dinheiro saindo do cofre: retirada para o jogo, compra, soldo, cidadania. */
export async function registrarSaida({ valor, origem = 'outro', descricao }, autor = 'Corte') {
  const quanto = inteiroPositivo(valor);
  if (!quanto) throw new Error('Diga quanto está saindo do cofre.');
  return lancarNoCofre({ tipo: 'saida', valor: quanto, origem, descricao, autor });
}

/* ------------------------------------------------------------
   Cobranças
   ------------------------------------------------------------ */

/**
 * Emite uma cobrança — ou atualiza a que já existe para o mesmo fato.
 *
 * O mesmo fato nunca gera duas cobranças: a multa da prisão X é uma
 * só, mesmo que a ficha seja salva dez vezes. Se o valor mudou e a
 * cobrança ainda está em aberto, ela é corrigida; se já foi paga,
 * fica como está — dinheiro recebido não se reescreve.
 */
export async function emitirCobranca({
  origem, titulo, descricao = '', valor,
  devedor_tipo = 'civil', devedor_id = null, devedor_nome = '',
  referencia_tipo = '', referencia_id = null, vence_em = null,
} = {}, autor = 'Corte') {
  const quanto = inteiroPositivo(valor);
  if (!quanto) return null;                       // sem valor não há o que cobrar
  if (!String(titulo || '').trim()) throw new Error('A cobrança precisa dizer do que se trata.');

  const cobrancas = await listar('cobrancas').catch(() => []);

  // Cobrança cancelada é perdão da Corte: reabrir a ficha do fato não
  // pode ressuscitá-la. Só a mão da Corte lavra outra.
  const perdoada = cobrancaDoFato(cobrancas, { origem, referencia_tipo, referencia_id }, true);
  if (perdoada && perdoada.status === 'Cancelada') return null;

  const jaExiste = cobrancaDoFato(cobrancas, { origem, referencia_tipo, referencia_id });

  if (jaExiste) {
    if (jaExiste.status !== 'Em aberto') return jaExiste;
    if (inteiroPositivo(jaExiste.valor) === quanto) return jaExiste;
    return atualizar('cobrancas', jaExiste.id, {
      valor: quanto,
      titulo: String(titulo).trim(),
      descricao: String(descricao || '').trim(),
    });
  }

  const linha = {
    numero: proximoNumeroCobranca(cobrancas),
    origem,
    titulo: String(titulo).trim(),
    descricao: String(descricao || '').trim(),
    valor: quanto,
    devedor_tipo,
    devedor_id,
    devedor_nome: String(devedor_nome || '').trim(),
    referencia_tipo,
    referencia_id,
    status: 'Em aberto',
    vence_em,
    declarado_em: null,
    declarado_nota: '',
    confirmado_por: '',
    confirmado_em: null,
    parecer: '',
    emitida_por: String(autor || 'Corte'),
    criado_em: new Date().toISOString(),
  };
  // O número é conferido contra a lista, mas duas emissões no mesmo
  // instante calculam o mesmo. O banco recusa a repetida; aqui se
  // recalcula e tenta de novo, em vez de perder a cobrança.
  let gravada = null;
  for (let tentativa = 0; tentativa < 3 && !gravada; tentativa += 1) {
    try {
      gravada = await inserir('cobrancas', linha);
    } catch (e) {
      if (tentativa === 2) throw e;
      const agora = await listar('cobrancas').catch(() => []);
      linha.numero = proximoNumeroCobranca(agora);
    }
  }
  await registrar(linha.emitida_por, 'cobrou', 'cobrança',
    `${linha.numero} · ${linha.devedor_nome}`, `${quanto.toLocaleString('pt-BR')} Septims`);
  // Quem recebe o recado: o morador, o dono do imóvel ou quem chefia a
  // casa. Cobrança que ninguém é avisado de ter é cobrança esquecida.
  const destinatario = devedor_tipo === 'civil'
    ? devedor_id
    : await donoDaDivida(devedor_tipo, devedor_id);
  if (destinatario) {
    await inserir('avisos', recadoDe(
      destinatario,
      `Cobrança ${linha.numero} — ${linha.titulo}`,
      `A Corte registrou uma pendência de ${quanto.toLocaleString('pt-BR')} Septims em seu nome. `
      + `${linha.descricao || ''} Veja em Cobranças e declare o pagamento depois de quitar no jogo.`,
      linha.emitida_por,
    ));
  }
  return gravada;
}

/** Quem responde, de carne e osso, pela dívida de uma propriedade ou de uma casa. */
async function donoDaDivida(tipo, id) {
  if (!id) return null;
  if (tipo === 'propriedade') {
    const imovel = (await listar('propriedades').catch(() => [])).find((p) => p.id === id);
    return imovel?.proprietario_civil_id || null;
  }
  if (tipo === 'casa') {
    const casa = (await listar('clas').catch(() => [])).find((c) => c.id === id);
    return casa?.lider_civil_id || null;
  }
  return null;
}

/** O morador avisa que pagou dentro do jogo. Quem confirma é a Corte. */
export async function declararPagamento(sessao, cobranca, nota = '') {
  if (!sessao?.civil_id) throw new Error('Só morador registrado declara pagamento.');
  const atual = (await listar('cobrancas').catch(() => [])).find((c) => c.id === cobranca?.id);
  if (!atual) throw new Error('Esta cobrança não está mais nos arquivos da Corte.');
  const { pode, motivo } = podeDeclararPagamento(atual);
  if (!pode) throw new Error(motivo);

  const patch = {
    status: 'Pagamento declarado',
    declarado_em: new Date().toISOString(),
    declarado_nota: String(nota || '').trim(),
  };

  if (SUPABASE_ATIVO) {
    const { error } = await supabase.rpc('declarar_pagamento', {
      p_id_jogo: sessao.id_jogo, p_senha: sessao.senha,
      p_cobranca_id: atual.id, p_nota: patch.declarado_nota,
    });
    if (error) throw new Error('Não foi possível declarar o pagamento agora.');
    return patch;
  }
  // A mesma conferência que a função do banco faz: a cobrança é dele,
  // de uma propriedade dele ou da casa que ele chefia. Sem isto,
  // qualquer morador declararia o pagamento da dívida alheia.
  const minha = cobrancasDe(sessao, [atual], {
    propriedades: await listar('propriedades').catch(() => []),
    clas: await listar('clas').catch(() => []),
  });
  if (!minha.length) throw new Error('Esta cobrança não é sua.');

  const feita = await atualizar('cobrancas', atual.id, patch);
  await registrar(sessao.nome, 'declarou pagamento', 'cobrança',
    `${atual.numero} · ${atual.titulo}`, `${inteiroPositivo(atual.valor).toLocaleString('pt-BR')} Septims`);
  return feita;
}

/**
 * A Corte confirma que o dinheiro entrou. É aqui — e só aqui — que
 * uma cobrança vira linha no livro-caixa. Algumas origens têm efeito
 * próprio: a escritura, por exemplo, só transfere o imóvel depois
 * que a taxa é paga.
 */
export async function confirmarCobranca(cobranca, { por = 'Corte', parecer = '' } = {}) {
  const atual = (await listar('cobrancas').catch(() => [])).find((c) => c.id === cobranca?.id);
  if (!atual) throw new Error('Esta cobrança não está mais nos arquivos da Corte.');
  if (atual.status === 'Paga') throw new Error('Esta cobrança já foi quitada.');
  if (atual.status === 'Cancelada') throw new Error('Esta cobrança foi cancelada.');

  // O efeito vem primeiro: se a escritura não pode ser lavrada — o
  // imóvel sumiu, a venda foi recusada —, o Hold não fica com o
  // dinheiro de uma coisa que não aconteceu.
  await efeitoDaCobranca(atual, por);

  const quando = new Date().toISOString();
  await lancarNoCofre({
    tipo: 'entrada',
    valor: atual.valor,
    origem: atual.origem,
    descricao: `${atual.numero} · ${atual.titulo} — ${atual.devedor_nome || 'sem devedor'}`,
    autor: por,
    cobranca_id: atual.id,
    referencia_tipo: atual.referencia_tipo || '',
    referencia_id: atual.referencia_id || null,
  });

  const paga = await atualizar('cobrancas', atual.id, {
    status: 'Paga',
    confirmado_por: String(por || 'Corte'),
    confirmado_em: quando,
    parecer: String(parecer || '').trim(),
  });

  if (atual.devedor_tipo === 'civil' && atual.devedor_id) {
    await inserir('avisos', recadoDe(
      atual.devedor_id,
      `Cobrança ${atual.numero} quitada`,
      `A Corte confirmou o pagamento de ${inteiroPositivo(atual.valor).toLocaleString('pt-BR')} Septims `
      + `referente a ${atual.titulo}.`,
      por,
    ));
  }
  return paga;
}

/**
 * O que acontece no mundo quando a cobrança é paga.
 *
 * Hoje só a escritura tem efeito: a venda entre jogadores fica
 * parada esperando a Corte, e é o pagamento da taxa que passa a
 * propriedade para o comprador.
 */
async function efeitoDaCobranca(cobranca, por) {
  if (cobranca.origem !== 'transmissao' || cobranca.referencia_tipo !== 'oferta') return;
  const oferta = (await listar('ofertas').catch(() => [])).find((o) => o.id === cobranca.referencia_id);
  if (!oferta) return;
  await lavrarEscritura(oferta, por);
}

/** A Corte recusa a declaração: a cobrança volta a ficar em aberto. */
export async function recusarDeclaracao(cobranca, { por = 'Corte', parecer = '' } = {}) {
  const atual = (await listar('cobrancas').catch(() => [])).find((c) => c.id === cobranca?.id);
  if (!atual) throw new Error('Esta cobrança não está mais nos arquivos da Corte.');
  if (atual.status !== 'Pagamento declarado') {
    throw new Error('Só se recusa uma declaração de pagamento que esteja na mesa.');
  }
  const feita = await atualizar('cobrancas', atual.id, {
    status: 'Em aberto',
    declarado_em: null,
    declarado_nota: '',
    parecer: String(parecer || '').trim(),
  });
  if (atual.devedor_tipo === 'civil' && atual.devedor_id) {
    await inserir('avisos', recadoDe(
      atual.devedor_id,
      `Cobrança ${atual.numero} continua em aberto`,
      `A Corte não confirmou o pagamento declarado. ${String(parecer || '').trim()}`,
      por,
    ));
  }
  return feita;
}

/** Cancelar é perdoar ou corrigir um engano — nunca apagar dinheiro recebido. */
export async function cancelarCobranca(cobranca, { por = 'Corte', motivo = '' } = {}) {
  const atual = (await listar('cobrancas').catch(() => [])).find((c) => c.id === cobranca?.id);
  if (!atual) throw new Error('Esta cobrança não está mais nos arquivos da Corte.');
  if (atual.status === 'Paga') {
    throw new Error('Cobrança paga não se cancela — o dinheiro já entrou no livro-caixa.');
  }
  const cancelada = await atualizar('cobrancas', atual.id, {
    status: 'Cancelada',
    parecer: String(motivo || '').trim(),
    confirmado_por: String(por || 'Corte'),
    confirmado_em: new Date().toISOString(),
  });
  // Taxa de escritura cancelada não pode deixar a venda presa: sem
  // soltar o vínculo, a Corte não conseguiria nem lavrar nem cobrar
  // de novo, e o negócio ficava travado para sempre.
  if (atual.origem === 'transmissao' && atual.referencia_tipo === 'oferta') {
    await atualizar('ofertas', atual.referencia_id, { cobranca_id: null }).catch(() => {});
  }
  return cancelada;
}

/* ------------------------------------------------------------
   As pontes: cada sistema emitindo a sua cobrança
   ------------------------------------------------------------
   Nenhum deles inventa formato próprio — todos chamam
   `emitirCobranca`, e por isso todos aparecem no mesmo lugar,
   no mesmo gráfico e na mesma aba do morador.
   ------------------------------------------------------------ */

/** A multa que o Código aplicou vira cobrança contra o preso. */
export async function cobrarMultaDaPrisao(prisao, autor = 'Corte') {
  if (!prisao?.id || !prisao.multa) return null;
  return emitirCobranca({
    origem: 'multa',
    titulo: `Multa — ${prisao.crime || 'crime registrado'}`,
    descricao: `${prisao.artigo ? `${prisao.artigo}. ` : ''}${prisao.motivo || ''}`.trim(),
    valor: prisao.multa,
    devedor_tipo: 'civil',
    devedor_id: prisao.civil_id || null,
    devedor_nome: prisao.preso || '',
    referencia_tipo: 'prisao',
    referencia_id: prisao.id,
  }, autor);
}

/** Soltar sob fiança cobra a fiança — é o que a torna rastreável. */
export async function cobrarFiancaDaPrisao(prisao, autor = 'Corte') {
  if (!prisao?.id || !prisao.fianca) return null;
  return emitirCobranca({
    origem: 'fianca',
    titulo: `Fiança — ${prisao.crime || 'crime registrado'}`,
    descricao: `Fiança para soltura de ${prisao.preso}.`,
    valor: prisao.fianca,
    devedor_tipo: 'civil',
    devedor_id: prisao.civil_id || null,
    devedor_nome: prisao.preso || '',
    referencia_tipo: 'prisao',
    referencia_id: prisao.id,
  }, autor);
}

/**
 * A licença emitida cobra o titular.
 *
 * Sendo do clã, quem responde é o líder: o clã não tem bolso, e uma
 * cobrança sem devedor de carne e osso ficaria pendurada para sempre,
 * sem ninguém para vê-la nem para pagá-la.
 */
export async function cobrarLicenca(licenca, autor = 'Corte', guildas = []) {
  if (!licenca?.id) return null;
  const valor = inteiroPositivo(licenca.valor);
  if (!valor) return null;

  const daGuilda = licenca.titular_tipo === 'guilda' && licenca.guilda_id;
  const cla = daGuilda
    ? (guildas.length ? guildas : await listar('guildas').catch(() => []))
      .find((g) => g.id === licenca.guilda_id)
    : null;

  return emitirCobranca({
    origem: 'licenca',
    titulo: `${licenca.numero} — ${licenca.titular}`,
    descricao: daGuilda
      ? `Taxa de emissão da licença do clã ${licenca.guilda_nome || cla?.nome || ''}, `
        + 'devida por quem o lidera.'
      : 'Taxa de emissão da licença.',
    valor,
    devedor_tipo: 'civil',
    devedor_id: daGuilda ? (cla?.lider_civil_id || null) : (licenca.civil_id || null),
    devedor_nome: daGuilda ? (cla?.lider || licenca.titular || '') : (licenca.titular || ''),
    referencia_tipo: 'licenca',
    referencia_id: licenca.id,
  }, autor);
}

/** A taxa da chancelaria só é cobrada quando o pedido é deferido. */
export async function cobrarTaxaDaChancelaria(pedido, autor = 'Corte') {
  if (!pedido?.id) return null;
  const valor = inteiroPositivo(pedido.custo);
  if (!valor) return null;
  const daCasa = Boolean(pedido.cla_id) && pedido.tipo !== 'nobreza';
  return emitirCobranca({
    origem: 'chancelaria',
    titulo: `${PEDIDO_CASA_POR_ID[pedido.tipo]?.nome || 'Ato da Chancelaria'}`,
    descricao: `Taxa do ato deferido pela Corte${pedido.cla_nome ? ` — Casa ${pedido.cla_nome}` : ''}.`,
    valor,
    devedor_tipo: daCasa ? 'casa' : 'civil',
    devedor_id: daCasa ? pedido.cla_id : (pedido.civil_id || null),
    devedor_nome: daCasa ? `Casa ${pedido.cla_nome}` : (pedido.pedido_por || ''),
    referencia_tipo: 'pedido_casa',
    referencia_id: pedido.id,
  }, autor);
}

/**
 * O Palácio vendendo um imóvel a um jogador. Só esta venda é receita
 * do Hold: quando dois jogadores negociam entre si, o dinheiro é
 * deles, e o que entra no cofre é a taxa da escritura.
 */
export async function cobrarAquisicaoDeImovel(imovel, { valor, autor = 'Corte' } = {}) {
  if (!imovel?.id) return null;
  const quanto = inteiroPositivo(valor);
  if (!quanto) return null;
  const cobranca = await emitirCobranca({
    origem: 'imovel',
    titulo: `Aquisição — ${imovel.nome}`,
    descricao: `Valor pago ao Hold pela concessão de ${imovel.nome} a ${imovel.proprietario}.`,
    valor: quanto,
    devedor_tipo: 'civil',
    devedor_id: imovel.proprietario_civil_id || null,
    devedor_nome: imovel.proprietario || '',
    referencia_tipo: 'aquisicao',
    referencia_id: imovel.id,
  }, autor);
  await atualizar('propriedades', imovel.id, {
    adquirida_em: new Date().toISOString(),
    adquirida_valor: quanto,
    adquirida_por: imovel.proprietario || '',
  });
  return cobranca;
}

/** O preço de tabela de uma licença, para a tela sugerir o valor. */
export const precoDaLicenca = (tipoId, precos = []) => precoDaTabela(`licenca:${tipoId}`, precos);

/** O preço de tabela da escritura entre jogadores. */
export const precoDaEscritura = (precos = []) => precoDaTabela('imovel:transmissao', precos);

/** O preço de tabela da troca de cidadania, paga pelo Hold na isenção. */
export const precoDaCidadania = (precos = []) => precoDaTabela('cidadania:troca', precos);

/**
 * As cobranças de um morador.
 *
 * No banco de verdade ele é anônimo e não enxerga a tabela: quem
 * responde é a função `minhas_cobrancas`, que confere ID e senha e
 * devolve só o que é dele, da propriedade dele e da casa que chefia.
 * No modo local a conta é feita aqui mesmo, sobre o que já está
 * carregado — e as duas portas devolvem a mesma coisa.
 */
export async function minhasCobrancas(sessao, contexto = {}) {
  if (!sessao?.civil_id) return [];
  const { cobrancas = [], propriedades = [], clas = [] } = contexto;
  if (!SUPABASE_ATIVO) {
    return cobrancasDe(sessao, cobrancas, { propriedades, clas });
  }
  const { data, error } = await supabase.rpc('minhas_cobrancas', {
    p_id_jogo: sessao.id_jogo, p_senha: sessao.senha,
  });
  if (error) throw new Error('Não foi possível consultar suas cobranças agora.');
  return rotularMinhas(sessao, data || [], { propriedades, clas });
}
