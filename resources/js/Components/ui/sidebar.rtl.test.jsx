import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useIsMobileMock = vi.fn(() => false);
vi.mock("@/Hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

const useScreenMock = vi.fn(() => false);
vi.mock("@/Hooks/useScreen", () => ({
  useScreen: () => useScreenMock(),
}));

import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  SIDEBAR_COOKIE_NAME,
} from "./sidebar";

const clearCookies = () => {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  });
};

describe("useSidebar", () => {
  it("throw error bila dipanggil di luar SidebarProvider", () => {
    expect(() => renderHook(() => useSidebar())).toThrow(
      "useSidebar must be used within a SidebarProvider.",
    );
  });
});

describe("SidebarProvider + SidebarTrigger", () => {
  beforeEach(() => {
    clearCookies();
    useIsMobileMock.mockReturnValue(false);
  });

  it("open=true (defaultOpen) menghasilkan state='expanded'", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: ({ children }) => <SidebarProvider>{children}</SidebarProvider>,
    });
    expect(result.current.state).toBe("expanded");
    expect(result.current.open).toBe(true);
  });

  it("defaultOpen=false menghasilkan state='collapsed'", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: ({ children }) => (
        <SidebarProvider defaultOpen={false}>{children}</SidebarProvider>
      ),
    });
    expect(result.current.state).toBe("collapsed");
  });

  it("klik SidebarTrigger men-toggle open dan menulis cookie sidebar_state", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <SidebarProvider defaultOpen={true}>
        <SidebarTrigger />
      </SidebarProvider>,
    );

    await user.click(screen.getByRole("button"));

    expect(document.cookie).toContain(`${SIDEBAR_COOKIE_NAME}=false`);
  });

  it("open controlled via prop 'open' + onOpenChange dipanggil saat toggle", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    render(
      <SidebarProvider open={true} onOpenChange={onOpenChange}>
        <SidebarTrigger />
      </SidebarProvider>,
    );

    await user.click(screen.getByRole("button"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cookie sidebar_state='false' yang sudah ada dibaca sebagai initial open=false", () => {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=false; path=/`;

    const { result } = renderHook(() => useSidebar(), {
      wrapper: ({ children }) => <SidebarProvider>{children}</SidebarProvider>,
    });

    expect(result.current.open).toBe(false);
  });

  it("mode mobile: toggleSidebar mengubah openMobile, bukan open (open tetap desktop default)", () => {
    useIsMobileMock.mockReturnValue(true);
    const { result } = renderHook(() => useSidebar(), {
      wrapper: ({ children }) => <SidebarProvider>{children}</SidebarProvider>,
    });

    expect(result.current.openMobile).toBe(false);
    act(() => result.current.toggleSidebar());
    expect(result.current.openMobile).toBe(true);
    expect(result.current.open).toBe(true);
  });

  it("Ctrl+B men-toggle sidebar via keyboard shortcut", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: ({ children }) => <SidebarProvider>{children}</SidebarProvider>,
    });

    expect(result.current.open).toBe(true);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true }),
      );
    });
    expect(result.current.open).toBe(false);
  });
});
