import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readSupabaseConfig } from "./src/lib/supabase-config";

export default defineConfig(({ mode }) => {
  readSupabaseConfig({ ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  return {
    plugins: [react()],
    server: { host: "localhost", port: 8080 },
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    base: "/",
    build: { outDir: "dist" },
  };
});
