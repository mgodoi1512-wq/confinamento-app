import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type {Json} from "@/integrations/supabase/types";
import type {PurchaseValues} from "@/lib/stock-animal-detail";
const key=["stock-animal-values"] as const;
async function rpc<T>(action:string,payload:Record<string,unknown>){const {data,error}=await supabase.rpc("app_stock_animal_values",{p_action:action,p_payload:payload as Json});if(error)throw new Error(error.message);return data as T;}
export function useStockAnimalValues(lotId:string|undefined){const {tenant,isGestor}=useAuth();return useQuery({queryKey:[...key,tenant?.farmId,lotId],enabled:!!lotId&&!!tenant?.farmId&&isGestor,queryFn:()=>rpc<PurchaseValues>("get",{lot_id:lotId})});}
export function useSaveStockPurchase(){const client=useQueryClient();return useMutation({mutationFn:({action,payload}:{action:"save_default"|"save_animal";payload:Record<string,unknown>})=>rpc(action,payload),onSettled:()=>{void client.invalidateQueries({queryKey:key});}});}
