import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRef } from "react";

// AppLayout adalah komponen komposisi murni: menyusun MasterLayout +
// SidebarProvider/SidebarInset + AppSidebar + Navbar + GlobalCommandPalette
// + wrapper konten (ref forward, className merge, ...props spread). Semua
// anak di-stub agar test fokus ke logic AppLayout SENDIRI (conditional
// render AppSidebar via hideSidebar, prop pass-through ke Navbar,
// registerOpenSearchTrigger/handleOpenSearch, ref forwarding, className
// merge, children & ...props) -- bukan re-test implementasi internal
// masing-masing anak (MasterLayout: theme/alert-dialog side effects,
// Navbar: breadcrumb/switcher, AppSidebar: menu tree, GlobalCommandPalette:
// command palette dialog). Pola sama seperti DashboardCanvas.rtl.test.jsx
// menstub DashboardBlock.
const masterLayoutProps = {};
vi.mock("./MasterLayout", () => ({
  default: (props) => {
    masterLayoutProps.children = props.children;
    return <div data-testid="stub-master-layout">{props.children}</div>;
  },
}));

const appSidebarProps = {};
vi.mock("@/Components/Sidebar/AppSidebar", () => ({
  default: (props) => {
    Object.assign(appSidebarProps, props);
    return <div data-testid="stub-app-sidebar" className={props.className} />;
  },
}));

const navbarProps = {};
vi.mock("@/Components/Navbar/Navbar", () => ({
  default: (props) => {
    Object.assign(navbarProps, props);
    return <div data-testid="stub-navbar" />;
  },
}));

const globalCommandPaletteProps = {};
vi.mock("./GlobalCommandPalette", () => ({
  default: (props) => {
    Object.assign(globalCommandPaletteProps, props);
    return <div data-testid="stub-global-command-palette" />;
  },
}));

vi.mock("@/Components/ui/sidebar", () => ({
  SidebarProvider: ({ children }) => (
    <div data-testid="stub-sidebar-provider">{children}</div>
  ),
  SidebarInset: ({ children }) => (
    <div data-testid="stub-sidebar-inset">{children}</div>
  ),
}));

import AppLayout from "./AppLayout";

function clearCaptured() {
  for (const key of Object.keys(masterLayoutProps)) {
    delete masterLayoutProps[key];
  }
  for (const key of Object.keys(appSidebarProps)) {
    delete appSidebarProps[key];
  }
  for (const key of Object.keys(navbarProps)) {
    delete navbarProps[key];
  }
  for (const key of Object.keys(globalCommandPaletteProps)) {
    delete globalCommandPaletteProps[key];
  }
}

beforeEach(() => {
  clearCaptured();
});

describe("AppLayout — render dasar & struktur", () => {
  it("merender MasterLayout > SidebarProvider > SidebarInset membungkus Navbar, GlobalCommandPalette, dan konten", () => {
    render(
      <AppLayout>
        <p>konten anak</p>
      </AppLayout>,
    );

    const master = screen.getByTestId("stub-master-layout");
    const provider = screen.getByTestId("stub-sidebar-provider");
    const inset = screen.getByTestId("stub-sidebar-inset");
    expect(master).toContainElement(provider);
    expect(provider).toContainElement(inset);
    expect(inset).toContainElement(screen.getByTestId("stub-navbar"));
    expect(inset).toContainElement(
      screen.getByTestId("stub-global-command-palette"),
    );
    expect(screen.getByText("konten anak")).toBeInTheDocument();
  });

  it("merender children di dalam wrapper konten", () => {
    render(
      <AppLayout>
        <span data-testid="child">isi</span>
      </AppLayout>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("hideSidebar default false -> AppSidebar dirender", () => {
    render(<AppLayout>x</AppLayout>);

    expect(screen.getByTestId("stub-app-sidebar")).toBeInTheDocument();
  });

  it("hideSidebar=true -> AppSidebar TIDAK dirender", () => {
    render(<AppLayout hideSidebar>x</AppLayout>);

    expect(screen.queryByTestId("stub-app-sidebar")).not.toBeInTheDocument();
  });

  it("AppSidebar diberi className 'print:hidden' (agar tersembunyi saat print)", () => {
    render(<AppLayout>x</AppLayout>);

    expect(appSidebarProps.className).toContain("print:hidden");
  });
});

describe("AppLayout — prop pass-through ke Navbar", () => {
  it("meneruskan actions apa adanya (identity) ke Navbar", () => {
    const actions = <button>Aksi</button>;
    render(<AppLayout actions={actions}>x</AppLayout>);

    expect(navbarProps.actions).toBe(actions);
  });

  it("default hideSidebar/hideBranchSwitcher/hideDeskSwitcher/hideHomeBreadcrumb semuanya false ke Navbar", () => {
    render(<AppLayout>x</AppLayout>);

    expect(navbarProps.hideSidebar).toBe(false);
    expect(navbarProps.hideBranchSwitcher).toBe(false);
    expect(navbarProps.hideDeskSwitcher).toBe(false);
    expect(navbarProps.hideHomeBreadcrumb).toBe(false);
  });

  it("meneruskan hideSidebar=true, hideBranchSwitcher=true, hideDeskSwitcher=true, hideHomeBreadcrumb=true ke Navbar", () => {
    render(
      <AppLayout
        hideSidebar
        hideBranchSwitcher
        hideDeskSwitcher
        hideHomeBreadcrumb
      >
        x
      </AppLayout>,
    );

    expect(navbarProps.hideSidebar).toBe(true);
    expect(navbarProps.hideBranchSwitcher).toBe(true);
    expect(navbarProps.hideDeskSwitcher).toBe(true);
    expect(navbarProps.hideHomeBreadcrumb).toBe(true);
  });

  it("Navbar menerima onOpenSearch berupa function", () => {
    render(<AppLayout>x</AppLayout>);

    expect(navbarProps.onOpenSearch).toBeInstanceOf(Function);
  });
});

describe("AppLayout — registerOpenSearchTrigger & handleOpenSearch (searchTriggerRef)", () => {
  it("GlobalCommandPalette menerima onRegisterOpenTrigger berupa function", () => {
    render(<AppLayout>x</AppLayout>);

    expect(globalCommandPaletteProps.onRegisterOpenTrigger).toBeInstanceOf(
      Function,
    );
  });

  it("trigger yg didaftarkan via onRegisterOpenTrigger dipanggil saat Navbar memanggil onOpenSearch", () => {
    render(<AppLayout>x</AppLayout>);
    const trigger = vi.fn();

    act(() => {
      globalCommandPaletteProps.onRegisterOpenTrigger(trigger);
    });
    act(() => {
      navbarProps.onOpenSearch();
    });

    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("mendaftarkan trigger baru menggantikan trigger lama -- hanya trigger terbaru yg terpanggil", () => {
    render(<AppLayout>x</AppLayout>);
    const triggerLama = vi.fn();
    const triggerBaru = vi.fn();

    act(() => {
      globalCommandPaletteProps.onRegisterOpenTrigger(triggerLama);
      globalCommandPaletteProps.onRegisterOpenTrigger(triggerBaru);
    });
    act(() => {
      navbarProps.onOpenSearch();
    });

    expect(triggerLama).not.toHaveBeenCalled();
    expect(triggerBaru).toHaveBeenCalledTimes(1);
  });

  it("mendaftarkan value bukan-function (mis. null) membuat ref jadi null -- handleOpenSearch tidak crash (optional chaining)", () => {
    render(<AppLayout>x</AppLayout>);
    const trigger = vi.fn();

    act(() => {
      globalCommandPaletteProps.onRegisterOpenTrigger(trigger);
      globalCommandPaletteProps.onRegisterOpenTrigger(null);
    });

    expect(() => {
      act(() => {
        navbarProps.onOpenSearch();
      });
    }).not.toThrow();
    expect(trigger).not.toHaveBeenCalled();
  });

  it("handleOpenSearch dipanggil sebelum ada trigger terdaftar tidak crash", () => {
    render(<AppLayout>x</AppLayout>);

    expect(() => {
      act(() => {
        navbarProps.onOpenSearch();
      });
    }).not.toThrow();
  });
});

describe("AppLayout — wrapper konten: ref forwarding, className merge, ...props spread", () => {
  it("meneruskan ref ke elemen DOM wrapper konten", () => {
    const ref = createRef();
    render(<AppLayout ref={ref}>x</AppLayout>);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toContainElement(screen.getByText("x"));
  });

  it("className custom digabung dgn className default (cn merge), bukan menimpa", () => {
    const ref = createRef();
    render(
      <AppLayout ref={ref} className="custom-class">
        x
      </AppLayout>,
    );

    expect(ref.current.className).toContain("custom-class");
    expect(ref.current.className).toContain("overflow-y-auto");
  });

  it("...props (mis. data-testid, id) di-spread ke elemen wrapper konten", () => {
    render(
      <AppLayout id="konten-utama" data-testid="wrapper-konten">
        x
      </AppLayout>,
    );

    const wrapper = screen.getByTestId("wrapper-konten");
    expect(wrapper).toHaveAttribute("id", "konten-utama");
  });
});
