import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NumericField } from "@/components/app/numeric-field";
import { TextField } from "@/components/form/text-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkspaceMutation } from "@/hooks/use-financial-workspace";
import type { WorkspaceSettings } from "@/lib/financial-workspace";
import { todayIso } from "@/lib/format";
import { number } from "@/lib/financial-format";
export function BackFinance(){return <Button variant="outline" asChild><Link to="/gestao/financeiro"><ArrowLeft className="size-4" />Voltar ao Financeiro</Link></Button>;}
export function WorkspaceError({retry}:{retry:()=>void}){return <div role="alert" className="rounded-lg border border-destructive/40 bg-card p-5"><p>Não foi possível carregar os dados. Confira se o SQL desta atualização foi instalado no Supabase.</p><Button variant="outline" className="mt-3" onClick={retry}><RefreshCw className="size-4" />Tentar novamente</Button></div>;}
export function Metric({label,value,green=false,red=false,note}:{label:string;value:string;green?:boolean;red?:boolean;note?:string}){return <div className="min-w-0 rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 break-words font-display text-2xl font-semibold tabular-nums ${red?"text-red-700 dark:text-red-400":green?"text-green-700 dark:text-green-400":""}`}>{value}</p>{note&&<p className="mt-1 text-xs text-muted-foreground">{note}</p>}</div>;}
export function Pager({page,count,onChange}:{page:number;count:number;onChange:(n:number)=>void}){return <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-sm"><Button size="sm" variant="outline" disabled={page<=1} onClick={()=>onChange(page-1)}>Anterior</Button><span>Página {page} de {Math.max(1,count)}</span><Button size="sm" variant="outline" disabled={page>=count} onClick={()=>onChange(page+1)}>Próxima</Button></div>;}
export function SettingsDialog({settings,open,onOpenChange,mode="cash"}:{settings:WorkspaceSettings|null;open:boolean;onOpenChange:(o:boolean)=>void;mode?:"cash"|"inventory"}) {
 const cashMode=mode==="cash";
 const hasCash=settings!=null&&settings.cash_configured!==false;
 const [date,setDate]=useState(hasCash?settings.opening_date:todayIso());
 const [balance,setBalance]=useState(String(hasCash?settings.opening_balance:0));
 const [yieldPct,setYield]=useState(String(settings?.carcass_yield??50));
 const [price,setPrice]=useState(settings?.arroba_price==null?"":String(settings.arroba_price));
 const save=useWorkspaceMutation();
 const submit=async()=>{
  const y=number(yieldPct),p=price.trim()?number(price):null;
  if(y==null||y<=0||y>100||(price.trim()&&(p==null||p<0))){toast.error("Informe rendimento entre 0 e 100% e um preço da arroba válido.");return;}
  const payload:Record<string,unknown>={carcass_yield:y,arroba_price:p,expected:settings?.updated_at??null};
  if(cashMode){const b=number(balance);if(b==null||!date||date>todayIso()){toast.error("Informe o saldo inicial do fluxo de caixa e uma data até hoje.");return;}payload.opening_date=date;payload.opening_balance=b;}
  try{await save.mutateAsync({action:cashMode?"settings":"estimate_settings",payload});onOpenChange(false);toast.success(cashMode?"Saldo inicial e estimativa salvos.":"Estimativa dos animais salva.");}
  catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");}
 };
 return <Dialog open={open} onOpenChange={o=>{if(!save.isPending)onOpenChange(o);}}>
  <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
   <DialogHeader><DialogTitle>{cashMode?"Configurações do fluxo de caixa":"Estimativa de valor dos animais"}</DialogTitle><DialogDescription>{cashMode?"Defina o saldo de abertura e os parâmetros da estimativa dos animais desta fazenda.":"Ajuste o rendimento de carcaça e o preço da arroba usados na avaliação dos animais."}</DialogDescription></DialogHeader>
   <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
    {cashMode&&<section className="space-y-3 rounded-lg border border-border p-3">
     <h3 className="text-sm font-semibold">Saldo inicial do fluxo de caixa</h3>
     <p className="text-xs text-muted-foreground">Informe quanto dinheiro estava disponível para o controle da fazenda antes dos lançamentos da data escolhida.</p>
     <TextField label="Data de início do controle de caixa" type="date" value={date} onChange={setDate}/>
     <NumericField label="Saldo disponível no início do fluxo" unit="R$" value={balance} onValueChange={setBalance}/>
     <p className="text-xs text-muted-foreground">Pagamentos anteriores a essa data já devem estar considerados no saldo inicial. Contas ainda não pagas ou recebidas permanecem na projeção.</p>
    </section>}
    <section className="space-y-3 rounded-lg border border-border p-3">
     <h3 className="text-sm font-semibold">Estimativa de valor dos animais</h3>
     <p className="text-xs text-muted-foreground">Informe o preço que deseja usar para projetar o valor dos animais em estoque.</p>
     <NumericField label="Rendimento estimado de carcaça" unit="%" value={yieldPct} onValueChange={setYield}/>
     <NumericField label="Preço da arroba para estimativa (opcional)" unit="R$/@" value={price} onValueChange={setPrice}/>
     <p className="text-xs text-muted-foreground">Peso vivo × rendimento ÷ 15 = arrobas estimadas de carcaça. O preço informado é aplicado a essas arrobas para estimar o valor dos animais.</p>
     <p className="text-xs text-muted-foreground">Essa estimativa é compartilhada com Estoque/Animais. Ela não adiciona dinheiro ao saldo do caixa nem registra uma venda.</p>
    </section>
    <Button className="w-full" disabled={save.isPending} onClick={()=>void submit()}>{save.isPending?"Salvando…":cashMode?"Salvar configurações do caixa":"Salvar estimativa dos animais"}</Button>
   </fieldset>
  </DialogContent>
 </Dialog>;
}
