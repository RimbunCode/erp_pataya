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

// LinkModel.jsx (dipakai AccountLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring AccountLinkModel --
// mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// AssetLocationLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
  FormPageContent: () => null,
  useFormPage: () => ({ data: {}, setData: () => {} }),
}));

// Form asli Account (./Form.jsx, co-located) meng-import AccountLinkModel
// KEMBALI (dipakai utk field "parent_account" -- akun bisa jadi parent dari
// akun lain) -- import siklik apabila modul asli benar-benar dievaluasi,
// plus Form.jsx juga menarik NumberInput, FormCheckbox, FormInput, Select,
// dst yang tidak relevan utk test wiring AccountLinkModel ini. FormPageDialog
// di atas sudah di-mock null sehingga prop `form` TIDAK PERNAH benar-benar
// dirender, tapi modulnya tetap ikut ter-load lewat static import
// AccountLinkModel.jsx kalau tidak di-mock di sini juga.
vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import AccountLinkModel from "./AccountLinkModel";
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

describe("AccountLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":account_number - :account_name",
            account_number: "1000",
            account_name: "Kas",
            // FQCN Laravel asli App\Models\Finances\Account
            // (app/Models/Finances/Account.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // AccountLinkModel.jsx sendiri (baris 16) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Finances\\Account",
          },
          {
            id: 2,
            templateLink: ":account_number - :account_name",
            account_number: "1100",
            account_name: "Bank",
            thisModel: "App\\Models\\Finances\\Account",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<AccountLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:account_number - :account_name)", async () => {
    await render(
      <AccountLinkModel
        value={{
          templateLink: ":account_number - :account_name",
          account_number: "2000",
          account_name: "Piutang Usaha",
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("2000 - Piutang Usaha");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<AccountLinkModel placeholder="Pilih akun..." />);
    expect(screen.getByPlaceholderText("Pilih akun...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik AccountLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari AccountLinkModel -> LinkModel -> Input tidak diam-
    // diam berubah.
    const ref = { current: null };
    await render(<AccountLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<AccountLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Account & filter default is_disabled:false", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AccountLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kas");
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
          // Literal atribut JSX di AccountLinkModel.jsx baris 16
          // (model="App\Models\Finances\Account") memakai satu backslash --
          // berbeda dari string literal JS biasa, JSX TIDAK memproses
          // escape sequence pada literal atribut string, jadi backslash-nya
          // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
          // app/Models/Finances/Account.php.
          model: "App\\Models\\Finances\\Account",
          search: "Kas",
          filters: { is_disabled: false },
        }),
      );
    });
  });

  it("prop filters caller di-merge di atas default is_disabled:false (properti caller menang)", async () => {
    // AccountLinkModel.jsx baris 18-21: filters={{ is_disabled: false,
    // ...filters }} -- spread `filters` (dari caller) diletakkan SETELAH
    // is_disabled:false, jadi caller bisa menimpa is_disabled bawaan
    // sekaligus menambah kunci filter lain (mis. is_group) tanpa kehilangan
    // default tsb kalau caller tidak menyinggungnya.
    const user = userEvent.setup({ delay: null });
    await render(
      <AccountLinkModel filters={{ is_disabled: true, is_group: true }} />,
    );

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "x");
    });

    // `waitFor` RTL (bukan `vi.waitFor`) -- request ini butuh debounce 500ms
    // (setTimeout mentah), lihat catatan test di atas.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({
          filters: { is_disabled: true, is_group: true },
        }),
      );
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('finances.account.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AccountLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:finances.account.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AccountLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kas");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale. `waitFor` RTL (bukan `vi.waitFor`) -- request ini
    // butuh debounce 500ms (setTimeout mentah), lihat catatan test di atas.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Kas" }),
      );
    });

    const option = await screen.findByRole("option", {
      name: "1000 - Kas",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, account_name: "Kas" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Account) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. AccountLinkModel mengunci model ke Account, jadi opsi
    // yang (secara data cacat/salah) membawa thisModel model lain harus
    // ditolak secara silent (tanpa error) -- bukan celah keamanan karena
    // payload pencarian sendiri sudah scoped ke model Account, tapi
    // defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":account_number - :account_name",
            account_number: "9999",
            account_name: "Salah Model",
            thisModel: "App\\Models\\Core\\Branch",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AccountLinkModel onValueChange={onValueChange} />);

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

    const option = await screen.findByRole("option", {
      name: "9999 - Salah Model",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Account", async () => {
    // AccountLinkModel men-spread {...props} SETELAH prop tetap (model, form,
    // filters, titleDialog, classNameDialog) -- di JSX, atribut yang ditulis
    // belakangan menang. Jadi caller BISA menimpa `model` bawaan Account
    // lewat prop tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<AccountLinkModel model="AppModelsOverride" />);

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
