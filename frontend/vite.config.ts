import react from "@vitejs/plugin-react";
import * as path from "path";
import { defineConfig } from "vite";

const r = (p: string) => path.resolve(process.cwd(), p);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router", "react-router-dom"],
          mui: ["@mui/material", "@mui/icons-material", "@mui/system", "@mui/x-data-grid"],
          refine: ["@refinedev/core", "@refinedev/mui", "@refinedev/react-router"],
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: /^src(.+)/, replacement: r("src/$1") },
      { find: /^@common(.+)/, replacement: r("src/@common/$1") },
      { find: /^@components(.+)/, replacement: r("src/@components/$1") },
      { find: /^@hooks(.+)/, replacement: r("src/@hooks/$1") },
      { find: /^@utils(.+)/, replacement: r("src/@utils/$1") },
      { find: /^@student(.+)/, replacement: r("src/modules/@student/$1") },
      { find: /^@catalog(.+)/, replacement: r("src/modules/@catalog/$1") },
      { find: /^@match(.+)/, replacement: r("src/modules/@match/$1") },
      { find: /^@mocks(.+)/, replacement: r("src/mocks/$1") },
    ],
  },
});
