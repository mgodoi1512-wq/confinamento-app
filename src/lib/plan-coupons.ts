import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
export type CouponQuote={id:string;code:string;plan:"monthly"|"annual";installments:number;originalCents:number;discountCents:number;totalCents:number;priceVersion:string;expiresAt:string};
export type PlanCoupon={id:string;code:string;kind:"percent"|"fixed";value:number;plan:"monthly"|"annual"|"both";expires_on:string;max_uses:number|null;active:boolean;updated_at:string;uses:number};
export type CouponUse={id:string;code:string;farm_name:string;catalog_cents:number;discount_cents:number;total_cents:number;created_at:string;state:string};
export async function couponQuote(code:string,plan:"monthly"|"annual",installments:number):Promise<CouponQuote>{
 const {data,error}=await supabase.rpc("app_coupon_quote",{p_code:code,p_plan:plan,p_installments:installments});if(error)throw new Error(error.message);return data as unknown as CouponQuote;
}
export async function couponsAdmin(action:"list"|"save",payload:Record<string,Json|undefined>={}):Promise<{coupons:PlanCoupon[];uses:CouponUse[]}>{
 const{data,error}=await supabase.rpc("app_coupons_admin",{p_action:action,p_payload:payload});if(error)throw new Error(error.message);return data as unknown as {coupons:PlanCoupon[];uses:CouponUse[]};
}
