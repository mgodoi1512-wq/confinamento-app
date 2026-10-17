import { createProductionPaymentHandler } from "./handler.ts";
Deno.serve(createProductionPaymentHandler({ env: name => Deno.env.get(name), fetch }));
