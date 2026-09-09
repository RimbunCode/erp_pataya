import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai LeadSourceLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring LeadSourceLinkModel --
// mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// AssetLocationLinkModel.rtl.test.jsx. LeadSourceLinkModel sendiri TIDAK
// mengirim prop `form`, tapi FormPageDialog tetap ter-import statis oleh
// LinkModel.jsx sehingga tetap harus di-mock di sini.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import LeadSourceLinkModel from "./LeadSourceLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { buildPersistKey } from "@/Hooks/useLinkModelOptions";

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

describe("LeadSourceLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    // LeadSourceLinkModel mengunci `cache` (truthy) + cacheStorage=
    // "sessionStorage" (lihat LeadSourceLinkModel.jsx baris 16-17).
    // useLinkModelOptions menulis snapshot ke sessionStorage dgn timestamp
    // Date.now() tiap kali mount berhasil fetch, lalu membacanya kembali di
    // mount BERIKUTNYA lewat `queryClient.setQueryData(..., { updatedAt:
    // stored.ts })`. QueryClient BARU per render() TIDAK cukup utk isolasi --
    // staleTime (default 120s) dihitung dari `stored.ts` yang persis dari
    // sessionStorage, bukan dari umur queryClient itu sendiri, jadi entry
    // dari test sebelumnya (key sama: model/filters/joins semuanya konstan
    // di seluruh file ini) selalu dianggap "masih segar" & bikin useQuery
    // SKIP fetch ulang -- axios.post tidak pernah terpanggil lagi di test
    // kedua dst. WAJIB clear tiap test (sama seperti CurrencyLinkModel.rtl.test.jsx
    // & CountryLinkModel.rtl.test.jsx), bukan cuma higiene.
    window.sessionStorage.clear();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "Referral",
            // FQCN Laravel asli App\Models\CRM\LeadSource
            // (app/Models/CRM/LeadSource.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // LeadSourceLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\CRM\\LeadSource",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "Website",
            thisModel: "App\\Models\\CRM\\LeadSource",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<LeadSourceLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <LeadSourceLinkModel
        value={{ templateLink: ":name", name: "Iklan Sosial" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Iklan Sosial");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<LeadSourceLinkModel placeholder="Pilih sumber lead..." />);
    expect(
      screen.getByPlaceholderText("Pilih sumber lead..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik LeadSourceLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari LeadSourceLinkModel -> LinkModel -> Input tidak diam-
    // diam berubah.
    const ref = { current: null };
    await render(<LeadSourceLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<LeadSourceLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mount memicu request axios awal (cacheMode) dengan model LeadSource", async () => {
    // Karena `cache` aktif, request pencarian tidak dipicu oleh ketikan user
    // (lihat komentar besar di beforeEach) -- yang dipicu justru SATU request
    // "cacheMode" saat mount, utk mengisi seluruh daftar opsi ke state (lalu
    // difilter di client saat user mengetik). payload cacheMode SENGAJA tidak
    // membawa field `search`/`fields` sama sekali (LinkModel.jsx baris
    // ~467-481 skip Object.assign field pencarian saat isCacheRequest true).
    await render(<LeadSourceLinkModel />);

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di LeadSourceLinkModel.jsx baris 13
            // (model="App\Models\CRM\LeadSource") memakai satu backslash --
            // berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi backslash-nya
            // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
            // app/Models/CRM/LeadSource.php.
            model: "App\\Models\\CRM\\LeadSource",
            cacheMode: true,
          }),
        );
      });
    });
  });

  it("mengetik memfilter opsi hasil cache di client TANPA request axios tambahan", async () => {
    await render(<LeadSourceLinkModel />);

    // Tunggu request cacheMode awal selesai (options ter-populate) sebelum
    // mengetik, supaya assertion "hanya 1 kali dipanggil" di bawah tidak
    // false-negative akibat race dengan fetch mount yang belum selesai.
    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    const user = userEvent.setup({ delay: null });
    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Website");
    });

    expect(
      await screen.findByRole("option", { name: "Website" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Referral" }),
    ).not.toBeInTheDocument();

    // Pengetikan pada mode cache murni filter client-side (filteredOptions di
    // LinkModel.jsx baris ~651-675) -- tidak ada request axios kedua.
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  it("memilih opsi dari daftar hasil (filter cache) memanggil onValueChange", async () => {
    const onValueChange = vi.fn();
    await render(<LeadSourceLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    const user = userEvent.setup({ delay: null });
    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Website");
    });

    const option = await screen.findByRole("option", { name: "Website" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: "Website" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan LeadSource) TIDAK dirender dalam daftar (difilter validate())", async () => {
    // Beda dari wrapper LinkModel tanpa cache (mis. NumberCardLinkModel,
    // AssetLocationLinkModel): di mode cache, validate() diterapkan LEBIH
    // AWAL saat menyusun `filteredOptions` (LinkModel.jsx baris 653:
    // `options.filter((opt) => validate(opt, model))`), BUKAN cuma saat opsi
    // diklik. Jadi opsi bermodel salah tidak pernah sampai muncul sbg item
    // yang bisa diklik sama sekali -- assert lewat queryByRole yang
    // mengembalikan null, bukan lewat klik + onValueChange not called.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\Core\\Branch",
          },
          {
            id: 1,
            templateLink: ":name",
            name: "Referral",
            thisModel: "App\\Models\\CRM\\LeadSource",
          },
        ],
        total: 2,
      },
    });

    const onValueChange = vi.fn();
    await render(<LeadSourceLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    // PopoverContent (forceMount) tetap memakai atribut `hidden` selama
    // `open` masih false -- getByRole/findByRole secara default mengabaikan
    // elemen hidden, jadi dropdown perlu dibuka dulu (klik textbox) sebelum
    // opsi bisa di-query lewat role, sama seperti test lain di file ini yang
    // sudah membuka dropdown via user.type().
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    expect(
      await screen.findByRole("option", { name: "Referral" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Salah Model" }),
    ).not.toBeInTheDocument();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default LeadSource", async () => {
    // LeadSourceLinkModel men-spread {...props} SETELAH prop tetap (model,
    // disabledNavigation, disabledAddButton, cache, cacheStorage) -- di JSX,
    // atribut yang ditulis belakangan menang. Jadi caller BISA menimpa
    // `model` bawaan LeadSource lewat prop tambahan. Bukan bug: konsekuensi
    // urutan spread yang perlu didokumentasikan lewat test supaya
    // perilakunya tidak berubah diam-diam saat file di-refactor.
    await render(<LeadSourceLinkModel model="AppModelsOverride" />);

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "AppModelsOverride" }),
        );
      });
    });
  });

  // Task 7.2 spec linkmodel-fetch-optimization -- lihat CurrencyLinkModel.rtl.test.jsx
  // untuk penjelasan lengkap kenapa test ini perlu ada terpisah (tidak ada
  // test lain di file ini yang membaca sessionStorage secara langsung).
  it("fetch cache mode menulis snapshot ke sessionStorage dengan key linkmodel:<model>:...", async () => {
    await render(<LeadSourceLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    const persistKey = buildPersistKey({
      model: "App\\Models\\CRM\\LeadSource",
      filters: undefined,
      joins: undefined,
      with: undefined,
      keywords: undefined,
      order: undefined,
      translate: undefined,
    });
    const stored = JSON.parse(window.sessionStorage.getItem(persistKey));
    expect(stored?.data).toEqual([
      expect.objectContaining({ id: 1, name: "Referral" }),
      expect.objectContaining({ id: 2, name: "Website" }),
    ]);
    expect(typeof stored?.ts).toBe("number");
  });
});
