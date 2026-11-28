import { useState } from "react";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import InputError from "@/Components/InputError";
import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Tanggal lokal hari ini (`YYYY-MM-DD`) sebagai nilai awal tanggal kurs.
 * @returns {string}
 */
export function todayLocal() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Nilai awal kurs untuk koreksi: hanya bila berupa desimal polos (titik); format lain dikosongkan agar pengguna
 * mengisi ulang, bukan mengirim teks terformat.
 * @param {unknown} rate
 * @returns {string}
 */
export function initialRate(rate) {
  const text = rate === null || rate === undefined ? "" : String(rate).trim();
  return PLAIN_DECIMAL.test(text) ? text : "";
}

function rowDate(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <InputError message={error} />
    </div>
  );
}

/**
 * Dialog tambah kurs (`row` null) atau koreksi nilai kurs yang belum dirujuk (`row` terisi). Tanpa elemen `<form>`;
 * penulisan lewat `router` ke `exchangeRates.save` / `exchangeRates.correct`, galat domain tampil per kolom.
 * @param {object} props
 * @param {string[]} props.rateTypes tipe kurs dari server
 * @param {object|null} props.row baris kurs yang dikoreksi; null untuk kurs baru
 * @param {() => void} props.onClose
 * @returns {import("react").JSX.Element}
 */
export default function RateFormDialog({ rateTypes, row, onClose }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const isCorrection = Boolean(row);
  const [values, setValues] = useState({
    from_currency_code: row?.from_currency_code ?? "",
    to_currency_code: row?.to_currency_code ?? "",
    rate_type: row?.rate_type ?? rateTypes?.[0] ?? "transaction",
    rate: initialRate(row?.rate),
    rate_date: todayLocal(),
  });
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const set = (name) => (event) =>
    setValues((previous) => ({ ...previous, [name]: event.target.value }));

  const submit = () => {
    const options = {
      preserveScroll: true,
      onStart: () => setProcessing(true),
      onFinish: () => setProcessing(false),
      onError: (bag) => setErrors(bag ?? {}),
      onSuccess: () => onClose(),
    };

    if (isCorrection) {
      router.put(
        route("exchangeRates.correct", row.id),
        { rate: values.rate.trim() },
        options,
      );
    } else {
      router.post(
        route("exchangeRates.save"),
        {
          from_currency_code: values.from_currency_code.trim().toUpperCase(),
          to_currency_code: values.to_currency_code.trim().toUpperCase(),
          rate_type: values.rate_type,
          rate: values.rate.trim(),
          rate_date: values.rate_date,
        },
        options,
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCorrection
              ? t("finances.exchangeRate.page.correct")
              : t("finances.exchangeRate.page.add")}
          </DialogTitle>
          <DialogDescription>
            {isCorrection
              ? t("finances.exchangeRate.page.correct_description")
              : t("finances.exchangeRate.page.form_description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="exchange-rate-from"
            label={t("finances.exchangeRate.columns.from_currency_code")}
            error={errors.from_currency_code}
            hint={t("finances.exchangeRate.page.currency_hint")}
          >
            <Input
              id="exchange-rate-from"
              maxLength={10}
              disabled={isCorrection}
              value={values.from_currency_code}
              onChange={set("from_currency_code")}
            />
          </Field>
          <Field
            id="exchange-rate-to"
            label={t("finances.exchangeRate.columns.to_currency_code")}
            error={errors.to_currency_code}
          >
            <Input
              id="exchange-rate-to"
              maxLength={10}
              disabled={isCorrection}
              value={values.to_currency_code}
              onChange={set("to_currency_code")}
            />
          </Field>
          <Field
            id="exchange-rate-type"
            label={t("finances.exchangeRate.columns.rate_type")}
            error={errors.rate_type}
          >
            <select
              id="exchange-rate-type"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              disabled={isCorrection}
              value={values.rate_type}
              onChange={set("rate_type")}
            >
              {(rateTypes ?? []).map((type) => (
                <option key={type} value={type}>
                  {t(`finances.exchangeRate.columns.rate_type.options.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="exchange-rate-date"
            label={t("finances.exchangeRate.columns.rate_date")}
            error={errors.rate_date}
          >
            <Input
              id="exchange-rate-date"
              type="date"
              disabled={isCorrection}
              value={isCorrection ? rowDate(row?.rate_date) : values.rate_date}
              onChange={set("rate_date")}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="exchange-rate-rate"
              label={t("finances.exchangeRate.columns.rate")}
              error={errors.rate}
            >
              <Input
                id="exchange-rate-rate"
                inputMode="decimal"
                value={values.rate}
                onChange={set("rate")}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("finances.exchangeRate.page.cancel")}
          </Button>
          <Button type="button" disabled={processing} onClick={submit}>
            {t("finances.exchangeRate.page.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
