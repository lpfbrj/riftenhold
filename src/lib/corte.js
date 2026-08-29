// ============================================================
//  OS CARGOS DA CORTE
//
//  Seis cargos vêm de fábrica (Jarl, Lorde Mão, Lorde Comandante,
//  Mestre da Moeda, Mago da Corte, Alquimista da Corte). A Corte
//  pode renomeá-los, reescrever a descrição, mudar a ordem em que
//  aparecem — e criar quantos outros quiser.
//
//  Onde isso fica guardado: na própria linha da tabela `corte`, que
//  já é a linha do cargo. `titulo` e `descricao` são a personalização;
//  quando não há nada gravado, vale o que veio de fábrica. Um cargo
//  criado pela Corte é uma linha cujo `cargo_id` não está entre os
//  seis — só ela pode ser excluída, porque os seis se reconstroem
//  sozinhos a partir da constante.
// ============================================================
import { CARGOS_CORTE } from './constants.js';

const BASE = Object.fromEntries(CARGOS_CORTE.map((c) => [c.id, c]));
const chave = (linha) => linha.cargo_id || linha.id;
const texto = (v) => String(v ?? '').trim();

/** É um dos seis que vêm de fábrica? */
export const cargoDeFabrica = (id) => Boolean(BASE[id]);

/**
 * A lista de cargos como a Corte a enxerga hoje: os de fábrica com as
 * personalizações por cima, mais os que ela criou, na ordem definida.
 */
export function cargosDaCorte(linhas = []) {
  const porId = Object.fromEntries(linhas.map((l) => [chave(l), l]));

  const fixos = CARGOS_CORTE.map((c) => {
    const l = porId[c.id] || {};
    return {
      id: c.id,
      nome: texto(l.titulo) || c.nome,
      descricao: l.descricao != null ? texto(l.descricao) : c.descricao,
      ordem: Number(l.ordem) || c.ordem,
      fixo: true,
    };
  });

  const criados = linhas
    .filter((l) => !cargoDeFabrica(chave(l)) && texto(l.titulo))
    .map((l) => ({
      id: chave(l),
      nome: texto(l.titulo),
      descricao: texto(l.descricao),
      ordem: Number(l.ordem) || 90,
      fixo: false,
    }));

  return [...fixos, ...criados].sort(
    (a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome),
  );
}

/** O cargo de uma linha da Corte, com o nome que ela tem hoje. */
export const cargoPorId = (id, linhas = []) =>
  cargosDaCorte(linhas).find((c) => c.id === id) || null;

/**
 * O identificador de um cargo novo, tirado do próprio nome.
 * "Mestre dos Sussurros" → `mestre_dos_sussurros`. Repetido ganha sufixo,
 * porque o id é a chave da linha e duas linhas não podem colidir.
 */
export function idNovoCargo(nome, linhas = []) {
  const base = texto(nome)
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'cargo';
  const usados = new Set([...Object.keys(BASE), ...linhas.map(chave)]);
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/** A próxima posição livre na ordem de exibição. */
export const proximaOrdem = (linhas = []) =>
  cargosDaCorte(linhas).reduce((m, c) => Math.max(m, c.ordem), 0) + 1;
