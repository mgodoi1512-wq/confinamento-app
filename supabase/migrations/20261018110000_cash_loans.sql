begin;
alter table public.cash_entries add column if not exists loan_id uuid references public.cash_entries(id) on delete restrict;
alter table public.cash_entries add column if not exists loan_kind text;
alter table public.cash_entries add column if not exists installment_index integer;
alter table public.cash_entries add column if not exists installment_count integer;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='cash_loan_shape' and conrelid='public.cash_entries'::regclass) then
  alter table public.cash_entries add constraint cash_loan_shape check(
   (loan_kind is null and loan_id is null and installment_index is null and installment_count is null)
   or (loan_kind='principal' and loan_id is null and installment_index is null and installment_count is null)
   or (loan_kind='installment' and loan_id is not null and installment_index is not null and installment_count is not null and installment_count between 1 and 360 and installment_index between 1 and installment_count)
   or (loan_kind='amortization' and installment_index is null and installment_count is null));
 end if;
end $$;
create unique index if not exists cash_loan_installment_number on public.cash_entries(farm_id,loan_id,installment_index) where loan_kind='installment';
create or replace function app_private.validate_cash_loan() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.loan_kind='principal' and (new.direction<>'entrada' or new.category<>'Empréstimos') then raise exception 'Mantenha a entrada do empréstimo na categoria Empréstimos.';end if;
 if new.loan_kind in ('installment','amortization') and (new.direction<>'saida' or new.category<>'Empréstimos') then raise exception 'Mantenha esta saída na categoria Empréstimos.';end if;
 if new.loan_id is not null and not exists(select 1 from public.cash_entries where id=new.loan_id and farm_id=new.farm_id and direction='entrada' and category='Empréstimos') then raise exception 'Empréstimo indisponível nesta fazenda.';end if;
 return new;
end $$;
revoke all on function app_private.validate_cash_loan() from public,anon,authenticated,app_farm_executor;
drop trigger if exists validate_cash_loan on public.cash_entries;
create trigger validate_cash_loan before insert or update on public.cash_entries for each row execute function app_private.validate_cash_loan();
create table if not exists app_private.loan_cash_requests(request_id uuid primary key,farm_id uuid not null,actor_id uuid not null,operation text not null,payload jsonb not null,response jsonb not null,created_at timestamptz not null default now());
revoke all on app_private.loan_cash_requests from public,anon,authenticated,app_farm_executor;
create or replace function public.app_create_loan(p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();saved app_private.loan_cash_requests;amount numeric;parcel numeric;receipt date;settled date;lot uuid;d date;previous_date date;item jsonb;i integer:=0;n integer;ident uuid;result jsonb;description text;
begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem cadastrar empréstimos.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 select * into saved from app_private.loan_cash_requests where request_id=p_request_id;
 if found then
  if saved.farm_id<>f or saved.actor_id<>auth.uid() or saved.operation<>'create' or saved.payload is distinct from p_payload then raise exception 'Identificador já utilizado. Reabra o lançamento.';end if;
  return saved.response;
 end if;
 if exists(select 1 from public.cash_entries where id=p_request_id) then raise exception 'Identificador já utilizado. Reabra o lançamento.';end if;
 description:=btrim(p_payload->>'description');
 if description is null or length(description) not between 1 and 180 then raise exception 'Informe descrição de até 180 caracteres.';end if;
 if jsonb_typeof(p_payload->'principal_amount') is distinct from 'number' or jsonb_typeof(p_payload->'amount_per_installment') is distinct from 'number' then raise exception 'Informe o valor liberado e o valor de cada parcela.';end if;
 amount:=round((p_payload->>'principal_amount')::numeric,2);parcel:=round((p_payload->>'amount_per_installment')::numeric,2);
 if amount<=0 or amount>999999999999 or parcel<=0 or parcel>999999999999 then raise exception 'Informe valores positivos dentro do limite.';end if;
 receipt:=(p_payload->>'receipt_date')::date;settled:=nullif(p_payload->>'settled_on','')::date;lot:=nullif(p_payload->>'lot_id','')::uuid;
 if receipt is null or to_char(receipt,'YYYY-MM-DD')<>p_payload->>'receipt_date' or settled>public.app_today() then raise exception 'Confira as datas de recebimento.';end if;
 if p_payload->>'frequency' is null or p_payload->>'frequency' not in ('mensal','semestral','anual') then raise exception 'Frequência inválida.';end if;
 if jsonb_typeof(p_payload->'dates') is distinct from 'array' then raise exception 'Informe os vencimentos.';end if;
 n:=jsonb_array_length(p_payload->'dates');if n not between 1 and 360 then raise exception 'Informe de 1 a 360 parcelas.';end if;
 for item in select value from jsonb_array_elements(p_payload->'dates') loop
  if jsonb_typeof(item)<>'string' then raise exception 'Data de vencimento inválida.';end if;
  d:=(item#>>'{}')::date;
  if d is null or to_char(d,'YYYY-MM-DD')<>(item#>>'{}') or d<=previous_date then raise exception 'Informe vencimentos válidos, em ordem crescente.';end if;
  previous_date:=d;
 end loop;
 perform public.app_finance_workspace('save_entry',jsonb_build_object('id',p_request_id,'direction','entrada','description',description,'category','Empréstimos','amount',amount,'due_date',receipt,'settled_on',settled,'lot_id',lot,'notes',coalesce(p_payload->>'notes',''),'expected',null));
 update public.cash_entries set loan_kind='principal' where id=p_request_id and farm_id=f;
 for item in select value from jsonb_array_elements(p_payload->'dates') loop
  i:=i+1;ident:=gen_random_uuid();d:=(item#>>'{}')::date;
  perform public.app_finance_workspace('save_entry',jsonb_build_object('id',ident,'direction','saida','description',description||' · Parcela '||i||'/'||n,'category','Empréstimos','amount',parcel,'due_date',d,'settled_on',null,'lot_id',lot,'notes',coalesce(p_payload->>'notes',''),'expected',null));
  update public.cash_entries set loan_id=p_request_id,loan_kind='installment',installment_index=i,installment_count=n where id=ident and farm_id=f;
 end loop;
 result:=jsonb_build_object('id',p_request_id,'created',n);
 insert into app_private.loan_cash_requests(request_id,farm_id,actor_id,operation,payload,response) values(p_request_id,f,auth.uid(),'create',p_payload,result);
 return result;
end $$;
create or replace function public.app_record_loan_outflow(p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();saved app_private.loan_cash_requests;origin uuid;target public.cash_entries;settled date;amount numeric;result jsonb;description text;
begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem registrar saídas de empréstimos.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 select * into saved from app_private.loan_cash_requests where request_id=p_request_id;
 if found then
  if saved.farm_id<>f or saved.actor_id<>auth.uid() or saved.operation<>'outflow' or saved.payload is distinct from p_payload then raise exception 'Identificador já utilizado. Reabra o lançamento.';end if;
  return saved.response;
 end if;
 origin:=nullif(p_payload->>'loan_id','')::uuid;
 if origin is not null then
  if not exists(select 1 from public.cash_entries where id=origin and farm_id=f and direction='entrada' and category='Empréstimos') then raise exception 'Empréstimo indisponível nesta fazenda.';end if;
 end if;
 settled:=nullif(p_payload->>'settled_on','')::date;
 if settled>public.app_today() then raise exception 'A data do pagamento não pode ser futura.';end if;
 if p_payload->>'kind'='advance' then
  select * into target from public.cash_entries where id=(p_payload->>'installment_id')::uuid and farm_id=f and loan_id=origin and loan_kind='installment' for update;
  if not found or origin is null then raise exception 'Selecione uma parcela deste empréstimo.';end if;
  if target.settled_on is not null then raise exception 'Esta parcela já está paga. Atualize a página.';end if;
  if settled is null then raise exception 'Informe a data da antecipação.';end if;
  if target.updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'Parcela alterada por outro usuário. Atualize a página.';end if;
  perform public.app_finance_workspace('save_entry',jsonb_build_object('id',target.id,'direction','saida','description',target.description,'category','Empréstimos','amount',target.amount,'due_date',target.due_date,'settled_on',settled,'lot_id',target.lot_id,'notes',concat_ws(E'\n',nullif(target.notes,''),'Pagamento antecipado em '||to_char(settled,'DD/MM/YYYY'),nullif(p_payload->>'notes','')),'expected',target.updated_at));
  result:=jsonb_build_object('id',target.id,'created',0);
 elsif p_payload->>'kind'='amortization' then
  if exists(select 1 from public.cash_entries where id=p_request_id) then raise exception 'Identificador já utilizado. Reabra o lançamento.';end if;
  if jsonb_typeof(p_payload->'amount') is distinct from 'number' then raise exception 'Informe o valor da amortização.';end if;
  amount:=round((p_payload->>'amount')::numeric,2);description:=btrim(p_payload->>'description');
  if amount<=0 or amount>999999999999 then raise exception 'Informe valor positivo dentro do limite.';end if;
  perform public.app_finance_workspace('save_entry',jsonb_build_object('id',p_request_id,'direction','saida','description',description,'category','Empréstimos','amount',amount,'due_date',p_payload->>'expense_date','settled_on',settled,'lot_id',nullif(p_payload->>'lot_id','')::uuid,'notes',coalesce(p_payload->>'notes',''),'expected',null));
  update public.cash_entries set loan_id=origin,loan_kind='amortization' where id=p_request_id and farm_id=f;
  if origin is not null then update public.cash_entries set loan_kind='principal' where id=origin and farm_id=f and loan_kind is null;end if;
  result:=jsonb_build_object('id',p_request_id,'created',1);
 else raise exception 'Tipo de saída inválido.';
 end if;
 insert into app_private.loan_cash_requests(request_id,farm_id,actor_id,operation,payload,response) values(p_request_id,f,auth.uid(),'outflow',p_payload,result);
 return result;
end $$;
revoke all on function public.app_create_loan(jsonb,uuid) from public,anon;
revoke all on function public.app_record_loan_outflow(jsonb,uuid) from public,anon;
grant execute on function public.app_create_loan(jsonb,uuid) to authenticated;
grant execute on function public.app_record_loan_outflow(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
