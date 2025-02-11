"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
} from "@/components/ui/sidebar";

import { ChevronRight } from "lucide-react";
import { Link } from "@inertiajs/react";
import { checkUrlPath } from "@/lib/utils";

export function NavMain({ items }) {
  const { open } = useSidebar();
  return (
    <SidebarGroup>
      {/* <SidebarGroupLabel>Platform</SidebarGroupLabel> */}
      <SidebarMenu>
        {items.map((item) => {
          if (item.items && Array.isArray(item.items)) {
            const subItems = item.items.map((subItem) => ({
              ...subItem,
              isActive: checkUrlPath(subItem.urlPattern),
            }));
            const isActive = subItems.some((subItem) => subItem.isActive);

            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={isActive}
                className="group/collapsible"
              >
                <Popover asChild>
                  <SidebarMenuItem>
                    {open ? (
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
                            {subItems?.map((subItem) => (
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
                            ))}
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
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/popPopover:rotate-90" />
                          </SidebarMenuButton>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          align="start"
                          className="w-56 p-2 rounded-lg "
                        >
                          <div className="px-2 pt-1 pb-2 mb-2 space-y-2 border-b border-muted-foreground/30">
                            <h4 className="font-medium leading-none">
                              {item.title}
                            </h4>
                          </div>
                          {subItems?.map((subItem) => (
                            <SidebarMenuButton
                              asChild
                              key={subItem.title}
                              isActive={subItem.isActive ?? false}
                            >
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          ))}
                        </PopoverContent>
                      </>
                    )}
                  </SidebarMenuItem>
                </Popover>
              </Collapsible>
            );
          }
          const isActive = checkUrlPath(item.urlPattern);
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
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
