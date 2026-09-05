import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai AssetServiceLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring AssetServiceLinkModel
// -- mock jadi stub kosong sama seperti LinkModel.rtl.test.jsx,
// NumberCardLinkModel.rtl.test.jsx & ChartLinkModel.rtl.test.jsx. Tidak perlu
// mock modul Form terpisah di sini karena AssetServiceLinkModel.jsx sendiri
// TIDAK mengirim prop `form` ke LinkModel (beda dari NumberCardLinkModel/
// ChartLinkModel).
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import AssetServiceLinkModel from "./AssetServiceLinkModel";
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

describe("AssetServiceLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":code",
            // templateLink asli App\Models\Asset\AssetService::templateLink()
            // (app/Models/Asset/AssetService.php) adalah ":code".
            code: "AS-0001",
            // FQCN Laravel asli App\Models\Asset\AssetService
            // (app/Models/Asset/AssetService.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // AssetServiceLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Asset\\AssetService",
          },
          {
            id: 2,
            templateLink: ":code",
            code: "AS-0002",
            thisModel: "App\\Models\\Asset\\AssetService",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<AssetServiceLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:code)", async () => {
    await render(
      <AssetServiceLinkModel
        value={{ templateLink: ":code", code: "AS-0099" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("AS-0099");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<AssetServiceLinkModel placeholder="Pilih servis..." />);
    expect(screen.getByPlaceholderText("Pilih servis...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik AssetServiceLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari AssetServiceLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<AssetServiceLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<AssetServiceLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model AssetService & filters default (status approved)", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssetServiceLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "AS-000");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di AssetServiceLinkModel.jsx baris 13
            // (model="App\Models\Asset\AssetService") memakai satu backslash
            // -- berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi backslash-nya
            // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
            // app/Models/Asset/AssetService.php.
            model: "App\\Models\\Asset\\AssetService",
            search: "AS-000",
            // filters tetap (baris 15 file target) hanya meloloskan
            // AssetService yang statusnya sudah approved -- default ini
            // WAJIB ikut terkirim di setiap request, bukan cuma saat caller
            // mengisi prop filters sendiri.
            filters: { status: { jsonContains: ["approved"] } },
          }),
        );
      });
    });
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssetServiceLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "AS-000");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "AS-000" }),
        );
      });
    });

    const option = await screen.findByRole("option", { name: "AS-0001" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "AS-0001" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan AssetService) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. AssetServiceLinkModel mengunci model ke AssetService,
    // jadi opsi yang (secara data cacat/salah) membawa thisModel model lain
    // harus ditolak secara silent (tanpa error) -- bukan celah keamanan
    // karena payload pencarian sendiri sudah scoped ke model AssetService,
    // tapi defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":code",
            code: "Salah Model",
            thisModel: "App\\Models\\Asset\\Asset",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssetServiceLinkModel onValueChange={onValueChange} />);

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

    const option = await screen.findByRole("option", { name: "Salah Model" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default AssetService", async () => {
    // AssetServiceLinkModel men-spread {...props} SETELAH prop tetap (model,
    // disabledAddButton, filters) -- di JSX, atribut yang ditulis belakangan
    // menang. Jadi caller BISA menimpa `model` bawaan AssetService lewat prop
    // tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<AssetServiceLinkModel model="AppModelsOverride" />);

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
