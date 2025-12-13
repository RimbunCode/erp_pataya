import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import { Button } from "@/Components/ui/button";
import { ChevronsUpDownIcon } from "lucide-react";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { isValidStatus } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ workOrder }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      name="workOrder"
      title={workOrder.code}
      disabled={workOrder?.submitted_at}
      submitable
      controls={({ form }) => {
        if (workOrder?.submitted_at && isValidStatus(workOrder?.status)) {
          return (
            <>
              {workOrder.submitted_at && !workOrder.complated_at && (
                <Button
                  type="button"
                  className="p-2! size-fit h-8 items-center flex"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.put(
                      route("workOrders.update", {
                        workOrder: workOrder.id,
                        level: workOrder.started_at ? "complate" : "start",
                      }),
                    );
                  }}
                >
                  {t(
                    workOrder.started_at
                      ? "service.workOrder.actions.complate_work"
                      : "service.workOrder.actions.start_work",
                  )}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="p-2! size-fit h-8 items-center flex"
                    variant="secondary"
                  >
                    {t("core.form.actions")}
                    <ChevronsUpDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link
                      href={route("purchaseRequests.create", {
                        ref: `workOrder/${workOrder.id}`,
                      })}
                      preserveScroll={true}
                      preserveState={true}
                      replace={true}
                    >
                      {t("service.workOrder.actions.create_pr")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={route(
                        workOrder?.for_internal
                          ? "internalOrders.create"
                          : "salesOrders.create",
                        {
                          ref: `workOrder/${workOrder.id}`,
                        },
                      )}
                    >
                      {t(
                        "service.workOrder.actions." +
                          (workOrder?.for_internal ? "create_io" : "create_so"),
                      )}
                    </Link>
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
