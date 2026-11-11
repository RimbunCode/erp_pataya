import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => ({ data: formPageSeed }),
  FormPageContent: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/Components/Link", () => ({
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${params}` : name;

import Form from "./Form";

const line = (overrides = {}) => ({
  id: "l1",
  line_no: 1,
  description: null,
  debit: 0,
  credit: 0,
  deleted_at: null,
  account: {
    id: "a1",
    account_number: "1100",
    account_name: "Kas",
    deleted_at: null,
  },
  against_account: {
    id: "a2",
    account_number: "4100",
    account_name: "Penjualan",
    deleted_at: null,
  },
  ...overrides,
});

describe("Finances Journals Form", () => {
  beforeEach(() => {
    formPageSeed = {
      code: "JV-0001/26",
      status: "posted",
      transaction_date: "2026-11-04T10:30:00Z",
      fiscal_period: { name: "2026-11" },
      branch: { name: "Main Branch" },
      currency_code: "IDR",
      description: "Penjualan tunai",
    };
    usePageMock.mockReturnValue({
      props: { preferences: { default_number_format: "#,###.##" } },
    });
  });

  it("menampilkan header: kode, status terjemahan, periode, cabang, deskripsi", () => {
    render(<Form lines={[]} totals={null} minorUnit={2} />);

    expect(screen.getByTestId("journal-code")).toHaveTextContent("JV-0001/26");
    expect(screen.getByTestId("journal-status")).toHaveTextContent(
      "finances.journal.columns.status.options.posted",
    );
    expect(screen.getByText("2026-11")).toBeInTheDocument();
    expect(screen.getByText("Main Branch")).toBeInTheDocument();
    expect(screen.getByText("Penjualan tunai")).toBeInTheDocument();
  });

  it("tautan sumber memakai route dari relasi source", () => {
    formPageSeed.source = {
      id: 42,
      route: "salesInvoices",
      templateLink: ":code",
      code: "SI-0007",
    };
    render(<Form lines={[]} totals={null} minorUnit={2} />);

    const link = within(screen.getByTestId("journal-source")).getByRole("link");
    expect(link).toHaveAttribute("href", "salesInvoices.show/42");
    expect(link).toHaveTextContent("SI-0007");
  });

  it("tanpa source (jurnal manual): tidak ada tautan sumber", () => {
    formPageSeed.source = null;
    render(<Form lines={[]} totals={null} minorUnit={2} />);

    expect(
      within(screen.getByTestId("journal-source")).queryByRole("link"),
    ).toBeNull();
  });

  it("jurnal pembalik menautkan jurnal asal; jurnal asal menautkan pembaliknya", () => {
    formPageSeed.reverses = { id: "j0", code: "JV-0000/26" };
    formPageSeed.reversed_by = { id: "j2", code: "JV-0002/26" };
    render(<Form lines={[]} totals={null} minorUnit={2} />);

    expect(
      within(screen.getByTestId("journal-reverses")).getByRole("link"),
    ).toHaveAttribute("href", "journals.show/j0");
    expect(
      within(screen.getByTestId("journal-reversed-by")).getByRole("link"),
    ).toHaveAttribute("href", "journals.show/j2");
  });

  it("tanpa tautan pembalik/asal bila tidak ada", () => {
    render(<Form lines={[]} totals={null} minorUnit={2} />);

    expect(screen.queryByTestId("journal-reverses")).toBeNull();
    expect(screen.queryByTestId("journal-reversed-by")).toBeNull();
  });

  it("tanpa baris: pesan kosong", () => {
    render(<Form lines={[]} totals={null} minorUnit={2} />);

    expect(
      screen.getByText("finances.journal.empty_lines"),
    ).toBeInTheDocument();
  });

  it("baris: akun, nominal terformat (string decimal), akun lawan null = beberapa akun", () => {
    render(
      <Form
        lines={[
          line({ id: "l1", debit: "150000.5000" }),
          line({
            id: "l2",
            line_no: 2,
            credit: 150000.5,
            against_account: null,
          }),
        ]}
        totals={{
          debit: "150000.50",
          credit: "150000.50",
          balanced: true,
          active_lines: 2,
        }}
        minorUnit={2}
      />,
    );

    const rows = screen.getAllByTestId("journal-line");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("1100 - Kas");
    expect(rows[0]).toHaveTextContent("4100 - Penjualan");
    expect(rows[0]).toHaveTextContent("150,000.50");
    expect(rows[1]).toHaveTextContent("finances.journal.line_columns.multiple");
    expect(within(rows[0]).getByRole("link", { name: /1100/ })).toHaveAttribute(
      "href",
      "accounts.show/a1",
    );
  });

  it("indikator seimbang dan total dari server", () => {
    render(
      <Form
        lines={[line({ debit: 100 })]}
        totals={{
          debit: "100.00",
          credit: "100.00",
          balanced: true,
          active_lines: 1,
        }}
        minorUnit={2}
      />,
    );

    expect(screen.getByTestId("journal-balance")).toHaveAttribute(
      "data-balanced",
      "true",
    );
    expect(screen.getByTestId("journal-balance")).toHaveTextContent(
      "finances.journal.totals.balanced",
    );
    expect(screen.getByTestId("journal-total-debit")).toHaveTextContent(
      "100.00",
    );
    expect(screen.getByTestId("journal-total-credit")).toHaveTextContent(
      "100.00",
    );
  });

  it("indikator tidak seimbang (jurnal legacy) ditandai", () => {
    formPageSeed.legacy_origin = true;
    formPageSeed.legacy_unbalanced = true;
    render(
      <Form
        lines={[line({ debit: 100 })]}
        totals={{
          debit: "100.00",
          credit: "0.00",
          balanced: false,
          active_lines: 1,
        }}
        minorUnit={2}
      />,
    );

    expect(screen.getByTestId("journal-balance")).toHaveAttribute(
      "data-balanced",
      "false",
    );
    expect(screen.getByTestId("journal-balance")).toHaveTextContent(
      "finances.journal.totals.unbalanced",
    );
    expect(
      screen.getByText("finances.journal.legacy_unbalanced_notice"),
    ).toBeInTheDocument();
  });

  it("minor unit 0 (mis. JPY) menampilkan tanpa desimal", () => {
    render(
      <Form
        lines={[line({ debit: "1500.0000" })]}
        totals={{
          debit: "1500",
          credit: "1500",
          balanced: true,
          active_lines: 1,
        }}
        minorUnit={0}
      />,
    );

    expect(screen.getByTestId("journal-total-debit")).toHaveTextContent(
      /^1,500$/,
    );
  });

  it("jurnal voided: catatan dan baris soft-deleted tercoret", () => {
    formPageSeed.status = "voided";
    render(
      <Form
        lines={[line({ debit: 100, deleted_at: "2026-11-05T00:00:00Z" })]}
        totals={{
          debit: "100.00",
          credit: "100.00",
          balanced: true,
          active_lines: 0,
        }}
        minorUnit={2}
      />,
    );

    expect(
      screen.getByText("finances.journal.voided_notice"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("journal-line").className).toMatch(
      /line-through/,
    );
  });

  it("pemisah angka mengikuti preferensi (#.###,##)", () => {
    usePageMock.mockReturnValue({
      props: { preferences: { default_number_format: "#.###,##" } },
    });
    render(
      <Form
        lines={[line({ debit: 1234567.5 })]}
        totals={{
          debit: "1234567.50",
          credit: "1234567.50",
          balanced: true,
          active_lines: 1,
        }}
        minorUnit={2}
      />,
    );

    expect(screen.getByTestId("journal-total-debit")).toHaveTextContent(
      "1.234.567,50",
    );
  });
});
