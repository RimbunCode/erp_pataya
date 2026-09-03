import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai ItemVariantLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring ItemVariantLinkModel
// -- mock jadi stub kosong sama seperti AssetLocationLinkModel.rtl.test.jsx &
// NumberCardLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli Item (./Form.jsx, co-located -- form Item, dipakai
// ItemVariantLinkModel utk field "item" saat menambah variant baru dari
// dropdown) meng-import banyak dependency berat (FormPage, Mention,
// FormBarcodes, FormDetail, FormStockLevels, FormTable, MultiSelect,
// UnitLinkModel, AttributeLinkModel, dst) yang tidak relevan utk test wiring
// ItemVariantLinkModel ini. FormPageDialog di atas sudah di-mock null
// sehingga prop `form` TIDAK PERNAH benar-benar dirender, tapi modulnya
// tetap ikut ter-load lewat static import ItemVariantLinkModel.jsx kalau
// tidak di-mock di sini juga.
vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import ItemVariantLinkModel from "./ItemVariantLinkModel";
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

// templateLink asli App\Models\Inventory\ItemVariant::templateLink()
// (app/Models/Inventory/ItemVariant.php baris 99-101) --
// "<title>:code - :item_name</title><b>:code</b><br/><span>:item_name</span>".
// Beda dari AssetLocation/Currency (templateLink flat tanpa tag), varian ini
// pakai <title> terpisah dari markup <b>/<br/>/<span> -- convertTemplateLink
// (resources/js/lib/linkModelUtils.js) mengutamakan isi <title> utk NILAI
// TERPILIH (search==null, dipakai LinkModel.jsx saat set `search` dari
// option), tapi men-strip <title> dan menyisakan markup <b>/<span> utk
// RENDER OPSI DI DROPDOWN (search dikirim sbg string, sekalipun "").
const TEMPLATE_LINK =
  "<title>:code - :item_name</title><b>:code</b><br/><span>:item_name</span>";

describe("ItemVariantLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: TEMPLATE_LINK,
            code: "VAR-001",
            item_name: "Kaos Polos",
            // FQCN Laravel asli App\Models\Inventory\ItemVariant
            // (app/Models/Inventory/ItemVariant.php) -- literal string JS di
            // sini WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // ItemVariantLinkModel.jsx sendiri (baris 16) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Inventory\\ItemVariant",
          },
          {
            id: 2,
            templateLink: TEMPLATE_LINK,
            code: "VAR-002",
            item_name: "Kemeja Flanel",
            thisModel: "App\\Models\\Inventory\\ItemVariant",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<ItemVariantLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (isi <title>, bukan markup <b>/<span>)", async () => {
    await render(
      <ItemVariantLinkModel
        value={{
          templateLink: TEMPLATE_LINK,
          code: "VAR-003",
          item_name: "Celana Jeans",
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("VAR-003 - Celana Jeans");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<ItemVariantLinkModel placeholder="Pilih varian item..." />);
    expect(
      screen.getByPlaceholderText("Pilih varian item..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik ItemVariantLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari ItemVariantLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<ItemVariantLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<ItemVariantLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model ItemVariant", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<ItemVariantLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kaos");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di ItemVariantLinkModel.jsx baris 16
            // (model="App\Models\Inventory\ItemVariant") memakai satu
            // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
            // memproses escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Inventory/ItemVariant.php.
            model: "App\\Models\\Inventory\\ItemVariant",
            search: "Kaos",
          }),
        );
      });
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('inventory.item.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<ItemVariantLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:inventory.item.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<ItemVariantLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kaos");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Kaos" }),
        );
      });
    });

    // Nama aksesibel opsi dirender dari markup <b>:code</b><br/><span>
    // :item_name</span> (title sudah di-strip) -- pakai regex parsial
    // (bukan string persis) supaya test tidak bergantung pada apakah <br/>
    // menyumbang spasi ke concatenation nama aksesibel atau tidak.
    const option = await screen.findByRole("option", { name: /VAR-001/ });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        code: "VAR-001",
        item_name: "Kaos Polos",
      }),
    );
  });

  it("opsi dengan thisModel model lain (bukan ItemVariant) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. ItemVariantLinkModel mengunci model ke ItemVariant, jadi
    // opsi yang (secara data cacat/salah) membawa thisModel model lain harus
    // ditolak secara silent (tanpa error) saat diklik -- bukan celah
    // keamanan karena payload pencarian sendiri sudah scoped ke model
    // ItemVariant, tapi defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: TEMPLATE_LINK,
            code: "SALAH-001",
            item_name: "Salah Model",
            thisModel: "App\\Models\\Inventory\\Item",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<ItemVariantLinkModel onValueChange={onValueChange} />);

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

    const option = await screen.findByRole("option", { name: /SALAH-001/ });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default ItemVariant", async () => {
    // ItemVariantLinkModel men-spread {...props} SETELAH prop tetap (model,
    // titleDialog, classNameDialog, form, as) -- di JSX, atribut yang
    // ditulis belakangan menang. Jadi caller BISA menimpa `model` bawaan
    // ItemVariant lewat prop tambahan. Bukan bug: konsekuensi urutan spread
    // yang perlu didokumentasikan lewat test supaya perilakunya tidak
    // berubah diam-diam saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<ItemVariantLinkModel model="AppModelsOverride" />);

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
