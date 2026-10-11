import { XIcon } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { Button } from "@/Components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { cn } from "@/lib/utils";
import { normalizeAction, partitionBulk } from "./rowActions";

/**
 * Bar aksi massal untuk baris terpilih.
 * Hanya aksi `bulk` yang tampil; baris yang tidak memenuhi `enabled` dilewati
 * dan jumlahnya ditunjukkan lewat label + tooltip. Render null bila tidak ada
 * baris terpilih.
 *
 * @param {{
 *   rows: object[],
 *   actions: object[],
 *   pendingKey: string | null,
 *   onRun: (action: object, rows: object[]) => void,
 *   onClear: () => void,
 *   variant?: "desktop" | "mobile",
 * }} props
 */
export default function BulkActionBar({
  rows,
  actions,
  pendingKey,
  onRun,
  onClear,
  variant = "desktop",
}) {
  const { t } = useLaravelReactI18n();

  if (rows.length === 0) {
    return null;
  }

  const bulkActions = actions.map(normalizeAction).filter((a) => a.bulk);

  return (
    <div
      className={cn(
        variant === "mobile"
          ? "fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3 flex items-center gap-2 overflow-x-auto"
          : "flex items-center gap-2 px-3 py-2 border-b bg-accent/40",
      )}
    >
      <span className="text-sm font-medium whitespace-nowrap">
        {t("core.datatable.selected", { count: rows.length })}
      </span>
      {bulkActions.map((action) => {
        const { eligible, skipped } = partitionBulk(action, rows);
        const Icon = action.icon;
        const label =
          skipped.length === 0
            ? t("core.datatable.bulk_count", {
                label: action.label,
                count: eligible.length,
              })
            : t("core.datatable.bulk_count_partial", {
                label: action.label,
                count: eligible.length,
                total: rows.length,
              });

        const button = (
          <Button
            type="button"
            size="md"
            variant={action.variant === "destructive" ? "destructive" : "outline"}
            disabled={eligible.length === 0 || pendingKey !== null}
            onClick={() => onRun(action, eligible)}
          >
            {Icon && <Icon />}
            {label}
          </Button>
        );

        if (skipped.length === 0) {
          return <span key={action.key}>{button}</span>;
        }

        return (
          <Tooltip key={action.key}>
            <TooltipTrigger asChild>
              <span>{button}</span>
            </TooltipTrigger>
            <TooltipContent>
              {t("core.datatable.bulk_skipped", { count: skipped.length })}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <Button
        type="button"
        size="md"
        variant="ghost"
        className="ml-auto"
        onClick={onClear}
      >
        <XIcon />
        {t("core.datatable.clear_selection")}
      </Button>
    </div>
  );
}
