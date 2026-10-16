import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" keeps asset paths relative so the build runs on GitHub Pages
// and as a hosted preview without configuration.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
