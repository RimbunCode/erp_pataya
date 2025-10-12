import * as React from "react";

import { Building2Icon, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, router, usePage } from "@inertiajs/react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { useLaravelReactI18n } from "laravel-react-i18n";

export default React.memo(function BranchSwitcher() {
  const route = window.route;
  const { branches, currentBranch } = usePage().props.branchSettings;
  const { t } = useLaravelReactI18n();
  const { isMobile } = useSidebar();
  const [activeBranch, setActiveBranch] = React.useState(currentBranch);

  React.useEffect(() => {
    setActiveBranch(currentBranch);
  }, [branches, currentBranch]);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key;
      if ((event.metaKey || event.ctrlKey) && key <= branches.length) {
        event.preventDefault();
        const branch = branches[key - 1];
        router.put(
          route("branch.switch", branch.id),
          {},
          {
            preserveScroll: false,
            preserveState: false,
            replace: true,
          },
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground "
            >
              <div className="flex items-center justify-center rounded-lg aspect-square size-8 -ml-2 bg-sidebar-foreground dark:text-muted! text-sidebar-primary-foreground">
                <Building2Icon className="size-5" />
              </div>
              <div className="grid flex-1 text-sm leading-tight text-left">
                <span className="font-semibold truncate">
                  {activeBranch?.name}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("core.branch.branches")}
            </DropdownMenuLabel>
            {branches.map((branch, index) => (
              <DropdownMenuItem
                key={branch.name}
                className="w-full gap-2 p-2"
                asChild
              >
                <Link
                  method="put"
                  as="button"
                  href={route("branch.switch", branch.id)}
                >
                  {/* <div className="flex items-center justify-center border rounded-sm size-6">
                  <team.logo className="size-4 shrink-0" />
                </div> */}
                  {branch.name}
                  {index < 9 && (
                    <DropdownMenuShortcut>
                      <kbd>Ctrl+{index + 1}</kbd>
                    </DropdownMenuShortcut>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="w-full gap-2 p-2" asChild>
              <Link href={route("branches.index")} as="button">
                <div className="flex items-center justify-center border rounded-md size-6 bg-background">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  {t("core.branch.add_branch")}
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
});
