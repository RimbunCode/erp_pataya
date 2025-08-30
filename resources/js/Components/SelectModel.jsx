import { forwardRef, memo, useMemo, useState } from "react";

import { TooltipProvider } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { AlertDialogAction, AlertDialogCancel } from "./ui/alert-dialog";
import FormInput from "./FormInput";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from "./ui/select";

export default memo(
  forwardRef(function SelectModel({ title, trigger, from }, ref) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [model, setModel] = useState(null);
    const [select, setSelect] = useState(null);

    const [filterModel, configModels] = useMemo(() => {
      if (typeof from === "string") {
        return [
          {
            model: from,
          },
          {},
        ];
      }
      if (typeof from === "object") {
        const froms = [];
        const config = {};

        Object.entries(from).forEach(([key, value]) => {
          froms.push(key);
          config[key] = value;
        });
        return [
          {
            model: {
              or: froms,
            },
          },
          config,
        ];
      }
    }, [from]);
    const selects = useMemo(() => {
      const nameModel = model?.model?.replace("\\\\", "\\");
      const config = configModels[nameModel] ?? {};
      const selects = config.select;
      if (!selects) return null;
      return Object.keys(selects);
    }, [model, configModels]);
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            ref={ref}
            asChild
            className="w-full"
            onClick={() => setOpen(true)}
          >
            {trigger}
          </DialogTrigger>
          <DialogContent className="max-w-screen-md py-0 overflow-hidden">
            <TooltipProvider>
              <div
                className={cn(
                  "max-h-screen overflow-y-hidden flex flex-col",
                  // disabled &&
                  //   " [&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
                )}
              >
                <DialogHeader className="pt-6 mb-4 border-b border-muted-foreground/30">
                  <DialogTitle className="flex items-center mb-1 gap-x-2">
                    {title ?? t("core.form.select_model")}
                  </DialogTitle>
                  <DialogDescription className="sr-only"></DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 px-1 my-2 gap-x-3">
                  <FormInput label={t("core.form.from")} required={true}>
                    <PermissionLinkModel
                      required={false}
                      placeholder={t("core.form.model.placeholder")}
                      value={model}
                      onValueChange={setModel}
                      filters={filterModel}
                    />
                  </FormInput>
                  {selects && (
                    <FormInput label={t("core.form.select")} required={true}>
                      <Select
                        required={false}
                        value={select}
                        onValueChange={setSelect}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("core.form.select.placeholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>{model?.name}</SelectItem>
                          {selects.map((x) => (
                            <SelectItem key={x} value={x}>
                              {model?.translateKey
                                ? t(`${model?.translateKey}.columns.${x}`)
                                : x}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormInput>
                  )}
                </div>
                <DialogFooter className="pb-6 mt-4">
                  <AlertDialogCancel
                    className="h-8"
                    onClick={() => setOpen(false)}
                  >
                    {t("core.form.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="h-8"
                    type="submit"
                    onClick={() => {}}
                  >
                    {t("core.form.select")}
                  </AlertDialogAction>
                </DialogFooter>
              </div>
            </TooltipProvider>
          </DialogContent>
        </Dialog>
      </>
    );
  }),
);
