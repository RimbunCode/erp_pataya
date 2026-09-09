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

// LinkModel.jsx (dipakai NumberCardLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring NumberCardLinkModel --
// mock jadi stub kosong sama seperti LinkModel.rtl.test.jsx &
// ChartLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli NumberCard (resources/js/Pages/Settings/NumberCard/Form.jsx)
// meng-import banyak dependency berat (FilterTable2, PermissionLinkModel,
// dst). FormPageDialog di atas sudah di-mock null sehingga prop `form` TIDAK
// PERNAH benar-benar dirender, tapi modulnya tetap ikut ter-load lewat
// static import NumberCardLinkModel.jsx kalau tidak di-mock di sini juga.
vi.mock("@/Pages/Settings/NumberCard/Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import NumberCardLinkModel from "./NumberCardLinkModel";
import { TooltipProvider } from "./ui/tooltip";

// Sama seperti ChartLinkModel.rtl.test.jsx: LinkModel membungkus dirinya
// dengan <Tooltip> internal tanpa menyediakan <TooltipProvider> sendiri, dan
// menembak axios.post di useEffect saat mount tanpa di-await -- bungkus
// render() ITU SENDIRI dalam `await act(async () => {})` supaya microtask
// stabil dulu. delayDuration=0 supaya Radix TooltipProvider tidak memakai
// setTimeout asli (700ms) yang tidak terkontrol test.
//
// QueryClientProvider WAJIB sejak migrasi ke TanStack Query (opsi L, lihat
// spec linkmodel-fetch-optimization) -- useLinkModelOptions memanggil
// useQuery() TANPA syarat, jadi setiap render LinkModel butuh provider ini
// atau langsung error "No QueryClient set". QueryClient BARU per render()
// (bukan module-level) supaya cache TIDAK bocor lintas test (dua `it()` yang
// mount model sama akan punya queryKey sama).
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

describe("NumberCardLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":label",
            label: "Total Penjualan",
            // FQCN Laravel asli App\Models\Core\NumberCard
            // (app/Models/Core/NumberCard.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // NumberCardLinkModel.jsx sendiri (baris 16) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Core\\NumberCard",
          },
          {
            id: 2,
            templateLink: ":label",
            label: "Total Stok",
            thisModel: "App\\Models\\Core\\NumberCard",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<NumberCardLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:label)", async () => {
    await render(
      <NumberCardLinkModel
        value={{ templateLink: ":label", label: "Total Aset" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Total Aset");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<NumberCardLinkModel placeholder="Pilih number card..." />);
    expect(
      screen.getByPlaceholderText("Pilih number card..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik NumberCardLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari NumberCardLinkModel -> LinkModel -> Input tidak diam-
    // diam berubah.
    const ref = { current: null };
    await render(<NumberCardLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<NumberCardLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model NumberCard & fields tambahan (icon/description/filters)", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<NumberCardLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Total");
    });

    // WAJIB pakai `waitFor` dari @testing-library/react, BUKAN `vi.waitFor`
    // -- assertion ini menunggu `debouncedSearch` (state internal
    // useLinkModelOptions) yang di-update lewat setTimeout ASLI (debounce
    // 500ms), di luar act() manapun yang eksplisit dibuat test ini.
    // `vi.waitFor` TIDAK act()-aware sehingga re-render dari timer itu tidak
    // pernah ke-flush selama polling. Lihat LinkModel.rtl.test.jsx.
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di NumberCardLinkModel.jsx baris 16
            // (model="App\Models\Core\NumberCard") memakai satu backslash --
            // berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi backslash-nya
            // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
            // app/Models/Core/NumberCard.php.
            model: "App\\Models\\Core\\NumberCard",
            search: "Total",
            fields: ["icon", "description", "filters"],
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("membuka dropdown menampilkan titleDialog (t('settings.number_card.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<NumberCardLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:settings.number_card.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<NumberCardLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Total");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale. WAJIB pakai `waitFor` dari @testing-library/react
    // (bukan `vi.waitFor`) -- assertion ini menunggu debounce 500ms
    // (setTimeout ASLI di luar act()), lihat LinkModel.rtl.test.jsx.
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Total" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", {
      name: "Total Penjualan",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, label: "Total Penjualan" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan NumberCard) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. NumberCardLinkModel mengunci model ke NumberCard, jadi
    // opsi yang (secara data cacat/salah) membawa thisModel model lain harus
    // ditolak secara silent (tanpa error) -- bukan celah keamanan karena
    // payload pencarian sendiri sudah scoped ke model NumberCard, tapi
    // defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":label",
            label: "Salah Model",
            thisModel: "App\\Models\\Core\\Chart",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<NumberCardLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Salah");
    });

    // WAJIB pakai `waitFor` dari @testing-library/react (bukan `vi.waitFor`)
    // -- assertion ini menunggu debounce 500ms (setTimeout ASLI di luar
    // act()), lihat LinkModel.rtl.test.jsx.
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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default NumberCard", async () => {
    // NumberCardLinkModel men-spread {...props} SETELAH prop tetap (model,
    // titleDialog, classNameDialog, form, fields) -- di JSX, atribut yang
    // ditulis belakangan menang. Jadi caller BISA menimpa `model` bawaan
    // NumberCard lewat prop tambahan. Bukan bug: konsekuensi urutan spread
    // yang perlu didokumentasikan lewat test supaya perilakunya tidak
    // berubah diam-diam saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<NumberCardLinkModel model="AppModelsOverride" />);

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
