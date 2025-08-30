import { cn, getThemeByStatus } from "@/lib/utils";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({ salesOrder }) {
  const { t } = useLaravelReactI18n();

  const statusBadge = useMemo(() => {
    // if (data?.status == "draft") return;
    const status = t(`core.form.status.${salesOrder?.status}`);
    const theme = getThemeByStatus(salesOrder?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [salesOrder?.status, t]);

  return (
    <FormPage
      name="salesOrder"
      title={salesOrder.code}
      disabled={(salesOrder?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
    >
      <Form />
    </FormPage>
  );
}
