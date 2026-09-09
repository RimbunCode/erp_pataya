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

// LinkModel.jsx (dipakai CurrencyLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx SECARA STATIS (terlepas dari prop `form`
// dipakai atau tidak), yang menarik banyak dependency lain (Table2, editor,
// dst) tidak relevan untuk test wiring CurrencyLinkModel -- mock jadi stub
// kosong sama seperti NumberCardLinkModel.rtl.test.jsx & PermissionLinkModel.rtl.test.jsx.
// CurrencyLinkModel.jsx sendiri TIDAK mengirim prop `form`/`titleDialog` sama
// sekali, jadi tidak perlu mock Form Settings/Currencies/Form.jsx terpisah
// (beda dari AssetLocationLinkModel yang mengirim form={<Form/>}).
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import CurrencyLinkModel from "./CurrencyLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { buildPersistKey } from "@/Hooks/useLinkModelOptions";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & PermissionLinkModel.rtl.test.jsx:
// LinkModel membungkus dirinya dengan <Tooltip> internal tanpa menyediakan
// <TooltipProvider> sendiri -- bungkus render() ITU SENDIRI dalam
// `await act(async () => {})` supaya microtask axios (mount fetch di bawah)
// stabil dulu. delayDuration=0 supaya Radix TooltipProvider tidak memakai
// setTimeout asli (700ms) yang tidak terkontrol test.
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

describe("CurrencyLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    // CurrencyLinkModel.jsx memasang cache + cacheStorage="sessionStorage" --
    // bersihkan supaya entry cache dari test sebelumnya (key sama:
    // "linkmodel:App\Models\Core\Currency:...") tidak bocor lintas test
    // dalam file ini (jsdom window/sessionStorage dipakai bersama antar test
    // pada file yang sama, tidak di-reset otomatis oleh Vitest per-test).
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            code: "IDR",
            name: "Rupiah",
            // templateLink asli App\Models\Core\Currency::templateLink()
            // (app/Models/Core/Currency.php) -- ":name (:code)".
            templateLink: ":name (:code)",
            // FQCN Laravel asli App\Models\Core\Currency
            // (app/Models/Core/Currency.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // CurrencyLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\Core\\Currency",
          },
          {
            id: 2,
            code: "USD",
            name: "US Dollar",
            templateLink: ":name (:code)",
            thisModel: "App\\Models\\Core\\Currency",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<CurrencyLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it('render label value terpilih via convertTemplateLink (:name (:code)), sesuai as="currency:code"', async () => {
    await render(
      <CurrencyLinkModel
        value={{ templateLink: ":name (:code)", name: "Euro", code: "EUR" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Euro (EUR)");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<CurrencyLinkModel placeholder="Pilih mata uang..." />);
    expect(
      screen.getByPlaceholderText("Pilih mata uang..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik CurrencyLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari CurrencyLinkModel -> LinkModel -> Input tidak
    // diam-diam berubah.
    const ref = { current: null };
    await render(<CurrencyLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<CurrencyLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mount memicu SATU axios request dengan payload cacheMode (model Currency, TANPA search/fields) -- bukan debounce on-type biasa krn cache=true", async () => {
    // BEDA dari NumberCardLinkModel/ChartLinkModel/PermissionLinkModel (semua
    // cache=false): CurrencyLinkModel.jsx mengunci cache + cacheStorage=
    // "sessionStorage" tetap. useLinkModelOptions (spec linkmodel-fetch-
    // optimization) langsung fetch SAAT MOUNT untuk mode cache (tanpa
    // debounce apapun, `enabled` tidak digantungkan ke `open`). Payload
    // cache mode TETAP TIDAK menyertakan search/fields/with/keywords/order/
    // translate (difilter di client), TAPI `filters` SEKARANG selalu ikut
    // terkirim meski kosong `{}` (fix bug lama: cache mode dulu strip
    // `filters` sepenuhnya dari payload -- lihat design.md "Known Bugs
    // Fixed"). Test ini tidak assert soal `filters` secara eksplisit karena
    // CurrencyLinkModel tidak pernah mengirim prop `filters` sama sekali.
    await render(<CurrencyLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [routeName, payload] = axiosPost.mock.calls[0];
    expect(routeName).toBe("model");
    expect(payload).toMatchObject({
      model: "App\\Models\\Core\\Currency",
      cacheMode: true,
    });
    expect(payload.search).toBeUndefined();
    expect(payload.fields).toBeUndefined();
  });

  it("mengetik TIDAK memicu request axios baru (cache mode) -- filter dilakukan client-side dari data yang sudah di-cache", async () => {
    // Konsekuensi cache=true: queryKey mode cache (useLinkModelOptions) TIDAK
    // menyertakan search sama sekali -- mengetik cuma mengubah state `search`
    // lokal LinkModel.jsx, tidak pernah mengubah queryKey, jadi TIDAK memicu
    // fetch baru. filteredOptions di LinkModel.jsx menyaring array `options`
    // (hasil query yang sudah di-cache) lewat convertTemplateLink(opt, "",
    // true) secara sinkron di client.
    const user = userEvent.setup({ delay: null });
    await render(<CurrencyLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Rupiah");
    });

    expect(axiosPost).toHaveBeenCalledTimes(1);

    const option = await screen.findByRole("option", {
      name: "Rupiah (IDR)",
    });
    expect(option).toBeInTheDocument();
  });

  it("membuka dropdown TIDAK menampilkan tombol tambah (disabledAddButton=true, tanpa form)", async () => {
    // CurrencyLinkModel.jsx mengunci disabledAddButton secara tetap (tidak
    // ada prop `form`/`titleDialog` yang dikirim ke LinkModel sama sekali).
    // disabledAdd di LinkModel.jsx (`if (disabledAddButton) return true`)
    // membuat CommandItem "+ tambah" tidak pernah dirender -- dikunci lewat
    // jumlah option persis = jumlah data mock (tanpa baris tambahan).
    const user = userEvent.setup({ delay: null });
    await render(<CurrencyLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("memilih opsi dari daftar hasil (filter client-side) memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CurrencyLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Rupiah");
    });

    const option = await screen.findByRole("option", {
      name: "Rupiah (IDR)",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "IDR", name: "Rupiah" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Currency) di-filter dari daftar SEBELUM dirender -- tidak pernah muncul di dropdown", async () => {
    // BEDA dari mode non-cache (NumberCard/Chart/Permission): filteredOptions
    // cache mode (LinkModel.jsx) memanggil
    // `options.filter((opt) => validate(opt, model))` SEBELUM opsi dipetakan
    // jadi CommandItem -- opsi dengan thisModel salah tidak pernah dirender
    // ke DOM sama sekali, beda dari mode non-cache yang tetap merender semua
    // hasil axios lalu baru menolak saat diklik (validate() di setOption()).
    // Test ini karena itu memverifikasi KETIDAKHADIRAN opsi tsb di daftar,
    // bukan "klik lalu onValueChange tidak terpanggil".
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            code: "IDR",
            name: "Rupiah",
            templateLink: ":name (:code)",
            thisModel: "App\\Models\\Core\\Currency",
          },
          {
            id: 9,
            code: "XXX",
            name: "Salah Model",
            templateLink: ":name (:code)",
            thisModel: "App\\Models\\Core\\Country",
          },
        ],
        total: 2,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<CurrencyLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    expect(
      await screen.findByRole("option", { name: "Rupiah (IDR)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Salah Model (XXX)" }),
    ).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Currency", async () => {
    // CurrencyLinkModel men-spread {...props} SETELAH prop tetap (model, as,
    // disabledAddButton, cache, cacheStorage) -- di JSX, atribut yang
    // ditulis belakangan menang. Jadi caller BISA menimpa `model` bawaan
    // Currency lewat prop tambahan. Bukan bug: konsekuensi urutan spread
    // yang perlu didokumentasikan lewat test supaya perilakunya tidak
    // berubah diam-diam saat file di-refactor. Dicek dari request mount
    // (cache mode), bukan on-type, krn CurrencyLinkModel fetch saat mount.
    await render(<CurrencyLinkModel model="AppModelsOverride" />);

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "AppModelsOverride" }),
        );
      });
    });
  });

  // Task 7.2 spec linkmodel-fetch-optimization: verifikasi cacheStorage
  // "sessionStorage" BENERAN nulis ke sessionStorage (bukan cuma payload
  // axios/UI dropdown seperti test lain di atas) -- ini titik yang paling
  // rawan regresi diam-diam kalau nanti persistence manual di
  // useLinkModelOptions.js berubah, karena tidak ada satu pun test lain di
  // file ini yang membaca sessionStorage secara langsung.
  it("fetch cache mode menulis snapshot ke sessionStorage dengan key linkmodel:<model>:...", async () => {
    await render(<CurrencyLinkModel />);

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    });

    const persistKey = buildPersistKey({
      model: "App\\Models\\Core\\Currency",
      filters: undefined,
      joins: undefined,
      with: undefined,
      keywords: undefined,
      order: undefined,
      translate: undefined,
    });
    const stored = JSON.parse(window.sessionStorage.getItem(persistKey));
    expect(stored?.data).toEqual([
      expect.objectContaining({ id: 1, code: "IDR" }),
      expect.objectContaining({ id: 2, code: "USD" }),
    ]);
    expect(typeof stored?.ts).toBe("number");
  });
});
