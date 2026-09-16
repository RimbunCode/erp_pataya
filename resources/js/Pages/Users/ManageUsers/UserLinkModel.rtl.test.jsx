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

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import UserLinkModel from "./UserLinkModel";
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

describe("UserLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "Budi Santoso",
            thisModel: "App\\Models\\User\\User",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "Ani Wijaya",
            thisModel: "App\\Models\\User\\User",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<UserLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <UserLinkModel value={{ templateLink: ":name", name: "Dian Permata" }} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Dian Permata");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<UserLinkModel placeholder="Pilih user..." />);
    expect(screen.getByPlaceholderText("Pilih user...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<UserLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<UserLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model User", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<UserLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Budi");
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
          model: "App\\Models\\User\\User",
          search: "Budi",
        }),
      );
    });
  });

  it("TIDAK ada prop form/disabledAddButton eksplisit, TAPI tombol tambah tetap tidak pernah muncul (LinkModel.jsx: disabledAdd true selama `form` kosong)", async () => {
    // UserLinkModel.jsx TIDAK memberi disabledAddButton maupun form -- tapi
    // Components/LinkModel.jsx menghitung disabledAdd = true begitu `!form`,
    // TERLEPAS dari disabledAddButton. Jadi tombol tambah tetap tak pernah
    // muncul, sama seperti wrapper lain yg eksplisit disabledAddButton=true.
    const user = userEvent.setup({ delay: null });
    await render(<UserLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    // CommandItem "Advance Search" SELALU dirender terlepas dari disabledAdd,
    // jadi jumlah option = jumlah data mock + 1.
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<UserLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Budi");
    });

    // `waitFor` RTL, bukan `vi.waitFor` -- lihat catatan test sebelumnya.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Budi" }),
      );
    });

    const option = await screen.findByRole("option", { name: "Budi Santoso" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Budi Santoso" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan User) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\User\\Assignable",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<UserLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default User", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<UserLinkModel model="AppModelsOverride" />);

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
