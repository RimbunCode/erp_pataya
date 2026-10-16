import DataTable2 from "@/Pages/Core/DataTable2";
import Link from "@/Components/Link";
import Form from "./Form";
import React from "react";
import { router } from "@inertiajs/react";
import usePermission from "@/Hooks/usePermission";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { gooeyToast as toast } from "@/lib/gooeyToast";

function Index() {
  const { t } = useLaravelReactI18n();
  const { canGlobal } = usePermission();
  const stagePurchaseOrders = (rows) =>
    new Promise((resolve) => {
      const showFailure = () => {
        toast.error(t("purchase.purchaseRequest.actions.create_po_failed"));
        return false;
      };

      router.post(
        window.route("purchaseOrders.fromRequests.stage"),
        { ids: rows.map((row) => row.id) },
        {
          onError: (errors) => {
            const messages = Object.values(errors)
              .flat()
              .filter((message) => typeof message === "string");
            toast.error(
              messages.join("\n") ||
                t("purchase.purchaseRequest.actions.create_po_failed"),
            );
          },
          onHttpException: showFailure,
          onNetworkError: showFailure,
          onFinish: () => resolve(),
        },
      );
    });

  const rowActions = canGlobal("App\\Models\\Purchase\\PurchaseOrder", "create")
    ? [
        {
          key: "createPo",
          label: t("purchase.purchaseRequest.actions.create_po"),
          single: true,
          bulk: true,
          requires: ["canCreatePo"],
          enabled: (row) => row.canCreatePo === true,
          onAction: stagePurchaseOrders,
        },
      ]
    : [];

  return (
    <DataTable2
      classNameDialog="max-w-(--breakpoint-2xl)!"
      form={<Form />}
      rowActions={rowActions}
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between gap-4 border-b border-muted-foreground/25 p-4">
          <Link
            as="button"
            href={window.route("purchaseRequests.show", dataRow.id)}
          >
            <span className="block text-left font-medium">
              {dataRow.code ?? dataRow.id}
            </span>
          </Link>
          <div className="flex flex-wrap justify-end gap-1">
            {(dataRow.status ?? []).map((status) => (
              <span
                key={status}
                className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {t(`status.${status}`)}
              </span>
            ))}
          </div>
        </div>
      )}
    />
  );
}

export default Index;
