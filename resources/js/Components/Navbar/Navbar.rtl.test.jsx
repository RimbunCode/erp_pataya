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

// Navbar.jsx memanggil route("desks.index") untuk link Home breadcrumb.
window.route = (name) => name;

import Navbar from "./Navbar";

const basePage = (overrides = {}) => ({
  props: {
    breadcrumbs: null,
    unread_changelogs_count: 0,
    ...overrides,
  },
});

describe("Navbar", () => {
  it("tanpa breadcrumbs, tidak merender breadcrumb trail halaman (Home icon breadcrumb tetap ada)", () => {
    usePageMock.mockReturnValue(basePage());
    render(<Navbar />);
    // Breadcrumb "Home" (ikon, aria-label "Home") dirender TERPISAH dari
    // breadcrumbsMenu (trail per-halaman berdasar props.breadcrumbs) --
    // jadi selalu ada TEPAT 1 <ol>, bukan nol, walau breadcrumbs kosong.
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getByLabelText("Home")).toBeInTheDocument();
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

  // "Changelog badge" (unread_changelogs_count, aria-label "Changelog") SUDAH
  // TIDAK ADA di Navbar.jsx -- badge unread count sekarang konsolidasi ke
  // Notifications.jsx (prop unread_notifications_count, bukan
  // unread_changelogs_count), dan Notifications di sini di-stub jadi <div/>.
  // Perilaku badge (0 -> hidden, >99 -> "99+") sudah tercakup di
  // Notifications.rtl.test.jsx ("unread count 0 tidak menampilkan badge",
  // "badge >99 ditampilkan sebagai '99+'") terhadap komponen asli, jadi 2
  // test lama di sini (menguji fitur yang sudah tidak ada) dihapus, bukan
  // di-skip -- coverage-nya tidak hilang, cuma pindah ke file yang benar.
});
