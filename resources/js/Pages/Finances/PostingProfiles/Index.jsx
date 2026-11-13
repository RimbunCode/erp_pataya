import { Head } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import AppLayout from "@/Layouts/AppLayout";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import Link from "@/Components/Link";

const STATUS_VARIANT = {
  active: "default",
  draft: "secondary",
  retired: "outline",
};

/**
 * Daftar Posting Profile (Finance Fase 2, Requirement 8.1): profil global berversi dengan rentang berlaku. Detail,
 * salin versi, aktivasi, dan pemensiunan ada pada halaman profil.
 * @param {object} props
 * @param {{id: string, name: string, status: string, version: number, effective_from: string, effective_to: string|null, accounts_count: number}[]} [props.profiles]
 * @param {boolean} [props.canWrite]
 * @param {boolean} [props.canRead] tautan ke detail hanya bila boleh membaca
 * @returns {import("react").JSX.Element}
 */
export default function Index({
  profiles = [],
  canWrite = false,
  canRead = false,
}) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const title = t("finances.postingProfile.title");

  return (
    <AppLayout>
      <Head title={title} />
      <div className="grid gap-4 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {t("finances.postingProfile.list.subtitle")}
            </p>
          </div>
          {canWrite && (
            <Button asChild>
              <Link href={route("postingProfiles.form")}>
                {t("finances.postingProfile.list.add")}
              </Link>
            </Button>
          )}
        </div>

        {profiles.length === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="empty-state"
          >
            {t("finances.postingProfile.list.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">
                    {t("finances.postingProfile.columns.name")}
                  </th>
                  <th className="px-3 py-2">
                    {t("finances.postingProfile.columns.version")}
                  </th>
                  <th className="px-3 py-2">
                    {t("finances.postingProfile.columns.status")}
                  </th>
                  <th className="px-3 py-2">
                    {t("finances.postingProfile.columns.effective_from")}
                  </th>
                  <th className="px-3 py-2">
                    {t("finances.postingProfile.columns.effective_to")}
                  </th>
                  <th className="px-3 py-2">
                    {t("finances.postingProfile.accounts")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="border-t"
                    data-testid="posting-profile"
                  >
                    <td className="px-3 py-2">
                      {canRead ? (
                        <Link
                          href={route("postingProfiles.show", profile.id)}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {profile.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{profile.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{profile.version}</td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[profile.status]}>
                        {t(
                          `finances.postingProfile.columns.status.options.${profile.status}`,
                        )}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{profile.effective_from}</td>
                    <td className="px-3 py-2">
                      {profile.effective_to ??
                        t("finances.postingProfile.open_ended")}
                    </td>
                    <td className="px-3 py-2">
                      {t("finances.postingProfile.list.mapped", {
                        count: profile.accounts_count,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
