import { Fragment, memo } from "react";
import { Ellipsis } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { Button } from "@/Components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { resolveRowActions } from "./rowActions";

/**
 * Menu aksi per baris (tombol titik tiga).
 * Item mengikuti urutan `actions`; pemisah hanya muncul sebelum item destruktif
 * pertama dan hanya bila ada item lain sebelumnya. Render null bila tidak ada
 * aksi yang berlaku untuk baris ini.
 *
 * @param {{
 *   row: object,
 *   actions: object[],
 *   onRun: (action: object, rows: object[]) => void,
 * }} props
 */
function RowActionsMenu({ row, actions, onRun }) {
  const { t } = useLaravelReactI18n();
  const visible = resolveRowActions(actions, row);

  if (visible.length === 0) {
    return null;
  }

  const firstDestructive = visible.findIndex(
    (action) => action.variant === "destructive",
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("core.datatable.row_actions")}
          onClick={(e) => e.stopPropagation()}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visible.map((action, index) => {
          const Icon = action.icon;

          return (
            <Fragment key={action.key}>
              {index === firstDestructive && index > 0 && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                className={cn(
                  action.variant === "destructive" &&
                    "text-destructive focus:text-destructive",
                )}
                onSelect={() => onRun(action, [row])}
              >
                {Icon && <Icon />}
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(RowActionsMenu);
