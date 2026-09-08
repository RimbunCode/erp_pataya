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

import PurchaseInvoiceItemLinkModel from "./PurchaseInvoiceItemLinkModel";
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

describe("PurchaseInvoiceItemLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":quantity",
            quantity: 2,
            thisModel: "App\\Models\\Finances\\PurchaseInvoiceItem",
          },
        ],
        total: 1,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<PurchaseInvoiceItemLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("mengetik memicu request axios dengan model PurchaseInvoiceItem yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseInvoiceItemLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Laptop");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            model: "App\\Models\\Finances\\PurchaseInvoiceItem",
            search: "Laptop",
          }),
        );
      });
    });
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PurchaseInvoiceItemLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "2");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "2" }),
        );
      });
    });

    const option = await screen.findByRole("option", { name: "2" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, quantity: 2 }),
    );
  });
});
