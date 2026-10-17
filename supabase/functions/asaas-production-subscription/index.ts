import { createProductionSubscriptionHandler } from "./handler.ts";
Deno.serve(createProductionSubscriptionHandler({ env: name => Deno.env.get(name), fetch }));
