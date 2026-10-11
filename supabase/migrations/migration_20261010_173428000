-- ============================================================
-- Gestão de Confinamento Bovino — schema base
-- ============================================================

-- Fazenda (registro único de configuração)
create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text,
  created_at timestamptz not null default now()
);

-- Perfis de acesso (gestor | operador)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'operador' check (role in ('gestor','operador')),
  created_at timestamptz not null default now()
);

alter table public.farms enable row level security;
alter table public.profiles enable row level security;

-- Checagem de papel no servidor (security definer evita recursão de RLS)
create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'gestor'
  );
$$;

-- Cria o perfil no cadastro do usuário; o primeiro usuário do sistema é gestor
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    case when (select count(*) from public.profiles) = 0 then 'gestor' else 'operador' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Só gestor altera papéis; usuário comum não promove a si mesmo
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_gestor() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Currais
create table public.pens (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  capacity_head integer not null default 100 check (capacity_head > 0),
  area_m2 numeric(10,2),
  status text not null default 'vazio' check (status in ('ativo','vazio','manutencao','adaptacao')),
  notes text,
  created_at timestamptz not null default now()
);

-- Dietas e ingredientes
create table public.diets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dry_matter_pct numeric(5,2) check (dry_matter_pct is null or (dry_matter_pct > 0 and dry_matter_pct <= 100)),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.diet_items (
  id uuid primary key default gen_random_uuid(),
  diet_id uuid not null references public.diets(id) on delete cascade,
  ingredient text not null,
  kg_per_head_day numeric(8,3) not null default 0 check (kg_per_head_day >= 0)
);

-- Protocolos sanitários de entrada
create table public.protocols (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.protocol_items (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  kind text not null default 'vacina' check (kind in ('vacina','vermifugo','outro')),
  product text not null,
  dose text,
  withdrawal_days integer not null default 0 check (withdrawal_days >= 0)
);

-- Lotes
create table public.lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  origin text,
  entry_date date not null default current_date,
  breed text,
  category text check (category in ('bezerro','garrote','novilho','novilha','boi','vaca')),
  head_count integer not null default 0 check (head_count >= 0),
  entry_avg_weight_kg numeric(7,2) not null default 0,
  target_weight_kg numeric(7,2) not null default 520,
  pen_id uuid references public.pens(id) on delete set null,
  diet_id uuid references public.diets(id) on delete set null,
  protocol_id uuid references public.protocols(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo','encerrado')),
  notes text,
  created_at timestamptz not null default now()
);

-- Animais (registro individual vinculado ao lote/curral)
create table public.animals (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.lots(id) on delete set null,
  pen_id uuid references public.pens(id) on delete set null,
  ear_tag text not null unique,
  sisbov text unique,
  breed text,
  sex text check (sex in ('macho','femea')),
  entry_weight_kg numeric(7,2),
  current_weight_kg numeric(7,2),
  status text not null default 'ativo' check (status in ('ativo','tratamento','abatido','vendido','morto')),
  health_status text not null default 'saudavel' check (health_status in ('saudavel','tratamento','observacao','carencia')),
  withdrawal_until date,
  notes text,
  created_at timestamptz not null default now()
);

-- Pesagens (sessão) e pesos individuais
create table public.weighings (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.lots(id) on delete cascade,
  pen_id uuid references public.pens(id) on delete set null,
  date date not null default current_date,
  kind text not null default 'amostral' check (kind in ('amostral','lote_completo','individual')),
  head_count_weighed integer not null default 0 check (head_count_weighed >= 0),
  avg_weight_kg numeric(7,2) not null check (avg_weight_kg > 0),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.weight_records (
  id uuid primary key default gen_random_uuid(),
  weighing_id uuid not null references public.weighings(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  weight_kg numeric(7,2) not null check (weight_kg > 0)
);

-- Trato diário
create table public.feed_logs (
  id uuid primary key default gen_random_uuid(),
  pen_id uuid not null references public.pens(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  date date not null default current_date,
  shift text not null default 'manha' check (shift in ('manha','tarde','noite')),
  diet_id uuid references public.diets(id) on delete set null,
  head_count integer not null default 0 check (head_count >= 0),
  kg_per_head numeric(8,3) not null default 0 check (kg_per_head >= 0),
  total_kg numeric(10,2) not null default 0 check (total_kg >= 0),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Leitura de cocho (score 0-5)
create table public.trough_readings (
  id uuid primary key default gen_random_uuid(),
  pen_id uuid not null references public.pens(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  date date not null default current_date,
  score integer not null check (score between 0 and 5),
  leftover_kg numeric(8,2) check (leftover_kg is null or leftover_kg >= 0),
  adjustment_pct numeric(6,2) not null default 0,
  adjustment_kg numeric(8,3) not null default 0,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Eventos sanitários (protocolo, vacina, tratamento, óbito)
create table public.health_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid references public.animals(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  pen_id uuid references public.pens(id) on delete set null,
  kind text not null default 'tratamento' check (kind in ('protocolo','vacina','tratamento','obito')),
  product text,
  dose text,
  diagnosis text,
  event_date date not null default current_date,
  withdrawal_until date,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Índices de consulta
create index lots_pen_idx on public.lots(pen_id);
create index animals_lot_idx on public.animals(lot_id);
create index animals_pen_idx on public.animals(pen_id);
create index animals_status_idx on public.animals(status);
create index weighings_lot_idx on public.weighings(lot_id, date desc);
create index weight_records_weighing_idx on public.weight_records(weighing_id);
create index feed_logs_date_idx on public.feed_logs(date desc);
create index feed_logs_pen_idx on public.feed_logs(pen_id);
create index trough_readings_pen_idx on public.trough_readings(pen_id, date desc);
create index diet_items_diet_idx on public.diet_items(diet_id);
create index protocol_items_protocol_idx on public.protocol_items(protocol_id);
create index health_events_lot_idx on public.health_events(lot_id, event_date desc);

-- RLS: dados operacionais — qualquer usuário autenticado lê e registra
-- RLS: cadastros — escrita apenas para gestor

-- farms
create policy farms_select on public.farms for select to authenticated using (true);
create policy farms_insert on public.farms for insert to authenticated with check (public.is_gestor());
create policy farms_update on public.farms for update to authenticated using (public.is_gestor()) with check (public.is_gestor());

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id or public.is_gestor()) with check (auth.uid() = id or public.is_gestor());

-- pens
create policy pens_select on public.pens for select to authenticated using (true);
create policy pens_insert on public.pens for insert to authenticated with check (public.is_gestor());
create policy pens_update on public.pens for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy pens_delete on public.pens for delete to authenticated using (public.is_gestor());

-- diets / diet_items
create policy diets_select on public.diets for select to authenticated using (true);
create policy diets_insert on public.diets for insert to authenticated with check (public.is_gestor());
create policy diets_update on public.diets for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy diets_delete on public.diets for delete to authenticated using (public.is_gestor());

create policy diet_items_select on public.diet_items for select to authenticated using (true);
create policy diet_items_insert on public.diet_items for insert to authenticated with check (public.is_gestor());
create policy diet_items_update on public.diet_items for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy diet_items_delete on public.diet_items for delete to authenticated using (public.is_gestor());

-- protocols / protocol_items
create policy protocols_select on public.protocols for select to authenticated using (true);
create policy protocols_insert on public.protocols for insert to authenticated with check (public.is_gestor());
create policy protocols_update on public.protocols for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy protocols_delete on public.protocols for delete to authenticated using (public.is_gestor());

create policy protocol_items_select on public.protocol_items for select to authenticated using (true);
create policy protocol_items_insert on public.protocol_items for insert to authenticated with check (public.is_gestor());
create policy protocol_items_update on public.protocol_items for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy protocol_items_delete on public.protocol_items for delete to authenticated using (public.is_gestor());

-- lots
create policy lots_select on public.lots for select to authenticated using (true);
create policy lots_insert on public.lots for insert to authenticated with check (true);
create policy lots_update on public.lots for update to authenticated using (true) with check (true);

-- animals
create policy animals_select on public.animals for select to authenticated using (true);
create policy animals_insert on public.animals for insert to authenticated with check (true);
create policy animals_update on public.animals for update to authenticated using (true) with check (true);

-- weighings / weight_records
create policy weighings_select on public.weighings for select to authenticated using (true);
create policy weighings_insert on public.weighings for insert to authenticated with check (true);
create policy weighings_update on public.weighings for update to authenticated using (true) with check (true);
create policy weighings_delete on public.weighings for delete to authenticated using (true);

create policy weight_records_select on public.weight_records for select to authenticated using (true);
create policy weight_records_insert on public.weight_records for insert to authenticated with check (true);
create policy weight_records_delete on public.weight_records for delete to authenticated using (true);

-- feed_logs
create policy feed_logs_select on public.feed_logs for select to authenticated using (true);
create policy feed_logs_insert on public.feed_logs for insert to authenticated with check (true);
create policy feed_logs_update on public.feed_logs for update to authenticated using (true) with check (true);
create policy feed_logs_delete on public.feed_logs for delete to authenticated using (true);

-- trough_readings
create policy trough_readings_select on public.trough_readings for select to authenticated using (true);
create policy trough_readings_insert on public.trough_readings for insert to authenticated with check (true);
create policy trough_readings_update on public.trough_readings for update to authenticated using (true) with check (true);
create policy trough_readings_delete on public.trough_readings for delete to authenticated using (true);

-- health_events
create policy health_events_select on public.health_events for select to authenticated using (true);
create policy health_events_insert on public.health_events for insert to authenticated with check (true);
create policy health_events_update on public.health_events for update to authenticated using (true) with check (true);
create policy health_events_delete on public.health_events for delete to authenticated using (true);

-- Dados de configuração inicial
insert into public.farms (name, city, state) values ('Fazenda Santa Rita', 'Água Boa', 'MT');
