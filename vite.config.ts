import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { readSupabaseConfig } from "./src/lib/supabase-config";

// Keep public/locales as the single source, while making translations available
// synchronously without importing assets from Vite's public directory.
function bundledLocales(): Plugin {
  const moduleId = "virtual:liben-locales";
  const resolvedId = `\0${moduleId}`;
  const localesDir = path.resolve(import.meta.dirname, "public/locales");
  let isBuild = false;
  return {
    name: "liben-bundled-locales",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      if (isBuild) this.addWatchFile(localesDir);
      const resources = Object.fromEntries(
        readdirSync(localesDir).filter(file => file.endsWith(".json")).sort().map(file => {
          const filePath = path.join(localesDir, file);
          if (isBuild) this.addWatchFile(filePath);
          return [file.slice(0, -5), { translation: JSON.parse(readFileSync(filePath, "utf8")) }];
        }),
      );
      return `export default ${JSON.stringify(resources)};`;
    },
    configureServer(server) {
      server.watcher.add(localesDir);
      const reload = (_event: string, file: string) => {
        if (path.dirname(file) !== localesDir || !file.endsWith(".json")) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("all", reload);
      server.httpServer?.once("close", () => server.watcher.off("all", reload));
    },
  };
}

export default defineConfig(({ mode }) => {
  readSupabaseConfig({ ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  return {
    plugins: [react(), tailwindcss(), bundledLocales()],
    server: { host: "localhost", port: 8080 },
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    base: "/",
    build: { outDir: "dist" },
  };
});
