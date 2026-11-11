import { useState } from "react";
import { Undo2 } from "lucide-react";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import ReverseJournalDialog from "./ReverseJournalDialog";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({
  journal,
  lines,
  totals,
  minorUnit,
  canReverse = false,
  reversal = {},
}) {
  const { t } = useLaravelReactI18n();
  const [reverseOpen, setReverseOpen] = useState(false);

  return (
    <FormPage
      key={journal?.id}
      isCreate={false}
      name="journal"
      disabled
      deleteable={false}
      sidebarContent={false}
      bottombarContent={false}
      controls={
        canReverse && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReverseOpen(true)}
            >
              <Undo2 className="size-4" aria-hidden="true" />
              {t("finances.journal.actions.reverse")}
            </Button>
            <ReverseJournalDialog
              open={reverseOpen}
              onOpenChange={setReverseOpen}
              journal={journal}
              reversal={reversal}
            />
          </>
        )
      }
    >
      <Form lines={lines} totals={totals} minorUnit={minorUnit} />
    </FormPage>
  );
}
