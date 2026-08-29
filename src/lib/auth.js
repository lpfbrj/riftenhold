// ============================================================
//  Autenticação — o portão de Mistveil Keep.
//  Só membros da Corte com perfil ativo entram.
// ============================================================
import { supabase, SUPABASE_ATIVO } from './supabase.js';
import { autenticarCidadao } from './db.js';

const CHAVE_DEMO = 'riften-hold:sessao';
const CHAVE_CIDADAO = 'riften-hold:cidadao';

/** Contas do MODO DEMONSTRAÇÃO (nenhuma senha real é verificada em produção aqui). */
export const CONTAS_DEMO = [
  // Atalho de teste: entra na Corte com `Jarl` / `123`.
  { email: 'Jarl',                   senha: '123',      nome: 'Jarl de Riften',   cargo: 'Jarl',                 papel: 'jarl'  },
  { email: 'jarl@riften.rift',       senha: 'mistveil', nome: 'Jarl de Riften',   cargo: 'Jarl',                 papel: 'jarl'  },
  { email: 'mao@riften.rift',        senha: 'mistveil', nome: 'Lorde Mão',        cargo: 'Lorde Mão',            papel: 'corte' },
  { email: 'comandante@riften.rift', senha: 'mistveil', nome: 'Lorde Comandante', cargo: 'Lorde Comandante',     papel: 'corte' },
  { email: 'moeda@riften.rift',      senha: 'mistveil', nome: 'Mestre da Moeda',  cargo: 'Mestre da Moeda',      papel: 'corte' },
  { email: 'mago@riften.rift',       senha: 'mistveil', nome: 'Mago da Corte',    cargo: 'Mago da Corte',        papel: 'corte' },
  { email: 'alquimista@riften.rift', senha: 'mistveil', nome: 'Alquimista',       cargo: 'Alquimista da Corte',  papel: 'corte' },
];

function lerSessaoCidadao() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_CIDADAO);
    return bruto ? JSON.parse(bruto) : null;
  } catch { return null; }
}

export async function sessaoAtual() {
  // A sessão do morador/soldado vale nos dois modos e é conferida primeiro.
  const cidadao = lerSessaoCidadao();
  if (cidadao) return cidadao;

  if (!SUPABASE_ATIVO) {
    try {
      const bruto = sessionStorage.getItem(CHAVE_DEMO) || localStorage.getItem(CHAVE_DEMO);
      return bruto ? { ...JSON.parse(bruto), tipo: 'corte' } : null;
    } catch { return null; }
  }
  const { data } = await supabase.auth.getSession();
  if (!data?.session) return null;
  return carregarPerfil(data.session.user);
}

async function carregarPerfil(user) {
  const { data: perfil, error } = await supabase
    .from('perfis').select('*').eq('id', user.id).single();
  if (error || !perfil) {
    await supabase.auth.signOut();
    throw new Error('Sua conta não possui assento nesta Corte. Fale com o Jarl.');
  }
  if (!perfil.ativo) {
    await supabase.auth.signOut();
    throw new Error('Seu assento na Corte foi suspenso.');
  }
  return { tipo: 'corte', email: user.email, nome: perfil.nome, cargo: perfil.cargo, papel: perfil.papel };
}

export async function entrar(email, senha) {
  if (!SUPABASE_ATIVO) {
    const conta = CONTAS_DEMO.find(
      (c) => c.email.toLowerCase() === String(email).trim().toLowerCase() && c.senha === senha,
    );
    if (!conta) throw new Error('Credenciais recusadas no portão de Mistveil Keep.');
    const sessao = { tipo: 'corte', email: conta.email, nome: conta.nome, cargo: conta.cargo, papel: conta.papel };
    try { sessionStorage.setItem(CHAVE_DEMO, JSON.stringify(sessao)); } catch { /* ignora */ }
    return sessao;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error('Credenciais recusadas no portão de Mistveil Keep.');
  return carregarPerfil(data.user);
}

/**
 * Entrada do morador e do soldado: ID do jogo + a senha que a Corte gerou
 * ao aprovar o Registro Civil.
 *
 * @param {'cidadao'|'soldado'} porta  qual das duas portas ele está usando
 * @param {Array} guardas  o Exército, para conferir se ele está alistado
 *                         (só faz sentido na porta do Quartel)
 */
export async function entrarCidadao(idJogo, senha, porta = 'cidadao', guardas = []) {
  const civil = await autenticarCidadao(idJogo, senha);

  let militar = null;
  if (porta === 'soldado') {
    militar = guardas.find(
      (g) => g.civil_id === civil.id ||
             (g.id_jogo && String(g.id_jogo).toLowerCase() === String(civil.id_jogo).toLowerCase()) ||
             (!g.civil_id && !g.id_jogo && String(g.nome || '').trim().toLowerCase() === String(civil.nome || '').trim().toLowerCase()),
    ) || null;
    if (!militar) {
      throw new Error(
        'Você não consta no Exército de Riften. O Quartel General só abre para quem está alistado — procure o Lorde Comandante.',
      );
    }
  }

  const sessao = {
    tipo: porta,
    civil_id: civil.id,
    id_jogo: civil.id_jogo,
    // Guardada só nesta aba do navegador: com Supabase, é ela que autoriza o
    // morador a salvar a própria ficha (as funções `salvar_*` conferem o par).
    senha: String(senha),
    nome: civil.nome,
    cargo: porta === 'soldado' ? (militar?.patente || 'Soldado') : 'Cidadão de Riften',
    guarda_id: militar?.id || null,
  };
  try { sessionStorage.setItem(CHAVE_CIDADAO, JSON.stringify(sessao)); } catch { /* ignora */ }
  return sessao;
}

export async function sair() {
  try { sessionStorage.removeItem(CHAVE_CIDADAO); } catch { /* ignora */ }
  if (!SUPABASE_ATIVO) {
    try { sessionStorage.removeItem(CHAVE_DEMO); localStorage.removeItem(CHAVE_DEMO); } catch { /* ignora */ }
    return;
  }
  await supabase.auth.signOut();
}
