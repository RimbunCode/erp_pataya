import { useState } from "react";
import { Head, router, useForm } from "@inertiajs/react";
import { TriangleAlert } from "lucide-react";

import AppLayout from "@/Layouts/AppLayout";
import { Badge } from "@/Components/ui/badge";
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
import InputError from "@/Components/InputError";
import { Label } from "@/Components/ui/label";
import { Switch } from "@/Components/ui/switch";
import { Textarea } from "@/Components/ui/textarea";
import { getLocaleDate } from "@/lib/utils";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Dialog buka/tutup periode: alasan opsional (dicatat di log audit,
 * `data_after.reason`), lalu `PUT fiscalPeriods.close|open`.
 * @param {object} props
 * @param {{period: object, action: "close"|"open"} | null} props.target
 * @param {() => void} props.onClose
 * @returns {import("react").JSX.Element}
 */
function PeriodStatusDialog({ target, onClose }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const form = useForm({ reason: "" });
  const action = target?.action ?? "close";

  const submit = (event) => {
    event.preventDefault();
    form.put(route(`fiscalPeriods.${action}`, target.period.id), {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target && (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {t(`finances.fiscalPeriod.${action}.title`)}
              </DialogTitle>
              <DialogDescription>
                {t(`finances.fiscalPeriod.${action}.description`, {
                  period: target.period.name,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="fiscal-period-reason">
                {t(`finances.fiscalPeriod.${action}.reason`)}
              </Label>
              <Textarea
                id="fiscal-period-reason"
                value={form.data.reason}
                placeholder={t(
                  `finances.fiscalPeriod.${action}.reason_placeholder`,
                )}
                onChange={(event) => form.setData("reason", event.target.value)}
              />
              <InputError message={form.errors.reason} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t(`finances.fiscalPeriod.${action}.cancel`)}
              </Button>
              <Button type="submit" disabled={form.processing}>
                {t(`finances.fiscalPeriod.${action}.confirm`)}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Index({
  fiscalYears = [],
  enforceFiscalPeriod = false,
  uncoveredCount = 0,
  canGenerate = false,
  canClose = false,
  canReopen = false,
  canEnforce = false,
  defaultYear = new Date().getFullYear(),
}) {
  const { t, currentLocale } = useLaravelReactI18n();
  const route = window.route;
  const [target, setTarget] = useState(null);
  const generateForm = useForm({ year: String(defaultYear) });

  const submitGenerate = (event) => {
    event.preventDefault();
    generateForm.post(route("fiscalPeriods.generate"), {
      preserveScroll: true,
    });
  };

  const toggleEnforcement = (checked) => {
    router.put(
      route("fiscalPeriods.enforcement"),
      { enforce_fiscal_period: checked },
      { preserveScroll: true },
    );
  };

  const title = t("finances.fiscalPeriod.title");

  return (
    <AppLayout>
      <Head title={title} />
      <div className="grid gap-6 pt-4">
        <h1 className="text-xl font-bold">{title}</h1>

        <section
          className="grid gap-3 rounded-md border p-4"
          data-testid="enforcement-section"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor="enforce-fiscal-period" className="font-semibold">
                {t("finances.fiscalPeriod.enforcement.title")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("finances.fiscalPeriod.enforcement.description")}
              </p>
              {!canEnforce && (
                <p className="text-xs text-muted-foreground">
                  {t("finances.fiscalPeriod.enforcement.read_only")}
                </p>
              )}
            </div>
            <Switch
              id="enforce-fiscal-period"
              checked={enforceFiscalPeriod}
              disabled={!canEnforce}
              onCheckedChange={toggleEnforcement}
            />
          </div>
          {uncoveredCount > 0 && (
            <div
              role="alert"
              data-testid="uncovered-warning"
              className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                {t("finances.fiscalPeriod.enforcement.warning", {
                  count: uncoveredCount,
                })}
              </span>
            </div>
          )}
        </section>

        {canGenerate && (
          <form
            onSubmit={submitGenerate}
            className="flex flex-wrap items-end gap-3 rounded-md border p-4"
            data-testid="generate-form"
          >
            <div className="grid gap-2">
              <Label htmlFor="fiscal-year-input">
                {t("finances.fiscalPeriod.generate.year")}
              </Label>
              <Input
                id="fiscal-year-input"
                type="number"
                min={1900}
                max={2200}
                className="w-32"
                value={generateForm.data.year}
                onChange={(event) =>
                  generateForm.setData("year", event.target.value)
                }
              />
            </div>
            <Button type="submit" disabled={generateForm.processing}>
              {t("finances.fiscalPeriod.generate.submit")}
            </Button>
            <InputError
              className="basis-full"
              message={generateForm.errors.year}
            />
          </form>
        )}

        {fiscalYears.length === 0 && (
          <p
            className="text-sm text-muted-foreground"
            data-testid="empty-state"
          >
            {t("finances.fiscalPeriod.list.empty")}
          </p>
        )}

        {fiscalYears.map((year) => (
          <section
            key={year.id}
            className="grid gap-2"
            data-testid="fiscal-year"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{year.name}</h2>
              <span className="text-xs text-muted-foreground">
                {t("finances.fiscalPeriod.list.range", {
                  start: year.start_date,
                  end: year.end_date,
                })}
              </span>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">
                      {t("finances.fiscalPeriod.columns.name")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.fiscalPeriod.columns.start_date")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.fiscalPeriod.columns.end_date")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.fiscalPeriod.columns.status")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.fiscalPeriod.columns.closed_at")}
                    </th>
                    <th className="px-3 py-2">
                      <span className="sr-only">
                        {t("finances.fiscalPeriod.columns.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {year.periods.map((period) => {
                    const isOpen = period.status === "open";
                    const canAct = isOpen ? canClose : canReopen;

                    return (
                      <tr
                        key={period.id}
                        className="border-t"
                        data-testid="fiscal-period"
                      >
                        <td className="px-3 py-2">{period.name}</td>
                        <td className="px-3 py-2">{period.start_date}</td>
                        <td className="px-3 py-2">{period.end_date}</td>
                        <td className="px-3 py-2">
                          <Badge variant={isOpen ? "default" : "secondary"}>
                            {t(
                              `finances.fiscalPeriod.columns.status.options.${period.status}`,
                            )}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {period.closed_at
                            ? format(new Date(period.closed_at), "PPPp", {
                                locale: getLocaleDate(currentLocale?.()),
                              })
                            : ""}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {canAct && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setTarget({
                                  period,
                                  action: isOpen ? "close" : "open",
                                })
                              }
                            >
                              {t(
                                `finances.fiscalPeriod.actions.${isOpen ? "close" : "open"}`,
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <PeriodStatusDialog target={target} onClose={() => setTarget(null)} />
    </AppLayout>
  );
}
