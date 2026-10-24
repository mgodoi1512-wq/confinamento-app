import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parsePublicPlanPrices } from "@/lib/public-plan-prices";

export function usePublicPlanPrices() {
  return useQuery({
    queryKey: ["public-plan-prices"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("app_public_plan_prices");
      if (error) throw new Error("Não foi possível consultar os planos.");
      return parsePublicPlanPrices(data);
    },
    staleTime: 0,
    refetchInterval: 60000,
    refetchOnWindowFocus: "always",
    retry: 1,
  });
}
