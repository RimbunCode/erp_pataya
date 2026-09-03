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

import PurchaseReceiptLinkModel from "./PurchaseReceiptLinkModel";
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

describe("PurchaseReceiptLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":code",
            code: "PR-0001",
            thisModel: "App\\Models\\Purchase\\PurchaseReceipt",
          },
          {
            id: 2,
            templateLink: ":code",
            code: "PR-0002",
            thisModel: "App\\Models\\Purchase\\PurchaseReceipt",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<PurchaseReceiptLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:code)", async () => {
    await render(
      <PurchaseReceiptLinkModel
        value={{ templateLink: ":code", code: "PR-0099" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("PR-0099");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(
      <PurchaseReceiptLinkModel placeholder="Pilih penerimaan..." />,
    );
    expect(
      screen.getByPlaceholderText("Pilih penerimaan..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<PurchaseReceiptLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<PurchaseReceiptLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model PurchaseReceipt", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseReceiptLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "PR-0001");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            model: "App\\Models\\Purchase\\PurchaseReceipt",
            search: "PR-0001",
          }),
        );
      });
    });
  });

  it("disabledAddButton=true -- tidak ada CommandItem tambah selain opsi hasil pencarian", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseReceiptLinkModel />);

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
    await render(<PurchaseReceiptLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "PR-0001");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "PR-0001" }),
        );
      });
    });

    const option = await screen.findByRole("option", { name: "PR-0001" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "PR-0001" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan PurchaseReceipt) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":code",
            code: "SALAH",
            thisModel: "App\\Models\\Purchase\\PurchaseOrder",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PurchaseReceiptLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "SALAH");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "SALAH" }),
        );
      });
    });

    const option = await screen.findByRole("option", { name: "SALAH" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default PurchaseReceipt", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseReceiptLinkModel model="AppModelsOverride" />);

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
