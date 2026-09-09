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

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import SupplierLinkModel from "./SupplierLinkModel";
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

describe("SupplierLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "PT Sumber Makmur",
            thisModel: "App\\Models\\Purchase\\Supplier",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "CV Jaya Abadi",
            thisModel: "App\\Models\\Purchase\\Supplier",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<SupplierLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <SupplierLinkModel
        value={{ templateLink: ":name", name: "PT Sejahtera" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("PT Sejahtera");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<SupplierLinkModel placeholder="Pilih supplier..." />);
    expect(
      screen.getByPlaceholderText("Pilih supplier..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<SupplierLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<SupplierLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Supplier", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<SupplierLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Sumber");
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
          model: "App\\Models\\Purchase\\Supplier",
          search: "Sumber",
        }),
      );
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('purchase.supplier.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<SupplierLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:purchase.supplier.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<SupplierLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Sumber");
    });

    // `waitFor` RTL, bukan `vi.waitFor` -- lihat catatan test sebelumnya.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Sumber" }),
      );
    });

    const option = await screen.findByRole("option", {
      name: "PT Sumber Makmur",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "PT Sumber Makmur" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Supplier) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\Sales\\Customer",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<SupplierLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Supplier", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<SupplierLinkModel model="AppModelsOverride" />);

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
