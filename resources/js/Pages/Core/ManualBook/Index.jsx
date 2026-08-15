import AppLayout from "@/Layouts/AppLayout";
import { Head } from "@inertiajs/react";
import Link from "@/Components/Link";
import resolveManualBookIcon from "@/Components/ManualBook/iconMap";
import { useLaravelReactI18n } from "laravel-react-i18n";

function SectionCard({ section }) {
  const Icon = resolveManualBookIcon(section.icon);

  return (
    <Link
      href={route("manualBook.show", section.key)}
      className="flex items-start gap-4 rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-accent"
    >
      <span className="rounded-md bg-secondary p-2 text-secondary-foreground">
        <Icon className="size-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{section.title}</span>
        <span className="text-sm text-muted-foreground">
          {section.description}
        </span>
      </span>
    </Link>
  );
}

export default function Index({ sections }) {
  const { t } = useLaravelReactI18n();

  return (
    <AppLayout>
      <Head title={t("core.manualBook.title", "Manual Book")} />
      <div className="mx-auto max-w-4xl space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">
            {t("core.manualBook.title", "Manual Book")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "core.manualBook.description",
              "Panduan penggunaan aplikasi per fitur.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <SectionCard key={section.key} section={section} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
