import { createSandboxCheckHandler } from "./handler.ts";

Deno.serve(createSandboxCheckHandler({ env: name => Deno.env.get(name), fetch }));
