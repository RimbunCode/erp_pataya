import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/Components/ui/badge";
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { cn, getLocaleDate } from "@/lib/utils";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useMoneyFormat from "./useMoneyFormat";

const STATUS_VARIANT = {
  posted: "default",
  reversed: "secondary",
  voided: "destructive",
};

function Field({ label, children, testId }) {
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function AccountCell({ account }) {
  const route = window.route;
  if (!account) {
    return null;
  }

  return (
    <Link
      href={route("accounts.show", account.id)}
      className={cn(account.deleted_at && "line-through")}
    >
      {account.account_number ? `${account.account_number} - ` : ""}
      {account.account_name}
    </Link>
  );
}

/**
 * Header jurnal, tabel baris, total, dan indikator seimbang (Requirement 11.1).
 * Total dan keseimbangan dihitung server dalam minor unit (`totals`), bukan dari
 * penjumlahan float di sini.
 * @param {object} props
 * @param {object[]} [props.lines] baris jurnal (termasuk yang soft-deleted)
 * @param {object} [props.totals] total, keseimbangan, dan jumlah baris aktif
 * @param {number} [props.minorUnit] desimal mata uang dasar jurnal
 * @returns {import("react").JSX.Element}
 */
export default function Form({ lines = [], totals, minorUnit = 2 }) {
  const { t, currentLocale } = useLaravelReactI18n();
  const route = window.route;
  const { data } = useFormPage();
  const money = useMoneyFormat(minorUnit);
  const none = t("finances.journal.header.no_value");

  const source = data?.source;
  const sourceLabel = source ? convertTemplateLink(source) : "";
  const reverses = data?.reverses;
  const reversedBy = data?.reversed_by;
  const status = data?.status;

  return (
    <FormPageContent value="detail" title={t("finances.journal.detail")}>
      <dl className="grid gap-x-4 gap-y-4 md:grid-cols-3">
        <Field label={t("finances.journal.columns.code")} testId="journal-code">
          {data?.code}
        </Field>
        <Field label={t("finances.journal.columns.transaction_date")}>
          {data?.transaction_date
            ? format(new Date(data.transaction_date), "PPP", {
                locale: getLocaleDate(currentLocale?.()),
              })
            : none}
        </Field>
        <Field
          label={t("finances.journal.columns.status")}
          testId="journal-status"
        >
          {status ? (
            <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
              {t(`finances.journal.columns.status.options.${status}`)}
            </Badge>
          ) : (
            none
          )}
        </Field>
        <Field label={t("finances.journal.columns.fiscal_period")}>
          {data?.fiscal_period?.name ?? none}
        </Field>
        <Field label={t("finances.journal.columns.branch")}>
          {data?.branch?.name ?? none}
        </Field>
        <Field label={t("finances.journal.columns.currency_code")}>
          {data?.currency_code ?? none}
        </Field>
        <Field
          label={t("finances.journal.columns.source")}
          testId="journal-source"
        >
          {source?.route && source?.id ? (
            <Link href={route(`${source.route}.show`, source.id)}>
              {sourceLabel || t("finances.journal.actions.view_source")}
            </Link>
          ) : (
            none
          )}
        </Field>
        {reverses && (
          <Field
            label={t("finances.journal.columns.reverses")}
            testId="journal-reverses"
          >
            <Link href={route("journals.show", reverses.id)}>
              {reverses.code}
            </Link>
          </Field>
        )}
        {reversedBy && (
          <Field
            label={t("finances.journal.columns.reversed_by")}
            testId="journal-reversed-by"
          >
            <Link href={route("journals.show", reversedBy.id)}>
              {reversedBy.code}
            </Link>
          </Field>
        )}
        {data?.reversal_reason && (
          <Field label={t("finances.journal.columns.reversal_reason")}>
            {data.reversal_reason}
          </Field>
        )}
        <div className="md:col-span-3">
          <Field label={t("finances.journal.columns.description")}>
            {data?.description ?? none}
          </Field>
        </div>
      </dl>

      {data?.legacy_origin && (
        <p className="mt-4 text-sm text-muted-foreground" role="note">
          {data.legacy_unbalanced
            ? t("finances.journal.legacy_unbalanced_notice")
            : t("finances.journal.legacy_notice")}
        </p>
      )}
      {status === "voided" && (
        <p className="mt-4 text-sm text-muted-foreground" role="note">
          {t("finances.journal.voided_notice")}
        </p>
      )}

      <h3 className="mt-6 mb-2 text-sm font-semibold">
        {t("finances.journal.lines")}
      </h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" data-testid="journal-lines">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">
                {t("finances.journal.line_columns.line_no")}
              </th>
              <th className="px-3 py-2">
                {t("finances.journal.line_columns.account")}
              </th>
              <th className="px-3 py-2">
                {t("finances.journal.line_columns.against_account")}
              </th>
              <th className="px-3 py-2">
                {t("finances.journal.line_columns.description")}
              </th>
              <th className="px-3 py-2 text-right">
                {t("finances.journal.line_columns.debit")}
              </th>
              <th className="px-3 py-2 text-right">
                {t("finances.journal.line_columns.credit")}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-muted-foreground"
                >
                  {t("finances.journal.empty_lines")}
                </td>
              </tr>
            )}
            {lines.map((line) => (
              <tr
                key={line.id}
                data-testid="journal-line"
                className={cn(
                  "border-t",
                  line.deleted_at && "text-muted-foreground line-through",
                )}
              >
                <td className="px-3 py-2">
                  {line.line_no ?? ""}
                  {line.deleted_at && (
                    <span className="sr-only">
                      {t("finances.journal.line_columns.deleted")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <AccountCell account={line.account} />
                </td>
                <td className="px-3 py-2">
                  {line.against_account ? (
                    <AccountCell account={line.against_account} />
                  ) : (
                    <span className="text-muted-foreground">
                      {t("finances.journal.line_columns.multiple")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(line.debit) !== 0 ? money(line.debit) : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(line.credit) !== 0 ? money(line.credit) : ""}
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-3 py-2" colSpan={4}>
                  <span className="mr-3">
                    {t("finances.journal.totals.title")}
                  </span>
                  <span
                    data-testid="journal-balance"
                    data-balanced={totals.balanced ? "true" : "false"}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      totals.balanced
                        ? "text-green-700 dark:text-green-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {totals.balanced ? (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-4" aria-hidden="true" />
                    )}
                    {totals.balanced
                      ? t("finances.journal.totals.balanced")
                      : t("finances.journal.totals.unbalanced")}
                  </span>
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  data-testid="journal-total-debit"
                >
                  {money(totals.debit)}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  data-testid="journal-total-credit"
                >
                  {money(totals.credit)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </FormPageContent>
  );
}
