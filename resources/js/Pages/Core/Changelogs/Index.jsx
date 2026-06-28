import AppLayout from "@/Layouts/AppLayout";
import { Link } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ChangelogCard({ changelog }) {
  const { t } = useLaravelReactI18n();

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold">{changelog.version}</span>
          {!changelog.is_read && (
            <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
              {t("core.changelog.badge_new", "Baru")}
            </span>
          )}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground capitalize">
            {changelog.environment}
          </span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(changelog.deployed_at).toLocaleDateString(undefined, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <div
        className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-blue-500 [&_a]:underline [&_a]:underline-offset-2"
        dangerouslySetInnerHTML={{ __html: changelog.content_html }}
      />
    </div>
  );
}

export default function Index({ changelogs }) {
  const { t } = useLaravelReactI18n();

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">
            {t("core.changelog.title", "Changelog")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("core.changelog.description", "Riwayat pembaruan versi aplikasi.")}
          </p>
        </div>

        {changelogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("core.changelog.empty", "Belum ada changelog.")}
          </p>
        ) : (
          <div className="space-y-4">
            {changelogs.map((changelog) => (
              <ChangelogCard key={changelog.id} changelog={changelog} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
