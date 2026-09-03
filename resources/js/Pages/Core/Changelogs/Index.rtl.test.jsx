import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const stableT = (key, fallback) => fallback ?? key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const headProps = vi.fn();
vi.mock("@inertiajs/react", () => ({
  Head: (props) => {
    headProps(props);
    return null;
  },
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-app-layout">{children}</div>
  ),
}));

import Index from "./Index";

describe("Core/Changelogs Index", () => {
  it("menampilkan title halaman via Head dan heading", () => {
    render(<Index changelogs={[]} />);

    expect(headProps).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Changelog" }),
    );
    expect(
      screen.getByRole("heading", { name: "Changelog" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Riwayat pembaruan versi aplikasi."),
    ).toBeInTheDocument();
  });

  it("menampilkan pesan kosong saat changelogs.length === 0", () => {
    render(<Index changelogs={[]} />);

    expect(screen.getByText("Belum ada changelog.")).toBeInTheDocument();
  });

  it("merender satu ChangelogCard dgn version, environment, tanggal, dan content_html", () => {
    const changelogs = [
      {
        id: 1,
        version: "1.2.0",
        environment: "production",
        is_read: true,
        deployed_at: "2026-03-15T00:00:00.000Z",
        content_html: "<p>Perbaikan bug login</p>",
      },
    ];
    render(<Index changelogs={changelogs} />);

    expect(screen.getByText("1.2.0")).toBeInTheDocument();
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("Perbaikan bug login")).toBeInTheDocument();
    // toLocaleDateString(undefined, { day:"numeric", month:"long", year:"numeric" })
    // pada UTC 2026-03-15 -- locale default lingkungan test ini adalah id-ID:
    // "15 Maret 2026".
    expect(screen.getByText("15 Maret 2026")).toBeInTheDocument();
    expect(screen.queryByText("Belum ada changelog.")).not.toBeInTheDocument();
  });

  it("menampilkan badge 'Baru' saat is_read false, dan menyembunyikannya saat is_read true", () => {
    const changelogs = [
      {
        id: 1,
        version: "1.0.0",
        environment: "staging",
        is_read: false,
        deployed_at: "2026-01-01T00:00:00.000Z",
        content_html: "<p>Rilis awal</p>",
      },
      {
        id: 2,
        version: "1.1.0",
        environment: "staging",
        is_read: true,
        deployed_at: "2026-02-01T00:00:00.000Z",
        content_html: "<p>Rilis kedua</p>",
      },
    ];
    render(<Index changelogs={changelogs} />);

    // Hanya 1 badge "Baru" (utk changelog #1, is_read=false); changelog #2
    // (is_read=true) tidak menampilkan badge.
    expect(screen.getAllByText("Baru")).toHaveLength(1);
  });

  it("merender banyak changelog sesuai urutan array (key per id)", () => {
    const changelogs = [
      {
        id: 10,
        version: "2.0.0",
        environment: "production",
        is_read: true,
        deployed_at: "2026-05-01T00:00:00.000Z",
        content_html: "<p>A</p>",
      },
      {
        id: 11,
        version: "2.1.0",
        environment: "production",
        is_read: true,
        deployed_at: "2026-06-01T00:00:00.000Z",
        content_html: "<p>B</p>",
      },
    ];
    render(<Index changelogs={changelogs} />);

    const versions = screen
      .getAllByText(/^2\.\d\.0$/)
      .map((el) => el.textContent);
    expect(versions).toEqual(["2.0.0", "2.1.0"]);
  });

  it("me-render content_html apa adanya via dangerouslySetInnerHTML (termasuk tag <a>)", () => {
    const changelogs = [
      {
        id: 1,
        version: "1.0.0",
        environment: "production",
        is_read: true,
        deployed_at: "2026-01-01T00:00:00.000Z",
        content_html: '<p>Lihat <a href="https://example.test">detail</a></p>',
      },
    ];
    render(<Index changelogs={changelogs} />);

    const link = screen.getByRole("link", { name: "detail" });
    expect(link).toHaveAttribute("href", "https://example.test");
  });
});
