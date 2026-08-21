import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Head, router } from "@inertiajs/react";

import AppLayout from "@/Layouts/AppLayout";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EllipsisVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon } from "@/lib/deskIcons";

export default function DeskList({ desks }) {
  const route = window.route;

  function openDesk(desk) {
    router.post(
      route("desk.switch"),
      { desk_id: desk.id, redirect_to_dashboard: true },
      { preserveScroll: true },
    );
  }

  function setDefault(desk) {
    router.post(route("desk.setDefault", desk.id), {}, { preserveScroll: true });
  }

  return (
    <AppLayout hideSidebar>
      <Head title="Desks" />

      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {desks.map((desk) => (
          <div
            key={desk.id}
            role="button"
            tabIndex={0}
            onClick={() => openDesk(desk)}
            className="group relative flex cursor-pointer flex-col items-center gap-3 rounded-lg p-4 text-center transition-colors hover:bg-muted"
          >
            <div className="absolute top-1 right-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                    )}
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Opsi desk"
                  >
                    <EllipsisVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(event) => event.stopPropagation()}
                >
                  <DropdownMenuItem
                    disabled={desk.isDefault}
                    onSelect={() => setDefault(desk)}
                  >
                    Jadikan Default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <span
              className="flex size-16 items-center justify-center rounded-2xl [&>svg]:size-7"
              style={{ backgroundColor: desk.color ?? undefined }}
            >
              {resolveIcon(desk.icon)}
            </span>

            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium">{desk.name}</span>
              {desk.isDefault && (
                <Badge variant="secondary" className="text-[10px]">
                  Default
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
