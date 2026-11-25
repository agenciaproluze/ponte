-- tek4ll · migração v4: blog público com colunistas, editores e agendamento
-- Rode no SQL Editor do Supabase depois das migrações anteriores.

-- Quem escreve: colunistas (escrevem), editores (aprovam), admin (convida e gerencia)
create table if not exists public.autores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_publico text not null,
  papel text not null check (papel in ('colunista','editor','admin')),
  bio text,
  criado_em timestamptz not null default now()
);

-- Posts do blog
create table if not exists public.posts (
  id bigserial primary key,
  slug text unique not null,
  titulo text not null,
  resumo text not null default '',
  corpo text not null default '',
  imagem_url text,
  tema text,
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  status text not null default 'rascunho' check (status in ('rascunho','revisao','publicado')),
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists posts_publico_idx on public.posts(status, publicado_em desc);

alter table public.autores enable row level security;
alter table public.posts enable row level security;

-- Público lê apenas posts publicados cuja data de publicação já chegou (agendamento)
create policy "posts: leitura pública" on public.posts
  for select to anon, authenticated
  using (status = 'publicado' and publicado_em <= now());

-- Cada autor vê o próprio registro; escrita só pelo servidor
create policy "autores: ler o próprio" on public.autores
  for select using (auth.uid() = user_id);

-- Imagens do blog: bucket público só para leitura
insert into storage.buckets (id, name, public) values ('blog', 'blog', true)
  on conflict (id) do nothing;
