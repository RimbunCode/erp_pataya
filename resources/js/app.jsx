import "../css/app.css";
import "quill/dist/quill.core.css";
import "./bootstrap";

import { createRoot, hydrateRoot } from "react-dom/client";

import { LaravelReactI18nProvider } from "laravel-react-i18n";
import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

createInertiaApp({
  title: (title) => `${title} - ${appName}`,
  resolve: (name) =>
    resolvePageComponent(
      `./Pages/${name}.jsx`,
      import.meta.glob("./Pages/**/*.jsx"),
    ),
  setup({ el, App, props }) {
    const AppComp = (
      <LaravelReactI18nProvider
        locale={props.initialPage.props.lang}
        fallbackLocale={"en"}
        files={import.meta.glob("/lang/*.json")}
      >
        <App {...props} />
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
