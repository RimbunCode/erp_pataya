import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { cn, getThemeByStatus } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({ workOrder }) {
  const { t } = useLaravelReactI18n();

  const statusBadge = useMemo(() => {
    // if (data?.status == "draft") return;
    const status = t(`core.form.status.${workOrder?.status}`);
    const theme = getThemeByStatus(workOrder?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [workOrder?.status, t]);

  return (
    <FormPage
      name="workOrder"
      title={workOrder.code}
      disabled={(workOrder?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
      controls={() => {
        if ((workOrder.status ?? "draft") != "draft") {
          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="!p-2 size-fit h-8"
                    variant="secondary"
                  >
                    {t("core.form.actions")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    {t("service.workOrder.actions.create_pr")}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    {t(
                      "service.workOrder.actions." +
                        (workOrder?.for_internal ? "create_io" : "create_so"),
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        }
      }}
    >
      <Form />
    </FormPage>
  );
}
