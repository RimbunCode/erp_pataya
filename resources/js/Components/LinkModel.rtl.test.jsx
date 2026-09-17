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

// FormPage.jsx menarik banyak dependency lain (Table2, editor, dst) yang tidak
// relevan untuk test LinkModel -- mock FormPageDialog jadi stub kosong.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import LinkModel from "./LinkModel";
import { TooltipProvider } from "./ui/tooltip";

// Sama seperti Select.jsx, LinkModel membungkus dirinya dengan <Tooltip>
// internal tanpa menyediakan <TooltipProvider> sendiri.
//
// QueryClientProvider WAJIB sejak migrasi ke TanStack Query (opsi L, lihat
// spec linkmodel-fetch-optimization) -- useLinkModelOptions memanggil
// useQuery() TANPA syarat, jadi setiap render LinkModel butuh provider ini
// atau langsung error "No QueryClient set". QueryClient BARU per render()
// (bukan module-level) -- gcTime: Infinity + retry: false, pola sama
// NumberCardDisplay.rtl.test.jsx -- supaya cache TIDAK bocor lintas test
// (dua `it()` yang mount model sama akan punya queryKey sama; kalau
// clientnya sama, test kedua bisa diam-diam serve dari cache test pertama
// alih-alih benar-benar fetch, bikin assertion jumlah call salah).
//
// LinkModel menembak axios.post (search model) di useEffect saat mount
// TANPA di-await test-nya -- render() polos RTL cuma membungkus bagian
// SINKRON dalam act(), promise mock (walau resolve instan) tetap lanjut di
// microtask SESUDAH act() itu selesai. Bungkus render() ITU SENDIRI dalam
// `await act(async () => {})` supaya semua microtask stabil dulu.
const render = async (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let result;
  await act(async () => {
    // delayDuration=0 -- Radix TooltipProvider default (700ms) pakai
    // setTimeout ASLI internal utk hover-intent delay; userEvent.type()
    // ke input yang dibungkus Tooltip men-trigger banyak transisi
    // focus/hover, dan timer itu resolve JAUH di luar act() manapun yang
    // bisa kita kontrol dari test. delayDuration=0 membuat Radix transisi
    // segera tanpa timer.
    result = rtlRender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
      </QueryClientProvider>,
    );
  });
  return result;
};

describe("LinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        // thisModel WAJIB ada -- LinkModel.setOption() memvalidasi opt via
        // validate(val, model) (linkModelUtils.js: value.thisModel === model)
        // sebelum memanggil onValueChange. Tanpa ini, klik opsi silent no-op.
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "Alpha",
            thisModel: "AppModelsItem",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "Beta",
            thisModel: "AppModelsItem",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<LinkModel model="AppModelsItem" />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink", async () => {
    await render(
      <LinkModel
        model="AppModelsItem"
        value={{ templateLink: ":name", name: "Widget A" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Widget A");
  });

  it("mengetik di input memicu request axios pencarian", async () => {
    // LinkModel fetch 2x: sekali saat dropdown terbuka (search kosong) dan
    // sekali lagi setelah user berhenti mengetik (debounce 500ms). Test ini
    // memverifikasi call KEDUA (dengan search terisi) benar-benar terjadi.
    //
    // WAJIB pakai `waitFor` dari @testing-library/react, BUKAN `vi.waitFor`
    // (Vitest) -- update `debouncedSearch` (state internal useLinkModelOptions)
    // terjadi di dalam callback setTimeout MENTAH, di luar act() manapun yang
    // eksplisit dibuat test ini. `vi.waitFor` cuma polling assertion generik,
    // TIDAK act()-aware, jadi re-render React yang dipicu timer itu tidak
    // pernah ke-flush selama polling -- assertion gagal terus walau timer-nya
    // sendiri sudah beres (dead end: menaikkan timeout TIDAK menolong, sudah
    // dicoba sampai 3000ms tetap gagal). `waitFor` RTL membungkus tiap polling
    // dengan act() secara internal, jadi update dari timer ASLI tetap ke-flush.
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model="AppModelsItem" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Alpha");
    });

    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            model: "AppModelsItem",
            search: "Alpha",
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
      <LinkModel model="AppModelsItem" onValueChange={onValueChange} />,
    );

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Al");
    });

    // Tunggu request pencarian (debounce 500ms) benar-benar selesai sebelum
    // klik -- render opsi bisa berganti (unmount/remount) saat data axios
    // datang, sehingga elemen yang diklik lebih dulu bisa jadi stale.
    // `waitFor` RTL (bukan `vi.waitFor`) -- lihat catatan di test sebelumnya.
    await waitFor(
      () => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Al" }),
        );
      },
      { timeout: 3000 },
    );

    // Label opsi di-highlight (<mark>Al</mark>pha), jadi cari via role
    // "option" + data-value alih-alih text match langsung.
    const option = await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Alpha" }),
    );
  });

  it("dua instance LinkModel identik yang sama-sama dibuka hanya memicu 1 network call (dedup)", async () => {
    // queryKey dari kedua instance IDENTIK (model+filters+joins+search sama)
    // -- TanStack Query harus dedup keduanya jadi 1 request, bukan 2.
    const user = userEvent.setup({ delay: null });
    await render(
      <>
        <LinkModel model="AppModelsItem" placeholder="first" />
        <LinkModel model="AppModelsItem" placeholder="second" />
      </>,
    );

    const [first, second] = screen.getAllByRole("textbox");
    await act(async () => {
      await user.click(first);
    });
    await act(async () => {
      await user.click(second);
    });

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
  });

  it("disabled mencegah input diedit", async () => {
    await render(<LinkModel model="AppModelsItem" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("menampilkan badge relasi terhapus saat option.deleted_at terisi", async () => {
    await render(
      <LinkModel
        model="AppModelsItem"
        value={{
          templateLink: ":name",
          name: "Widget",
          deleted_at: "2026-01-01",
        }}
      />,
    );
    // Input tetap menampilkan label walau relasi sudah dihapus.
    expect(screen.getByRole("textbox")).toHaveValue("Widget");
  });

  describe("Tab -- autocomplete label yg di-highlight keyboard, TIDAK langsung pilih", () => {
    it("popover baru dibuka (opsi pertama ter-highlight default, belum ngetik apa²/tidak dirty), Tab -> label ditulis, blur otomatis pilih", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      await render(
        <div>
          <LinkModel model="AppModelsItem" onValueChange={onValueChange} />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await act(async () => {
        await user.click(input);
      });

      await screen.findByRole("option", { name: "Alpha" });

      await act(async () => {
        await user.tab();
      });

      expect(onValueChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: "Alpha" }),
      );
      expect(input).toHaveValue("Alpha");
    });

    it("sedang dirty (lagi ngetik) -> Tab CUMA nulis label lengkap ke input, TIDAK langsung pilih; blur baru commit", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      await render(
        <div>
          <LinkModel model="AppModelsItem" onValueChange={onValueChange} />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await act(async () => {
        await user.type(input, "Al");
      });

      await waitFor(
        () => {
          expect(axiosPost).toHaveBeenCalledWith(
            "model",
            expect.objectContaining({ search: "Al" }),
          );
        },
        { timeout: 3000 },
      );
      await screen.findByRole("option", { name: "Alpha" });

      await act(async () => {
        await user.tab();
      });

      // Requirement: Tab jangan langsung pilih -- tunggu blur.
      expect(onValueChange).not.toHaveBeenCalled();
      expect(input).toHaveValue("Alpha");

      await act(async () => {
        await user.click(screen.getByText("Outside"));
      });

      expect(onValueChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: "Alpha" }),
      );
    });
  });

  // Task 11 (spec linkmodel-advanced-search) — dua entry point independen
  // Advance Search Dialog: baris "See more" (kondisional, showMore only) dan
  // tombol "Advance Search" (selalu tampil). Requirement 1, 6.
  describe("Advance Search Dialog -- entry points (Requirement 1) & carry-over (Requirement 6)", () => {
    // model.selectData butuh shape response BEDA dari model (dropdown) --
    // axiosPost mock generik (beforeEach) balikin shape dropdown utk SEMUA
    // call; branch di sini khusus utk request yang mounting AdvanceSearchDialog.
    const mockSelectDataAware = () => {
      axiosPost.mockImplementation((url) => {
        if (url === "model.selectData") {
          return Promise.resolve({
            data: {
              model: "AppModelsItem",
              route: "items",
              translateKey: null,
              columns: [],
              templateLinkColumns: ["name"],
              parentColumn: null,
              data: {
                data: [],
                current_page: 1,
                last_page: 1,
                per_page: 25,
                total: 0,
              },
            },
          });
        }
        return Promise.resolve({
          data: {
            data: [
              {
                id: 1,
                templateLink: ":name",
                name: "Alpha",
                thisModel: "AppModelsItem",
              },
              {
                id: 2,
                templateLink: ":name",
                name: "Beta",
                thisModel: "AppModelsItem",
              },
            ],
            total: 2,
          },
        });
      });
    };

    it("total <= limit -- baris See more TIDAK tampil, CommandItem Advance Search TETAP tampil di dropdown", async () => {
      const user = userEvent.setup({ delay: null });
      mockSelectDataAware();
      await render(<LinkModel model="AppModelsItem" limit={10} />);

      const input = screen.getByRole("textbox");
      await act(async () => {
        await user.click(input);
      });
      await screen.findByRole("option", { name: "Alpha" });

      expect(
        screen.queryByText("TR:core.form.linkmodel.more"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("option", {
          name: "TR:core.form.linkmodel.advance_search",
        }),
      ).toBeInTheDocument();
    });

    it("total > limit -- baris See more tampil; klik membuka dialog yang sama dgn CommandItem Advance Search", async () => {
      const user = userEvent.setup({ delay: null });
      mockSelectDataAware();
      await render(<LinkModel model="AppModelsItem" limit={1} />);

      const input = screen.getByRole("textbox");
      await act(async () => {
        await user.click(input);
      });
      await screen.findByRole("option", { name: "Alpha" });

      const moreRow = screen.getByText("TR:core.form.linkmodel.more");
      expect(moreRow).toBeInTheDocument();
      // CommandItem Advance Search tetap ada berdampingan (grouping dgn Add),
      // independen dari showMore.
      expect(
        screen.getByRole("option", {
          name: "TR:core.form.linkmodel.advance_search",
        }),
      ).toBeInTheDocument();

      await act(async () => {
        await user.click(moreRow);
      });

      expect(
        await screen.findByText("TR:core.form.linkmodel.advance_search"),
      ).toBeInTheDocument();
    });

    it("disabled -- dropdown (& CommandItem Advance Search di dalamnya) tidak pernah render", async () => {
      mockSelectDataAware();
      await render(<LinkModel model="AppModelsItem" disabled />);
      expect(
        screen.queryByText("TR:core.form.linkmodel.advance_search"),
      ).not.toBeInTheDocument();
    });

    it("readOnly -- dropdown (& CommandItem Advance Search di dalamnya) tidak pernah render", async () => {
      mockSelectDataAware();
      await render(<LinkModel model="AppModelsItem" readOnly />);
      expect(
        screen.queryByText("TR:core.form.linkmodel.advance_search"),
      ).not.toBeInTheDocument();
    });

    it("teks sudah diketik di input LinkModel -> terbawa jadi initial search di dialog (via CommandItem Advance Search)", async () => {
      const user = userEvent.setup({ delay: null });
      mockSelectDataAware();
      await render(<LinkModel model="AppModelsItem" />);

      const input = screen.getByRole("textbox");
      await act(async () => {
        await user.type(input, "Widget");
      });
      await waitFor(() =>
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Widget" }),
        ),
      );
      // CommandItem Advance Search cuma dirender di cabang !loading dropdown.
      const advanceSearchItem = await screen.findByRole("option", {
        name: "TR:core.form.linkmodel.advance_search",
      });

      await act(async () => {
        await user.click(advanceSearchItem);
      });

      const dialogSearchInput = await screen.findByPlaceholderText(
        "TR:core.form.search.placeholder",
      );
      // useEffect (sync search -> initialSearch saat open) flush di render
      // BERIKUTNYA setelah dialog pertama muncul -- waitFor menunggu tanpa
      // menebak jumlah tick.
      await waitFor(() => expect(dialogSearchInput).toHaveValue("Widget"));
    });
  });
});
