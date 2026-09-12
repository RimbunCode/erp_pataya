import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import { Button } from "@/Components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import ConfirmWorkflowDialog from "./ConfirmWorkflowDialog";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import ServiceActivityLog from "./ServiceActivityLog";
import { hasPassedApproval } from "./statusUtils";
import { useState } from "react";
import usePermission from "@/Hooks/usePermission";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ assetService, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const { canGlobal } = usePermission();
  // Requirement 8: hasPassedApproval() (BUKAN cek literal "approved") --
  // status apapun selain draft/need_approval/canceled dianggap lewat approval.
  const approved = hasPassedApproval(assetService?.status);
  const canRequestPurchase = assetService?.submitted_at;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const needsConfirmation = (assetService?.status ?? []).includes(
    "need_confirmation",
  );

  return (
    <FormPage
      isCreate={!assetService}
      ignoreDraft={defaultData}
      name="assetService"
      disabled={assetService?.submitted_at}
      submitable
      defaultValues={defaultData}
      controls={() => {
        // canGlobal() cuma dipanggil kalau canRequestPurchase -- pertahankan
        // short-circuit ORIGINAL (sebelum tombol Confirm ditambah), supaya
        // tidak ada permission check tak perlu saat dokumen belum submitted.
        let dropdown = null;
        if (canRequestPurchase) {
          const canCreatePr = canGlobal(
            "App\\Models\\Purchase\\PurchaseRequest",
            "create",
          );
          const canCreatePo = canGlobal(
            "App\\Models\\Purchase\\PurchaseOrder",
            "create",
          );
          const canCreateSo = canGlobal(
            "App\\Models\\Sales\\SalesOrder",
            "create",
          );
          const canCreateIo = canGlobal(
            "App\\Models\\Sales\\InternalOrder",
            "create",
          );

          if (canCreatePr || canCreatePo || canCreateSo || canCreateIo) {
            dropdown = (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="p-2! size-fit h-8"
                    variant="secondary"
                  >
                    {t("core.form.actions")}
                    <ChevronsUpDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {canCreatePr && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("purchaseRequests.create", {
                          ref: `assetService/${assetService.id}`,
                        })}
                      >
                        {t("asset.service.actions.create_pr")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canCreatePo && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("purchaseOrders.create", {
                          ref: `assetService/${assetService.id}`,
                        })}
                      >
                        {t("asset.service.actions.create_po")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canCreateSo && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("salesOrders.create", {
                          ref: `assetService/${assetService.id}`,
                        })}
                      >
                        {t("asset.service.actions.create_so")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canCreateIo && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("internalOrders.create", {
                          ref: `assetService/${assetService.id}`,
                        })}
                      >
                        {t("asset.service.actions.create_io")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
        }

        return (
          <>
            {/* Requirement 2 AC1: tombol primary "Confirm", tampil selama
                status AssetService mengandung NEED_CONFIRMATION -- independen
                dari canRequestPurchase/dropdown di atas. */}
            {needsConfirmation && (
              <Button
                type="button"
                className="p-2! size-fit h-8"
                onClick={() => setConfirmOpen(true)}
              >
                {t("asset.service.confirm")}
              </Button>
            )}
            {dropdown}
          </>
        );
      }}
    >
      <Form />
      {assetService && needsConfirmation && (
        <ConfirmWorkflowDialog
          assetService={assetService}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
        />
      )}
      {assetService && approved && (
        <ServiceActivityLog assetService={assetService} />
      )}
    </FormPage>
  );
}
