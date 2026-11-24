-- tek4ll · migração v2: avatar da IA, aprovação dos responsáveis, conversas, sinalizações,
-- relatórios de moderação e fichas de profissionais.
-- Rode no SQL Editor do Supabase depois do schema.sql.

-- Avatar e nome da IA escolhidos pela pessoa
create table if not exists public.avatares (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_ia text not null default 'Ponte IA',
  genero text not null default 'neutro' check (genero in ('menina','menino','neutro')),
  cabelo text not null default 'curto' check (cabelo in ('curto','medio','longo','cacheado','liso')),
  roupa text not null default 'camiseta' check (roupa in ('camiseta','moletom','jaqueta','jaleco')),
  cor text not null default '#c6ff00' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  atualizado_em timestamptz not null default now()
);

-- Aprovação do responsável para menores conversarem com a IA
create table if not exists public.aprovacoes_responsavel (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_responsavel text not null,
  token_hash text not null,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  revogado_em timestamptz
);

-- Mensagens da conversa com a IA (retenção: ver política de privacidade)
create table if not exists public.conversas (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('usuario','ia')),
  conteudo text not null,
  criado_em timestamptz not null default now()
);
create index if not exists conversas_user_idx on public.conversas(user_id, criado_em);

-- Sinalizações automáticas e de moderação
create table if not exists public.sinalizacoes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  gravidade text not null check (gravidade in ('baixa','media','alta','critica')),
  motivo text not null,
  trecho text,
  status text not null default 'pendente' check (status in ('pendente','em_analise','encaminhada','arquivada')),
  criado_em timestamptz not null default now(),
  tratado_por text,
  tratado_em timestamptz
);

-- Relatórios diários de moderação
create table if not exists public.relatorios (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  resumo text not null,
  gerado_em timestamptz not null default now(),
  unique (user_id, dia)
);

-- Fichas de profissionais interessados em lecionar ou publicar cursos
create table if not exists public.fichas_profissionais (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  email text not null,
  area text not null,
  formacao text,
  interesse text not null check (interesse in ('professor','publicar_curso','ambos')),
  portfolio text,
  mensagem text,
  status text not null default 'nova' check (status in ('nova','em_contato','aprovada','recusada')),
  criado_em timestamptz not null default now()
);

-- Segurança: ativar RLS em tudo. Só o servidor (service_role) escreve nessas tabelas.
alter table public.avatares enable row level security;
alter table public.aprovacoes_responsavel enable row level security;
alter table public.conversas enable row level security;
alter table public.sinalizacoes enable row level security;
alter table public.relatorios enable row level security;
alter table public.fichas_profissionais enable row level security;

-- Cada pessoa lê e altera apenas o próprio avatar
create policy "avatar: ler o próprio" on public.avatares for select using (auth.uid() = user_id);
create policy "avatar: criar o próprio" on public.avatares for insert with check (auth.uid() = user_id);
create policy "avatar: atualizar o próprio" on public.avatares for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cada pessoa lê as próprias conversas e os próprios relatórios (escrita só pelo servidor)
create policy "conversas: ler as próprias" on public.conversas for select using (auth.uid() = user_id);
create policy "relatorios: ler os próprios" on public.relatorios for select using (auth.uid() = user_id);

-- Assinaturas (ativadas pelo webhook do Mercado Pago)
create table if not exists public.assinaturas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plano text not null check (plano in ('comunidade','ao-vivo')),
  metodo text not null check (metodo in ('pix','cartao')),
  status text not null default 'pendente' check (status in ('pendente','ativa','cancelada')),
  ultimo_pagamento timestamptz,
  mp_pagamento_id text,
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
create policy "assinatura: ler a própria" on public.assinaturas for select using (auth.uid() = user_id);
