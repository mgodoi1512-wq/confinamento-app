import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {useAuth} from "./use-auth";
import {supabase} from "@/integrations/supabase/client";
import type {Json} from "@/integrations/supabase/types";
import type {Equipment} from "@/lib/asset-overview";
const key=["inventory-equipment"] as const;
async function rpc<T>(action:string,payload:Record<string,unknown>={}){const {data,error}=await supabase.rpc("app_equipment",{p_action:action,p_payload:payload as Json});if(error)throw new Error(error.message);return data as T;}
export function useEquipment(){const{tenant,isGestor}=useAuth();return useQuery({queryKey:[...key,tenant?.farmId],enabled:!!tenant?.farmId&&isGestor,queryFn:()=>rpc<Equipment[]>("list")});}
export function useEquipmentMutation(){const client=useQueryClient();return useMutation({mutationFn:({action,payload}:{action:"save"|"delete";payload:Record<string,unknown>})=>rpc(action,payload),onSettled:()=>{void client.invalidateQueries({queryKey:key});}});}
