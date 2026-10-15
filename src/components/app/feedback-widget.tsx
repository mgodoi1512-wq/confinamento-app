import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";

export const FeedbackWidget = () => {
  const { approved, tenant } = useAuth();
  const location = useLocation();
  const [open,setOpen] = useState(false), [pending,setPending] = useState(false), [reading,setReading] = useState(false);
  const [kind,setKind] = useState("bug"), [description,setDescription] = useState(""), [image,setImage] = useState<string | null>(null);
  const [page,setPage] = useState("");
  const id = useRef(crypto.randomUUID());
  const submittedPayload = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  if (!approved || !tenant?.farmId) return null;
  const attach = async (file?: File) => {
    setImage(null);
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>1024*1024) { toast.error("Use uma imagem PNG, JPEG ou WebP de até 1 MB."); if(fileInput.current) fileInput.current.value=""; return; }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Não foi possível ler a imagem."));reader.readAsDataURL(file);});
      const preview=new Image(); preview.src=data; await preview.decode();
      setImage(data);
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
      toast.success("Relato enviado. Obrigado por ajudar nos testes!");setOpen(false);setDescription("");setImage(null);id.current=crypto.randomUUID();
    } catch(error) {toast.error(error instanceof Error ? error.message : "Não foi possível enviar. Seu texto foi mantido para tentar novamente.");}
    finally {setPending(false);}
  };
  return <>
    <Button aria-label="Sugestões e problemas" title="Sugestões e problemas" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 h-12 rounded-full px-4 shadow-lg lg:bottom-6 lg:right-6" onClick={()=>{if(!description)setPage(location.pathname.slice(0,500));setOpen(true);}}><MessageSquarePlus className="size-5" /><span className="hidden sm:inline">Sugestões e problemas</span></Button>
    <Dialog open={open} onOpenChange={value=>{if(!pending && !reading)setOpen(value);}}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Bug className="size-5" />Ajude a melhorar o LiBen</DialogTitle><DialogDescription>Envie uma sugestão ou informe um problema encontrado durante os testes.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event=>{event.preventDefault();void send();}}><fieldset disabled={pending || reading} className="min-w-0 space-y-4">
        <SelectField label="Tipo de relato" value={kind} onChange={setKind} options={[{value:"bug",labelKey:"Erro ou problema"},{value:"suggestion",labelKey:"Sugestão de melhoria"}]} />
        <TextField label="Descrição" textarea value={description} onChange={value=>setDescription(value.slice(0,5000))} placeholder="Conte o que aconteceu, o que esperava e como podemos reproduzir." helper={`${description.length}/5000 caracteres · mínimo de 10.`} />
        <div className="space-y-2"><label htmlFor="feedback-image" className="block text-sm font-medium">Imagem opcional (até 1 MB)</label><input ref={fileInput} id="feedback-image" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full min-w-0 text-sm" onChange={event=>void attach(event.target.files?.[0])} />{image && <><img src={image} alt="Imagem que será enviada com o relato" className="max-h-40 rounded border object-contain" /><Button type="button" variant="ghost" onClick={()=>{setImage(null);if(fileInput.current)fileInput.current.value="";}}>Remover imagem</Button></>}</div>
        <p className="break-all text-xs text-muted-foreground">Página: {page}. Sua conta e a data serão registradas automaticamente. Evite incluir senhas nas imagens.</p>
      </fieldset><Button type="submit" className="w-full" disabled={pending || reading || description.trim().length<10}>{pending ? "Enviando..." : reading ? "Lendo imagem..." : "Enviar relato"}</Button></form>
    </DialogContent></Dialog>
  </>;
};
