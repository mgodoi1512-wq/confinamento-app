import {useQuery} from "@tanstack/react-query";
import {useAuth} from "./use-auth";
import {supabase} from "@/integrations/supabase/client";
import type {FeedStock} from "@/lib/feed-stock";
export const feedStockKey=["feed-stock"] as const;
export function useFeedStock(enabled=true){const{tenant}=useAuth();return useQuery({queryKey:[...feedStockKey,tenant?.farmId],enabled:enabled&&!!tenant?.farmId,queryFn:async()=>{const{data,error}=await supabase.rpc("app_feed_stock");if(error)throw new Error(error.message);return data as unknown as FeedStock;},refetchOnWindowFocus:true});}
