-- CauriPay : base de données Supabase.
-- À exécuter une seule fois : Supabase → SQL Editor → New query → colle ce fichier → Run.

-- Une ligne par utilisateur, qui contient toutes ses données (budget, épargne, envies, expéditeurs, demandes).
create table if not exists public.cauripay_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Sécurité : chaque personne ne peut lire et modifier que sa propre ligne.
alter table public.cauripay_data enable row level security;

drop policy if exists "lire ses données" on public.cauripay_data;
create policy "lire ses données" on public.cauripay_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "créer ses données" on public.cauripay_data;
create policy "créer ses données" on public.cauripay_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "modifier ses données" on public.cauripay_data;
create policy "modifier ses données" on public.cauripay_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "supprimer ses données" on public.cauripay_data;
create policy "supprimer ses données" on public.cauripay_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Droit à l'effacement (RGPD, article 17) : le bouton « Supprimer mon compte » appelle cette fonction.
-- Elle supprime le compte de la personne connectée ; ses données partent avec (on delete cascade).
-- Attention : le jour où de vrais transferts d'argent passent par CauriPay, les justificatifs exigés par la
-- lutte contre le blanchiment doivent être conservés 5 ans. Il faudra alors archiver avant de supprimer.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'non connecté';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
