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

// LinkModel.jsx (dipakai CategoryLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring CategoryLinkModel --
// mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// AssetLocationLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli Category (./Form.jsx, co-located) meng-import FormPageContent,
// FormInput, Select, dan UnitLinkModel -- dependency berat yang tidak relevan
// utk test wiring CategoryLinkModel ini. FormPageDialog di atas sudah
// di-mock null sehingga prop `form` TIDAK PERNAH benar-benar dirender, tapi
// modulnya tetap ikut ter-load lewat static import CategoryLinkModel.jsx
// kalau tidak di-mock di sini juga.
vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import CategoryLinkModel from "./CategoryLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & AssetLocationLinkModel.rtl.test.jsx:
// LinkModel membungkus dirinya dengan <Tooltip> internal tanpa menyediakan
// <TooltipProvider> sendiri, dan menembak axios.post di useEffect saat mount
// tanpa di-await -- bungkus render() ITU SENDIRI dalam `await act(async () =>
// {})` supaya microtask stabil dulu. delayDuration=0 supaya Radix
// TooltipProvider tidak memakai setTimeout asli (700ms) yang tidak
// terkontrol test.
//
// QueryClientProvider WAJIB sejak migrasi ke TanStack Query (opsi L, lihat
// spec linkmodel-fetch-optimization) -- useLinkModelOptions memanggil
// useQuery() TANPA syarat, jadi setiap render LinkModel butuh provider ini
// atau langsung error "No QueryClient set". QueryClient BARU per render()
// (bukan module-level) -- gcTime: Infinity + retry: false -- supaya cache
// TIDAK bocor lintas test (`it()` yang mount model sama akan punya queryKey
// sama; kalau clientnya sama, test kedua bisa diam-diam serve dari cache
// test pertama alih-alih benar-benar fetch).
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

describe("CategoryLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "Elektronik",
            // FQCN Laravel asli App\Models\Inventory\Category
            // (app/Models/Inventory/Category.php) -- literal string JS di
            // sini WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // CategoryLinkModel.jsx sendiri (baris 16) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Inventory\\Category",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "Furnitur",
            thisModel: "App\\Models\\Inventory\\Category",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<CategoryLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <CategoryLinkModel
        value={{ templateLink: ":name", name: "Kendaraan" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Kendaraan");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<CategoryLinkModel placeholder="Pilih kategori..." />);
    expect(
      screen.getByPlaceholderText("Pilih kategori..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik CategoryLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari CategoryLinkModel -> LinkModel -> Input tidak diam-
    // diam berubah.
    const ref = { current: null };
    await render(<CategoryLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<CategoryLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Category", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<CategoryLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Elektro");
    });

    // WAJIB pakai `waitFor` dari @testing-library/react, BUKAN `vi.waitFor`
    // -- assertion ini menunggu debounce 500ms (setTimeout mentah di
    // useLinkModelOptions), yang berjalan di luar act() manapun yang bisa
    // dikontrol test. `vi.waitFor` tidak act()-aware sehingga re-render dari
    // timer itu tidak pernah ke-flush selama polling (lihat catatan lengkap
    // di LinkModel.rtl.test.jsx).
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di CategoryLinkModel.jsx baris 16
            // (model="App\Models\Inventory\Category") memakai satu
            // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
            // memproses escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Inventory/Category.php.
            model: "App\\Models\\Inventory\\Category",
            search: "Elektro",
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("membuka dropdown menampilkan titleDialog (t('inventory.category.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<CategoryLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:inventory.category.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CategoryLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Elektro");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale. `waitFor` RTL (bukan `vi.waitFor`) -- menunggu
    // debounce 500ms, lihat catatan di test sebelumnya.
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Elektro" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", {
      name: "Elektronik",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Elektronik" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Category) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. CategoryLinkModel mengunci model ke Category, jadi opsi
    // yang (secara data cacat/salah) membawa thisModel model lain harus
    // ditolak secara silent (tanpa error) -- bukan celah keamanan karena
    // payload pencarian sendiri sudah scoped ke model Category, tapi
    // defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\Inventory\\Unit",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CategoryLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Salah");
    });

    // `waitFor` RTL (bukan `vi.waitFor`) -- menunggu debounce 500ms, lihat
    // catatan di test "mengetik memicu request axios...".
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Salah" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", {
      name: "Salah Model",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Category", async () => {
    // CategoryLinkModel men-spread {...props} SETELAH prop tetap (model,
    // titleDialog, classNameDialog, form) -- di JSX, atribut yang ditulis
    // belakangan menang. Jadi caller BISA menimpa `model` bawaan Category
    // lewat prop tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<CategoryLinkModel model="AppModelsOverride" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "x");
    });

    // `waitFor` RTL (bukan `vi.waitFor`) -- menunggu debounce 500ms, lihat
    // catatan di test "mengetik memicu request axios...".
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "AppModelsOverride" }),
        );
      },
      { timeout: 3000 },
    );
  });
});
