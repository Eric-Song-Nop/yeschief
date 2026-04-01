import { defineConfig } from "vite"

export default defineConfig({
  build: {
    ssr: "src/main.ts",
    target: "esnext",
    sourcemap: true,
    outDir: "dist",
    rollupOptions: {
      output: {
        entryFileNames: "main.js",
      },
    },
  },
})
