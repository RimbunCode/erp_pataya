import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Tiga kelompok test dibedakan lewat suffix nama file:
    // - *.test.js        -> "unit" (node)   : fungsi murni, tanpa window/document
    // - *.dom.test.js     -> "dom" (jsdom)   : butuh browser API (window/document) tapi tidak render React
    // - *.rtl.test.jsx    -> "component" (jsdom) : render komponen React + interaksi user
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["resources/js/**/*.test.{js,ts}"],
          exclude: ["resources/js/**/*.dom.test.js"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["resources/js/**/*.dom.test.js"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["resources/js/**/*.rtl.test.{jsx,tsx}"],
          setupFiles: ["./resources/js/test-setup.js"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "resources/js"),
    },
  },
});
