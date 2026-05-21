import React, { useState, useEffect, useCallback } from "react";
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
 * @param {boolean} props.isBodyNode - Whether editing body-level CSS (allows selectors)
 * @param {(cssText: string) => void} props.onSave - Callback when CSS is saved
 * @param {string} props.componentId - Unique ID of the component being edited
 * @returns {React.JSX.Element}
 */
function CSSEditorModal({
  open,
  onOpenChange,
  initialCSS = "",
  isBodyNode = false,
  onSave,
  componentId = "global",
}) {
  const { t } = useLaravelReactI18n();
  const [draft, setDraft] = useState(initialCSS);
  const [isValid, setIsValid] = useState(true);
  const [errors, setErrors] = useState([]);

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
    if (!isBodyNode) {
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
    }

    onSave?.(draft);
    onOpenChange?.(false);
  }, [draft, isBodyNode, onSave, onOpenChange]);

  const handleCancel = useCallback(() => {
    // Discard changes - just close without saving
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent
        className="max-w-xl max-h-[92svh] overflow-y-auto"
        align="center"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            {t("core/printTemplate.editor.manual_css")}
          </DialogTitle>
          <DialogDescription>
            {isBodyNode
              ? t("core/printTemplate.editor.css_body_hint") ||
                "Write CSS with selectors for the body node."
              : t("core/printTemplate.editor.css_declaration_hint") ||
                "Write CSS declarations (property: value;) without selectors."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <div
            className="overflow-hidden rounded-md border min-h-[300px]"
            onKeyDown={(e) => {
              // Prevent "/" from propagating to GrapesJS global command palette
              if (e.key === "/") {
                e.stopPropagation();
              }
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

          {!isValid && errors.length > 0 && (
            <div className="mt-2 p-3 border border-destructive/50 bg-destructive/5 rounded-md">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  CSS Syntax Error ({errors.length})
                </span>
              </div>
              <ul className="space-y-1">
                {errors.slice(0, 5).map((error, idx) => (
                  <li key={idx} className="text-xs text-destructive/80">
                    • {error.message || "Invalid CSS declaration"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="md" onClick={handleCancel}>
            {t("core/printTemplate.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            <Check className="h-4 w-4" />
            {t("core/printTemplate.editor.edit_css")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CSSEditorModal;
