import { cn, getThemeByStatus } from "@/lib/utils";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({ salesReturn }) {
  const { t } = useLaravelReactI18n();
  const statusBadge = useMemo(() => {
    if (!salesReturn) return;

    const status = t(`core.form.statuses.${salesReturn?.status}`);
    const theme = getThemeByStatus(salesReturn?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [salesReturn?.status, t]);

  return (
    <FormPage
      defaultValues={{
        salesReturn,
      }}
      isCreate={!salesReturn}
      // ignoreDraft={salesReturn}
      name="salesReturn"
      title={salesReturn ? salesReturn.code : t("finances.salesReturn.new")}
      disabled={(salesReturn?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
    >
      <Form />
    </FormPage>
  );
}
