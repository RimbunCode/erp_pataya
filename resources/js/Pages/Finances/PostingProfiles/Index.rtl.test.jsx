import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const stableT = (key, vars) =>
  vars && typeof vars === "object" ? `${key}|${JSON.stringify(vars)}` : key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <title>{title}</title>,
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${params}` : name;

import Index from "./Index";

const profiles = [
  {
    id: "p2",
    name: "Versi 2",
    status: "draft",
    version: 2,
    effective_from: "2026-07-01",
    effective_to: null,
    accounts_count: 5,
  },
  {
    id: "p1",
    name: "Versi 1",
    status: "active",
    version: 1,
    effective_from: "2026-01-01",
    effective_to: "2026-06-30",
    accounts_count: 8,
  },
];

describe("PostingProfiles Index", () => {
  it("daftar profil dengan status, rentang berlaku, dan tautan ke detail", () => {
    render(<Index profiles={profiles} canWrite canRead />);

    const rows = screen.getAllByTestId("posting-profile");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Versi 2");
    expect(rows[0]).toHaveTextContent(
      "finances.postingProfile.columns.status.options.draft",
    );
    expect(rows[0]).toHaveTextContent("finances.postingProfile.open_ended");
    expect(rows[1]).toHaveTextContent("2026-06-30");
    expect(screen.getByRole("link", { name: "Versi 1" })).toHaveAttribute(
      "href",
      "postingProfiles.show/p1",
    );
  });

  it("tombol profil baru hanya untuk pemegang izin write", () => {
    const { rerender } = render(<Index profiles={profiles} canWrite canRead />);
    expect(
      screen.getByRole("link", { name: "finances.postingProfile.list.add" }),
    ).toHaveAttribute("href", "postingProfiles.form");

    rerender(<Index profiles={profiles} canWrite={false} />);
    expect(
      screen.queryByRole("link", { name: "finances.postingProfile.list.add" }),
    ).toBeNull();
  });

  it("menampilkan keadaan kosong", () => {
    render(<Index profiles={[]} />);

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("tanpa izin read nama profil tampil sebagai teks biasa, bukan tautan", () => {
    render(<Index profiles={profiles} canRead={false} />);

    expect(screen.queryByRole("link", { name: "Versi 1" })).toBeNull();
    expect(screen.getByText("Versi 1")).toBeInTheDocument();
  });
});
