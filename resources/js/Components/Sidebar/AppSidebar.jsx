import * as React from "react";

import {
  BookOpenIcon,
  Boxes,
  HandCoins,
  HistoryIcon,
  LayoutDashboard,
  ListTodo,
  PackageIcon,
  Receipt,
  Settings2,
  ShoppingBagIcon,
  StampIcon,
  TicketsIcon,
  Users2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/Components/ui/sidebar";

import BranchSwitcher from "@/Components/Sidebar/BranchSwitcher";
import { NavMain } from "@/Components/Sidebar/NavMain";

// This is sample data.
const navList = [
  {
    title: "Dashboard",
    url: "/dashboard-view",
    urlPattern: "/dashboard-view*",
    icon: <LayoutDashboard />,
  },
  {
    title: "Inventories",
    icon: <PackageIcon />,
    items: [
      {
        title: "Items",
        url: "/items",
        urlPattern: "/items/*",
        model: "App\\Models\\Inventory\\Item",
      },
      {
        title: "Item Alternatives",
        url: "/itemAlternatives",
        urlPattern: "/itemAlternatives/*",
        model: "App\\Models\\Inventory\\ItemAlternative",
      },
      {
        title: "Warehouses",
        url: "/warehouses",
        urlPattern: "/warehouses/*",
        model: "App\\Models\\Inventory\\Warehouse",
      },
      {
        title: "Attributes",
        url: "/attributes",
        urlPattern: "/attributes/*",
        model: "App\\Models\\Inventory\\Attribute",
      },
      {
        title: "Categories",
        url: "/categories",
        urlPattern: "/categories/*",
        model: "App\\Models\\Inventory\\Category",
      },
      {
        title: "Units",
        url: "/units",
        urlPattern: "/units/*",
        model: "App\\Models\\Inventory\\Unit",
      },

      {
        title: "Stock Entries",
        url: "/stockEntries",
        urlPattern: "/stockEntries/*",
        model: "App\\Models\\Inventory\\StockEntry",
      },
      {
        title: "Purchase Receipts",
        url: "/purchaseReceipts",
        urlPattern: "/purchaseReceipts/*",
        model: "App\\Models\\Purchase\\PurchaseReceipt",
      },
      {
        title: "Delivery Notes",
        url: "/deliveryNotes",
        urlPattern: "/deliveryNotes/*",
        model: "App\\Models\\Inventory\\DeliveryNote",
      },
      {
        title: "Stock Ledgers",
        url: "/stockLedgers",
        urlPattern: "/stockLedgers/*",
        model: "App\\Models\\Inventory\\StockLedgerEntry",
      },
    ],
  },
  {
    title: "Assets",
    icon: <Boxes />,
    items: [
      {
        title: "Assets",
        url: "/assets",
        urlPattern: "/assets/*",
        model: "App\\Models\\Asset\\Asset",
      },
      {
        title: "Asset Categories",
        url: "/assetCategories",
        urlPattern: "/assetCategories/*",
        model: "App\\Models\\Asset\\AssetCategory",
      },
      {
        title: "Asset Locations",
        url: "/assetLocations",
        urlPattern: "/assetLocations/*",
        model: "App\\Models\\Asset\\AssetLocation",
      },
      {
        title: "Asset Value Adjustments",
        url: "/assetValueAdjustments",
        urlPattern: "/assetValueAdjustments/*",
        model: "App\\Models\\Asset\\AssetValueAdjustment",
      },
      {
        title: "Asset Movements",
        url: "/assetMovements",
        urlPattern: "/assetMovements/*",
        model: "App\\Models\\Asset\\AssetMovement",
      },
      {
        title: "Maintenance Teams",
        url: "/assetMaintenanceTeams",
        urlPattern: "/assetMaintenanceTeams/*",
        model: "App\\Models\\Asset\\Maintenance\\AssetMaintenanceTeam",
      },
      {
        title: "Asset Maintenance",
        url: "/assetMaintenances",
        urlPattern: "/assetMaintenances/*",
        model: "App\\Models\\Asset\\Maintenance\\AssetMaintenance",
      },
      {
        title: "Asset Services",
        url: "/assetServices",
        urlPattern: "/assetServices/*",
        model: "App\\Models\\Asset\\AssetService",
      },
    ],
  },
  {
    title: "Services",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <path
          fill="currentColor"
          d="M21.5 2.5v1.406a5.6 5.6 0 0 0-2.28.938l-1.032-.97l-1.375 1.47l1 .937a5.7 5.7 0 0 0-.907 2.22H15.5v2h1.406c.146.83.474 1.586.938 2.25l-1.063 1.03l1.44 1.44l1.03-1.064c.664.464 1.42.792 2.25.938V16.5h2v-1.406a5.7 5.7 0 0 0 2.22-.906l.936 1l1.47-1.376l-.97-1.03c.47-.67.79-1.445.938-2.282H29.5v-2h-1.406a5.6 5.6 0 0 0-.938-2.25l.938-.938l-1.407-1.406l-.937.938a5.6 5.6 0 0 0-2.25-.938V2.5zm1 3.313A3.664 3.664 0 0 1 26.188 9.5c0 2.055-1.633 3.688-3.688 3.688s-3.688-1.633-3.688-3.688s1.633-3.688 3.688-3.688zM9.53 11.718l-1.842.75l.718 1.81a6.94 6.94 0 0 0-2.344 2.314l-1.78-.72l-.75 1.845l1.78.718a6.8 6.8 0 0 0-.218 1.656c0 .57.085 1.126.218 1.656l-1.78.72l.75 1.843l1.78-.72a6.9 6.9 0 0 0 2.344 2.345l-.72 1.78l1.845.75l.72-1.78a6.8 6.8 0 0 0 1.656.218c.57 0 1.128-.085 1.656-.218l.72 1.78l1.843-.75l-.72-1.78a6.9 6.9 0 0 0 2.314-2.344l1.81.718l.75-1.843l-1.81-.72c.13-.53.218-1.087.218-1.656c0-.57-.087-1.128-.22-1.657l1.813-.718l-.75-1.845l-1.81.72a6.9 6.9 0 0 0-2.314-2.314l.72-1.81l-1.845-.75l-.717 1.81a7 7 0 0 0-1.657-.217c-.57 0-1.126.086-1.656.218l-.72-1.81zm2.376 3.592c2.663 0 4.78 2.12 4.78 4.782c.002 2.663-2.117 4.812-4.78 4.812a4.806 4.806 0 0 1-4.812-4.812c0-2.663 2.15-4.782 4.812-4.782"
        ></path>
      </svg>
    ),
    items: [
      {
        title: "Work Orders",
        url: "/workOrders",
        urlPattern: "/workOrders/*",
        model: "App\\Models\\Service\\WorkOrder",
      },
    ],
  },
  {
    title: "Purchases",
    icon: <ShoppingBagIcon />,
    items: [
      {
        title: "Suppliers",
        url: "/suppliers",
        urlPattern: "/suppliers/*",
        model: "App\\Models\\Purchase\\Supplier",
      },
      {
        title: "Purchase Requests",
        url: "/purchaseRequests",
        urlPattern: "/purchaseRequests/*",
        model: "App\\Models\\Purchase\\PurchaseRequest",
      },
      {
        title: "Purchase Orders",
        url: "/purchaseOrders",
        urlPattern: "/purchaseOrders/*",
        model: "App\\Models\\Purchase\\PurchaseOrder",
      },
    ],
  },
  // {
  //   title: "CRM",
  //   icon: <Handshake />,
  //   items: [
  //     {
  //       title: "Leads",
  //       url: "/leads",
  //       urlPattern: "/leads/*",
  //       model: "App\\Models\\CRM\\Lead",
  //     },
  //     {
  //       title: "Opportunities",
  //       url: "/opportunities",
  //       urlPattern: "/opportunities/*",
  //       model: "App\\Models\\CRM\\Opportunity",
  //     },
  //     {
  //       title: "Quotations",
  //       url: "/quotations",
  //       urlPattern: "/quotations/*",
  //       model: "App\\Models\\CRM\\Quotation",
  //     },
  //   ],
  // },
  {
    title: "Customers",
    url: "/customers",
    urlPattern: "/customers/*",
    model: "App\\Models\\Sales\\Customer",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M13.88 6.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0-4.5 0m-2.14 6.41a.23.23 0 0 0 0 .23a.23.23 0 0 0 .26.11h8.39a.19.19 0 0 0 .16-.08a.2.2 0 0 0 0-.17a4.63 4.63 0 0 0-8.81-.09"
        />
        <path
          fill="currentColor"
          d="M22.38 16.5a1 1 0 0 0 0-2H10.12a.5.5 0 0 1-.5-.5v-1.5a4.5 4.5 0 1 0-9 0V16a.5.5 0 0 0 .5.5h1a.49.49 0 0 1 .5.46L3.09 23a.49.49 0 0 0 .5.46h3.07a.5.5 0 0 0 .5-.46l.43-6a.49.49 0 0 1 .5-.46ZM2.13 3.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0"
        />
      </svg>
    ),
  },
  {
    title: "Sales",
    icon: <Receipt />,
    items: [
      {
        title: "Sales Orders",
        url: "/salesOrders",
        urlPattern: "/salesOrders/*",
        model: "App\\Models\\Sales\\SalesOrder",
      },
      {
        title: "Internal Orders",
        url: "/internalOrders",
        urlPattern: "/internalOrders/*",
        model: "App\\Models\\Sales\\InternalOrder",
      },
    ],
  },
  {
    title: "Finances",
    icon: <HandCoins />,
    items: [
      {
        title: "Accounts",
        url: "/accounts",
        urlPattern: "/accounts/*",
        model: "App\\Models\\Finances\\Account",
      },
      {
        title: "Payment Methods",
        url: "/paymentMethods",
        urlPattern: "/paymentMethods/*",
        model: "App\\Models\\Finances\\PaymentMethod",
      },
      {
        title: "Payment Term Templates",
        url: "/paymentTermTemplates",
        urlPattern: "/paymentTermTemplates/*",
        model: "App\\Models\\Finances\\PaymentTermTemplate",
      },
      {
        title: "Payment Entries",
        url: "/paymentEntries",
        urlPattern: "/paymentEntries/*",
        model: "App\\Models\\Finances\\PaymentEntry",
      },
      {
        title: "Purchase Invoices",
        url: "/purchaseInvoices",
        urlPattern: "/purchaseInvoices/*",
        model: "App\\Models\\Finances\\PurchaseInvoice",
      },
      {
        title: "Sales Invoices",
        url: "/salesInvoices",
        urlPattern: "/salesInvoices/*",
        model: "App\\Models\\Finances\\SalesInvoice",
      },
      {
        title: "Taxes",
        url: "/taxes",
        urlPattern: "/taxes/*",
        model: "App\\Models\\Finances\\Tax",
      },
      {
        title: "General Ledgers",
        url: "/generalLedgers",
        urlPattern: "/generalLedgers/*",
        model: "App\\Models\\Finances\\GeneralLedger",
      },
    ],
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
    title: "Tickets",
    icon: <TicketsIcon />,
    url: "/tickets",
    urlPattern: "/tickets/*",
  },
  {
    title: "ToDo",
    icon: <ListTodo />,
    url: "/todos",
    urlPattern: "/todos/*",
  },
  // Manual Book disembunyikan sementara dari sidebar (belum siap rilis)
  // {
  //   title: "Manual Book",
  //   icon: <BookOpenIcon />,
  //   url: "/manual-book",
  //   urlPattern: "/manual-book*",
  // },
  {
    title: "Logs",
    icon: <HistoryIcon />,
    url: "/logs",
    urlPattern: "/logs*",
    model: "App\\Models\\Core\\Log",
  },
  {
    title: "Settings",
    icon: <Settings2 />,
    items: [
      {
        title: "Company",
        url: "/settings/company",
        urlPattern: "/settings/company/*",
        model: "App\\Models\\Core\\Preference",
      },
      {
        title: "Branches",
        url: "/settings/branches",
        urlPattern: "/settings/branches/*",
        model: "App\\Models\\Core\\Branch",
      },
      {
        title: "Countries",
        url: "/settings/countries",
        urlPattern: "/settings/countries/*",
        model: "App\\Models\\Core\\Country",
      },
      {
        title: "Currencies",
        url: "/settings/currencies",
        urlPattern: "/settings/currencies/*",
        model: "App\\Models\\Core\\Currency",
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
        title: "Email Templates",
        url: "/settings/emailTemplates",
        urlPattern: "/settings/emailTemplates/*",
        model: "App\\Models\\Core\\EmailTemplate",
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
      // {
      //   title: "Database Backup",
      //   url: "/settings/backup",
      //   urlPattern: "/settings/backup/*",
      //   model: "App\\Models\\Core\\Backup",
      // },
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
