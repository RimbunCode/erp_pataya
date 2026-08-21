import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Finances/Accounts) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate dari !account, ignoreDraft dari
// usePage().props.loadFrom, disabled dari account?.have_transactions
// (BEDA dari pola submitted_at di dokumen transaksi -- Account dikunci
// begitu pernah dipakai transaksi, bukan begitu di-submit).

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, ignoreDraft, disabled, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({
          isCreate: !!isCreate,
          ignoreDraft: !!ignoreDraft,
          disabled: !!disabled,
        })}
      </div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

function renderShow(account, loadFrom) {
  usePageMock.mockReturnValue({ props: { loadFrom } });
  return render(<Show account={account} />);
}

describe("Show (Finances/Accounts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    renderShow({ id: 1 });

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true, disabled false saat account tidak ada (tanpa crash walau tidak dikirim)", () => {
    renderShow(undefined);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: true, ignoreDraft: false, disabled: false }),
    );
  });

  it("disabled true saat account.have_transactions true (account terkunci karena pernah dipakai)", () => {
    renderShow({ id: 1, have_transactions: true });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"disabled":true',
    );
  });

  it("disabled false saat account.have_transactions false", () => {
    renderShow({ id: 1, have_transactions: false });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"disabled":false',
    );
  });

  it("ignoreDraft diteruskan dari usePage().props.loadFrom", () => {
    renderShow({ id: 1 }, { id: 5 });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"ignoreDraft":true',
    );
  });
});
