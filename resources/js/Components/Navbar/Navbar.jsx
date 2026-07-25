import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/Components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Fragment, memo, useMemo } from "react";

import { Button } from "@/Components/ui/button";
import LanguageSwitcher from "@/Components/LanguageSwitcher";
import Link from "../Link";
import Notifications from "./Notifications";
import { Separator } from "@/Components/ui/separator";
import { SidebarTrigger } from "@/Components/ui/sidebar";
import ToggleTheme from "@/Components/ToggleTheme";
import UserInfo from "./UserInfo";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

function ChangelogBadge() {
  const count = usePage().props.unread_changelogs_count || 0;

  return (
    <Link
      href="/changelogs"
      className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      aria-label="Changelog"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="size-5"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-5 14H7v-2h7zm3-4H7v-2h10zm0-4H7V7h10z"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-4 text-white text-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export default memo(function Navbar({ actions, onOpenSearch }) {
  const { t, loading } = useLaravelReactI18n();
  const breadcrumbs = usePage().props.breadcrumbs;
  const isMobile = useIsMobile();
  const breadcrumbsMenu = useMemo(() => {
    if (!breadcrumbs) return null;
    return (
      <Breadcrumb className="flex w-full ">
        <BreadcrumbList className="flex  w-full pr-6">
          {breadcrumbs.length > 1 && (isMobile || breadcrumbs.length > 3) ? (
            <>
              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1">
                    <BreadcrumbEllipsis className="w-4 h-4" />
                    <span className="sr-only">Toggle menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {breadcrumbs.map((breadcrumb, index) => {
                      if (index === breadcrumbs.length - 1) return null;
                      const name = t(
                        breadcrumb.name?.replace(/__\(\s*(.*?)\s*\)/g, "$1"),
                      );
                      return (
                        <DropdownMenuItem
                          asChild
                          key={name + index + "dropdown"}
                        >
                          <Link href={breadcrumb.link}>{name}</Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="" />
              <BreadcrumbItem className="overflow-hidden block">
                <BreadcrumbPage className="truncate block w-full">
                  {t(
                    breadcrumbs[breadcrumbs.length - 1].name?.replace(
                      /__\(\s*(.*?)\s*\)/g,
                      "$1",
                    ),
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            breadcrumbs.map((breadcrumb, index) =>
              index < breadcrumbs.length - 1 ? (
                <Fragment key={breadcrumb.name + index}>
                  <BreadcrumbItem className="hidden md:block overflow-hidden">
                    <BreadcrumbLink asChild>
                      <Link
                        href={breadcrumb.link}
                        className="truncate block w-full"
                      >
                        {t(
                          breadcrumb.name?.replace(/__\(\s*(.*?)\s*\)/g, "$1"),
                        )}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:inline-block" />
                </Fragment>
              ) : (
                <BreadcrumbItem
                  key={breadcrumb.name + index}
                  className="overflow-hidden block"
                >
                  <BreadcrumbPage className="truncate block w-full">
                    {t(breadcrumb.name?.replace(/__\(\s*(.*?)\s*\)/g, "$1"))}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              ),
            )
          )}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }, [breadcrumbs, isMobile, loading]);
  return (
    <header className="print:hidden overflow-hidden sticky top-0 bg-background z-10 max-w-full w-full border-b border-muted-foreground/50 flex h-16 justify-between shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="overflow-hidden flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4 mr-2" />
        {breadcrumbsMenu}
      </div>
      <div className="flex flex-1 items-center gap-2 px-4 justify-end">
        {actions}
        <Button
          onClick={() => onOpenSearch?.()}
          variant="outline"
          className={cn(
            "relative h-9 w-fit px-2! md:px-4!  justify-start rounded-[0.5rem] lg:bg-muted/50 text-sm font-normal text-muted-foreground shadow-none lg:w-56 xl:w-64",
          )}
        >
          <span className="hidden lg:inline-flex">Search ...</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="size-4 lg:hidden"
          >
            <path
              fill="currentColor"
              d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5l-1.5 1.5l-5-5v-.79l-.27-.27A6.52 6.52 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14S14 12 14 9.5S12 5 9.5 5"
            />
          </svg>
          <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 lg:flex">
            <span className="text-xs">Ctrl + K</span>
          </kbd>
        </Button>
        <LanguageSwitcher className="size-4" />
        <ToggleTheme className="size-4" />
        <ChangelogBadge />
        <Notifications />
        <UserInfo />
      </div>
    </header>
  );
});
