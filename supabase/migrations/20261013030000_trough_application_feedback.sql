-- Informa quantos tratos foram criados e quantas leituras já estavam aplicadas.
-- Requer a atualização de integridade já instalada. Executar este arquivo inteiro.
begin;
do $$
begin
  if to_regclass('public.reading_applications') is null or to_regclass('public.app_requests') is null
    or to_regprocedure('public.has_app_access()') is null then
    raise exception 'A atualização de integridade precisa ser aplicada antes desta migração.';
  end if;
end $$;

create or replace function public.app_apply_readings(p_date date, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  request public.app_requests%rowtype;
  item record;
  lot public.lots%rowtype;
  heads integer;
  weight numeric;
  feed_id uuid;
  created_count integer := 0;
  already_count integer := 0;
  zero_count integer := 0;
  payload jsonb := jsonb_build_object('date',p_date);
  result jsonb;
begin
  if uid is null or not public.has_app_access() then raise exception 'Acesso à fazenda não autorizado.'; end if;
  if p_date is null or p_date <> public.app_today() or p_request_id is null then
    raise exception 'Aplicação deve corresponder ao dia atual.';
  end if;
  -- Compartilha o bloqueio com a aplicação anterior e todas as operações do rebanho.
  perform pg_advisory_xact_lock(726102122000::bigint);
  if not public.has_app_access() then raise exception 'Acesso à fazenda não autorizado.'; end if;
  select * into request from public.app_requests where request_id=p_request_id;
  if found then
    if request.user_id<>uid or request.operation<>'apply_readings_with_feedback' or request.payload<>payload then
      raise exception 'Esta requisição já foi concluída com outros dados.';
    end if;
    return request.result;
  end if;

  for item in select distinct on (pen_id) * from public.trough_readings
    where date=p_date order by pen_id,created_at desc,id desc loop
    if item.adjustment_pct=0 then zero_count:=zero_count+1; continue; end if;
    if exists(select 1 from public.reading_applications where reading_id=item.id) then
      already_count:=already_count+1; continue;
    end if;
    if item.base_kg_per_head is null then
      raise exception 'Leitura antiga sem oferta base. Faça uma nova leitura antes de aplicar.';
    end if;
    select * into lot from public.lots where id=item.lot_id and pen_id=item.pen_id and status='ativo';
    if not found then raise exception 'Lote foi movido ou encerrado; revise a leitura.'; end if;
    select coalesce(sum(head_count),0) into heads from public.lots where pen_id=item.pen_id and status='ativo';
    if heads<=0 then raise exception 'Curral sem saldo para aplicar trato.'; end if;
    if (select count(distinct coalesce(diet_id::text,'sem_dieta')) from public.lots where pen_id=item.pen_id and status='ativo')>1 then
      raise exception 'Curral com dietas distintas: registre o trato por lote.';
    end if;
    weight:=round(item.base_kg_per_head*(1+item.adjustment_pct/100),3);
    insert into public.feed_logs(pen_id,lot_id,date,shift,diet_id,head_count,kg_per_head,total_kg,notes,recorded_by,owner_id)
    values(item.pen_id,case when (select count(*) from public.lots where pen_id=item.pen_id and status='ativo')=1 then lot.id else null end,
      p_date,'manha',lot.diet_id,heads,weight,round(heads*weight,2),'Oferta da manhã gerada pela leitura de cocho',uid,uid)
    returning id into feed_id;
    insert into public.reading_applications(reading_id,feed_log_id) values(item.id,feed_id);
    created_count:=created_count+1;
  end loop;
  result:=jsonb_build_object('created',created_count,'alreadyApplied',already_count,'zeroAdjustment',zero_count);
  insert into public.app_requests(request_id,user_id,operation,payload,result)
  values(p_request_id,uid,'apply_readings_with_feedback',payload,result);
  return result;
end $$;
revoke all on function public.app_apply_readings(date,uuid) from public, anon;
grant execute on function public.app_apply_readings(date,uuid) to authenticated;
commit;
