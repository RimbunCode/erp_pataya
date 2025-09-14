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
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";

export default function Show({ purchaseRequest }) {
  const { t } = useLaravelReactI18n();
  const loadFrom = usePage().props.loadFrom;
  const route = window.route;

  const statusBadge = useMemo(() => {
    if (!purchaseRequest) return;
    const status = t(`core.form.statuses.${purchaseRequest?.status}`);
    const theme = getThemeByStatus(purchaseRequest?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [purchaseRequest?.status, t]);
  return (
    <FormPage
      isCreate={!purchaseRequest}
      ignoreDraft={loadFrom}
      name="purchaseRequest"
      title={
        purchaseRequest
          ? purchaseRequest.code
          : t("purchase.purchaseRequest.new")
      }
      disabled={(purchaseRequest?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
      controls={() => {
        if ((purchaseRequest?.status ?? "draft") != "draft") {
          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="p-2! size-fit h-8"
                    variant="secondary"
                  >
                    {t("core.form.actions")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link
                      href={route("purchaseRequests.create", {
                        ref: `purchaseRequest/${purchaseRequest?.id}`,
                      })}
                    >
                      {t("service.purchaseRequest.actions.create_pr")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    {t(
                      "service.purchaseRequest.actions." +
                        (purchaseRequest?.for_internal
                          ? "create_io"
                          : "create_so"),
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
