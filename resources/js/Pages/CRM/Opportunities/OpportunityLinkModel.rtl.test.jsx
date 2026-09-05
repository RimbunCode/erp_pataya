import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai OpportunityLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring OpportunityLinkModel
// -- mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// AssetLocationLinkModel.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

// Form asli Opportunity (./Form.jsx, co-located) meng-import banyak
// dependency berat (FormPageContent/useFormPage, LeadLinkModel,
// CustomerLinkModel, UserLinkModel, DatetimePicker, NumberInput, Select,
// dst) yang tidak relevan utk test wiring OpportunityLinkModel ini.
// FormPageDialog di atas sudah di-mock null sehingga prop `form` TIDAK
// PERNAH benar-benar dirender, tapi modulnya tetap ikut ter-load lewat
// static import OpportunityLinkModel.jsx kalau tidak di-mock di sini juga.
vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import OpportunityLinkModel from "./OpportunityLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & AssetLocationLinkModel.rtl.
// test.jsx: LinkModel membungkus dirinya dengan <Tooltip> internal tanpa
// menyediakan <TooltipProvider> sendiri, dan menembak axios.post di
// useEffect saat mount tanpa di-await -- bungkus render() ITU SENDIRI dalam
// `await act(async () => {})` supaya microtask stabil dulu. delayDuration=0
// supaya Radix TooltipProvider tidak memakai setTimeout asli (700ms) yang
// tidak terkontrol test.
const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

describe("OpportunityLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":title",
            title: "Penawaran Server Baru",
            // FQCN Laravel asli App\Models\CRM\Opportunity
            // (app/Models/CRM/Opportunity.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // OpportunityLinkModel.jsx sendiri (baris 16) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\CRM\\Opportunity",
          },
          {
            id: 2,
            templateLink: ":title",
            title: "Perpanjangan Kontrak",
            thisModel: "App\\Models\\CRM\\Opportunity",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<OpportunityLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:title)", async () => {
    await render(
      <OpportunityLinkModel
        value={{ templateLink: ":title", title: "Migrasi Sistem ERP" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Migrasi Sistem ERP");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<OpportunityLinkModel placeholder="Pilih peluang..." />);
    expect(screen.getByPlaceholderText("Pilih peluang...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik OpportunityLinkModel), tapi tetap perlu dikunci di sini
    // supaya wiring `ref` dari OpportunityLinkModel -> LinkModel -> Input
    // tidak diam-diam berubah.
    const ref = { current: null };
    await render(<OpportunityLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<OpportunityLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Opportunity", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<OpportunityLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Penawaran");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di OpportunityLinkModel.jsx baris 16
            // (model="App\Models\CRM\Opportunity") memakai satu backslash --
            // berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi backslash-nya
            // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
            // app/Models/CRM/Opportunity.php.
            model: "App\\Models\\CRM\\Opportunity",
            search: "Penawaran",
          }),
        );
      });
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('crm.opportunity.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<OpportunityLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:crm.opportunity.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<OpportunityLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Penawaran");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Penawaran" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "Penawaran Server Baru",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, title: "Penawaran Server Baru" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Opportunity) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. OpportunityLinkModel mengunci model ke Opportunity, jadi
    // opsi yang (secara data cacat/salah) membawa thisModel model lain harus
    // ditolak secara silent (tanpa error) -- bukan celah keamanan karena
    // payload pencarian sendiri sudah scoped ke model Opportunity, tapi
    // defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":title",
            title: "Salah Model",
            thisModel: "App\\Models\\CRM\\Lead",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<OpportunityLinkModel onValueChange={onValueChange} />);

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

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Opportunity", async () => {
    // OpportunityLinkModel men-spread {...props} SETELAH prop tetap (model,
    // titleDialog, classNameDialog, form) -- di JSX, atribut yang ditulis
    // belakangan menang. Jadi caller BISA menimpa `model` bawaan Opportunity
    // lewat prop tambahan. Bukan bug: konsekuensi urutan spread yang perlu
    // didokumentasikan lewat test supaya perilakunya tidak berubah diam-diam
    // saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<OpportunityLinkModel model="AppModelsOverride" />);

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
