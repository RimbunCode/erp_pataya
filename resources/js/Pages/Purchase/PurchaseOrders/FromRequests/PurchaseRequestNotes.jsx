import React from "react";
import { Link } from "@inertiajs/react";
import { ChevronDown, FileText } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Button } from "@/Components/ui/button";
import { Card } from "@/Components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";

export default function PurchaseRequestNotes({ sources = [] }) {
  const { t } = useLaravelReactI18n();
  const uniqueSources = Array.from(
    new Map(sources.map((source) => [String(source.id), source])).values(),
  );

  return (
    <Card className="min-w-0">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="group h-auto w-full justify-between gap-3 p-4 text-left"
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 shrink-0" aria-hidden="true" />
              {t("purchase.purchaseOrder.from_requests.pr_notes")}
            </span>
            <ChevronDown
              className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 border-t p-4">
            {uniqueSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("purchase.purchaseOrder.from_requests.no_pr_sources")}
              </p>
            ) : (
              uniqueSources.map((source) => (
                <section key={source.id} className="min-w-0 space-y-2">
                  <Link
                    href={window.route("purchaseRequests.show", source.id)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {source.code}
                  </Link>
                  <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                    {source.external_note?.trim()
                      ? source.external_note
                      : t("purchase.purchaseOrder.from_requests.no_pr_note")}
                  </p>
                </section>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
