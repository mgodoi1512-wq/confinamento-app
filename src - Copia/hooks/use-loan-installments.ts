import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { workspaceKey } from "./use-financial-workspace";
import type { Json } from "@/integrations/supabase/types";
export function useLoanMutation(){const client=useQueryClient();return useMutation({mutationFn:async({action,payload,requestId}:{action:"create"|"outflow";payload:Record<string,unknown>;requestId:string})=>{
 const args={p_payload:payload as Json,p_request_id:requestId};
 const {data,error}=action==="create"?await supabase.rpc("app_create_loan",args):await supabase.rpc("app_record_loan_outflow",args);
 if(error)throw new Error(error.message);return data as {created:number};
},onSuccess:()=>{void client.invalidateQueries({queryKey:workspaceKey});}});}
