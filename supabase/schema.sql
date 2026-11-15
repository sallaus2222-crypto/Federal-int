-- Federal Intelligence: esquema inicial
create extension if not exists pgcrypto;

create table if not exists public.concursos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique check (numero > 0),
  data_concurso date not null,
  fonte text not null default 'CAIXA',
  fonte_url text,
  coletado_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.premios (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos(id) on delete cascade,
  posicao smallint not null check (posicao between 1 and 5),
  bilhete char(5) not null check (bilhete ~ '^[0-9]{5}$'),
  unique (concurso_id, posicao)
);

create table if not exists public.analises (
  id uuid primary key default gen_random_uuid(),
  janela_inicio integer,
  janela_fim integer,
  quantidade_concursos integer not null,
  dados jsonb not null,
  calculado_em timestamptz not null default now()
);

create table if not exists public.sugestoes (
  id uuid primary key default gen_random_uuid(),
  analise_id uuid references public.analises(id) on delete cascade,
  categoria text not null check (categoria in ('terminacao','centena','milhar')),
  valor text not null,
  ocorrencias integer not null,
  amostra integer not null,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.coletas (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('sucesso','sem_novidade','falha')),
  mensagem text,
  concursos_novos integer not null default 0,
  executado_em timestamptz not null default now()
);

create index if not exists idx_concursos_data on public.concursos(data_concurso desc);
create index if not exists idx_premios_concurso on public.premios(concurso_id, posicao);

alter table public.concursos enable row level security;
alter table public.premios enable row level security;
alter table public.analises enable row level security;
alter table public.sugestoes enable row level security;
alter table public.coletas enable row level security;

-- Leitura pública apenas dos dados estatísticos/resultados publicados.
create policy "Leitura publica de concursos" on public.concursos for select to anon, authenticated using (true);
create policy "Leitura publica de premios" on public.premios for select to anon, authenticated using (true);
create policy "Leitura publica de analises" on public.analises for select to anon, authenticated using (true);
create policy "Leitura publica de sugestoes" on public.sugestoes for select to anon, authenticated using (true);
create policy "Leitura publica de coletas" on public.coletas for select to anon, authenticated using (true);

-- Escritas são feitas somente pela Edge Function com service role.
-- Não crie políticas de INSERT/UPDATE/DELETE para anon.
