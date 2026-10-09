import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// AppSidebar hanya wiring statis (navList) + compose BranchSwitcher & NavMain --
// keduanya sudah punya test perilaku sendiri. Di sini cukup pastikan AppSidebar
// merender keduanya tanpa crash (navList tervalidasi implisit lewat NavMain).
vi.mock("@/Components/Sidebar/BranchSwitcher", () => ({
  default: () => <div data-testid="stub-branch-switcher" />,
}));
vi.mock("@/Components/Sidebar/NavMain", () => ({
  NavMain: ({ items }) => (
    <div data-testid="stub-nav-main">{items.length} items</div>
  ),
}));
// AppSidebar.jsx menarik menuItems dari usePage().props -- tanpa mock ini
// crash "usePage must be used within the Inertia component" (tidak ada
// InertiaApp context di test). `menuItems` deferred prop: undefined = belum
// dimuat, [] = sudah dimuat tapi kosong.
const pageProps = vi.hoisted(() => ({ current: {} }));
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: pageProps.current }),
}));

import AppSidebar from "./AppSidebar";
import { SidebarProvider } from "@/Components/ui/sidebar";

function renderSidebar() {
  render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>,
  );
}

describe("AppSidebar", () => {
  it("merender BranchSwitcher dan NavMain dengan navList non-kosong", () => {
    pageProps.current = {
      menuItems: [{ title: "Dashboard", url: "/dashboard", icon: null }],
    };
    renderSidebar();
    expect(screen.getByTestId("stub-branch-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("stub-nav-main")).toBeInTheDocument();
    expect(screen.getByTestId("stub-nav-main").textContent).not.toBe("0 items");
    expect(screen.queryByTestId("menu-skeleton")).not.toBeInTheDocument();
  });

  it("menampilkan skeleton (bukan sidebar kosong) selama menuItems deferred belum dimuat", () => {
    pageProps.current = {};
    renderSidebar();
    expect(screen.getByTestId("stub-branch-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("menu-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("stub-nav-main")).not.toBeInTheDocument();
  });

  it("menu kosong yang sudah dimuat merender NavMain, bukan skeleton", () => {
    pageProps.current = { menuItems: [] };
    renderSidebar();
    expect(screen.getByTestId("stub-nav-main").textContent).toBe("0 items");
    expect(screen.queryByTestId("menu-skeleton")).not.toBeInTheDocument();
  });
});
