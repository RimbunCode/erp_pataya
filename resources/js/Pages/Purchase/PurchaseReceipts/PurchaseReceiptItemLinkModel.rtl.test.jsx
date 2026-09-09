import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// Sama seperti AssetLinkModel.rtl.test.jsx: LinkModel.jsx menarik
// FormPageDialog (dan dependency berat lainnya) yang tidak relevan untuk
// test wiring wrapper ini -- mock jadi stub kosong.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import PurchaseReceiptItemLinkModel from "./PurchaseReceiptItemLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// QueryClientProvider wajib sejak LinkModel migrasi ke TanStack Query --
// useLinkModelOptions memanggil useQuery() tanpa syarat. QueryClient baru
// per render() (bukan module-level) supaya cache tidak bocor lintas test.
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

describe("PurchaseReceiptItemLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":quantity",
            quantity: 2,
            thisModel: "App\\Models\\Purchase\\PurchaseReceiptItem",
          },
        ],
        total: 1,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<PurchaseReceiptItemLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("mengetik memicu request axios dengan model PurchaseReceiptItem yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseReceiptItemLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Laptop");
    });

    // WAJIB pakai `waitFor` dari @testing-library/react, BUKAN `vi.waitFor` --
    // assertion ini menunggu update debouncedSearch (setTimeout mentah di
    // useLinkModelOptions) di luar act() manapun. `vi.waitFor` tidak
    // act()-aware sehingga re-render dari timer itu tidak ke-flush.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({
          model: "App\\Models\\Purchase\\PurchaseReceiptItem",
          search: "Laptop",
        }),
      );
    });
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(
      <PurchaseReceiptItemLinkModel onValueChange={onValueChange} />,
    );

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "2");
    });

    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "2" }),
      );
    });

    const option = await screen.findByRole("option", { name: "2" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, quantity: 2 }),
    );
  });

  it("filters prop diteruskan ke request pencarian", async () => {
    const user = userEvent.setup({ delay: null });
    await render(
      <PurchaseReceiptItemLinkModel filters={{ item_id: { in: ["v1"] } }} />,
    );

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "x");
    });

    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({
          filters: { item_id: { in: ["v1"] } },
        }),
      );
    });
  });
});
