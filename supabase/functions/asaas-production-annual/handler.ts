import { annualSnapshot, type AnnualData } from "../_shared/annual-reconcile.ts";
type Deps = { env: (name: string) => string | undefined; fetch: typeof fetch; now?: () => Date };
const record = (value: unknown): value is AnnualData => !!value && typeof value === "object" && !Array.isArray(value);
const documentValid = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{11}(\d{3})?$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const d = [...value].map(Number);
  return d.length === 11 ? [9,10].every(n => {const c=d.slice(0,n).reduce((sum,v,i)=>sum+v*(n+1-i),0)*10%11;return d[n]===(c===10?0:c);})
    : [12,13].every(n => {const w=n===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];const c=d.slice(0,n).reduce((sum,v,i)=>sum+v*w[i],0)%11;return d[n]===(c<2?0:11-c);});
};
export function createProductionAnnualHandler(deps: Deps) {
  return async (request: Request) => {
    const origin=request.headers.get("origin");
    const allowed=(deps.env("APP_ALLOWED_ORIGINS")??"").split(",").map(x=>x.trim());
    const headers: Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store",Vary:"Origin","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"};
    if(origin&&allowed.includes(origin))headers["Access-Control-Allow-Origin"]=origin;
    const fail=(status:number,message:string)=>new Response(JSON.stringify({error:{message}}),{status,headers});
    if(origin&&!allowed.includes(origin))return fail(403,"Origem não autorizada.");
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(request.method!=="POST")return fail(405,"Método inválido.");
    const auth=request.headers.get("authorization")??"";
    if(!/^Bearer\s+\S+$/i.test(auth))return fail(401,"Entre novamente na plataforma.");
    const url=deps.env("SUPABASE_URL")?.replace(/\/$/,""),anon=deps.env("SUPABASE_ANON_KEY"),service=deps.env("SUPABASE_SERVICE_ROLE_KEY"),key=deps.env("ASAAS_PRODUCTION_API_KEY")?.trim();
    if(!url||!anon||!service||!key?.startsWith("$aact_prod_")||/\s/.test(key))return fail(503,"Confira os Secrets exclusivos de produção.");
    const call=(target:string,init:RequestInit,ms=15000)=>deps.fetch(target,{...init,redirect:"error",signal:AbortSignal.timeout(ms)});
    try {
      const session=await call(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:auth}});
      if(!session.ok)return fail(401,"Sessão não autorizada.");
      const user:unknown=await session.json();if(!record(user)||typeof user.id!=="string")return fail(401,"Sessão inválida.");
      const raw=await request.text();if(raw.length>4096)return fail(413,"Pedido muito grande.");
      let body:unknown;try{body=JSON.parse(raw);}catch{return fail(400,"Dados inválidos.");}
      if(!record(body)||!["create","refresh","cancel"].includes(String(body.action)))return fail(400,"Ação inválida.");
      const creating=body.action==="create";
      if(body.couponQuoteId!==undefined&&(typeof body.couponQuoteId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.couponQuoteId)))return fail(400,"Cupom inválido. Aplique novamente.");
      const fields=creating?["action","installmentCount","name","cpfCnpj","priceVersion","productionConsent","couponQuoteId"]:["action","id","confirm"];
      if(Object.keys(body).some(x=>!fields.includes(x)))return fail(400,"Campo não permitido.");
      if(creating&&(!Number.isInteger(body.installmentCount)||Number(body.installmentCount)<1||Number(body.installmentCount)>12||typeof body.name!=="string"||body.name.trim().length<3||body.name.length>120||!documentValid(body.cpfCnpj)||typeof body.priceVersion!=="string"||body.productionConsent!==true))return fail(400,"Confira pagador, parcelas, valor e confirmação da contratação real.");
      if(!creating&&(typeof body.id!=="string"||!/^[0-9a-f-]{36}$/i.test(body.id)))return fail(400,"Contratação inválida.");
      if(body.action==="cancel"&&body.confirm!==true)return fail(400,"Confirme a desistência da contratação.");
      const serviceHeaders={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
      const rpc=async(action:string,payload:AnnualData)=>{
        const response=await call(`${url}/rest/v1/rpc/app_annual_purchase_server`,{method:"POST",headers:serviceHeaders,body:JSON.stringify({p_action:action,p_user_id:user.id,p_payload:payload})});
        const result:unknown=await response.json();
        if(!response.ok||!record(result))throw new Error("DATABASE");return result;
      };
      const apply=async(id:unknown,snapshot:AnnualData)=>{
        const response=await call(`${url}/rest/v1/rpc/app_apply_annual_snapshot`,{method:"POST",headers:serviceHeaders,body:JSON.stringify({p_order_id:id,p_snapshot:snapshot})});
        const result:unknown=await response.json();if(!response.ok||!record(result))throw new Error("DATABASE");return result;
      };
      const provider=async(path:string,data?:AnnualData,method?:string):Promise<AnnualData|null>=>{
        const response=await call(`https://api.asaas.com/v3/${path}`,{method:method??(data?"POST":"GET"),headers:{access_token:key,"Content-Type":"application/json","User-Agent":"LiBen-Annual/1.0"},...(data?{body:JSON.stringify(data)}:{})},method==="DELETE"||data?65000:15000);
        if(response.status===404&&!data)return null;
        if(response.status===204&&method==="DELETE")return {deleted:true};
        if(!response.ok)throw new Error("PROVIDER");const result:unknown=await response.json();if(!record(result))throw new Error("PROVIDER");return result;
      };
      const get=(path:string)=>provider(path);
      let order=await rpc(creating?"prepare":"get",creating?{installmentCount:body.installmentCount,priceVersion:body.priceVersion,productionConsent:true,...(body.couponQuoteId?{couponQuoteId:body.couponQuoteId}:{})}:{id:body.id});
      let created:AnnualData|undefined;
      if(order.fresh===true&&creating){
        const customer=await provider("customers",{name:String(body.name).trim(),cpfCnpj:body.cpfCnpj,externalReference:`liben-annual-${order.id}`,notificationDisabled:true});
        if(!customer||typeof customer.id!=="string")throw new Error("CUSTOMER");
        order=await rpc("customer",{id:order.id,customerId:customer.id});
        const invoice=await provider("payments",{customer:order.customer_id,billingType:"CREDIT_CARD",dueDate:order.due_on,
          ...(Number(order.installment_count)>1?{installmentCount:order.installment_count,totalValue:Number(order.amount_cents)/100}:{value:Number(order.amount_cents)/100}),
          externalReference:order.id,description:"LiBen - plano anual de 12 meses, sem renovação automática",interest:{value:0},fine:{value:0},discount:{value:0,type:"FIXED",dueDateLimitDays:0}});
        if(!invoice)throw new Error("PAYMENT");created=invoice;
      }
      // A reserva deixa de ser fresh antes de qualquer POST. Recuperações somente consultam o Asaas.
      if(!order.customer_id){
        const customers=await get(`customers?externalReference=${encodeURIComponent(`liben-annual-${order.id}`)}&limit=10`);
        if(!customers||!Array.isArray(customers.data)||customers.data.length!==1||!record(customers.data[0])||customers.data[0].externalReference!==`liben-annual-${order.id}`||typeof customers.data[0].id!=="string")return fail(409,"Criação em conferência. Não gere outra cobrança; consulte a contratação novamente.");
        order=await rpc("customer",{id:order.id,customerId:customers.data[0].id});
      }
      let snapshot=await annualSnapshot(order,get,(deps.now?.()??new Date()).toISOString(),undefined,created);
      order=await apply(order.id,snapshot);
      if(body.action==="cancel"){
        if(order.status!=="DELETED"){
          order=await rpc("cancel_begin",{id:order.id});
          const path=order.provider_installment_id?`installments/${encodeURIComponent(String(order.provider_installment_id))}/payments`:`payments/${encodeURIComponent(String(order.payment_id))}`;
          await provider(path,undefined,"DELETE");
          snapshot=await annualSnapshot(order,get,(deps.now?.()??new Date()).toISOString());
          order=await apply(order.id,snapshot);
          if(order.status!=="DELETED")return fail(409,"Cancelamento ainda em conferência. Consulte novamente; pagamento já confirmado não é estornado por esta ação.");
        }
      }
      return new Response(JSON.stringify({ok:true,environment:"production",id:order.id}),{headers});
    }catch{return fail(502,"Não foi possível concluir a contratação anual. Use Consultar contratação para recuperar a cobrança existente. Não crie outra cobrança manualmente. Se houve pagamento, não repita; confira a situação.");}
  };
}
