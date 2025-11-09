import { cn, getThemeByStatus } from "@/lib/utils";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import Link from "@/Components/Link";
import { Button } from "@/Components/ui/button";

export default function Show({ deliveryNote, flash }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const statusBadge = useMemo(() => {
    if (!deliveryNote) return;

    const status = t(`core.form.statuses.${deliveryNote?.status}`);
    const theme = getThemeByStatus(deliveryNote?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [deliveryNote?.status, t]);

  return (
    <FormPage
      isCreate={!deliveryNote}
      name="deliveryNote"
      title={deliveryNote ? deliveryNote.code : t("sales.deliveryNote.new")}
      disabled={(deliveryNote?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
      banner={
        flash.errorItems && (
          <div className="flex flex-col gap-x-2 text-sm alert error p-4">
            <h3 className="text-base font-semibold">
              {t("core.form.errors.title")}
            </h3>
            <ul className="block pl-5">
              {flash.errorItems.map((value, index) => (
                <li key={index} className="list-disc">
                  {value}
                </li>
              ))}
            </ul>
          </div>
        )
      }
      controls={() => {
        if ((deliveryNote.status ?? "draft") != "draft") {
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
                      href={route("salesInvoices.create", {
                        ref: deliveryNote.id,
                      })}
                    >
                      {t("sales.deliveryNote.actions.create_sales_invoice")}
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
