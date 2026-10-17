import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@/Components/ui/alert";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import SupplierLinkModel from "../../Suppliers/SupplierLinkModel";
import PurchaseRequestNotes from "./PurchaseRequestNotes";
import {
  addAllocation,
  formatWarningQuantity,
  getQuantityWarnings,
  reconcileDrafts,
  removeAllocation,
  setAllocationQuantity,
  setAllocationUnit,
} from "./allocationState";

const translationPrefix = "purchase.purchaseOrder.from_requests.";

export function QuantityWarnings({ state, sources, sourceId }) {
  const { t } = useLaravelReactI18n();
  const warnings = getQuantityWarnings(state, sources).filter(
    (warning) =>
      sourceId == null || warning.purchase_request_item_id === sourceId,
  );
  if (!warnings.length) return null;

  return (
    <Alert
      variant="warning"
      appearance="light"
      className="items-start"
      aria-label={t(`${translationPrefix}quantity_warning_title`)}
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <AlertContent>
        <AlertTitle>
          {t(`${translationPrefix}quantity_warning_title`)}
        </AlertTitle>
        <AlertDescription>
          <p>{t(`${translationPrefix}quantity_warning_description`)}</p>
          <ul className="space-y-1">
            {warnings.map((warning) => {
              const source =
                state.sourcesById[warning.purchase_request_item_id];
              return (
                <li
                  key={warning.purchase_request_item_id}
                  className="break-words"
                >
                  {source.purchase_request_code} ·{" "}
                  {source.item_name ?? source.item?.name ?? source.description}
                  {": "}
                  {t(`${translationPrefix}quantity_${warning.direction}`, {
                    required: formatWarningQuantity(warning.unordered_quantity),
                    allocated: formatWarningQuantity(
                      warning.allocated_quantity,
                    ),
                    difference: formatWarningQuantity(
                      Math.abs(warning.difference),
                    ),
                  })}
                </li>
              );
            })}
          </ul>
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function selectSupplier(state, allocationId, supplier, confirmed) {
  const allocation = state.allocationsById[allocationId];
  const candidate = {
    ...state,
    allocationsById: {
      ...state.allocationsById,
      [allocationId]: {
        ...allocation,
        supplier_id: supplier?.id ?? null,
        data: { ...allocation.data, supplier },
      },
    },
  };
  const next = reconcileDrafts(candidate, { confirmed });
  if (next.confirmationRequired) return next;
  const draftId = next.allocationsById[allocationId].draft_id;
  if (!draftId) return next;
  return {
    ...next,
    draftsById: {
      ...next.draftsById,
      [draftId]: {
        ...next.draftsById[draftId],
        data: { ...next.draftsById[draftId].data, supplier },
      },
    },
  };
}

export default function AllocationStep({
  state,
  setState,
  sources = [],
  sourceErrors = {},
  onContinue,
  disabled = false,
  footerContainer,
}) {
  const { t } = useLaravelReactI18n();
  const [pendingChange, setPendingChange] = useState(null);
  const allocations = Object.values(state.allocationsById);
  const errors = Object.values(sourceErrors ?? {})
    .flat()
    .filter(Boolean);
  const canContinue =
    !disabled &&
    errors.length === 0 &&
    allocations.length > 0 &&
    allocations.every(
      (allocation) =>
        allocation.supplier_id != null &&
        allocation.unit?.id &&
        Number.isFinite(allocation.quantity) &&
        allocation.quantity >= 1,
    );

  const requestChange = (operation) => {
    const next = operation(state, false);
    if (next.confirmationRequired) {
      setPendingChange({ operation, ...next.pendingChange });
    } else {
      setState(next);
    }
  };
  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {t(`${translationPrefix}allocation_requirements`)}
      </p>
      <Button
        type="button"
        disabled={!canContinue}
        onClick={() => canContinue && onContinue?.()}
      >
        {t(`${translationPrefix}continue_drafts`)}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t(`${translationPrefix}allocation`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`${translationPrefix}allocation_description`)}
        </p>
      </div>
      {errors.length > 0 && (
        <Alert variant="destructive" appearance="light">
          <AlertContent>
            <AlertTitle>
              {t(`${translationPrefix}source_error_title`)}
            </AlertTitle>
            <AlertDescription>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {Object.keys(state.sourcesById).length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t(`${translationPrefix}empty_sources`)}
          </CardContent>
        </Card>
      )}
      {Object.values(state.sourcesById).map((source) => {
        const rows = allocations.filter(
          (allocation) => allocation.purchase_request_item_id === source.id,
        );
        const request = sources.find(
          (entry) => String(entry.id) === String(source.purchase_request_id),
        );
        const itemName =
          source.item_name ??
          source.item?.name ??
          source.description ??
          source.id;
        const unitName = source.unit_name ?? source.unit?.name ?? "—";
        const requiredDate = source.required_date ?? request?.required_date;
        return (
          <Card
            key={source.id}
            data-testid={"source-item-" + source.id}
            className="min-w-0 overflow-hidden"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {source.purchase_request_code}
                  </Badge>
                  <h3 className="break-words font-medium">{itemName}</h3>
                </div>
                {source.description && (
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {source.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t(`${translationPrefix}required_date`)}:{" "}
                  {requiredDate ? String(requiredDate).slice(0, 10) : "—"} ·{" "}
                  {t(`${translationPrefix}unit`)}: {unitName}
                </p>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {t(`${translationPrefix}remaining_quantity`)}:{" "}
                </span>
                <strong>
                  {source.unordered_quantity} {unitName}
                </strong>
              </div>
            </div>
            <CardContent className="grid gap-3 p-4">
              <QuantityWarnings
                state={state}
                sources={sources}
                sourceId={source.id}
              />
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t(`${translationPrefix}item_not_allocated`)}
                </p>
              )}
              {rows.map((allocation, index) => (
                <div
                  key={allocation.id}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_9rem_auto]"
                >
                  <FormInput
                    required
                    label={t(`${translationPrefix}supplier`)}
                    ignoreDisabled
                    className="col-span-3 min-w-0 md:col-span-1"
                  >
                    <SupplierLinkModel
                      value={
                        allocation.data?.supplier === undefined
                          ? (state.draftsById[allocation.draft_id]?.data
                              ?.supplier ?? null)
                          : allocation.data.supplier
                      }
                      placeholder={t(`${translationPrefix}select_supplier`)}
                      disabled={disabled}
                      onValueChange={(supplier) =>
                        requestChange((current, confirmed) =>
                          selectSupplier(
                            current,
                            allocation.id,
                            supplier,
                            confirmed,
                          ),
                        )
                      }
                    />
                  </FormInput>
                  <FormInput
                    required
                    label={t(translationPrefix + "unit")}
                    ignoreDisabled
                    className="min-w-0"
                  >
                    <ItemUnitLinkModel
                      value={allocation.unit ?? null}
                      disabled={disabled}
                      fields={["conversion_factor"]}
                      filters={{ item_id: source.item?.item_id }}
                      onValueChange={(unit) =>
                        setState((current) =>
                          setAllocationUnit(current, allocation.id, unit),
                        )
                      }
                    />
                  </FormInput>
                  <FormInput
                    required
                    label={t(`${translationPrefix}allocation_quantity`, {
                      pr: source.purchase_request_code,
                      item: itemName,
                      number: index + 1,
                    })}
                    ignoreDisabled
                  >
                    <NumberInput
                      value={allocation.quantity}
                      min={0}
                      allowNegativeValue={false}
                      disabled={disabled}
                      onValueChange={(quantity) =>
                        setState((current) =>
                          setAllocationQuantity(
                            current,
                            allocation.id,
                            quantity ?? 0,
                          ),
                        )
                      }
                    />
                  </FormInput>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6"
                    disabled={disabled}
                    aria-label={t(`${translationPrefix}remove_allocation`, {
                      pr: source.purchase_request_code,
                      item: itemName,
                      number: index + 1,
                    })}
                    onClick={() =>
                      requestChange((current, confirmed) =>
                        removeAllocation(current, allocation.id, { confirmed }),
                      )
                    }
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full md:w-fit"
                disabled={disabled}
                aria-label={t(`${translationPrefix}add_allocation`, {
                  pr: source.purchase_request_code,
                  item: itemName,
                })}
                onClick={() =>
                  setState((current) => addAllocation(current, source.id))
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                {t(`${translationPrefix}add_allocation`)}
              </Button>
            </CardContent>
          </Card>
        );
      })}
      <PurchaseRequestNotes sources={sources} />
      {footerContainer ? createPortal(footer, footerContainer) : footer}
      <Dialog
        open={!!pendingChange}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
      >
        <DialogContent forceAsDialog>
          <DialogHeader>
            <DialogTitle>
              {t(`${translationPrefix}confirm_changes_title`)}
            </DialogTitle>
            <DialogDescription>
              {t(`${translationPrefix}confirm_changes_description`)}
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm">
            {(pendingChange?.affectedDraftIds ?? []).map((id) => (
              <li key={id}>
                {state.draftsById[id]?.data?.supplier?.name ??
                  t(`${translationPrefix}draft_number`, {
                    number: state.draftOrder.indexOf(id) + 1,
                  })}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingChange(null)}
            >
              {t(`${translationPrefix}cancel`)}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setState((current) => pendingChange.operation(current, true));
                setPendingChange(null);
              }}
            >
              {t(`${translationPrefix}confirm`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
