import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// NavMain.jsx menandai isActive lewat Ziggy `route().current(routeName)` --
// route() TANPA argumen mengembalikan instance Ziggy itu sendiri (bukan
// undefined), yang baru punya method `.current()`. Bukan pathname/urlPattern
// (field itu ada di data tapi tidak pernah dibaca komponen).
// `currentRouteName` di-reset tiap test lewat beforeEach.
let currentRouteName = null;
const routeMock = Object.assign(
  (name, params) => {
    if (name === undefined) return routeMock; // route() no-arg -> instance Ziggy (self)
    return params !== undefined ? `${name}/${JSON.stringify(params)}` : name;
  },
  { current: (name) => name === currentRouteName },
);
window.route = routeMock;

const useIsMobileMock = vi.fn(() => false);
vi.mock("@/Hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

const useScreenMock = vi.fn(() => false);
vi.mock("@/Hooks/useScreen", () => ({
  useScreen: () => useScreenMock(),
}));

import { NavMain } from "./NavMain";
import { SidebarProvider } from "@/Components/ui/sidebar";

// SidebarMenuButton/CollapsibleTrigger dkk memanggil useSidebar() sebagai
// referensi INTRA-MODUL di sidebar.jsx -- vi.mock tidak bisa mem-patch
// pemanggilan lokal semacam itu (hanya binding yang di-export). Maka
// SidebarProvider ASLI dipakai, dengan prop `open` controlled per test-case.
const renderNav = (items, { open = true } = {}) =>
  render(
    <SidebarProvider open={open}>
      <NavMain items={items} />
    </SidebarProvider>,
  );

const flatItem = (overrides = {}) => ({
  title: "Dashboard",
  url: "/dashboard",
  routeName: "dashboard",
  icon: null,
  ...overrides,
});

const groupItem = (overrides = {}) => ({
  title: "Sales",
  icon: null,
  items: [
    { title: "Orders", url: "/sales/orders", routeName: "sales.orders" },
    {
      title: "Invoices",
      url: "/sales/invoices",
      routeName: "sales.invoices",
    },
  ],
  ...overrides,
});

describe("NavMain", () => {
  beforeEach(() => {
    usePageMock.mockReturnValue({
      props: { permissions: {}, ignorePermissionModels: [] },
    });
    currentRouteName = null;
  });

  it("merender item flat dengan title dan link ke url-nya", () => {
    renderNav([flatItem()]);
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("item flat dengan model yang tidak diizinkan tidak dirender", () => {
    renderNav([flatItem({ model: "App\\Models\\Core\\Secret" })]);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("item dengan model di ignorePermissionModels tetap dirender", () => {
    usePageMock.mockReturnValue({
      props: {
        permissions: {},
        ignorePermissionModels: ["App\\Models\\Core\\Secret"],
      },
    });
    renderNav([flatItem({ model: "App\\Models\\Core\\Secret" })]);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("sidebar terbuka: item dengan sub-items dirender sebagai collapsible trigger (default closed)", () => {
    renderNav([groupItem()]);
    const trigger = screen.getByText("Sales").closest("button");
    expect(trigger).toHaveAttribute("data-state", "closed");
  });

  it("klik trigger group membuka collapsible dan menampilkan sub-item link", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav([groupItem()]);

    await user.click(screen.getByText("Sales"));

    expect(await screen.findByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Orders").closest("a")).toHaveAttribute(
      "href",
      "/sales/orders",
    );
  });

  it("sub-item yang routeName-nya cocok route aktif membuat collapsible default terbuka", () => {
    currentRouteName = "sales.orders";
    renderNav([groupItem()]);
    const trigger = screen.getByText("Sales").closest("button");
    expect(trigger).toHaveAttribute("data-state", "open");
  });

  it("group tanpa sub-item yang allowed tidak dirender sama sekali", () => {
    renderNav([
      groupItem({
        items: [
          {
            title: "Restricted",
            url: "/x",
            urlPattern: "/x",
            model: "App\\Models\\Core\\Secret",
          },
        ],
      }),
    ]);
    expect(screen.queryByText("Sales")).not.toBeInTheDocument();
  });

  it("sidebar tertutup (desktop): klik trigger group membuka popover berisi sub-item", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav([groupItem()], { open: false });

    await user.click(screen.getByText("Sales"));

    expect(await screen.findByText("Orders")).toBeInTheDocument();
  });

  it("routeName yang cocok route aktif menandai isActive pada item flat", () => {
    currentRouteName = "dashboard";
    renderNav([flatItem()]);
    // SidebarMenuButton asChild meneruskan data-active ke child (<a>, via Slot).
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).toHaveAttribute("data-active", "true");
  });

  it("routeName yang TIDAK cocok route aktif tidak menandai isActive", () => {
    currentRouteName = "other.route";
    renderNav([flatItem()]);
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).toHaveAttribute("data-active", "false");
  });
});
