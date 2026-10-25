import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

function cleanRoutes(): Plugin {
  return {
    name: "pollo-clean-routes",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const [pathname = "/", search = ""] = request.url.split("?");
        const suffix = search ? `?${search}` : "";
        const pageRoutes: Record<string, string> = {
          "/off-topic": "/off-topic.html",
          "/off-topic/": "/off-topic.html",
          "/arquivo": "/arquivo.html",
          "/arquivo/": "/arquivo.html",
          "/sobre": "/sobre.html",
          "/sobre/": "/sobre.html",
          "/admin": "/admin.html",
          "/admin/": "/admin.html",
          "/post": "/post.html",
          "/post/": "/post.html",
        };

        if (pageRoutes[pathname]) {
          request.url = `${pageRoutes[pathname]}${suffix}`;
        } else if (/^\/post\/[^/]+\/?$/.test(pathname)) {
          request.url = `/post.html${suffix}`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  root: "frontend",
  base: "/",
  appType: "mpa",
  plugins: [cleanRoutes()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./frontend/src", import.meta.url)),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL("./frontend/index.html", import.meta.url)),
        offTopic: fileURLToPath(new URL("./frontend/off-topic.html", import.meta.url)),
        archive: fileURLToPath(new URL("./frontend/arquivo.html", import.meta.url)),
        post: fileURLToPath(new URL("./frontend/post.html", import.meta.url)),
        about: fileURLToPath(new URL("./frontend/sobre.html", import.meta.url)),
        admin: fileURLToPath(new URL("./frontend/admin.html", import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/lucide")) return "icons";
          if (
            id.includes("node_modules/markdown-it") ||
            id.includes("node_modules/linkify-it") ||
            id.includes("node_modules/mdurl") ||
            id.includes("node_modules/uc.micro") ||
            id.includes("node_modules/punycode.js") ||
            id.includes("node_modules/dompurify") ||
            id.includes("node_modules/highlight.js")
          ) {
            return "markdown-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/uploads": "http://127.0.0.1:8080",
    },
  },
});
