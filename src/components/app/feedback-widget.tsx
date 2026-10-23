import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, CheckCircle2, ImagePlus, Lightbulb, Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";

export const FeedbackWidget = () => {
  const { approved, tenant } = useAuth();
  const location = useLocation();
  const [open,setOpen] = useState(false), [pending,setPending] = useState(false), [reading,setReading] = useState(false);
  const [kind,setKind] = useState("bug"), [description,setDescription] = useState(""), [image,setImage] = useState<string | null>(null);
  const [page,setPage] = useState("");
  const [imageName,setImageName] = useState("");
  const [sent,setSent] = useState(false);
  const id = useRef(crypto.randomUUID());
  const submittedPayload = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  if (!approved || !tenant?.farmId) return null;
  const attach = async (file?: File) => {
    setImage(null);
    setImageName("");
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>1024*1024) { toast.error("Use uma imagem PNG, JPEG ou WebP de até 1 MB."); if(fileInput.current) fileInput.current.value=""; return; }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Não foi possível ler a imagem."));reader.readAsDataURL(file);});
      const preview=new Image(); preview.src=data; await preview.decode();
      setImage(data);
      setImageName(file.name);
    } catch { toast.error("Não foi possível abrir essa imagem."); if(fileInput.current) fileInput.current.value=""; }
    finally {setReading(false);}
  };
  const send = async () => {
    if(pending || reading || description.trim().length<10) return;
    const payload=JSON.stringify([kind,description.trim(),page,image]);
    if (submittedPayload.current!==payload) { id.current=crypto.randomUUID(); submittedPayload.current=payload; }
    setPending(true);
    try {
      const {error}=await supabase.rpc("app_submit_feedback",{p_id:id.current,p_kind:kind,p_description:description.trim(),p_page:page,p_screenshot:image});
      if(error)throw error;
      setSent(true);setDescription("");setImage(null);setImageName("");if(fileInput.current)fileInput.current.value="";id.current=crypto.randomUUID();
    } catch(error) {toast.error(error instanceof Error ? error.message : "Não foi possível enviar. Seu texto foi mantido para tentar novamente.");}
    finally {setPending(false);}
  };
  return <>
    <TooltipProvider delayDuration={250}><Tooltip><TooltipTrigger asChild>
      <Button aria-label="Sugestões e problemas" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 size-12 rounded-full p-0 shadow-lg lg:bottom-6 lg:right-6" onClick={()=>{if(!description)setPage(location.pathname.slice(0,500));setSent(false);setOpen(true);}}><MessageSquarePlus aria-hidden="true" className="size-5" /></Button>
    </TooltipTrigger><TooltipContent side="left" sideOffset={8}>Sugestões e problemas</TooltipContent></Tooltip></TooltipProvider>
    <Dialog open={open} onOpenChange={value=>{if(!pending && !reading)setOpen(value);}}><DialogContent className="max-h-[85dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-xl bg-card p-4 sm:max-w-lg sm:p-6"><DialogHeader className="pr-5 text-left"><DialogTitle className="flex items-center gap-2 text-base sm:text-lg">{sent ? <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" /> : kind === "suggestion" ? <Lightbulb aria-hidden="true" className="size-5 shrink-0 text-primary" /> : <Bug aria-hidden="true" className="size-5 shrink-0 text-primary" />}{sent ? "Relato enviado!" : "Ajude a melhorar o LiBen"}</DialogTitle><DialogDescription>{sent ? "Obrigado por ajudar a melhorar o LiBen." : "Compartilhe sua sugestão ou conte o que precisa ser corrigido."}</DialogDescription></DialogHeader>
      {sent ? <div className="space-y-4"><p role="status" className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">Seu relato foi registrado e poderá ser consultado pela administração da plataforma.</p><div className="flex justify-end"><Button type="button" className="h-10 w-40" onClick={()=>setOpen(false)}>Concluir</Button></div></div> : <form className="space-y-4" onSubmit={event=>{event.preventDefault();void send();}}><fieldset disabled={pending || reading} className="min-w-0 space-y-4">
        <SelectField label="Tipo de relato" value={kind} onChange={setKind} options={[{value:"bug",labelKey:"Erro ou problema"},{value:"suggestion",labelKey:"Sugestão de melhoria"}]} />
        <TextField label="Descrição" textarea className="[&_textarea]:min-h-28" value={description} onChange={value=>setDescription(value.slice(0,5000))} placeholder={kind === "suggestion" ? "Qual é sua ideia e como ela ajudaria na rotina da fazenda?" : "O que aconteceu? O que você esperava? Quais passos levaram ao problema?"} helper={`${description.length}/5000 caracteres · mínimo de 10.`} />
        <div className="space-y-2"><p className="text-sm font-medium">Imagem <span className="font-normal text-muted-foreground">· opcional</span></p><input ref={fileInput} id="feedback-image" aria-label="Selecionar imagem para o relato" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event=>void attach(event.target.files?.[0])} /><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" className="h-10" onClick={()=>fileInput.current?.click()}><ImagePlus aria-hidden="true" className="size-4" />{image ? "Trocar imagem" : "Anexar imagem"}</Button><span className="text-xs text-muted-foreground">PNG, JPEG ou WebP · até 1 MB</span></div>{reading && <p role="status" className="text-xs text-muted-foreground">Preparando imagem…</p>}{image && <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2"><img src={image} alt="Imagem que será enviada com o relato" className="max-h-36 w-full rounded-md object-contain" /><div className="flex min-w-0 items-center justify-between gap-2"><p className="min-w-0 truncate text-xs text-muted-foreground" title={imageName}>{imageName}</p><Button type="button" variant="ghost" className="h-10 shrink-0 px-2 text-xs" onClick={()=>{setImage(null);setImageName("");if(fileInput.current)fileInput.current.value="";}}><Trash2 aria-hidden="true" className="size-4" />Remover</Button></div></div>}</div>
        <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"><p>Página atual: <span className="break-words font-medium text-foreground [overflow-wrap:anywhere]">{page}</span></p><p>Sua conta e a data serão incluídas automaticamente.</p><p>Evite informar senhas ou dados sensíveis no texto e na imagem.</p></div>
      </fieldset><div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:flex sm:justify-end"><Button type="button" variant="outline" className="h-10 min-w-0 sm:w-40" disabled={pending || reading} onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" className="h-10 min-w-0 px-2 sm:w-40" disabled={pending || reading || description.trim().length<10}>{pending || reading ? <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" /> : <Send aria-hidden="true" className="size-4 shrink-0" />}{pending ? "Enviando…" : reading ? "Lendo imagem…" : "Enviar relato"}</Button></div></form>}
    </DialogContent></Dialog>
  </>;
};
