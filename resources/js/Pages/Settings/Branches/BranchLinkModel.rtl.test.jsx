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

import BranchLinkModel from "./BranchLinkModel";
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

// app/Models/Core/Branch.php templateLink() = ':name{:title}' -- sama pola
// dengan Warehouse: sintaks `{:title}` membuat convertTemplateLink lookup
// field `title` (accessor computed di Branch.php), BUKAN field `name`
// mentah -- bagian "name" sebelum kurung kurawal cuma dekoratif di string
// PHP, tidak pernah dibaca runtime FE. BUKAN bug (dikonfirmasi via baca
// lib/linkModelUtils.js convertTemplateLink()).
describe("BranchLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name{:title}",
            title: "Cabang Jakarta",
            is_main_branch: true,
            thisModel: "App\\Models\\Core\\Branch",
          },
          {
            id: 2,
            templateLink: ":name{:title}",
            title: "Cabang Surabaya",
            is_main_branch: false,
            thisModel: "App\\Models\\Core\\Branch",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<BranchLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (pakai field `title`, BUKAN `name` mentah)", async () => {
    await render(
      <BranchLinkModel
        value={{ templateLink: ":name{:title}", title: "Cabang Bandung" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Cabang Bandung");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<BranchLinkModel placeholder="Pilih cabang..." />);
    expect(screen.getByPlaceholderText("Pilih cabang...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<BranchLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<BranchLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Branch, order, dan translate tetap", async () => {
    // BranchLinkModel.jsx mengunci order="is_main_branch:desc" dan
    // translate={is_main_branch:{true: t("core.branch.main")}} -- keduanya
    // diteruskan apa adanya ke payload axios LinkModel non-cache
    // (Components/LinkModel.jsx getModels()).
    const user = userEvent.setup({ delay: null });
    await render(<BranchLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Jakarta");
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
          model: "App\\Models\\Core\\Branch",
          search: "Jakarta",
          order: "is_main_branch:desc",
          translate: { is_main_branch: { true: "TR:core.branch.main" } },
        }),
      );
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('core.branch.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<BranchLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(await screen.findByText("TR:core.branch.new")).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<BranchLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Jakarta");
    });

    // `waitFor` RTL, bukan `vi.waitFor` -- lihat catatan test sebelumnya.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Jakarta" }),
      );
    });

    const option = await screen.findByRole("option", {
      name: "Cabang Jakarta",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, title: "Cabang Jakarta" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Branch) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name{:title}",
            title: "Salah Model",
            thisModel: "App\\Models\\Purchase\\Supplier",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<BranchLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Branch", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<BranchLinkModel model="AppModelsOverride" />);

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
