import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Ellipsis } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Input } from "@/Components/ui/input";
import { FormChildren } from "@/Pages/Core/FormPage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { PurchaseOrderFields } from "../Form";
import {
  changeDraftSupplier,
  moveAllocation,
  splitAllocation,
  splitDraft,
} from "./allocationState";
import { applyDraftData, buildDraftData } from "./draftData";
import { buildSubmissionDrafts, validateSubmissionDrafts } from "./reviewData";
import { QuantityWarnings } from "./AllocationStep";
import PurchaseRequestNotes from "./PurchaseRequestNotes";

const translationPrefix = "purchase.purchaseOrder.from_requests.";

function SourceItemActions({
  row,
  toggleDialog,
  state,
  draftId,
  onMove,
  onSplitDraft,
  onSplitQuantity,
}) {
  const { t } = useLaravelReactI18n();
  if (!row) return null;
  const otherDrafts = state.draftOrder.filter((id) => id !== draftId);
  const itemName = row.item?.name ?? row.item?.code ?? row.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`${t("core.datatable.row_actions")} ${itemName}`}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={toggleDialog}>
          {t("core.formtable.editing_row")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSplitQuantity(row.id)}>
          {t(`${translationPrefix}split_quantity`)}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSplitDraft(row.id)}>
          {t(`${translationPrefix}split_to_po`)}
        </DropdownMenuItem>
        {otherDrafts.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t(`${translationPrefix}move_item`)}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherDrafts.map((id) => (
                <DropdownMenuItem key={id} onSelect={() => onMove(row.id, id)}>
                  {t(`${translationPrefix}draft_number`, {
                    number: state.draftOrder.indexOf(id) + 1,
                  })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DraftStep({
  state,
  setState,
  sources = [],
  onBack,
  onContinue,
  defaultDate = new Date().toISOString().slice(0, 10),
  errors = {},
  footerContainer,
}) {
  const { t } = useLaravelReactI18n();
  const [pending, setPending] = useState(null);
  const [splitQuantityValue, setSplitQuantityValue] = useState(1);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const draftId = state.activeDraftId ?? state.draftOrder[0];
  const data = draftId ? buildDraftData(state, draftId, defaultDate) : null;
  const clientErrors = validateSubmissionDrafts(
    buildSubmissionDrafts(state, defaultDate),
  );
  const visibleErrors = showValidationErrors
    ? { ...clientErrors, ...errors }
    : errors;
  const activeSources = sources.filter((source) =>
    data?.items.some((item) => item.purchase_request_id === source.id),
  );
  const draftErrors = Object.fromEntries(
    Object.entries(visibleErrors)
      .filter(([path]) =>
        path.startsWith(`drafts.${state.draftOrder.indexOf(draftId)}.`),
      )
      .map(([path, message]) => [path.replace(/^drafts\.\d+\./, ""), message]),
  );

  const setData = (...args) => {
    if (args[0] === "supplier") {
      if (!args[1] || (typeof args[1] === "object" && !args[1].id)) {
        return;
      }
      setPending({ type: "supplier", supplier: args[1] });
      return;
    }
    setState((current) => {
      const previous = buildDraftData(current, draftId, defaultDate);
      const next =
        typeof args[0] === "function"
          ? args[0](previous)
          : typeof args[0] === "string"
            ? { ...previous, [args[0]]: args[1] }
            : { ...previous, ...args[0] };
      return applyDraftData(current, draftId, next);
    });
  };

  const onMove = (allocationId, targetId) => {
    const remaining = Object.values(state.allocationsById).filter(
      (allocation) =>
        allocation.draft_id === draftId && allocation.id !== allocationId,
    );
    const filled = Object.keys(state.draftsById[draftId]?.data ?? {}).some(
      (key) => !["supplier"].includes(key),
    );
    if (!remaining.length && filled) {
      setPending({ type: "move", allocationId, targetId });
      return;
    }
    setState((current) => moveAllocation(current, allocationId, targetId));
  };

  const onSplitDraft = (allocationId) => {
    const rows = Object.values(state.allocationsById).filter(
      (allocation) => allocation.draft_id === draftId,
    );
    if (rows.length === 1) {
      setSplitQuantityValue(Math.max(1, Math.floor(rows[0].quantity / 2)));
      setPending({ type: "splitDraftQuantity", allocationId });
      return;
    }
    setState((current) => splitDraft(current, draftId, [allocationId]));
  };

  const confirm = () => {
    if (pending?.type === "supplier") {
      setState((current) =>
        changeDraftSupplier(current, draftId, pending.supplier, {
          confirmed: true,
        }),
      );
    } else if (pending?.type === "move") {
      setState((current) =>
        moveAllocation(current, pending.allocationId, pending.targetId),
      );
    } else if (
      pending?.type === "splitQuantity" ||
      pending?.type === "splitDraftQuantity"
    ) {
      setState((current) => {
        const split = splitAllocation(
          current,
          pending.allocationId,
          splitQuantityValue,
        );
        if (pending.type === "splitQuantity") return split;
        const newId = Object.keys(split.allocationsById).find(
          (id) => !current.allocationsById[id],
        );
        return splitDraft(split, draftId, [newId]);
      });
    }
    setPending(null);
  };

  const continueToReview = () => {
    const firstInvalidIndex = state.draftOrder.findIndex((_, index) =>
      Object.keys(clientErrors).some((path) =>
        path.startsWith(`drafts.${index}.`),
      ),
    );
    if (Object.keys(clientErrors).length > 0) {
      setShowValidationErrors(true);
      if (firstInvalidIndex >= 0) {
        setState((current) => ({
          ...current,
          activeDraftId: current.draftOrder[firstInvalidIndex],
        }));
      }
      return;
    }
    setShowValidationErrors(false);
    onContinue();
  };

  if (!data) return null;
  const footer = (
    <div className="flex flex-wrap justify-between gap-3">
      <Button type="button" variant="outline" onClick={onBack}>
        {t(`${translationPrefix}back`)}
      </Button>
      <Button type="button" onClick={continueToReview}>
        {t(`${translationPrefix}continue_review`)} ({state.draftOrder.length}{" "}
        PO)
      </Button>
    </div>
  );

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        className="hidden min-h-0 space-y-3 overflow-y-auto lg:block"
        aria-label={t(`${translationPrefix}draft_list`)}
      >
        <p className="text-sm font-medium">
          {t(`${translationPrefix}draft_count`, {
            count: state.draftOrder.length,
          })}
        </p>
        {state.draftOrder.map((id, index) => {
          const draft = state.draftsById[id];
          const incomplete = Object.keys(clientErrors).some((path) =>
            path.startsWith(`drafts.${index}.`),
          );
          const count = Object.values(state.allocationsById).filter(
            (allocation) => allocation.draft_id === id,
          ).length;
          return (
            <Button
              key={id}
              type="button"
              variant={id === draftId ? "secondary" : "outline"}
              aria-label={`draft-${index + 1}`}
              aria-current={id === draftId ? "true" : undefined}
              className="h-auto w-full justify-start whitespace-normal text-left"
              onClick={() =>
                setState((current) => ({ ...current, activeDraftId: id }))
              }
            >
              <span>
                {t(`${translationPrefix}draft_number`, { number: index + 1 })}
                <small className="block font-normal">
                  {draft.data?.supplier?.name ?? draft.supplier_id} · {count}{" "}
                  item
                </small>
                {incomplete && (
                  <small className="mt-1 block font-medium text-destructive">
                    {t(`${translationPrefix}draft_incomplete`)}
                  </small>
                )}
              </span>
            </Button>
          );
        })}
        <p className="text-xs text-muted-foreground">
          {t(`${translationPrefix}split_hint`)}
        </p>
      </aside>
      <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto">
        <label className="grid gap-1 text-sm lg:hidden">
          {t(`${translationPrefix}draft_list`)}
          <select
            aria-label={t(`${translationPrefix}draft_list`)}
            value={draftId}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                activeDraftId: event.target.value,
              }))
            }
            className="h-9 rounded-md border border-input bg-background px-2"
          >
            {state.draftOrder.map((id, index) => (
              <option key={id} value={id}>
                {t(`${translationPrefix}draft_number`, { number: index + 1 })}
                {Object.keys(clientErrors).some((path) =>
                  path.startsWith(`drafts.${index}.`),
                )
                  ? ` — ${t(`${translationPrefix}draft_incomplete`)}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <QuantityWarnings state={state} sources={sources} />
        <Card>
          <CardContent className="min-w-0 space-y-4 p-4 md:p-6">
            <header>
              <h2 className="text-lg font-semibold">
                {t(`${translationPrefix}draft_number`, {
                  number: state.draftOrder.indexOf(draftId) + 1,
                })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {data.supplier?.name ?? state.draftsById[draftId].supplier_id}
              </p>
            </header>
            {Object.keys(draftErrors).length > 0 && (
              <div role="alert" className="flex-col w-full mt-4 alert error">
                <p className="font-medium">{t("core.form.errors.title")}</p>
                <ul>
                  {Object.entries(draftErrors).map(([path, message]) => (
                    <li key={path}>
                      {path}:{" "}
                      {Array.isArray(message) ? message.join(", ") : message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <FormChildren
              key={draftId}
              data={data}
              setData={setData}
              defaultData={data}
              errors={draftErrors}
              defaultMenu="detail"
              isCreate
            >
              <PurchaseOrderFields
                data={data}
                setData={setData}
                defaultData={data}
                disabled={false}
                sourceLocked
                sourceItemActions={({ row, toggleDialog }) => (
                  <SourceItemActions
                    row={row}
                    toggleDialog={toggleDialog}
                    state={state}
                    draftId={draftId}
                    onMove={onMove}
                    onSplitDraft={onSplitDraft}
                    onSplitQuantity={(allocationId) => {
                      setSplitQuantityValue(1);
                      setPending({ type: "splitQuantity", allocationId });
                    }}
                  />
                )}
              />
            </FormChildren>
          </CardContent>
        </Card>
        <PurchaseRequestNotes sources={activeSources} />
        {footerContainer ? createPortal(footer, footerContainer) : footer}
      </div>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(`${translationPrefix}confirm_changes_title`)}
            </DialogTitle>
            <DialogDescription>
              {pending?.type?.startsWith("split")
                ? t(`${translationPrefix}split_quantity_hint`)
                : t(`${translationPrefix}confirm_changes_description`)}
            </DialogDescription>
          </DialogHeader>
          {pending?.type?.startsWith("split") && (
            <label className="grid gap-1 text-sm">
              {t(`${translationPrefix}split_quantity`)}
              <Input
                type="number"
                min="1"
                aria-label={t(`${translationPrefix}split_quantity`)}
                value={splitQuantityValue}
                onChange={(event) =>
                  setSplitQuantityValue(Number(event.target.value))
                }
              />
            </label>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPending(null)}
            >
              {t(`${translationPrefix}cancel`)}
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={
                pending?.type?.startsWith("split") &&
                !(
                  splitQuantityValue > 0 &&
                  splitQuantityValue <
                    state.allocationsById[pending.allocationId]?.quantity
                )
              }
            >
              {t(`${translationPrefix}confirm`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
