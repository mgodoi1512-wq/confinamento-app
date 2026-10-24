import {useState} from "react";
import {useMutation} from "@tanstack/react-query";
import {couponQuote,type CouponQuote} from "@/lib/plan-coupons";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
export function PlanCouponField({plan,installments,disabled,onQuote,onValidating}:{plan:"monthly"|"annual";installments:number;disabled:boolean;onQuote:(quote:CouponQuote|null)=>void;onValidating:(busy:boolean)=>void}){
 const[code,setCode]=useState("");
 const apply=useMutation({mutationFn:()=>couponQuote(code,plan,installments),onMutate:()=>{onQuote(null);onValidating(true);},onSuccess:onQuote,onError:()=>onQuote(null),onSettled:()=>onValidating(false)});
 return <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Tem um cupom de desconto?</summary><div className="mt-3 space-y-2"><div className="flex flex-wrap gap-2"><Input aria-label="Código do cupom" className="min-w-0 flex-1 uppercase" maxLength={32} placeholder="Ex.: LIBEN10" value={code} disabled={disabled||apply.isPending} onChange={e=>{setCode(e.target.value.toUpperCase());onQuote(null);apply.reset();}}/><Button type="button" variant="outline" disabled={disabled||apply.isPending||code.trim().length<3} onClick={()=>{onQuote(null);onValidating(true);apply.mutate();}}>{apply.isPending?"Validando…":"Aplicar"}</Button><Button type="button" variant="ghost" disabled={disabled||apply.isPending} onClick={()=>{setCode("");onQuote(null);apply.reset();}}>Remover</Button></div>{apply.isError&&<p role="alert" className="text-sm text-destructive">{apply.error.message}</p>}<p className="text-xs text-muted-foreground">Um uso de cada cupom por fazenda, sem acumular. O desconto vale na primeira cobrança. A aplicação precisa ser confirmada antes de contratar.</p></div></details>;
}
