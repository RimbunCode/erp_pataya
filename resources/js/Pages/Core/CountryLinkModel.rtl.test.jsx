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

// LinkModel.jsx (dipakai CountryLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring CountryLinkModel --
// mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// PermissionLinkModel.rtl.test.jsx. CountryLinkModel.jsx sendiri TIDAK
// meng-import Form apapun (tidak ada prop `form`/`titleDialog` yang
// dikirim), jadi tidak perlu mock "./Form" tambahan seperti referensi lain.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import CountryLinkModel from "./CountryLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { buildPersistKey } from "@/Hooks/useLinkModelOptions";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & PermissionLinkModel.rtl.test.jsx:
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

describe("CountryLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    // cache aktif + cacheStorage="sessionStorage" -- useLinkModelOptions
    // menulis snapshot ke sessionStorage dgn timestamp Date.now() tiap kali
    // mount berhasil fetch, lalu membacanya kembali di mount BERIKUTNYA lewat
    // `queryClient.setQueryData(..., { updatedAt: stored.ts })`. QueryClient
    // BARU per render() (lihat komentar di atas) TIDAK cukup utk isolasi --
    // staleTime (default 120s) dihitung dari `stored.ts` yang persis dari
    // sessionStorage, bukan dari umur queryClient itu sendiri, jadi entry
    // dari test sebelumnya (key sama: model/filters/joins semuanya konstan
    // di seluruh file ini) selalu dianggap "masih segar" & bikin useQuery
    // SKIP fetch ulang -- axios.post tidak pernah terpanggil lagi di test
    // kedua dst. Sama seperti CurrencyLinkModel.rtl.test.jsx &
    // LeadSourceLinkModel.rtl.test.jsx: bersihkan sessionStorage per test.
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            // app/Models/Core/Country.php: $primaryKey = 'code' (string, non
            // incrementing), templateLink() = ':name'. `id` tetap disertakan
            // krn LinkModel.jsx (CommandItem key/value, baris 850-851) selalu
            // memakai `opt.id`.
            id: "ID",
            code: "ID",
            templateLink: ":name",
            name: "Indonesia",
            // FQCN Laravel asli App\Models\Core\Country
            // (app/Models/Core/Country.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // CountryLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Core\\Country",
          },
          {
            id: "MY",
            code: "MY",
            templateLink: ":name",
            name: "Malaysia",
            thisModel: "App\\Models\\Core\\Country",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<CountryLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <CountryLinkModel value={{ templateLink: ":name", name: "Singapura" }} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Singapura");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<CountryLinkModel placeholder="Pilih negara..." />);
    expect(screen.getByPlaceholderText("Pilih negara...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik CountryLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari CountryLinkModel -> LinkModel -> Input tidak
    // diam-diam berubah.
    const ref = { current: null };
    await render(<CountryLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<CountryLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mount otomatis memicu request axios model Country dengan cacheMode true (cache aktif, TANPA perlu mengetik)", async () => {
    // BEDA dari wrapper LinkModel lain (NumberCard/Chart/Permission/
    // AssetLocation): CountryLinkModel.jsx mengaktifkan `cache` +
    // `cacheStorage="sessionStorage"`. Saat cache aktif, LinkModel.jsx
    // (useEffect baris 522-526) langsung memanggil getModels({}, null,
    // {cacheMode:true}) SEKALI saat mount -- payload cache-mode TIDAK
    // menyertakan `search`/`fields`/`filters` (LinkModel.jsx baris 467-481,
    // hanya diisi saat !isCacheRequest). Ini sengaja diverifikasi terpisah
    // dari test "render input kosong" di atas.
    await render(<CountryLinkModel />);

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di CountryLinkModel.jsx baris 13
            // (model="App\Models\Core\Country") memakai satu backslash --
            // berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi
            // backslash-nya tetap utuh saat runtime dan cocok dgn FQCN
            // Laravel asli app/Models/Core/Country.php.
            model: "App\\Models\\Core\\Country",
            cacheMode: true,
          }),
        );
      });
    });
  });

  it("mengetik MEMFILTER opsi tercache secara client-side, TANPA request axios tambahan", async () => {
    // Konsekuensi cache aktif: useDidMountEffect debounce pencarian di
    // LinkModel.jsx (baris 528-542) `if (cacheConfig.enabled) return;` --
    // mengetik TIDAK memicu axios.post baru. Filtering dilakukan di memo
    // `filteredOptions` (baris 651-675) memakai convertTemplateLink(opt,
    // "", true).toLowerCase().includes(keyword) terhadap data yang sudah
    // dimuat sekali saat mount.
    const user = userEvent.setup({ delay: null });
    await render(<CountryLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Indo");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(
          screen.getByRole("option", { name: /Indonesia/ }),
        ).toBeInTheDocument();
      });
    });

    expect(
      screen.queryByRole("option", { name: /Malaysia/ }),
    ).not.toBeInTheDocument();
    // Tetap 1 -- panggilan mount di atas, tidak bertambah krn mengetik.
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  it("membuka dropdown menampilkan seluruh opsi tercache TANPA tombol tambah (disabledAddButton selalu true)", async () => {
    // CountryLinkModel.jsx mengunci disabledAddButton (tidak ada prop
    // `form`/`titleDialog` yang dikirim ke LinkModel sama sekali) --
    // disabledAdd di LinkModel.jsx (`if (disabledAddButton) return true`)
    // membuat CommandItem "+ tambah" tidak pernah dirender. `showMore` juga
    // selalu false saat cache aktif (LinkModel.jsx baris 677-680:
    // `!cacheConfig.enabled && total > limit`), jadi tidak ada CommandItem
    // "lainnya" juga -- tapi CommandItem "Advance Search" SELALU dirender
    // terlepas dari disabledAdd, jadi jumlah option = jumlah data mock + 1,
    // dan tidak ada axios.post tambahan saat dropdown dibuka (cache sudah
    // termuat sejak mount).
    const user = userEvent.setup({ delay: null });
    await render(<CountryLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CountryLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    const option = await screen.findByRole("option", { name: "Indonesia" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ID", name: "Indonesia" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Country) TIDAK PERNAH muncul di dropdown (difilter validate() saat cache aktif) -- onValueChange tidak terpanggil", async () => {
    // Beda dari wrapper LinkModel non-cache (NumberCard/Permission/
    // AssetLocation): di sana opsi salah model tetap DIRENDER lalu ditolak
    // saat DIKLIK (validate() di dalam setOption). Saat cache aktif,
    // `filteredOptions` (LinkModel.jsx baris 651-675) SUDAH memfilter
    // `options.filter((opt) => validate(opt, model))` SEBELUM opsi
    // dirender sama sekali -- jadi proteksinya lebih awal: opsi salah
    // model tidak pernah jadi CommandItem yang bisa diklik. onValueChange
    // dengan sendirinya tidak pernah terpanggil krn tidak ada elemen utk
    // diklik.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: "XX",
            code: "XX",
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\Core\\Currency",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CountryLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    // Tidak ada opsi tersisa (satu-satunya baris hasil difilter validate()
    // krn thisModel-nya Currency, bukan Country) -- CommandEmpty tampil.
    expect(
      await screen.findByText("TR:core.form.not_found"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Salah Model" }),
    ).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Country, mount-fetch tetap otomatis (cache tidak dioverride)", async () => {
    // CountryLinkModel men-spread {...props} SETELAH prop tetap (model, as,
    // disabledAddButton, cache, cacheStorage) -- di JSX, atribut yang
    // ditulis belakangan menang. Jadi caller BISA menimpa `model` bawaan
    // Country lewat prop tambahan. Bukan bug: konsekuensi urutan spread
    // yang perlu didokumentasikan lewat test supaya perilakunya tidak
    // berubah diam-diam saat file di-refactor. `cache` sendiri tidak
    // dioverride di test ini, jadi mount-fetch otomatis tetap terjadi.
    await render(<CountryLinkModel model="AppModelsOverride" />);

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
    await render(<CountryLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    const persistKey = buildPersistKey({
      model: "App\\Models\\Core\\Country",
      filters: undefined,
      joins: undefined,
      with: undefined,
      keywords: undefined,
      order: undefined,
      translate: undefined,
    });
    const stored = JSON.parse(window.sessionStorage.getItem(persistKey));
    expect(stored?.data).toEqual([
      expect.objectContaining({ id: "ID", code: "ID" }),
      expect.objectContaining({ id: "MY", code: "MY" }),
    ]);
    expect(typeof stored?.ts).toBe("number");
  });
});
