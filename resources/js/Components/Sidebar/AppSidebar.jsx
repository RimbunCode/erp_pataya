/* eslint-disable jsdoc/require-jsdoc */
import * as React from "react";

import {
  Boxes,
  LayoutDashboard,
  PackageIcon,
  Settings2,
  Users2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

import BranchSwitcher from "@/Components/Sidebar/BranchSwitcher";
import { NavMain } from "@/Components/Sidebar/NavMain";

// This is sample data.
const navList = [
  {
    title: "Dashboard",
    url: "/dashboard",
    urlPattern: "/dashboard*",
    icon: <LayoutDashboard />,
  },
  {
    title: "Inventory",
    icon: <PackageIcon />,
    items: [
      {
        title: "Items",
        url: "/items",
        urlPattern: "/items/*",
      },
      {
        title: "Warehouses",
        url: "/warehouses",
        urlPattern: "/warehouses/*",
      },
      {
        title: "Attributes",
        url: "/attributes",
        urlPattern: "/attributes/*",
      },
      {
        title: "Categories",
        url: "/categories",
        urlPattern: "/categories/*",
      },
      {
        title: "Units",
        url: "/units",
        urlPattern: "/units/*",
      },
    ],
  },
  {
    title: "Purchase",
    icon: <Boxes />,
    items: [
      {
        title: "Supplier",
        url: "/suppliers",
        urlPattern: "/suppliers/*",
      },
      {
        title: "Order",
        url: "/orders",
        urlPattern: "/orders/*",
      },
    ],
  },
  {
    title: "Users",
    icon: <Users2 />,
    items: [
      {
        title: "Manage Users",
        url: "/users",
        urlPattern: "/users/*",
      },
      {
        title: "Roles",
        url: "/roles",
        urlPattern: "/roles/*",
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
      },
      {
        title: "Branches",
        url: "/settings/branches",
        urlPattern: "/settings/branches/*",
      },
      {
        title: "Database Backup",
        url: "/settings/backup",
        urlPattern: "/settings/backup/*",
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
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
});
