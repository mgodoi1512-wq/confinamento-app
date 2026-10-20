import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useWeighings } from "@/hooks/use-weighings";
import { useFarm } from "@/hooks/use-farm";
import { computeFeedingSuggestions, feedingSuggestionReport } from "@/lib/feed-suggestion";
import { todayIso } from "@/lib/format";

export const FeedSuggestionExport=()=>{
  const [busy,setBusy]=useState(false);
  const lots=useLots(),pens=usePens(),weights=useWeighings(),farm=useFarm();
  const ready=[lots,pens,weights,farm].every(query=>query.isSuccess);
  const generate=async()=>{
    if(busy)return;setBusy(true);
    try{
      const [freshLots,freshPens,freshWeights,freshFarm]=await Promise.all([lots.refetch(),pens.refetch(),weights.refetch(),farm.refetch()]);
      if([freshLots,freshPens,freshWeights,freshFarm].some(query=>query.isError))throw new Error("Não foi possível atualizar os dados. Tente novamente.");
      const date=todayIso();
      const suggestions=computeFeedingSuggestions(freshLots.data??[],freshPens.data??[],freshWeights.data??[],date);
      if(!suggestions.length){toast.info("Não há lotes ativos identificados como confinamento para gerar esta sugestão.");return;}
      const {exportPdf}=await import("@/lib/export-files");
      await exportPdf(feedingSuggestionReport(suggestions,freshFarm.data?.name??"Fazenda",date));
      if(suggestions.some(item=>item.issue))toast.warning("PDF gerado com lotes que precisam de revisão. Confira as linhas sinalizadas.");
      else toast.success("Sugestão em PDF gerada para três refeições.");
    }catch(error){toast.error(error instanceof Error?error.message:"Não foi possível gerar o PDF.");}
    finally{setBusy(false);}
  };
  return <Button type="button" variant="outline" className="h-10" disabled={busy||!ready} onClick={()=>void generate()}>
    {busy?<Loader2 className="animate-spin" />:<FileDown />} PDF sugestão de confinamento
  </Button>;
};
