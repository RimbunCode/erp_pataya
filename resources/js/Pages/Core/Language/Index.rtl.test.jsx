import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// GuestLayout membungkus MasterLayout (tema, AlertDialogs, context-menu guard)
// dan butuh usePage() dari @inertiajs/react (perlu InertiaApp context sungguhan
// yang di luar cakupan test ini) -- GuestLayout sendiri sudah py test terpisah
// (Layouts/GuestLayout.rtl.test.jsx). Stub jadi passthrough supaya test ini
// fokus ke konten unik Index.jsx (judul/deskripsi loading & daftar Tabs
// locale), bukan re-test struktur GuestLayout.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children, className }) => (
    <div data-testid="stub-guest-layout" className={className}>
      {children}
    </div>
  ),
}));

// Head asli @inertiajs/react butuh InertiaApp context (head manager) yang
// tidak tersedia di test standalone -- pola sama dgn Pages/Core/Print.rtl.test.jsx.
vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <title>{title}</title>,
}));

const tMock = vi.fn((key) => `TR:${key}`);
let i18nState = { t: tMock, loading: false };
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => i18nState,
}));

window.route = vi.fn((name) => name);

import Index from "./Index";

const locales = [
  { code: "en", name: "English", countryCode: "us" },
  { code: "id", name: "Indonesia", countryCode: "id" },
];

beforeEach(() => {
  tMock.mockClear();
  window.route.mockClear();
  i18nState = { t: tMock, loading: false };
});

describe("<Language> Index — judul & deskripsi", () => {
  it("merender judul & deskripsi terjemahan saat i18n tidak loading", () => {
    render(<Index lang="en" locales={locales} />);

    expect(screen.getByText("TR:lang.title")).toBeInTheDocument();
    expect(screen.getByText("TR:lang.description")).toBeInTheDocument();
    expect(tMock).toHaveBeenCalledWith("lang.title");
    expect(tMock).toHaveBeenCalledWith("lang.description");
  });

  it("merender Skeleton (bukan teks terjemahan) saat i18n masih loading", () => {
    i18nState = { t: tMock, loading: true };
    const { container } = render(<Index lang="en" locales={locales} />);

    expect(screen.queryByText("TR:lang.title")).not.toBeInTheDocument();
    expect(screen.queryByText("TR:lang.description")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
  });

  it("mengatur document title lewat Head", () => {
    render(<Index lang="en" locales={locales} />);

    expect(document.title).toBe("Select Language");
  });
});

describe("<Language> Index — daftar locale (Tabs)", () => {
  it("merender satu tab per locale dgn nama & bendera sesuai countryCode", () => {
    render(<Index lang="en" locales={locales} />);

    const enTab = screen.getByRole("tab", { name: "English" });
    const idTab = screen.getByRole("tab", { name: "Indonesia" });
    expect(enTab).toBeInTheDocument();
    expect(idTab).toBeInTheDocument();

    expect(enTab.querySelector(".fi-us")).toBeInTheDocument();
    expect(idTab.querySelector(".fi-id")).toBeInTheDocument();
  });

  it("tab utk `lang` aktif ditandai data-state=active", () => {
    render(<Index lang="id" locales={locales} />);

    const idTab = screen.getByRole("tab", { name: "Indonesia" });
    const enTab = screen.getByRole("tab", { name: "English" });
    expect(idTab).toHaveAttribute("data-state", "active");
    expect(enTab).toHaveAttribute("data-state", "inactive");
  });

  it("tiap tab adalah Link POST ke route('lang.set') dgn data={code} (method != get -> render <button>)", () => {
    render(<Index lang="en" locales={locales} />);

    expect(window.route).toHaveBeenCalledWith("lang.set");

    const enTab = screen.getByRole("tab", { name: "English" });
    expect(enTab.tagName).toBe("BUTTON");
    expect(enTab).toHaveAttribute("type", "button");
  });

  it("locales kosong/undefined tidak membuat crash, tidak merender tab apapun", () => {
    render(<Index lang="en" locales={undefined} />);

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("klik tab locale memicu Inertia visit POST via router (intercepted, bukan navigasi asli)", async () => {
    const user = userEvent.setup();
    const visitSpy = vi
      .spyOn((await import("@inertiajs/core")).router, "visit")
      .mockImplementation(() => {});
    render(<Index lang="en" locales={locales} />);

    await user.click(screen.getByRole("tab", { name: "Indonesia" }));

    expect(visitSpy).toHaveBeenCalledWith(
      "lang.set",
      expect.objectContaining({ method: "post" }),
    );
    visitSpy.mockRestore();
  });
});
