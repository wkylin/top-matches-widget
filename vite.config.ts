import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.DEV_API_PROXY_TARGET?.trim();
  const proxyUrl = proxyTarget ? new URL(proxyTarget) : null;
  const proxyBasePath = proxyUrl
    ? proxyUrl.pathname.replace(/\/$/, "")
    : "";

  return {
    plugins: [vue()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      host: true,
      port: 5175,
      open: true,
      proxy: proxyTarget
        ? {
            "/gateway/api": {
              target: proxyUrl?.origin,
              changeOrigin: true,
              rewrite: (path) =>
                `${proxyBasePath}${path.replace(/^\/gateway\/api/, "")}` || "/",
            },
          }
        : undefined,
    },
  };
});
