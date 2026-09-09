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

import CustomerLinkModel from "./CustomerLinkModel";
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

describe("CustomerLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "PT Cahaya Abadi",
            thisModel: "App\\Models\\Sales\\Customer",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "CV Sinar Jaya",
            thisModel: "App\\Models\\Sales\\Customer",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<CustomerLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <CustomerLinkModel
        value={{ templateLink: ":name", name: "PT Makmur" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("PT Makmur");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<CustomerLinkModel placeholder="Pilih pelanggan..." />);
    expect(
      screen.getByPlaceholderText("Pilih pelanggan..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<CustomerLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<CustomerLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Customer", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<CustomerLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Cahaya");
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
          model: "App\\Models\\Sales\\Customer",
          search: "Cahaya",
        }),
      );
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('sales.customer.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<CustomerLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:sales.customer.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CustomerLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Cahaya");
    });

    // `waitFor` RTL, bukan `vi.waitFor` -- lihat catatan test sebelumnya.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Cahaya" }),
      );
    });

    const option = await screen.findByRole("option", {
      name: "PT Cahaya Abadi",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "PT Cahaya Abadi" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Customer) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\Purchase\\Supplier",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CustomerLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Customer", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<CustomerLinkModel model="AppModelsOverride" />);

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
