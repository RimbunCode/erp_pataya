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

// LinkModel.jsx (dipakai DeliveryNoteLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring DeliveryNoteLinkModel
// -- mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx.
// DeliveryNoteLinkModel juga set disabledAddButton={true} sehingga
// FormPageDialog TIDAK PERNAH dirender sungguhan (lihat LinkModel.jsx
// `disabledAdd` -- true kalau disabledAddButton true, apa pun nilai form),
// tapi modulnya tetap ikut ter-load lewat static import kalau tidak di-mock.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import DeliveryNoteLinkModel from "./DeliveryNoteLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

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

describe("DeliveryNoteLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":code",
            code: "DN-0001",
            // FQCN Laravel asli App\Models\Inventory\DeliveryNote
            // (app/Models/Inventory/DeliveryNote.php) -- literal string JS di
            // sini WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // DeliveryNoteLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Inventory\\DeliveryNote",
          },
          {
            id: 2,
            templateLink: ":code",
            code: "DN-0002",
            thisModel: "App\\Models\\Inventory\\DeliveryNote",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<DeliveryNoteLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render value terisi via convertTemplateLink (:code)", async () => {
    await render(
      <DeliveryNoteLinkModel
        value={{ templateLink: ":code", code: "DN-0009" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("DN-0009");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(
      <DeliveryNoteLinkModel placeholder="Pilih delivery note..." />,
    );
    expect(
      screen.getByPlaceholderText("Pilih delivery note..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik DeliveryNoteLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari DeliveryNoteLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<DeliveryNoteLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<DeliveryNoteLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model DeliveryNote (mode non-cache)", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<DeliveryNoteLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "DN-000");
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
            // Literal atribut JSX di DeliveryNoteLinkModel.jsx baris 13
            // (model="App\Models\Inventory\DeliveryNote") memakai satu
            // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
            // memproses escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Inventory/DeliveryNote.php.
            model: "App\\Models\\Inventory\\DeliveryNote",
            search: "DN-000",
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("membuka dropdown TIDAK menampilkan opsi tambah (disabledAddButton=true)", async () => {
    // DeliveryNoteLinkModel mengunci disabledAddButton={true} -- di
    // LinkModel.jsx, `disabledAdd` langsung true begitu disabledAddButton
    // true (short-circuit, terlepas dari prop `form`/`can`), jadi CommandItem
    // "+ tambah" dan FormPageDialog tidak pernah dirender. Klik textbox untuk
    // membuka dropdown lalu pastikan tidak ada tombol/opsi tambah muncul.
    const user = userEvent.setup({ delay: null });
    await render(<DeliveryNoteLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByRole("option", { name: "DN-0001" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /plus|tambah/i })).toBeNull();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<DeliveryNoteLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "DN-000");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale. `waitFor` RTL (bukan `vi.waitFor`) -- menunggu
    // debounce 500ms, lihat catatan di test sebelumnya.
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "DN-000" }),
        );
      },
      { timeout: 3000 },
    );

    const option = await screen.findByRole("option", { name: "DN-0001" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "DN-0001" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan DeliveryNote) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. DeliveryNoteLinkModel mengunci model ke DeliveryNote,
    // jadi opsi yang (secara data cacat/salah) membawa thisModel model lain
    // harus ditolak secara silent (tanpa error) saat diklik -- bukan celah
    // keamanan karena payload pencarian sendiri sudah scoped ke model
    // DeliveryNote, tapi defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":code",
            code: "Salah Model",
            thisModel: "App\\Models\\Purchase\\PurchaseReceipt",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<DeliveryNoteLinkModel onValueChange={onValueChange} />);

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

    const option = await screen.findByRole("option", { name: "Salah Model" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default DeliveryNote", async () => {
    // DeliveryNoteLinkModel men-spread {...props} SETELAH prop tetap (model,
    // disabledAddButton) -- di JSX, atribut yang ditulis belakangan menang.
    // Jadi caller BISA menimpa `model` bawaan DeliveryNote lewat prop
    // tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<DeliveryNoteLinkModel model="AppModelsOverride" />);

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
