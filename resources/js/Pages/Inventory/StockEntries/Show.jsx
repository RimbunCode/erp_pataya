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

export default function Show({ stockEntry }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  const statusBadge = useMemo(() => {
    // if (data?.status == "draft") return;
    const status = t(`core.form.statuses.${stockEntry?.status}`);
    const theme = getThemeByStatus(stockEntry?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [stockEntry?.status, t]);

  return (
    <FormPage
      name="stockEntry"
      title={stockEntry.code}
      disabled={(stockEntry?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
      // controls={() => {
      //   if ((stockEntry.status ?? "draft") != "draft") {
      //     return (
      //       <>
      //         <DropdownMenu>
      //           <DropdownMenuTrigger asChild>
      //             <Button
      //               type="button"
      //               className="p-2! size-fit h-8"
      //               variant="secondary"
      //             >
      //               {t("core.form.actions")}
      //             </Button>
      //           </DropdownMenuTrigger>
      //           <DropdownMenuContent>
      //             <DropdownMenuItem asChild>
      //               <Link
      //                 href={route("purchaseRequests.create", {
      //                   ref: `stockEntry/${stockEntry.id}`,
      //                 })}
      //               >
      //                 {t("service.stockEntry.actions.create_pr")}
      //               </Link>
      //             </DropdownMenuItem>
      //             <DropdownMenuItem asChild>
      //               <Link
      //                 href={route(
      //                   stockEntry?.for_internal
      //                     ? "internalOrders.create"
      //                     : "salesOrders.create",
      //                   {
      //                     ref: `stockEntry/${stockEntry.id}`,
      //                   },
      //                 )}
      //               >
      //                 {t(
      //                   "service.stockEntry.actions." +
      //                     (stockEntry?.for_internal ? "create_io" : "create_so"),
      //                 )}
      //               </Link>
      //             </DropdownMenuItem>
      //           </DropdownMenuContent>
      //         </DropdownMenu>
      //       </>
      //     );
      //   }
      // }}
    >
      <Form />
    </FormPage>
  );
}
