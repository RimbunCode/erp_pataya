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

// LinkModel.jsx (dipakai LeadLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring LeadLinkModel -- mock
// jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// ChartLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli Lead (./Form.jsx, co-located) meng-import CountryLinkModel,
// LeadSourceLinkModel, UserLinkModel, FormInput, useFormPage dst -- tidak
// relevan utk test wiring LeadLinkModel ini. FormPageDialog di atas sudah
// di-mock null sehingga prop `form` TIDAK PERNAH benar-benar dirender, tapi
// modulnya tetap ikut ter-load lewat static import LeadLinkModel.jsx kalau
// tidak di-mock di sini juga.
vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import LeadLinkModel from "./LeadLinkModel";
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

describe("LeadLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":company_name",
            company_name: "PT Sinar Jaya",
            // FQCN Laravel asli App\Models\CRM\Lead (app/Models/CRM/Lead.php)
            // -- literal string JS di sini WAJIB double-backslash supaya
            // menghasilkan satu backslash sungguhan per separator, dibanding
            // literal atribut JSX di LeadLinkModel.jsx sendiri (baris 16)
            // yang cukup satu backslash karena string literal JSX TIDAK
            // memproses escape sequence ala JS biasa (beda dari file .js
            // biasa) -- keduanya berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\CRM\\Lead",
          },
          {
            id: 2,
            templateLink: ":company_name",
            company_name: "CV Maju Bersama",
            thisModel: "App\\Models\\CRM\\Lead",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<LeadLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:company_name)", async () => {
    await render(
      <LeadLinkModel
        value={{
          templateLink: ":company_name",
          company_name: "PT Cahaya Abadi",
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("PT Cahaya Abadi");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<LeadLinkModel placeholder="Pilih lead..." />);
    expect(screen.getByPlaceholderText("Pilih lead...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik LeadLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari LeadLinkModel -> LinkModel -> Input tidak diam-diam
    // berubah.
    const ref = { current: null };
    await render(<LeadLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<LeadLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Lead & search yg benar", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<LeadLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Sinar");
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
          // Literal atribut JSX di LeadLinkModel.jsx baris 16
          // (model="App\Models\CRM\Lead") memakai satu backslash --
          // berbeda dari string literal JS biasa, JSX TIDAK memproses
          // escape sequence pada literal atribut string, jadi backslash-nya
          // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
          // app/Models/CRM/Lead.php.
          model: "App\\Models\\CRM\\Lead",
          search: "Sinar",
        }),
      );
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('crm.lead.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<LeadLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(await screen.findByText("TR:crm.lead.new")).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<LeadLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Sinar");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale. `waitFor` RTL (bukan `vi.waitFor`) -- request ini
    // butuh debounce 500ms (setTimeout mentah), lihat catatan test di atas.
    await waitFor(() => {
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "Sinar" }),
      );
    });

    const option = await screen.findByRole("option", {
      name: "PT Sinar Jaya",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, company_name: "PT Sinar Jaya" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Lead) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. LeadLinkModel mengunci model ke Lead, jadi opsi yang
    // (secara data cacat/salah) membawa thisModel model lain harus ditolak
    // secara silent (tanpa error) -- bukan celah keamanan karena payload
    // pencarian sendiri sudah scoped ke model Lead, tapi defense-in-depth
    // ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":company_name",
            company_name: "Salah Model",
            thisModel: "App\\Models\\CRM\\Opportunity",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<LeadLinkModel onValueChange={onValueChange} />);

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
      name: "Salah Model",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Lead", async () => {
    // LeadLinkModel men-spread {...props} SETELAH prop tetap (model,
    // titleDialog, classNameDialog, form) -- di JSX, atribut yang ditulis
    // belakangan menang. Jadi caller BISA menimpa `model` bawaan Lead lewat
    // prop tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<LeadLinkModel model="AppModelsOverride" />);

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
