import { createSandboxWebhookHandler } from "./handler.ts";
Deno.serve(createSandboxWebhookHandler({ env: name => Deno.env.get(name), fetch }));
