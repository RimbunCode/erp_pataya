import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { inArray, isValidStatus } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { ChevronsUpDown } from "lucide-react";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { router } from "@inertiajs/react";
import { useState } from "react";

function QtyBadge({ delta }) {
  if (delta === null || delta === undefined) return null;
  if (delta > 0)
    return (
      <span className="ml-1 text-xs font-medium text-green-600">
        +{delta} Over
      </span>
    );
  if (delta < 0)
    return (
      <span className="ml-1 text-xs font-medium text-red-600">
        {delta} Under
      </span>
    );
  return <span className="ml-1 text-xs font-medium text-gray-500">Match</span>;
}

function RentalStatusBadge({ status }) {
  const map = {
    running: { label: "Berjalan", className: "text-blue-600" },
    completed: { label: "Selesai", className: "text-green-600" },
    partially_completed: {
      label: "Sebagian Selesai",
      className: "text-amber-600",
    },
  };
  const entry = map[status];
  if (!entry) return null;

  return (
    <span className={`text-xs font-medium ${entry.className}`}>
      {entry.label}
    </span>
  );
}

function RentalDurationTable({ items, durations }) {
  if (!items?.length) return null;

  return (
    <div className="mt-4 overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-right">Durasi (hari)</th>
            <th className="px-3 py-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const duration = durations?.[item.id];
            if (!duration || !duration.status) return null;
            const totalDays = duration.segments.reduce(
              (sum, s) => sum + s.duration_days,
              0,
            );
            return (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">
                  {item.item_name ?? item.item?.name}
                </td>
                <td className="px-3 py-2 text-right">{totalDays}</td>
                <td className="px-3 py-2 text-right">
                  <RentalStatusBadge status={duration.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ItemsQtyTable({ items }) {
  if (!items?.length) return null;

  return (
    <div className="mt-4 overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-right">Qty SO</th>
            <th className="px-3 py-2 text-right">Delivered</th>
            <th className="px-3 py-2 text-right">Δ Deliver</th>
            <th className="px-3 py-2 text-right">Billed</th>
            <th className="px-3 py-2 text-right">Δ Bill</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const deltaDeliver = (item.delivered_quantity ?? 0) - item.quantity;
            const deltaBill = (item.billed_quantity ?? 0) - item.quantity;
            return (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">
                  {item.item_name ?? item.item?.name}
                </td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right">
                  {item.delivered_quantity ?? 0}
                </td>
                <td className="px-3 py-2 text-right">
                  <QtyBadge delta={deltaDeliver} />
                </td>
                <td className="px-3 py-2 text-right">
                  {item.billed_quantity ?? 0}
                </td>
                <td className="px-3 py-2 text-right">
                  <QtyBadge delta={deltaBill} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Show({ salesOrder, defaultData, flash }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [markDoneDialogOpen, setMarkDoneDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mismatchErrors, setMismatchErrors] = useState([]);

  const hasMismatch = salesOrder?.items?.some((item) => {
    const deltaDeliver = (item.delivered_quantity ?? 0) - item.quantity;
    const deltaBill = (item.billed_quantity ?? 0) - item.quantity;
    return deltaDeliver !== 0 || deltaBill !== 0;
  });

  const handleSyncItems = () => {
    setLoading(true);
    router.post(
      route("salesOrders.syncItems", salesOrder.id),
      {},
      {
        onFinish: () => {
          setLoading(false);
          setSyncDialogOpen(false);
        },
      },
    );
  };

  const handleMarkDone = () => {
    setLoading(true);
    setMismatchErrors([]);
    router.post(
      route("salesOrders.markDone", salesOrder.id),
      {},
      {
        onError: (errors) => {
          if (errors.mismatches) {
            setMismatchErrors(
              Array.isArray(errors.mismatches)
                ? errors.mismatches
                : JSON.parse(errors.mismatches),
            );
          }
          setLoading(false);
        },
        onSuccess: () => {
          setLoading(false);
          setMarkDoneDialogOpen(false);
        },
      },
    );
  };

  return (
    <>
      <FormPage
        isCreate={!salesOrder}
        ignoreDraft={defaultData}
        name="salesOrder"
        disabled={salesOrder?.submitted_at}
        submitable
        defaultValues={defaultData}
        banner={
          flash?.errorItems && (
            <div className="flex flex-col gap-x-2 text-sm alert error p-4">
              <h3 className="text-base font-semibold">
                {t("core.form.errors.title")}
              </h3>
              <ul className="block pl-5">
                {flash.errorItems.map((value, index) => (
                  <li key={index} className="list-disc">
                    {t(value)}
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        controls={() => {
          if (salesOrder?.submitted_at) {
            return (
              <>
                {/* Tombol Sync Items & Mark Done */}
                {hasMismatch && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSyncDialogOpen(true)}
                  >
                    Sync Items
                  </Button>
                )}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setMarkDoneDialogOpen(true)}
                >
                  Mark Done
                </Button>

                {isValidStatus(salesOrder?.status) &&
                  inArray(salesOrder?.status, [
                    "to_bill",
                    "to_deliver",
                    "partially_paid",
                    "partially_delivered",
                    "partially_billed",
                    "over_delivered",
                    "over_billed",
                  ]) && (
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
                        {inArray(salesOrder?.status, [
                          "to_bill",
                          "partially_billed",
                          "partially_paid",
                          "over_billed",
                        ]) && (
                          <DropdownMenuItem asChild>
                            <Link
                              href={route("salesInvoices.create", {
                                ref: `salesOrder/${salesOrder?.id}`,
                              })}
                            >
                              {t(
                                "sales.salesOrder.actions.create_sales_invoice",
                              )}
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {inArray(salesOrder?.status, [
                          "to_deliver",
                          "partially_delivered",
                          "over_delivered",
                        ]) && (
                          <DropdownMenuItem asChild>
                            <Link
                              href={route("deliveryNotes.create", {
                                ref: `salesOrder/${salesOrder?.id}`,
                              })}
                            >
                              {t(
                                "sales.salesOrder.actions.create_delivery_note",
                              )}
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </>
            );
          }
        }}
      >
        <Form />

        {/* Tabel tracking qty per item */}
        {salesOrder?.submitted_at && <ItemsQtyTable items={salesOrder.items} />}

        {/* Tabel durasi & status sewa rental */}
        {salesOrder?.is_rent && salesOrder?.submitted_at && (
          <RentalDurationTable
            items={salesOrder.items}
            durations={salesOrder.rental_durations}
          />
        )}
      </FormPage>

      {/* Dialog konfirmasi Sync Items */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Items</DialogTitle>
            <DialogDescription>
              Items SO akan direkonsiliasi berdasarkan data Invoice dan Delivery
              Note. Jika ada perbedaan rate/tax/warehouse, items akan dipecah
              secara otomatis. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <ItemsQtyTable items={salesOrder?.items} />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSyncDialogOpen(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button onClick={handleSyncItems} disabled={loading}>
              {loading ? "Memproses..." : "Sync Items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog konfirmasi Mark Done */}
      <Dialog open={markDoneDialogOpen} onOpenChange={setMarkDoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Done</DialogTitle>
            <DialogDescription>
              Validasi bahwa qty delivered sama dengan qty billed untuk semua
              item, lalu finalisasi Sales Order sebagai COMPLETED.
            </DialogDescription>
          </DialogHeader>

          {mismatchErrors.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3">
              <p className="mb-2 text-sm font-medium text-red-700">
                Qty tidak cocok untuk beberapa item:
              </p>
              <ul className="space-y-1 text-sm text-red-600">
                {mismatchErrors.map((m, i) => (
                  <li key={i}>
                    <strong>{m.item_name}</strong>: Delivered {m.delivered_qty}{" "}
                    ≠ Billed {m.billed_qty}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkDoneDialogOpen(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button onClick={handleMarkDone} disabled={loading}>
              {loading ? "Memproses..." : "Mark Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
