import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// Form.jsx (Asset/Movements) adalah form Asset Movement (perpindahan lokasi/
// kepemilikan aset, 146 baris). Logic UNIK yang jadi fokus test ini (bukan
// komponen anak yang sudah ada test sendiri):
//   1. needsSource = purpose in [receipt, transfer, transfer_and_issue] ->
//      required kolom source_location.
//   2. needsTarget = purpose in [issue, transfer, transfer_and_issue] ->
//      required kolom target_location.
//   3. itemColumns (useMemo, dependency [needsSource, needsTarget]) --
//      berubah reaktif saat purpose berubah, walau KEEMPAT kolom (asset,
//      source_location, target_location, to_custodian) selalu DIRENDER --
//      hanya flag `required` yang kondisional, bukan visibility.
//   4. PURPOSES select: 4 opsi (issue, receipt, transfer,
//      transfer_and_issue) dengan i18n key asset.movement.purpose.{purpose}.
//   5. mapItem: id = item.id ?? generateRandom(5) -- generateRandom (lib/utils,
//      TIDAK dimock) dipakai apa adanya sebagai fallback id baris baru.
//   6. FormTable name="AssetMovementItems", readOnly = disabled dari
//      useFormPage.
//
// Semua komponen anak yang sudah punya test sendiri di-stub: FormInput,
// Select, DatetimePicker, FormTable, AssetLinkModel, AssetLocationLinkModel,
// UserLinkModel, serta FormPageContent/useFormPage (dari @/Pages/Core/FormPage).

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// useFormPage diimplementasikan sebagai stateful hook (state React asli)
// supaya perubahan `purpose` (mengubah needsSource/needsTarget/itemColumns)
// dan interaksi FormTable (setData("items", ...)) betul-betul memicu
// re-render dengan data terbaru.
let formPageSeed = {};
let formPageDisabled = false;
function useFormPageStateful() {
  const [data, setDataState] = useState(formPageSeed);
  const setData = (...args) => {
    if (typeof args[0] === "function") {
      setDataState((prev) => args[0](prev));
    } else if (typeof args[0] === "string") {
      setDataState((prev) => ({ ...prev, [args[0]]: args[1] }));
    } else {
      setDataState((prev) => ({ ...prev, ...args[0] }));
    }
  };
  return { data, setData, disabled: formPageDisabled };
}

vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...args) => useFormPageStateful(...args),
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, name, required, children }) => (
    <div
      data-testid={`forminput-${name ?? label ?? ""}`}
      data-required={required ? "true" : "false"}
    >
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/ui/select", () => ({
  Select: ({ value, onValueChange, children }) => (
    <select
      data-testid="select"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: ({ children }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="datetime-picker"
      type="text"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
}));

function makeLinkModelStub(testId, labelField, dummyValue) {
  return {
    default: ({ value, onValueChange, ...attrs }) => (
      <div data-testid={testId} {...attrs}>
        <input
          data-testid={`${testId}-input`}
          value={value?.[labelField] ?? ""}
          readOnly
        />
        <button type="button" onClick={() => onValueChange?.(dummyValue)}>
          pilih-{testId}
        </button>
      </div>
    ),
  };
}

vi.mock("@/Pages/Asset/Assets/AssetLinkModel", () =>
  makeLinkModelStub("asset-link", "name", { id: 1, name: "Laptop Dell" }),
);
vi.mock("@/Pages/Asset/Locations/AssetLocationLinkModel", () =>
  makeLinkModelStub("asset-location-link", "name", { id: 2, name: "Gudang A" }),
);
vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () =>
  makeLinkModelStub("user-link", "name", { id: 3, name: "Budi" }),
);

// FormTable distub sebagai renderer sederhana yang memanggil tiap
// column.cell() untuk baris dari `value`, supaya definisi kolom (itemColumns)
// milik Form.jsx yang diuji, bukan mekanisme FormTable itu sendiri. mapItem
// (dikirim sbg prop) dipanggil sama seperti FormTable asli saat baris
// ditambah, supaya fallback id (generateRandom) ikut teruji.
vi.mock("@/Components/FormTable", () => ({
  default: ({ name, readOnly, columns, value, onValueChange, mapItem }) => {
    const rows = value ?? [];
    return (
      <div data-testid={`form-table-${name}`} data-readonly={readOnly ? "true" : "false"}>
        <button
          type="button"
          data-testid={`form-table-${name}-add-row`}
          onClick={() => {
            const newItem = mapItem
              ? mapItem({ item: {}, dataTable: rows, index: rows.length })
              : {};
            onValueChange?.([...rows, newItem]);
          }}
        >
          add-row-{name}
        </button>
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${name}-${index}`}>
            {columns.filter(Boolean).map((col) => (
              <div key={col.name} data-testid={`cell-${col.name}-${name}-${index}`}>
                <span data-testid={`col-required-${col.name}-${name}-${index}`}>
                  {col.required ? "required" : "optional"}
                </span>
                {col.cell({
                  data: row[col.name],
                  setData: (key, val) => {
                    const next = [...rows];
                    next[index] = { ...next[index], [key]: val };
                    onValueChange?.(next);
                  },
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

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Form from "./Form";

const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

describe("Form (Asset/Movements)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formPageSeed = {};
    formPageDisabled = false;
  });

  describe("field dasar: purpose & transaction_date", () => {
    it("purpose dan transaction_date required=true", () => {
      render(<Form />);

      expect(screen.getByTestId("forminput-purpose")).toHaveAttribute(
        "data-required",
        "true",
      );
      expect(
        screen.getByTestId("forminput-transaction_date"),
      ).toHaveAttribute("data-required", "true");
    });

    it("Select purpose berisi ke-4 opsi dengan i18n key yang benar", () => {
      render(<Form />);

      const wrapper = screen.getByTestId("forminput-purpose");
      const select = within(wrapper).getByTestId("select");
      expect(
        within(select).getByText("asset.movement.purpose.issue"),
      ).toBeInTheDocument();
      expect(
        within(select).getByText("asset.movement.purpose.receipt"),
      ).toBeInTheDocument();
      expect(
        within(select).getByText("asset.movement.purpose.transfer"),
      ).toBeInTheDocument();
      expect(
        within(select).getByText("asset.movement.purpose.transfer_and_issue"),
      ).toBeInTheDocument();
    });

    it("memilih purpose memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const wrapper = screen.getByTestId("forminput-purpose");
      const select = within(wrapper).getByTestId("select");
      await user.selectOptions(select, "transfer");

      expect(select).toHaveValue("transfer");
    });

    it("mengisi transaction_date via DatetimePicker memanggil setData", async () => {
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const wrapper = screen.getByTestId("forminput-transaction_date");
      const picker = within(wrapper).getByTestId("datetime-picker");
      await user.type(picker, "2026-08-22");

      expect(picker).toHaveValue("2026-08-22");
    });
  });

  describe("itemColumns: cascade required berdasar purpose", () => {
    it("purpose belum diisi: source_location & target_location TIDAK required, asset required, to_custodian tidak", async () => {
      render(<Form />);

      const addRow = screen.getByTestId(
        "form-table-AssetMovementItems-add-row",
      );
      const user = userEvent.setup({ delay: null });
      await user.click(addRow);

      expect(
        screen.getByTestId(
          "col-required-source_location-AssetMovementItems-0",
        ),
      ).toHaveTextContent("optional");
      expect(
        screen.getByTestId(
          "col-required-target_location-AssetMovementItems-0",
        ),
      ).toHaveTextContent("optional");
      expect(
        screen.getByTestId("col-required-asset-AssetMovementItems-0"),
      ).toHaveTextContent("required");
      expect(
        screen.getByTestId(
          "col-required-to_custodian-AssetMovementItems-0",
        ),
      ).toHaveTextContent("optional");
    });

    it.each([
      ["issue", false, true],
      ["receipt", true, false],
      ["transfer", true, true],
      ["transfer_and_issue", true, true],
    ])(
      "purpose=%s -> source_location required=%s, target_location required=%s",
      (purpose, sourceRequired, targetRequired) => {
        formPageSeed = { purpose, items: [{ id: 1 }] };
        render(<Form />);

        expect(
          screen.getByTestId(
            "col-required-source_location-AssetMovementItems-0",
          ),
        ).toHaveTextContent(sourceRequired ? "required" : "optional");
        expect(
          screen.getByTestId(
            "col-required-target_location-AssetMovementItems-0",
          ),
        ).toHaveTextContent(targetRequired ? "required" : "optional");
      },
    );

    it("mengubah purpose dari 'issue' ke 'receipt' menukar required source/target secara reaktif", async () => {
      formPageSeed = { purpose: "issue", items: [{ id: 1 }] };
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      expect(
        screen.getByTestId(
          "col-required-source_location-AssetMovementItems-0",
        ),
      ).toHaveTextContent("optional");
      expect(
        screen.getByTestId(
          "col-required-target_location-AssetMovementItems-0",
        ),
      ).toHaveTextContent("required");

      const wrapper = screen.getByTestId("forminput-purpose");
      const select = within(wrapper).getByTestId("select");
      await user.selectOptions(select, "receipt");

      expect(
        screen.getByTestId(
          "col-required-source_location-AssetMovementItems-0",
        ),
      ).toHaveTextContent("required");
      expect(
        screen.getByTestId(
          "col-required-target_location-AssetMovementItems-0",
        ),
      ).toHaveTextContent("optional");
    });
  });

  describe("itemColumns: cell interaksi tiap kolom", () => {
    beforeEach(() => {
      formPageSeed = { items: [{ id: 1 }] };
    });

    it("memilih asset via AssetLinkModel memanggil setData pada baris tersebut", async () => {
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const cell = screen.getByTestId(
        "cell-asset-AssetMovementItems-0",
      );
      await user.click(within(cell).getByText("pilih-asset-link"));

      expect(within(cell).getByTestId("asset-link-input")).toHaveValue(
        "Laptop Dell",
      );
    });

    it("memilih source_location via AssetLocationLinkModel memanggil setData pada baris tersebut", async () => {
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const cell = screen.getByTestId(
        "cell-source_location-AssetMovementItems-0",
      );
      await user.click(within(cell).getByText("pilih-asset-location-link"));

      expect(
        within(cell).getByTestId("asset-location-link-input"),
      ).toHaveValue("Gudang A");
    });

    it("memilih target_location via AssetLocationLinkModel memanggil setData pada baris tersebut", async () => {
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const cell = screen.getByTestId(
        "cell-target_location-AssetMovementItems-0",
      );
      await user.click(within(cell).getByText("pilih-asset-location-link"));

      expect(
        within(cell).getByTestId("asset-location-link-input"),
      ).toHaveValue("Gudang A");
    });

    it("memilih to_custodian via UserLinkModel memanggil setData pada baris tersebut", async () => {
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const cell = screen.getByTestId(
        "cell-to_custodian-AssetMovementItems-0",
      );
      await user.click(within(cell).getByText("pilih-user-link"));

      expect(within(cell).getByTestId("user-link-input")).toHaveValue("Budi");
    });

    it("memilih source_location pada satu baris tidak mempengaruhi baris lain (scoped per-row)", async () => {
      formPageSeed = { items: [{ id: 1 }, { id: 2 }] };
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const cellRow0 = screen.getByTestId(
        "cell-source_location-AssetMovementItems-0",
      );
      await user.click(within(cellRow0).getByText("pilih-asset-location-link"));

      const cellRow1 = screen.getByTestId(
        "cell-source_location-AssetMovementItems-1",
      );
      expect(
        within(cellRow0).getByTestId("asset-location-link-input"),
      ).toHaveValue("Gudang A");
      expect(
        within(cellRow1).getByTestId("asset-location-link-input"),
      ).toHaveValue("");
    });
  });

  describe("FormTable AssetMovementItems: mapItem & readOnly", () => {
    it("FormTable menerima name='AssetMovementItems' dan readOnly mengikuti disabled dari useFormPage", () => {
      formPageDisabled = true;
      render(<Form />);

      expect(
        screen.getByTestId("form-table-AssetMovementItems"),
      ).toHaveAttribute("data-readonly", "true");
    });

    it("readOnly=false saat form tidak disabled", () => {
      formPageDisabled = false;
      render(<Form />);

      expect(
        screen.getByTestId("form-table-AssetMovementItems"),
      ).toHaveAttribute("data-readonly", "false");
    });

    it("menambah baris baru via mapItem memberi id fallback (generateRandom) saat item.id kosong", async () => {
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      const addRow = screen.getByTestId(
        "form-table-AssetMovementItems-add-row",
      );
      await user.click(addRow);

      // Baris baru dirender dgn key row.id ?? index -- fallback id dari
      // generateRandom(5) berarti row.id truthy, jadi cell tetap terlihat
      // dan tidak error React "missing key".
      expect(
        screen.getByTestId("row-AssetMovementItems-0"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("cell-asset-AssetMovementItems-0"),
      ).toBeInTheDocument();
    });

    it("baris item dengan id sudah ada tetap dirender apa adanya (id existing dipertahankan)", () => {
      formPageSeed = { items: [{ id: "existing-id-123" }] };
      render(<Form />);

      expect(
        screen.getByTestId("row-AssetMovementItems-0"),
      ).toBeInTheDocument();
    });
  });
});
