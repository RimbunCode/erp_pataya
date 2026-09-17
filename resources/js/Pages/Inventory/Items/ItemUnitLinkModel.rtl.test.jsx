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

// LinkModel.jsx (dipakai ItemUnitLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring ItemUnitLinkModel --
// mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// AssetLocationLinkModel.rtl.test.jsx. Beda dari kedua referensi itu,
// ItemUnitLinkModel.jsx TIDAK mengirim prop `form` (baris `// form={<Form
// />}` sengaja di-comment) -- jadi tidak ada modul Form co-located yang perlu
// di-mock terpisah di sini.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import ItemUnitLinkModel from "./ItemUnitLinkModel";
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

describe("ItemUnitLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            // templateLink asli App\Models\Inventory\ItemUnit::templateLink()
            // (app/Models/Inventory/ItemUnit.php baris 68-70) -- ':name (:code)'.
            templateLink: ":name (:code)",
            name: "Kilogram",
            code: "KG",
            // FQCN Laravel asli App\Models\Inventory\ItemUnit
            // (app/Models/Inventory/ItemUnit.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // ItemUnitLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Inventory\\ItemUnit",
          },
          {
            id: 2,
            templateLink: ":name (:code)",
            name: "Gram",
            code: "GR",
            thisModel: "App\\Models\\Inventory\\ItemUnit",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<ItemUnitLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name (:code))", async () => {
    await render(
      <ItemUnitLinkModel
        value={{ templateLink: ":name (:code)", name: "Meter", code: "M" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Meter (M)");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<ItemUnitLinkModel placeholder="Pilih satuan..." />);
    expect(screen.getByPlaceholderText("Pilih satuan...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik ItemUnitLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari ItemUnitLinkModel -> LinkModel -> Input tidak diam-
    // diam berubah.
    const ref = { current: null };
    await render(<ItemUnitLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<ItemUnitLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model ItemUnit & with=['unit']", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<ItemUnitLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kilo");
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
            // Literal atribut JSX di ItemUnitLinkModel.jsx baris 13
            // (model="App\Models\Inventory\ItemUnit") memakai satu
            // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
            // memproses escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Inventory/ItemUnit.php.
            model: "App\\Models\\Inventory\\ItemUnit",
            search: "Kilo",
            // Baris 14 ItemUnitLinkModel.jsx: with={["unit"]} -- relasi
            // `unit` (belongsTo Unit) ikut dimuat server-side agar konsumen
            // form bisa membaca detail unit dasar dari opsi terpilih.
            with: ["unit"],
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("membuka dropdown TIDAK menampilkan tombol tambah (form tidak diset)", async () => {
    // ItemUnitLinkModel.jsx baris 15-16 sengaja meng-comment titleDialog &
    // form (`// titleDialog={...}`, `// form={<Form />}`). Di LinkModel.jsx,
    // disabledAdd bernilai true setiap kali `form` falsy (`else if (!form)
    // return true;`), jadi CommandItem tombol tambah TIDAK PERNAH dirender
    // untuk file ini -- beda dari ItemLinkModel/AssetLocationLinkModel/
    // NumberCardLinkModel yang semuanya mengisi prop `form`. Dikunci di sini
    // supaya perilaku (bukan bug -- keputusan sengaja di file ini) tidak
    // diam-diam berubah saat titleDialog/form di-uncomment di masa depan.
    const user = userEvent.setup({ delay: null });
    await render(<ItemUnitLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kilo");
    });

    // `waitFor` RTL (bukan `vi.waitFor`) -- menunggu debounce 500ms, lihat
    // catatan di test "mengetik memicu request axios...".
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Kilo" }),
        );
      },
      { timeout: 3000 },
    );

    // Mode non-cache TIDAK memfilter opsi di client -- yang dirender persis
    // apa yg dikembalikan axios (2 item dari beforeEach), terlepas dari teks
    // yg diketik. CommandItem "Advance Search" SELALU dirender di akhir
    // (terlepas dari disabledAdd), jadi total = 2 data + 1 = 3. findAllByRole
    // biasa resolve begitu ADA match apa pun -- Advance Search ter-mount
    // lebih dulu sebelum data debounce tiba -- jadi waitFor count STABIL di 3.
    const options = await waitFor(() => {
      const opts = screen.getAllByRole("option");
      expect(opts).toHaveLength(3);
      return opts;
    });
    expect(options[0]).toHaveTextContent("Kilogram (KG)");
    expect(options[1]).toHaveTextContent("Gram (GR)");
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<ItemUnitLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kilo");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale. `waitFor` RTL (bukan `vi.waitFor`) -- menunggu
    // debounce 500ms, lihat catatan di test sebelumnya.
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Kilo" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", {
      name: "Kilogram (KG)",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Kilogram", code: "KG" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan ItemUnit) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. ItemUnitLinkModel mengunci model ke ItemUnit, jadi opsi
    // yang (secara data cacat/salah) membawa thisModel model lain harus
    // ditolak secara silent (tanpa error) -- bukan celah keamanan karena
    // payload pencarian sendiri sudah scoped ke model ItemUnit, tapi
    // defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name (:code)",
            name: "Salah Model",
            code: "XX",
            thisModel: "App\\Models\\Inventory\\Item",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<ItemUnitLinkModel onValueChange={onValueChange} />);

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
      name: "Salah Model (XX)",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default ItemUnit", async () => {
    // ItemUnitLinkModel men-spread {...props} SETELAH prop tetap (placeholder,
    // value, onValueChange, model, with) -- di JSX, atribut yang ditulis
    // belakangan menang. Jadi caller BISA menimpa `model` bawaan ItemUnit
    // lewat prop tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<ItemUnitLinkModel model="AppModelsOverride" />);

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
