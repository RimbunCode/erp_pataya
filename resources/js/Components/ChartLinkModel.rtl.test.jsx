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

// LinkModel.jsx (dipakai ChartLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring ChartLinkModel --
// mock jadi stub kosong sama seperti LinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli Chart (resources/js/Pages/Settings/Chart/Form.jsx) meng-import
// banyak dependency berat (TiptapEditor, FilterTable2, PermissionLinkModel,
// FormTable, dst). FormPageDialog di atas sudah di-mock null sehingga prop
// `form` TIDAK PERNAH benar-benar dirender, tapi modulnya tetap ikut ter-load
// lewat static import ChartLinkModel.jsx kalau tidak di-mock di sini juga.
vi.mock("@/Pages/Settings/Chart/Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import ChartLinkModel from "./ChartLinkModel";
import { TooltipProvider } from "./ui/tooltip";

// Sama seperti LinkModel.rtl.test.jsx: LinkModel membungkus dirinya dengan
// <Tooltip> internal tanpa menyediakan <TooltipProvider> sendiri, dan
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

describe("ChartLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":chart_name",
            chart_name: "Grafik Penjualan",
            // FQCN Laravel asli App\Models\Core\Chart (app/Models/Core/Chart.php)
            // -- literal string JS di sini WAJIB double-backslash supaya
            // menghasilkan satu backslash sungguhan per separator, dibanding
            // literal atribut JSX di ChartLinkModel.jsx sendiri (baris 16)
            // yang cukup satu backslash karena string literal JSX TIDAK
            // memproses escape sequence ala JS biasa (beda dari file .js
            // biasa) -- keduanya berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Core\\Chart",
          },
          {
            id: 2,
            templateLink: ":chart_name",
            chart_name: "Grafik Stok",
            thisModel: "App\\Models\\Core\\Chart",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<ChartLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:chart_name)", async () => {
    await render(
      <ChartLinkModel
        value={{ templateLink: ":chart_name", chart_name: "Grafik Aset" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Grafik Aset");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<ChartLinkModel placeholder="Pilih chart..." />);
    expect(screen.getByPlaceholderText("Pilih chart...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik ChartLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari ChartLinkModel -> LinkModel -> Input tidak diam-diam
    // berubah.
    const ref = { current: null };
    await render(<ChartLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<ChartLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Chart & fields tambahan (icon/description/filters)", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<ChartLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Grafik");
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
            // Literal atribut JSX di ChartLinkModel.jsx baris 16
            // (model="App\Models\Core\Chart") memakai satu backslash --
            // berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi backslash-nya
            // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
            // app/Models/Core/Chart.php.
            model: "App\\Models\\Core\\Chart",
            search: "Grafik",
            fields: ["icon", "description", "filters"],
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("membuka dropdown menampilkan titleDialog (t('settings.chart.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<ChartLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:settings.chart.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<ChartLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Graf");
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
          expect.objectContaining({ search: "Graf" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", {
      name: "Grafik Penjualan",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, chart_name: "Grafik Penjualan" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Chart) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. ChartLinkModel mengunci model ke Chart, jadi opsi yang
    // (secara data cacat/salah) membawa thisModel model lain harus ditolak
    // secara silent (tanpa error) -- bukan celah keamanan karena payload
    // pencarian sendiri sudah scoped ke model Chart, tapi defense-in-depth
    // ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":chart_name",
            chart_name: "Grafik Salah Model",
            thisModel: "App\\Models\\Core\\NumberCard",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<ChartLinkModel onValueChange={onValueChange} />);

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
      name: "Grafik Salah Model",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Chart", async () => {
    // ChartLinkModel men-spread {...props} SETELAH prop tetap (model,
    // titleDialog, classNameDialog, form, fields) -- di JSX, atribut yang
    // ditulis belakangan menang. Jadi caller BISA menimpa `model` bawaan
    // Chart lewat prop tambahan. Bukan bug: konsekuensi urutan spread yang
    // perlu didokumentasikan lewat test supaya perilakunya tidak berubah
    // diam-diam saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<ChartLinkModel model="AppModelsOverride" />);

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
