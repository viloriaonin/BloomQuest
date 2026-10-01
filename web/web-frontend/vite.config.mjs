import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "REACT_APP_");
  const apiBaseUrl = env.REACT_APP_API_BASE_URL || "http://localhost:8000";

  return {
    root: "src",
    plugins: [react({ include: /\.[jt]sx?$/ })],
    publicDir: "../public",
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: { ".js": "jsx" },
      },
    },
    define: {
      "process.env.REACT_APP_API_BASE_URL": JSON.stringify(apiBaseUrl),
    },
    server: {
      host: "localhost",
      port: 3000,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
  };
});