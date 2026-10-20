import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { FinanceInput } from "@/lib/finance";
export type CostSheet = Database["public"]["Tables"]["farm_cost_sheets"]["Row"];
const key=["farm-cost-sheet"] as const;
export const useCostSheet = () => {
  const {tenant,isGestor}=useAuth();
  return useQuery({queryKey:[...key,tenant?.farmId],enabled:Boolean(isGestor && tenant?.farmId),queryFn:async()=>{
    const {data,error}=await supabase.from("farm_cost_sheets").select("*").eq("farm_id",tenant!.farmId!).maybeSingle();
    if(error)throw new Error(error.message);return data;
  }});
};
export const useSaveCostSheet = () => {
  const client=useQueryClient();
  return useMutation({mutationFn:async(input:{parameters:FinanceInput;expectedUpdatedAt:string|null})=>{
    const {data,error}=await supabase.rpc("app_save_cost_sheet",{p_parameters:input.parameters as unknown as Json,p_expected_updated_at:input.expectedUpdatedAt});
    if(error)throw new Error(error.message);return data as unknown as CostSheet;
  },onSuccess:row=>{client.setQueryData([...key,row.farm_id],row);}});
};
