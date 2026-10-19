begin;
create table if not exists public.inventory_equipment (
 id uuid primary key,farm_id uuid not null references public.farms(id),name text not null check(length(btrim(name)) between 1 and 150),
 quantity integer not null check(quantity between 1 and 100000),acquisition_date date not null,
 unit_value numeric(16,2) not null check(unit_value>=0 and unit_value<=999999999999),
 manufacture_year integer check(manufacture_year between 1900 and 9999),invoice_number text not null default '' check(length(invoice_number)<=100),
 status text not null default 'ativo' check(status in ('ativo','baixado')),notes text not null default '' check(length(notes)<=10000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp()
);
create index if not exists inventory_equipment_farm_status on public.inventory_equipment(farm_id,status);
alter table public.inventory_equipment enable row level security;
revoke all on public.inventory_equipment from public,anon,authenticated;
grant select on public.inventory_equipment to authenticated;
drop policy if exists equipment_manager_read on public.inventory_equipment;
create policy equipment_manager_read on public.inventory_equipment for select to authenticated using(farm_id=(select public.current_farm_id()) and (select public.is_gestor()));
create or replace function public.app_equipment(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();ident uuid;old public.inventory_equipment;expected timestamptz;qty numeric;v numeric;acquired date;year_value numeric;label text;invoice text;state text;note text;result jsonb;
begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem acessar máquinas e equipamentos.';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(e) order by lower(e.name),e.id) from public.inventory_equipment e where farm_id=f),'[]'::jsonb);end if;
 if p_action is null or p_action not in ('save','delete') then raise exception 'Operação desconhecida.';end if;
 ident:=(p_payload->>'id')::uuid;if ident is null then raise exception 'Identificador inválido.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 select * into old from public.inventory_equipment where id=ident for update;
 if found and old.farm_id<>f then raise exception 'Equipamento indisponível.';end if;
 expected:=nullif(p_payload->>'expected','')::timestamptz;
 if p_action='delete' then
  if old.id is null then return '{}'::jsonb;end if;
  if old.updated_at is distinct from expected then raise exception 'Equipamento alterado por outro usuário. Recarregue antes de excluir.';end if;
  delete from public.inventory_equipment where id=ident and farm_id=f;return '{}'::jsonb;
 end if;
 label:=btrim(p_payload->>'name');invoice:=btrim(coalesce(p_payload->>'invoice_number',''));state:=p_payload->>'status';note:=coalesce(p_payload->>'notes','');
 if label is null or length(label) not between 1 and 150 or length(invoice)>100 or length(note)>10000 or state is null or state not in ('ativo','baixado') then raise exception 'Confira nome, nota fiscal, situação e observações.';end if;
 if jsonb_typeof(p_payload->'quantity') is distinct from 'number' or jsonb_typeof(p_payload->'unit_value') is distinct from 'number' then raise exception 'Informe quantidade e valor unitário numéricos.';end if;
 qty:=(p_payload->>'quantity')::numeric;v:=(p_payload->>'unit_value')::numeric;
 if qty<>trunc(qty) or qty not between 1 and 100000 or v not between 0 and 999999999999 then raise exception 'Informe quantidade inteira positiva e valor válido, inclusive zero.';end if;
 v:=round(v,2);
 acquired:=(p_payload->>'acquisition_date')::date;
 if acquired is null or to_char(acquired,'YYYY-MM-DD')<>p_payload->>'acquisition_date' or acquired>public.app_today() then raise exception 'Informe uma data de aquisição válida, até hoje.';end if;
 if p_payload->'manufacture_year' is not null and p_payload->'manufacture_year'<>'null'::jsonb then
  if jsonb_typeof(p_payload->'manufacture_year')<>'number' then raise exception 'Ano de fabricação inválido.';end if;
  year_value:=(p_payload->>'manufacture_year')::numeric;
  if year_value<>trunc(year_value) or year_value<1900 or year_value>extract(year from acquired) then raise exception 'O ano de fabricação deve ser entre 1900 e o ano de aquisição.';end if;
 end if;
 if old.id is not null and expected is null and old.name=label and old.quantity=qty and old.unit_value=v and old.acquisition_date=acquired and old.manufacture_year is not distinct from year_value::integer and old.invoice_number=invoice and old.status=state and old.notes=note then return to_jsonb(old);end if;
 if old.updated_at is distinct from expected then raise exception 'Equipamento alterado por outro usuário. Recarregue antes de salvar.';end if;
 insert into public.inventory_equipment(id,farm_id,name,quantity,acquisition_date,unit_value,manufacture_year,invoice_number,status,notes)
 values(ident,f,label,qty::integer,acquired,v,year_value::integer,invoice,state,note)
 on conflict(id) do update set name=excluded.name,quantity=excluded.quantity,acquisition_date=excluded.acquisition_date,unit_value=excluded.unit_value,manufacture_year=excluded.manufacture_year,invoice_number=excluded.invoice_number,status=excluded.status,notes=excluded.notes,updated_at=clock_timestamp()
 returning to_jsonb(inventory_equipment.*) into result;
 return result;
end $$;
revoke all on function public.app_equipment(text,jsonb) from public,anon;
grant execute on function public.app_equipment(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
