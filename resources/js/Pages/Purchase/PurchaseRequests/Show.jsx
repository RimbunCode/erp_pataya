import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ purchaseRequest, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!purchaseRequest}
      ignoreDraft={defaultData}
      defaultValues={defaultData}
      name="purchaseRequest"
      title={
        purchaseRequest
          ? purchaseRequest.code
          : t("purchase.purchaseRequest.new")
      }
      disabled={purchaseRequest?.submitted_at}
      submitable
      controls={() => {
        if (purchaseRequest?.submitted_at) {
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
                      href={route("purchaseOrders.create", {
                        ref: `purchaseRequest/${purchaseRequest?.id}`,
                      })}
                    >
                      {t("purchase.purchaseRequest.actions.create_po")}
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
