import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Fragment, memo, useMemo } from "react";

import { resolveIcon } from "@/lib/deskIcons";
import { router } from "@inertiajs/react";
import { usePage } from "@inertiajs/react";

// Feedback user: desk System dulu baru Custom (dgn divider di antaranya),
// tiap grup diurutkan alfabetis by nama.
function sortDesks(deskList) {
  return [...(deskList ?? [])].sort((a, b) => {
    if (a.type !== b.type) return a.type === "system" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export default memo(function DeskSwitcher() {
  const route = window.route;
  const { activeDesk, deskList } = usePage().props;
  const sortedDeskList = useMemo(() => sortDesks(deskList), [deskList]);

  function switchDesk(deskId) {
    const urlBeforeSwitch = window.location.pathname;

    router.post(
      route("desk.switch"),
      { desk_id: deskId },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => {
          // Kalau server me-redirect (halaman asal tidak relevan dengan Desk
          // baru — Requirement 6 AC 4 pengecualian), Inertia sudah otomatis
          // memuat halaman tujuan lengkap. Partial reload manual hanya perlu
          // dilakukan bila kita tetap di halaman yang sama (back() biasa).
          if (window.location.pathname === urlBeforeSwitch) {
            router.reload({ only: ["activeDesk", "deskList", "menuItems"] });
          }
        },
      },
    );
  }

  if (!activeDesk) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground transition-colors [&>svg]:size-4"
        >
          {resolveIcon(activeDesk.icon)}
          <span className="truncate max-w-32">{activeDesk.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Desks
        </DropdownMenuLabel>
        {sortedDeskList.map((desk, index) => (
          <Fragment key={desk.id}>
            {index > 0 &&
              sortedDeskList[index - 1].type === "system" &&
              desk.type === "custom" && <DropdownMenuSeparator />}
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onSelect={() => switchDesk(desk.id)}
            >
              {resolveIcon(desk.icon)}
              {desk.name}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
