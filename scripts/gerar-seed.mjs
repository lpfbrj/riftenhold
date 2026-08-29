// Gera supabase/seed.sql a partir de src/data/rift.js (fonte única da verdade).
// Uso: npm run seed:sql
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CLAS_SEED, CORTE_SEED, PROPRIEDADES_SEED, GUARDAS_SEED, ASSENTAMENTOS,
} from '../src/data/rift.js';
import { DIVISOES_SEED, PATENTES_SEED } from '../src/lib/constants.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `'${JSON.stringify(v || []).replace(/'/g, "''")}'::jsonb`;
const n = (v) => (v === null || v === undefined || v === '' ? 'null' : Number(v));

const L = [];
L.push('-- ============================================================');
L.push('--  RIFTEN HOLD — seed dos registros da planilha');
L.push('--  GERADO AUTOMATICAMENTE por scripts/gerar-seed.mjs — não edite à mão.');
L.push('--  Rode DEPOIS de supabase/schema.sql.');
L.push('-- ============================================================');
L.push('');

L.push('-- Cargos da Corte --------------------------------------------');
L.push('insert into public.corte (cargo_id, nome, raca, cla_id, desde, notas) values');
L.push(CORTE_SEED.map((c) =>
  `  (${q(c.cargo_id)}, ${q(c.nome)}, ${q(c.raca)}, null, ${q(c.desde)}, ${q(c.notas)})`,
).join(',\n') + '\non conflict (cargo_id) do nothing;');
L.push('');

L.push('-- Assentamentos ----------------------------------------------');
L.push('insert into public.assentamentos (id, nome, tipo, lorde, catalogacao, descricao) values');
L.push(ASSENTAMENTOS.map((a) =>
  `  (${q(a.id)}, ${q(a.nome)}, ${q(a.tipo)}, ${q(a.lorde)}, ${j(a.catalogacao)}, ${q(a.descricao)})`,
).join(',\n') + '\non conflict (id) do nothing;');
L.push('');

L.push('-- Propriedades -----------------------------------------------');
L.push('--  Só insere o que ainda não existe: rodar de novo não duplica nada.');
L.push('insert into public.propriedades (nome, tipo, local, organizacao, proprietario, status, catalogacao)');
L.push('select v.nome, v.tipo, v.local, v.organizacao, v.proprietario, v.status, v.catalogacao::jsonb');
L.push('from (values');
L.push(PROPRIEDADES_SEED.map((p) =>
  `  (${q(p.nome)}, ${q(p.tipo)}, ${q(p.local)}, ${q(p.organizacao)}, ${q(p.proprietario)}, ${q(p.status)}, ${q(JSON.stringify(p.catalogacao || []))})`,
).join(',\n'));
L.push(') as v(nome, tipo, local, organizacao, proprietario, status, catalogacao)');
L.push('where not exists (select 1 from public.propriedades p where lower(p.nome) = lower(v.nome));');
L.push('');

// Situação das propriedades — reafirma o que a Corte determinou.
L.push('-- Situação declarada pela Corte -------------------------------');
L.push('--  ATENÇÃO: este bloco sobrescreve a situação das propriedades abaixo.');
L.push('--  Rode-o na carga inicial; depois disso, mude a situação pela tela.');
const porStatus = {};
for (const p of PROPRIEDADES_SEED) (porStatus[p.status] ||= []).push(p.nome);
for (const [status, nomes] of Object.entries(porStatus)) {
  L.push(`update public.propriedades set status = ${q(status)}`);
  L.push(`  where lower(nome) in (${nomes.map((n) => q(n.toLowerCase())).join(', ')});`);
}
L.push('');

L.push('-- Divisões do Exército ----------------------------------------');
L.push('insert into public.divisoes (nome, funcoes, cor, icone, ordem, ativa)');
L.push('select v.nome, v.funcoes, v.cor, v.icone, v.ordem, true');
L.push('from (values');
L.push(DIVISOES_SEED.map((x) =>
  `  (${q(x.nome)}, ${q(x.funcoes)}, ${q(x.cor)}, ${q(x.icone)}, ${n(x.ordem)})`,
).join(',\n'));
L.push(') as v(nome, funcoes, cor, icone, ordem)');
L.push('where not exists (select 1 from public.divisoes k where lower(k.nome) = lower(v.nome));');
L.push('');

L.push('-- Hierarquia (patentes e soldo semanal) ------------------------');
L.push('insert into public.patentes (nome, descricao, salario, ordem, ativa)');
L.push('select v.nome, v.descricao, v.salario, v.ordem, true');
L.push('from (values');
L.push(PATENTES_SEED.map((x) =>
  `  (${q(x.nome)}, ${q(x.descricao)}, ${n(x.salario)}, ${n(x.ordem)})`,
).join(',\n'));
L.push(') as v(nome, descricao, salario, ordem)');
L.push('where not exists (select 1 from public.patentes k where lower(k.nome) = lower(v.nome));');
L.push('');

L.push('-- Exército (registros migrados da planilha) --------------------');
L.push('--  A patente e a divisão viajam pelo nome; os ids são resolvidos aqui.');
L.push('insert into public.guardas (nome, raca, patente, patente_id, divisao, divisao_id, status, notas, pericias)');
L.push('select v.nome, v.raca, v.patente, pt.id, v.divisao, dv.id, v.status, v.notas, v.pericias::jsonb');
L.push('from (values');
L.push(GUARDAS_SEED.map((g) =>
  `  (${q(g.nome)}, ${q(g.raca)}, ${q(g.patente)}, ${q(g.divisao)}, ${q(g.status)}, ${q(g.notas)}, ${q(JSON.stringify(g.pericias))})`,
).join(',\n'));
L.push(') as v(nome, raca, patente, divisao, status, notas, pericias)');
L.push('left join public.patentes pt on lower(pt.nome) = lower(v.patente)');
L.push('left join public.divisoes dv on lower(dv.nome) = lower(v.divisao)');
L.push('where not exists (select 1 from public.guardas g where lower(g.nome) = lower(v.nome));');
L.push('');

writeFileSync(join(raiz, 'supabase', 'seed.sql'), L.join('\n') + '\n', 'utf8');
console.log('supabase/seed.sql gerado:', PROPRIEDADES_SEED.length, 'propriedades,', ASSENTAMENTOS.length, 'assentamentos.');
