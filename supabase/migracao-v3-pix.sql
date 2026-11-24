-- tek4ll · migração v3: pagamento via Pix (manual)
-- Rode no SQL Editor do Supabase depois da migracao-v2.sql.
alter table public.assinaturas add column if not exists valido_ate timestamptz;
alter table public.assinaturas add column if not exists reembolso_pix text;
alter table public.assinaturas drop constraint if exists assinaturas_metodo_check;
alter table public.assinaturas add constraint assinaturas_metodo_check check (metodo in ('pix','cartao'));
