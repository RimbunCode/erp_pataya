import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Test yang render komponen React (butuh DOM) pakai jsdom (*.rtl.test.jsx);
    // sisanya (unit test fungsi murni, source-assertion) tetap "node" (lebih cepat).
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["resources/js/**/*.test.{js,ts}"],
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
