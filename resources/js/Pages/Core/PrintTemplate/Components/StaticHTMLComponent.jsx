import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { sanitizeHTML } from "@/lib/htmlSanitizer";
import { AlertTriangle, Code2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import MonacoHTMLEditor from "./MonacoHTMLEditor";

/**
 * StaticHTMLComponent - Code editor modal for custom HTML input
 *
 * Features:
 * - Code editor modal (textarea) for HTML input
 * - Real-time sanitization preview using htmlSanitizer utility
 * - Warning display for removed/dangerous content
 * - On save/confirm, applies sanitized HTML to the GrapeJS component
 *
 * Requirements: 6.1, 6.2, 6.7, 6.8
 * @param {object} root0
 * @param {boolean} root0.open
 * @param {(open: boolean) => void} root0.onOpenChange
 * @param {string} root0.initialHTML
 * @param {(rawHTML: string, sanitizedHTML: string, warnings: string[]) => void} root0.onSave
 * @returns {React.JSX.Element}
 */
function StaticHTMLComponent({ open, onOpenChange, initialHTML = "", onSave }) {
  const [rawHTML, setRawHTML] = useState(initialHTML);
  const [sanitizationResult, setSanitizationResult] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setRawHTML(initialHTML);
      if (initialHTML) {
        const result = sanitizeHTML(initialHTML);
        setSanitizationResult(result);
      } else {
        setSanitizationResult(null);
      }
    }
  }, [open, initialHTML]);

  // Real-time sanitization preview (Requirement 6.7)
  const handleHTMLChange = useCallback((e) => {
    const value = e.target.value;
    setRawHTML(value);

    if (value.trim()) {
      const result = sanitizeHTML(value);
      setSanitizationResult(result);
    } else {
      setSanitizationResult(null);
    }
  }, []);

  // On save/confirm, apply sanitized HTML (Requirement 6.2)
  const handleSave = useCallback(() => {
    if (!sanitizationResult) {
      onSave?.("", "", []);
      onOpenChange?.(false);
      return;
    }

    onSave?.(
      rawHTML,
      sanitizationResult.sanitizedHTML,
      sanitizationResult.warnings,
    );
    onOpenChange?.(false);
  }, [rawHTML, sanitizationResult, onSave, onOpenChange]);

  const hasWarnings =
    sanitizationResult?.warnings && sanitizationResult.warnings.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl max-h-[92svh] overflow-y-auto"
        align="center"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Custom HTML Editor
          </DialogTitle>
          <DialogDescription>
            Masukkan HTML kustom. Konten berbahaya akan otomatis dihapus untuk
            keamanan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Code Editor (textarea) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Input HTML</label>
            <div
              className={cn(
                "overflow-hidden rounded-md border min-h-[400px]",
                "bg-muted/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
                "dark:bg-zinc-900 dark:text-zinc-100",
              )}
              onKeyDown={(e) => {
                // Prevent "/" from propagating to GrapesJS global command palette
                // while still allowing the character to be inserted normally
                if (e.key === "/") {
                  e.stopPropagation();
                }
              }}
            >
              <MonacoHTMLEditor
                value={rawHTML}
                onChange={(nextValue) =>
                  handleHTMLChange({
                    target: {
                      value: nextValue ?? "",
                    },
                  })
                }
                height="400px"
              />
            </div>
          </div>

          {/* Sanitization Preview (Requirement 6.7 - real-time preview) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Preview (Sanitized)</label>
            <div
              className={cn(
                "w-full min-h-[400px] p-3 border rounded-md overflow-auto",
                "bg-white dark:bg-zinc-950",
              )}
            >
              {sanitizationResult?.sanitizedHTML ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizationResult.sanitizedHTML,
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Preview akan muncul di sini...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Warnings display (Requirement 6.7 - display warnings for removed content) */}
        {hasWarnings && (
          <div className="mt-2 p-3 border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Peringatan Keamanan
              </span>
            </div>
            <ul className="space-y-1">
              {sanitizationResult.warnings.map((warning, idx) => (
                <li
                  key={idx}
                  className="text-xs text-amber-700 dark:text-amber-400"
                >
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange?.(false)}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!rawHTML.trim()}
          >
            <Check className="h-4 w-4" />
            Simpan HTML
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StaticHTMLComponent;
