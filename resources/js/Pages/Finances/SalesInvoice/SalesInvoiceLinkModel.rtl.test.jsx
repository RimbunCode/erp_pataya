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

// LinkModel.jsx (dipakai SalesInvoiceLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring SalesInvoiceLinkModel
// -- mock jadi stub kosong sama seperti PermissionLinkModel.rtl.test.jsx &
// NumberCardLinkModel.rtl.test.jsx. SalesInvoiceLinkModel.jsx sendiri TIDAK
// meng-import Form apapun (tidak ada prop `form`/`titleDialog` yang dikirim),
// jadi tidak perlu mock "./Form" tambahan seperti referensi lain.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import SalesInvoiceLinkModel from "./SalesInvoiceLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti PermissionLinkModel.rtl.test.jsx & NumberCardLinkModel.rtl.test.jsx:
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
// (bukan module-level) supaya cache TIDAK bocor lintas test.
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

describe("SalesInvoiceLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":code",
            code: "SI-0001",
            // FQCN Laravel asli App\Models\Finances\SalesInvoice
            // (app/Models/Finances/SalesInvoice.php) -- literal string JS di
            // sini WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // SalesInvoiceLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Finances\\SalesInvoice",
          },
          {
            id: 2,
            templateLink: ":code",
            code: "SI-0002",
            thisModel: "App\\Models\\Finances\\SalesInvoice",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<SalesInvoiceLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:code)", async () => {
    await render(
      <SalesInvoiceLinkModel
        value={{ templateLink: ":code", code: "SI-0009" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("SI-0009");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(
      <SalesInvoiceLinkModel placeholder="Pilih sales invoice..." />,
    );
    expect(
      screen.getByPlaceholderText("Pilih sales invoice..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik SalesInvoiceLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari SalesInvoiceLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<SalesInvoiceLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<SalesInvoiceLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model SalesInvoice", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<SalesInvoiceLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "SI-00");
    });

    // WAJIB pakai `waitFor` dari @testing-library/react, BUKAN `vi.waitFor` --
    // update `debouncedSearch` (state internal useLinkModelOptions) terjadi di
    // dalam callback setTimeout MENTAH (debounce 500ms) di luar act() manapun
    // yang eksplisit dibuat test ini. `vi.waitFor` tidak act()-aware, jadi
    // re-render React dari timer itu tidak pernah ke-flush selama polling.
    // Lihat LinkModel.rtl.test.jsx utk penjelasan lengkap.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({
          // Literal atribut JSX di SalesInvoiceLinkModel.jsx baris 13
          // (model="App\Models\Finances\SalesInvoice") memakai satu
          // backslash -- berbeda dari string literal JS biasa, JSX TIDAK
          // memproses escape sequence pada literal atribut string, jadi
          // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
          // Laravel asli app/Models/Finances/SalesInvoice.php.
          model: "App\\Models\\Finances\\SalesInvoice",
          search: "SI-00",
        }),
      );
    });
  });

  it("membuka dropdown TIDAK menampilkan tombol tambah (disabledAddButton=true, tanpa form)", async () => {
    // SalesInvoiceLinkModel.jsx mengunci disabledAddButton={true} secara
    // tetap (tidak ada prop `form`/`titleDialog` yang dikirim ke LinkModel
    // sama sekali) -- disabledAdd di LinkModel.jsx
    // (`if (disabledAddButton) return true`) membuat CommandItem "+ tambah"
    // tidak pernah dirender di sini -- dikunci lewat jumlah option persis =
    // jumlah data mock (tanpa baris tambahan).
    const user = userEvent.setup({ delay: null });
    await render(<SalesInvoiceLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<SalesInvoiceLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "SI-00");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale. `waitFor` RTL (bukan `vi.waitFor`) -- request ini
    // butuh debounce 500ms (setTimeout mentah), lihat catatan test di atas.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "SI-00" }),
      );
    });

    const option = await screen.findByRole("option", { name: "SI-0001" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "SI-0001" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan SalesInvoice) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. SalesInvoiceLinkModel mengunci model ke SalesInvoice,
    // jadi opsi yang (secara data cacat/salah) membawa thisModel model lain
    // harus ditolak secara silent (tanpa error) -- bukan celah keamanan
    // karena payload pencarian sendiri sudah scoped ke model SalesInvoice,
    // tapi defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":code",
            code: "Salah Model",
            thisModel: "App\\Models\\Finances\\PurchaseInvoice",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<SalesInvoiceLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Salah");
    });

    // `waitFor` RTL (bukan `vi.waitFor`) -- request ini butuh debounce 500ms
    // (setTimeout mentah), lihat catatan test di atas.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Salah" }),
      );
    });

    const option = await screen.findByRole("option", { name: "Salah Model" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default SalesInvoice", async () => {
    // SalesInvoiceLinkModel men-spread {...props} SETELAH prop tetap (model,
    // disabledAddButton) -- di JSX, atribut yang ditulis belakangan menang.
    // Jadi caller BISA menimpa `model` bawaan SalesInvoice lewat prop
    // tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<SalesInvoiceLinkModel model="AppModelsOverride" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "x");
    });

    // `waitFor` RTL (bukan `vi.waitFor`) -- request ini butuh debounce 500ms
    // (setTimeout mentah), lihat catatan test di atas.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ model: "AppModelsOverride" }),
      );
    });
  });
});
