import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// FormPageContent hanya dipakai sebagai wrapper tab/collapsible di sini --
// bukan concern AdditionalDiscount, jadi disederhanakan jadi <div> agar
// children (form fields) tetap dirender tanpa perlu Tabs provider asli.
// FormPageContext dibiarkan context React sungguhan supaya useCanUpdate
// (dipakai FormInput) tidak error walau tidak dibungkus provider (defaultnya
// undefined -> resolveCanUpdate menganggap boleh update). vi.mock factory
// di-hoist ke atas file -- import React di dalam factory sendiri (bukan
// referensi variabel top-level) untuk menghindari error hoisting.
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ children }) => <div>{children}</div>,
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

import AdditionalDiscount from "./AdditionalDiscount";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Select (dipakai utk discount_on) membungkus dirinya dengan <Tooltip>
// internal tanpa provider sendiri -- wajib TooltipProvider manual di sini.
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

const baseProps = {
  data: {},
  setData: vi.fn(),
  netAmount: 1000,
  taxAmount: 100,
  rawNetAmount: 1000,
  rawTaxAmount: 100,
};

describe("AdditionalDiscount", () => {
  beforeEach(() => {
    usePageMock.mockReturnValue({
      props: { preferences: { default_currency_id: "idr" } },
    });
  });

  it("field discount_rate & discount_amount disabled saat discount_on belum dipilih", () => {
    render(<AdditionalDiscount {...baseProps} data={{}} />);

    // FormInput menyalurkan prop `disabled` langsung ke child (NumberInput)
    // lewat cloneElement -- hasilnya elemen input berstatus disabled (native).
    const rateInput = screen.getByPlaceholderText("0.00%");
    expect(rateInput).toBeDisabled();
  });

  it("select discount_on menampilkan opsi net_total & grand_total dan memanggil setDiscount", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    render(<AdditionalDiscount {...baseProps} data={{}} setData={setData} />);

    const discountOnSelect = screen.getByPlaceholderText(
      "TR:sales.salesOrder.columns.discount_on.placeholder",
    );
    await user.click(discountOnSelect);

    const netTotalOption = await screen.findByText(
      "TR:sales.salesOrder.columns.discount_on.options.net_total",
    );
    await user.click(netTotalOption);

    expect(setData).toHaveBeenCalled();
    // setDiscount dipanggil dgn functional updater -- jalankan untuk verifikasi
    // hasil transisi discount_on: undefined -> "net_total".
    const updater = setData.mock.calls[0][0];
    const result = updater({ items: [] });
    expect(result.discount_on).toBe("net_total");
  });

  it("total (Total di currency dokumen) hanya tampil setelah discount_on dipilih", () => {
    const { rerender } = render(<AdditionalDiscount {...baseProps} data={{}} />);

    expect(
      screen.queryByText(/TR:sales.salesOrder.columns.total/),
    ).not.toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <AdditionalDiscount
          {...baseProps}
          data={{ discount_on: "net_total" }}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByText(/TR:sales.salesOrder.columns.total/),
    ).toBeInTheDocument();
  });

  it("total dihitung sebagai netAmount + taxAmount (tanpa pengurangan diskon berulang)", () => {
    render(
      <AdditionalDiscount
        {...baseProps}
        netAmount={800}
        taxAmount={80}
        data={{ discount_on: "net_total" }}
      />,
    );

    // NumberInput readOnly menampilkan value terformat -- total 800+80=880.
    const totalInputs = screen.getAllByDisplayValue(/880/);
    expect(totalInputs.length).toBeGreaterThan(0);
  });

  it("menampilkan baris Total tambahan (mata uang default) saat currency dokumen beda dari default", () => {
    render(
      <AdditionalDiscount
        {...baseProps}
        data={{
          discount_on: "net_total",
          currency: { code: "usd" },
          exchange_rate: 15000,
        }}
      />,
    );

    // Dua baris Total: satu untuk IDR (default), satu untuk USD (currency dokumen).
    const totalLabels = screen.getAllByText(
      /TR:sales.salesOrder.columns.total/,
    );
    expect(totalLabels.length).toBe(2);
  });

  it("tidak menampilkan baris Total tambahan saat currency dokumen sama dengan default", () => {
    render(
      <AdditionalDiscount
        {...baseProps}
        data={{
          discount_on: "net_total",
          currency: { code: "idr" },
        }}
      />,
    );

    const totalLabels = screen.getAllByText(
      /TR:sales.salesOrder.columns.total/,
    );
    expect(totalLabels.length).toBe(1);
  });

  it("discount_amount di-clamp ke rawNetAmount saat basis discount_on='net_total'", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <AdditionalDiscount
        {...baseProps}
        rawNetAmount={500}
        rawTaxAmount={50}
        data={{ discount_on: "net_total" }}
      />,
    );

    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "9999");
    await user.tab();

    // max = rawNetAmount (500) saat basis net_total (bukan net_total+tax).
    expect(amountInput).toHaveValue("500.00");
  });

  it("discount_amount di-clamp ke rawNetAmount+rawTaxAmount saat basis discount_on='grand_total'", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <AdditionalDiscount
        {...baseProps}
        rawNetAmount={500}
        rawTaxAmount={50}
        data={{ discount_on: "grand_total" }}
      />,
    );

    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "9999");
    await user.tab();

    expect(amountInput).toHaveValue("550.00");
  });
});
