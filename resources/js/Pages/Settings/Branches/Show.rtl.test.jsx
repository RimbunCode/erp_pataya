import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Settings/Branches) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate dari !branch, disabled dari
// branch.is_main_branch, badge tampil label is_main_branch kalau true.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, disabled, badge, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, disabled: !!disabled })}
      </div>
      <div data-testid="form-page-badge">{badge}</div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

describe("Show (Settings/Branches)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show branch={{ id: 1, is_main_branch: false }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate false, disabled true, badge muncul saat is_main_branch true", () => {
    render(<Show branch={{ id: 1, is_main_branch: true }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: false, disabled: true }),
    );
    expect(
      screen.getByText("core.branch.columns.is_main_branch"),
    ).toBeInTheDocument();
  });

  it("disabled false, badge kosong saat is_main_branch false", () => {
    render(<Show branch={{ id: 1, is_main_branch: false }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"disabled":false',
    );
    expect(
      screen.queryByText("core.branch.columns.is_main_branch"),
    ).not.toBeInTheDocument();
  });

  // BUG PRODUKSI (belum diperbaiki, sudah dilaporkan terpisah --
  // task_eb95f7c2): `disabled={branch.is_main_branch}` dan
  // `{branch.is_main_branch && (...)}` akses branch TANPA optional chaining.
  // BranchController@create me-render Show TANPA prop branch (undefined di
  // halaman "buat cabang baru"), sehingga render pertama throw TypeError.
  // Test ini mendokumentasikan crash tsb secara eksplisit -- JANGAN
  // dihapus, ganti jadi assert sukses begitu bug diperbaiki (branch?.is_main_branch).
  it("BUG: branch undefined (create mode) crash saat render karena branch.is_main_branch tanpa optional chaining", () => {
    expect(() => render(<Show branch={undefined} />)).toThrow(
      "Cannot read properties of undefined (reading 'is_main_branch')",
    );
  });
});
