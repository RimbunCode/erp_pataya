import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Check, Code2, AlertTriangle } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { validateCssDeclarations } from "../utils/cssUtils";
import { findProtectedSelectorsInCssText } from "../utils/manualCssRuleUtils";
import { handleModalEditorKeyDown } from "../utils/modalEditorUtils";
import MonacoCSSEditor from "./MonacoCSSEditor";

/**
 * CSSEditorModal - Modal dialog for editing manual CSS declarations.
 *
 * Features:
 * - Monaco CSS editor for editing CSS
 * - Validates CSS syntax on save, shows error indicators for invalid CSS
 * - Discards changes on cancel/close without save
 * - Persists draft CSS per component (reopening shows last saved CSS)
 * - Supports body node CSS (full CSS with selectors)
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6
 * @param {object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {(open: boolean) => void} props.onOpenChange - Callback to change open state
 * @param {string} props.initialCSS - The initial CSS text to edit
 * @param {(cssText: string) => void} props.onSave - Callback when CSS is saved
 * @param {string} props.componentId - Unique ID of the component being edited
 * @param {string[]} props.protectedSelectors - Selectors that are protected
 * @returns {React.JSX.Element}
 */
function CSSEditorModal({
  open,
  onOpenChange,
  initialCSS = "",
  onSave,
  componentId = "global",
  protectedSelectors = [],
}) {
  const { t } = useLaravelReactI18n();
  const [draft, setDraft] = useState(initialCSS);
  const [isValid, setIsValid] = useState(true);
  const [errors, setErrors] = useState([]);
  const normalizedProtectedSelectors = useMemo(
    () =>
      [
        ...new Set(
          (protectedSelectors || []).map((item) => String(item).trim()),
        ),
      ].filter(Boolean),
    [protectedSelectors],
  );
  const matchedProtectedSelectors = useMemo(
    () => findProtectedSelectorsInCssText(draft, normalizedProtectedSelectors),
    [draft, normalizedProtectedSelectors],
  );
  const warningSelectors = useMemo(
    () =>
      matchedProtectedSelectors.length
        ? matchedProtectedSelectors
        : normalizedProtectedSelectors,
    [matchedProtectedSelectors, normalizedProtectedSelectors],
  );

  // Reset draft to initialCSS when modal opens
  useEffect(() => {
    if (open) {
      setDraft(initialCSS);
      setIsValid(true);
      setErrors([]);
    }
  }, [open, initialCSS]);

  const handleValidationChange = useCallback((_valid, markers) => {
    const errorMarkers = markers.filter((marker) => marker.severity >= 8);
    setIsValid(!errorMarkers.length);
    setErrors(errorMarkers);
  }, []);

  const handleSave = useCallback(() => {
    // For body node, skip declaration validation (allows full CSS with selectors)
    const validation = validateCssDeclarations(draft);
    if (!validation.isValid) {
      setIsValid(false);
      setErrors(
        validation.errors.map((err) => ({
          severity: 8,
          message: `${err.reason}: "${err.declaration}"`,
        })),
      );
      return;
    }

    onSave?.(draft);
    onOpenChange?.(false);
  }, [draft, onSave, onOpenChange]);

  const handleCancel = useCallback(() => {
    // Discard changes - just close without saving
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent
        className="max-w-5xl max-h-[90dvh] overflow-hidden flex flex-col gap-0 p-0"
        align="center"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            {t("core.printTemplate.editor.manual_css")}
          </DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>

        {!isValid && errors.length > 0 && (
          <div className="shrink-0 mx-4 mt-2 p-3 border border-destructive/50 bg-destructive/5 rounded-md">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {t("core.printTemplate.editor.css_syntax_error")} (
                {errors.length})
              </span>
            </div>
            <ul className="space-y-1">
              {errors.slice(0, 5).map((error, idx) => (
                <li key={idx} className="text-xs text-destructive/80">
                  •{" "}
                  {error.message ||
                    t("core.printTemplate.editor.invalid_css_declaration")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {normalizedProtectedSelectors.length > 0 && (
          <div className="shrink-0 mx-4 mt-2 p-3 border border-amber-500/50 bg-amber-500/10 rounded-md">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {t("core.printTemplate.editor.protected_selector_title")}
              </span>
            </div>
            <p className="text-xs text-amber-800">
              {t("core.printTemplate.editor.protected_selector_desc")}
            </p>
            <ul className="mt-1.5 space-y-1">
              {warningSelectors.map((selector) => (
                <li key={selector} className="text-xs text-amber-800">
                  • {selector}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div
          className="min-h-0 flex-1 overflow-y-auto bg-muted/20 m-4 rounded-md border"
          onKeyDown={(event) => {
            handleModalEditorKeyDown(event, handleSave);
          }}
        >
          <MonacoCSSEditor
            value={draft}
            componentId={componentId}
            onChange={(nextValue) => setDraft(nextValue)}
            onValidationChange={handleValidationChange}
            height="300px"
          />
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3">
          <Button variant="outline" size="md" onClick={handleCancel}>
            {t("core.printTemplate.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            <Check className="h-4 w-4" />
            {t("core.printTemplate.editor.edit_css")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CSSEditorModal;
