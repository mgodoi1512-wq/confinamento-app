import { createProductionWebhookHandler } from "./handler.ts";
Deno.serve(createProductionWebhookHandler({ env: name => Deno.env.get(name), fetch }));
