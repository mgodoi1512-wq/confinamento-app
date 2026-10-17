import { createSandboxPaymentHandler } from "./handler.ts";
Deno.serve(createSandboxPaymentHandler({ env: name => Deno.env.get(name), fetch }));
