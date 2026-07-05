import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Type, Tag, LayoutGrid } from "lucide-react";

/**
 * DropModeDialog - Dialog asinkron untuk memilih mode insert variabel ke canvas.
 * @param {object} props
 * @param {boolean} props.open - Status visibilitas modal
 * @param {string} props.variableName - Nama variabel untuk konteks judul
 * @param {string[]} props.modes - Daftar mode yang diizinkan (label, token, both)
 * @param {(mode: 'label' | 'token' | 'both') => void} props.onSelect - Callback saat mode dipilih
 * @param {() => void} props.onClose - Callback saat modal ditutup tanpa memilih
 * @returns {React.JSX.Element}
 */
const DropModeDialog = ({
  open,
  variableName,
  modes = ["label", "token", "both"],
  onSelect,
  onClose,
}) => {
  const { t } = useLaravelReactI18n();

  const handleSelect = (mode) => {
    onSelect(mode);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-sm" forceAsDialog align="center">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("core.printTemplate.editor.drop_mode_title") ||
              "Insert Variable"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("core.printTemplate.editor.drop_mode_description", {
              name: variableName,
            }) || `Choose how to insert "${variableName}"`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {modes.includes("label") && (
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4 gap-3"
              onClick={() => handleSelect("label")}
            >
              <Tag className="h-4 w-4 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {t("core.printTemplate.editor.mode_label_only") ||
                    "Label Only"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t("core.printTemplate.editor.mode_label_desc") ||
                    "Insert display label only"}
                </span>
              </div>
            </Button>
          )}

          {modes.includes("token") && (
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4 gap-3"
              onClick={() => handleSelect("token")}
            >
              <Type className="h-4 w-4 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {t("core.printTemplate.editor.mode_token_only") ||
                    "Token Only"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t("core.printTemplate.editor.mode_token_desc") ||
                    "Insert data token only"}
                </span>
              </div>
            </Button>
          )}

          {modes.includes("both") && (
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4 gap-3 border-primary/50 bg-primary/5 hover:bg-primary/10"
              onClick={() => handleSelect("both")}
            >
              <LayoutGrid className="h-4 w-4 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {t("core.printTemplate.editor.mode_both") ||
                    "Both (Label + Token)"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t("core.printTemplate.editor.mode_both_desc") ||
                    "Insert in a grid layout (Recommended)"}
                </span>
              </div>
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-full"
          >
            {t("core.printTemplate.editor.cancel") || "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DropModeDialog;
