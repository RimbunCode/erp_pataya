import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import {
  ChevronRight,
  FileText,
  PackageSearch,
  PauseCircle,
  PlayCircle,
  ShoppingCart,
} from "lucide-react";
import React, { useState } from "react";

import { ActivityFormDialog } from "./ServiceActivityLog";
import Link from "@/Components/Link";
import StockAvailabilityCard from "./StockAvailabilityCard";
import { cn } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Satu opsi alur kerja: kartu klik-able dengan icon + judul + deskripsi
 * singkat (bukan tombol flat) supaya user tahu konsekuensi tiap opsi
 * sebelum memilih.
 * @param root0
 * @param root0.icon
 * @param root0.title
 * @param root0.description
 * @param root0.href
 * @param root0.onClick
 * @param root0.variant
 */
function ConfirmOption({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  variant = "default",
}) {
  const Comp = href ? Link : "button";
  return (
    <Comp
      type={href ? undefined : "button"}
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-x-3 p-3 rounded-lg border text-left transition-colors hover:bg-muted/50",
        variant === "primary"
          ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
          : "hover:border-foreground/40",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full size-9 shrink-0",
          variant === "primary" ? "bg-primary/15" : "bg-muted",
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="flex flex-col gap-y-0.5 min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </Comp>
  );
}

/**
 * Requirement 2/3/4/5 (spec asset-service-progress-workflow): dialog yang
 * dibuka dari tombol primary "Confirm" (Show.jsx) selama status AssetService
 * mengandung NEED_CONFIRMATION. 4 opsi + tombol lihat stok.
 * @param root0
 * @param root0.assetService
 * @param root0.open
 * @param root0.onOpenChange
 */
export default function ConfirmWorkflowDialog({
  assetService,
  open,
  onOpenChange,
}) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [holdOpen, setHoldOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const startWork = () => {
    router.post(route("assetServices.startWork", assetService.id));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("asset.service.confirmWorkflow.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-y-2">
            {/* Option: Mulai pekerjaan (Requirement 5) -- disembunyikan kalau
                tidak ada stok sama sekali (UX gate, startWork() TETAP
                validasi ulang server-side). Ditaruh paling atas & primary
                karena ini jalur "siap kerja langsung", paling sering dipilih. */}
            {assetService?.has_available_stock && (
              <ConfirmOption
                icon={PlayCircle}
                variant="primary"
                title={t("asset.service.confirmWorkflow.start_work")}
                description={t(
                  "asset.service.confirmWorkflow.start_work_description",
                )}
                onClick={startWork}
              />
            )}

            {/* Option: Hold (Requirement 3) */}
            <ConfirmOption
              icon={PauseCircle}
              title={t("asset.service.confirmWorkflow.hold")}
              description={t("asset.service.confirmWorkflow.hold_description")}
              onClick={() => {
                onOpenChange(false);
                setHoldOpen(true);
              }}
            />

            {/* Option: Create PR/PO (Requirement 4) -- reuse route existing
                spec asset-service-procurement, TIDAK ada mekanisme baru. */}
            <ConfirmOption
              icon={FileText}
              title={t("asset.service.actions.create_pr")}
              description={t(
                "asset.service.confirmWorkflow.create_pr_description",
              )}
              href={route("purchaseRequests.create", {
                ref: `assetService/${assetService.id}`,
              })}
            />
            <ConfirmOption
              icon={ShoppingCart}
              title={t("asset.service.actions.create_po")}
              description={t(
                "asset.service.confirmWorkflow.create_po_description",
              )}
              href={route("purchaseOrders.create", {
                ref: `assetService/${assetService.id}`,
              })}
            />

            <button
              type="button"
              className="flex items-center gap-x-1.5 self-start mt-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => setStockOpen(true)}
            >
              <PackageSearch className="size-3.5" />
              {t("asset.service.confirmWorkflow.view_stock")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("asset.service.confirmWorkflow.view_stock")}
            </DialogTitle>
          </DialogHeader>
          <StockAvailabilityCard assetService={assetService} />
        </DialogContent>
      </Dialog>

      {/* Requirement 3 AC1: dialog Activity yang SAMA, prefillStatus="on_hold". */}
      <ActivityFormDialog
        assetService={assetService}
        activity={null}
        prefillStatus="on_hold"
        open={holdOpen}
        onOpenChange={setHoldOpen}
      />
    </>
  );
}
