import { createProductionAnnualHandler } from "./handler.ts";
Deno.serve(createProductionAnnualHandler({ env: name => Deno.env.get(name), fetch }));
