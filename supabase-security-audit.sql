-- MON POINTAGE V8
-- Audit / durcissement RLS à exécuter dans Supabase SQL Editor uniquement après vérification du schéma.
-- Objectif : empêcher un utilisateur authentifié de lire ou modifier les données d'un autre utilisateur.

begin;

alter table public."POINTAGES" enable row level security;
alter table public."APP_DATA" enable row level security;

revoke all on table public."POINTAGES" from anon;
revoke all on table public."APP_DATA" from anon;

grant select, insert, update, delete on table public."POINTAGES" to authenticated;
grant select, insert, update, delete on table public."APP_DATA" to authenticated;

drop policy if exists "pointages_select_own" on public."POINTAGES";
drop policy if exists "pointages_insert_own" on public."POINTAGES";
drop policy if exists "pointages_update_own" on public."POINTAGES";
drop policy if exists "pointages_delete_own" on public."POINTAGES";

create policy "pointages_select_own"
on public."POINTAGES"
for select
to authenticated
using (auth.uid() = user_id);

create policy "pointages_insert_own"
on public."POINTAGES"
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pointages_update_own"
on public."POINTAGES"
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pointages_delete_own"
on public."POINTAGES"
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_data_select_own" on public."APP_DATA";
drop policy if exists "app_data_insert_own" on public."APP_DATA";
drop policy if exists "app_data_update_own" on public."APP_DATA";
drop policy if exists "app_data_delete_own" on public."APP_DATA";

create policy "app_data_select_own"
on public."APP_DATA"
for select
to authenticated
using (auth.uid() = user_id);

create policy "app_data_insert_own"
on public."APP_DATA"
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "app_data_update_own"
on public."APP_DATA"
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "app_data_delete_own"
on public."APP_DATA"
for delete
to authenticated
using (auth.uid() = user_id);

commit;
