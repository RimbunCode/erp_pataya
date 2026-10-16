import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@/Components/ui/alert";
import { calculatePurchaseOrderAmounts } from "../purchaseOrderAmounts";
import { formatWarningQuantity, getQuantityWarnings } from "./allocationState";
import { buildSubmissionDrafts, validateSubmissionDrafts } from "./reviewData";

const translationPrefix = "purchase.purchaseOrder.from_requests.";

export default function ReviewStep({
  state,
  sources = [],
  sourceErrors = {},
  token,
  defaultDate,
  onBack,
  onEditDraft,
  onRefreshSources,
  onErrors,
  footerContainer,
  createKey = () => crypto.randomUUID(),
}) {
  const { t } = useLaravelReactI18n();
  const [pending, setPending] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  useEffect(() => {
    setServerErrors((current) => {
      if (!current.sources) return current;
      const remaining = { ...current };
      delete remaining.sources;
      return remaining;
    });
  }, [sources]);
  const submission = useRef(null);
  const drafts = buildSubmissionDrafts(state, defaultDate);
  const clientErrors = validateSubmissionDrafts(drafts);
  const warnings = getQuantityWarnings(state, sources);
  const warningsBySourceId = new Map(
    warnings.map((warning) => [warning.purchase_request_item_id, warning]),
  );
  const sourceErrorMessage = Object.values(sourceErrors)
    .flat()
    .filter(Boolean)
    .join("\n");
  const allErrors = {
    ...clientErrors,
    ...serverErrors,
    ...(sourceErrorMessage ? { sources: sourceErrorMessage } : {}),
  };

  const save = () => {
    if (pending || Object.keys(clientErrors).length) return;
    const signature = JSON.stringify({ token, drafts });
    if (submission.current?.signature !== signature) {
      submission.current = { signature, key: createKey() };
    }
    setServerErrors({});
    setPending(true);
    router.post(
      window.route("purchaseOrders.fromRequests.store"),
      {
        token,
        idempotency_key: submission.current.key,
        drafts,
      },
      {
        preserveScroll: true,
        onError: (errors) => {
          setServerErrors(errors);
          onErrors?.(errors);
        },
        onHttpException: () => {
          setServerErrors({ request: t(`${translationPrefix}save_failed`) });
          return false;
        },
        onNetworkError: () => {
          setServerErrors({ request: t(`${translationPrefix}save_failed`) });
          return false;
        },
        onFinish: () => setPending(false),
      },
    );
  };
  const footer = (
    <div className="flex flex-wrap justify-between gap-3">
      <Button type="button" variant="outline" onClick={onBack}>
        {t(`${translationPrefix}back`)}
      </Button>
      <Button
        type="button"
        disabled={
          pending ||
          Object.keys(clientErrors).length > 0 ||
          !!sourceErrorMessage
        }
        onClick={save}
      >
        {t(`${translationPrefix}save_drafts`)}
      </Button>
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t(`${translationPrefix}review`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`${translationPrefix}review_description`)}
        </p>
      </header>
      {(allErrors.sources || allErrors.request || allErrors.drafts) && (
        <Alert variant="destructive" appearance="light">
          <AlertContent>
            <AlertTitle>{t(`${translationPrefix}save_failed`)}</AlertTitle>
            <AlertDescription>
              <p>
                {allErrors.sources ?? allErrors.request ?? allErrors.drafts}
              </p>
              {allErrors.sources && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={onRefreshSources}
                >
                  {t(`${translationPrefix}refresh_sources`)}
                </Button>
              )}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {drafts.map((draft, index) => {
        const total = calculatePurchaseOrderAmounts(draft);
        const errors = Object.entries(allErrors).filter(([path]) =>
          path.startsWith(`drafts.${index}.`),
        );
        const currency = (draft.currency?.code ?? "IDR").toUpperCase();
        return (
          <Card key={draft.id}>
            <CardContent className="grid gap-3 p-4 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {t(`${translationPrefix}draft_number`, {
                      number: index + 1,
                    })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {draft.supplier?.name ?? draft.supplier?.id}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditDraft(draft.id)}
                >
                  {t(`${translationPrefix}edit_draft`)}
                </Button>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">
                    {t("purchase.purchaseOrder.columns.date")}
                  </dt>
                  <dd>{String(draft.date)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t(`${translationPrefix}item_count`)}
                  </dt>
                  <dd>{draft.items.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("purchase.purchaseOrder.columns.total")}
                  </dt>
                  <dd className="font-semibold">
                    {currency} {total.amount.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <ul className="space-y-1 border-t pt-3 text-sm">
                {draft.items.map((item) => {
                  const source = state.sourcesById[item.source_item_id];
                  const warning = warningsBySourceId.get(item.source_item_id);
                  const unitLabel =
                    item.unit?.name ?? item.unit?.code ?? item.unit?.id;
                  const sourceUnitLabel =
                    source?.unit?.name ??
                    source?.unit?.code ??
                    source?.unit?.id;
                  return (
                    <li key={item.id} className="space-y-2">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>
                          {source?.purchase_request_code} ·{" "}
                          {source?.item_name ??
                            source?.item?.name ??
                            source?.description ??
                            source?.item?.code ??
                            item.item?.id}
                        </span>
                        <span>
                          {item.quantity} {unitLabel} × {item.rate}
                        </span>
                      </div>
                      {warning && (
                        <Alert
                          role="alert"
                          aria-label={t(
                            `${translationPrefix}quantity_warning_title`,
                          )}
                          variant="warning"
                          appearance="light"
                        >
                          <AlertContent>
                            <AlertDescription>
                              {t(
                                `${translationPrefix}quantity_${warning.direction}`,
                                {
                                  required: formatWarningQuantity(
                                    warning.unordered_quantity,
                                  ),
                                  allocated: formatWarningQuantity(
                                    warning.allocated_quantity,
                                  ),
                                  difference: formatWarningQuantity(
                                    Math.abs(warning.difference),
                                  ),
                                },
                              )}{" "}
                              {sourceUnitLabel}
                            </AlertDescription>
                          </AlertContent>
                        </Alert>
                      )}
                    </li>
                  );
                })}
              </ul>
              {errors.length > 0 && (
                <div
                  role="alert"
                  className="space-y-1 text-sm text-destructive"
                >
                  <p>{t(`${translationPrefix}draft_error`)}</p>
                  <ul>
                    {errors.map(([path, message]) => (
                      <li key={path}>
                        {path.replace(`drafts.${index}.`, "")}:{" "}
                        {Array.isArray(message) ? message.join(", ") : message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t(`${translationPrefix}saving`)}
        </p>
      )}
      {footerContainer ? createPortal(footer, footerContainer) : footer}
    </div>
  );
}
