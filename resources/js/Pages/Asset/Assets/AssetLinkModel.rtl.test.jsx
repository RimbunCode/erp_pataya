import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai AssetLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring AssetLinkModel --
// mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// ChartLinkModel.rtl.test.jsx. AssetLinkModel sendiri TIDAK mengirim prop
// `form`, jadi disabledAdd selalu true (lihat LinkModel.jsx: `!form` ->
// true) dan FormPageDialog tidak pernah benar-benar dirender -- tapi
// modulnya tetap ikut ter-load lewat static import LinkModel.jsx kalau
// tidak di-mock di sini juga, jadi mock ini tetap wajib.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import AssetLinkModel from "./AssetLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & ChartLinkModel.rtl.test.jsx:
// LinkModel membungkus dirinya dengan <Tooltip> internal tanpa menyediakan
// <TooltipProvider> sendiri, dan menembak axios.post di useEffect saat mount
// tanpa di-await -- bungkus render() ITU SENDIRI dalam `await act(async () =>
// {})` supaya microtask stabil dulu. delayDuration=0 supaya Radix
// TooltipProvider tidak memakai setTimeout asli (700ms) yang tidak
// terkontrol test.
const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

describe("AssetLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":asset_name",
            asset_name: "Laptop Dell Latitude",
            // FQCN Laravel asli App\Models\Asset\Asset
            // (app/Models/Asset/Asset.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // AssetLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Asset\\Asset",
          },
          {
            id: 2,
            templateLink: ":asset_name",
            asset_name: "Printer HP LaserJet",
            thisModel: "App\\Models\\Asset\\Asset",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<AssetLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:asset_name)", async () => {
    await render(
      <AssetLinkModel
        value={{ templateLink: ":asset_name", asset_name: "Forklift Toyota" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Forklift Toyota");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<AssetLinkModel placeholder="Pilih aset..." />);
    expect(screen.getByPlaceholderText("Pilih aset...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik AssetLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari AssetLinkModel -> LinkModel -> Input tidak diam-diam
    // berubah.
    const ref = { current: null };
    await render(<AssetLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<AssetLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Asset & search yg benar", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssetLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Laptop");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di AssetLinkModel.jsx baris 13
            // (model="App\Models\Asset\Asset") memakai satu backslash --
            // berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi backslash-nya
            // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
            // app/Models/Asset/Asset.php.
            model: "App\\Models\\Asset\\Asset",
            search: "Laptop",
          }),
        );
      });
    });
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssetLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Laptop");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Laptop" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "Laptop Dell Latitude",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, asset_name: "Laptop Dell Latitude" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Asset) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. AssetLinkModel mengunci model ke Asset, jadi opsi yang
    // (secara data cacat/salah) membawa thisModel model lain harus ditolak
    // secara silent (tanpa error) -- bukan celah keamanan karena payload
    // pencarian sendiri sudah scoped ke model Asset, tapi defense-in-depth
    // ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":asset_name",
            asset_name: "Salah Model",
            thisModel: "App\\Models\\Inventory\\Item",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssetLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Salah");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Salah" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "Salah Model",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Asset", async () => {
    // AssetLinkModel men-spread {...props} SETELAH prop tetap (model) --
    // di JSX, atribut yang ditulis belakangan menang. Jadi caller BISA
    // menimpa `model` bawaan Asset lewat prop tambahan. Bukan bug:
    // konsekuensi urutan spread yang perlu didokumentasikan lewat test
    // supaya perilakunya tidak berubah diam-diam saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<AssetLinkModel model="AppModelsOverride" />);

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
