import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai PurchaseOrderItemLinkModel di bawah tangan) SELALU
// meng-import FormPageDialog dari FormPage.jsx (import statis tak bersyarat
// di LinkModel.jsx, terlepas apakah wrapper ini sendiri memberi prop `form`
// atau tidak) -- mock jadi stub kosong spy default sama seperti pola LinkModel
// wrapper lain di codebase ini. File ini TIDAK punya prop `form`/co-located
// "./Form", jadi tidak perlu mock tambahan untuk itu.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import PurchaseOrderItemLinkModel from "./PurchaseOrderItemLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// QueryClientProvider WAJIB sejak migrasi ke TanStack Query -- useLinkModelOptions
// memanggil useQuery() TANPA syarat, LinkModel akan error "No QueryClient set" tanpa
// ini. QueryClient BARU per render() (bukan module-level) supaya cache TIDAK bocor
// lintas test (lihat LinkModel.rtl.test.jsx untuk penjelasan lengkap).
const render = async (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let result;
  await act(async () => {
    result = rtlRender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
      </QueryClientProvider>,
    );
  });
  return result;
};

// app/Models/Purchase/PurchaseOrderItem.php templateLink() = ':item' -- field
// `item` bernilai OBJECT bertemplateLink sendiri (relasi Item). convertTemplateLink
// (lib/linkModelUtils.js) mendeteksi ini (newValue.templateLink truthy) dan
// REKURSI ke convertTemplateLink(newValue) -- jadi mock data harus menyediakan
// value.item = { templateLink, ...field } bersarang, bukan value.item sbg string.
describe("PurchaseOrderItemLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":item",
            item: { templateLink: ":name", name: "Kursi Kantor" },
            thisModel: "App\\Models\\Purchase\\PurchaseOrderItem",
          },
          {
            id: 2,
            templateLink: ":item",
            item: { templateLink: ":name", name: "Meja Kantor" },
            thisModel: "App\\Models\\Purchase\\PurchaseOrderItem",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<PurchaseOrderItemLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:item rekursi ke item.templateLink)", async () => {
    await render(
      <PurchaseOrderItemLinkModel
        value={{
          templateLink: ":item",
          item: { templateLink: ":name", name: "Lemari Arsip" },
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Lemari Arsip");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<PurchaseOrderItemLinkModel placeholder="Pilih item PO..." />);
    expect(screen.getByPlaceholderText("Pilih item PO...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<PurchaseOrderItemLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<PurchaseOrderItemLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model PurchaseOrderItem", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseOrderItemLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kursi");
    });

    // WAJIB pakai `waitFor` dari @testing-library/react, BUKAN `vi.waitFor` --
    // assertion ini menunggu update `debouncedSearch` (setTimeout mentah 500ms
    // di useLinkModelOptions), di luar act() manapun. `vi.waitFor` tidak
    // act()-aware sehingga re-render dari timer itu tidak ke-flush selama
    // polling (lihat LinkModel.rtl.test.jsx untuk detail).
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({
          model: "App\\Models\\Purchase\\PurchaseOrderItem",
          search: "Kursi",
        }),
      );
    });
  });

  it("disabledAddButton=true -- tombol tambah tidak pernah muncul di dropdown", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseOrderItemLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    // Tidak ada CommandItem "tambah" apapun -- tapi CommandItem
    // "Advance Search" SELALU dirender terlepas dari disabledAdd, jadi 2
    // opsi hasil pencarian + 1.
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PurchaseOrderItemLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kursi");
    });

    // `waitFor` RTL, bukan `vi.waitFor` -- lihat catatan test sebelumnya.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Kursi" }),
      );
    });

    const option = await screen.findByRole("option", { name: "Kursi Kantor" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it("opsi dengan thisModel model lain (bukan PurchaseOrderItem) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":item",
            item: { templateLink: ":name", name: "Salah Model" },
            thisModel: "App\\Models\\Purchase\\PurchaseOrder",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PurchaseOrderItemLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Salah");
    });

    // `waitFor` RTL, bukan `vi.waitFor` -- lihat catatan test sebelumnya.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Salah" }),
      );
    });

    const option = await screen.findByRole("option", { name: "Salah Model" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default PurchaseOrderItem", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseOrderItemLinkModel model="AppModelsOverride" />);

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
