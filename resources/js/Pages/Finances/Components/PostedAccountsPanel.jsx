import { Deferred, usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import Link from "@/Components/Link";
import { Skeleton } from "@/Components/ui/skeleton";
import { FormPageContent } from "@/Pages/Core/FormPage";

function PostedAccountsSkeleton() {
  return (
    <div className="space-y-2 px-1 py-1" aria-hidden="true">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function PanelNote({ children, role = "status" }) {
  return (
    <p role={role} className="px-1 py-1 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function PanelTable({ rows, t }) {
  return (
    <div className="overflow-x-auto px-1 py-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-3 py-2 font-medium">
              {t("finances.postedAccounts.columns.role")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("finances.postedAccounts.columns.account")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("finances.postedAccounts.columns.lines")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.role}|${row.account.id}`}
              className="border-b last:border-0"
            >
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2">
                {[row.account.number, row.account.name]
                  .filter(Boolean)
                  .join(" - ")}
              </td>
              <td className="px-3 py-2 text-right">
                {row.lines > 0 ? row.lines : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Isi panel sesuai `state` dari PostedAccountPanel (backend). Hanya membaca
 * `postedAccounts` dari props halaman: tidak ada input dan tidak pernah
 * menyentuh data form, sehingga akun tidak ikut terkirim ke server (P-14).
 * @param {{panel: object, t: (key: string) => string}} props
 * @returns {JSX.Element}
 */
function PanelBody({ panel, t }) {
  switch (panel?.state) {
    case "preview":
    case "recorded":
      return (
        <div className="space-y-1">
          <PanelNote>
            {t(`finances.postedAccounts.states.${panel.state}`)}
          </PanelNote>
          {panel.estimated && (
            <PanelNote>
              {t("finances.postedAccounts.states.estimated")}
            </PanelNote>
          )}
          <PanelTable rows={panel.rows ?? []} t={t} />
        </div>
      );
    case "error":
      return (
        <div className="space-y-1">
          <PanelNote role="alert">{panel.message}</PanelNote>
          {panel.fixable &&
            (panel.canFixProfile ? (
              <p className="px-1 py-1 text-sm">
                <Link
                  href={window.route("postingProfiles.index")}
                  className="text-blue-800 hover:underline dark:text-blue-200"
                >
                  {t("finances.postedAccounts.fix_profile")}
                </Link>
              </p>
            ) : (
              <PanelNote>
                {t("finances.postedAccounts.fix_profile_admin")}
              </PanelNote>
            ))}
        </div>
      );
    case "pending_approval":
    case "pending_posting":
    case "no_journal":
    case "unavailable":
      return (
        <PanelNote>
          {t(`finances.postedAccounts.states.${panel.state}`)}
        </PanelNote>
      );
    default:
      return (
        <PanelNote>{t("finances.postedAccounts.states.unavailable")}</PanelNote>
      );
  }
}

/**
 * Panel baca-saja "Akun pencatatan" pada halaman dokumen (Finance Fase 2,
 * Task 12.4; Requirement 13.4 dan 13.7). Dokumen baru (`isNew`) belum punya data
 * untuk dipratinjau. Dokumen tersimpan memuat deferred prop `postedAccounts`,
 * jadi halaman tampil dulu dan skeleton tampil sementara.
 * @param {{isNew?: boolean}} props
 * @returns {JSX.Element}
 */
export default function PostedAccountsPanel({ isNew = false }) {
  const { t } = useLaravelReactI18n();
  const panel = usePage().props.postedAccounts;

  return (
    <FormPageContent
      value="detail"
      title={t("finances.postedAccounts.title")}
      collapsible
    >
      {isNew ? (
        <PanelNote>{t("finances.postedAccounts.states.new")}</PanelNote>
      ) : (
        <Deferred
          data={["postedAccounts"]}
          fallback={<PostedAccountsSkeleton />}
        >
          <PanelBody panel={panel} t={t} />
        </Deferred>
      )}
    </FormPageContent>
  );
}
