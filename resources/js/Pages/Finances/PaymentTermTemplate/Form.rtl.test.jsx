import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t harus stabil (konstanta module-level) -- mengikuti pola acuan Tags.rtl.test.jsx
// agar tidak memicu infinite loop bila ada useEffect/useCallback ber-dependency `t`.
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// usePage() dipakai Form.jsx utk default_currency_id (preferences), dan oleh
// NumberInput utk default_number_format.
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// useFormPage tidak butuh reaktivitas context asli di sini -- setiap test
// mengontrol penuh nilai data/setData/dataBefore lewat mock return value dan
// me-render ulang dengan nilai baru, bukan lewat state internal komponen.
// useFormPageMeta dipakai FormInput (dirender langsung oleh Form.jsx utk
// field name/description) -- kembalikan undefined spy agar FormInput
// menganggap boleh update (useCanUpdate default true tanpa context).
const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ title, children }) => (
      <div>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    ),
    FormPageContentDescription: ({ children }) => <p>{children}</p>,
    useFormPage: (...a) => useFormPageMock(...a),
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// DatetimePicker adalah komponen berat (Popover + day-picker) bukan concern
// Form.jsx PaymentTermTemplate -- distub jadi input text yang menampilkan ISO
// string nilainya, cukup utk verifikasi tanggal hasil kalkulasi due_date.
vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, readOnly, onValueChange, name }) => (
    <input
      aria-label={name ?? "datetime"}
      type="text"
      readOnly={readOnly}
      value={value ? new Date(value).toISOString() : ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v ? new Date(v) : null);
      }}
    />
  ),
}));

// PaymentMethodLinkModel membungkus LinkModel (dialog CRUD berat, concern
// sendiri) -- distub jadi tombol pilih value tetap.
vi.mock("../PaymentMethods/PaymentMethodLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() => onValueChange?.({ id: 1, name: "Transfer Bank" })}
    >
      payment-method:{value?.name ?? value ?? "none"}
    </button>
  ),
}));

// FormTable adalah komponen besar (2074 baris) dengan test sendiri
// (FormTable.test.js) -- distub sebagai renderer sederhana yang memanggil
// column.cell() utk tiap baris `value`, supaya logic murni Form.jsx
// PaymentTermTemplate (definisi kolom, cell renderer, additionalData) yang
// diuji, bukan mekanisme drag-drop/tabel FormTable itu sendiri.
vi.mock("@/Components/FormTable", () => ({
  default: ({
    name,
    columns,
    value,
    onValueChange,
    additionalData,
    readOnly,
  }) => {
    const rows = value && value.length > 0 ? value : [];
    const resolvedAdditionalData =
      typeof additionalData === "function"
        ? additionalData(rows)
        : additionalData;
    const updateData = (index, keyOrObj, val) => {
      const next = [...rows];
      const row = { ...next[index] };
      if (typeof keyOrObj === "object") {
        Object.assign(row, keyOrObj);
      } else {
        row[keyOrObj] = val;
      }
      next[index] = row;
      onValueChange?.(next);
    };
    return (
      <div
        data-testid={`stub-form-table-${name}`}
        data-readonly={String(!!readOnly)}
      >
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${name}-${index}`}>
            {columns.map((col) => (
              <div
                key={col.name}
                data-testid={`cell-${name}-${col.name}-${index}`}
              >
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) => updateData(index, keyOrObj, val),
                  additionalData: resolvedAdditionalData?.[row.id],
                  attributes: {},
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

import Form from "./Form";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Select (discount_type/due_date_based_on) & NumberInput membawa <Tooltip>
// internal tanpa provider sendiri.
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

describe("PaymentTermTemplate Form", () => {
  const baseFormPage = {
    data: { name: "", description: "", items: [] },
    setData: vi.fn(),
    dataBefore: undefined,
  };

  beforeEach(() => {
    usePageMock.mockReturnValue({
      props: { preferences: { default_currency_id: "IDR" } },
    });
    useFormPageMock.mockReset();
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      setData: vi.fn(),
    });
  });

  it("render tanpa error dan menampilkan field name & description", () => {
    render(<Form />);

    expect(
      screen.getByText("TR:finances.paymentTerm.columns.name"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("TR:finances.paymentTerm.columns.description"),
    ).toBeInTheDocument();
  });

  it("mengetik pada field name memanggil setData('name', value)", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({ ...baseFormPage, setData });

    render(<Form />);

    const nameInput = screen.getAllByRole("textbox")[0];
    await user.type(nameInput, "X");

    expect(setData).toHaveBeenCalledWith("name", "X");
  });

  it("meneruskan data.items ke FormTable paymentTermTemplateItems dan valueBefore dari dataBefore.items", () => {
    const items = [{ id: "row1", invoice_portion: 40 }];
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      data: { ...baseFormPage.data, items },
      dataBefore: { items: [{ id: "row1", invoice_portion: 30 }] },
      setData: vi.fn(),
    });

    render(<Form />);

    expect(
      screen.getByTestId("row-paymentTermTemplateItems-0"),
    ).toBeInTheDocument();
    const portionCell = screen.getByTestId(
      "cell-paymentTermTemplateItems-invoice_portion-0",
    );
    expect(portionCell.querySelector("input")).toHaveValue("40.00%");
  });

  it("mengubah invoice_portion baris template memanggil setData('items', ...) via FormTable stub", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      data: {
        ...baseFormPage.data,
        items: [{ id: "row1", invoice_portion: null }],
      },
      setData,
    });

    render(<Form />);

    const input = screen
      .getByTestId("cell-paymentTermTemplateItems-invoice_portion-0")
      .querySelector("input");
    await user.type(input, "5");

    expect(setData).toHaveBeenCalledWith("items", [
      expect.objectContaining({ id: "row1", invoice_portion: 5 }),
    ]);
  });

  it("mengubah due_date_based_on mereset credit_period ke 0 saat nilai berubah", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      data: {
        ...baseFormPage.data,
        items: [
          {
            id: "row1",
            due_date_based_on: "days_after_invoice_date",
            credit_period: 30,
          },
        ],
      },
      setData,
    });

    render(<Form />);

    const dueDateBasedOnCell = screen.getByTestId(
      "cell-paymentTermTemplateItems-due_date_based_on-0",
    );
    const selectInput = dueDateBasedOnCell.querySelector("input");
    await user.click(selectInput);
    await user.click(
      await screen.findByText(
        "TR:finances.paymentTerm.columns.due_date_based_on.options.months_after_invoice_month",
      ),
    );

    expect(setData).toHaveBeenLastCalledWith("items", [
      expect.objectContaining({
        due_date_based_on: "months_after_invoice_month",
        credit_period: 0,
      }),
    ]);
  });

  it("credit_period baris template disabled selama due_date_based_on belum diisi", () => {
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      data: {
        ...baseFormPage.data,
        items: [{ id: "row1", due_date_based_on: undefined }],
      },
      setData: vi.fn(),
    });

    render(<Form />);

    const creditPeriodCell = screen.getByTestId(
      "cell-paymentTermTemplateItems-credit_period-0",
    );
    expect(creditPeriodCell.querySelector("input")).toBeDisabled();
  });

  it("discount baris template disabled selama discount_type belum diisi, dan suffix % saat discount_type percentage", () => {
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      data: {
        ...baseFormPage.data,
        items: [
          { id: "row1", discount_type: undefined },
          { id: "row2", discount_type: "percentage", discount: 10 },
        ],
      },
      setData: vi.fn(),
    });

    render(<Form />);

    const disabledCell = screen.getByTestId(
      "cell-paymentTermTemplateItems-discount-0",
    );
    expect(disabledCell.querySelector("input")).toBeDisabled();

    const percentCell = screen.getByTestId(
      "cell-paymentTermTemplateItems-discount-1",
    );
    expect(percentCell.querySelector("input")).toHaveValue("10.00%");
  });

  it("description baris template disabled selama invoice_portion belum diisi", () => {
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      data: {
        ...baseFormPage.data,
        items: [{ id: "row1", invoice_portion: null }],
      },
      setData: vi.fn(),
    });

    render(<Form />);

    const descriptionCell = screen.getByTestId(
      "cell-paymentTermTemplateItems-description-0",
    );
    expect(descriptionCell.querySelector("textarea")).toBeDisabled();
  });

  it("memilih payment_method baris template memanggil setData('items', ...) dengan payment_method terisi", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      ...baseFormPage,
      data: { ...baseFormPage.data, items: [{ id: "row1" }] },
      setData,
    });

    render(<Form />);

    const cell = screen.getByTestId(
      "cell-paymentTermTemplateItems-payment_method-0",
    );
    await user.click(cell.querySelector("button"));

    expect(setData).toHaveBeenCalledWith("items", [
      expect.objectContaining({
        payment_method: { id: 1, name: "Transfer Bank" },
      }),
    ]);
  });

  describe("contoh jadwal pembayaran (examplePaymentTermItems)", () => {
    it("menghitung due_date days_after_invoice_date dari credit_period", () => {
      useFormPageMock.mockReturnValue({
        ...baseFormPage,
        data: {
          ...baseFormPage.data,
          items: [
            {
              due_date_based_on: "days_after_invoice_date",
              credit_period: 10,
              invoice_portion: 100,
            },
          ],
        },
        setData: vi.fn(),
      });

      render(<Form />);

      const cell = screen.getByTestId(
        "cell-paymentScheduleExamples-due_date-0",
      );
      const dueDateInput = cell.querySelector("input");
      const today = new Date();
      const expected = new Date(today);
      expected.setDate(expected.getDate() + 10);

      expect(new Date(dueDateInput.value).toDateString()).toBe(
        expected.toDateString(),
      );
    });

    it("menghitung due_date weeks_after_invoice_week (credit_period dikali 7 hari)", () => {
      useFormPageMock.mockReturnValue({
        ...baseFormPage,
        data: {
          ...baseFormPage.data,
          items: [
            {
              due_date_based_on: "weeks_after_invoice_week",
              credit_period: 2,
              invoice_portion: 100,
            },
          ],
        },
        setData: vi.fn(),
      });

      render(<Form />);

      const cell = screen.getByTestId(
        "cell-paymentScheduleExamples-due_date-0",
      );
      const dueDateInput = cell.querySelector("input");
      const today = new Date();
      const expected = new Date(today);
      expected.setDate(expected.getDate() + 2 * 7);

      expect(new Date(dueDateInput.value).toDateString()).toBe(
        expected.toDateString(),
      );
    });

    it("menghitung due_date months_after_invoice_month dari credit_period", () => {
      useFormPageMock.mockReturnValue({
        ...baseFormPage,
        data: {
          ...baseFormPage.data,
          items: [
            {
              due_date_based_on: "months_after_invoice_month",
              credit_period: 3,
              invoice_portion: 100,
            },
          ],
        },
        setData: vi.fn(),
      });

      render(<Form />);

      const cell = screen.getByTestId(
        "cell-paymentScheduleExamples-due_date-0",
      );
      const dueDateInput = cell.querySelector("input");
      const today = new Date();
      const expected = new Date(today);
      expected.setMonth(expected.getMonth() + 3);

      expect(new Date(dueDateInput.value).toDateString()).toBe(
        expected.toDateString(),
      );
    });

    it("discount_date contoh ikut due_date hanya jika discount_type baris template terisi", () => {
      useFormPageMock.mockReturnValue({
        ...baseFormPage,
        data: {
          ...baseFormPage.data,
          items: [
            {
              due_date_based_on: "days_after_invoice_date",
              credit_period: 5,
              invoice_portion: 50,
              discount_type: "percentage",
              discount: 5,
            },
            {
              due_date_based_on: "days_after_invoice_date",
              credit_period: 5,
              invoice_portion: 50,
              discount_type: undefined,
            },
          ],
        },
        setData: vi.fn(),
      });

      render(<Form />);

      const row0DueDate = screen
        .getByTestId("cell-paymentScheduleExamples-due_date-0")
        .querySelector("input").value;
      const row0DiscountDate = screen
        .getByTestId("cell-paymentScheduleExamples-discount_date-0")
        .querySelector("input").value;
      expect(row0DiscountDate).toBe(row0DueDate);

      const row1DiscountDate = screen
        .getByTestId("cell-paymentScheduleExamples-discount_date-1")
        .querySelector("input").value;
      expect(row1DiscountDate).toBe("");
    });

    it("payment_amount & outstanding_amount contoh dihitung dari amount tetap (10 juta) dikali invoice_portion", () => {
      useFormPageMock.mockReturnValue({
        ...baseFormPage,
        data: {
          ...baseFormPage.data,
          items: [
            {
              due_date_based_on: "days_after_invoice_date",
              credit_period: 1,
              invoice_portion: 25,
            },
          ],
        },
        setData: vi.fn(),
      });

      render(<Form />);

      const paymentAmountCell = screen.getByTestId(
        "cell-paymentScheduleExamples-payment_amount-0",
      );
      const outstandingCell = screen.getByTestId(
        "cell-paymentScheduleExamples-outstanding_amount-0",
      );

      // amount contoh tetap 10.000.000, invoice_portion 25% -> 2.500.000.
      // payment_amount membaca additionalData?.payment_amount (benar).
      expect(paymentAmountCell.querySelector("input")).toHaveValue(
        "2,500,000.00",
      );
      // CATATAN BUG PRODUKSI (lihat laporan akhir task): kolom
      // outstanding_amount di Form.jsx (baris 309-317) membaca `data` (yaitu
      // dataRow.outstanding_amount), BUKAN `additionalData?.outstanding_amount`
      // seperti payment_amount di atas. examplePaymentTermItems (baris
      // 322-353) tidak pernah menetapkan field outstanding_amount pada row --
      // nilai itu hanya ada di dalam map `additionalData` yang dihitung di
      // baris 416-428. Akibatnya di UI nyata kolom outstanding_amount pada
      // tabel contoh SELALU kosong/0, bukan mengikuti payment_amount seperti
      // yang tersirat dari nama kolomnya. Test ini mendokumentasikan
      // behavior aktual (bukan yang seharusnya).
      // dataRow.outstanding_amount undefined -> formatNumber(undefined) = ""
      // (bukan "0.00", lihat Components/NumberInput/formatNumber.test.js).
      expect(outstandingCell.querySelector("input")).toHaveValue("");
    });

    it("FormTable contoh dirender readOnly", () => {
      useFormPageMock.mockReturnValue({
        ...baseFormPage,
        data: { ...baseFormPage.data, items: [{ invoice_portion: 100 }] },
        setData: vi.fn(),
      });

      render(<Form />);

      expect(
        screen.getByTestId("stub-form-table-paymentScheduleExamples"),
      ).toHaveAttribute("data-readonly", "true");
    });

    it("data.items kosong/null menghasilkan tabel contoh tanpa baris", () => {
      useFormPageMock.mockReturnValue({
        ...baseFormPage,
        data: { ...baseFormPage.data, items: undefined },
        setData: vi.fn(),
      });

      render(<Form />);

      expect(
        screen.queryByTestId("row-paymentScheduleExamples-0"),
      ).not.toBeInTheDocument();
    });
  });
});
