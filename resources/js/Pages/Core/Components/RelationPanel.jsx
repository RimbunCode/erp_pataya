import { useState } from "react";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { ChevronDownIcon } from "lucide-react";

import BadgeStatus from "@/Components/BadgeStatus";
import { Button } from "@/Components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";
import Link from "@/Components/Link";
import { cn, getLocaleDate } from "@/lib/utils";
import { formatNumber } from "@/Components/NumberInput/formatNumber";

const ALIGN_CLASS = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/**
 * Daftar badge status, sama dengan sel formStatuses di Table2: status
 * berbentuk array, satu badge per nilai.
 * @param {{statuses: string[]}} props
 * @returns {JSX.Element}
 */
function StatusBadges({ statuses }) {
  return (
    <span className="flex flex-wrap gap-1">
      {statuses.map((status, index) => (
        <BadgeStatus
          key={index}
          className="text-xs py-0.5 px-2"
          status={status}
        />
      ))}
    </span>
  );
}

/**
 * Format satu sel sesuai `format` kolom dari backend. Angka dan mata uang
 * memakai pola pemisah company (preferences.default_number_format).
 * @param {number|string|string[]|null|undefined} value
 * @param {{format?: string}} column
 * @param {{lang?: string, numberFormat?: string}} options
 * @returns {string|JSX.Element}
 */
function formatCell(value, column, { lang, numberFormat }) {
  if (value === null || value === undefined || value === "") return "";
  switch (column.format) {
    case "date":
      return format(new TZDate(value), "PP", { locale: getLocaleDate(lang) });
    case "number":
    case "currency":
      return formatNumber(value, { numberFormat });
    case "status":
      return <StatusBadges statuses={Array.isArray(value) ? value : [value]} />;
    default:
      return String(value);
  }
}

function HeaderRow({ columns, t }) {
  return (
    <thead>
      <tr className="border-b">
        {columns.map((column) => (
          <th
            key={column.key}
            scope="col"
            className={cn("px-3 py-2 font-medium", ALIGN_CLASS[column.align])}
          >
            {t(column.label)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * Satu baris dokumen. Baris yang punya `detail_rows` dapat dibuka untuk
 * menampilkan item yang dibawanya. Baris lain tampil seperti biasa.
 * @param {object} props
 * @param {object} props.panel
 * @param {object} props.row
 * @param {{lang?: string, numberFormat?: string}} props.formatOptions
 * @returns {JSX.Element}
 */
function PanelRow({ panel, row, formatOptions }) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);
  const detailRows = row.detail_rows ?? [];
  const hasDetail = detailRows.length > 0;
  const detailColumns = panel.detail_columns ?? [];

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <tbody>
        <tr className="border-b last:border-0">
          {panel.columns.map((column, index) => {
            const text = formatCell(row[column.key], column, formatOptions);
            return (
              <td
                key={column.key}
                className={cn("px-3 py-2", ALIGN_CLASS[column.align])}
              >
                <span className="inline-flex items-center gap-x-2">
                  {index === 0 && hasDetail && (
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        aria-label={t(
                          open ? "core.form.show_less" : "core.form.show_more",
                        )}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDownIcon
                          className={cn(
                            "size-4 transition-transform duration-200",
                            open && "rotate-180",
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                  )}
                  {index === 0 ? (
                    <Link
                      href={window.route(panel.route, row.id)}
                      className="text-blue-800 hover:underline dark:text-blue-200"
                    >
                      {text}
                    </Link>
                  ) : (
                    text
                  )}
                </span>
              </td>
            );
          })}
        </tr>
        {hasDetail && (
          <CollapsibleContent asChild>
            <tr>
              <td colSpan={panel.columns.length} className="px-3 pb-3">
                <table className="w-full text-sm">
                  <HeaderRow columns={detailColumns} t={t} />
                  <tbody>
                    {detailRows.map((detailRow, index) => (
                      <tr key={index} className="border-b last:border-0">
                        {detailColumns.map((column) => (
                          <td
                            key={column.key}
                            className={cn(
                              "px-3 py-2",
                              ALIGN_CLASS[column.align],
                            )}
                          >
                            {formatCell(
                              detailRow[column.key],
                              column,
                              formatOptions,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </CollapsibleContent>
        )}
      </tbody>
    </Collapsible>
  );
}

/**
 * Blok item yang belum diterima atau belum ditagihkan, di bawah daftar dokumen.
 * @param {object} props
 * @param {{title: string, columns: object[], rows: object[]}} props.remainder
 * @param {{lang?: string, numberFormat?: string}} props.formatOptions
 * @returns {JSX.Element}
 */
function RemainderBlock({ remainder, formatOptions }) {
  const { t } = useLaravelReactI18n();

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{t(remainder.title)}</h4>
      <table className="w-full text-sm">
        <HeaderRow columns={remainder.columns} t={t} />
        <tbody>
          {remainder.rows.map((row, index) => (
            <tr key={index} className="border-b last:border-0">
              {remainder.columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-3 py-2", ALIGN_CLASS[column.align])}
                >
                  {formatCell(row[column.key], column, formatOptions)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Satu kartu panel relasi: judul, tombol aksi, tabel, baris total, dan blok
 * sisa bila ada. Kolom pertama tiap baris menjadi tautan ke dokumen tersebut.
 * @param {object} props
 * @param {object} props.panel payload satu entri dari RelationPanelService
 * @returns {JSX.Element}
 */
export default function RelationPanel({ panel }) {
  const { t } = useLaravelReactI18n();
  const props = usePage().props;
  const formatOptions = {
    lang: props?.lang,
    numberFormat: props?.preferences?.default_number_format,
  };
  const totals = panel.totals ?? {};
  const hasTotals = Object.keys(totals).length > 0;

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-x-4">
        <h3 className="text-sm font-semibold">{t(panel.title)}</h3>
        {panel.action && (
          <Button asChild variant="outline" size="sm">
            <Link href={panel.action.url}>{t(panel.action.label)}</Link>
          </Button>
        )}
      </div>

      {panel.is_empty ? (
        <p className="text-sm text-muted-foreground">
          {t("core.form.relation_empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <HeaderRow columns={panel.columns} t={t} />
            {panel.rows.map((row) => (
              <PanelRow
                key={row.id}
                panel={panel}
                row={row}
                formatOptions={formatOptions}
              />
            ))}
            {hasTotals && (
              <tfoot>
                <tr className="border-t font-semibold">
                  {panel.columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn("px-3 py-2", ALIGN_CLASS[column.align])}
                    >
                      {column.key in totals
                        ? formatCell(totals[column.key], column, formatOptions)
                        : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {panel.remainder && (
        <RemainderBlock
          remainder={panel.remainder}
          formatOptions={formatOptions}
        />
      )}
    </section>
  );
}
