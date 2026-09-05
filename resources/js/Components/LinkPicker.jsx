import { ExternalLinkIcon } from "lucide-react";
import Select from "@/Components/Select";
import { Input } from "@/Components/ui/input";
import { cn } from "@/lib/utils";
import { usePage } from "@inertiajs/react";
import { useMemo } from "react";

// Requirement 2.9-2.11: dua sumber link — menu_item (dari MenuItem existing,
// tervalidasi sejak seeding) atau url (bebas, validasi skema HANYA sebagai
// bantuan UX di sini — backend adalah penegak utama, DashboardWidgetRequest).
const URL_PATTERN = "^(https?://|/).*";

export default function LinkPicker({ value, onValueChange, disabled }) {
  const { allMenuItems = [] } = usePage().props;
  const linkType = value?.link_type ?? "menu_item";
  const linkTo = value?.link_to ?? "";

  const menuItemOptions = useMemo(
    () => allMenuItems.map((item) => ({ value: item.id, label: item.label })),
    [allMenuItems],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onValueChange({ link_type: "menu_item", link_to: "" })}
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            linkType === "menu_item"
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground",
          )}
        >
          Menu
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onValueChange({ link_type: "url", link_to: "" })}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
            linkType === "url"
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground",
          )}
        >
          <ExternalLinkIcon className="size-3" />
          URL
        </button>
      </div>

      {linkType === "menu_item" ? (
        <Select
          value={linkTo}
          onValueChange={(val) =>
            onValueChange({ link_type: "menu_item", link_to: val })
          }
          options={menuItemOptions}
          disabled={disabled}
          placeholder="Pilih menu..."
        />
      ) : (
        <Input
          value={linkTo}
          onChange={(e) =>
            onValueChange({ link_type: "url", link_to: e.target.value })
          }
          pattern={URL_PATTERN}
          placeholder="https://... atau /path"
          disabled={disabled}
        />
      )}
    </div>
  );
}
