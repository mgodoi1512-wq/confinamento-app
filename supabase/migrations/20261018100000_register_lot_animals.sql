begin;
create or replace function public.app_next_ear_tag() returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();n numeric;begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem consultar a numeração.';end if;
 select coalesce(max(case when ear_tag~'^[0-9]{1,30}$' then ear_tag::numeric end),0)+1 into n from public.animals where farm_id=f;
 return jsonb_build_object('next',n::text);
end $$;
revoke all on function public.app_next_ear_tag() from public,anon;
grant execute on function public.app_next_ear_tag() to authenticated;
create table if not exists app_private.lot_animal_registration_requests (
 request_id uuid primary key,farm_id uuid not null,actor_id uuid not null,payload jsonb not null,response jsonb not null,created_at timestamptz not null default now()
);
revoke all on app_private.lot_animal_registration_requests from public,anon,authenticated,app_farm_executor;
create or replace function public.app_register_missing_lot_animals(p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();l public.lots;saved app_private.lot_animal_registration_requests;tags text[];tag text;present bigint;missing integer;expected numeric;confirmed jsonb;clashes jsonb;result jsonb;
begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem cadastrar animais.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.';end if;
 perform pg_advisory_xact_lock(726102122000::bigint);
 select * into saved from app_private.lot_animal_registration_requests where request_id=p_request_id;
 if found then
  if saved.farm_id<>f or saved.actor_id<>auth.uid() or saved.payload is distinct from p_payload then raise exception 'Identificador já utilizado. Reabra o cadastro.';end if;
  if not exists(select 1 from public.lots where id=(saved.response->>'lot_id')::uuid and farm_id=f) then raise exception 'Lote indisponível.';end if;
  return saved.response;
 end if;
 select * into l from public.lots where id=(p_payload->>'lot_id')::uuid and farm_id=f for update;
 if not found then raise exception 'Lote indisponível.';end if;
 if l.status<>'ativo' then raise exception 'Somente lotes ativos podem receber os cadastros faltantes.';end if;
 if jsonb_typeof(p_payload->'tags') is distinct from 'array' or jsonb_array_length(p_payload->'tags') not between 1 and 10000 then raise exception 'Informe entre 1 e 10.000 brincos.';end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'tags') a where jsonb_typeof(a)<>'string') then raise exception 'Brincos inválidos.';end if;
 select array_agg(btrim(t)) into tags from jsonb_array_elements_text(p_payload->'tags') t;
 if exists(select 1 from unnest(tags) t where nullif(t,'') is null or length(t)>100) then raise exception 'Informe brincos válidos de até 100 caracteres.';end if;
 if exists(select 1 from unnest(tags) t group by t having count(*)>1) then raise exception 'Não é permitido repetir o mesmo brinco dentro do lote.';end if;
 select count(*) into present from public.animals where farm_id=f and lot_id=l.id and status in ('ativo','tratamento');
 missing:=l.head_count-present;
 if jsonb_typeof(p_payload->'expected_missing') is distinct from 'number' then raise exception 'Quantidade esperada inválida.';end if;
 expected:=(p_payload->>'expected_missing')::numeric;
 if missing<1 or missing<>expected or cardinality(tags)<>missing then raise exception 'A quantidade de animais faltantes mudou. Atualize a página e confira o lote antes de continuar.';end if;
 if exists(select 1 from public.animals where farm_id=f and lot_id=l.id and ear_tag=any(tags)) then raise exception 'Não é permitido repetir o mesmo brinco dentro do lote.';end if;
 confirmed:=coalesce(p_payload->'confirmedDuplicateEarTags','[]'::jsonb);
 if jsonb_typeof(confirmed)<>'array' then raise exception 'Confirmação de brincos inválida.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('earTag',c.ear_tag,'lotCode',c.lot_code) order by c.ear_tag,c.lot_code),'[]'::jsonb) into clashes
 from (select distinct a.ear_tag,coalesce(other.code,'Sem lote') lot_code from public.animals a left join public.lots other on other.id=a.lot_id and other.farm_id=f
 where a.farm_id=f and a.lot_id is distinct from l.id and a.ear_tag=any(tags) and not (confirmed @> jsonb_build_array(a.ear_tag))) c;
 if jsonb_array_length(clashes)>0 then raise exception 'BRINCOS_OUTROS_LOTES:%',clashes::text;end if;
 -- Identifica cabeças já contabilizadas. Não adiciona cabeças, pesagens ou lançamentos financeiros.
 foreach tag in array tags loop
  insert into public.animals(farm_id,lot_id,pen_id,owner_id,ear_tag,breed,entry_weight_kg,current_weight_kg,status,notes)
  values(f,l.id,l.pen_id,l.owner_id,tag,l.breed,null,null,'ativo','Identificação de cabeça já contabilizada no lote; peso de referência baseado nas médias do lote, sem pesagem individual.');
 end loop;
 -- Garante que eventuais triggers locais não aumentaram o estoque por esta identificação.
 if exists(select 1 from public.lots where id=l.id and (head_count is distinct from l.head_count or initial_head_count is distinct from l.initial_head_count)) then raise exception 'A estrutura do banco alterou a quantidade do lote. Nenhum cadastro foi salvo; revise os gatilhos de contagem.';end if;
 result:=jsonb_build_object('lot_id',l.id,'created',cardinality(tags));
 insert into app_private.lot_animal_registration_requests(request_id,farm_id,actor_id,payload,response) values(p_request_id,f,auth.uid(),p_payload,result);
 return result;
end $$;
revoke all on function public.app_register_missing_lot_animals(jsonb,uuid) from public,anon;
grant execute on function public.app_register_missing_lot_animals(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
