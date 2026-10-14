import "../css/app.css";
import "goey-toast/styles.css";
import "./bootstrap";

import { createRoot, hydrateRoot } from "react-dom/client";

import GooeyToastRoot from "@/Components/ui/GooeyToastRoot";
import I18nReadyGate from "@/Components/I18nReadyGate";
import { LaravelReactI18nProvider } from "laravel-react-i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { createInertiaApp } from "@inertiajs/react";
import { createQueryClient } from "@/lib/queryClient";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";

const appName = import.meta.env.VITE_APP_NAME || "ERP";

createInertiaApp({
  defaults: {
    visitOptions: (_href, options) => ({
      ...options,
      viewTransition: true,
    }),
  },
  title: (title) => `${title} - ${appName}`,
  resolve: (name) =>
    resolvePageComponent(
      `./Pages/${name}.jsx`,
      import.meta.glob([
        "./Pages/**/*.jsx",
        "!./Pages/**/*.test.jsx",
        "!./Pages/**/*.rtl.test.jsx",
      ]),
    ),
  setup({ el, App, props }) {
    const queryClient = createQueryClient();
    const langFiles = import.meta.glob("/lang/*.json");
    // Glob sengaja TIDAK eager: JSON lang (php_en + php_id) besar dan akan
    // masuk bundle utama semua halaman. Sebagai gantinya I18nReadyGate
    // menahan render halaman sampai provider selesai memuat terjemahan.
    const AppComp = (
      <LaravelReactI18nProvider
        locale={props.initialPage.props.lang}
        fallbackLocale={"en"}
        files={langFiles}
      >
        <QueryClientProvider client={queryClient}>
          <I18nReadyGate files={langFiles}>
            <App {...props} />
          </I18nReadyGate>
          <GooeyToastRoot />
        </QueryClientProvider>
      </LaravelReactI18nProvider>
    );
    if (import.meta.env.SSR) {
      hydrateRoot(el, AppComp);
      return;
    }

    createRoot(el).render(AppComp);
  },
  progress: {
    color: "#4B5563",
  },
});
