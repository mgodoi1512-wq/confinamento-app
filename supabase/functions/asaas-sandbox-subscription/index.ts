import { createSandboxSubscriptionHandler } from "./handler.ts";
Deno.serve(createSandboxSubscriptionHandler({ env: name => Deno.env.get(name), fetch }));
