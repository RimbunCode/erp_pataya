import React, { useEffect, useState } from "react";
import { Head, router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import AppLayout from "@/Layouts/AppLayout";
import { Button } from "@/Components/ui/button";
import AllocationStep from "./AllocationStep";
import DraftStep from "./DraftStep";
import ReviewStep from "./ReviewStep";
import { createInitialState } from "./allocationState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";

const translationPrefix = "purchase.purchaseOrder.from_requests.";
const steps = ["allocation", "drafts", "review"];

function WorkspaceContent({
  token,
  sources,
  sourceErrors,
  renderDraftStep,
  renderReviewStep,
}) {
  const { t } = useLaravelReactI18n();
  const [state, setState] = useState(() => createInitialState(sources));
  const [step, setStep] = useState("allocation");
  const [furthestStep, setFurthestStep] = useState(0);
  const [defaultDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [footerContainer, setFooterContainer] = useState(null);
  useEffect(() => {
    if (!sources.length || Object.keys(sourceErrors).length) return;
    const refreshed = createInitialState(sources);
    setState((current) => ({
      ...current,
      sourcesById: { ...current.sourcesById, ...refreshed.sourcesById },
    }));
    setValidationErrors({});
  }, [sources, sourceErrors]);
  const availableItemIds = new Set(
    sources.flatMap((source) => source.items?.map((item) => item.id) ?? []),
  );
  const missingItems = Object.values(state.allocationsById).filter(
    (allocation) => !availableItemIds.has(allocation.purchase_request_item_id),
  );
  const currentSourceErrors = missingItems.length
    ? {
        ...sourceErrors,
        missing_items: t(`${translationPrefix}missing_source_items`),
      }
    : sourceErrors;
  const goToStep = (nextStep) => {
    setStep(nextStep);
    setFurthestStep((current) => Math.max(current, steps.indexOf(nextStep)));
  };
  const extensionProps = {
    token,
    sources,
    sourceErrors: currentSourceErrors,
    errors: validationErrors,
    onErrors: setValidationErrors,
    defaultDate,
    state,
    setState,
    step,
    setStep: goToStep,
    onBack: () => goToStep(step === "review" ? "drafts" : "allocation"),
    onContinue: () => goToStep("review"),
    onEditDraft: (draftId) => {
      setState((current) => ({ ...current, activeDraftId: draftId }));
      goToStep("drafts");
    },
    onRefreshSources: () => setConfirmRefresh(true),
    footerContainer,
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4">
      <header className="shrink-0 space-y-2">
        <h1 className="text-xl font-semibold">
          {t(`${translationPrefix}title`)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(`${translationPrefix}source_summary`, {
            requests: sources.length,
            items: Object.keys(state.sourcesById).length,
          })}
        </p>
      </header>
      <nav className="shrink-0" aria-label={t(`${translationPrefix}steps`)}>
        <ol className="grid grid-cols-3 gap-2">
          {steps.map((name, index) => (
            <li key={name}>
              <Button
                type="button"
                className="h-auto w-full whitespace-normal py-3 text-xs sm:text-sm"
                variant={step === name ? "default" : "outline"}
                aria-current={step === name ? "step" : undefined}
                disabled={index > steps.indexOf(step) || index > furthestStep}
                onClick={() => goToStep(name)}
              >
                {index + 1}. {t(`${translationPrefix}${name}`)}
              </Button>
            </li>
          ))}
        </ol>
      </nav>
      <div
        data-testid="workspace-scroll-region"
        className={
          step === "drafts"
            ? "min-h-0 min-w-0 flex-1 overflow-hidden"
            : "min-h-0 min-w-0 flex-1 overflow-y-auto"
        }
      >
        {step === "allocation" && (
          <AllocationStep
            state={state}
            setState={setState}
            sources={sources}
            sourceErrors={currentSourceErrors}
            footerContainer={footerContainer}
            onContinue={() => goToStep("drafts")}
          />
        )}
        {step === "drafts" &&
          (renderDraftStep ? (
            renderDraftStep(extensionProps)
          ) : (
            <DraftStep {...extensionProps} />
          ))}
        {step === "review" &&
          (renderReviewStep ? (
            renderReviewStep(extensionProps)
          ) : (
            <ReviewStep {...extensionProps} />
          ))}
      </div>
      <footer
        ref={setFooterContainer}
        data-testid="workspace-footer"
        className="shrink-0 border-t bg-background py-3"
      />
      <Dialog open={confirmRefresh} onOpenChange={setConfirmRefresh}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(`${translationPrefix}refresh_sources`)}
            </DialogTitle>
            <DialogDescription>
              {t(`${translationPrefix}refresh_sources_confirmation`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRefresh(false)}
            >
              {t(`${translationPrefix}cancel`)}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmRefresh(false);
                router.reload({
                  only: ["sources", "sourceErrors"],
                  preserveState: true,
                });
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

export default function Workspace({
  token,
  sources,
  sourceErrors = {},
  renderDraftStep,
  renderReviewStep,
}) {
  const { t } = useLaravelReactI18n();
  return (
    <AppLayout viewportShell className="px-4 pb-0 pt-4 md:px-8">
      <Head title={t(`${translationPrefix}title`)} />
      {sources === undefined ? (
        <div
          role="status"
          className="animate-pulse py-8 text-center text-muted-foreground"
        >
          {t(`${translationPrefix}loading`)}
        </div>
      ) : (
        <WorkspaceContent
          key={token}
          token={token}
          sources={sources}
          sourceErrors={sourceErrors}
          renderDraftStep={renderDraftStep}
          renderReviewStep={renderReviewStep}
        />
      )}
    </AppLayout>
  );
}
