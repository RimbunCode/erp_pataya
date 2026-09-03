import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// AppLayout membungkus Navbar/Sidebar/GlobalCommandPalette penuh (di luar
// scope test halaman Status) -- stub jadi passthrough agar test fokus ke
// konten Status.jsx sendiri.
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-app-layout">{children}</div>
  ),
}));

// BadgeStatus TIDAK di-stub -- komponennya sederhana, sudah punya test
// sendiri di Components/BadgeStatus.rtl.test.jsx, dan merender apa adanya
// di sini memberi kepastian integrasi (prop status & className benar-benar
// diteruskan Status.jsx ke BadgeStatus).
import Status from "./Status";

describe("Pages/Status", () => {
  it("render tanpa error di dalam AppLayout saat statuses kosong", () => {
    render(<Status statuses={[]} />);

    expect(screen.getByTestId("stub-app-layout")).toBeInTheDocument();
  });

  it("merender satu BadgeStatus per entri statuses dengan label terjemahan yang benar", () => {
    const statuses = [{ value: "approved" }, { value: "rejected" }];
    render(<Status statuses={statuses} />);

    expect(screen.getByText("TR:status.approved")).toBeInTheDocument();
    expect(screen.getByText("TR:status.rejected")).toBeInTheDocument();
  });

  it("jumlah badge yang dirender sama dengan panjang array statuses", () => {
    const statuses = [
      { value: "draft" },
      { value: "open" },
      { value: "submitted" },
      { value: "canceled" },
    ];
    const { container } = render(<Status statuses={statuses} />);

    expect(container.querySelectorAll(".badge")).toHaveLength(4);
  });

  it("mempertahankan urutan array saat merender badge", () => {
    const statuses = [
      { value: "draft" },
      { value: "approved" },
      { value: "rejected" },
    ];
    const { container } = render(<Status statuses={statuses} />);

    const labels = Array.from(container.querySelectorAll(".badge")).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual([
      "TR:status.draft",
      "TR:status.approved",
      "TR:status.rejected",
    ]);
  });

  it("meneruskan className 'text-xs py-0.5 px-2' ke tiap BadgeStatus", () => {
    render(<Status statuses={[{ value: "draft" }]} />);

    const badge = screen.getByText("TR:status.draft");
    expect(badge.className).toContain("text-xs");
    expect(badge.className).toContain("py-0.5");
    expect(badge.className).toContain("px-2");
  });

  it("menerapkan theme class sesuai status yang dikenal (integrasi dgn BadgeStatus asli)", () => {
    render(<Status statuses={[{ value: "approved" }]} />);

    const badge = screen.getByText("TR:status.approved");
    expect(badge.className).toContain("success");
  });
});
