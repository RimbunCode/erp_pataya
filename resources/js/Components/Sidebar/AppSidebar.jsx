import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/Components/ui/sidebar";

import BranchSwitcher from "@/Components/Sidebar/BranchSwitcher";
import { NavMain } from "@/Components/Sidebar/NavMain";
import { resolveIcon } from "@/lib/deskIcons";
import { usePage } from "@inertiajs/react";

function resolveMenuItems(items) {
  return (items ?? []).map((item) => ({
    ...item,
    icon: resolveIcon(item.icon),
    items: item.items ? resolveMenuItems(item.items) : undefined,
  }));
}

export default React.memo(function AppSidebar({ ...props }) {
  const { menuItems } = usePage().props;
  const resolvedItems = React.useMemo(
    () => resolveMenuItems(menuItems),
    [menuItems],
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <BranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={resolvedItems} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
});
