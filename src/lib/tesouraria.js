// ============================================================
//  TESOURARIA DO HOLD
//
//  Duas ideias, e o resto sai delas.
//
//  1. O COFRE é um livro-caixa. Nenhuma tela escreve um saldo:
//     escreve-se um lançamento, e o saldo é a conta. Como a
//     plataforma não fala com o jogo, a Corte declara de tempos em
//     tempos o saldo verdadeiro — e essa declaração é um
//     lançamento como outro qualquer, com a razão escrita. O saldo
//     de hoje é "o último saldo declarado, mais o que entrou e
//     saiu desde então".
//
//  2. A COBRANÇA é toda receita, venha de onde vier: multa, fiança,
//     licença, imóvel, escritura, taxa da nobreza ou título lavrado
//     à mão. Ela nasce Em aberto, o morador declara que pagou
//     dentro do jogo, e só a confirmação da Corte vira dinheiro no
//     cofre. Ninguém quita a própria dívida.
//
//  Nada aqui grava nada — são contas sobre o que já está gravado.
// ============================================================
import {
  ORIGEM_COFRE_POR_ID, ORIGENS_COFRE, PRECO_PADRAO_POR_CHAVE, PRECOS_PADRAO,
} from './constants.js';

const norm = (s) => String(s || '').trim().toLowerCase();
const inteiro = (v) => Math.max(0, Math.round(Number(v) || 0));

/* ============================================================
   Tabela de preços
   ============================================================ */

/**
 * Quanto custa uma coisa hoje. A linha gravada pela Corte manda;
 * na falta dela vale o preço do primeiro dia.
 */
export function precoDe(chave, precos = []) {
  const gravado = (precos || []).find((p) => p.chave === chave);
  if (gravado && gravado.valor !== null && gravado.valor !== undefined && String(gravado.valor) !== '') {
    return inteiro(gravado.valor);
  }
  return inteiro(PRECO_PADRAO_POR_CHAVE[chave]?.valor);
}

/** A tabela inteira para a tela: o padrão, com o que a Corte mudou por cima. */
export function tabelaDePrecos(precos = []) {
  return PRECOS_PADRAO.map((padrao) => {
    const gravado = (precos || []).find((p) => p.chave === padrao.chave);
    return {
      ...padrao,
      id: gravado?.id || null,
      valor: precoDe(padrao.chave, precos),
      alterado: Boolean(gravado) && inteiro(gravado.valor) !== inteiro(padrao.valor),
    };
  });
}

/** Os preços agrupados como aparecem no painel. */
export function precosPorGrupo(precos = []) {
  const linhas = tabelaDePrecos(precos);
  const grupos = [...new Set(linhas.map((l) => l.grupo))];
  return grupos.map((grupo) => ({ grupo, itens: linhas.filter((l) => l.grupo === grupo) }));
}

/* ============================================================
   O livro-caixa
   ============================================================ */

const quando = (l) => new Date(l?.criado_em || 0).getTime() || 0;

/** Do mais antigo para o mais recente — a ordem em que o livro foi escrito. */
export const emOrdem = (lancamentos = []) =>
  [...(lancamentos || [])].sort(
    // Empate de relógio se desfaz pelo id: dois lançamentos no mesmo
    // milissegundo precisam ter uma ordem, e ela tem de ser sempre a
    // mesma, ou o saldo muda de valor a cada render.
    (a, b) => quando(a) - quando(b) || String(a.id || '').localeCompare(String(b.id || '')),
  );

/** Do mais recente para o mais antigo — como se lê um extrato. */
export const extrato = (lancamentos = []) => [...emOrdem(lancamentos)].reverse();

/** A última declaração de saldo, se houver alguma. */
export function ultimaDeclaracao(lancamentos = []) {
  const linhas = emOrdem(lancamentos);
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    if (linhas[i].tipo === 'ajuste') return linhas[i];
  }
  return null;
}

/**
 * O que entrou e saiu depois da última declaração.
 *
 * O corte é por posição no livro, não por comparação de relógio: com
 * `criado_em > data` bastava um navegador adiantado para a declaração
 * nascer "no futuro" e apagar do saldo tudo o que tinha entrado antes.
 */
export function desdeADeclaracao(lancamentos = []) {
  const linhas = emOrdem(lancamentos);
  let corte = -1;
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    if (linhas[i].tipo === 'ajuste') { corte = i; break; }
  }
  return linhas.slice(corte + 1).filter((l) => l.tipo !== 'ajuste');
}

const soma = (linhas, tipo) => linhas
  .filter((l) => l.tipo === tipo)
  .reduce((s, l) => s + inteiro(l.valor), 0);

/**
 * O estado do cofre.
 *
 * @returns {{saldo:number, declarado:number, declaradoEm:string|null,
 *            declaradoPor:string, entradas:number, saidas:number,
 *            movimentos:Array, semDeclaracao:boolean}}
 */
export function estadoDoCofre(lancamentos = []) {
  const declaracao = ultimaDeclaracao(lancamentos);
  const declarado = declaracao ? inteiro(declaracao.saldo_declarado) : 0;
  const movimentos = desdeADeclaracao(lancamentos);
  const entradas = soma(movimentos, 'entrada');
  const saidas = soma(movimentos, 'saida');
  return {
    saldo: declarado + entradas - saidas,
    declarado,
    declaradoEm: declaracao?.criado_em || null,
    declaradoPor: declaracao?.autor || '',
    razao: declaracao?.descricao || '',
    entradas,
    saidas,
    movimentos,
    semDeclaracao: !declaracao,
  };
}

/** Tudo que entrou e tudo que saiu, desde sempre — para o resumo do ano. */
export function totaisDeSempre(lancamentos = []) {
  const linhas = lancamentos || [];
  return {
    entradas: soma(linhas, 'entrada'),
    saidas: soma(linhas, 'saida'),
    lancamentos: linhas.length,
  };
}

/**
 * A arrecadação repartida por origem, já ordenada da maior para a
 * menor e com a fatia de cada uma — é o gráfico da tela.
 *
 * @param {'entrada'|'saida'} tipo
 */
export function porOrigem(lancamentos = [], tipo = 'entrada', marco = null) {
  const corte = marco ? new Date(marco).getTime() : 0;
  const linhas = (lancamentos || []).filter((l) => l.tipo === tipo && quando(l) > corte);
  const total = linhas.reduce((s, l) => s + inteiro(l.valor), 0);
  const mapa = new Map();
  for (const l of linhas) {
    const id = l.origem || 'outro';
    mapa.set(id, (mapa.get(id) || 0) + inteiro(l.valor));
  }
  return {
    total,
    fatias: [...mapa.entries()]
      .map(([id, valor]) => ({
        id,
        valor,
        nome: ORIGEM_COFRE_POR_ID[id]?.nome || id,
        cor: ORIGEM_COFRE_POR_ID[id]?.cor || '#7b7266',
        icone: ORIGEM_COFRE_POR_ID[id]?.icone || 'moeda',
        pct: total ? Math.round((valor / total) * 100) : 0,
      }))
      .sort((a, b) => b.valor - a.valor),
  };
}

/** Um marco de tempo para os filtros do extrato. */
export const HA_30_DIAS = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
};

/* ============================================================
   Cobranças
   ============================================================ */

export const emAberto = (cobrancas = []) =>
  (cobrancas || []).filter((c) => (c.status || 'Em aberto') === 'Em aberto');

export const declaradas = (cobrancas = []) =>
  (cobrancas || []).filter((c) => c.status === 'Pagamento declarado');

export const pagas = (cobrancas = []) => (cobrancas || []).filter((c) => c.status === 'Paga');

/** O que ainda está de pé: em aberto ou esperando a Corte conferir. */
export const pendentes = (cobrancas = []) =>
  (cobrancas || []).filter((c) => ['Em aberto', 'Pagamento declarado'].includes(c.status || 'Em aberto'));

export const somaDe = (cobrancas = []) =>
  (cobrancas || []).reduce((s, c) => s + inteiro(c.valor), 0);

/** COB-0001 — o número que a Corte cita ao cobrar. */
export function proximoNumero(cobrancas = []) {
  const usados = (cobrancas || [])
    .map((c) => Number(String(c.numero || '').split('-').pop()) || 0);
  return `COB-${String(Math.max(0, ...usados) + 1).padStart(4, '0')}`;
}

/**
 * A cobrança já lavrada para este mesmo fato.
 *
 * Por padrão só conta a que está de pé: uma cancelada não impede que
 * a Corte cobre de novo à mão. Com `incluirCancelada`, quem pergunta
 * é o emissor automático — e para ele a cancelada importa, porque
 * cancelar foi perdoar, e reabrir a ficha não pode desfazer perdão.
 */
export function cobrancaDoFato(
  cobrancas = [], { origem, referencia_tipo, referencia_id }, incluirCancelada = false,
) {
  if (!referencia_id) return null;
  return (cobrancas || []).find(
    (c) => c.origem === origem &&
           c.referencia_tipo === referencia_tipo &&
           c.referencia_id === referencia_id &&
           (incluirCancelada || c.status !== 'Cancelada'),
  ) || null;
}

/**
 * As cobranças que caem no colo de um morador: as dele, as das
 * propriedades registradas no nome dele e as da casa que ele chefia.
 * Cada linha ganha `deQuem`, para a tela dizer por que ele está vendo
 * aquilo.
 */
export function cobrancasDe(pessoa, cobrancas = [], { propriedades = [], clas = [] } = {}) {
  if (!pessoa) return [];
  const id = pessoa.civil_id || pessoa.id;
  const nome = norm(pessoa.nome);

  // Propriedade e casa se reconhecem pelo vínculo com o Registro
  // Civil, nunca pelo nome escrito: dois moradores homônimos veriam —
  // e poderiam declarar como paga — a dívida um do outro.
  const minhas = (propriedades || []).filter(
    (p) => p.proprietario_civil_id && p.proprietario_civil_id === id,
  );
  const minhasCasas = (clas || []).filter(
    (c) => c.lider_civil_id && c.lider_civil_id === id,
  );

  return rotularCobrancas(cobrancas, { id, nome, minhas, minhasCasas })
    .sort((a, b) => quando(b) - quando(a));
}

/**
 * Escreve em cada cobrança de quem ela é, e descarta as que não são
 * desta pessoa. Serve às duas portas: a lista local, que ainda
 * precisa ser filtrada, e a que veio do banco já filtrada — nesta,
 * nada é descartado, só ganha rótulo.
 */
function rotularCobrancas(cobrancas, { id, nome, minhas, minhasCasas }, filtrar = true) {
  return (cobrancas || [])
    .map((c) => {
      if (c.devedor_tipo === 'civil') {
        const dele = (c.devedor_id && c.devedor_id === id) ||
                     (!c.devedor_id && nome && norm(c.devedor_nome) === nome);
        if (dele || !filtrar) return { ...c, deQuem: 'Você' };
        return null;
      }
      if (c.devedor_tipo === 'propriedade') {
        const imovel = minhas.find((p) => p.id === c.devedor_id);
        if (imovel) return { ...c, deQuem: `Propriedade · ${imovel.nome}` };
        return filtrar ? null : { ...c, deQuem: 'Propriedade sua' };
      }
      if (c.devedor_tipo === 'casa') {
        const casa = minhasCasas.find((x) => x.id === c.devedor_id);
        if (casa) return { ...c, deQuem: `Casa ${casa.nome}` };
        return filtrar ? null : { ...c, deQuem: 'Sua casa nobre' };
      }
      return filtrar ? null : { ...c, deQuem: 'Você' };
    })
    .filter(Boolean);
}

/**
 * As cobranças que o banco já devolveu filtradas para esta pessoa —
 * aqui elas só ganham o rótulo de quem deve o quê.
 */
export function rotularMinhas(pessoa, cobrancas = [], { propriedades = [], clas = [] } = {}) {
  if (!pessoa) return [];
  const id = pessoa.civil_id || pessoa.id;
  const nome = norm(pessoa.nome);
  const minhas = (propriedades || []).filter((p) => p.proprietario_civil_id === id);
  const minhasCasas = (clas || []).filter((c) => c.lider_civil_id === id);
  return rotularCobrancas(cobrancas, { id, nome, minhas, minhasCasas }, false)
    .sort((a, b) => quando(b) - quando(a));
}

/** Ele pode declarar o pagamento desta cobrança? */
export function podeDeclarar(cobranca) {
  const status = cobranca?.status || 'Em aberto';
  if (status === 'Paga') return { pode: false, motivo: 'Esta cobrança já foi quitada.' };
  if (status === 'Cancelada') return { pode: false, motivo: 'Esta cobrança foi cancelada pela Corte.' };
  if (status === 'Pagamento declarado') {
    return { pode: false, motivo: 'Você já declarou o pagamento — a Corte ainda vai conferir.' };
  }
  return { pode: true, motivo: '' };
}

/** O rótulo de quem deve, para as listas da Corte. */
export const nomeDoDevedor = (c) => String(c?.devedor_nome || '').trim() || '—';

export const origemDe = (x) => ORIGEM_COFRE_POR_ID[x?.origem] || ORIGEM_COFRE_POR_ID.outro;

export { ORIGENS_COFRE, ORIGEM_COFRE_POR_ID };

export const septims = (n) => `${Number(n || 0).toLocaleString('pt-BR')} Septims`;

/* ============================================================
   Datas
   ============================================================ */

/** 25/08/2026 — o dia, do jeito que a Corte escreve. */
export function dataOuTraco(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 25/08/26 14:30 — para o extrato, onde a hora importa. */
export function dataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
