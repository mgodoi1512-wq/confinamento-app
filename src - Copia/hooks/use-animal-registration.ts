import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DuplicateEarTagsError } from "@/lib/mutations";
import type { Json } from "@/integrations/supabase/types";
export function useNextEarTag(enabled=true) {
 const {tenant,isGestor}=useAuth();
 return useQuery({staleTime:0,refetchOnMount:"always",queryKey:["next-ear-tag",tenant?.farmId],enabled:enabled&&!!tenant?.farmId&&isGestor,queryFn:async()=>{
  const {data,error}=await supabase.rpc("app_next_ear_tag");if(error)throw new Error(error.message);
  return data as {next:string};
 }});
}
export function useRegisterMissingLotAnimals(){
 const client=useQueryClient();
 return useMutation({mutationFn:async(payload:{lot_id:string;tags:string[];expected_missing:number;confirmedDuplicateEarTags:string[];requestId:string})=>{
  const {requestId,...body}=payload;
  const {data,error}=await supabase.rpc("app_register_missing_lot_animals",{p_payload:body as Json,p_request_id:requestId});
  if(error){const prefix="BRINCOS_OUTROS_LOTES:";if(error.message.startsWith(prefix)){
   try{const matches=JSON.parse(error.message.slice(prefix.length));if(Array.isArray(matches)&&matches.length&&matches.every(m=>typeof m?.earTag==="string"&&typeof m?.lotCode==="string"))throw new DuplicateEarTagsError(matches);}catch(e){if(e instanceof DuplicateEarTagsError)throw e;}
  }throw new Error(error.message);}return data as {created:number};
 },onSuccess:()=>{void client.invalidateQueries();}});
}
