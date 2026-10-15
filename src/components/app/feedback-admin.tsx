import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { formatDateTime } from "@/lib/format";

type Feedback = Omit<Database["public"]["Tables"]["beta_feedback"]["Row"],"screenshot">;
const labels: Record<string,string> = {new:"Novo",reviewing:"Em análise",resolved:"Resolvido"};
const FeedbackEditor = ({row,onSaved}:{row:Feedback;onSaved:()=>void}) => {
  const [status,setStatus]=useState(row.status), [notes,setNotes]=useState(row.notes), [image,setImage]=useState<string|null>(null);
  const [loadingImage,setLoadingImage]=useState(false);
  const save=useMutation({mutationFn:async()=>{const {error}=await supabase.rpc("app_review_feedback",{p_id:row.id,p_status:status,p_notes:notes,p_expected_updated_at:row.updated_at});if(error)throw new Error(error.message);},onSuccess:()=>{toast.success("Relato atualizado.");onSaved();},onError:error=>toast.error(error.message)});
  const showImage=async()=>{
    setLoadingImage(true);
    try {const {data,error}=await supabase.from("beta_feedback").select("screenshot").eq("id",row.id).single();if(error)throw new Error(error.message);setImage(data.screenshot);}
    catch(error){toast.error(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");}
    finally{setLoadingImage(false);}
  };
  return <div className="space-y-4">
    <p className="break-all text-sm">{row.author} · {formatDateTime(row.created_at)}</p><p className="break-all text-sm text-muted-foreground">Página: {row.page}</p>
    <p className="whitespace-pre-wrap break-words rounded-lg border p-3 text-sm">{row.description}</p>
    {row.has_screenshot && <Button variant="outline" disabled={loadingImage} onClick={()=>void showImage()}>{loadingImage ? "Carregando..." : "Abrir imagem"}</Button>}
    {image && <img src={image} alt="Imagem anexada ao relato" className="max-h-96 w-full rounded border object-contain" />}
    <fieldset disabled={save.isPending} className="space-y-4"><SelectField label="Status" value={status} onChange={setStatus} options={Object.entries(labels).map(([value,labelKey])=>({value,labelKey}))} /><TextField label="Observações do administrador" textarea value={notes} onChange={value=>setNotes(value.slice(0,5000))} helper="Observações internas, visíveis apenas ao administrador." /></fieldset>
    <Button disabled={save.isPending || (status===row.status && notes===row.notes)} onClick={()=>save.mutate()}>{save.isPending ? "Salvando..." : "Salvar acompanhamento"}</Button>
  </div>;
};
export const FeedbackAdmin = () => {
  const client=useQueryClient();
  const [filter,setFilter]=useState("new"), [page,setPage]=useState(0), [selected,setSelected]=useState<Feedback|null>(null);
  const query=useQuery({queryKey:["beta-feedback-admin",filter,page],queryFn:async()=>{
    let request=supabase.from("beta_feedback").select("id,user_id,farm_id,author,kind,description,page,has_screenshot,status,notes,created_at,updated_at",{count:"exact"}).order("created_at",{ascending:false}).order("id").range(page*20,page*20+19);
    if(filter!=="all")request=request.eq("status",filter);
    const {data,error,count}=await request;if(error)throw new Error(error.message);return {rows:data as Feedback[],count:count??0};
  }});
  return <section className="space-y-4 border-t pt-6">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-semibold">Sugestões e problemas · Beta</h2><p className="text-sm text-muted-foreground">Relatos dos usuários para acompanhar os testes do sistema.</p></div><Button variant="outline" onClick={()=>void query.refetch()}>Atualizar relatos</Button></header>
    <div className="flex flex-wrap gap-2">{[...Object.keys(labels),"all"].map(value=><Button key={value} variant={filter===value ? "default" : "outline"} onClick={()=>{setFilter(value);setPage(0);}}>{labels[value]??"Todos"}</Button>)}</div>
    {query.isLoading && <p>Carregando relatos...</p>}{query.isError && <p role="alert">Não foi possível carregar os relatos: {query.error.message}</p>}
    <div className="grid gap-4 md:grid-cols-2">{query.data?.rows.map(row=><article key={row.id} className="min-w-0 space-y-3 rounded-xl border bg-card p-4 text-card-foreground"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{row.kind==="bug" ? "Erro ou problema" : "Sugestão"}</h3><span className="text-sm text-primary">{labels[row.status]}</span></div><p className="break-all text-xs text-muted-foreground">{row.author} · {formatDateTime(row.created_at)}</p><p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{row.description}</p><p className="truncate text-xs text-muted-foreground">Página: {row.page}</p><Button variant="outline" onClick={()=>setSelected(row)}>Ver relato e acompanhar{row.has_screenshot ? " · imagem anexada" : ""}</Button></article>)}</div>
    {query.isSuccess && query.data.rows.length===0 && <p>Nenhum relato nesta situação.</p>}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={page===0 || query.isFetching} onClick={()=>setPage(value=>value-1)}>Anterior</Button><span className="text-sm">Página {page+1} · {query.data?.count??0} relatos</span><Button variant="outline" disabled={query.isFetching || !query.data || (page+1)*20>=query.data.count} onClick={()=>setPage(value=>value+1)}>Próxima</Button></div>
    <Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Acompanhar relato</DialogTitle></DialogHeader>{selected && <FeedbackEditor key={selected.id+selected.updated_at} row={selected} onSaved={()=>{setSelected(null);void client.invalidateQueries({queryKey:["beta-feedback-admin"]});}} />}</DialogContent></Dialog>
  </section>;
};
