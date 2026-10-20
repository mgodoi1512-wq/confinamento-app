begin;

-- Valores legados permanecem válidos e são apresentados como Ativo pela interface.
alter table public.pens drop constraint if exists pens_status_check;
alter table public.pens add constraint pens_status_check
  check (status in ('ativo','vazio','adaptacao','manutencao','inativo'));
alter table public.pens alter column status set default 'ativo';

-- A trava no local serializa a inativação com novas entradas de animais.
create or replace function app_private.guard_inactive_pen() returns trigger
language plpgsql security definer set search_path='' as $$
declare local_status text;
begin
  if tg_table_name='pens' then
    if new.status='inativo' and exists(
      select 1 from public.lots where pen_id=new.id and status='ativo' and head_count>0
    ) then
      raise exception 'Transfira ou registre a saída dos animais antes de inativar o local.';
    end if;
  elsif tg_table_name='lots' then
    if new.status='ativo' and new.head_count>0 and new.pen_id is not null then
      select status into local_status from public.pens where id=new.pen_id for update;
      if local_status='inativo' then raise exception 'Local inativo: escolha um local ativo para alocar os animais.';end if;
    end if;
  elsif tg_table_name='feed_logs' then
    select status into local_status from public.pens where id=new.pen_id for update;
    if local_status='inativo' then raise exception 'Não é possível registrar trato em local inativo.';end if;
  end if;
  return new;
end $$;
revoke all on function app_private.guard_inactive_pen() from public,anon,authenticated;

drop trigger if exists guard_inactive_pen_status on public.pens;
create trigger guard_inactive_pen_status before insert or update of status on public.pens
for each row execute function app_private.guard_inactive_pen();
drop trigger if exists guard_inactive_lot_location on public.lots;
create trigger guard_inactive_lot_location before insert or update of pen_id,status,head_count on public.lots
for each row execute function app_private.guard_inactive_pen();
drop trigger if exists guard_inactive_feed_location on public.feed_logs;
create trigger guard_inactive_feed_location before insert or update of pen_id on public.feed_logs
for each row execute function app_private.guard_inactive_pen();

commit;
