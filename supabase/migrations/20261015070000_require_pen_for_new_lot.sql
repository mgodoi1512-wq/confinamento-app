-- Novos lotes exigem curral. Lotes antigos não são alterados.
begin;
create or replace function public.require_pen_for_new_lot()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.pen_id is null then
  raise exception 'Selecione um curral antes de criar o lote. Cadastre pelo menos um curral na sua fazenda.';
 end if;
 return new;
end $$;
revoke all on function public.require_pen_for_new_lot() from public,anon,authenticated;
drop trigger if exists require_pen_for_new_lot on public.lots;
create trigger require_pen_for_new_lot before insert on public.lots
for each row execute function public.require_pen_for_new_lot();
commit;
select true as curral_obrigatorio_para_novos_lotes;
