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

import AppSidebar from "./AppSidebar";
import { SidebarProvider } from "@/Components/ui/sidebar";

describe("AppSidebar", () => {
  it("merender BranchSwitcher dan NavMain dengan navList non-kosong", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("stub-branch-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("stub-nav-main")).toBeInTheDocument();
    expect(screen.getByTestId("stub-nav-main").textContent).not.toBe(
      "0 items",
    );
  });
});
