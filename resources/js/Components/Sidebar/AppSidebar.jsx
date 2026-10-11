import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/Components/ui/sidebar";

import BranchSwitcher from "@/Components/Sidebar/BranchSwitcher";
import { NavMain } from "@/Components/Sidebar/NavMain";
import { resolveIcon, resolveMenuIcon } from "@/lib/deskIcons";
import { usePage } from "@inertiajs/react";

// Fallback inisial (feedback user) cuma relevan utk item TOP-LEVEL — NavMain
// memang tidak pernah render icon anak grup yang di-collapse (cuma label),
// jadi children tetap resolveIcon() biasa (null kalau kosong, aman, tidak
// terpakai visual).
function resolveMenuItems(items, isTopLevel = true) {
  return (items ?? []).map((item) => ({
    ...item,
    icon: isTopLevel
      ? resolveMenuIcon(item.icon, item.title)
      : resolveIcon(item.icon),
    items: item.items ? resolveMenuItems(item.items, false) : undefined,
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
