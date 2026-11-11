import { CheckCircle2, XCircle } from "lucide-react";
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { useMemo } from "react";

import AccountLinkModel from "@/Pages/Finances/Accounts/AccountLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import NumberInput from "@/Components/NumberInput";
import { Textarea } from "@/Components/ui/textarea";
import { cn } from "@/lib/utils";
import { summarizeBalance } from "./balance";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import useMoneyFormat from "@/Pages/Finances/Journals/useMoneyFormat";

// Akun grup dan akun nonaktif tidak dapat diposting JournalService.
const ACCOUNT_FILTERS = { is_group: false };

/**
 * Indikator seimbang waktu nyata: ikon dan teks (tidak bergantung pada warna saja). Perhitungan memakai minor unit
 * mata uang dasar, sama dengan validasi server.
 * @param {object} props
 * @param {object[]} props.items baris voucher
 * @param {number} props.minorUnit
 * @returns {import("react").JSX.Element}
 */
export function BalanceIndicator({ items, minorUnit }) {
  const { t } = useLaravelReactI18n();
  const money = useMoneyFormat(minorUnit);
  const summary = useMemo(
    () => summarizeBalance(items, minorUnit),
    [items, minorUnit],
  );
  const divisor = 10 ** minorUnit;
  const balanced = summary.state === "balanced";

  let message = t("finances.journalVoucher.balance.balanced");
  if (summary.state === "too_few") {
    message = t("finances.journalVoucher.balance.too_few");
  } else if (summary.state === "unbalanced") {
    message = t("finances.journalVoucher.balance.unbalanced", {
      difference: money(Math.abs(summary.differenceMinor) / divisor),
    });
  }

  return (
    <div
      className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
      data-testid="voucher-balance-panel"
    >
      <span
        role="status"
        data-testid="voucher-balance"
        data-state={summary.state}
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium",
          balanced
            ? "text-green-700 dark:text-green-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        {balanced ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <XCircle className="size-4" aria-hidden="true" />
        )}
        {message}
      </span>
      <dl className="flex gap-6 text-sm tabular-nums">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">
            {t("finances.journalVoucher.columns.debit")}
          </dt>
          <dd data-testid="voucher-total-debit">
            {money(summary.debitMinor / divisor)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">
            {t("finances.journalVoucher.columns.credit")}
          </dt>
          <dd data-testid="voucher-total-credit">
            {money(summary.creditMinor / divisor)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Kolom tabel baris voucher. Tepat satu sisi yang bernilai: mengisi debit mengosongkan kredit dan sebaliknya.
 * @param {(key: string) => string} t
 * @param {number} minorUnit
 * @returns {object[]}
 */
export function buildVoucherItemColumns(t, minorUnit) {
  return [
    {
      name: "account",
      titleTrans: "finances.journalVoucher.columns.account",
      required: true,
      width: 4,
      cell({ data: value, setData, attributes }) {
        return (
          <AccountLinkModel
            placeholder={t(
              "finances.journalVoucher.columns.account.placeholder",
            )}
            value={value}
            filters={ACCOUNT_FILTERS}
            onValueChange={(account) => setData("account", account)}
            {...attributes}
          />
        );
      },
    },
    {
      name: "description",
      titleTrans: "finances.journalVoucher.columns.item_description",
      show: true,
      width: 3,
      cell({ data: value, setData, attributes }) {
        return (
          <Input
            value={value ?? ""}
            onChange={(e) => setData("description", e.target.value)}
            {...attributes}
          />
        );
      },
    },
    {
      name: "debit",
      titleTrans: "finances.journalVoucher.columns.debit",
      show: true,
      type: "number",
      width: 2,
      cell({ data: value, setData, attributes }) {
        return (
          <NumberInput
            decimalScale={minorUnit}
            value={value}
            onValueChange={(val) =>
              setData(
                Number(val) > 0 ? { debit: val, credit: null } : { debit: val },
              )
            }
            {...attributes}
          />
        );
      },
    },
    {
      name: "credit",
      titleTrans: "finances.journalVoucher.columns.credit",
      show: true,
      type: "number",
      width: 2,
      cell({ data: value, setData, attributes }) {
        return (
          <NumberInput
            decimalScale={minorUnit}
            value={value}
            onValueChange={(val) =>
              setData(
                Number(val) > 0
                  ? { credit: val, debit: null }
                  : { credit: val },
              )
            }
            {...attributes}
          />
        );
      },
    },
  ];
}

export default function Form() {
  const { t } = useLaravelReactI18n();
  const minorUnit = usePage().props?.minorUnit ?? 2;
  const { data, setData, disabled } = useFormPage();
  const columns = useMemo(
    () => buildVoucherItemColumns(t, minorUnit),
    [t, minorUnit],
  );

  return (
    <>
      <FormPageContent title={t("finances.journalVoucher.detail")} value="main">
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="date"
            required={true}
            label={t("finances.journalVoucher.columns.date")}
          >
            <DatetimePicker
              type="datetime"
              value={data?.date}
              onValueChange={(val) => setData("date", val)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="description"
            label={t("finances.journalVoucher.columns.description")}
            className="md:col-span-2"
          >
            <Textarea
              rows={2}
              value={data?.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
              disabled={disabled}
            />
          </FormInput>
        </div>
      </FormPageContent>

      <FormPageContent title={t("finances.journalVoucher.items")} value="items">
        <FormTable
          name="journal-voucher-items"
          className="col-span-full"
          classNameDialog="max-w-(--breakpoint-lg)! w-full!"
          readOnly={disabled}
          columns={columns}
          defaultValueRow={{}}
          value={data?.items ?? []}
          onValueChange={(val) => setData("items", val)}
        />
        <BalanceIndicator items={data?.items} minorUnit={minorUnit} />
      </FormPageContent>
    </>
  );
}
