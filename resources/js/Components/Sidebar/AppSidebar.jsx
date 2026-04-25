import * as React from "react";

import { LayoutDashboard, Settings2, StampIcon, Users2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/Components/ui/sidebar";

import BranchSwitcher from "@/Components/Sidebar/BranchSwitcher";
import { NavMain } from "@/Components/Sidebar/NavMain";

const navList = [
  {
    title: "Dashboard",
    url: "/dashboard-view",
    urlPattern: "/dashboard-view*",
    icon: <LayoutDashboard />,
  },
  {
    title: "Approvals",
    icon: <StampIcon />,
    url: "/approvals",
    urlPattern: "/approvals/*",
  },
  {
    title: "Users",
    icon: <Users2 />,
    items: [
      {
        title: "Manage Users",
        url: "/users",
        urlPattern: "/users/*",
        model: "App\\Models\\User\\User",
      },
      {
        title: "Roles",
        url: "/roles",
        urlPattern: "/roles/*",
        model: "App\\Models\\User\\Role",
      },
    ],
  },
  {
    title: "Settings",
    icon: <Settings2 />,
    items: [
      {
        title: "Company",
        url: "/settings/company",
        urlPattern: "/settings/company/*",
        model: "App\\Models\\Core\\Prefence",
      },
      {
        title: "Branches",
        url: "/settings/branches",
        urlPattern: "/settings/branches/*",
        model: "App\\Models\\Core\\Branch",
      },
      {
        title: "Manage Dashboards",
        url: "/settings/dashboards",
        urlPattern: "/settings/dashboards/*",
        model: "App\\Models\\Core\\Dashboard",
      },
      {
        title: "Formating Series",
        url: "/settings/formatingSeries",
        urlPattern: "/settings/formatingSeries/*",
        model: "App\\Models\\Core\\FormatingSeries",
      },
      {
        title: "Approval Schemes",
        url: "/settings/approvalSchemes",
        urlPattern: "/settings/approvalSchemes/*",
        model: "App\\Models\\Core\\ApprovalScheme",
      },
      {
        title: "Print Templates",
        url: "/settings/printTemplates",
        urlPattern: "/settings/printTemplates/*",
        model: "App\\Models\\Core\\PrintTemplate",
      },
      {
        title: "Widgets",
        url: "/settings/widgets",
        urlPattern: "/settings/widgets/*",
        model: "App\\Models\\Core\\Widget",
      },
      {
        title: "Files",
        url: "/settings/files",
        urlPattern: "/settings/files/*",
        model: "App\\Models\\Core\\File",
      },
    ],
  },
];

export default React.memo(function AppSidebar({ ...props }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <BranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navList} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
});
