import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
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
  return (
    <span className="ml-1 text-xs font-medium text-gray-500">Match</span>
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
            <th className="px-3 py-2 text-right">Qty PO</th>
            <th className="px-3 py-2 text-right">Received</th>
            <th className="px-3 py-2 text-right">Δ Receive</th>
            <th className="px-3 py-2 text-right">Billed</th>
            <th className="px-3 py-2 text-right">Δ Bill</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const deltaReceive = (item.received_quantity ?? 0) - item.quantity;
            const deltaBill = (item.billed_quantity ?? 0) - item.quantity;
            return (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.item_name ?? item.item?.name}</td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right">
                  {item.received_quantity ?? 0}
                </td>
                <td className="px-3 py-2 text-right">
                  <QtyBadge delta={deltaReceive} />
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

export default function Show({ purchaseOrder, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [markDoneDialogOpen, setMarkDoneDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mismatchErrors, setMismatchErrors] = useState([]);

  const hasMismatch = purchaseOrder?.items?.some((item) => {
    const deltaReceive = (item.received_quantity ?? 0) - item.quantity;
    const deltaBill = (item.billed_quantity ?? 0) - item.quantity;
    return deltaReceive !== 0 || deltaBill !== 0;
  });

  const handleSyncItems = () => {
    setLoading(true);
    router.post(
      route("purchaseOrders.syncItems", purchaseOrder.id),
      {},
      {
        onFinish: () => {
          setLoading(false);
          setSyncDialogOpen(false);
        },
      }
    );
  };

  const handleMarkDone = () => {
    setLoading(true);
    setMismatchErrors([]);
    router.post(
      route("purchaseOrders.markDone", purchaseOrder.id),
      {},
      {
        onError: (errors) => {
          if (errors.mismatches) {
            setMismatchErrors(
              Array.isArray(errors.mismatches)
                ? errors.mismatches
                : JSON.parse(errors.mismatches)
            );
          }
          setLoading(false);
        },
        onSuccess: () => {
          setLoading(false);
          setMarkDoneDialogOpen(false);
        },
      }
    );
  };

  return (
    <>
      <FormPage
        isCreate={!purchaseOrder}
        ignoreDraft={defaultData}
        name="purchaseOrder"
        title={
          purchaseOrder ? purchaseOrder.code : t("purchase.purchaseOrder.new")
        }
        disabled={purchaseOrder?.submitted_at}
        submitable
        defaultValues={defaultData}
        controls={() => {
          if (purchaseOrder?.submitted_at) {
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
                        href={route("purchaseReceipts.create", {
                          ref: `purchaseOrder/${purchaseOrder?.id}`,
                        })}
                      >
                        {t(
                          "purchase.purchaseOrder.actions.create_purchase_receipt"
                        )}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("purchaseInvoices.create", {
                          ref: `purchaseOrder/${purchaseOrder?.id}`,
                        })}
                      >
                        {t(
                          "purchase.purchaseOrder.actions.create_purchase_invoice"
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

        {/* Tabel tracking qty per item */}
        {purchaseOrder?.submitted_at && (
          <ItemsQtyTable items={purchaseOrder.items} />
        )}
      </FormPage>

      {/* Dialog konfirmasi Sync Items */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Items</DialogTitle>
            <DialogDescription>
              Items PO akan direkonsiliasi berdasarkan data Invoice dan Receipt.
              Jika ada perbedaan rate/tax/warehouse, items akan dipecah secara
              otomatis. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <ItemsQtyTable items={purchaseOrder?.items} />

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
              Validasi bahwa qty receipt sama dengan qty invoice untuk semua
              item, lalu finalisasi Purchase Order sebagai COMPLETED.
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
                    <strong>{m.item_name}</strong>: Received {m.received_qty} ≠
                    Billed {m.billed_qty}
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
