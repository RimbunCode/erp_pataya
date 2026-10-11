// GroupLabel — label header grup (nilai grup dirender spt sel kolomnya). Dipindah
// APA ADANYA dari Table2.jsx (spec datatable2-group-tree, task 7.4) supaya
// GroupHeaderRow tak perlu mengimpor Table2 (impor melingkar). Table2 masih
// me-re-export untuk kompatibilitas.

import { format } from "date-fns";
import { memo } from "react";
import { usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { TZDate } from "@date-fns/tz";

import BadgeStatus from "../../BadgeStatus";
import { formatNumber } from "@/Components/NumberInput/formatNumber";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { getLocaleDate } from "@/lib/utils";

// Label header grup -- cermin dari switch(type) di Cell, tapi sumber value-nya
// DESKRIPTOR grup dari backend (lihat groupDisplay.groupLabelValue), BUKAN baris
// penuh -- jadi case yg butuh field LAIN dari row (mis. formStatus baca
// row.appendStatus) direpresentasikan pakai nilai grup itu sendiri (utk
// formStatus/formStatuses: value = status mentah, cukup utk <BadgeStatus
// status=.../> render badge yg mewakili grup itu).
// "Tanpa nilai" dicek eksplisit thd null/undefined/"" -- BUKAN falsy JS biasa,
// supaya boolean `false` & number `0` (nilai sah) tidak ikut ke-treat sbg
// kosong seperti bug lama.
// `value` utk date/time/datetime & number/currency adalah KUNCI BUCKET dari
// backend (mis. "2026-Q1", 100) -- granularity/rangeSize (nilai EFEKTIF dari
// `groupMeta.levels`, yang dipakai SQL) dibutuhkan utk decode kunci itu jadi
// label manusiawi (mis. "2026-Q1" -> "Kuartal 1 2026", 100 -> "100 - 200").
export const GroupLabel = memo(
  ({ type, value, column, granularity, rangeSize }) => {
    const { lang, preferences } = usePage().props;
    const { t } = useLaravelReactI18n();
    if (value === null || value === undefined || value === "") {
      return t("core.datatable.no_group_value");
    }
    switch (type) {
      case "relation":
        return convertTemplateLink(value);
      case "formStatus":
      case "formStatuses":
        // formStatuses (jamak): value ARRAY status (mis. ["approved","pending"])
        // -- render satu BadgeStatus per elemen, cermin cara Cell.jsx render
        // baris (row.appendStatus.map(...)). formStatus (tunggal): value
        // scalar string, satu badge spt sebelumnya.
        return Array.isArray(value) ? (
          <div className="flex flex-wrap gap-x-1 gap-y-1">
            {value.map((status, idx) => (
              <BadgeStatus key={idx} status={status} />
            ))}
          </div>
        ) : (
          <BadgeStatus status={value} />
        );
      case "boolean": {
        const key = String(value);
        return (
          column?.parse?.[key] ??
          t(value ? "core.datatable.yes" : "core.datatable.no")
        );
      }
      case "date":
      case "time":
      case "datetime":
        switch (granularity) {
          case "quarter": {
            const [y, q] = String(value).split("-Q");
            return `${t("core.datatable.granularity.quarter")} ${q} ${y}`;
          }
          case "half": {
            const [y, h] = String(value).split("-H");
            return `${t("core.datatable.granularity.half")} ${h} ${y}`;
          }
          case "year":
            return String(value);
          case "day":
            return format(new TZDate(value, "UTC"), "PPP", {
              locale: getLocaleDate(lang),
            });
          case "month":
          default: {
            const [y, m] = String(value).split("-").map(Number);
            return format(new Date(y, m - 1, 1), "MMMM yyyy", {
              locale: getLocaleDate(lang),
            });
          }
        }
      case "number":
      case "currency": {
        let prefix = "";
        if (type === "currency") {
          const symbol =
            typeof column?.currencyCode === "object"
              ? column.currencyCode?.symbol
              : null;
          prefix = symbol ? `${symbol} ` : "";
        }
        const fmtOpts = {
          numberFormat:
            column?.numberFormat ?? preferences?.default_number_format,
          decimalScale: column?.decimalScale,
          groupSeparator: column?.groupSeparator,
          decimalSeparator: column?.decimalSeparator,
          prefix,
        };
        const size = Number(rangeSize) || 0;
        const lower = Number(value);
        return size > 0
          ? `${formatNumber(lower, fmtOpts)} - ${formatNumber(lower + size, fmtOpts)}`
          : formatNumber(lower, fmtOpts);
      }
      case "html":
        return <span dangerouslySetInnerHTML={{ __html: value ?? "" }} />;
      case "string":
      default:
        return column?.valueTrans
          ? t(`${column.valueTrans}.${value}`)
          : column?.parse
            ? (column.parse[value] ?? value)
            : value;
    }
  },
);
GroupLabel.displayName = "TableGroupLabel";

export default GroupLabel;
