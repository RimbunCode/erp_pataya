import { default as LaravelReactI18nProvider } from "laravel-react-i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import ReactDOMServer from "react-dom/server";
import { createInertiaApp } from "@inertiajs/react";
import createServer from "@inertiajs/react/server";
import { createQueryClient } from "@/lib/queryClient";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { route } from "../../vendor/tightenco/ziggy";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

createServer((page) =>
  createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
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
    setup: ({ App, props }) => {
      global.route = (name, params, absolute) =>
        route(name, params, absolute, {
          ...page.props.ziggy,
          location: new URL(page.props.ziggy.location),
        });
      // Instance BARU tiap request (fungsi, bukan singleton) — lihat
      // komentar createQueryClient(): proses Node SSR ini persisten lintas
      // request, singleton module-level bisa bocor state antar user.
      const queryClient = createQueryClient();

      return (
        <LaravelReactI18nProvider
          locale={props.initialPage.props.lang}
          fallbackLocale={"en"}
          files={import.meta.glob("/lang/*.json")}
        >
          <QueryClientProvider client={queryClient}>
            <App {...props} />
          </QueryClientProvider>
        </LaravelReactI18nProvider>
      );
    },
  }),
);
