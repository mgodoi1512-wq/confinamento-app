import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Workspace } from "@/lib/financial-workspace";
export const workspaceKey=["financial-workspace"] as const;
export async function workspaceRpc<T>(action:string,payload:Record<string,unknown>={}) {
  const {data,error}=await supabase.rpc("app_finance_workspace",{p_action:action,p_payload:payload as Json});
  if(error)throw new Error(error.code==="23505"&&action==="save_item"?"Já existe um item com este nome no estoque da fazenda.":error.message);return data as T;
}
export function useFinancialWorkspace(){const {tenant,isGestor}=useAuth();return useQuery({queryKey:[...workspaceKey,tenant?.farmId],enabled:!!tenant?.farmId&&isGestor,queryFn:()=>workspaceRpc<Workspace>("snapshot"),refetchOnWindowFocus:true});}
export function useWorkspaceMutation(){const client=useQueryClient();return useMutation({mutationFn:({action,payload}:{action:string;payload:Record<string,unknown>})=>workspaceRpc(action,payload),onSettled:()=>{void client.invalidateQueries({queryKey:workspaceKey});void client.invalidateQueries({queryKey:["feed-stock"]});}});}
