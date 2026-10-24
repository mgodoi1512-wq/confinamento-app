-- SOMENTE LEITURA: inclui lotes ativos e encerrados; não corrige nenhum dado.
-- Identificadores de fazenda/lote são necessários para localizar a divergência.
select f.id as fazenda_id, f.name as fazenda, l.id as lote_id, l.code as lote,
 l.status as situacao_lote, l.head_count as cabecas_no_lote,
 count(a.id) filter(where a.status in ('ativo','tratamento')) as animais_presentes,
 count(a.id) as cadastros_vinculados,
 l.head_count-count(a.id) filter(where a.status in ('ativo','tratamento')) as diferenca,
 case when l.status<>'ativo' and count(a.id) filter(where a.status in ('ativo','tratamento'))>0
      then 'Lote não ativo com animais presentes'
      else 'Saldo diferente dos cadastros presentes' end as motivo
from public.lots l join public.farms f on f.id=l.farm_id
left join public.animals a on a.lot_id=l.id and a.farm_id=l.farm_id
group by f.id,f.name,l.id,l.code,l.status,l.head_count
having l.head_count<>count(a.id) filter(where a.status in ('ativo','tratamento'))
 or (l.status<>'ativo' and count(a.id) filter(where a.status in ('ativo','tratamento'))>0)
order by f.name,l.code;

-- Animais presentes sem lote ou com vínculo inválido entre fazendas.
-- Sem brinco, nome de pessoa, telefone ou e-mail na saída do diagnóstico.
select a.farm_id as fazenda_id,a.id as animal_id,a.lot_id,
 case when a.lot_id is null then 'Sem lote' when l.id is null then 'Lote inexistente'
      else 'Animal e lote pertencem a fazendas diferentes' end as motivo
from public.animals a left join public.lots l on l.id=a.lot_id
where a.status in ('ativo','tratamento')
 and (a.lot_id is null or l.id is null or a.farm_id is distinct from l.farm_id)
order by a.farm_id,a.id;
