import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import { Button } from "@/Components/ui/button";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(
  forwardRef(function FormNewRule({ onApply: _onApply }, ref) {
    const { t } = useLaravelReactI18n();
    const defaultValue = useMemo(
      () => ({
        model: null,
        level: 0,
        only_creator: false,
      }),
      [],
    );
    const [rule, setRule] = useState(defaultValue);
    const [open, setOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }));

    const onApply = useCallback(
      (model) => {
        _onApply(
          model
            ? {
                model,
                level: 0,
                only_creator: false,
              }
            : rule,
        );
        setOpen(false);
      },
      [_onApply, rule],
    );

    useEffect(() => {
      if (!open) {
        setRule(defaultValue);
      }
    }, [open]);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="pb-2 border-b border-muted-foreground/25">
            <DialogTitle>{t("user.role.new_rule")}</DialogTitle>
            <DialogDescription className="sr-only"></DialogDescription>
          </DialogHeader>
          <div className="w-full grid grid-cols-1 gap-4">
            <FormInput
              label={t("user.role.columns.model")}
              required
              className="ml-1"
            >
              <PermissionLinkModel
                required={false}
                placeholder={t("user.role.columns.model.placeholder")}
                filters={{
                  model: {
                    notIn: [
                      "App\\Models\\Helpdesk\\Ticket",
                      "App\\Models\\Core\\Changelog",
                    ],
                  },
                }}
                value={rule.model}
                onValueChange={(val) => {
                  if (val && !(val.allow_only_creator ?? val.is_submitable)) {
                    onApply(val);
                    return;
                  }
                  setRule((prev) => ({
                    ...prev,
                    model: val,
                    level: val?.is_submitable ? prev.level : 0,
                  }));
                }}
              />
            </FormInput>
            {(rule.model?.allow_only_creator ?? rule.model?.is_submitable) && (
              <FormInput label={t("user.role.columns.level")}>
                <NumberInput
                  className="text-left"
                  allowDecimals={false}
                  decimalScale={0}
                  value={rule.level}
                  onValueChange={(val) => {
                    setRule((prev) => ({
                      ...prev,
                      level: val,
                    }));
                  }}
                  min={0}
                  max={9}
                />
              </FormInput>
            )}
            {rule.level == 0 &&
              (rule.model?.allow_only_creator ??
                rule.model?.is_submitable ??
                false) && (
                <FormCheckbox
                  label={t("user.role.columns.only_creator")}
                  checked={rule.level > 0 ? false : rule.only_creator}
                  onCheckedChange={(val) =>
                    setRule((prev) => ({ ...prev, only_creator: val }))
                  }
                />
              )}
          </div>
          <DialogFooter className="pt-2 -mb-2 border-t border-muted-foreground/25">
            <Button
              type="button"
              variant="primary"
              className="h-8 w-fit"
              onClick={() => onApply()}
            >
              {t("core.form.close_and_apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }),
);
