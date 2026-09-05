import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai PaymentMethodLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring PaymentMethodLinkModel
// -- mock jadi stub kosong sama seperti AssetLocationLinkModel.rtl.test.jsx &
// NumberCardLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli PaymentMethod (./Form.jsx, co-located) meng-import
// AccountLinkModel, FormInput, dst yang tidak relevan utk test wiring
// PaymentMethodLinkModel ini. FormPageDialog di atas sudah di-mock null
// sehingga prop `form` TIDAK PERNAH benar-benar dirender, tapi modulnya
// tetap ikut ter-load lewat static import PaymentMethodLinkModel.jsx kalau
// tidak di-mock di sini juga.
vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import PaymentMethodLinkModel from "./PaymentMethodLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti AssetLocationLinkModel.rtl.test.jsx & NumberCardLinkModel.rtl.test.jsx:
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

describe("PaymentMethodLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "Transfer Bank",
            // FQCN Laravel asli App\Models\Finances\PaymentMethod
            // (app/Models/Finances/PaymentMethod.php) -- literal string JS
            // di sini WAJIB double-backslash supaya menghasilkan satu
            // backslash sungguhan per separator, dibanding literal atribut
            // JSX di PaymentMethodLinkModel.jsx sendiri (baris 16) yang
            // cukup satu backslash karena string literal JSX TIDAK
            // memproses escape sequence ala JS biasa (beda dari file .js
            // biasa) -- keduanya berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Finances\\PaymentMethod",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "Tunai",
            thisModel: "App\\Models\\Finances\\PaymentMethod",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<PaymentMethodLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <PaymentMethodLinkModel
        value={{ templateLink: ":name", name: "Kartu Kredit" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Kartu Kredit");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(
      <PaymentMethodLinkModel placeholder="Pilih metode pembayaran..." />,
    );
    expect(
      screen.getByPlaceholderText("Pilih metode pembayaran..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik PaymentMethodLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari PaymentMethodLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<PaymentMethodLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<PaymentMethodLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model PaymentMethod", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PaymentMethodLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Transfer");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di PaymentMethodLinkModel.jsx baris 16
            // (model="App\Models\Finances\PaymentMethod") memakai satu
            // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
            // memproses escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Finances/PaymentMethod.php.
            model: "App\\Models\\Finances\\PaymentMethod",
            search: "Transfer",
          }),
        );
      });
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('finances.paymentMethod.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PaymentMethodLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:finances.paymentMethod.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PaymentMethodLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Transfer");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Transfer" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "Transfer Bank",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Transfer Bank" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan PaymentMethod) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. PaymentMethodLinkModel mengunci model ke PaymentMethod,
    // jadi opsi yang (secara data cacat/salah) membawa thisModel model lain
    // harus ditolak secara silent (tanpa error) -- bukan celah keamanan
    // karena payload pencarian sendiri sudah scoped ke model PaymentMethod,
    // tapi defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\Finances\\Account",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PaymentMethodLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default PaymentMethod", async () => {
    // PaymentMethodLinkModel men-spread {...props} SETELAH prop tetap
    // (model, titleDialog, classNameDialog, form) -- di JSX, atribut yang
    // ditulis belakangan menang. Jadi caller BISA menimpa `model` bawaan
    // PaymentMethod lewat prop tambahan. Bukan bug: konsekuensi urutan
    // spread yang perlu didokumentasikan lewat test supaya perilakunya
    // tidak berubah diam-diam saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<PaymentMethodLinkModel model="AppModelsOverride" />);

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
