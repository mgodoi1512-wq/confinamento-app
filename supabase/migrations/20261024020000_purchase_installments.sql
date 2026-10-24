begin;
create table if not exists app_private.purchase_installment_requests (
 request_id uuid primary key, farm_id uuid not null, actor_id uuid not null,
 payload jsonb not null,response jsonb not null,created_at timestamptz not null default now()
);
revoke all on app_private.purchase_installment_requests from public,anon,authenticated,app_farm_executor;
do $$begin
 if to_regprocedure('app_private.app_finance_before_purchase_installments(text,jsonb)') is null then
  alter function public.app_finance_workspace(text,jsonb) rename to app_finance_before_purchase_installments;
  alter function public.app_finance_before_purchase_installments(text,jsonb) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_finance_before_purchase_installments(text,jsonb) from public,anon,authenticated;
create or replace function public.app_finance_workspace(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; uid uuid:=auth.uid(); rid uuid; saved app_private.purchase_installment_requests;
 n integer;i integer:=0;d date;previous date;v jsonb;amount numeric;ids jsonb:='[]';ident uuid;result jsonb;
begin
 if p_action is distinct from 'create_installments' then return app_private.app_finance_before_purchase_installments(p_action,p_payload);end if;
 f:=public.current_farm_id();if uid is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem programar compras.';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 rid:=(p_payload->>'id')::uuid;if rid is null then raise exception 'Identificador obrigatório.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 select * into saved from app_private.purchase_installment_requests where request_id=rid;
 if found then
  if saved.farm_id<>f or saved.actor_id<>uid or saved.payload is distinct from p_payload then raise exception 'Identificador já utilizado. Reabra o lançamento.';end if;
  return saved.response;
 end if;
 if jsonb_typeof(p_payload->'dates') is distinct from 'array' then raise exception 'Informe os vencimentos.';end if;
 n:=jsonb_array_length(p_payload->'dates');
 if n not between 1 and 360 or length(btrim(coalesce(p_payload->>'description',''))) not between 1 and 170 or p_payload->>'category'='Empréstimos' then raise exception 'Confira descrição, categoria e quantidade de 1 a 360 parcelas.';end if;
 if jsonb_typeof(p_payload->'amount_per_installment') is distinct from 'number' then raise exception 'Valor da parcela inválido.';end if;
 amount:=(p_payload->>'amount_per_installment')::numeric;
 if amount<=0 or amount>999999999999 or amount<>round(amount,2) then raise exception 'Informe valor positivo com até duas casas decimais.';end if;
 for v in select value from jsonb_array_elements(p_payload->'dates') loop
  if jsonb_typeof(v) is distinct from 'string' or (v#>>'{}') !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$' then raise exception 'Vencimento inválido.';end if;
  d:=(v#>>'{}')::date;
  if previous is not null and d<=previous then raise exception 'Vencimentos devem estar em ordem crescente.';end if;
  previous:=d;i:=i+1;ident:=gen_random_uuid();
  perform app_private.app_finance_before_purchase_installments('save_entry',jsonb_build_object(
   'id',ident,'direction','saida','description',btrim(p_payload->>'description')||' — parcela '||i||'/'||n,
   'category',p_payload->>'category','amount',amount,'due_date',d,'settled_on',null,
   'lot_id',p_payload->>'lot_id','notes',coalesce(p_payload->>'notes',''),'expected',null));
  ids:=ids||jsonb_build_array(ident);
 end loop;
 result:=jsonb_build_object('created',n,'ids',ids,'total',amount*n);
 insert into app_private.purchase_installment_requests(request_id,farm_id,actor_id,payload,response) values(rid,f,uid,p_payload,result);
 return result;
end;
$$;
revoke all on function public.app_finance_workspace(text,jsonb) from public,anon;
grant execute on function public.app_finance_workspace(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
