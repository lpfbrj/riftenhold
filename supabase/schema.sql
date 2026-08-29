-- ============================================================
--  RIFTEN HOLD — Schema Supabase (Postgres)
--  Execute inteiro no SQL Editor do Supabase.
--  Acesso restrito à Corte: só quem tem perfil ativo enxerga algo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERFIS (quem pode entrar)
-- ------------------------------------------------------------
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  cargo       text,                                  -- ex.: 'Lorde Comandante'
  papel       text not null default 'corte'
              check (papel in ('jarl', 'corte')),    -- 'jarl' pode gerir acessos
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Helper: o usuário atual é membro ativo da Corte?
create or replace function public.eh_corte()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo = true
  );
$$;

create or replace function public.eh_jarl()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo = true and papel = 'jarl'
  );
$$;

-- ------------------------------------------------------------
-- 2. CLÃS / DINASTIAS NOBRES
-- ------------------------------------------------------------
create table if not exists public.clas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  lider        text,                                  -- nome do chefe da casa
  titulo_lider text default 'Patriarca'
               check (titulo_lider in ('Patriarca','Matriarca')),
  lider_civil_id uuid,                                 -- vínculo com o Registro Civil
  lider_id_jogo  text,
  lider_raca     text,
  -- Título do chefe na Nobreza de Riften; a liderança é outra coisa.
  lider_titulo text default 'Nobre'
               check (lider_titulo in ('Nobre','Lorde','Lady','Thane')),
  cor          text default '#7c6bb0',                -- cor do estandarte
  brasao       text,                                  -- data URL da imagem do brasão
  -- [{ nome, civil_id, id_jogo, raca, titulo, notas }]
  -- `titulo` é o da Nobreza: Nobre | Lorde | Lady | Thane
  membros      jsonb not null default '[]'::jsonb,
  -- [{ nome, civil_id, id_jogo, raca, funcao, notas }]
  -- Servos não são nobres: ficam fora da Nobreza e seguem Plebeus.
  servos       jsonb not null default '[]'::jsonb,
  notas        text default '',
  atualizado_em timestamptz not null default now()
);
-- Bancos criados antes destas colunas:
alter table public.clas add column if not exists lider_civil_id uuid;
alter table public.clas add column if not exists lider_id_jogo text;
alter table public.clas add column if not exists lider_raca text;
alter table public.clas add column if not exists lider_titulo text default 'Nobre';
alter table public.clas add column if not exists servos jsonb not null default '[]'::jsonb;
-- Títulos antigos (Regente, Housecarl, Barão…) deixaram de existir.
update public.clas set titulo_lider = 'Patriarca'
 where titulo_lider is null or titulo_lider not in ('Patriarca','Matriarca');
update public.clas set lider_titulo = 'Nobre'
 where lider_titulo is null or lider_titulo not in ('Nobre','Lorde','Lady','Thane');

-- A casa fundada por um nobre nasce Pendente e só existe de fato
-- depois que a Corte reconhece. As casas que já estavam gravadas
-- antes desta regra continuam valendo, por isso o default é 'Aprovada'.
alter table public.clas add column if not exists situacao text not null default 'Aprovada';
alter table public.clas add column if not exists lema text default '';
alter table public.clas add column if not exists sede_propriedade_id uuid;
alter table public.clas add column if not exists sede_nome text default '';
alter table public.clas add column if not exists sede_tipo text default '';
-- { nome, civil_id, id_jogo, raca, parentesco, registrado_em } — 3.500 Septims
alter table public.clas add column if not exists herdeiro jsonb;
-- Preenchido quando a Corte concede a Mesnada (10.000 Septims).
alter table public.clas add column if not exists mesnada_em timestamptz;
-- [{ nome, civil_id, id_jogo, raca, posto, notas }] — só com mesnada concedida
alter table public.clas add column if not exists soldados jsonb not null default '[]'::jsonb;
alter table public.clas add column if not exists fundada_em timestamptz;
alter table public.clas add column if not exists reconhecida_por text;
do $$ begin
  alter table public.clas add constraint clas_situacao_ck
    check (situacao in ('Pendente','Aprovada','Recusada'));
exception when duplicate_object then null; end $$;
-- O lema cabe num estandarte: 40 caracteres.
do $$ begin
  alter table public.clas add constraint clas_lema_ck
    check (char_length(coalesce(lema, '')) <= 40);
exception when duplicate_object then null; end $$;
create index if not exists clas_situacao_idx on public.clas(situacao);

-- ------------------------------------------------------------
-- 2c. CHANCELARIA DA NOBREZA
--
--     Toda passagem da nobreza tem taxa e passa pela Corte:
--       nobreza  50.000 · fundação 0 · insígnia 5.000
--       herdeiro  3.500 · mesnada 10.000 · aliança 10.000
--       sede      8.000
--
--     A aliança nasce 'Aguardando casa': a casa convidada aceita
--     antes de a Corte lavrar o pacto.
-- ------------------------------------------------------------
create table if not exists public.pedidos_casa (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null
               check (tipo in ('nobreza','fundacao','insignia','herdeiro','mesnada','alianca','sede')),
  custo        int not null default 0 check (custo >= 0),
  status       text not null default 'Pendente'
               check (status in ('Aguardando casa','Pendente','Deferido','Indeferido','Recusado pela casa')),
  -- quem pediu
  pedido_por   text,
  civil_id     uuid references public.civis(id) on delete set null,
  id_jogo      text,
  -- a casa do pedido, e a outra ponta quando é aliança
  cla_id       uuid references public.clas(id) on delete cascade,
  cla_nome     text default '',
  alvo_cla_id  uuid references public.clas(id) on delete cascade,
  alvo_cla_nome text default '',
  motivo       text default '',                     -- o que o pedinte escreveu
  parecer      text default '',                     -- o que a Corte respondeu
  dados        jsonb not null default '{}'::jsonb,  -- o miolo, por tipo
  respondido_por text,                              -- a casa convidada, na aliança
  respondido_em  timestamptz,
  avaliado_por text,
  avaliado_em  timestamptz,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_casa_status_idx on public.pedidos_casa(status);
create index if not exists pedidos_casa_tipo_idx   on public.pedidos_casa(tipo);
create index if not exists pedidos_casa_cla_idx    on public.pedidos_casa(cla_id);
create index if not exists pedidos_casa_civil_idx  on public.pedidos_casa(civil_id);

-- ------------------------------------------------------------
-- 2b. PEDIDOS DAS CASAS
--     O Patriarca indica quem quer trazer para a dinastia; entrar
--     numa casa é virar nobre, e nobreza é ato da Corte. Por isso
--     a indicação vira pedido, e não entra sozinha.
--     Servos não passam por aqui: eles não são nobres.
-- ------------------------------------------------------------
create table if not exists public.pedidos_dinastia (
  id           uuid primary key default gen_random_uuid(),
  cla_id       uuid not null references public.clas(id) on delete cascade,
  cla_nome     text,
  nome         text not null,                      -- o indicado
  civil_id     uuid,
  id_jogo      text,
  raca         text,
  parentesco   text default '',
  justificativa text default '',
  status       text not null default 'Pendente'
               check (status in ('Pendente','Aprovado','Recusado')),
  pedido_por   text,                                -- o Patriarca que indicou
  pedido_por_civil_id uuid,
  observacao_corte text default '',
  avaliado_por text,
  avaliado_em  timestamptz,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_dinastia_status_idx on public.pedidos_dinastia(status);
create index if not exists pedidos_dinastia_cla_idx    on public.pedidos_dinastia(cla_id);

-- ------------------------------------------------------------
-- 3. CORTE DO JARL
-- ------------------------------------------------------------
create table if not exists public.corte (
  cargo_id  text primary key,                        -- 'jarl', 'lorde_mao', ...
  nome      text,
  civil_id  uuid,                                    -- vínculo com o Registro Civil
  id_jogo   text,
  raca      text,
  cla_id    uuid references public.clas(id) on delete set null,
  desde     text,
  notas     text default '',
  -- Personalização do cargo. Seis vêm de fábrica no aplicativo; a Corte
  -- pode renomeá-los (`titulo`), reescrever o que respondem (`descricao`)
  -- e mudar a posição no quadro (`ordem`) — e criar outros, que são
  -- simplesmente linhas cujo cargo_id não está entre os seis.
  titulo    text,
  descricao text,
  ordem     integer,
  atualizado_em timestamptz not null default now()
);
alter table public.corte add column if not exists titulo text;
alter table public.corte add column if not exists descricao text;
alter table public.corte add column if not exists ordem integer;

-- ------------------------------------------------------------
-- 3b. REGISTRO CIVIL (moradores do Hold)
--     Cadastro feito pelo portal público; entra como 'Pendente'
--     e só vira cidadão oficial depois do aval da Corte.
-- ------------------------------------------------------------
create table if not exists public.civis (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  id_jogo          text not null,                    -- no jogo: K → CONTA → CONFIG
  raca             text,
  profissao        text,
  nivel            text default 'Novato',
  notas            text default '',                  -- o que o morador escreveu
  pericias         jsonb not null default '{}'::jsonb, -- habilidades que ele declara
  -- Cidadania: nasceu no Hold, ou está transferindo de outra cidade.
  origem           text not null default 'natal'
                   check (origem in ('natal','transferencia')),
  cidade_anterior_id text,                            -- id do hold, ou 'outro'
  cidade_anterior  text,                              -- o nome como sai na ficha
  -- A isenção desfaz o vínculo com a cidade anterior. Quem decide é a Corte.
  isencao_status   text not null default 'Não pedida'
                   check (isencao_status in ('Não pedida','Pendente','Concedida','Negada')),
  isencao_motivo   text default '',                   -- justificativa do morador
  isencao_parecer  text default '',                   -- resposta da Corte
  isencao_por      text,
  isencao_pedida_em timestamptz,
  isencao_em       timestamptz,
  observacao_corte text default '',                  -- o que a Corte anotou
  status           text not null default 'Pendente'
                   check (status in ('Pendente','Aprovado','Recusado')),
  avaliado_por     text,
  avaliado_em      timestamptz,
  senha_acesso     text,                              -- gerada na aprovação; entregue em mãos
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
-- Bancos criados antes destas colunas:
alter table public.civis add column if not exists senha_acesso text;
-- Habilidades declaradas pelo próprio morador (opcional). É o que o
-- habilita nos editais que exigem perícia. O que o Quartel afere fica
-- em `guardas.pericias`, e prevalece sobre o declarado.
alter table public.civis add column if not exists pericias jsonb not null default '{}'::jsonb;
-- Cidadania e isenção (fichas criadas antes destas colunas seguem como 'natal').
alter table public.civis add column if not exists origem text not null default 'natal';
alter table public.civis add column if not exists cidade_anterior_id text;
alter table public.civis add column if not exists cidade_anterior text;
alter table public.civis add column if not exists isencao_status text not null default 'Não pedida';
alter table public.civis add column if not exists isencao_motivo text default '';
alter table public.civis add column if not exists isencao_parecer text default '';
alter table public.civis add column if not exists isencao_por text;
alter table public.civis add column if not exists isencao_pedida_em timestamptz;
alter table public.civis add column if not exists isencao_em timestamptz;
create index if not exists civis_isencao_idx on public.civis(isencao_status);
-- Um ID de jogo só pode ser registrado uma vez.
create unique index if not exists civis_id_jogo_unico on public.civis (lower(id_jogo));
create index if not exists civis_status_idx on public.civis(status);

-- ------------------------------------------------------------
-- 4. EXÉRCITO DE RIFTEN
-- ------------------------------------------------------------
--
--     As forças do Hold são três e somam: o Exército (esta tabela,
--     repartida em `divisoes`), as Mesnadas das casas nobres
--     (`clas.soldados`) e a Milícia (`milicia`), convocada por uma
--     `campanha`. Divisões e patentes são registros editáveis pela
--     Corte — não há mais lista fixa no código.

-- Divisões do Exército. A Corte cria, renomeia, aponta o capitão e
-- escreve o que cada uma faz.
create table if not exists public.divisoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  funcoes    text default '',
  capitao_id uuid,                                   -- ficha em `guardas`
  capitao    text default '',                        -- nome, para quando a ficha some
  cor        text default '#d8b163',
  icone      text default 'escudo',
  ordem      integer not null default 1,
  ativa      boolean not null default true,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists divisoes_nome_unico on public.divisoes (lower(nome));

-- Hierarquia. `ordem` é o degrau (quanto maior, mais alto) e
-- `salario` é o soldo semanal em Septims.
create table if not exists public.patentes (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  descricao text default '',
  salario   integer not null default 300 check (salario >= 0),
  ordem     integer not null default 1,
  ativa     boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists patentes_nome_unico on public.patentes (lower(nome));

create table if not exists public.guardas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  civil_id   uuid references public.civis(id) on delete set null,
  id_jogo    text,
  raca       text,
  patente    text,                                   -- nome, espelho de patente_id
  patente_id uuid references public.patentes(id) on delete set null,
  divisao    text,                                   -- nome, espelho de divisao_id
  divisao_id uuid references public.divisoes(id) on delete set null,
  status     text default 'Operante'
             check (status in ('Operante','Ausente','Aposentado')),
  notas      text default '',
  salario    integer check (salario is null or salario >= 0),  -- nulo = o da patente
  pago_em    timestamptz,                            -- último soldo pago
  pago_valor integer,
  pago_por   text default '',
  pericias   jsonb not null default '{}'::jsonb,     -- { "Assassino": "Mestre", ... }
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists guardas_status_idx  on public.guardas(status);
create index if not exists guardas_divisao_idx on public.guardas(divisao_id);

-- Bancos criados antes das forças editáveis: patente e afiliação eram
-- listas fixas no CHECK, e a afiliação virou mesnada da casa nobre.
alter table public.guardas drop constraint if exists guardas_patente_check;
alter table public.guardas drop constraint if exists guardas_afiliacao_check;
alter table public.guardas add column if not exists patente_id uuid references public.patentes(id) on delete set null;
alter table public.guardas add column if not exists divisao_id uuid references public.divisoes(id) on delete set null;
alter table public.guardas add column if not exists salario integer;
alter table public.guardas add column if not exists pago_em timestamptz;
alter table public.guardas add column if not exists pago_valor integer;
alter table public.guardas add column if not exists pago_por text default '';

-- Campanha militar: o motivo pelo qual a milícia é chamada. Só uma
-- fica aberta por vez (a regra vive na camada de dados).
create table if not exists public.campanhas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  motivo      text default '',
  soldo       integer not null default 200 check (soldo >= 0),
  status      text not null default 'Preparação'
              check (status in ('Preparação','Em campanha','Encerrada')),
  aberta_em   timestamptz not null default now(),
  encerrada_em timestamptz,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Milícia: moradores voluntários. Fora de campanha são só uma lista.
-- Só uma convocação de pé por vez — e quem garante é o banco, não a
-- boa vontade de quem clicou primeiro.
create unique index if not exists campanhas_uma_aberta
  on public.campanhas ((status <> 'Encerrada')) where status <> 'Encerrada';

create table if not exists public.milicia (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  civil_id     uuid references public.civis(id) on delete set null,
  id_jogo      text,
  raca         text,
  situacao     text not null default 'Disponível'
               check (situacao in ('Disponível','Convocado','Dispensado')),
  campanha_id  uuid references public.campanhas(id) on delete set null,
  campanha_nome text default '',
  convocado_em timestamptz,
  pago_em      timestamptz,
  pago_valor   integer,
  pago_por     text default '',
  notas        text default '',
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists milicia_situacao_idx on public.milicia(situacao);
-- Ninguém se alista duas vezes.
create unique index if not exists milicia_civil_unico on public.milicia (civil_id) where civil_id is not null;

-- O nome próprio da mesnada da casa (a Ordem do Dragão Negro é a
-- mesnada da Casa Blackwing).
alter table public.clas add column if not exists mesnada_nome text default '';

-- ------------------------------------------------------------
-- 4b. TESOURARIA DO HOLD
--
--     O cofre é um livro-caixa: ninguém escreve um saldo, escreve-se
--     um lançamento, e o saldo é a soma. Como a plataforma não fala
--     com o jogo, a Corte declara o saldo verdadeiro de tempos em
--     tempos — e a declaração é um lançamento como outro qualquer,
--     com a razão escrita. Não há caminho para mexer no cofre sem
--     deixar rastro.
--
--     Toda receita passa por uma COBRANÇA: multa, fiança, licença,
--     imóvel, escritura, taxa da nobreza ou título lavrado à mão. O
--     morador paga no jogo e declara; quem confirma é a Corte, e é a
--     confirmação que vira dinheiro no cofre.
-- ------------------------------------------------------------

-- A tabela de preços do Hold, editável pela Tesouraria.
create table if not exists public.precos (
  id          uuid primary key default gen_random_uuid(),
  chave       text not null,                    -- 'licenca:mineracao', 'imovel:transmissao'
  nome        text not null default '',
  grupo       text default '',
  valor       integer not null default 0 check (valor >= 0),
  definido_por text default '',
  definido_em timestamptz,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists precos_chave_unica on public.precos (chave);

create table if not exists public.cobrancas (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null,                 -- COB-0001
  origem         text not null default 'titulo',
  titulo         text not null,
  descricao      text default '',
  valor          integer not null check (valor > 0),
  devedor_tipo   text not null default 'civil'
                 check (devedor_tipo in ('civil','propriedade','casa')),
  devedor_id     uuid,
  devedor_nome   text default '',
  referencia_tipo text default '',              -- prisao | licenca | pedido_casa | oferta | aquisicao | titulo
  referencia_id  uuid,
  status         text not null default 'Em aberto'
                 check (status in ('Em aberto','Pagamento declarado','Paga','Cancelada')),
  vence_em       timestamptz,
  declarado_em   timestamptz,
  declarado_nota text default '',
  confirmado_por text default '',
  confirmado_em  timestamptz,
  parecer        text default '',
  emitida_por    text default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create unique index if not exists cobrancas_numero_unico on public.cobrancas (numero);
create index if not exists cobrancas_status_idx on public.cobrancas(status);
create index if not exists cobrancas_devedor_idx on public.cobrancas(devedor_tipo, devedor_id);
-- O mesmo fato não gera duas cobranças: a multa da prisão X é uma só.
create unique index if not exists cobrancas_fato_unico
  on public.cobrancas (origem, referencia_tipo, referencia_id)
  where referencia_id is not null and status <> 'Cancelada';

create table if not exists public.cofre (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('entrada','saida','ajuste')),
  valor           integer not null default 0 check (valor >= 0),
  origem          text not null default 'outro',
  descricao       text not null,
  autor           text not null default 'Corte',
  cobranca_id     uuid references public.cobrancas(id) on delete set null,
  referencia_tipo text default '',
  referencia_id   uuid,
  -- Só o ajuste carrega saldo declarado: é a âncora do livro.
  saldo_declarado integer check (saldo_declarado is null or saldo_declarado >= 0),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists cofre_tipo_idx on public.cofre(tipo);
create index if not exists cofre_quando_idx on public.cofre(criado_em desc);

-- A venda entre jogadores passa pela escritura da Corte.
alter table public.ofertas add column if not exists cobranca_id uuid;
alter table public.ofertas add column if not exists lavrada_em timestamptz;
alter table public.ofertas add column if not exists lavrada_por text default '';

-- O que o Palácio recebeu ao conceder o imóvel.
alter table public.propriedades add column if not exists adquirida_em timestamptz;
alter table public.propriedades add column if not exists adquirida_valor integer;
alter table public.propriedades add column if not exists adquirida_por text default '';

-- A taxa de emissão cobrada pela licença.
alter table public.licencas add column if not exists valor integer;

-- ------------------------------------------------------------
-- 5. TRABALHADORES DA CIDADE
-- ------------------------------------------------------------
create table if not exists public.trabalhadores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  civil_id   uuid references public.civis(id) on delete set null,
  id_jogo    text,
  raca       text,
  profissao  text,
  nivel      text default 'Novato',
  local      text default 'Riften',
  vinculo    text default '',                        -- propriedade / clã a que serve
  notas      text default '',
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. PROPRIEDADES / COMÉRCIOS
-- ------------------------------------------------------------
create table if not exists public.propriedades (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  tipo         text default 'Comércio',
  local        text default 'Riften',                -- Riften / Ivarstead / Shor's Stone
  organizacao  text default '',                      -- clã dono
  proprietario text default '',
  proprietario_civil_id uuid references public.civis(id) on delete set null,
  status       text default 'Operante',
  catalogacao  jsonb not null default '[]'::jsonb,   -- [{ t, q, d }] — ver src/data/itens.js
  -- Do dono, não da Corte: quem trabalha ali e o que está à venda.
  -- [{ nome, civil_id, id_jogo, profissao, nivel, funcao }]
  funcionarios jsonb not null default '[]'::jsonb,
  -- [{ nome, quantidade, valor }] — serve de estoque e de lista de preços
  estoque      jsonb not null default '[]'::jsonb,
  notas        text default '',
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.propriedades add column if not exists funcionarios jsonb not null default '[]'::jsonb;
alter table public.propriedades add column if not exists estoque jsonb not null default '[]'::jsonb;
-- Imobiliária: todo imóvel cai em uma categoria, tem uma avaliação
-- da Corte e pode ou não estar anunciado pelo dono.
alter table public.propriedades add column if not exists categoria text not null default 'comercio';
alter table public.propriedades add column if not exists valor int;          -- avaliação da Corte
alter table public.propriedades add column if not exists a_venda boolean not null default false;
alter table public.propriedades add column if not exists preco int;          -- o que o dono pede
alter table public.propriedades add column if not exists anuncio_nota text default '';
alter table public.propriedades add column if not exists anunciada_em timestamptz;
alter table public.propriedades add column if not exists vendida_em timestamptz;
do $$ begin
  alter table public.propriedades add constraint propriedades_categoria_ck
    check (categoria in ('casa','comercio','fortaleza'));
exception when duplicate_object then null; end $$;

create index if not exists propriedades_local_idx on public.propriedades(local);
create index if not exists propriedades_dono_idx  on public.propriedades(proprietario_civil_id);
create index if not exists propriedades_categoria_idx on public.propriedades(categoria);
create index if not exists propriedades_venda_idx on public.propriedades(a_venda) where a_venda;

-- ------------------------------------------------------------
-- 6c. MERCADO IMOBILIÁRIO
--
--     O dono anuncia; quem quiser propõe. O aceite do dono fecha a
--     venda na hora — a Corte cadastra os imóveis, mas não precisa
--     deferir cada negócio. As demais propostas caem junto.
-- ------------------------------------------------------------
create table if not exists public.ofertas (
  id            uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  propriedade_nome text,
  categoria     text default '',
  tipo          text default '',
  local         text default '',
  preco_pedido  int,                                -- o preço do anúncio na hora da proposta
  dono          text default '',
  dono_civil_id uuid,
  comprador     text not null,
  comprador_civil_id uuid references public.civis(id) on delete set null,
  comprador_id_jogo  text,
  valor         int not null check (valor > 0),
  mensagem      text default '',
  status        text not null default 'Aberta'
                check (status in ('Aberta','Aceita','Recusada','Retirada')),
  resposta      text default '',
  respondido_por text,
  respondido_em timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ofertas_prop_idx      on public.ofertas(propriedade_id);
create index if not exists ofertas_status_idx    on public.ofertas(status);
create index if not exists ofertas_comprador_idx on public.ofertas(comprador_civil_id);

-- ------------------------------------------------------------
-- 7. ASSENTAMENTOS (vilarejos e seus Lordes nomeados)
-- ------------------------------------------------------------
-- A casa que detém o vilarejo não é gravada: ela é a casa do Lorde
-- empossado, lida das dinastias na hora de mostrar.
create table if not exists public.assentamentos (
  id          text primary key,                      -- 'riften', 'ivarstead', ...
  nome        text not null,
  tipo        text default 'Vilarejo',
  lorde       text,                                  -- Lorde nomeado pela Corte
  lorde_civil_id uuid,                               -- vínculo com o Registro Civil
  lorde_id_jogo  text,
  lorde_raca     text,
  catalogacao jsonb not null default '[]'::jsonb,    -- [{ t, q, d }] — ver src/data/itens.js
  descricao   text default '',
  atualizado_em timestamptz not null default now()
);

-- Bancos criados antes destas colunas:
alter table public.assentamentos add column if not exists lorde_civil_id uuid;
alter table public.assentamentos add column if not exists lorde_id_jogo text;
alter table public.assentamentos add column if not exists lorde_raca text;

-- ------------------------------------------------------------
-- 7b. LICENÇAS EMITIDAS PELA CORTE
--     `tipo` define o que a licença habilita; a tela lê isso de
--     TIPOS_LICENCA (src/lib/constants.js), então criar um tipo novo
--     não exige mexer no banco.
-- ------------------------------------------------------------
create table if not exists public.licencas (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null,                          -- LIC-MIN-0001
  tipo       text not null default 'mineracao',
  titular    text not null,
  civil_id   uuid references public.civis(id) on delete set null,
  id_jogo    text,
  cobertura  jsonb not null default '[]'::jsonb,     -- ['veios','minas']
  recursos   jsonb not null default '[]'::jsonb,     -- ['ferro','ouro',...]
  escolta    boolean not null default false,         -- escolta da Guarda até o local
  status     text not null default 'Ativa'
             check (status in ('Ativa','Suspensa','Revogada','Expirada')),
  validade   text default '',
  notas      text default '',
  emitida_por text,
  emitida_em timestamptz,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists licencas_numero_unico on public.licencas (numero);
create index if not exists licencas_titular_idx on public.licencas(civil_id);
create index if not exists licencas_status_idx  on public.licencas(status);

-- ------------------------------------------------------------
-- 7c. CLÃS DO HOLD
--
--     A organização dos moradores: sociedade, guilda comercial,
--     clã de aventureiros ou clã religioso. Um morador registra e
--     conta a história e a função do clã no roleplay; a Corte
--     reconhece ou recusa. Reconhecido, quem registrou é o líder.
--
--     Não confundir com `clas`, que são as Casas Nobres — aquelas
--     são linhagem, estas são associação.
-- ------------------------------------------------------------
create table if not exists public.guildas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  tipo         text not null default 'sociedade'
               check (tipo in ('sociedade','comercial','aventureiro','religioso')),
  lema         text default '',
  cor          text default '#9384d1',
  brasao       text,                                  -- data URL da imagem
  historia     text not null default '',              -- de onde o clã veio
  funcao       text not null default '',              -- o que faz no RP de Riften
  lider        text,
  lider_civil_id uuid references public.civis(id) on delete set null,
  lider_id_jogo  text,
  -- [{ nome, civil_id, id_jogo, cargo, notas, entrou_em }]
  membros      jsonb not null default '[]'::jsonb,
  -- A sede do clã: uma propriedade registrada no nome do líder.
  propriedade_id   uuid references public.propriedades(id) on delete set null,
  propriedade_nome text default '',
  situacao     text not null default 'Pendente'
               check (situacao in ('Pendente','Aprovado','Recusado','Dissolvido')),
  parecer      text default '',                       -- o que a Corte respondeu
  avaliado_por text,
  avaliado_em  timestamptz,
  dissolucao_pedida_em timestamptz,
  dissolucao_motivo    text default '',
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists guildas_situacao_idx on public.guildas(situacao);
create index if not exists guildas_lider_idx    on public.guildas(lider_civil_id);
create index if not exists guildas_tipo_idx     on public.guildas(tipo);

-- A licença passou a ter titular: o morador, como sempre, ou um
-- clã — e a licença do clã vale para todos os membros dele.
alter table public.licencas add column if not exists titular_tipo text not null default 'civil';
alter table public.licencas add column if not exists guilda_id uuid references public.guildas(id) on delete set null;
alter table public.licencas add column if not exists guilda_nome text default '';
do $$ begin
  alter table public.licencas add constraint licencas_titular_tipo_ck
    check (titular_tipo in ('civil','guilda'));
exception when duplicate_object then null; end $$;
create index if not exists licencas_guilda_idx on public.licencas(guilda_id);



-- ------------------------------------------------------------
-- 7c. REGISTRO DE PRISÕES (Quartel General)
--     A Guarda registra a prisão; `inicio` e `fim` sustentam o
--     cronômetro da pena. As penas vêm do Código de Riften,
--     transcrito em src/data/codigo.js.
-- ------------------------------------------------------------
create table if not exists public.prisoes (
  id           uuid primary key default gen_random_uuid(),
  preso        text not null,
  civil_id     uuid references public.civis(id) on delete set null,
  id_jogo      text,
  origem       text default 'riften',            -- Hold de procedência
  crime_id     text,                             -- id no Código (ex.: 'c11')
  crime        text,                             -- nome do crime, congelado no registro
  artigo       text,                             -- ex.: 'Art. 11º'
  secao        text,                             -- leves | graves | hediondos | armas | minas | comercio
  minutos      int not null default 5,           -- pena aplicada
  multa        int,                              -- Septims; null = pena não pecuniária
  multa_texto  text default '',                  -- 'Confisco de bens', etc.
  fianca       int,                              -- Septims; null = sem fiança
  motivo       text default '',                  -- relato do guarda
  status       text not null default 'Cumprindo pena'
               check (status in ('Cumprindo pena','Sentença cumprida','Solto sob fiança','Anulada')),
  registrado_por text,
  inicio       timestamptz not null default now(),
  fim          timestamptz,
  cumprida_em  timestamptz,
  notas        text default '',
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists prisoes_status_idx on public.prisoes(status);
create index if not exists prisoes_preso_idx  on public.prisoes(civil_id);
create index if not exists prisoes_inicio_idx on public.prisoes(inicio desc);

-- ------------------------------------------------------------
-- 7d. LOGÍSTICA — entrada e saída do almoxarifado
--
--     Só os movimentos ficam gravados. O catálogo de itens é
--     fixo e vive em src/data/almoxarifado.js, e o saldo de cada
--     item é a contagem-base mais as entradas, menos as saídas.
-- ------------------------------------------------------------
create table if not exists public.movimentos (
  id           uuid primary key default gen_random_uuid(),
  item_id      text not null,                    -- id no catálogo (ex.: 'arm-guard-armor')
  item_nome    text,                             -- nome congelado no lançamento
  painel       text,                             -- equipamento | alquimia | recursos
  predio       text not null default 'mistveil_barracks'
               check (predio in ('mistveil_keep','mistveil_barracks','fort_greenwall')),
  sentido      text not null default 'entrada'
               check (sentido in ('entrada','saida')),
  quantidade   int not null default 1 check (quantidade > 0),
  motivo       text default '',
  destino      text default '',                  -- quem recebeu, ou de onde veio
  nota         text default '',
  registrado_por text,
  em           timestamptz not null default now(),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Cada prédio tem o seu almoxarifado; lançamento antigo, sem prédio,
-- fica com o Quartel, que é onde o inventário original foi contado.
alter table public.movimentos add column if not exists predio text not null default 'mistveil_barracks';
create index if not exists movimentos_item_idx   on public.movimentos(item_id);
create index if not exists movimentos_em_idx     on public.movimentos(em desc);
create index if not exists movimentos_predio_idx on public.movimentos(predio, em desc);

-- ------------------------------------------------------------
-- 6b. PEDIDOS DE COMPRA
--     O morador vê o estoque de um comércio e manda um pedido; o
--     dono (ou um funcionário) aceita ou recusa. Aceitar avisa o
--     comprador pelo Quadro de Avisos; o estoque só baixa quando a
--     entrega acontece no jogo e o pedido é concluído.
-- ------------------------------------------------------------
create table if not exists public.pedidos_compra (
  id            uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  propriedade_nome text,
  local         text,
  dono          text,
  dono_civil_id uuid,
  comprador     text not null,
  comprador_civil_id uuid,
  comprador_id_jogo  text,
  itens         jsonb not null default '[]'::jsonb,  -- [{ nome, quantidade, valor }]
  total         numeric not null default 0,
  observacao    text default '',
  status        text not null default 'Aberto'
                check (status in ('Aberto','Aceito','Concluído','Recusado')),
  atendido_por  text,
  atendido_por_civil_id uuid,
  resposta      text default '',
  criado_em     timestamptz not null default now(),
  respondido_em timestamptz,
  concluido_por text,
  concluido_por_civil_id uuid,
  concluido_em  timestamptz,
  atualizado_em timestamptz not null default now()
);
-- Bancos criados antes da etapa "Concluir" ganham as colunas e o novo estado.
alter table public.pedidos_compra add column if not exists concluido_por text;
alter table public.pedidos_compra add column if not exists concluido_por_civil_id uuid;
alter table public.pedidos_compra add column if not exists concluido_em timestamptz;
do $$
begin
  alter table public.pedidos_compra drop constraint if exists pedidos_compra_status_check;
  alter table public.pedidos_compra add constraint pedidos_compra_status_check
    check (status in ('Aberto','Aceito','Concluído','Recusado'));
end $$;

create index if not exists pedidos_compra_prop_idx   on public.pedidos_compra(propriedade_id);
create index if not exists pedidos_compra_status_idx on public.pedidos_compra(status);
create index if not exists pedidos_compra_comp_idx   on public.pedidos_compra(comprador_civil_id);

-- ------------------------------------------------------------
-- 7f. EDITAIS E CONTRATOS
--     O Hold pede, a cidade se oferece. Palácio, Quartel e os
--     próprios comércios abrem editais; trabalhadores e comércios
--     se inscrevem com preço e prazo. A proposta escolhida vira
--     contrato — e o contrato vive na mesma linha do edital, que
--     muda de status: Aberto → Contratado → Cumprido.
--
--     `aceita` guarda a quem o edital se dirige (trabalhador,
--     propriedade, ou os dois); `profissoes`, `nivel_minimo` e
--     `pericias_min` são os requisitos. Quem confere se alguém
--     entra é a função `pode_concorrer` — as mesmas regras que o
--     aplicativo aplica na tela.
-- ------------------------------------------------------------
create table if not exists public.editais (
  id            uuid primary key default gen_random_uuid(),
  numero        text,                                -- EDT-001, EDT-002…
  titulo        text not null,
  tipo          text not null default 'Fornecimento'
                check (tipo in ('Fornecimento','Serviço','Recrutamento')),
  descricao     text default '',
  itens         jsonb not null default '[]'::jsonb,  -- [{ nome, quantidade }]
  vagas         integer not null default 0,
  teto          numeric not null default 0,          -- 0 = sem teto
  prazo_max     text not null default 'Em até 1 mês'
                check (prazo_max in ('Imediata','Em até 7 dias','Em até 1 mês')),
  aceita        jsonb not null default '["trabalhador"]'::jsonb,
  profissoes    jsonb not null default '[]'::jsonb,
  nivel_minimo  text default 'N/A',
  pericias_min  jsonb not null default '{}'::jsonb,  -- { 'Arqueiro': 'Adepto' }
  orgao_tipo    text not null default 'corte'
                check (orgao_tipo in ('corte','quartel','propriedade')),
  orgao_nome    text,
  propriedade_id uuid references public.propriedades(id) on delete cascade,
  local         text default 'Riften',
  autor         text,
  autor_civil_id uuid,
  status        text not null default 'Aberto'
                check (status in ('Aberto','Contratado','Cumprido','Rompido','Cancelado')),
  -- o contrato, quando nasce
  proposta_id   uuid,
  contratado    text,
  contratado_civil_id uuid,
  contratado_como text,
  valor         numeric default 0,
  prazo_contratado text,
  contratado_em timestamptz,
  encerrado_em  timestamptz,
  motivo_encerramento text default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists editais_status_idx on public.editais(status);
create index if not exists editais_orgao_idx  on public.editais(orgao_tipo);
create index if not exists editais_prop_idx   on public.editais(propriedade_id);

create table if not exists public.propostas (
  id            uuid primary key default gen_random_uuid(),
  edital_id     uuid not null references public.editais(id) on delete cascade,
  edital_numero text,
  edital_titulo text,
  como          text not null default 'trabalhador'
                check (como in ('trabalhador','propriedade')),
  candidato     text not null,
  candidato_civil_id uuid,
  candidato_id_jogo  text,
  propriedade_id uuid references public.propriedades(id) on delete set null,
  propriedade_nome text,
  profissao     text,
  nivel         text,
  -- Em recrutamento: o que o Quartel aferiu, ou o que o candidato declarou.
  pericias      jsonb not null default '{}'::jsonb,
  pericias_aferidas boolean not null default false,
  preco         numeric not null default 0,
  prazo         text not null default 'Imediata'
                check (prazo in ('Imediata','Em até 7 dias','Em até 1 mês')),
  mensagem      text default '',
  status        text not null default 'Enviada'
                check (status in ('Enviada','Aceita','Recusada')),
  resposta      text default '',
  respondido_em timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Uma proposta por pessoa em cada edital: quem muda de ideia retira e refaz.
create unique index if not exists propostas_uma_por_pessoa
  on public.propostas (edital_id, candidato_civil_id);
create index if not exists propostas_edital_idx on public.propostas(edital_id);

-- ------------------------------------------------------------
-- 7e. QUADRO DE AVISOS
--     O que a Corte publica chega a todo mundo com registro em
--     Riften. `destino_civil_id` nulo = aviso geral; preenchido =
--     recado dirigido a uma pessoa, que só ela lê (por exemplo, a
--     recusa de um pedido de entrada em casa nobre).
-- ------------------------------------------------------------
create table if not exists public.avisos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  texto        text not null default '',
  autor        text,
  destino_civil_id uuid,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists avisos_data_idx    on public.avisos(criado_em desc);
create index if not exists avisos_destino_idx on public.avisos(destino_civil_id);

-- O morador lê o mural pelo mesmo par ID + senha do resto do sistema:
-- os avisos gerais, mais os recados dirigidos a ele.
create or replace function public.meus_avisos(p_id_jogo text, p_senha text)
returns setof public.avisos
language sql stable security definer set search_path = public as $$
  select a.* from public.avisos a
  join public.civis c
    on lower(c.id_jogo) = lower(trim(p_id_jogo))
   and c.status = 'Aprovado'
   and public.senha_igual(c.senha_acesso, p_senha)
  where a.destino_civil_id is null or a.destino_civil_id = c.id
  order by a.criado_em desc;
$$;
revoke all on function public.meus_avisos(text, text) from public;
grant execute on function public.meus_avisos(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 8. REGISTRO DE ATOS DA CORTE (auditoria / crônica)
-- ------------------------------------------------------------
create table if not exists public.registros (
  id        bigserial primary key,
  autor     text,
  acao      text not null,                           -- 'criou' | 'editou' | 'removeu'
  entidade  text not null,                           -- 'guarda' | 'propriedade' | ...
  alvo      text,
  detalhe   text default '',
  criado_em timestamptz not null default now()
);
create index if not exists registros_data_idx on public.registros(criado_em desc);

-- ------------------------------------------------------------
-- 9. RLS — nada é visível fora da Corte
-- ------------------------------------------------------------
alter table public.perfis         enable row level security;
alter table public.civis          enable row level security;
alter table public.licencas       enable row level security;
alter table public.prisoes        enable row level security;
alter table public.movimentos     enable row level security;
alter table public.pedidos_dinastia enable row level security;
alter table public.avisos          enable row level security;
alter table public.pedidos_compra  enable row level security;
alter table public.clas           enable row level security;
alter table public.corte          enable row level security;
alter table public.guardas        enable row level security;
alter table public.trabalhadores  enable row level security;
alter table public.propriedades   enable row level security;
alter table public.assentamentos  enable row level security;
alter table public.registros      enable row level security;
alter table public.pedidos_casa   enable row level security;
alter table public.ofertas        enable row level security;
alter table public.guildas        enable row level security;
alter table public.divisoes       enable row level security;
alter table public.patentes       enable row level security;
alter table public.milicia        enable row level security;
alter table public.campanhas      enable row level security;
alter table public.cofre          enable row level security;
alter table public.cobrancas      enable row level security;
alter table public.precos         enable row level security;

-- perfis: cada um lê o próprio; o Jarl lê e gerencia todos.
drop policy if exists perfis_self_read on public.perfis;
create policy perfis_self_read on public.perfis
  for select using (id = auth.uid() or public.eh_jarl());

drop policy if exists perfis_jarl_write on public.perfis;
create policy perfis_jarl_write on public.perfis
  for all using (public.eh_jarl()) with check (public.eh_jarl());

-- demais tabelas: leitura e escrita liberadas para a Corte ativa.
do $$
declare t text;
begin
  foreach t in array array['civis','clas','corte','guardas','divisoes','patentes','milicia','campanhas','cofre','cobrancas','precos','prisoes','movimentos','trabalhadores','pedidos_dinastia','avisos','pedidos_compra','editais','propostas','propriedades','assentamentos','licencas','registros','pedidos_casa','ofertas','guildas']
  loop
    execute format('drop policy if exists %I_corte_all on public.%I;', t, t);
    execute format(
      'create policy %I_corte_all on public.%I for all using (public.eh_corte()) with check (public.eh_corte());',
      t, t);
  end loop;
end $$;

-- O portal público pode INSERIR um pedido de registro (e nada mais):
-- não lê, não edita, não apaga, e só consegue criar linhas 'Pendente'.
drop policy if exists civis_envio_publico on public.civis;
create policy civis_envio_publico on public.civis
  for insert to anon
  with check (
    status = 'Pendente' and avaliado_por is null and avaliado_em is null
    -- Ninguém chega ao Registro Civil com a própria isenção já concedida:
    -- do lado de fora só existe pedir, e quem decide é a Corte.
    and isencao_status in ('Não pedida','Pendente')
    and isencao_parecer is not distinct from ''
    and isencao_por is null and isencao_em is null
  );

-- ------------------------------------------------------------
-- 9b. ACESSO DO MORADOR E DO SOLDADO
--
--     O morador não é usuário do Supabase Auth: ele entra com o ID
--     do jogo e a senha que a Corte gerou ao aprovar seu registro.
--     A tabela `civis` continua invisível para o anônimo — o que ele
--     alcança são estas três funções SECURITY DEFINER, e cada uma só
--     devolve ou muda a linha de quem acertou o par ID + senha.
--
--     A senha é comparada sem hífens e sem diferenciar maiúsculas,
--     igual ao que o aplicativo faz no modo demonstração.
-- ------------------------------------------------------------
create or replace function public.senha_igual(a text, b text)
returns boolean language sql immutable as $$
  select coalesce(upper(replace(replace(a, '-', ''), ' ', '')), '') <> ''
     and upper(replace(replace(a, '-', ''), ' ', ''))
       = upper(replace(replace(b, '-', ''), ' ', ''));
$$;

create or replace function public.acesso_cidadao(p_id_jogo text, p_senha text)
returns table (id uuid, nome text, id_jogo text, raca text, profissao text,
               nivel text, notas text, observacao_corte text, status text)
language sql stable security definer set search_path = public as $$
  select c.id, c.nome, c.id_jogo, c.raca, c.profissao,
         c.nivel, c.notas, c.observacao_corte, c.status
  from public.civis c
  where lower(c.id_jogo) = lower(trim(p_id_jogo))
    and c.status = 'Aprovado'
    and public.senha_igual(c.senha_acesso, p_senha);
$$;

-- O morador salvando a própria ficha. Situação, ID do jogo, senha e
-- observação da Corte ficam de fora: são decisão da Corte.
create or replace function public.salvar_ficha_cidadao(
  p_id_jogo text, p_senha text,
  p_nome text, p_raca text, p_profissao text, p_nivel text, p_notas text)
returns boolean language plpgsql security definer set search_path = public as $$
declare achou int;
begin
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'O nome do personagem não pode ficar em branco.';
  end if;
  update public.civis
     set nome = trim(p_nome), raca = p_raca, profissao = p_profissao,
         nivel = p_nivel, notas = p_notas
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  get diagnostics achou = row_count;
  return achou > 0;
end $$;

-- O soldado salvando as próprias habilidades. Patente, divisão,
-- afiliação e status não entram: quem muda isso é o comando.
/**
 * O morador pedindo isenção de cidadania depois do registro.
 * Só quem transferiu de outra cidade pede, e só quando não há pedido
 * em pé nem isenção já concedida.
 */
create or replace function public.pedir_isencao_cidadania(
  p_id_jogo text, p_senha text, p_motivo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare eu public.civis;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'ID ou senha não conferem.'; end if;
  if eu.origem <> 'transferencia' then
    raise exception 'A isenção é só para quem está transferindo a cidadania de outra cidade.';
  end if;
  if eu.isencao_status = 'Pendente' then raise exception 'Você já tem um pedido em análise.'; end if;
  if eu.isencao_status = 'Concedida' then raise exception 'Sua isenção já foi concedida.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Explique por que você precisa da isenção.'; end if;

  update public.civis set
    isencao_status = 'Pendente',
    isencao_motivo = trim(p_motivo),
    isencao_pedida_em = now(),
    isencao_parecer = '',
    isencao_por = null,
    isencao_em = null
   where id = eu.id;
  return true;
end $$;

/**
 * O morador declarando as próprias habilidades.
 * Opcional, e só mexe na linha de quem acertou ID + senha.
 */
create or replace function public.salvar_pericias_cidadao(
  p_id_jogo text, p_senha text, p_pericias jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.civis set pericias = coalesce(p_pericias, '{}'::jsonb)
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if not found then raise exception 'ID ou senha não conferem.'; end if;
  return true;
end $$;

create or replace function public.salvar_pericias_soldado(
  p_id_jogo text, p_senha text, p_pericias jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare eu uuid; achou int;
begin
  select c.id into eu from public.civis c
   where lower(c.id_jogo) = lower(trim(p_id_jogo))
     and c.status = 'Aprovado'
     and public.senha_igual(c.senha_acesso, p_senha);
  if eu is null then return false; end if;

  update public.guardas
     set pericias = p_pericias
   where civil_id = eu
      or lower(coalesce(id_jogo, '')) = lower(trim(p_id_jogo));
  get diagnostics achou = row_count;
  return achou > 0;
end $$;

-- O Patriarca administrando a própria casa. A função confere que quem
-- assina é mesmo o chefe daquela dinastia antes de tocar em qualquer coisa.
create or replace function public.chefe_da_casa(p_id_jogo text, p_senha text, p_cla_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.civis c
    join public.clas k on k.id = p_cla_id
    where lower(c.id_jogo) = lower(trim(p_id_jogo))
      and c.status = 'Aprovado'
      and public.senha_igual(c.senha_acesso, p_senha)
      and (k.lider_civil_id = c.id
           or (k.lider_civil_id is null and lower(trim(k.lider)) = lower(trim(c.nome))))
  );
$$;

-- Brasão, cor, notas e servos: o rosto da casa, na mão de quem a chefia.
-- Membros ficam de fora de propósito — membro vira nobre, e isso é da Corte.
create or replace function public.salvar_dinastia_patriarca(
  p_id_jogo text, p_senha text, p_cla_id uuid,
  p_brasao text, p_cor text, p_notas text, p_servos jsonb,
  p_soldados jsonb default null, p_mesnada_nome text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare casa public.clas%rowtype;
begin
  if not public.chefe_da_casa(p_id_jogo, p_senha, p_cla_id) then
    return false;
  end if;
  select * into casa from public.clas where id = p_cla_id;
  update public.clas
     set notas = coalesce(p_notas, ''), servos = coalesce(p_servos, '[]'::jsonb),
         -- Brasão e cor só mudam por pedido de insígnia, deferido pela Corte.
         brasao = casa.brasao, cor = casa.cor,
         -- Homens de armas só existem com a Mesnada concedida — e só
         -- uma mesnada concedida tem nome próprio.
         soldados = case when casa.mesnada_em is null then casa.soldados
                         else coalesce(p_soldados, casa.soldados) end,
         mesnada_nome = case when casa.mesnada_em is null then casa.mesnada_nome
                             else coalesce(left(trim(p_mesnada_nome), 60), casa.mesnada_nome) end
   where id = p_cla_id;
  return true;
end $$;

-- A indicação de um novo membro. Entra como pedido Pendente, nunca direto.
create or replace function public.pedir_membro_dinastia(
  p_id_jogo text, p_senha text, p_cla_id uuid,
  p_nome text, p_civil_id uuid, p_parentesco text, p_justificativa text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; novo uuid;
begin
  if not public.chefe_da_casa(p_id_jogo, p_senha, p_cla_id) then
    raise exception 'Só o Patriarca ou a Matriarca indica novos membros.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe quem você quer trazer para a casa.';
  end if;
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo));

  insert into public.pedidos_dinastia
    (cla_id, cla_nome, nome, civil_id, parentesco, justificativa,
     status, pedido_por, pedido_por_civil_id)
  select p_cla_id, k.nome, trim(p_nome), p_civil_id, coalesce(p_parentesco, ''),
         coalesce(p_justificativa, ''), 'Pendente', eu.nome, eu.id
    from public.clas k where k.id = p_cla_id
  returning id into novo;
  return novo;
end $$;

-- Desistir de um pedido que a Corte ainda não julgou.
create or replace function public.cancelar_pedido_dinastia(
  p_id_jogo text, p_senha text, p_pedido_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare alvo public.pedidos_dinastia%rowtype;
begin
  select * into alvo from public.pedidos_dinastia where id = p_pedido_id;
  if alvo.id is null or alvo.status <> 'Pendente' then return false; end if;
  if not public.chefe_da_casa(p_id_jogo, p_senha, alvo.cla_id) then return false; end if;
  delete from public.pedidos_dinastia where id = p_pedido_id;
  return true;
end $$;

-- O Patriarca lê a própria casa e os próprios pedidos sem enxergar o resto.
create or replace function public.minha_dinastia(p_id_jogo text, p_senha text)
returns setof public.clas
language sql stable security definer set search_path = public as $$
  select k.* from public.clas k
  join public.civis c
    on lower(c.id_jogo) = lower(trim(p_id_jogo))
   and c.status = 'Aprovado'
   and public.senha_igual(c.senha_acesso, p_senha)
  where k.lider_civil_id = c.id
     or (k.lider_civil_id is null and lower(trim(k.lider)) = lower(trim(c.nome)));
$$;

-- ------------------------------------------------------------
--  CHANCELARIA DA NOBREZA — o lado de quem pede
--
--  O morador e o Patriarca não escrevem em `pedidos_casa`: eles
--  chamam estas funções, que conferem ID + senha, conferem a regra
--  e gravam o pedido já com a taxa certa. Deferir é da Corte, que
--  entra autenticada e cai na política `pedidos_casa_corte_all`.
-- ------------------------------------------------------------

-- A taxa de cada tipo mora no banco também, para ninguém pedir barato.
create or replace function public.taxa_do_pedido(p_tipo text)
returns int language sql immutable as $$
  select case p_tipo
    when 'nobreza'  then 50000
    when 'fundacao' then 0
    when 'insignia' then 5000
    when 'herdeiro' then 3500
    when 'mesnada'  then 10000
    when 'alianca'  then 10000
    when 'sede'     then 8000
    else 0 end;
$$;

-- O morador com propriedade em seu nome pedindo o título.
create or replace function public.pedir_nobreza(
  p_id_jogo text, p_senha text, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; quantas int; novo uuid;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'ID ou senha não conferem.'; end if;

  select count(*) into quantas from public.propriedades
   where proprietario_civil_id = eu.id;
  if quantas = 0 then
    raise exception 'É preciso ter ao menos uma propriedade registrada em seu nome.';
  end if;

  if exists (select 1 from public.pedidos_casa
              where tipo = 'nobreza' and civil_id = eu.id
                and status in ('Pendente','Deferido')) then
    raise exception 'Você já tem um pedido de nobreza em pé.';
  end if;

  insert into public.pedidos_casa
    (tipo, custo, status, pedido_por, civil_id, id_jogo, motivo, dados)
  values ('nobreza', public.taxa_do_pedido('nobreza'), 'Pendente',
          eu.nome, eu.id, eu.id_jogo, coalesce(p_motivo, ''),
          jsonb_build_object('propriedades',
            coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'tipo', p.tipo))
                        from public.propriedades p where p.proprietario_civil_id = eu.id), '[]'::jsonb)))
  returning id into novo;
  return novo;
end $$;

-- O nobre fundando a casa. Nasce Pendente, com o pedido de fundação junto.
create or replace function public.fundar_casa_nobre(
  p_id_jogo text, p_senha text, p_nome text, p_titulo_lider text,
  p_cor text, p_brasao text, p_lema text, p_sede_id uuid, p_notas text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; sede public.propriedades%rowtype; nova uuid;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'ID ou senha não conferem.'; end if;

  if not exists (select 1 from public.pedidos_casa
                  where tipo = 'nobreza' and civil_id = eu.id and status = 'Deferido') then
    raise exception 'É preciso ter o título de nobreza para fundar uma casa.';
  end if;
  if exists (select 1 from public.clas where lider_civil_id = eu.id) then
    raise exception 'Você já tem uma casa.';
  end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Dê um nome à casa.'; end if;
  if exists (select 1 from public.clas where lower(trim(nome)) = lower(trim(p_nome))) then
    raise exception 'Já existe uma casa com este nome no Hold.';
  end if;

  select * into sede from public.propriedades
   where id = p_sede_id and proprietario_civil_id = eu.id;
  if sede.id is null then
    raise exception 'A sede tem de ser uma propriedade registrada em seu nome.';
  end if;

  insert into public.clas
    (nome, lider, titulo_lider, lider_civil_id, lider_id_jogo, lider_raca, lider_titulo,
     cor, brasao, lema, sede_propriedade_id, sede_nome, sede_tipo, situacao, notas)
  values (trim(p_nome), eu.nome,
          case when p_titulo_lider = 'Matriarca' then 'Matriarca' else 'Patriarca' end,
          eu.id, eu.id_jogo, eu.raca, 'Nobre',
          coalesce(p_cor, '#7c6bb0'), p_brasao, left(coalesce(p_lema, ''), 40),
          sede.id, sede.nome, sede.tipo, 'Pendente', coalesce(p_notas, ''))
  returning id into nova;

  insert into public.pedidos_casa
    (tipo, custo, status, pedido_por, civil_id, id_jogo, cla_id, cla_nome, motivo, dados)
  values ('fundacao', 0, 'Pendente', eu.nome, eu.id, eu.id_jogo, nova, trim(p_nome),
          coalesce(p_notas, ''),
          jsonb_build_object('lema', left(coalesce(p_lema, ''), 40),
                             'sede', sede.nome, 'sede_tipo', sede.tipo));
  return nova;
end $$;

-- A casa recusada voltando à fila, corrigida.
create or replace function public.refundar_casa(
  p_id_jogo text, p_senha text, p_cla_id uuid, p_nome text,
  p_cor text, p_brasao text, p_lema text, p_sede_id uuid, p_notas text)
returns boolean language plpgsql security definer set search_path = public as $$
declare casa public.clas%rowtype; sede public.propriedades%rowtype;
begin
  if not public.chefe_da_casa(p_id_jogo, p_senha, p_cla_id) then return false; end if;
  select * into casa from public.clas where id = p_cla_id;
  if casa.situacao <> 'Recusada' then
    raise exception 'Só se refaz a fundação de uma casa recusada.';
  end if;
  if exists (select 1 from public.clas
              where id <> p_cla_id and lower(trim(nome)) = lower(trim(p_nome))) then
    raise exception 'Já existe uma casa com este nome no Hold.';
  end if;
  select * into sede from public.propriedades
   where id = p_sede_id and proprietario_civil_id = casa.lider_civil_id;
  if sede.id is null then
    raise exception 'A sede tem de ser uma propriedade registrada em seu nome.';
  end if;

  update public.clas
     set nome = trim(p_nome), cor = coalesce(p_cor, cor), brasao = p_brasao,
         lema = left(coalesce(p_lema, ''), 40), sede_propriedade_id = sede.id,
         sede_nome = sede.nome, sede_tipo = sede.tipo,
         notas = coalesce(p_notas, ''), situacao = 'Pendente'
   where id = p_cla_id;

  insert into public.pedidos_casa
    (tipo, custo, status, pedido_por, civil_id, id_jogo, cla_id, cla_nome, motivo, dados)
  values ('fundacao', 0, 'Pendente', casa.lider, casa.lider_civil_id, casa.lider_id_jogo,
          p_cla_id, trim(p_nome), coalesce(p_notas, ''),
          jsonb_build_object('lema', left(coalesce(p_lema, ''), 40),
                             'sede', sede.nome, 'sede_tipo', sede.tipo, 'refeita', true));
  return true;
end $$;

-- Os pedidos da casa já fundada: insígnia, herdeiro, mesnada, sede, aliança.
create or replace function public.pedir_da_casa(
  p_id_jogo text, p_senha text, p_cla_id uuid, p_tipo text,
  p_motivo text, p_dados jsonb, p_alvo_cla_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; casa public.clas%rowtype; alvo public.clas%rowtype;
        quantas int; novo uuid; situacao text;
begin
  if not public.chefe_da_casa(p_id_jogo, p_senha, p_cla_id) then
    raise exception 'Só o Patriarca ou a Matriarca fala pela casa.';
  end if;
  if p_tipo not in ('insignia','herdeiro','mesnada','alianca','sede') then
    raise exception 'Tipo de pedido desconhecido.';
  end if;

  select * into casa from public.clas where id = p_cla_id;
  if casa.situacao <> 'Aprovada' then
    raise exception 'A casa ainda aguarda o reconhecimento da Corte.';
  end if;
  select * into eu from public.civis where id = casa.lider_civil_id;

  if exists (select 1 from public.pedidos_casa
              where cla_id = p_cla_id and tipo = p_tipo
                and status in ('Pendente','Aguardando casa')) then
    raise exception 'Já há um pedido deste tipo em andamento.';
  end if;
  if p_tipo = 'mesnada' and casa.mesnada_em is not null then
    raise exception 'A casa já tem mesnada registrada.';
  end if;

  if p_tipo = 'sede' then
    select count(*) into quantas from public.propriedades
     where proprietario_civil_id = casa.lider_civil_id;
    if quantas < 2 then
      raise exception 'Só se muda a sede quem tem mais de uma propriedade registrada.';
    end if;
    if not exists (select 1 from public.propriedades
                    where id = (p_dados->>'sede_propriedade_id')::uuid
                      and proprietario_civil_id = casa.lider_civil_id) then
      raise exception 'A sede tem de ser uma propriedade registrada em seu nome.';
    end if;
  end if;

  situacao := 'Pendente';
  if p_tipo = 'alianca' then
    select * into alvo from public.clas where id = p_alvo_cla_id;
    if alvo.id is null or alvo.situacao <> 'Aprovada' then
      raise exception 'A outra casa não está reconhecida pela Corte.';
    end if;
    if alvo.id = casa.id then raise exception 'Uma casa não se alia a si mesma.'; end if;
    if exists (select 1 from public.pedidos_casa
                where tipo = 'alianca' and status = 'Deferido'
                  and ((cla_id = casa.id and alvo_cla_id = alvo.id)
                    or (cla_id = alvo.id and alvo_cla_id = casa.id))) then
      raise exception 'As duas casas já são aliadas.';
    end if;
    -- A casa convidada responde antes de a Corte julgar.
    situacao := 'Aguardando casa';
  end if;

  insert into public.pedidos_casa
    (tipo, custo, status, pedido_por, civil_id, id_jogo,
     cla_id, cla_nome, alvo_cla_id, alvo_cla_nome, motivo, dados)
  values (p_tipo, public.taxa_do_pedido(p_tipo), situacao, casa.lider, casa.lider_civil_id,
          casa.lider_id_jogo, casa.id, casa.nome, alvo.id, alvo.nome,
          coalesce(p_motivo, ''), coalesce(p_dados, '{}'::jsonb))
  returning id into novo;
  return novo;
end $$;

-- A casa convidada aceitando ou recusando a proposta de aliança.
create or replace function public.responder_alianca(
  p_id_jogo text, p_senha text, p_pedido_id uuid, p_aceitar boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare alvo public.pedidos_casa%rowtype; eu public.civis%rowtype;
begin
  select * into alvo from public.pedidos_casa where id = p_pedido_id;
  if alvo.id is null or alvo.tipo <> 'alianca' or alvo.status <> 'Aguardando casa' then
    return false;
  end if;
  if not public.chefe_da_casa(p_id_jogo, p_senha, alvo.alvo_cla_id) then return false; end if;
  select * into eu from public.civis where lower(id_jogo) = lower(trim(p_id_jogo));
  update public.pedidos_casa
     set status = case when p_aceitar then 'Pendente' else 'Recusado pela casa' end,
         respondido_por = eu.nome, respondido_em = now(), atualizado_em = now()
   where id = p_pedido_id;
  return true;
end $$;

-- Desistir de um pedido que a Corte ainda não julgou. A fundação não volta atrás.
create or replace function public.cancelar_pedido_casa(
  p_id_jogo text, p_senha text, p_pedido_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare alvo public.pedidos_casa%rowtype; eu public.civis%rowtype;
begin
  select * into alvo from public.pedidos_casa where id = p_pedido_id;
  if alvo.id is null or alvo.tipo = 'fundacao' then return false; end if;
  if alvo.status not in ('Pendente','Aguardando casa') then return false; end if;
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null or alvo.civil_id is distinct from eu.id then return false; end if;
  delete from public.pedidos_casa where id = p_pedido_id;
  return true;
end $$;

-- O morador lê os próprios pedidos da chancelaria.
create or replace function public.meus_pedidos_casa(p_id_jogo text, p_senha text)
returns setof public.pedidos_casa
language sql stable security definer set search_path = public as $$
  select k.* from public.pedidos_casa k
  join public.civis c
    on lower(c.id_jogo) = lower(trim(p_id_jogo))
   and c.status = 'Aprovado'
   and public.senha_igual(c.senha_acesso, p_senha)
  where k.civil_id = c.id
     or k.alvo_cla_id in (select id from public.clas where lider_civil_id = c.id);
$$;

revoke all on function public.refundar_casa(text, text, uuid, text, text, text, text, uuid, text) from public;
grant execute on function public.refundar_casa(text, text, uuid, text, text, text, text, uuid, text) to anon, authenticated;
revoke all on function public.pedir_nobreza(text, text, text) from public;
revoke all on function public.fundar_casa_nobre(text, text, text, text, text, text, text, uuid, text) from public;
revoke all on function public.pedir_da_casa(text, text, uuid, text, text, jsonb, uuid) from public;
revoke all on function public.responder_alianca(text, text, uuid, boolean) from public;
revoke all on function public.cancelar_pedido_casa(text, text, uuid) from public;
revoke all on function public.meus_pedidos_casa(text, text) from public;
grant execute on function public.pedir_nobreza(text, text, text) to anon, authenticated;
grant execute on function public.fundar_casa_nobre(text, text, text, text, text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.pedir_da_casa(text, text, uuid, text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.responder_alianca(text, text, uuid, boolean) to anon, authenticated;
grant execute on function public.cancelar_pedido_casa(text, text, uuid) to anon, authenticated;
grant execute on function public.meus_pedidos_casa(text, text) to anon, authenticated;

revoke all on function public.chefe_da_casa(text, text, uuid) from public;
revoke all on function public.salvar_dinastia_patriarca(text, text, uuid, text, text, text, jsonb, jsonb, text) from public;
revoke all on function public.pedir_membro_dinastia(text, text, uuid, text, uuid, text, text) from public;
revoke all on function public.cancelar_pedido_dinastia(text, text, uuid) from public;
revoke all on function public.minha_dinastia(text, text) from public;
grant execute on function public.salvar_dinastia_patriarca(text, text, uuid, text, text, text, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.pedir_membro_dinastia(text, text, uuid, text, uuid, text, text) to anon, authenticated;
grant execute on function public.cancelar_pedido_dinastia(text, text, uuid) to anon, authenticated;
grant execute on function public.minha_dinastia(text, text) to anon, authenticated;

-- O dono ou funcionário desta propriedade?
create or replace function public.toca_a_propriedade(p_id_jogo text, p_senha text, p_prop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.civis c
    join public.propriedades pr on pr.id = p_prop_id
    where lower(c.id_jogo) = lower(trim(p_id_jogo))
      and c.status = 'Aprovado'
      and public.senha_igual(c.senha_acesso, p_senha)
      and (pr.proprietario_civil_id = c.id
           or (pr.proprietario_civil_id is null and lower(trim(pr.proprietario)) = lower(trim(c.nome)))
           or exists (
             select 1 from jsonb_array_elements(coalesce(pr.funcionarios, '[]'::jsonb)) f
             where (f->>'civil_id')::text = c.id::text
                or lower(trim(coalesce(f->>'nome',''))) = lower(trim(c.nome))))
  );
$$;

-- Estoque e funcionários. `p_funcionarios` nulo = só o estoque mudou
-- (é o caso do funcionário, que não contrata ninguém).
create or replace function public.salvar_propriedade_dono(
  p_id_jogo text, p_senha text, p_prop_id uuid,
  p_estoque jsonb, p_funcionarios jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.toca_a_propriedade(p_id_jogo, p_senha, p_prop_id) then return false; end if;
  update public.propriedades
     set estoque = coalesce(p_estoque, '[]'::jsonb),
         funcionarios = coalesce(p_funcionarios, funcionarios)
   where id = p_prop_id;
  return true;
end $$;

-- Um morador pedindo itens. A quantidade é conferida contra o estoque.
create or replace function public.pedir_compra(
  p_id_jogo text, p_senha text, p_prop_id uuid, p_itens jsonb, p_observacao text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; pr public.propriedades%rowtype;
        it jsonb; tem numeric; novo uuid; soma numeric := 0;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'Credenciais recusadas.'; end if;

  select * into pr from public.propriedades where id = p_prop_id;
  if pr.id is null then raise exception 'Propriedade não encontrada.'; end if;

  for it in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    select coalesce(max((e->>'quantidade')::numeric), 0) into tem
      from jsonb_array_elements(coalesce(pr.estoque, '[]'::jsonb)) e
     where lower(trim(e->>'nome')) = lower(trim(it->>'nome'));
    if (it->>'quantidade')::numeric > tem then
      raise exception '% tem só % de % em estoque.', pr.nome, tem, it->>'nome';
    end if;
    soma := soma + (it->>'quantidade')::numeric * coalesce((it->>'valor')::numeric, 0);
  end loop;

  insert into public.pedidos_compra
    (propriedade_id, propriedade_nome, local, dono, dono_civil_id,
     comprador, comprador_civil_id, comprador_id_jogo, itens, total, observacao, status)
  values (pr.id, pr.nome, pr.local, pr.proprietario, pr.proprietario_civil_id,
          eu.nome, eu.id, eu.id_jogo, coalesce(p_itens, '[]'::jsonb), soma,
          coalesce(p_observacao, ''), 'Aberto')
  returning id into novo;
  return novo;
end $$;

-- ------------------------------------------------------------
-- 9f. EDITAIS PELO LADO DE FORA DA CORTE
--
--     O morador não é usuário do Auth, então não escreve nas tabelas:
--     ele passa por estas funções. As regras de quem pode concorrer
--     ficam em `pode_concorrer` — as mesmas que a tela aplica, para
--     que a recusa seja igual dos dois lados.
--
--     Editais são chamados públicos: qualquer um lê. Propostas, não —
--     essas só o órgão que abriu o edital e o próprio candidato veem.
-- ------------------------------------------------------------
create or replace function public.nivel_valor(p text)
returns int language sql immutable as $$
  select case p
    when 'Novato' then 1 when 'Aprendiz' then 2 when 'Adepto' then 3
    when 'Especialista' then 4 when 'Mestre' then 5 else 0 end;
$$;

drop policy if exists editais_leitura_publica on public.editais;
create policy editais_leitura_publica on public.editais
  for select to anon using (true);

/**
 * Por que esta pessoa (ou esta casa) pode ou não concorrer.
 * Devolve '' quando pode; senão, o motivo em palavras.
 */
create or replace function public.pode_concorrer(
  p_edital public.editais, p_civil public.civis, p_como text, p_prop public.propriedades)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  profs text[] := array(select jsonb_array_elements_text(coalesce(p_edital.profissoes, '[]'::jsonb)));
  minimo int := public.nivel_valor(p_edital.nivel_minimo);
  falta text;
begin
  if p_edital.status <> 'Aberto' then return 'Este edital não está mais aberto.'; end if;
  if not (coalesce(p_edital.aceita, '[]'::jsonb) ? p_como) then
    return 'Este edital não aceita esse tipo de candidato.';
  end if;

  if p_como = 'trabalhador' then
    if coalesce(p_civil.profissao, '') = '' then
      return 'Você ainda não tem profissão no Registro Civil.';
    end if;
    if array_length(profs, 1) is not null and not (p_civil.profissao = any(profs)) then
      return format('O edital pede %s.', array_to_string(profs, ', '));
    end if;
    if public.nivel_valor(p_civil.nivel) < minimo then
      return format('O edital pede nível %s ou acima.', p_edital.nivel_minimo);
    end if;
    -- Habilidade exigida vale contra a ficha militar, quando ela existe.
    select string_agg(k.key, ', ') into falta
      from jsonb_each_text(coalesce(p_edital.pericias_min, '{}'::jsonb)) k
      join public.guardas g on g.civil_id = p_civil.id
     where public.nivel_valor(coalesce(g.pericias->>k.key, 'N/A')) < public.nivel_valor(k.value);
    if falta is not null then
      return format('Suas habilidades aferidas não alcançam: %s.', falta);
    end if;
    return '';
  end if;

  if p_prop.id is null then return 'Você não responde por nenhuma propriedade.'; end if;
  if p_edital.propriedade_id = p_prop.id then
    return 'A casa que abriu o edital não concorre nele.';
  end if;
  if p_prop.status in ('Interditada','Arruinada') then
    return format('%s está %s e não pode assumir contratos.', p_prop.nome, lower(p_prop.status));
  end if;
  if array_length(profs, 1) is not null and not exists (
    select 1 from jsonb_array_elements(coalesce(p_prop.funcionarios, '[]'::jsonb)) f
     where f->>'profissao' = any(profs)) then
    return format('%s não tem ninguém de %s na equipe.', p_prop.nome, array_to_string(profs, ', '));
  end if;
  if minimo > 0 and not exists (
    select 1 from jsonb_array_elements(coalesce(p_prop.funcionarios, '[]'::jsonb)) f
     where public.nivel_valor(f->>'nivel') >= minimo
       and (array_length(profs, 1) is null or f->>'profissao' = any(profs))) then
    return format('A equipe de %s não alcança o nível %s.', p_prop.nome, p_edital.nivel_minimo);
  end if;
  return '';
end $$;

/** O dono abrindo edital em nome da casa (e o chamado no Quadro de Avisos). */
create or replace function public.abrir_edital_propriedade(
  p_id_jogo text, p_senha text, p_prop_id uuid, p_edital jsonb, p_aviso jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid; pr public.propriedades;
begin
  select * into pr from public.propriedades where id = p_prop_id;
  if pr.id is null then raise exception 'Propriedade não encontrada.'; end if;
  if not exists (
    select 1 from public.civis c
     where lower(c.id_jogo) = lower(trim(p_id_jogo))
       and c.status = 'Aprovado'
       and public.senha_igual(c.senha_acesso, p_senha)
       and (pr.proprietario_civil_id = c.id
            or (pr.proprietario_civil_id is null
                and lower(trim(pr.proprietario)) = lower(trim(c.nome))))
  ) then
    raise exception 'Só o dono da propriedade abre editais em nome dela.';
  end if;

  insert into public.editais (
    numero, titulo, tipo, descricao, itens, vagas, teto, prazo_max,
    aceita, profissoes, nivel_minimo, pericias_min,
    orgao_tipo, orgao_nome, propriedade_id, local, autor, autor_civil_id, status)
  select p_edital->>'numero', p_edital->>'titulo', p_edital->>'tipo',
         coalesce(p_edital->>'descricao',''), coalesce(p_edital->'itens','[]'::jsonb),
         coalesce((p_edital->>'vagas')::int, 0), coalesce((p_edital->>'teto')::numeric, 0),
         coalesce(p_edital->>'prazo_max','Em até 1 mês'),
         '["trabalhador"]'::jsonb,               -- casa chama gente, não concorrente
         coalesce(p_edital->'profissoes','[]'::jsonb),
         coalesce(p_edital->>'nivel_minimo','N/A'), '{}'::jsonb,
         'propriedade', pr.nome, pr.id, pr.local,
         p_edital->>'autor', (p_edital->>'autor_civil_id')::uuid, 'Aberto'
  returning id into novo;

  if p_aviso is not null then
    insert into public.avisos (titulo, texto, autor, destino_civil_id)
    values (p_aviso->>'titulo', p_aviso->>'texto', p_aviso->>'autor', null);
  end if;
  return novo;
end $$;

/** A inscrição do morador — conferida pelas mesmas regras da tela. */
create or replace function public.enviar_proposta(
  p_id_jogo text, p_senha text, p_edital_id uuid, p_proposta jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  eu public.civis; ed public.editais; pr public.propriedades;
  como text := coalesce(p_proposta->>'como', 'trabalhador');
  motivo text; novo uuid;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo)) and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'ID ou senha não conferem.'; end if;

  select * into ed from public.editais where id = p_edital_id;
  if ed.id is null then raise exception 'Edital não encontrado.'; end if;
  if como = 'propriedade' then
    select * into pr from public.propriedades where id = (p_proposta->>'propriedade_id')::uuid;
    if not public.toca_a_propriedade(p_id_jogo, p_senha, pr.id) then
      raise exception 'Você não responde por essa propriedade.';
    end if;
  end if;

  motivo := public.pode_concorrer(ed, eu, como, pr);
  if motivo <> '' then raise exception '%', motivo; end if;

  if ed.teto > 0 and coalesce((p_proposta->>'preco')::numeric, 0) > ed.teto then
    raise exception 'O teto do edital é de % Septims.', ed.teto;
  end if;

  insert into public.propostas (
    edital_id, edital_numero, edital_titulo, como, candidato, candidato_civil_id,
    candidato_id_jogo, propriedade_id, propriedade_nome, profissao, nivel,
    pericias, pericias_aferidas, preco, prazo, mensagem, status)
  values (ed.id, ed.numero, ed.titulo, como, eu.nome, eu.id, eu.id_jogo,
          nullif(p_proposta->>'propriedade_id','')::uuid, p_proposta->>'propriedade_nome',
          p_proposta->>'profissao', p_proposta->>'nivel',
          coalesce(p_proposta->'pericias','{}'::jsonb),
          coalesce((p_proposta->>'pericias_aferidas')::boolean, false),
          coalesce((p_proposta->>'preco')::numeric, 0),
          coalesce(p_proposta->>'prazo','Imediata'),
          coalesce(p_proposta->>'mensagem',''), 'Enviada')
  returning id into novo;
  return novo;
end $$;

create or replace function public.retirar_proposta(
  p_id_jogo text, p_senha text, p_proposta_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare eu public.civis;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo)) and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'ID ou senha não conferem.'; end if;
  delete from public.propostas
   where id = p_proposta_id and candidato_civil_id = eu.id and status = 'Enviada';
  return found;
end $$;

/** As propostas de um edital, para quem tem direito de vê-las. */
create or replace function public.propostas_do_edital(
  p_id_jogo text, p_senha text, p_edital_id uuid)
returns setof public.propostas
language sql stable security definer set search_path = public as $$
  select pp.* from public.propostas pp
   where pp.edital_id = p_edital_id
     and exists (
       select 1 from public.civis c, public.editais e
        where e.id = p_edital_id
          and lower(c.id_jogo) = lower(trim(p_id_jogo))
          and c.status = 'Aprovado'
          and public.senha_igual(c.senha_acesso, p_senha)
          and (pp.candidato_civil_id = c.id
               or public.toca_a_propriedade(p_id_jogo, p_senha, e.propriedade_id)));
$$;

/** O dono julgando, cancelando ou dando por cumprido o edital da casa. */
create or replace function public.decidir_edital_propriedade(
  p_id_jogo text, p_senha text, p_prop_id uuid, p_edital_id uuid,
  p_edital jsonb, p_propostas jsonb, p_avisos jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  if not public.toca_a_propriedade(p_id_jogo, p_senha, p_prop_id) then
    raise exception 'Só quem responde pela propriedade decide os editais dela.';
  end if;
  if not exists (select 1 from public.editais
                  where id = p_edital_id and propriedade_id = p_prop_id) then
    raise exception 'Este edital não é desta propriedade.';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_propostas, '[]'::jsonb)) loop
    update public.propostas set
      status        = coalesce(item->'patch'->>'status', status),
      resposta      = coalesce(item->'patch'->>'resposta', resposta),
      respondido_em = coalesce((item->'patch'->>'respondido_em')::timestamptz, respondido_em)
     where id = (item->>'id')::uuid and edital_id = p_edital_id;
  end loop;

  if p_edital is not null then
    update public.editais set
      status              = coalesce(p_edital->>'status', status),
      proposta_id         = coalesce(nullif(p_edital->>'proposta_id','')::uuid, proposta_id),
      contratado          = coalesce(p_edital->>'contratado', contratado),
      contratado_civil_id = coalesce(nullif(p_edital->>'contratado_civil_id','')::uuid, contratado_civil_id),
      contratado_como     = coalesce(p_edital->>'contratado_como', contratado_como),
      valor               = coalesce((p_edital->>'valor')::numeric, valor),
      prazo_contratado    = coalesce(p_edital->>'prazo_contratado', prazo_contratado),
      contratado_em       = coalesce((p_edital->>'contratado_em')::timestamptz, contratado_em),
      encerrado_em        = coalesce((p_edital->>'encerrado_em')::timestamptz, encerrado_em),
      motivo_encerramento = coalesce(p_edital->>'motivo_encerramento', motivo_encerramento)
     where id = p_edital_id;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_avisos, '[]'::jsonb)) loop
    insert into public.avisos (titulo, texto, autor, destino_civil_id)
    values (item->>'titulo', item->>'texto', item->>'autor',
            nullif(item->>'destino_civil_id','')::uuid);
  end loop;
  return true;
end $$;

revoke all on function public.pode_concorrer(public.editais, public.civis, text, public.propriedades) from public;
revoke all on function public.abrir_edital_propriedade(text, text, uuid, jsonb, jsonb) from public;
revoke all on function public.enviar_proposta(text, text, uuid, jsonb) from public;
revoke all on function public.retirar_proposta(text, text, uuid) from public;
revoke all on function public.propostas_do_edital(text, text, uuid) from public;
revoke all on function public.decidir_edital_propriedade(text, text, uuid, uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.abrir_edital_propriedade(text, text, uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.enviar_proposta(text, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.retirar_proposta(text, text, uuid) to anon, authenticated;
grant execute on function public.propostas_do_edital(text, text, uuid) to anon, authenticated;
grant execute on function public.decidir_edital_propriedade(text, text, uuid, uuid, jsonb, jsonb, jsonb) to anon, authenticated;

/** O dono ou o funcionário respondendo/concluindo um pedido de compra. */
create or replace function public.decidir_pedido_compra(
  p_id_jogo text, p_senha text, p_prop_id uuid, p_pedido_id uuid,
  p_pedido jsonb, p_estoque jsonb, p_avisos jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  if not public.toca_a_propriedade(p_id_jogo, p_senha, p_prop_id) then
    raise exception 'Só o dono e os funcionários atendem os pedidos desta casa.';
  end if;
  if not exists (select 1 from public.pedidos_compra
                  where id = p_pedido_id and propriedade_id = p_prop_id) then
    raise exception 'Este pedido não é desta propriedade.';
  end if;

  update public.pedidos_compra set
    status                 = coalesce(p_pedido->>'status', status),
    atendido_por           = coalesce(p_pedido->>'atendido_por', atendido_por),
    atendido_por_civil_id  = coalesce(nullif(p_pedido->>'atendido_por_civil_id','')::uuid, atendido_por_civil_id),
    resposta               = coalesce(p_pedido->>'resposta', resposta),
    respondido_em          = coalesce((p_pedido->>'respondido_em')::timestamptz, respondido_em),
    concluido_por          = coalesce(p_pedido->>'concluido_por', concluido_por),
    concluido_por_civil_id = coalesce(nullif(p_pedido->>'concluido_por_civil_id','')::uuid, concluido_por_civil_id),
    concluido_em           = coalesce((p_pedido->>'concluido_em')::timestamptz, concluido_em)
   where id = p_pedido_id;

  if p_estoque is not null then
    update public.propriedades set estoque = p_estoque where id = p_prop_id;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_avisos, '[]'::jsonb)) loop
    insert into public.avisos (titulo, texto, autor, destino_civil_id)
    values (item->>'titulo', item->>'texto', item->>'autor',
            nullif(item->>'destino_civil_id','')::uuid);
  end loop;
  return true;
end $$;

revoke all on function public.decidir_pedido_compra(text, text, uuid, uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.decidir_pedido_compra(text, text, uuid, uuid, jsonb, jsonb, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
--  MERCADO IMOBILIÁRIO — o lado do morador
--
--  Anunciar e responder é do dono; propor é de qualquer morador
--  aprovado que não seja o dono. Tudo passa por estas funções, que
--  conferem ID + senha e o vínculo com o imóvel.
-- ------------------------------------------------------------

-- Só o dono anuncia o que é dele (funcionário não anuncia a casa do patrão).
create or replace function public.dono_do_imovel(p_id_jogo text, p_senha text, p_prop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.propriedades p
    join public.civis c
      on lower(c.id_jogo) = lower(trim(p_id_jogo))
     and c.status = 'Aprovado'
     and public.senha_igual(c.senha_acesso, p_senha)
    where p.id = p_prop_id
      and (p.proprietario_civil_id = c.id
        or (p.proprietario_civil_id is null
            and lower(trim(coalesce(p.proprietario, ''))) = lower(trim(c.nome))
            and coalesce(trim(p.proprietario), '') <> ''))
  );
$$;

create or replace function public.anunciar_imovel(
  p_id_jogo text, p_senha text, p_prop_id uuid, p_preco int, p_nota text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.dono_do_imovel(p_id_jogo, p_senha, p_prop_id) then
    raise exception 'Só o dono põe o imóvel à venda.';
  end if;
  if coalesce(p_preco, 0) <= 0 then
    raise exception 'Diga por quanto você quer vender.';
  end if;
  update public.propriedades
     set a_venda = true, preco = p_preco, anuncio_nota = coalesce(p_nota, ''),
         anunciada_em = now(), atualizado_em = now()
   where id = p_prop_id;
  return true;
end $$;

-- Retirar o anúncio derruba as propostas abertas e avisa quem propôs.
create or replace function public.retirar_anuncio(
  p_id_jogo text, p_senha text, p_prop_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare imovel public.propriedades%rowtype; o public.ofertas%rowtype;
begin
  if not public.dono_do_imovel(p_id_jogo, p_senha, p_prop_id) then
    raise exception 'Só o dono retira o próprio anúncio.';
  end if;
  select * into imovel from public.propriedades where id = p_prop_id;
  update public.propriedades
     set a_venda = false, preco = null, anuncio_nota = '', anunciada_em = null,
         atualizado_em = now()
   where id = p_prop_id;

  for o in select * from public.ofertas
            where propriedade_id = p_prop_id and status = 'Aberta' loop
    update public.ofertas
       set status = 'Recusada', resposta = 'O anúncio foi retirado do mercado.',
           respondido_por = imovel.proprietario, respondido_em = now(), atualizado_em = now()
     where id = o.id;
    if o.comprador_civil_id is not null then
      insert into public.avisos (titulo, texto, destino_civil_id, autor)
      values ('Anúncio retirado — ' || imovel.nome,
              imovel.proprietario || ' tirou ' || imovel.nome
                || ' do Mercado Imobiliário, e a sua proposta foi encerrada.',
              o.comprador_civil_id, imovel.proprietario);
    end if;
  end loop;
  return true;
end $$;

create or replace function public.enviar_oferta(
  p_id_jogo text, p_senha text, p_prop_id uuid, p_valor int, p_mensagem text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; imovel public.propriedades%rowtype; nova uuid;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'ID ou senha não conferem.'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Diga quanto você oferece.'; end if;

  select * into imovel from public.propriedades where id = p_prop_id;
  if imovel.id is null or not imovel.a_venda then
    raise exception 'Este imóvel não está à venda.';
  end if;
  if imovel.proprietario_civil_id = eu.id then
    raise exception 'O imóvel já é seu.';
  end if;
  if exists (select 1 from public.ofertas
              where propriedade_id = p_prop_id and comprador_civil_id = eu.id
                and status = 'Aberta') then
    raise exception 'Você já tem uma proposta em pé por este imóvel.';
  end if;

  insert into public.ofertas
    (propriedade_id, propriedade_nome, categoria, tipo, local, preco_pedido,
     dono, dono_civil_id, comprador, comprador_civil_id, comprador_id_jogo,
     valor, mensagem, status)
  values (imovel.id, imovel.nome, imovel.categoria, imovel.tipo, imovel.local, imovel.preco,
          imovel.proprietario, imovel.proprietario_civil_id, eu.nome, eu.id, eu.id_jogo,
          p_valor, coalesce(p_mensagem, ''), 'Aberta')
  returning id into nova;

  if imovel.proprietario_civil_id is not null then
    insert into public.avisos (titulo, texto, destino_civil_id, autor)
    values ('Proposta por ' || imovel.nome,
            eu.nome || ' ofereceu ' || p_valor || ' Septims pelo seu imóvel '
              || imovel.nome || '. Responda pelo Mercado Imobiliário.',
            imovel.proprietario_civil_id, eu.nome);
  end if;
  return nova;
end $$;

create or replace function public.retirar_oferta(
  p_id_jogo text, p_senha text, p_oferta_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; alvo public.ofertas%rowtype;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then return false; end if;
  select * into alvo from public.ofertas where id = p_oferta_id;
  if alvo.id is null or alvo.status <> 'Aberta' then return false; end if;
  if alvo.comprador_civil_id is distinct from eu.id then return false; end if;
  update public.ofertas
     set status = 'Retirada', respondido_em = now(), atualizado_em = now()
   where id = p_oferta_id;
  return true;
end $$;

-- Aceitar transfere o imóvel e derruba as outras propostas.
create or replace function public.responder_oferta(
  p_id_jogo text, p_senha text, p_prop_id uuid, p_oferta_id uuid,
  p_aceitar boolean, p_resposta text)
returns boolean language plpgsql security definer set search_path = public as $$
declare imovel public.propriedades%rowtype; alvo public.ofertas%rowtype;
        o public.ofertas%rowtype; quem text;
begin
  if not public.dono_do_imovel(p_id_jogo, p_senha, p_prop_id) then
    raise exception 'Só o dono responde às propostas do imóvel.';
  end if;
  select * into imovel from public.propriedades where id = p_prop_id;
  select * into alvo from public.ofertas where id = p_oferta_id;
  if alvo.id is null or alvo.propriedade_id <> p_prop_id then
    raise exception 'Esta proposta não é deste imóvel.';
  end if;
  if alvo.status <> 'Aberta' then
    raise exception 'Esta proposta já foi respondida.';
  end if;
  quem := imovel.proprietario;

  update public.ofertas
     set status = case when p_aceitar then 'Aceita' else 'Recusada' end,
         resposta = coalesce(p_resposta, ''), respondido_por = quem,
         respondido_em = now(), atualizado_em = now()
   where id = p_oferta_id;

  if not p_aceitar then
    if alvo.comprador_civil_id is not null then
      insert into public.avisos (titulo, texto, destino_civil_id, autor)
      values ('Proposta recusada — ' || imovel.nome,
              quem || ' recusou a sua proposta por ' || imovel.nome
                || coalesce(' Motivo: ' || nullif(trim(p_resposta), ''), ''),
              alvo.comprador_civil_id, quem);
    end if;
    return true;
  end if;

  -- Venda aceita — mas não fechada.
  --
  -- O negócio é entre os dois; quem passa a propriedade é a Corte, ao
  -- lavrar a escritura, e havendo taxa de transmissão o imóvel só muda
  -- de nome quando ela for paga. Por isso aqui não se toca em
  -- `propriedades`, e as outras propostas seguem de pé: se a Corte
  -- recusar, a venda simplesmente não aconteceu.
  if alvo.comprador_civil_id is not null then
    insert into public.avisos (titulo, texto, destino_civil_id, autor)
    values ('Proposta aceita — ' || imovel.nome,
            quem || ' aceitou a sua proposta de ' || alvo.valor || ' Septims por '
              || imovel.nome || '. Falta a Corte lavrar a escritura — havendo taxa de '
              || 'transmissão, ela aparecerá em Cobranças, e o imóvel passa para o seu '
              || 'nome quando o pagamento for confirmado.',
            alvo.comprador_civil_id, quem);
  end if;

  insert into public.registros (autor, acao, entidade, alvo, detalhe)
  values (quem, 'aceitou proposta', 'imóvel', imovel.nome,
          alvo.valor || ' Septims de ' || alvo.comprador || ' — aguarda escritura');
  return true;
end $$;

-- O morador lê o mercado e as próprias propostas.
create or replace function public.imoveis_a_venda()
returns setof public.propriedades
language sql stable security definer set search_path = public as $$
  select * from public.propriedades where a_venda and status <> 'Arruinada';
$$;

create or replace function public.minhas_ofertas(p_id_jogo text, p_senha text)
returns setof public.ofertas
language sql stable security definer set search_path = public as $$
  select o.* from public.ofertas o
  join public.civis c
    on lower(c.id_jogo) = lower(trim(p_id_jogo))
   and c.status = 'Aprovado'
   and public.senha_igual(c.senha_acesso, p_senha)
  where o.comprador_civil_id = c.id
     or o.propriedade_id in (select id from public.propriedades where proprietario_civil_id = c.id);
$$;


-- ------------------------------------------------------------
--  CLÃS — o lado do morador
--
--  Registrar é de qualquer morador aprovado; administrar é do
--  líder. Reconhecer, recusar e dissolver é da Corte, que entra
--  autenticada e cai na política `guildas_corte_all`.
-- ------------------------------------------------------------
create or replace function public.lider_do_cla(p_id_jogo text, p_senha text, p_guilda_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.guildas g
    join public.civis c
      on lower(c.id_jogo) = lower(trim(p_id_jogo))
     and c.status = 'Aprovado'
     and public.senha_igual(c.senha_acesso, p_senha)
    where g.id = p_guilda_id
      and (g.lider_civil_id = c.id
        or (g.lider_civil_id is null
            and lower(trim(coalesce(g.lider, ''))) = lower(trim(c.nome))))
  );
$$;

create or replace function public.registrar_cla(
  p_id_jogo text, p_senha text, p_nome text, p_tipo text, p_lema text,
  p_cor text, p_brasao text, p_historia text, p_funcao text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; novo uuid;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then raise exception 'ID ou senha não conferem.'; end if;

  if exists (select 1 from public.guildas
              where lider_civil_id = eu.id and situacao in ('Pendente','Aprovado')) then
    raise exception 'Você já responde por um clã.';
  end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Dê um nome ao clã.'; end if;
  if exists (select 1 from public.guildas
              where lower(trim(nome)) = lower(trim(p_nome)) and situacao <> 'Dissolvido') then
    raise exception 'Já existe um clã com este nome.';
  end if;
  if coalesce(trim(p_historia), '') = '' or coalesce(trim(p_funcao), '') = '' then
    raise exception 'A história e a função do clã são obrigatórias.';
  end if;

  insert into public.guildas
    (nome, tipo, lema, cor, brasao, historia, funcao,
     lider, lider_civil_id, lider_id_jogo, situacao)
  values (trim(p_nome), p_tipo, left(coalesce(p_lema, ''), 60), coalesce(p_cor, '#9384d1'),
          p_brasao, trim(p_historia), trim(p_funcao),
          eu.nome, eu.id, eu.id_jogo, 'Pendente')
  returning id into novo;
  return novo;
end $$;

create or replace function public.reenviar_cla(
  p_id_jogo text, p_senha text, p_guilda_id uuid, p_nome text, p_tipo text,
  p_lema text, p_cor text, p_brasao text, p_historia text, p_funcao text)
returns boolean language plpgsql security definer set search_path = public as $$
declare cla public.guildas%rowtype;
begin
  if not public.lider_do_cla(p_id_jogo, p_senha, p_guilda_id) then return false; end if;
  select * into cla from public.guildas where id = p_guilda_id;
  if cla.situacao <> 'Recusado' then
    raise exception 'Só se reenvia o registro de um clã recusado.';
  end if;
  if exists (select 1 from public.guildas
              where id <> p_guilda_id and lower(trim(nome)) = lower(trim(p_nome))
                and situacao <> 'Dissolvido') then
    raise exception 'Já existe um clã com este nome.';
  end if;
  update public.guildas
     set nome = trim(p_nome), tipo = p_tipo, lema = left(coalesce(p_lema, ''), 60),
         cor = coalesce(p_cor, cor), brasao = p_brasao,
         historia = trim(coalesce(p_historia, '')), funcao = trim(coalesce(p_funcao, '')),
         situacao = 'Pendente', parecer = '', avaliado_por = null, avaliado_em = null,
         atualizado_em = now()
   where id = p_guilda_id;
  return true;
end $$;

-- O líder administra o que é do clã. Nome, tipo e situação são da Corte.
create or replace function public.salvar_cla_lider(
  p_id_jogo text, p_senha text, p_guilda_id uuid,
  p_historia text, p_funcao text, p_membros jsonb, p_propriedade_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare cla public.guildas%rowtype; imovel public.propriedades%rowtype;
begin
  if not public.lider_do_cla(p_id_jogo, p_senha, p_guilda_id) then
    raise exception 'Só o líder administra o clã.';
  end if;
  select * into cla from public.guildas where id = p_guilda_id;
  if cla.situacao <> 'Aprovado' then
    raise exception 'O clã ainda aguarda o reconhecimento da Corte.';
  end if;

  if p_propriedade_id is not null then
    select * into imovel from public.propriedades
     where id = p_propriedade_id and proprietario_civil_id = cla.lider_civil_id;
    if imovel.id is null then
      raise exception 'Só se vincula ao clã uma propriedade registrada em seu nome.';
    end if;
  end if;

  update public.guildas
     set historia = coalesce(p_historia, historia),
         funcao = coalesce(p_funcao, funcao),
         membros = coalesce(p_membros, membros),
         propriedade_id = p_propriedade_id,
         propriedade_nome = coalesce(imovel.nome, ''),
         atualizado_em = now()
   where id = p_guilda_id;
  return true;
end $$;

create or replace function public.pedir_dissolucao_cla(
  p_id_jogo text, p_senha text, p_guilda_id uuid, p_motivo text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.lider_do_cla(p_id_jogo, p_senha, p_guilda_id) then return false; end if;
  update public.guildas
     set dissolucao_pedida_em = now(), dissolucao_motivo = coalesce(p_motivo, ''),
         atualizado_em = now()
   where id = p_guilda_id;
  return true;
end $$;

-- O Hold enxerga os clãs reconhecidos; o líder enxerga também o seu,
-- ainda que pendente ou recusado.
create or replace function public.clas_do_hold()
returns setof public.guildas
language sql stable security definer set search_path = public as $$
  select * from public.guildas where situacao = 'Aprovado';
$$;

create or replace function public.meu_cla(p_id_jogo text, p_senha text)
returns setof public.guildas
language sql stable security definer set search_path = public as $$
  select g.* from public.guildas g
  join public.civis c
    on lower(c.id_jogo) = lower(trim(p_id_jogo))
   and c.status = 'Aprovado'
   and public.senha_igual(c.senha_acesso, p_senha)
  where g.lider_civil_id = c.id
     or g.membros @> jsonb_build_array(jsonb_build_object('civil_id', c.id::text));
$$;

-- As licenças que valem para o morador: as dele e as do clã dele.
create or replace function public.minhas_licencas(p_id_jogo text, p_senha text)
returns setof public.licencas
language sql stable security definer set search_path = public as $$
  select l.* from public.licencas l
  join public.civis c
    on lower(c.id_jogo) = lower(trim(p_id_jogo))
   and c.status = 'Aprovado'
   and public.senha_igual(c.senha_acesso, p_senha)
  where l.civil_id = c.id
     or (l.titular_tipo = 'guilda' and l.guilda_id in (
           select g.id from public.guildas g
            where g.situacao = 'Aprovado'
              and (g.lider_civil_id = c.id
                or g.membros @> jsonb_build_array(jsonb_build_object('civil_id', c.id::text)))));
$$;

revoke all on function public.lider_do_cla(text, text, uuid) from public;
revoke all on function public.registrar_cla(text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.reenviar_cla(text, text, uuid, text, text, text, text, text, text, text) from public;
revoke all on function public.salvar_cla_lider(text, text, uuid, text, text, jsonb, uuid) from public;
revoke all on function public.pedir_dissolucao_cla(text, text, uuid, text) from public;
revoke all on function public.meu_cla(text, text) from public;
revoke all on function public.minhas_licencas(text, text) from public;
grant execute on function public.registrar_cla(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.reenviar_cla(text, text, uuid, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.salvar_cla_lider(text, text, uuid, text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.pedir_dissolucao_cla(text, text, uuid, text) to anon, authenticated;
grant execute on function public.clas_do_hold() to anon, authenticated;
grant execute on function public.meu_cla(text, text) to anon, authenticated;
grant execute on function public.minhas_licencas(text, text) to anon, authenticated;

revoke all on function public.dono_do_imovel(text, text, uuid) from public;
revoke all on function public.anunciar_imovel(text, text, uuid, int, text) from public;
revoke all on function public.retirar_anuncio(text, text, uuid) from public;
revoke all on function public.enviar_oferta(text, text, uuid, int, text) from public;
revoke all on function public.retirar_oferta(text, text, uuid) from public;
revoke all on function public.responder_oferta(text, text, uuid, uuid, boolean, text) from public;
revoke all on function public.minhas_ofertas(text, text) from public;
grant execute on function public.anunciar_imovel(text, text, uuid, int, text) to anon, authenticated;
grant execute on function public.retirar_anuncio(text, text, uuid) to anon, authenticated;
grant execute on function public.enviar_oferta(text, text, uuid, int, text) to anon, authenticated;
grant execute on function public.retirar_oferta(text, text, uuid) to anon, authenticated;
grant execute on function public.responder_oferta(text, text, uuid, uuid, boolean, text) to anon, authenticated;
grant execute on function public.imoveis_a_venda() to anon, authenticated;
grant execute on function public.minhas_ofertas(text, text) to anon, authenticated;

revoke all on function public.toca_a_propriedade(text, text, uuid) from public;
revoke all on function public.salvar_propriedade_dono(text, text, uuid, jsonb, jsonb) from public;
revoke all on function public.pedir_compra(text, text, uuid, jsonb, text) from public;
grant execute on function public.salvar_propriedade_dono(text, text, uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.pedir_compra(text, text, uuid, jsonb, text) to anon, authenticated;

revoke all on function public.acesso_cidadao(text, text) from public;
revoke all on function public.salvar_ficha_cidadao(text, text, text, text, text, text, text) from public;
revoke all on function public.salvar_pericias_soldado(text, text, jsonb) from public;
revoke all on function public.salvar_pericias_cidadao(text, text, jsonb) from public;
revoke all on function public.pedir_isencao_cidadania(text, text, text) from public;
grant execute on function public.pedir_isencao_cidadania(text, text, text) to anon, authenticated;
grant execute on function public.salvar_pericias_cidadao(text, text, jsonb) to anon, authenticated;
grant execute on function public.acesso_cidadao(text, text) to anon, authenticated;
grant execute on function public.salvar_ficha_cidadao(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.salvar_pericias_soldado(text, text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 9d. MILÍCIA — a porta do morador
--
--     Divisões e patentes são registro público do Hold: o soldado e o
--     morador precisam enxergá-las para ler a própria ficha, e não há
--     nada de sigiloso nelas. Escrever continua sendo só da Corte.
-- ------------------------------------------------------------
drop policy if exists divisoes_leitura_publica on public.divisoes;
create policy divisoes_leitura_publica on public.divisoes
  for select to anon using (true);

drop policy if exists patentes_leitura_publica on public.patentes;
create policy patentes_leitura_publica on public.patentes
  for select to anon using (true);

-- A convocação e o rol da milícia são chamado público: quem está na
-- lista precisa se ver nela, e quem não está precisa saber que há
-- guerra. Escrever continua sendo só da Corte e das funções abaixo.
drop policy if exists campanhas_leitura_publica on public.campanhas;
create policy campanhas_leitura_publica on public.campanhas
  for select to anon using (true);

drop policy if exists milicia_leitura_publica on public.milicia;
create policy milicia_leitura_publica on public.milicia
  for select to anon using (true);

-- O morador se alista na milícia. Estar na lista não é estar em armas:
-- só marcha quem for convocado.
create or replace function public.alistar_milicia(
  p_id_jogo text, p_senha text, p_notas text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; ja public.milicia%rowtype; novo uuid;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then
    raise exception 'ID ou senha não conferem.';
  end if;

  -- A Corte pode ter inscrito o morador à mão, sem vincular a ficha
  -- civil. Essa linha é dele: adota-se, não se cria outra.
  select * into ja from public.milicia
   where civil_id = eu.id
      or (civil_id is null and lower(trim(nome)) = lower(trim(eu.nome)))
   order by (civil_id is not null) desc
   limit 1;
  if ja.id is not null and ja.situacao <> 'Dispensado' then
    raise exception 'Você já está na lista da milícia.';
  end if;
  if ja.id is not null then
    update public.milicia
       set civil_id = eu.id, id_jogo = eu.id_jogo,
           situacao = 'Disponível', campanha_id = null, campanha_nome = '',
           convocado_em = null, pago_em = null, pago_valor = null,
           notas = coalesce(nullif(trim(p_notas), ''), notas)
     where id = ja.id;
    return ja.id;
  end if;

  insert into public.milicia (nome, civil_id, id_jogo, raca, situacao, notas)
  values (eu.nome, eu.id, eu.id_jogo, eu.raca, 'Disponível', coalesce(trim(p_notas), ''))
  returning id into novo;
  return novo;
end $$;

-- Sair da lista — mas não no meio de uma campanha.
create or replace function public.sair_milicia(p_id_jogo text, p_senha text)
returns boolean language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; meu public.milicia%rowtype;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then
    raise exception 'ID ou senha não conferem.';
  end if;
  select * into meu from public.milicia
   where civil_id = eu.id
      or (civil_id is null and lower(trim(nome)) = lower(trim(eu.nome)))
   order by (civil_id is not null) desc
   limit 1;
  if meu.id is null then
    raise exception 'Você não está na lista da milícia.';
  end if;
  if meu.situacao = 'Convocado' then
    raise exception 'Você está convocado para uma campanha. Fale com o Lorde Comandante antes de sair.';
  end if;
  delete from public.milicia where id = meu.id;
  return true;
end $$;

-- A própria inscrição, e a campanha aberta, para a tela do morador.
create or replace function public.minha_milicia(p_id_jogo text, p_senha text)
returns setof public.milicia language sql stable security definer set search_path = public as $$
  select m.* from public.milicia m
    join public.civis c on c.id = m.civil_id
   where lower(c.id_jogo) = lower(trim(p_id_jogo))
     and c.status = 'Aprovado'
     and public.senha_igual(c.senha_acesso, p_senha);
$$;

-- A campanha aberta é pública: quem está na milícia precisa saber que
-- há um chamado de pé.
create or replace function public.campanha_aberta()
returns setof public.campanhas language sql stable security definer set search_path = public as $$
  select * from public.campanhas where status <> 'Encerrada' order by aberta_em desc limit 1;
$$;

revoke all on function public.alistar_milicia(text, text, text) from public;
revoke all on function public.sair_milicia(text, text) from public;
revoke all on function public.minha_milicia(text, text) from public;
revoke all on function public.campanha_aberta() from public;
grant execute on function public.alistar_milicia(text, text, text) to anon, authenticated;
grant execute on function public.sair_milicia(text, text) to anon, authenticated;
grant execute on function public.minha_milicia(text, text) to anon, authenticated;
grant execute on function public.campanha_aberta() to anon, authenticated;

-- ------------------------------------------------------------
-- 9e. COBRANÇAS — a porta do morador
--
--     A tabela de preços é pública: o morador tem direito de saber
--     quanto custa uma licença antes de pedir. As cobranças, ele
--     enxerga as próprias — as dele, as das propriedades no nome
--     dele e as da casa que chefia — pela função abaixo.
--
--     Declarar é dizer "paguei no jogo". Quem confirma é sempre a
--     Corte: o morador não tem caminho nenhum para marcar a própria
--     dívida como paga, nem para mexer no livro-caixa.
-- ------------------------------------------------------------
drop policy if exists precos_leitura_publica on public.precos;
create policy precos_leitura_publica on public.precos
  for select to anon using (true);

/** As cobranças que caem no colo deste morador. */
create or replace function public.minhas_cobrancas(p_id_jogo text, p_senha text)
returns setof public.cobrancas language sql stable security definer set search_path = public as $$
  with eu as (
    select id, nome from public.civis
     where lower(id_jogo) = lower(trim(p_id_jogo))
       and status = 'Aprovado'
       and public.senha_igual(senha_acesso, p_senha)
  )
  select c.* from public.cobrancas c, eu
   where (c.devedor_tipo = 'civil' and c.devedor_id = eu.id)
      or (c.devedor_tipo = 'propriedade' and c.devedor_id in (
            select p.id from public.propriedades p where p.proprietario_civil_id = eu.id))
      or (c.devedor_tipo = 'casa' and c.devedor_id in (
            select k.id from public.clas k where k.lider_civil_id = eu.id));
$$;

/** O morador declara que pagou. Só isso — a baixa é da Corte. */
create or replace function public.declarar_pagamento(
  p_id_jogo text, p_senha text, p_cobranca_id uuid, p_nota text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare eu public.civis%rowtype; alvo public.cobrancas%rowtype; minha boolean;
begin
  select * into eu from public.civis
   where lower(id_jogo) = lower(trim(p_id_jogo))
     and status = 'Aprovado'
     and public.senha_igual(senha_acesso, p_senha);
  if eu.id is null then
    raise exception 'ID ou senha não conferem.';
  end if;

  select * into alvo from public.cobrancas where id = p_cobranca_id;
  if alvo.id is null then
    raise exception 'Esta cobrança não está mais nos arquivos da Corte.';
  end if;

  -- A cobrança é dele, da propriedade dele ou da casa que ele chefia.
  minha := (alvo.devedor_tipo = 'civil' and alvo.devedor_id = eu.id)
        or (alvo.devedor_tipo = 'propriedade' and exists (
              select 1 from public.propriedades p
               where p.id = alvo.devedor_id and p.proprietario_civil_id = eu.id))
        or (alvo.devedor_tipo = 'casa' and exists (
              select 1 from public.clas k
               where k.id = alvo.devedor_id and k.lider_civil_id = eu.id));
  if not minha then
    raise exception 'Esta cobrança não é sua.';
  end if;

  if alvo.status = 'Paga' then raise exception 'Esta cobrança já foi quitada.'; end if;
  if alvo.status = 'Cancelada' then raise exception 'Esta cobrança foi cancelada pela Corte.'; end if;
  if alvo.status = 'Pagamento declarado' then
    raise exception 'Você já declarou o pagamento — a Corte ainda vai conferir.';
  end if;

  update public.cobrancas
     set status = 'Pagamento declarado',
         declarado_em = now(),
         declarado_nota = coalesce(trim(p_nota), '')
   where id = alvo.id;
  return true;
end $$;

revoke all on function public.minhas_cobrancas(text, text) from public;
revoke all on function public.declarar_pagamento(text, text, uuid, text) from public;
grant execute on function public.minhas_cobrancas(text, text) to anon, authenticated;
grant execute on function public.declarar_pagamento(text, text, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 11. CONVITES DE DIVISÃO (Quartel / Exército)
-- ------------------------------------------------------------
create table if not exists public.convites_divisao (
  id            uuid primary key default gen_random_uuid(),
  divisao_id    text not null,
  divisao_nome  text not null,
  guarda_id     text not null,
  guarda_nome   text not null,
  civil_id      text default '',
  id_jogo       text default '',
  remetente_id  text default '',
  remetente_nome text not null,
  remetente_cargo text default 'Capitão',
  mensagem      text default '',
  status        text not null default 'Pendente'
                check (status in ('Pendente','Aceito','Recusado','Cancelado')),
  respondido_em timestamptz,
  cancelado_em  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists convites_div_idx on public.convites_divisao(divisao_id);
create index if not exists convites_guarda_idx on public.convites_divisao(guarda_id);
create index if not exists convites_status_idx on public.convites_divisao(status);

-- ------------------------------------------------------------
-- 12. MISSÕES DO EXÉRCITO (Quartel / Exército)
-- ------------------------------------------------------------
create table if not exists public.missoes_exercito (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null,
  titulo        text not null,
  descricao     text not null,
  objetivo      text not null,
  divisao_id    text,
  divisao_nome  text,
  emissor_id    text default '',
  emissor_nome  text not null,
  emissor_cargo text default '',
  prazo         text,
  recompensa    int not null default 0,
  tipo_recompensa text not null default 'por_participante'
                check (tipo_recompensa in ('por_participante','total_dividido')),
  visibilidade  text not null default 'exercito'
                check (visibilidade in ('exercito','divisao')),
  inscricao     text not null default 'aberta'
                check (inscricao in ('aberta','divisao')),
  vagas         int not null default 0,
  status        text not null default 'Aberta'
                check (status in ('Aberta','Em andamento','Concluída','Cancelada')),
  participantes jsonb not null default '[]'::jsonb,
  relatorio     text default '',
  recompensa_paga int default 0,
  concluida_em  timestamptz,
  concluida_por text,
  cancelada_em  timestamptz,
  cancelada_por text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists missoes_div_idx on public.missoes_exercito(divisao_id);
create index if not exists missoes_status_idx on public.missoes_exercito(status);

-- ------------------------------------------------------------
-- 10. Timestamps automáticos
-- ------------------------------------------------------------
create or replace function public.touch()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['civis','clas','corte','guardas','divisoes','patentes','milicia','campanhas','cofre','cobrancas','precos','prisoes','movimentos','trabalhadores','pedidos_dinastia','avisos','pedidos_compra','editais','propostas','propriedades','assentamentos','licencas','convites_divisao','missoes_exercito']
  loop
    execute format('drop trigger if exists %I_touch on public.%I;', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch();', t, t);
  end loop;
end $$;

-- ============================================================
--  PRIMEIRO ACESSO
--  1. Authentication → Users → Add user (e-mail + senha) para cada
--     membro da Corte. Nada de auto-cadastro: desligue "Enable signup".
--  2. Copie o UUID do usuário e rode:
--
--     insert into public.perfis (id, nome, cargo, papel)
--     values ('<uuid-do-usuario>', 'Laila Law-Giver', 'Jarl', 'jarl');
--
--  3. Rode supabase/seed.sql para carregar os registros da planilha.
--
--  O REGISTRO CIVIL é público por desenho: qualquer visitante pode enviar
--  um pedido, mas ninguém de fora da Corte consegue ler, editar ou apagar
--  a lista. Se um dia aparecer envio em massa, basta remover a política
--  'civis_envio_publico' — o cadastro passa a ser só pela Corte.
-- ============================================================
