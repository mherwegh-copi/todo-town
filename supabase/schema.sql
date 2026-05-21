-- Schéma Supabase pour todo-town. À exécuter dans le SQL Editor du projet Supabase.
-- L'authentification anonyme doit être activée : Authentication > Providers > Anonymous.

create table if not exists public.todos (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  -- PK composite : les id de todo (todo-<ts>-<n>) ne sont uniques que par
  -- navigateur. Sans user_id dans la clé, deux comptes peuvent entrer en
  -- collision et perdre des todos en silence à l'upsert.
  primary key (user_id, id)
);
alter table public.todos enable row level security;
create policy "todos owner access" on public.todos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.game_states (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at bigint not null
);
alter table public.game_states enable row level security;
create policy "game_states owner access" on public.game_states
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  sort_mode text not null,
  done_collapsed boolean not null default false,
  daily_goal integer not null,
  updated_at bigint not null
);
alter table public.preferences enable row level security;
create policy "preferences owner access" on public.preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
