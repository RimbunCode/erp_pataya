"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/Components/ui/sidebar";
import { checkPermission, checkUrlPath } from "@/lib/utils";

import { ChevronRight } from "lucide-react";
import Link from "../Link";
import { useEffect, useRef } from "react";
import { useIsMobile } from "@/Hooks/use-mobile";
import { usePage } from "@inertiajs/react";
import { useScreen } from "@/Hooks/useScreen";

export function NavMain({ items: _items }) {
  const isMobile = useIsMobile();
  const isLargeDesktop = useScreen("108rem");
  const { permissions, ignorePermissionModels = [] } = usePage().props;
  const { open, setOpen } = useSidebar();

  // Track initial mount to prevent overriding cookie state on navigation
  const isMounted = useRef(false);
  useEffect(() => {
    if (isMounted.current) {
      setOpen(isLargeDesktop);
    } else {
      isMounted.current = true;
    }
  }, [isLargeDesktop]);

  const items = _items.map((item) => {
    if (item.items && Array.isArray(item.items)) {
      if (item.items && Array.isArray(item.items)) {
        const subItems = item.items.map((subItem) => ({
          ...subItem,
          isActive: checkUrlPath(subItem.urlPattern),
          allowed: subItem.model
            ? checkPermission(
                permissions,
                subItem.model,
                "select",
                0,
                ignorePermissionModels,
              )?.allowed
            : true,
        }));
        const isActive = subItems.some((subItem) => subItem.isActive);
        const isAllowed = subItems.some((subItem) => subItem.allowed);
        if (!isAllowed) return null;
        return (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={isActive}
            className="group/collapsible"
          >
            <Popover asChild>
              <SidebarMenuItem>
                {open || isMobile ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive ?? false}
                        className="group"
                      >
                        {item.icon}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {subItems?.map(
                          (subItem) =>
                            subItem.allowed && (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={subItem.isActive ?? false}
                                >
                                  <Link href={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ),
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : (
                  <>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive ?? false}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 " />
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      className="w-56 p-2 rounded-lg "
                    >
                      <div className="px-2 pt-1 pb-2 mb-1 space-y-2 border-b border-muted-foreground/30">
                        <h4 className="font-medium leading-none">
                          {item.title}
                        </h4>
                      </div>
                      {subItems?.map(
                        (subItem) =>
                          subItem.allowed && (
                            <SidebarMenuButton
                              asChild
                              key={subItem.title}
                              isActive={subItem.isActive ?? false}
                              className="mt-1"
                            >
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          ),
                      )}
                    </PopoverContent>
                  </>
                )}
              </SidebarMenuItem>
            </Popover>
          </Collapsible>
        );
      }
    }

    const isActive = checkUrlPath(item.urlPattern);
    const allowed = item.model
      ? checkPermission(
          permissions,
          item.model,
          "select",
          0,
          ignorePermissionModels,
        )?.allowed
      : true;
    if (!allowed) {
      return false;
    }
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          tooltip={item.title}
          asChild
          isActive={isActive ?? false}
        >
          <Link href={item.url}>
            {item.icon}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
  return (
    <SidebarGroup>
      {/* <SidebarGroupLabel>Platform</SidebarGroupLabel> */}
      <SidebarMenu>{items}</SidebarMenu>
    </SidebarGroup>
  );
}
