import React, { forwardRef, memo } from "react";
import { SidebarInset, SidebarProvider } from "@/Components/ui/sidebar";

import AppSidebar from "@/Components/Sidebar/AppSidebar";
import GlobalCommandPalette from "./GlobalCommandPalette";
import MasterLayout from "./MasterLayout";
import Navbar from "@/Components/Navbar/Navbar";
import { cn } from "@/lib/utils";

export default memo(
  forwardRef(function AppLayout(
    { className, actions, children, hideSidebar = false, ...props },
    ref,
  ) {
    const searchTriggerRef = React.useRef(null);

    const registerOpenSearchTrigger = React.useCallback((trigger) => {
      searchTriggerRef.current = typeof trigger === "function" ? trigger : null;
    }, []);

    const handleOpenSearch = React.useCallback(() => {
      searchTriggerRef.current?.();
    }, []);

    return (
      <MasterLayout>
        <div className="relative mx-auto max-w-full print:invisible print:bg-white!">
          <SidebarProvider>
            {!hideSidebar && <AppSidebar className="print:hidden " />}
            <SidebarInset>
              <Navbar
                actions={actions}
                onOpenSearch={handleOpenSearch}
                hideSidebar={hideSidebar}
              />
              <GlobalCommandPalette
                onRegisterOpenTrigger={registerOpenSearchTrigger}
              />
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
