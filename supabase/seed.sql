-- ============================================================
--  RIFTEN HOLD — seed dos registros da planilha
--  GERADO AUTOMATICAMENTE por scripts/gerar-seed.mjs — não edite à mão.
--  Rode DEPOIS de supabase/schema.sql.
-- ============================================================

-- Cargos da Corte --------------------------------------------
insert into public.corte (cargo_id, nome, raca, cla_id, desde, notas) values
  ('jarl', null, null, null, null, null),
  ('lorde_mao', null, null, null, null, null),
  ('lorde_comandante', null, null, null, null, null),
  ('mestre_moeda', null, null, null, null, null),
  ('mago_corte', null, null, null, null, null),
  ('alquimista_corte', null, null, null, null, null)
on conflict (cargo_id) do nothing;

-- Assentamentos ----------------------------------------------
insert into public.assentamentos (id, nome, tipo, lorde, catalogacao, descricao) values
  ('riften', 'Riften', 'Cidade', null, '[]'::jsonb, 'Capital do Hold. Sede da Corte.'),
  ('ivarstead', 'Ivarstead', 'Vilarejo', null, '[{"t":"bancada","q":1,"d":"Simple"},{"t":"tanning","q":1},{"t":"repolho","q":15},{"t":"batata","q":11},{"t":"trigo","q":6},{"t":"ninho","q":4},{"t":"pedra_amolar","q":1},{"t":"bloco_corte","q":1}]'::jsonb, null),
  ('shors_stone', 'Shor''s Stone', 'Vilarejo', null, '[{"t":"forja","q":1},{"t":"tanning","q":1},{"t":"pedra_amolar","q":1},{"t":"ninho","q":2},{"t":"fundicao","q":1},{"t":"mina_ferro","q":1},{"t":"bancada","q":1}]'::jsonb, null)
on conflict (id) do nothing;

-- Propriedades -----------------------------------------------
--  Só insere o que ainda não existe: rodar de novo não duplica nada.
insert into public.propriedades (nome, tipo, local, organizacao, proprietario, status, catalogacao)
select v.nome, v.tipo, v.local, v.organizacao, v.proprietario, v.status, v.catalogacao::jsonb
from (values
  ('Black-Briar Meadery', 'Comércio', 'Riften', null, null, 'Vaga', '[{"t":"armazenamento","q":43}]'),
  ('Elgrim''s Elixirs', 'Comércio', 'Riften', null, null, 'Vaga', '[{"t":"lab_alquimia","q":1},{"t":"caldeirao","q":1},{"t":"armazenamento","q":15}]'),
  ('Haelga''s Bunkhouse', 'Comércio', 'Riften', null, null, 'Vaga', '[{"t":"santuario","q":1,"d":"Dibella"},{"t":"caldeirao","q":1},{"t":"armazenamento","q":47}]'),
  ('Heartwood Mill', 'Serraria', null, null, null, 'Vaga', '[{"t":"bloco_corte","q":1},{"t":"pedra_amolar","q":1},{"t":"tanning","q":1},{"t":"sawhorse","q":1},{"t":"ninho","q":2},{"t":"bancada","q":1,"d":"Common"},{"t":"armazenamento","q":4}]'),
  ('Pawned Prawn', 'Comércio', 'Riften', null, null, 'Vaga', '[{"t":"caldeirao","q":1},{"t":"armazenamento","q":16}]'),
  ('The Bee and Barb', 'Taverna', 'Riften', 'Clã LockHart', 'Aerion Graysight', 'Vaga', '[{"t":"caldeirao","q":1},{"t":"armazenamento","q":32}]'),
  ('The Scorched Hammer', 'Comércio', 'Riften', null, 'Eron Halvard', 'Operante', '[{"t":"caldeirao","q":1},{"t":"tanning","q":1},{"t":"pedra_amolar","q":1},{"t":"armazenamento","q":16}]'),
  ('Vilemyr Inn', 'Taverna', 'Ivarstead', null, null, 'Vaga', '[{"t":"armazenamento","q":10}]'),
  ('Snow-Shod Farm', 'Fazenda', null, null, null, 'Interditada', '[{"t":"ninho","q":2},{"t":"trigo","q":4},{"t":"alho_poro","q":10},{"t":"batata","q":5},{"t":"armazenamento","q":12}]'),
  ('Sarethi Farm', 'Fazenda', null, null, null, 'Interditada', '[{"t":"raiz_nirn","q":7},{"t":"batata","q":12},{"t":"cabaca","q":7},{"t":"ninho","q":2},{"t":"tanning","q":1},{"t":"caldeirao","q":1},{"t":"lab_alquimia","q":1},{"t":"armazenamento","q":7}]'),
  ('Fellstar Farm', 'Fazenda', 'Ivarstead', null, null, 'Interditada', '[{"t":"armazenamento","q":6},{"t":"bancada","q":1,"d":"Simple"},{"t":"tanning","q":1},{"t":"repolho","q":15},{"t":"batata","q":11},{"t":"trigo","q":6},{"t":"ninho","q":4},{"t":"pedra_amolar","q":1},{"t":"bloco_corte","q":1}]'),
  ('Riften Fishery', 'Doca', 'Riften', null, null, 'Interditada', '[{"t":"armazenamento","q":6},{"t":"peixe_assassino","q":1},{"t":"farm_salmao","q":1}]'),
  ('Riften Warehouse', 'Comércio', 'Riften', null, null, 'Interditada', '[{"t":"armazenamento","q":27}]'),
  ('Klimmek''s House', 'Casa', 'Ivarstead', null, 'Sophia Ravenwood', 'Operante', '[]'),
  ('Filnjar''s House', 'Casa', 'Shor''s Stone', 'Casa Blackwing', 'Aldric Blackwing', 'Operante', '[]'),
  ('Odfel''s House', 'Casa', 'Shor''s Stone', null, null, 'Operante', '[]'),
  ('Sylgja''s House', 'Casa', 'Shor''s Stone', null, null, 'Operante', '[]')
) as v(nome, tipo, local, organizacao, proprietario, status, catalogacao)
where not exists (select 1 from public.propriedades p where lower(p.nome) = lower(v.nome));

-- Situação declarada pela Corte -------------------------------
--  ATENÇÃO: este bloco sobrescreve a situação das propriedades abaixo.
--  Rode-o na carga inicial; depois disso, mude a situação pela tela.
update public.propriedades set status = 'Vaga'
  where lower(nome) in ('black-briar meadery', 'elgrim''s elixirs', 'haelga''s bunkhouse', 'heartwood mill', 'pawned prawn', 'the bee and barb', 'vilemyr inn');
update public.propriedades set status = 'Operante'
  where lower(nome) in ('the scorched hammer', 'klimmek''s house', 'filnjar''s house', 'odfel''s house', 'sylgja''s house');
update public.propriedades set status = 'Interditada'
  where lower(nome) in ('snow-shod farm', 'sarethi farm', 'fellstar farm', 'riften fishery', 'riften warehouse');

-- Divisões do Exército ----------------------------------------
insert into public.divisoes (nome, funcoes, cor, icone, ordem, ativa)
select v.nome, v.funcoes, v.cor, v.icone, v.ordem, true
from (values
  ('Guarda da Cidade', 'Portões, muralhas e ruas de Riften. Ronda diurna e noturna, prisão em flagrante e escolta de presos até as celas.', '#d8b163', 'escudo', 1),
  ('Cavaleiros Negros', 'Tropa de choque do Jarl. Vai à frente em campanha e responde às ameaças que a Guarda não segura sozinha.', '#9384d1', 'espada', 2),
  ('Investigação e Inteligência', 'Apura crimes, segue rastros e informa a Corte. Trabalha à paisana quando o caso pede.', '#7ea6c4', 'busca', 3),
  ('Patrulha e Caça de Fronteiras', 'Estradas do Rift, Ivarstead e Shor’s Stone. Caça bandidos e feras, e escolta caravanas.', '#6f9f6a', 'vila', 4)
) as v(nome, funcoes, cor, icone, ordem)
where not exists (select 1 from public.divisoes k where lower(k.nome) = lower(v.nome));

-- Hierarquia (patentes e soldo semanal) ------------------------
insert into public.patentes (nome, descricao, salario, ordem, ativa)
select v.nome, v.descricao, v.salario, v.ordem, true
from (values
  ('Recruta', 'Em treinamento. Não comanda ninguém.', 150, 1),
  ('Soldado', 'Tropa de linha, escalado para ronda e campanha.', 300, 2),
  ('Sargento', 'Toma conta de um punhado de soldados na escala.', 500, 3),
  ('Capitão', 'Comanda uma divisão e responde por ela ao Lorde Comandante.', 900, 4),
  ('Comandante', 'Lorde Comandante das forças do Hold.', 1500, 5)
) as v(nome, descricao, salario, ordem)
where not exists (select 1 from public.patentes k where lower(k.nome) = lower(v.nome));

-- Exército (registros migrados da planilha) --------------------
--  A patente e a divisão viajam pelo nome; os ids são resolvidos aqui.
insert into public.guardas (nome, raca, patente, patente_id, divisao, divisao_id, status, notas, pericias)
select v.nome, v.raca, v.patente, pt.id, v.divisao, dv.id, v.status, v.notas, v.pericias::jsonb
from (values
  ('Thuraq Drum', 'Orc', 'Soldado', 'Guarda da Cidade', 'Aposentado', null, '{"Assassino":"Mestre","Batedor":"Mestre","Cavaleiro":"Mestre","Precursor":"Mestre","Espião":"Mestre","Bandido":"Mestre","Berserker":"Mestre","Brutamontes":"Mestre","Arqueiro":"Mestre","Espadachim":"Mestre","Lâmina":"Mestre","Lenhador de Guerra":"Mestre","Destruidor":"Mestre","Monge":"Mestre","Lanceiro":"Mestre","Guarda":"Mestre","Soldado":"Mestre","Cavaleiro Pesado":"Mestre","Escudeiro":"Mestre","Conjurador":"N/A","Encantador":"N/A","Místico":"N/A","Feiticeiro":"N/A","Ilusionista":"N/A","Curandeiro":"N/A"}'),
  ('Sigrid Punho-de-Ferro', 'Nórdico', 'Comandante', 'Cavaleiros Negros', 'Operante', 'Responde ao Jarl pelas três forças do Hold.', '{"Cavaleiro":"Mestre","Espadachim":"Mestre","Soldado":"Mestre","Cavaleiro Pesado":"Mestre","Escudeiro":"Especialista","Guarda":"Especialista"}'),
  ('Varek Sombra-Rubra', 'Elfo Negro', 'Capitão', 'Investigação e Inteligência', 'Operante', 'Capitão da Investigação. Trabalha à paisana quando o caso pede.', '{"Espião":"Mestre","Batedor":"Mestre","Assassino":"Especialista","Arqueiro":"Especialista","Ilusionista":"Adepto"}'),
  ('Bjorn Cava-Neve', 'Nórdico', 'Sargento', 'Guarda da Cidade', 'Operante', null, '{"Guarda":"Especialista","Soldado":"Especialista","Espadachim":"Adepto","Escudeiro":"Adepto"}'),
  ('Ysolda Pé-Leve', 'Bretão', 'Soldado', 'Patrulha e Caça de Fronteiras', 'Operante', null, '{"Arqueiro":"Especialista","Batedor":"Especialista","Curandeiro":"Adepto"}'),
  ('Marcus Vell', 'Imperial', 'Recruta', 'Patrulha e Caça de Fronteiras', 'Ausente', 'Em treinamento na guarnição de Ivarstead.', '{"Soldado":"Adepto","Lanceiro":"Adepto"}')
) as v(nome, raca, patente, divisao, status, notas, pericias)
left join public.patentes pt on lower(pt.nome) = lower(v.patente)
left join public.divisoes dv on lower(dv.nome) = lower(v.divisao)
where not exists (select 1 from public.guardas g where lower(g.nome) = lower(v.nome));

