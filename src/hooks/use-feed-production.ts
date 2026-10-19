import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {supabase} from "@/integrations/supabase/client";
import type {Json} from "@/integrations/supabase/types";
import {useAuth} from "./use-auth";
import {workspaceKey} from "./use-financial-workspace";
import type {FeedRecipe} from "@/lib/feed-production";
const key=["feed-production-recipes"] as const;
async function rpc<T>(action:string,payload:Record<string,unknown>={}){const{data,error}=await supabase.rpc("app_stock_production",{p_action:action,p_payload:payload as Json});if(error)throw new Error(error.message);return data as T;}
export function useFeedProduction(open:boolean){
 const{tenant,isGestor}=useAuth(),client=useQueryClient();
 const recipes=useQuery({queryKey:[...key,tenant?.farmId],enabled:open&&!!tenant?.farmId&&isGestor,queryFn:()=>rpc<FeedRecipe[]>("list")});
 const produce=useMutation({mutationFn:(payload:Record<string,unknown>)=>rpc("produce",payload),onSettled:()=>{void client.invalidateQueries({queryKey:workspaceKey});void client.invalidateQueries({queryKey:["feed-stock"]});void client.invalidateQueries({queryKey:key});}});
 return{recipes,produce};
}
