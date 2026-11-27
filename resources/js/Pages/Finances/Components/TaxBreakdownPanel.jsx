import { Deferred, usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import Link from "@/Components/Link";
import { Skeleton } from "@/Components/ui/skeleton";
import { FormPageContent } from "@/Pages/Core/FormPage";
import useMoneyFormat from "@/Pages/Finances/Journals/useMoneyFormat";

function TaxBreakdownSkeleton() {
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

const WARNING_CODES = ["snapshot_build_failed", "persisted_vs_engine_mismatch"];

/**
 * Teks peringatan untuk kode dari server; kode yang belum dikenal tampil apa adanya agar tidak hilang diam-diam.
 * @param {(key: string, params?: object) => string} t
 * @param {string} code
 * @returns {string}
 */
function warningText(t, code) {
  return WARNING_CODES.includes(code)
    ? t(`finances.taxBreakdown.warnings.${code}`)
    : t("finances.taxBreakdown.warnings.unknown", { code });
}

function VersionCell({ row, canViewVersions, t }) {
  if (row.is_legacy || !row.version) {
    return <span>{t("finances.taxBreakdown.version.legacy")}</span>;
  }
  if (row.version.missing) {
    return <span>{t("finances.taxBreakdown.version.missing")}</span>;
  }

  const label = t("finances.taxBreakdown.version.label", {
    number: row.version.number,
  });
  const mode = row.version.rounding_mode
    ? ` (${t(`finances.taxRuleVersion.columns.rounding_mode.options.${row.version.rounding_mode}`)})`
    : "";

  return canViewVersions && row.tax_id ? (
    <>
      <Link
        href={window.route("taxes.show", row.tax_id)}
        className="text-blue-800 hover:underline dark:text-blue-200"
      >
        {label}
      </Link>
      {mode}
    </>
  ) : (
    <span>
      {label}
      {mode}
    </span>
  );
}

function PanelTable({ panel, t }) {
  const money = useMoneyFormat(panel.minor_unit ?? 2);
  const rows = panel.rows ?? [];

  return (
    <div className="overflow-x-auto px-1 py-1">
      <table className="w-full text-sm" data-testid="tax-breakdown-rows">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-3 py-2 font-medium">
              {t("finances.taxBreakdown.columns.line")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("finances.taxBreakdown.columns.tax")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("finances.taxBreakdown.columns.base_amount")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("finances.taxBreakdown.columns.dpp_factor")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("finances.taxBreakdown.columns.dpp_amount")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("finances.taxBreakdown.columns.rate")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("finances.taxBreakdown.columns.tax_amount")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("finances.taxBreakdown.columns.rounding_adjustment")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("finances.taxBreakdown.columns.version")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.line ?? "x"}|${row.tax_id}|${index}`}
              className="border-b last:border-0 align-top"
              data-testid="tax-breakdown-row"
            >
              <td className="px-3 py-2">{row.line ?? ""}</td>
              <td className="px-3 py-2">{row.tax_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {money(row.base_amount)}
              </td>
              <td className="px-3 py-2">{row.dpp_factor}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {money(row.dpp_amount)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.rate}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {money(row.tax_amount)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {money(row.rounding_adjustment)}
              </td>
              <td className="px-3 py-2">
                <VersionCell
                  row={row}
                  canViewVersions={panel.can_view_versions}
                  t={t}
                />
                {(row.warnings ?? []).map((code) => (
                  <p
                    key={code}
                    role="note"
                    className="mt-1 text-xs text-amber-800 dark:text-amber-200"
                  >
                    {warningText(t, code)}
                  </p>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
        {panel.totals && (
          <tfoot>
            <tr className="border-t font-medium">
              <td className="px-3 py-2" colSpan={6}>
                {t("finances.taxBreakdown.totals.additive")}
              </td>
              <td
                className="px-3 py-2 text-right tabular-nums"
                data-testid="tax-breakdown-total-additive"
              >
                {money(panel.totals.additive)}
              </td>
              <td colSpan={2} />
            </tr>
            {Number(panel.totals.withholding) !== 0 && (
              <tr className="font-medium">
                <td className="px-3 py-2" colSpan={6}>
                  {t("finances.taxBreakdown.totals.withholding")}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  data-testid="tax-breakdown-total-withholding"
                >
                  {money(panel.totals.withholding)}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * Isi panel sesuai `state` dari TaxBreakdownPanel (backend). Hanya menampilkan nilai dari server: angka DPP, tarif,
 * dan pajak tidak dihitung ulang di klien.
 * @param {{panel: object, t: (key: string, params?: object) => string}} props
 * @returns {import("react").JSX.Element}
 */
function PanelBody({ panel, t }) {
  switch (panel?.state) {
    case "snapshot":
    case "legacy":
    case "pending":
      return (
        <div className="space-y-1">
          <PanelNote>
            {t(`finances.taxBreakdown.states.${panel.state}`)}
          </PanelNote>
          {(panel.warnings ?? []).map((code) => (
            <PanelNote key={code} role="alert">
              {warningText(t, code)}
            </PanelNote>
          ))}
          {(panel.rows ?? []).length > 0 && <PanelTable panel={panel} t={t} />}
        </div>
      );
    case "none":
      return <PanelNote>{t("finances.taxBreakdown.states.none")}</PanelNote>;
    default:
      return <PanelNote>{t("finances.taxBreakdown.states.error")}</PanelNote>;
  }
}

/**
 * Panel baca-saja "Rincian Pajak" pada halaman detail Sales/Purchase Invoice (Finance Fase 3, Requirement 5.5,
 * 5.6, 10.2). Dokumen baru (`isNew`) belum punya data. Dokumen tersimpan memuat deferred prop `taxBreakdown`,
 * jadi halaman tampil dulu dan skeleton tampil sementara.
 * @param {{isNew?: boolean}} props
 * @returns {import("react").JSX.Element}
 */
export default function TaxBreakdownPanel({ isNew = false }) {
  const { t } = useLaravelReactI18n();
  const panel = usePage().props.taxBreakdown;

  return (
    <FormPageContent
      value="detail"
      title={t("finances.taxBreakdown.title")}
      collapsible
    >
      {isNew ? (
        <PanelNote>{t("finances.taxBreakdown.states.new")}</PanelNote>
      ) : (
        <Deferred data={["taxBreakdown"]} fallback={<TaxBreakdownSkeleton />}>
          <PanelBody panel={panel} t={t} />
        </Deferred>
      )}
    </FormPageContent>
  );
}
