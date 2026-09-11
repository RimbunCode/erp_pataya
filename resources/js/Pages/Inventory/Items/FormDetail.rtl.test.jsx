import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Fokus test ini pada dua checkbox informasional di FormDetail:
// - is_stock_item: selalu disabled, dihitung dari Category yang dipilih (fallback
//   ke kolom is_stock_item sendiri -> fallback false), DAN dari is_fixed_asset
//   (aset tetap tidak pernah barang stok).
// - is_fixed_asset: disabled + tooltip ketika Category adalah kategori jasa
//   (kategori jasa tidak bisa dijadikan aset tetap) -- gate-nya baseline
//   Category MURNI (categoryStockItem), bukan is_stock_item akhir, supaya
//   tidak circular begitu is_fixed_asset sendiri yg bikin is_stock_item false.
// Dependensi lain (CategoryLinkModel, UnitLinkModel, FormInput, FormPageContent)
// di-stub dengan pola yang sama seperti Form.rtl.test.jsx, karena bukan fokus
// test ini.
// ============================================================================

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

// Stub interaktif: klik memicu onValueChange dgn payload dari
// window.__categoryLinkModelValue (dipakai test onValueChange di bawah).
window.__categoryLinkModelValue = null;
vi.mock("../Categories/CategoryLinkModel", () => ({
  default: ({ onValueChange }) => (
    <button
      type="button"
      data-testid="category-link-model"
      onClick={() => onValueChange?.(window.__categoryLinkModelValue)}
    />
  ),
}));
vi.mock("../Units/UnitLinkModel", () => ({
  default: () => <div data-testid="unit-link-model" />,
}));
vi.mock("@/Components/FormInput", () => ({
  default: ({ label, children }) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  ),
}));
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ children }) => <div>{children}</div>,
  // FormCheckbox (ui/checkbox, tidak di-stub) memanggil useFormPage() untuk
  // menentukan readOnly form-level -- tidak relevan untuk test ini.
  useFormPage: () => ({}),
}));

import { TooltipProvider } from "@/Components/ui/tooltip";
import FormDetail from "./FormDetail";

const LABEL = "inventory.item.columns.is_stock_item";

const renderFormDetail = (props = {}) =>
  render(
    <TooltipProvider>
      <FormDetail data={{}} setData={vi.fn()} {...props} />
    </TooltipProvider>,
  );

const FIXED_ASSET_LABEL = "inventory.item.columns.is_fixed_asset";

const getCheckboxByLabel = (text) => {
  const label = screen.getByText(text).closest("label");
  return document.getElementById(label.getAttribute("for"));
};

const getStockCheckbox = () => getCheckboxByLabel(LABEL);
const getFixedAssetCheckbox = () => getCheckboxByLabel(FIXED_ASSET_LABEL);

describe("FormDetail -- checkbox is_stock_item (informasional, mengikuti Category)", () => {
  it("selalu disabled, apapun nilainya", () => {
    renderFormDetail({ data: { category: { type: "inventory" } } });
    expect(getStockCheckbox()).toBeDisabled();
  });

  it("kategori type 'service' -> unchecked", () => {
    renderFormDetail({ data: { category: { type: "service" } } });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "unchecked");
  });

  it.each(["inventory", "vehicle"])("kategori type '%s' -> checked", (type) => {
    renderFormDetail({ data: { category: { type } } });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "checked");
  });

  it("belum ada kategori dipilih -> fallback ke data.is_stock_item (true)", () => {
    renderFormDetail({ data: { category: null, is_stock_item: true } });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "checked");
  });

  it("belum ada kategori & data.is_stock_item juga kosong -> fallback false", () => {
    renderFormDetail({ data: { category: null } });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "unchecked");
  });

  it("isVariant: memakai item.category (bukan data.category yang readOnly)", () => {
    renderFormDetail({
      isVariant: true,
      data: { is_stock_item: false },
      item: { category: { type: "vehicle" }, name: "Ban", description: "" },
    });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "checked");
  });

  it("isVariant tanpa category dari item -> fallback ke is_stock_item milik variant sendiri", () => {
    renderFormDetail({
      isVariant: true,
      data: { is_stock_item: false },
      item: { category: null, name: "Ban", description: "" },
    });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "unchecked");
  });

  it("kategori non-service TAPI is_fixed_asset=true -> tetap unchecked (aset tetap bukan barang stok)", () => {
    renderFormDetail({
      data: { category: { type: "inventory" }, is_fixed_asset: true },
    });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "unchecked");
  });

  it("isVariant, item.is_fixed_asset=true -> unchecked walau kategori non-service", () => {
    renderFormDetail({
      isVariant: true,
      data: {},
      item: {
        category: { type: "inventory" },
        is_fixed_asset: true,
        name: "Ban",
        description: "",
      },
    });
    expect(getStockCheckbox()).toHaveAttribute("data-state", "unchecked");
  });
});

describe("FormDetail -- checkbox is_fixed_asset (disabled utk kategori jasa)", () => {
  it("kategori non-service -> checkbox aktif (tidak disabled), reaksi ke onCheckedChange", () => {
    renderFormDetail({ data: { category: { type: "inventory" } } });
    expect(getFixedAssetCheckbox()).not.toBeDisabled();
  });

  it("kategori type 'service' -> checkbox disabled (jasa tak bisa jadi aset tetap)", () => {
    renderFormDetail({ data: { category: { type: "service" } } });
    expect(getFixedAssetCheckbox()).toBeDisabled();
  });

  it("belum ada kategori dipilih (baseline true dari fallback) -> checkbox tetap aktif", () => {
    renderFormDetail({ data: { category: null, is_stock_item: true } });
    expect(getFixedAssetCheckbox()).not.toBeDisabled();
  });

  it("tidak dirender sama sekali saat isVariant (is_fixed_asset cuma ada di Item, bukan ItemVariant)", () => {
    renderFormDetail({
      isVariant: true,
      data: {},
      item: { category: { type: "inventory" }, name: "Ban", description: "" },
    });
    expect(screen.queryByText(FIXED_ASSET_LABEL)).not.toBeInTheDocument();
  });

  it("klik checkbox (kategori non-service) memanggil setData('is_fixed_asset', true)", async () => {
    const setData = vi.fn();
    render(
      <TooltipProvider>
        <FormDetail
          data={{ category: { type: "inventory" }, is_fixed_asset: false }}
          setData={setData}
        />
      </TooltipProvider>,
    );
    await userEvent.setup().click(getFixedAssetCheckbox());
    expect(setData).toHaveBeenCalledWith("is_fixed_asset", true);
  });

  it("ganti kategori ke service mereset is_fixed_asset ke false (hindari checked+disabled kontradiktif dgn tooltip)", async () => {
    const setData = vi.fn();
    window.__categoryLinkModelValue = { type: "service", id: "svc-1" };
    render(
      <TooltipProvider>
        <FormDetail
          data={{ category: { type: "inventory" }, is_fixed_asset: true }}
          setData={setData}
        />
      </TooltipProvider>,
    );

    await userEvent.setup().click(screen.getByTestId("category-link-model"));

    expect(setData).toHaveBeenCalledWith(expect.any(Function));
    const updater = setData.mock.calls[0][0];
    const nextData = updater({
      category: { type: "inventory" },
      is_fixed_asset: true,
    });
    expect(nextData.category).toEqual({ type: "service", id: "svc-1" });
    expect(nextData.is_fixed_asset).toBe(false);
  });

  it("ganti kategori ke non-service TIDAK menyentuh is_fixed_asset yang sudah false", async () => {
    const setData = vi.fn();
    window.__categoryLinkModelValue = { type: "inventory", id: "inv-1" };
    render(
      <TooltipProvider>
        <FormDetail
          data={{ category: { type: "service" }, is_fixed_asset: false }}
          setData={setData}
        />
      </TooltipProvider>,
    );

    await userEvent.setup().click(screen.getByTestId("category-link-model"));

    const updater = setData.mock.calls[0][0];
    const nextData = updater({
      category: { type: "service" },
      is_fixed_asset: false,
    });
    expect(nextData.is_fixed_asset).toBe(false);
  });
});
