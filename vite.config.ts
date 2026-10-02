import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        /* Vendor split. Every node_modules dep is named explicitly — no bare
           "return 'vendor'" catch-all, because a shared package then lands in
           whichever chunk loads first and pollutes the critical path (that's
           how react-dom briefly ended up inside the three.js chunk). Target
           layout is unchanged from the pre-split build:
             react stack        → client        (entry-preloaded)
             gsap/lenis/html2canvas → index + selfDestruct (entry + lazy, as before)
             three/@react-three/maath → three-vendor (lazy, Sentinel-only)
           Pure packaging — no code paths change. */
        manualChunks(id) {
          /* Vite's preload helper is a virtual module (no node_modules in its
             id). If left unassigned Rollup hoists it into an arbitrary vendor
             chunk, which then lands on the critical path — pin it to the entry. */
          if (id.includes("preload-helper") || id.includes("vite/dist/client")) return "index";
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]three[\\/]|[\\/]@react-three[\\/]|[\\/]maath[\\/]/.test(id)) return "three-vendor";
          if (/[\\/]react[\\/]|[\\/]react-dom[\\/]|[\\/]scheduler[\\/]/.test(id)) return "client";
          return undefined; // gsap, lenis, html2canvas → same chunks as before
        },
      },
    },
  },
})
