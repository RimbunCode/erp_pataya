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

// LinkModel.jsx (dipakai AssetLocationLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring AssetLocationLinkModel
// -- mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// ChartLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli AssetLocation (./Form.jsx, co-located) meng-import
// AssetLocationLinkModel KEMBALI (dipakai utk field "parent" -- lokasi bisa
// jadi parent dari lokasi lain) -- import siklik apabila modul asli
// benar-benar dievaluasi, plus Form.jsx juga menarik BranchLinkModel,
// FormCheckbox, FormInput, dst yang tidak relevan utk test wiring
// AssetLocationLinkModel ini. FormPageDialog di atas sudah di-mock null
// sehingga prop `form` TIDAK PERNAH benar-benar dirender, tapi modulnya
// tetap ikut ter-load lewat static import AssetLocationLinkModel.jsx kalau
// tidak di-mock di sini juga.
vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import AssetLocationLinkModel from "./AssetLocationLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & ChartLinkModel.rtl.test.jsx:
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

describe("AssetLocationLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":location_name",
            location_name: "Gudang Utama",
            // FQCN Laravel asli App\Models\Asset\AssetLocation
            // (app/Models/Asset/AssetLocation.php) -- literal string JS di
            // sini WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // AssetLocationLinkModel.jsx sendiri (baris 16) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Asset\\AssetLocation",
          },
          {
            id: 2,
            templateLink: ":location_name",
            location_name: "Gudang Cabang",
            thisModel: "App\\Models\\Asset\\AssetLocation",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<AssetLocationLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:location_name)", async () => {
    await render(
      <AssetLocationLinkModel
        value={{ templateLink: ":location_name", location_name: "Gudang B" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Gudang B");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<AssetLocationLinkModel placeholder="Pilih lokasi..." />);
    expect(screen.getByPlaceholderText("Pilih lokasi...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik AssetLocationLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari AssetLocationLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<AssetLocationLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<AssetLocationLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model AssetLocation", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssetLocationLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Gudang");
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
            // Literal atribut JSX di AssetLocationLinkModel.jsx baris 16
            // (model="App\Models\Asset\AssetLocation") memakai satu
            // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
            // memproses escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Asset/AssetLocation.php.
            model: "App\\Models\\Asset\\AssetLocation",
            search: "Gudang",
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("membuka dropdown menampilkan titleDialog (t('asset.location.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssetLocationLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:asset.location.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssetLocationLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Gudang");
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
          expect.objectContaining({ search: "Gudang" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", {
      name: "Gudang Utama",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, location_name: "Gudang Utama" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan AssetLocation) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. AssetLocationLinkModel mengunci model ke AssetLocation,
    // jadi opsi yang (secara data cacat/salah) membawa thisModel model lain
    // harus ditolak secara silent (tanpa error) -- bukan celah keamanan
    // karena payload pencarian sendiri sudah scoped ke model AssetLocation,
    // tapi defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":location_name",
            location_name: "Salah Model",
            thisModel: "App\\Models\\Core\\Branch",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssetLocationLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default AssetLocation", async () => {
    // AssetLocationLinkModel men-spread {...props} SETELAH prop tetap
    // (model, titleDialog, form) -- di JSX, atribut yang ditulis belakangan
    // menang. Jadi caller BISA menimpa `model` bawaan AssetLocation lewat
    // prop tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<AssetLocationLinkModel model="AppModelsOverride" />);

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
