import { default as LaravelReactI18nProvider } from "laravel-react-i18n";
import ReactDOMServer from "react-dom/server";
import { createInertiaApp } from "@inertiajs/react";
import createServer from "@inertiajs/react/server";
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
        import.meta.glob("./Pages/**/*.jsx"),
      ),
    setup: ({ App, props }) => {
      global.route = (name, params, absolute) =>
        route(name, params, absolute, {
          ...page.props.ziggy,
          location: new URL(page.props.ziggy.location),
        });
      return (
        <LaravelReactI18nProvider
          locale={props.initialPage.props.lang}
          fallbackLocale={"en"}
          files={import.meta.glob("/lang/*.json")}
        >
          <App {...props} />
        </LaravelReactI18nProvider>
      );
    },
  }),
);
