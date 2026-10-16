import { defineConfig, loadEnv, PluginOption } from "vite";
import { enterDevPlugin, enterProdPlugin } from 'vite-plugin-enter-dev';
import path from "path";
import { readSupabaseConfig } from "./src/lib/supabase-config";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  readSupabaseConfig({ ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  const plugins = [
    ...enterProdPlugin(),
  ];
  if (mode === 'development') {
    plugins.push(...enterDevPlugin());
  }
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: plugins.filter(Boolean) as PluginOption[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: '/',
    build: {
      outDir: 'dist',
    }
  };
});