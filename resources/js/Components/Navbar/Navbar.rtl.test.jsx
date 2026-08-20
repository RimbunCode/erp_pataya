import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key, loading: false }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const useIsMobileMock = vi.fn(() => false);
vi.mock("@/Hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

// Semua komponen anak non-breadcrumb di-stub -- masing-masing sudah/akan
// punya test sendiri (LanguageSwitcher, ToggleTheme, UserInfo, Notifications).
// Navbar hanya diuji untuk wiring-nya: breadcrumb collapse logic & changelog badge.
vi.mock("@/Components/LanguageSwitcher", () => ({ default: () => <div /> }));
vi.mock("@/Components/ToggleTheme", () => ({ default: () => <div /> }));
vi.mock("./Notifications", () => ({ default: () => <div /> }));
vi.mock("./UserInfo", () => ({ default: () => <div /> }));
vi.mock("@/Components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">trigger</button>,
}));

import Navbar from "./Navbar";

const basePage = (overrides = {}) => ({
  props: {
    breadcrumbs: null,
    unread_changelogs_count: 0,
    ...overrides,
  },
});

describe("Navbar", () => {
  it("tanpa breadcrumbs, tidak merender breadcrumb list", () => {
    usePageMock.mockReturnValue(basePage());
    render(<Navbar />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("breadcrumbs <=3 item (desktop) merender semua sebagai link kecuali item terakhir", () => {
    usePageMock.mockReturnValue(
      basePage({
        breadcrumbs: [
          { name: "Home", link: "/" },
          { name: "Sales", link: "/sales" },
          { name: "Detail", link: "/sales/1" },
        ],
      }),
    );
    render(<Navbar />);

    expect(screen.getByText("Home").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Sales").closest("a")).toHaveAttribute(
      "href",
      "/sales",
    );
    // Item terakhir adalah BreadcrumbPage (bukan link).
    expect(screen.getByText("Detail").closest("a")).toBeNull();
  });

  it("breadcrumbs >3 item collapse jadi dropdown ellipsis + item terakhir", () => {
    usePageMock.mockReturnValue(
      basePage({
        breadcrumbs: [
          { name: "A", link: "/a" },
          { name: "B", link: "/b" },
          { name: "C", link: "/c" },
          { name: "D", link: "/d" },
        ],
      }),
    );
    render(<Navbar />);

    // A, B, C disembunyikan di dalam dropdown (belum ter-render sampai diklik);
    // hanya item terakhir (D) yang langsung tampak sebagai BreadcrumbPage.
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.getByText("Toggle menu")).toBeInTheDocument();
  });

  it("mobile: breadcrumbs 2 item pun collapse jadi dropdown", () => {
    useIsMobileMock.mockReturnValue(true);
    usePageMock.mockReturnValue(
      basePage({
        breadcrumbs: [
          { name: "A", link: "/a" },
          { name: "B", link: "/b" },
        ],
      }),
    );
    render(<Navbar />);

    expect(screen.getByText("Toggle menu")).toBeInTheDocument();
    useIsMobileMock.mockReturnValue(false);
  });

  it("nama breadcrumb dengan sintaks __(...) diekstrak sebelum ditranslate", () => {
    usePageMock.mockReturnValue(
      basePage({
        breadcrumbs: [{ name: "__( Sales Order )", link: "/so" }],
      }),
    );
    render(<Navbar />);
    expect(screen.getByText("Sales Order")).toBeInTheDocument();
  });

  it("changelog badge tersembunyi saat count 0", () => {
    usePageMock.mockReturnValue(basePage({ unread_changelogs_count: 0 }));
    render(<Navbar />);
    expect(screen.getByLabelText("Changelog")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("changelog badge menampilkan count, >99 sebagai '99+'", () => {
    usePageMock.mockReturnValue(basePage({ unread_changelogs_count: 150 }));
    render(<Navbar />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
