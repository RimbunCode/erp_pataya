import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai PurchaseInvoiceLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring PurchaseInvoiceLinkModel
// -- mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// AssetLocationLinkModel.rtl.test.jsx. PurchaseInvoiceLinkModel.jsx sendiri
// TIDAK mengirim prop `form`, jadi tidak perlu mock modul Form terpisah --
// beda dari NumberCardLinkModel/AssetLocationLinkModel yang men-supply form.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import PurchaseInvoiceLinkModel from "./PurchaseInvoiceLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & AssetLocationLinkModel.rtl.test.jsx:
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

describe("PurchaseInvoiceLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":code",
            code: "PurchaseINV-0001/26",
            // FQCN Laravel asli App\Models\Finances\PurchaseInvoice
            // (app/Models/Finances/PurchaseInvoice.php) -- literal string JS
            // di sini WAJIB double-backslash supaya menghasilkan satu
            // backslash sungguhan per separator, dibanding literal atribut
            // JSX di PurchaseInvoiceLinkModel.jsx sendiri (baris 13) yang
            // cukup satu backslash karena string literal JSX TIDAK
            // memproses escape sequence ala JS biasa (beda dari file .js
            // biasa) -- keduanya berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Finances\\PurchaseInvoice",
          },
          {
            id: 2,
            templateLink: ":code",
            code: "PurchaseINV-0002/26",
            thisModel: "App\\Models\\Finances\\PurchaseInvoice",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<PurchaseInvoiceLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:code)", async () => {
    await render(
      <PurchaseInvoiceLinkModel
        value={{ templateLink: ":code", code: "PurchaseINV-0009/26" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("PurchaseINV-0009/26");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(
      <PurchaseInvoiceLinkModel placeholder="Pilih faktur pembelian..." />,
    );
    expect(
      screen.getByPlaceholderText("Pilih faktur pembelian..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik PurchaseInvoiceLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari PurchaseInvoiceLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<PurchaseInvoiceLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<PurchaseInvoiceLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model PurchaseInvoice", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseInvoiceLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "PurchaseINV");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di PurchaseInvoiceLinkModel.jsx baris 13
            // (model="App\Models\Finances\PurchaseInvoice") memakai satu
            // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
            // memproses escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Finances/PurchaseInvoice.php.
            model: "App\\Models\\Finances\\PurchaseInvoice",
            search: "PurchaseINV",
          }),
        );
      });
    });
  });

  it("disabledAddButton=true (baris 14) menyembunyikan CommandItem tambah item baru dari dropdown", async () => {
    // LinkModel.jsx: disabledAdd = true ketika disabledAddButton truthy,
    // TERLEPAS dari form/can("create") -- CommandItem "tambah" (PlusIcon +
    // titleDialog) dan FormPageDialog jadi tidak pernah dirender.
    // PurchaseInvoiceLinkModel mengunci disabledAddButton={true} secara
    // permanen (bukan diteruskan dari props), jadi dropdown HANYA berisi
    // hasil pencarian -- tidak ada option tambahan.
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseInvoiceLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "PurchaseINV");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "PurchaseINV" }),
        );
      });
    });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PurchaseInvoiceLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "PurchaseINV");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "PurchaseINV" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "PurchaseINV-0001/26",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "PurchaseINV-0001/26" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan PurchaseInvoice) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. PurchaseInvoiceLinkModel mengunci model ke
    // PurchaseInvoice, jadi opsi yang (secara data cacat/salah) membawa
    // thisModel model lain harus ditolak secara silent (tanpa error) --
    // bukan celah keamanan karena payload pencarian sendiri sudah scoped ke
    // model PurchaseInvoice, tapi defense-in-depth ini tetap perlu dikunci
    // lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":code",
            code: "Salah Model",
            thisModel: "App\\Models\\Finances\\PurchaseOrder",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PurchaseInvoiceLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default PurchaseInvoice", async () => {
    // PurchaseInvoiceLinkModel men-spread {...props} SETELAH prop tetap
    // (model, disabledAddButton) -- di JSX, atribut yang ditulis belakangan
    // menang. Jadi caller BISA menimpa `model` bawaan PurchaseInvoice lewat
    // prop tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<PurchaseInvoiceLinkModel model="AppModelsOverride" />);

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
