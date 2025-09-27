import { cn, getThemeByStatus } from "@/lib/utils";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";

export default function Show({ salesOrder }) {
  const { t } = useLaravelReactI18n();
  const loadFrom = usePage().props.loadFrom;
  const statusBadge = useMemo(() => {
    if (!salesOrder) return;

    const status = t(`core.form.statuses.${salesOrder?.status}`);
    const theme = getThemeByStatus(salesOrder?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [salesOrder?.status, t]);

  return (
    <FormPage
      isCreate={!salesOrder}
      ignoreDraft={loadFrom}
      name="salesOrder"
      title={salesOrder ? salesOrder.code : t("sales.salesOrder.new")}
      disabled={(salesOrder?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
    >
      <Form />
    </FormPage>
  );
}
