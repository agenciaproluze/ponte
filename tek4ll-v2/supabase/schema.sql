-- tek4ll · esquema inicial do banco (Supabase / PostgreSQL)
-- Rode este arquivo no SQL Editor do Supabase.

-- Perfil público/privado de cada pessoa cadastrada
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  nome_publico text,
  nascimento date,
  menor boolean not null default false,
  temas text[] not null default '{}',
  criado_em timestamptz not null default now()
);

-- Consentimento do responsável (somente servidor acessa)
create table if not exists public.consentimentos_responsavel (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome_responsavel text not null,
  parentesco text,
  email_responsavel text not null,
  cpf_hash text not null,
  assinatura_nome text not null,
  ip text,
  autorizado_em timestamptz not null default now()
);

-- Segurança em nível de linha (RLS)
alter table public.perfis enable row level security;
alter table public.consentimentos_responsavel enable row level security;

drop policy if exists "perfil: ler o próprio" on public.perfis;
create policy "perfil: ler o próprio" on public.perfis
  for select using (auth.uid() = id);

drop policy if exists "perfil: criar o próprio" on public.perfis;
create policy "perfil: criar o próprio" on public.perfis
  for insert with check (auth.uid() = id);

drop policy if exists "perfil: atualizar o próprio" on public.perfis;
create policy "perfil: atualizar o próprio" on public.perfis
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Nenhuma política para consentimentos: só a service_role (servidor) acessa.
