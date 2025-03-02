/* eslint-disable jsdoc/require-jsdoc */
import * as React from "react";

import {
  AudioWaveform,
  BookOpen,
  Bot,
  Boxes,
  Command,
  GalleryVerticalEnd,
  LayoutDashboard,
  PackageIcon,
  Settings2,
  Users2,
  WarehouseIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

import { NavMain } from "@/Components/Sidebar/NavMain";
import { TeamSwitcher } from "@/Components/Sidebar/TeamSwitcher";

// This is sample data.
const data = {
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
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
          title: "Warehouse",
          url: "/warehouses",
          urlPattern: "/warehouses/*",
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
          title: "Category",
          url: "/settings/category",
          urlPattern: "/settings/category/*",
        },
        {
          title: "Units",
          url: "/settings/units",
          urlPattern: "/settings/units/*",
        },
        {
          title: "Database Backup",
          url: "/settings/backup",
          urlPattern: "/settings/backup/*",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
