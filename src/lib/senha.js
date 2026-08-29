// ============================================================
//  SENHA DE ACESSO DO CIDADÃO
//
//  Gerada pela Corte no momento da aprovação do Registro Civil.
//  Quem entrega a senha ao morador é a pessoa da Corte — por isso
//  ela precisa ser fácil de ditar em voz alta e de digitar: sem
//  letras que se confundem (I, l, 1, O, 0) e em três blocos curtos.
// ============================================================

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ';   // sem I e sem O
const NUMEROS = '23456789';                  // sem 0 e sem 1

function sorteia(alfabeto, n) {
  const buf = new Uint32Array(n);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buf);
  else for (let i = 0; i < n; i += 1) buf[i] = Math.floor(Math.random() * 0xffffffff);
  let s = '';
  for (let i = 0; i < n; i += 1) s += alfabeto[buf[i] % alfabeto.length];
  return s;
}

/** Ex.: 'RFT-K7QM-284'. */
export function gerarSenha() {
  return `RFT-${sorteia(LETRAS, 4)}-${sorteia(NUMEROS, 3)}`;
}

/** Comparação tolerante: o morador pode digitar em minúsculas ou sem os hífens. */
export const mesmaSenha = (a, b) => {
  const limpa = (s) => String(s || '').replace(/[\s-]/g, '').toUpperCase();
  return Boolean(limpa(a)) && limpa(a) === limpa(b);
};

/** O ID do jogo também é comparado sem diferenciar maiúsculas. */
export const mesmoId = (a, b) => {
  const limpa = (s) => String(s || '').trim().toLowerCase();
  return Boolean(limpa(a)) && limpa(a) === limpa(b);
};
