import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// Form Journal Voucher: indikator seimbang waktu nyata dan tambah/hapus baris. FormTable dirender sungguhan (pola
// FormTable.fixedRows.rtl.test.jsx); FormPage, link model akun, dan input angka disederhanakan karena sudah punya test
// sendiri dan bukan concern file ini. State form dipegang harness sehingga edit pada tabel mengalir ke indikator.

const stableT = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

let formPageState;
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
  FormChildren: ({ children }) => <div>{children}</div>,
  useFormPage: () => formPageState,
  useFormPageMeta: () => null,
}));
vi.mock("@/Hooks/useCanUpdate", () => ({ default: () => true }));
vi.mock("@/Hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/Components/ui/tooltip", () => ({
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children }) => <>{children}</>,
  TooltipContent: () => null,
}));

let accountCounter = 0;
vi.mock("@/Pages/Finances/Accounts/AccountLinkModel", () => ({
  default: ({ onValueChange, filters }) => (
    <button
      type="button"
      data-testid="account-link-model"
      data-filters={JSON.stringify(filters)}
      onClick={() => {
        accountCounter += 1;
        onValueChange({ id: `acc-${accountCounter}` });
      }}
    >
      pilih akun
    </button>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div data-testid="datetime-picker" />,
}));

vi.mock("@/Components/NumberInput", () => ({
  default: ({ name, value, onValueChange, readOnly }) => (
    <input
      aria-label={name}
      readOnly={readOnly}
      value={value ?? ""}
      onChange={(e) =>
        onValueChange(e.target.value === "" ? null : Number(e.target.value))
      }
    />
  ),
}));

import Form from "./Form";

function Harness({ initial = {} }) {
  const [data, setState] = useState({ date: new Date(), ...initial });
  const setData = (key, value) => {
    if (typeof key === "string") {
      setState((prev) => ({ ...prev, [key]: value }));
    } else {
      setState((prev) => ({ ...prev, ...key }));
    }
  };
  formPageState = { data, setData, disabled: false };

  return <Form />;
}

const balance = () => screen.getByTestId("voucher-balance");
const rowCount = (container) =>
  container.querySelectorAll("svg.lucide-trash-2").length;

describe("Finances JournalVouchers Form", () => {
  beforeEach(() => {
    accountCounter = 0;
    usePageMock.mockReturnValue({
      props: {
        minorUnit: 2,
        preferences: { default_number_format: "#,###.##" },
      },
    });
  });

  it("tanpa baris menampilkan indikator minimal 2 baris", () => {
    render(<Harness />);

    expect(balance()).toHaveAttribute("data-state", "too_few");
    expect(
      screen.getByText("finances.journalVoucher.balance.too_few"),
    ).toBeInTheDocument();
  });

  it("akun pada tabel hanya menawarkan akun yang dapat diposting (bukan grup)", () => {
    render(<Harness />);

    expect(screen.getAllByTestId("account-link-model")[0]).toHaveAttribute(
      "data-filters",
      JSON.stringify({ is_group: false }),
    );
  });

  it("indikator berubah seimbang dan tidak seimbang secara waktu nyata", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          items: [
            { id: "r1", account: { id: "a1" }, debit: 100, credit: null },
            { id: "r2", account: { id: "a2" }, debit: null, credit: 60 },
          ],
        }}
      />,
    );

    expect(balance()).toHaveAttribute("data-state", "unbalanced");
    expect(screen.getByTestId("voucher-total-debit")).toHaveTextContent("100");
    expect(screen.getByTestId("voucher-total-credit")).toHaveTextContent("60");
    expect(balance()).toHaveTextContent(
      "finances.journalVoucher.balance.unbalanced",
    );
    expect(balance()).toHaveTextContent("40");

    const credit = screen.getAllByLabelText("credit")[1];
    await user.clear(credit);
    await user.type(credit, "100");

    await waitFor(() =>
      expect(balance()).toHaveAttribute("data-state", "balanced"),
    );
    expect(
      screen.getByText("finances.journalVoucher.balance.balanced"),
    ).toBeInTheDocument();
  });

  it("keseimbangan dihitung dalam minor unit mata uang dasar", () => {
    render(
      <Harness
        initial={{
          items: [
            { id: "r1", account: { id: "a1" }, debit: 100.004, credit: null },
            { id: "r2", account: { id: "a2" }, debit: null, credit: 100 },
          ],
        }}
      />,
    );

    expect(balance()).toHaveAttribute("data-state", "balanced");
  });

  it("indikator memakai ikon dan teks, bukan warna saja, dengan kontras hijau yang disyaratkan", () => {
    render(
      <Harness
        initial={{
          items: [
            { id: "r1", account: { id: "a1" }, debit: 50, credit: null },
            { id: "r2", account: { id: "a2" }, debit: null, credit: 50 },
          ],
        }}
      />,
    );

    expect(balance()).toHaveClass("text-green-700", "dark:text-green-400");
    expect(balance().querySelector("svg")).not.toBeNull();
    expect(balance()).toHaveTextContent(
      "finances.journalVoucher.balance.balanced",
    );
  });

  it("menambah baris saat baris kosong terakhir diisi", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const before = rowCount(container);
    await user.click(screen.getAllByTestId("account-link-model")[0]);

    await waitFor(() => expect(rowCount(container)).toBe(before + 1));
  });

  it("menghapus baris memperbarui total dan indikator", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Harness
        initial={{
          items: [
            { id: "r1", account: { id: "a1" }, debit: 100, credit: null },
            { id: "r2", account: { id: "a2" }, debit: null, credit: 100 },
          ],
        }}
      />,
    );
    expect(balance()).toHaveAttribute("data-state", "balanced");

    const trash = container.querySelectorAll("svg.lucide-trash-2");
    await user.click(trash[1].closest("button"));

    await waitFor(() =>
      expect(balance()).toHaveAttribute("data-state", "too_few"),
    );
    expect(screen.getByTestId("voucher-total-credit")).toHaveTextContent("0");
  });

  it("mengisi debit mengosongkan kredit pada baris yang sama", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          items: [
            { id: "r1", account: { id: "a1" }, debit: null, credit: 80 },
            { id: "r2", account: { id: "a2" }, debit: null, credit: 80 },
          ],
        }}
      />,
    );

    await user.type(screen.getAllByLabelText("debit")[0], "5");

    await waitFor(() =>
      expect(screen.getByTestId("voucher-total-debit")).toHaveTextContent("5"),
    );
    expect(screen.getByTestId("voucher-total-credit")).toHaveTextContent("80");
  });
});
