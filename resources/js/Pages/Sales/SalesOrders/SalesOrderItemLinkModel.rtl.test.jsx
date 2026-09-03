import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import SalesOrderItemLinkModel from "./SalesOrderItemLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

// app/Models/Sales/SalesOrderItem.php templateLink() = ':item' -- sama pola
// nested-object dengan PurchaseOrderItemLinkModel: field `item` bernilai
// object bertemplateLink sendiri (relasi Item), convertTemplateLink rekursi
// ke situ. SalesOrderItemLinkModel.jsx juga mengunci as="item:item.item_id"
// (name="item" utk pluralize route, keyRoute="item.item_id" utk routeId) dan
// canNavigation="App\Models\Inventory\Item" (di luar scope minimum test ini
// -- tidak diuji detail nav button, mengikuti cakupan file LinkModel wrapper
// lain di codebase ini).
describe("SalesOrderItemLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":item",
            item: { item_id: 100, templateLink: ":name", name: "Kursi Kantor" },
            thisModel: "App\\Models\\Sales\\SalesOrderItem",
          },
          {
            id: 2,
            templateLink: ":item",
            item: { item_id: 101, templateLink: ":name", name: "Meja Kantor" },
            thisModel: "App\\Models\\Sales\\SalesOrderItem",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<SalesOrderItemLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:item rekursi ke item.templateLink)", async () => {
    await render(
      <SalesOrderItemLinkModel
        value={{
          templateLink: ":item",
          item: { item_id: 5, templateLink: ":name", name: "Lemari Arsip" },
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Lemari Arsip");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<SalesOrderItemLinkModel placeholder="Pilih item SO..." />);
    expect(screen.getByPlaceholderText("Pilih item SO...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<SalesOrderItemLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<SalesOrderItemLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model SalesOrderItem", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<SalesOrderItemLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kursi");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            model: "App\\Models\\Sales\\SalesOrderItem",
            search: "Kursi",
          }),
        );
      });
    });
  });

  it("disabledAddButton=true -- tidak ada CommandItem tambah selain opsi hasil pencarian", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<SalesOrderItemLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<SalesOrderItemLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kursi");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Kursi" }),
        );
      });
    });

    const option = await screen.findByRole("option", { name: "Kursi Kantor" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it("opsi dengan thisModel model lain (bukan SalesOrderItem) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":item",
            item: { item_id: 1, templateLink: ":name", name: "Salah Model" },
            thisModel: "App\\Models\\Sales\\SalesOrder",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<SalesOrderItemLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Salah");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Salah" }),
        );
      });
    });

    const option = await screen.findByRole("option", { name: "Salah Model" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default SalesOrderItem", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<SalesOrderItemLinkModel model="AppModelsOverride" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "x");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "AppModelsOverride" }),
        );
      });
    });
  });
});
