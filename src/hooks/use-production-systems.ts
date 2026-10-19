import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {supabase} from "@/integrations/supabase/client";
import {useAuth} from "./use-auth";
import {fetchAll} from "@/lib/query";
import type {Json} from "@/integrations/supabase/types";
import type {ProductionSystem} from "@/lib/production-systems";
export function useSaveProductionSettings(){const client=useQueryClient();return useMutation({mutationFn:async(input:{systems:ProductionSystem[];default_system:string;expected:string|null})=>{const{data,error}=await supabase.rpc("app_production_settings",{p_payload:input as unknown as Json});if(error)throw new Error(error.message);return data as {identified_lots?:number;pending_lots?:number};},onSuccess:async()=>{await client.invalidateQueries();}});}
export function useChangeLotSystem(){const client=useQueryClient();return useMutation({mutationFn:async(input:{lot_id:string;pen_id:string;system:string;effective_date:string;expected:string|null;requestId:string})=>{const{requestId,...payload}=input;const{data,error}=await supabase.rpc("app_change_lot_system",{p_payload:payload as Json,p_request_id:requestId});if(error)throw new Error(error.message);return data;},onSuccess:()=>{void client.invalidateQueries();}});}
export type SystemHistory={id:string;lot_id:string;from_system:string|null;to_system:string;from_pen_id:string|null;to_pen_id:string;effective_date:string;created_at:string};
export function useLotSystemHistory(lotId:string){const{tenant}=useAuth();return useQuery({queryKey:["lot-system-history",tenant?.farmId,lotId],enabled:!!tenant?.farmId&&!!lotId,queryFn:()=>fetchAll<SystemHistory>(()=>supabase.from("lot_system_history").select("*").eq("lot_id",lotId).order("effective_date").order("created_at").order("id"))});}
