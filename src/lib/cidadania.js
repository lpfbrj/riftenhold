// ============================================================
//  CIDADANIA DE RIFTEN
//
//  Duas situações, e só duas: quem nasceu aqui e quem está vindo
//  de outra cidade. A primeira não pede nada — o Hold é a casa
//  dele desde sempre. A segunda é uma transferência, e o morador
//  pode precisar de **isenção** para desfazer o vínculo anterior:
//  o pedido nasce com ele e quem decide é a Corte.
//
//  Nada aqui grava nada; são contas sobre a linha do Registro
//  Civil, para a tela e o banco lerem a mesma coisa.
// ============================================================
import { HOLDS, ORIGEM_POR_ID, SEM_ISENCAO } from './constants.js';

/** Para onde ele veio é sempre Riften — a origem é o resto do mapa. */
export const CIDADES_DE_ORIGEM = HOLDS.filter((h) => h.id !== 'riften');
export const OUTRO_LUGAR = 'outro';

/** O nome que se escreve na ficha, venha ele da lista ou do campo livre. */
export function nomeDaCidade(id, escrito) {
  if (id === OUTRO_LUGAR) return String(escrito || '').trim();
  return CIDADES_DE_ORIGEM.find((h) => h.id === id)?.nome || String(escrito || '').trim();
}

/**
 * Os campos de cidadania, no formato do banco.
 * Origem natal apaga o que só faz sentido em transferência: sem isso,
 * quem trocasse de opção deixaria para trás uma cidade fantasma.
 */
export function normalizarCidadania(v = {}) {
  const origem = v.origem === 'transferencia' ? 'transferencia' : 'natal';
  if (origem === 'natal') {
    return {
      origem,
      cidade_anterior_id: '',
      cidade_anterior: '',
      isencao_status: SEM_ISENCAO,
      isencao_motivo: '',
    };
  }
  const cidade_anterior_id = v.cidade_anterior_id || '';
  const cidade_anterior = nomeDaCidade(cidade_anterior_id, v.cidade_anterior);
  const pede = Boolean(v.pede_isencao);
  return {
    origem,
    cidade_anterior_id,
    cidade_anterior,
    isencao_status: pede ? 'Pendente' : (v.isencao_status || SEM_ISENCAO),
    isencao_motivo: pede ? String(v.isencao_motivo || '').trim() : (v.isencao_motivo || ''),
  };
}

/** O que a ficha diz sobre a cidadania desta pessoa. */
export function cidadaniaDe(civil = {}) {
  const origem = civil.origem === 'transferencia' ? 'transferencia' : 'natal';
  const status = civil.isencao_status || SEM_ISENCAO;
  return {
    origem,
    rotulo: ORIGEM_POR_ID[origem]?.nome || '',
    transferido: origem === 'transferencia',
    cidade: civil.cidade_anterior || '',
    isencao: status,
    pendente: status === 'Pendente',
    concedida: status === 'Concedida',
    motivo: civil.isencao_motivo || '',
    parecer: civil.isencao_parecer || '',
    // Só faz sentido pedir de novo quando ainda não há pedido em pé.
    podePedir: origem === 'transferencia' && (status === SEM_ISENCAO || status === 'Negada'),
  };
}

/** Quem está esperando a Corte decidir a isenção. */
export const isencoesPendentes = (civis = []) =>
  civis.filter((c) => c.isencao_status === 'Pendente');

/** Uma linha curta para selos e listas: "Vindo de Windhelm". */
export function selosDeCidadania(civil = {}) {
  const c = cidadaniaDe(civil);
  if (!c.transferido) return [];
  const selos = [{ texto: c.cidade ? `Vindo de ${c.cidade}` : 'Vindo de outra cidade', tom: 'roxo' }];
  if (c.isencao !== SEM_ISENCAO) selos.push({ texto: `Isenção ${c.isencao.toLowerCase()}`, isencao: c.isencao });
  return selos;
}
