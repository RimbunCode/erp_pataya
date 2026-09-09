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

// LinkModel.jsx (dipakai AssetServiceConsumedItemLinkModel di bawah tangan)
// meng-import FormPageDialog dari FormPage.jsx, yang menarik banyak
// dependency lain (Table2, editor, dst) tidak relevan untuk test wiring
// AssetServiceConsumedItemLinkModel -- mock jadi stub kosong sama seperti
// LinkModel.rtl.test.jsx, NumberCardLinkModel.rtl.test.jsx &
// ChartLinkModel.rtl.test.jsx. Tidak perlu mock modul Form terpisah di sini
// karena AssetServiceConsumedItemLinkModel.jsx sendiri TIDAK mengirim prop
// `form` ke LinkModel (beda dari NumberCardLinkModel/ChartLinkModel).
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import AssetServiceConsumedItemLinkModel from "./AssetServiceConsumedItemLinkModel";
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

describe("AssetServiceConsumedItemLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            // templateLink asli App\Models\Asset\AssetServiceConsumedItem::templateLink()
            // (app/Models/Asset/AssetServiceConsumedItem.php) adalah
            // ":item - :quantity". Relasi `item` (ItemVariant) di sini cukup
            // string biasa (bukan object bersarang) supaya convertTemplateLink
            // (lib/linkModelUtils.js) langsung memakainya sbg nilai tampilan.
            item: "Aspal Curah 25kg",
            quantity: 5,
            templateLink: ":item - :quantity",
            // FQCN Laravel asli App\Models\Asset\AssetServiceConsumedItem
            // (app/Models/Asset/AssetServiceConsumedItem.php) -- literal
            // string JS di sini WAJIB double-backslash supaya menghasilkan
            // satu backslash sungguhan per separator, dibanding literal
            // atribut JSX di AssetServiceConsumedItemLinkModel.jsx sendiri
            // (baris 13) yang cukup satu backslash karena string literal JSX
            // TIDAK memproses escape sequence ala JS biasa (beda dari file
            // .js biasa) -- keduanya berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Asset\\AssetServiceConsumedItem",
          },
          {
            id: 2,
            item: "Besi Siku 40mm",
            quantity: 10,
            templateLink: ":item - :quantity",
            thisModel: "App\\Models\\Asset\\AssetServiceConsumedItem",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<AssetServiceConsumedItemLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it('render label value terpilih via convertTemplateLink (:item - :quantity, selaras as="item:item.item_id")', async () => {
    await render(
      <AssetServiceConsumedItemLinkModel
        value={{
          item: "Semen 40kg",
          quantity: 3,
          templateLink: ":item - :quantity",
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Semen 40kg - 3");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(
      <AssetServiceConsumedItemLinkModel placeholder="Pilih part terpakai..." />,
    );
    expect(
      screen.getByPlaceholderText("Pilih part terpakai..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik AssetServiceConsumedItemLinkModel), tapi tetap perlu dikunci
    // di sini supaya wiring `ref` dari AssetServiceConsumedItemLinkModel ->
    // LinkModel -> Input tidak diam-diam berubah.
    const ref = { current: null };
    await render(<AssetServiceConsumedItemLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<AssetServiceConsumedItemLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model AssetServiceConsumedItem & filters default (assetService.status approved)", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssetServiceConsumedItemLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Aspal");
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
            // Literal atribut JSX di AssetServiceConsumedItemLinkModel.jsx
            // baris 13 (model="App\Models\Asset\AssetServiceConsumedItem")
            // memakai satu backslash -- berbeda dari string literal JS biasa,
            // JSX TIDAK memproses escape sequence pada literal atribut
            // string, jadi backslash-nya tetap utuh saat runtime dan cocok
            // dgn FQCN Laravel asli app/Models/Asset/AssetServiceConsumedItem.php.
            model: "App\\Models\\Asset\\AssetServiceConsumedItem",
            search: "Aspal",
            // filters tetap (baris 17 file target) hanya meloloskan
            // AssetServiceConsumedItem yang assetService induknya sudah
            // approved -- default ini WAJIB ikut terkirim di setiap request,
            // bukan cuma saat caller mengisi prop filters sendiri.
            filters: { "assetService.status": { jsonContains: ["approved"] } },
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(
      <AssetServiceConsumedItemLinkModel onValueChange={onValueChange} />,
    );

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Aspal");
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
          expect.objectContaining({ search: "Aspal" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", {
      name: "Aspal Curah 25kg - 5",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, item: "Aspal Curah 25kg" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan AssetServiceConsumedItem) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. AssetServiceConsumedItemLinkModel mengunci model ke
    // AssetServiceConsumedItem, jadi opsi yang (secara data cacat/salah)
    // membawa thisModel model lain harus ditolak secara silent (tanpa error)
    // -- bukan celah keamanan karena payload pencarian sendiri sudah scoped
    // ke model AssetServiceConsumedItem, tapi defense-in-depth ini tetap
    // perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            item: "Salah Model",
            quantity: 1,
            templateLink: ":item - :quantity",
            thisModel: "App\\Models\\Inventory\\Item",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(
      <AssetServiceConsumedItemLinkModel onValueChange={onValueChange} />,
    );

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
      name: "Salah Model - 1",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
