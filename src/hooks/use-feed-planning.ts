import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchAll } from "@/lib/query";
import type { FeedSlot, PlannedIngredient } from "@/lib/feed-planning";
import type { FeedLog } from "@/lib/domain";
import { useAuth } from "@/hooks/use-auth";
import { feedLogsQueryKey } from "@/hooks/use-feed";

type PlanRow=Database["public"]["Tables"]["daily_feed_plans"]["Row"];
export type DailyFeedPlan=Omit<PlanRow,"schedule"|"ingredients"> & {schedule:FeedSlot[];ingredients:PlannedIngredient[]};
export type FarmFeedSettings={farm_id:string;schedule:FeedSlot[];updated_at:string};
export const dailyFeedPlansKey=["daily-feed-plans"] as const;
export const useDailyFeedPlans=(date:string)=>useQuery({queryKey:[...dailyFeedPlansKey,date],queryFn:async()=>await fetchAll<PlanRow>(()=>supabase.from("daily_feed_plans").select("*").eq("date",date).order("id")) as unknown as DailyFeedPlan[]});
export const useFarmFeedSettings=()=>{
 const {tenant}=useAuth();const farmId=tenant?.farmId;
 return useQuery({queryKey:["farm-feed-settings",farmId],enabled:!!farmId,queryFn:async()=>{
  if(!farmId)return null;
  const {data,error}=await supabase.from("farm_feed_settings").select("*").eq("farm_id",farmId).maybeSingle();
  if(error)throw new Error(error.message);return data as unknown as FarmFeedSettings|null;
 }});
};
export const useSaveFeedSchedule=()=>{
 const client=useQueryClient();return useMutation({mutationFn:async(input:{schedule:FeedSlot[];version:string|null})=>{
  const {data,error}=await supabase.rpc("app_save_feed_schedule",{p_schedule:input.schedule as unknown as Json,p_expected_updated_at:input.version});
  if(error)throw new Error(error.message);return data as unknown as FarmFeedSettings;
 },onSuccess:()=>{void client.invalidateQueries({queryKey:["farm-feed-settings"]});}});
};
export type PlannedFeedPayload={date:string;lotId:string;dietId:string;shift:string;mealCount:number;schedule:FeedSlot[];referenceWeight:number;headCount:number;dailyKgPerHead:number;ingredients:PlannedIngredient[];actualKgPerHead:number;notes:string|null};
export const useRecordPlannedFeed=()=>{
 const client=useQueryClient();return useMutation({mutationFn:async(input:{payload:PlannedFeedPayload;requestId:string})=>{
  const {data,error}=await supabase.rpc("app_record_planned_feed",{p_payload:input.payload as unknown as Json,p_request_id:input.requestId});
  if(error)throw new Error(error.message);return data as unknown as FeedLog;
 },onSuccess:()=>{void client.invalidateQueries({queryKey:dailyFeedPlansKey});void client.invalidateQueries({queryKey:feedLogsQueryKey});void client.invalidateQueries({queryKey:["feed-stock"]});void client.invalidateQueries({queryKey:["financial-workspace"]});}});
};
