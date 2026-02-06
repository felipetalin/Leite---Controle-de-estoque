create extension if not exists pgcrypto;

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists milk_movements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  data date not null,
  volume_ml integer not null,
  quantidade_sacos integer not null,
  local text,
  data_ordenha date,
  validade date,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_members_user on family_members(user_id);
create index if not exists idx_family_members_family on family_members(family_id);
create index if not exists idx_milk_movements_family_created on milk_movements(family_id, created_at);

alter table families enable row level security;
alter table family_members enable row level security;
alter table milk_movements enable row level security;

create policy "families_select_member"
  on families for select
  using (
    exists (
      select 1 from family_members fm
      where fm.family_id = families.id and fm.user_id = auth.uid()
    )
  );

create policy "families_insert_owner"
  on families for insert
  with check (created_by = auth.uid());

create policy "family_members_select_self"
  on family_members for select
  using (user_id = auth.uid());

create policy "family_members_insert_self"
  on family_members for insert
  with check (user_id = auth.uid());

create policy "milk_movements_select_family"
  on milk_movements for select
  using (
    exists (
      select 1 from family_members fm
      where fm.family_id = milk_movements.family_id
        and fm.user_id = auth.uid()
    )
  );

create policy "milk_movements_insert_family"
  on milk_movements for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from family_members fm
      where fm.family_id = milk_movements.family_id
        and fm.user_id = auth.uid()
    )
  );

create or replace function join_family_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select id into v_family_id from families where code = p_code;
  if v_family_id is null then
    raise exception 'Família não encontrada';
  end if;

  insert into family_members (family_id, user_id)
  values (v_family_id, auth.uid())
  on conflict do nothing;

  return v_family_id;
end;
$$;

revoke all on function join_family_by_code(text) from public;
grant execute on function join_family_by_code(text) to authenticated;
