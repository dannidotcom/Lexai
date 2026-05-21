import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const PORT = Number(env.PORT || 5173);
  const API_TARGET = env.VITE_API_URL || "http://localhost:8080";

  return {
    plugins: [
      react(),
      tsconfigPaths(),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@workspace/api-client-react": path.resolve(__dirname, "./src/lib/api-client/index.ts"),
      },
    },

    server: {
      host: "0.0.0.0",
      port: PORT,
      strictPort: false,
      proxy: {
        "/api": {
          target: API_TARGET,
          changeOrigin: true,
        },
      },
    },

    preview: {
      host: "0.0.0.0",
      port: PORT,
    },
  };
});