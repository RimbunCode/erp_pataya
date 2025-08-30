import { cn, getThemeByStatus } from "@/lib/utils";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({ internalOrder }) {
  const { t } = useLaravelReactI18n();

  const statusBadge = useMemo(() => {
    // if (data?.status == "draft") return;
    const status = t(`core.form.status.${internalOrder?.status}`);
    const theme = getThemeByStatus(internalOrder?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [internalOrder?.status, t]);

  return (
    <FormPage
      name="internalOrder"
      title={internalOrder.code}
      disabled={(internalOrder?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
    >
      <Form />
    </FormPage>
  );
}
