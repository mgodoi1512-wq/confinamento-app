import { createProductionCheckHandler } from "./handler.ts";
Deno.serve(createProductionCheckHandler({ env: name => Deno.env.get(name), fetch }));
