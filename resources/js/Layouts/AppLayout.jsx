import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/Components/ui/command";
import React, { forwardRef, memo } from "react";
import { SidebarInset, SidebarProvider } from "@/Components/ui/sidebar";
import { usePage } from "@inertiajs/react";

import AppSidebar from "@/Components/Sidebar/AppSidebar";
import MasterLayout from "./MasterLayout";
import Navbar from "@/Components/Navbar/Navbar";
import { cn } from "@/lib/utils";
import useTheme from "@/Hooks/useTheme";

export default memo(
  forwardRef(function AppLayout(
    { className, actions, children, ...props },
    ref,
  ) {
    const { component } = usePage();
    const isDashboardPage = component === "Dashboard";
    const [showSearch, setShowSearch] = React.useState(false);
    const { _setTheme } = useTheme();
    React.useEffect(() => {
      if (!isDashboardPage) {
        return;
      }
      const down = (e) => {
        if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
          if (
            (e.target instanceof HTMLElement && e.target.isContentEditable) ||
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement
          ) {
            return;
          }

          e.preventDefault();
          setShowSearch((open) => !open);
        }
      };

      document.addEventListener("keydown", down);
      return () => document.removeEventListener("keydown", down);
    }, [isDashboardPage]);

    return (
      <MasterLayout>
        <div className="relative mx-auto max-w-[1920px] print:invisible print:bg-white!">
          <SidebarProvider>
            <AppSidebar className="print:hidden " />
            <SidebarInset>
              <Navbar
                actions={actions}
                setShowSearch={setShowSearch}
                isDashboardPage={isDashboardPage}
              />
              <CommandDialog open={showSearch} onOpenChange={setShowSearch}>
                <CommandInput
                  placeholder="Type a command or search..."
                  className="outline-0! border-0! shadow-none! ring-0!"
                />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandSeparator />
                  <CommandGroup heading="Theme">
                    <CommandItem
                      value="theme-light"
                      // onSelect={() => runCommand(() => setTheme("light"))}
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        className="size-6"
                      >
                        <path
                          fillRule="evenodd"
                          d="M13 3a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0V3ZM6.343 4.929A1 1 0 0 0 4.93 6.343l1.414 1.414a1 1 0 0 0 1.414-1.414L6.343 4.929Zm12.728 1.414a1 1 0 0 0-1.414-1.414l-1.414 1.414a1 1 0 0 0 1.414 1.414l1.414-1.414ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-9 4a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H3Zm16 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2ZM7.757 17.657a1 1 0 1 0-1.414-1.414l-1.414 1.414a1 1 0 1 0 1.414 1.414l1.414-1.414Zm9.9-1.414a1 1 0 0 0-1.414 1.414l1.414 1.414a1 1 0 0 0 1.414-1.414l-1.414-1.414ZM13 19a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0v-2Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Light
                    </CommandItem>
                    <CommandItem
                      value="theme-dark"
                      // onSelect={() => runCommand(() => setTheme("dark"))}
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        className="size-6"
                      >
                        <path
                          fillRule="evenodd"
                          d="M11.675 2.015a.998.998 0 0 0-.403.011C6.09 2.4 2 6.722 2 12c0 5.523 4.477 10 10 10 4.356 0 8.058-2.784 9.43-6.667a1 1 0 0 0-1.02-1.33c-.08.006-.105.005-.127.005h-.001l-.028-.002A5.227 5.227 0 0 0 20 14a8 8 0 0 1-8-8c0-.952.121-1.752.404-2.558a.996.996 0 0 0 .096-.428V3a1 1 0 0 0-.825-.985Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Dark
                    </CommandItem>
                    <CommandItem
                      value="theme-system"
                      // onSelect={() => runCommand(() => setTheme("system"))}
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="size-6"
                      >
                        <path
                          fill="currentColor"
                          d="M10.85 12.65h2.3L12 9zM20 8.69V4h-4.69L12 .69L8.69 4H4v4.69L.69 12L4 15.31V20h4.69L12 23.31L15.31 20H20v-4.69L23.31 12zM14.3 16l-.7-2h-3.2l-.7 2H7.8L11 7h2l3.2 9z"
                        />
                      </svg>
                      System
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </CommandDialog>
              <div
                ref={ref}
                {...props}
                className={cn(
                  "relative flex flex-col flex-1 max-h-full px-8 py-4 overflow-y-auto ",
                  className,
                )}
              >
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </MasterLayout>
    );
  }),
);
