import { defineConfig } from "vite";
import i18n from "laravel-react-i18n/vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    laravel({
      input: "resources/js/app.jsx",
      ssr: "resources/js/ssr.jsx",
      refresh: true,
    }),
    react(),
    i18n(),
  ],
});
