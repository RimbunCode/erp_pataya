import React, { useState } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Toggle switch for activating or deactivating Custom Mode on a gjsRelationsTable.
 * Shows a confirmation dialog before switching in either direction.
 *
 * @param {object} props
 * @param {boolean} props.isCustomMode - Current custom mode state
 * @param {function} props.onModeChange - Called with (enabled: boolean) after user confirms
 */
function CustomModeToggle({ isCustomMode, onModeChange }) {
  const { t } = useLaravelReactI18n();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleToggleClick = () => {
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    setDialogOpen(false);
    onModeChange(!isCustomMode);
  };

  const handleCancel = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button
          type="button"
          role="switch"
          aria-checked={isCustomMode}
          onClick={handleToggleClick}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isCustomMode ? "bg-primary" : "bg-input",
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform",
              isCustomMode ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
        <span className="text-sm font-medium">
          {t("core.printTemplate.editor.custom_mode", {}, "Custom Mode")}
        </span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isCustomMode
                ? t(
                    "core.printTemplate.editor.deactivate_custom_mode_title",
                    {},
                    "Deactivate Custom Mode",
                  )
                : t(
                    "core.printTemplate.editor.activate_custom_mode_title",
                    {},
                    "Activate Custom Mode",
                  )}
            </DialogTitle>
            <DialogDescription>
              {isCustomMode
                ? t(
                    "core.printTemplate.editor.deactivate_custom_mode_warning",
                    {},
                    "Reverting to standard mode will discard your custom header and body layout and regenerate the table from the column configuration.",
                  )
                : t(
                    "core.printTemplate.editor.activate_custom_mode_warning",
                    {},
                    "Switching to Custom Mode will disable the column management panel. Column visibility, ordering, and add/remove operations will no longer be available for this table.",
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {t("core.common.cancel", {}, "Cancel")}
            </Button>
            <Button
              variant={isCustomMode ? "destructive" : "default"}
              onClick={handleConfirm}
            >
              {isCustomMode
                ? t("core.printTemplate.editor.deactivate_confirm", {}, "Deactivate")
                : t("core.printTemplate.editor.activate_confirm", {}, "Activate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CustomModeToggle;
