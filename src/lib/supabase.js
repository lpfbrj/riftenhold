import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Há credenciais configuradas? Se não, o app roda em MODO DEMONSTRAÇÃO. */
export const SUPABASE_ATIVO = Boolean(url && key && url.startsWith('http'));

export const supabase = SUPABASE_ATIVO ? createClient(url, key) : null;

export const MODO = SUPABASE_ATIVO ? 'supabase' : 'demo';
