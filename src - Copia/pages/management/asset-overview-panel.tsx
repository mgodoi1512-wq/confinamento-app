import {Link} from "react-router-dom";
import {useLots} from "@/hooks/use-lots";
import {useAnimals} from "@/hooks/use-animals";
import {useWeighings,useWeightRecords} from "@/hooks/use-weighings";
import {useFinancialWorkspace} from "@/hooks/use-financial-workspace";
import {useEquipment} from "@/hooks/use-equipment";
import {assetOverview} from "@/lib/asset-overview";
import {animalStock} from "@/lib/financial-workspace";
import {money} from "@/lib/financial-format";
import {formatNumber} from "@/lib/format";
import {Button} from "@/components/ui/button";
export default function AssetOverviewPanel(){
 const lots=useLots(),animals=useAnimals(),weighings=useWeighings(),records=useWeightRecords(),workspace=useFinancialWorkspace(),equipment=useEquipment(),queries=[lots,animals,weighings,records,workspace,equipment];
 const ready=queries.every(q=>q.isSuccess),failed=queries.some(q=>q.isError);
 const settings=workspace.data?.settings;
 const summary=ready?assetOverview(animalStock(lots.data!,animals.data!,weighings.data!,records.data!,settings?.carcass_yield??50,false),workspace.data!.items,equipment.data!,settings?.arroba_price??null):null;
 return <section className="min-w-0 rounded-xl border bg-card p-4"><h2 className="font-display text-lg font-semibold">Patrimônio</h2><p className="text-xs text-muted-foreground">Posição atual da fazenda, sem filtro por mês.</p>
 {failed?<div role="alert" className="mt-4 space-y-2 text-sm"><p>Não foi possível carregar o patrimônio. Confira a instalação do SQL de máquinas e equipamentos.</p><Button size="sm" variant="outline" onClick={()=>queries.forEach(q=>void q.refetch())}>Tentar novamente</Button></div>:!summary?<p role="status" className="mt-4 text-sm text-muted-foreground">Carregando patrimônio…</p>:<>
 <dl className="mt-3 divide-y">{summary.rows.map(row=><div key={row.key} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><dt className="text-sm font-medium">{row.label}</dt><dd className="mt-0.5 text-xs text-muted-foreground">{formatNumber(row.quantity,row.unit==="kg"?2:0)} {row.unit}</dd></div><dd className="shrink-0 text-right text-sm font-semibold">{row.value===null?"Não estimado":money(row.value)}{row.partial&&<span className="block text-xs font-normal text-amber-800 dark:text-amber-300">{row.value===null?"Configure o preço da arroba":"Valor parcial"}</span>}</dd></div>)}</dl>
 <div className="mt-2 border-t pt-3"><p className="text-sm">{summary.partial?"Total conhecido (parcial)":"Total dos bens registrados"}</p><p className="mt-1 break-words text-xl font-semibold text-green-700 dark:text-green-400">{money(summary.total)}</p></div>
 <p className="mt-2 text-xs text-muted-foreground">Animais pelos pesos do Estoque, sem projeção GMD; alimentos e máquinas pelo custo. {summary.unknownAnimals>0?`${summary.unknownAnimals} cabeça(s) sem peso não entram no valor. `:""}Não inclui dinheiro em caixa ou dívidas. </p>
 <Button variant="outline" size="sm" className="mt-3" asChild><Link to="/gestao/financeiro/estoque">Ver estoque</Link></Button>
 </>}
 </section>;
}
