import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/Components/ui/dialog";
import React, { useCallback, useState } from "react";
import { useForm, usePage } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import LoadingIcon from "@/Components/LoadingIcon";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import { memo } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ApproverDecision({ name, approval }) {
  const route = window.route;
  const user = usePage().props?.auth?.user;
  const { t } = useLaravelReactI18n();
  const { data, setData, post, reset, processing } = useForm({});
  const [open, setOpen] = useState(false);
  const currentStep = approval?.steps[approval.current_sequence] ?? null;

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      post(route("approvalInstances.decision", currentStep?.id), {
        reset: [name, "logs", "flash"],
        preserveState: true,
        preverseScroll: true,
        replace: true,
        onSuccess() {
          setOpen(false);
          reset();
        },
      });
    },
    [data],
  );
  if (!currentStep) return;

  const userCanDecide = currentStep.is_advanced
    ? currentStep.approvers?.some(
        (a) =>
          (a.approver_type === "user" && a.approver?.id === user?.id) ||
          (a.approver_type === "role" &&
            user?.id_roles?.find((r) => r === a.approver?.id)),
      )
    : user?.id == currentStep.approver?.id ||
      user?.id_roles?.find((x) => x == currentStep.approver?.id);

  if (!userCanDecide) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("core.form.approvalDecision.trigger")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="border-b border-muted-foreground/30">
          <DialogTitle>{t("core.form.approvalDecision.title")}</DialogTitle>
          <DialogDescription className="sr-only" />
        </DialogHeader>
        <form className="grid grid-cols-1 gap-y-4" onSubmit={onSubmit}>
          <FormInput
            name="decision"
            readOnly={processing}
            required
            label={t("core.form.approvalDecision.decision")}
          >
            <Select
              value={data.decision}
              onValueChange={(val) => setData("decision", val)}
              options={["approve", "reject"]}
              optionTrans="core.form.approvalDecision.decision.options"
            />
          </FormInput>
          <FormInput
            name="notes"
            readOnly={processing}
            label={t("core.form.approvalDecision.notes")}
          >
            <Textarea
              rows="3"
              value={data.notes ?? ""}
              onValueChange={(val) => setData("notes", val)}
            />
          </FormInput>
          <DialogFooter className="pt-2 -mb-2 border-t border-muted-foreground/30">
            <Button
              type="button"
              variant="secondary"
              disabled={processing}
              onClick={() => setOpen(false)}
            >
              {t("core.form.cancel")}
            </Button>
            <Button type="submit" disabled={processing}>
              {processing && <LoadingIcon />}
              {t("core.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ApproverDecision);
