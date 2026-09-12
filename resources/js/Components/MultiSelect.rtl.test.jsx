import { describe, expect, it, vi } from "vitest";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

import MultiSelect from "./MultiSelect";
import { TooltipProvider } from "./ui/tooltip";

// MultiSelect membungkus dirinya dengan <Tooltip> internal (ringkasan value
// terpilih saat popover tertutup) tanpa menyediakan <TooltipProvider> sendiri
// -- provider itu disediakan sekali di app-level (lihat pemakaian nyata di
// Select.jsx/LinkModel.jsx, pola sama). delayDuration=0 -- Radix default
// (700ms hover-intent) pakai setTimeout ASLI di luar act() manapun yang bisa
// dikontrol test; nol-kan biar transisi Radix langsung tanpa timer (pola sama
// LinkModel.rtl.test.jsx).
const render = (ui) =>
  rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("MultiSelect", () => {
  it("render input kosong tanpa value", () => {
    render(<MultiSelect options={options} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("placeholder menampilkan ringkasan label value terpilih", () => {
    render(<MultiSelect options={options} value={["a", "b"]} />);
    expect(screen.getByPlaceholderText("Alpha, Beta")).toBeInTheDocument();
  });

  it("membuka popover menampilkan seluruh opsi sebagai checkbox", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MultiSelect options={options} />);

    await user.click(screen.getByRole("textbox"));

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("klik opsi menambahkan value via onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={[]}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("textbox"));
    await user.click(await screen.findByText("Alpha"));

    expect(onValueChange).toHaveBeenCalledWith(["a"]);
  });

  it("klik opsi yang sudah terpilih menghapusnya (toggle)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={["a"]}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("textbox"));
    await user.click(await screen.findByText("Alpha"));

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it("tombol clear (X) mengosongkan seluruh value", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={["a", "b"]}
        onValueChange={onValueChange}
      />,
    );

    const clearButton = screen.getByRole("button");
    await user.click(clearButton);

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it("disabled mencegah interaksi dan tidak menampilkan tombol clear", () => {
    render(<MultiSelect options={options} value={["a"]} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("badge jumlah terpilih (tertutup: quick-glance; terbuka: umpan balik realtime)", () => {
    it("badge TAMPIL saat popover TERTUTUP jika ada value terpilih", () => {
      render(
        <MultiSelect options={options} value={["a"]} placeholder="Pilih" />,
      );
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("badge closed DISEMBUNYIKAN kalau semua option ke-check DAN showAllOption aktif (teks ringkasan udah diciutkan jadi label All -- badge angka jadi redundan)", () => {
      render(
        <MultiSelect options={options} value={["a", "b", "c"]} showAllOption />,
      );
      expect(screen.getByRole("textbox")).toHaveValue("TR:core.form.all");
      expect(screen.queryByText("3")).not.toBeInTheDocument();
    });

    it("badge closed TETAP tampil kalau semua ke-check tapi showAllOption OFF (teks gak diciutkan jadi All)", () => {
      render(<MultiSelect options={options} value={["a", "b", "c"]} />);
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("badge tidak tampil sama sekali kalau tidak ada value terpilih (tertutup maupun terbuka)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} />);

      expect(screen.queryByText("0")).not.toBeInTheDocument();
      await user.click(screen.getByRole("textbox"));
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("badge tampil jumlah terpilih saat popover terbuka, update live per toggle", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <MultiSelect
          options={options}
          value={[]}
          placeholder="Pilih"
          changeOnBlur
        />,
      );

      await user.click(screen.getByRole("textbox"));
      expect(screen.queryByText("1")).not.toBeInTheDocument();

      await user.click(await screen.findByText("Alpha"));
      expect(screen.getByText("1")).toBeInTheDocument();

      await user.click(screen.getByText("Beta"));
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("badge hilang lagi begitu turun ke 0 terpilih", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <MultiSelect options={options} value={["a"]} placeholder="Pilih" />,
      );

      await user.click(screen.getByRole("textbox"));
      expect(screen.getByText("1")).toBeInTheDocument();

      await user.click(screen.getByText("Alpha"));
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
  });

  describe("showAllOption", () => {
    it("klik All saat belum ada yang terpilih -> select semua option", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
          showAllOption
        />,
      );

      await user.click(screen.getByRole("textbox"));
      await user.click(await screen.findByText("TR:core.form.all"));

      expect(onValueChange).toHaveBeenCalledWith(["a", "b", "c"]);
    });

    it("klik All saat semua sudah terpilih -> uncheck semua (kosong)", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={["a", "b", "c"]}
          onValueChange={onValueChange}
          showAllOption
        />,
      );

      await user.click(screen.getByRole("textbox"));
      await user.click(await screen.findByText("TR:core.form.all"));

      expect(onValueChange).toHaveBeenCalledWith([]);
    });

    it("sebagian option terpilih -> checkbox All jadi indeterminate", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={["a"]} showAllOption />);

      await user.click(screen.getByRole("textbox"));
      await screen.findByText("TR:core.form.all");

      const allCheckbox = screen.getByRole("forminput", {
        name: "TR:core.form.all",
      });
      expect(allCheckbox).toHaveAttribute("data-state", "indeterminate");
    });

    it("semua option terpilih -> checkbox All checked, placeholder tampil label All (bukan daftar penuh)", () => {
      render(
        <MultiSelect options={options} value={["a", "b", "c"]} showAllOption />,
      );

      expect(
        screen.getByPlaceholderText("TR:core.form.all"),
      ).toBeInTheDocument();
    });

    it("tanpa showAllOption, baris All tidak dirender sama sekali", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} />);

      await user.click(screen.getByRole("textbox"));
      await screen.findByText("Alpha");

      expect(screen.queryByText("TR:core.form.all")).not.toBeInTheDocument();
    });

    it("saat searching, baris All disembunyikan (select-all ambigu terhadap hasil filter)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} showAllOption />);

      await user.click(screen.getByRole("textbox"));
      await user.type(screen.getByRole("textbox"), "Alpha");

      expect(await screen.findByText("Alpha")).toBeInTheDocument();
      expect(screen.queryByText("TR:core.form.all")).not.toBeInTheDocument();
    });
  });

  describe("defaultValue", () => {
    it("value undefined -> fallback ke defaultValue (array)", () => {
      render(<MultiSelect options={options} defaultValue={["a", "b"]} />);
      expect(screen.getByPlaceholderText("Alpha, Beta")).toBeInTheDocument();
    });

    it("value null eksplisit -> tetap fallback ke defaultValue (nilai tunggal, dibungkus array)", () => {
      render(<MultiSelect options={options} value={null} defaultValue="a" />);
      expect(screen.getByPlaceholderText("Alpha")).toBeInTheDocument();
    });

    it("value diisi eksplisit -> defaultValue diabaikan", () => {
      render(
        <MultiSelect options={options} value={["c"]} defaultValue={["a"]} />,
      );
      expect(screen.getByPlaceholderText("Gamma")).toBeInTheDocument();
    });
  });

  describe("changeOnBlur", () => {
    it("toggle checkbox TIDAK langsung panggil onValueChange, baru dipanggil saat popover ditutup", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <MultiSelect
            options={options}
            value={[]}
            onValueChange={onValueChange}
            changeOnBlur
          />
          <button type="button">Outside</button>
        </div>,
      );

      await user.click(screen.getByRole("textbox"));
      await user.click(await screen.findByText("Alpha"));

      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(screen.getByText("Outside"));

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(["a"]);
    });

    it("checkbox tetap update realtime (visual) walau onValueChange belum dipanggil", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} changeOnBlur />);

      await user.click(screen.getByRole("textbox"));
      await user.click(await screen.findByText("Alpha"));

      expect(screen.getByRole("forminput", { name: "Alpha" })).toHaveAttribute(
        "data-state",
        "checked",
      );
    });

    it("tutup popover tanpa perubahan apa pun TIDAK memicu onValueChange", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <MultiSelect
            options={options}
            value={["a"]}
            onValueChange={onValueChange}
            changeOnBlur
          />
          <button type="button">Outside</button>
        </div>,
      );

      await user.click(screen.getByRole("textbox"));
      await user.click(screen.getByText("Outside"));

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("tombol clear (X) tetap langsung panggil onValueChange, tanpa nunggu blur", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={["a", "b"]}
          onValueChange={onValueChange}
          changeOnBlur
        />,
      );

      await user.click(screen.getByRole("button"));

      expect(onValueChange).toHaveBeenCalledWith([]);
    });
  });

  describe("delimiters -- tag-input style commit (clear-after-commit)", () => {
    it("ketik label persis lalu delimiter default (,) -> otomatis check & search DIKOSONGKAN lagi", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Alpha,");

      expect(onValueChange).toHaveBeenCalledWith(["a"]);
      // Input dikosongkan lagi begitu commit -- BUKAN direpresentasikan
      // permanen di teks (input bukan buffer panjang berisi semua terpilih).
      expect(input).toHaveValue("");
    });

    it("match case-insensitive & abaikan spasi di pinggir", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "  alpha  ,");

      expect(onValueChange).toHaveBeenCalledWith(["a"]);
    });

    it("ketik label persis lalu blur (klik luar, tanpa delimiter) -> otomatis check, input balik tampil RINGKASAN (bukan kosong)", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <MultiSelect
            options={options}
            value={[]}
            onValueChange={onValueChange}
          />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Beta");
      await user.click(screen.getByText("Outside"));

      expect(onValueChange).toHaveBeenCalledWith(["b"]);
      // Popover TERTUTUP -> input balik ke mode ringkasan (bukan dikosongkan
      // -- itu cuma berlaku SELAMA mode edit/popover terbuka).
      expect(input).toHaveValue("Beta");
    });

    it("teks TIDAK match option manapun -> tidak ada yang di-commit, tapi input TETAP dikosongkan (delimiter = penanda selesai entry, cocok atau tidak)", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Zzz,");

      expect(onValueChange).not.toHaveBeenCalled();
      expect(input).toHaveValue("");
    });

    it("prop delimiters kustom -- delimiter default (,) TIDAK lagi commit, cuma yang dikonfigurasi", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
          delimiters=";"
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      // "," bukan delimiter yg dikonfigurasi -- tetap teks literal, TIDAK commit.
      await user.type(input, "Alpha,");
      expect(onValueChange).not.toHaveBeenCalled();

      await user.clear(input);
      await user.type(input, "Alpha;");
      expect(onValueChange).toHaveBeenCalledWith(["a"]);
    });

    it("setelah commit via delimiter, input bersih siap searching option berikutnya", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} />);

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Alpha,");
      await user.type(input, "Bet");

      // aria-label checkbox tidak ikut ter-split <mark> spt teks highlight-nya.
      expect(
        screen.getByRole("forminput", { name: "Beta" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("forminput", { name: "Alpha" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("forminput", { name: "Gamma" }),
      ).not.toBeInTheDocument();
    });

    it("klik checkbox TIDAK menutup popover (mousedown preventDefault menjaga fokus Input)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} />);

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.click(screen.getByText("Alpha"));

      // Beta & Gamma masih terlihat -> popover masih terbuka setelah 1 klik.
      expect(screen.getByText("Beta")).toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });

    it("klik checkbox TIDAK menyentuh teks di input (search dibiarkan apa adanya)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} />);

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "a");
      // aria-label checkbox tidak ikut ter-split <mark> spt teks highlight-nya.
      await user.click(screen.getByRole("forminput", { name: "Alpha" }));

      // Klik checkbox BUKAN lagi jalur buat regenerasi teks -- input tetap
      // apa yg lagi diketik user ("a"), bukan diganti jadi "Alpha".
      expect(input).toHaveValue("a");
    });
  });

  describe("paste multi-entry", () => {
    it("paste teks berisi beberapa entry sekaligus -> semua yang match langsung ke-check, input dikosongkan", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.paste("Alpha, Beta");

      // Entry TERAKHIR ("Beta") juga ke-commit walau gak diakhiri delimiter
      // -- beda dari ngetik manual, krn paste itu aksi sekali-jadi.
      expect(onValueChange).toHaveBeenCalledWith(
        expect.arrayContaining(["a", "b"]),
      );
      expect(onValueChange.mock.calls.at(-1)[0]).toHaveLength(2);
      expect(input).toHaveValue("");
    });

    it("paste 1 entry tanpa delimiter -> diperlakukan spt ngetik biasa (belum otomatis check)", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.paste("Alpha");

      expect(onValueChange).not.toHaveBeenCalled();
      expect(input).toHaveValue("Alpha");
    });
  });

  describe("dua mode: tertutup = ringkasan, terbuka = buffer edit kosong", () => {
    it("mount dgn value awal -- input tampil RINGKASAN (join label), krn popover mulai tertutup", () => {
      render(<MultiSelect options={options} value={["a", "c"]} />);
      expect(screen.getByRole("textbox")).toHaveValue("Alpha, Gamma");
    });

    it("semua option terpilih & showAllOption aktif -- ringkasan diciutkan jadi label All", () => {
      render(
        <MultiSelect options={options} value={["a", "b", "c"]} showAllOption />,
      );
      expect(screen.getByRole("textbox")).toHaveValue("TR:core.form.all");
    });

    it("buka popover dgn value awal -- ringkasan DIKOSONGKAN, mode edit mulai bersih (bukan lanjut edit teks ringkasan)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={["a"]} />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("Alpha");
      await user.click(input);
      expect(input).toHaveValue("");
    });

    it("ketik delimiter -> dropdown balik nampilin SEMUA option (isDirty balik false, gak nyangkut filter lama)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={[]} />);

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Al");

      // Sedang searching "Al" -> Beta & Gamma tersaring keluar.
      expect(screen.queryByText("Beta")).not.toBeInTheDocument();

      await user.type(input, "pha,");

      // Delimiter diketik -> Alpha ke-commit & dropdown kembali nampilin semua.
      expect(screen.getByText("Beta")).toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });

    it("klik checkbox TIDAK bikin opsi lain ikut ke-highlight keliru", async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(
        <MultiSelect options={options} value={[]} />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.click(screen.getByText("Beta"));

      expect(container.querySelectorAll("mark")).toHaveLength(0);
    });
  });

  describe("Tab -- autocomplete label yg di-highlight keyboard, TIDAK langsung check", () => {
    // cmdk otomatis meng-highlight opsi PERTAMA begitu list dirender (tanpa
    // butuh ArrowDown sama sekali).
    it("sedang dirty (lagi ngetik/nyari) -> Tab CUMA nulis label lengkap ke buffer (autocomplete), TIDAK langsung check; fokus tetap di input", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <MultiSelect
            options={options}
            value={[]}
            onValueChange={onValueChange}
          />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Bet"); // isDirty jadi true, "Beta" ke-highlight (satu²nya match)
      await waitFor(() => {
        const item = document.querySelector(
          '[cmdk-item=""][data-selected="true"]',
        );
        expect(item?.getAttribute("data-value")).toBe("b");
      });
      await user.tab();

      // Requirement: Tab jangan langsung check -- tunggu delimiter/blur.
      expect(onValueChange).not.toHaveBeenCalled();
      // isDirty true -> Tab di-preventDefault, fokus TETAP di input.
      expect(input).toHaveFocus();
      expect(input).toHaveValue("Beta");

      // Ketik delimiter berikutnya -> BARU beneran ke-commit.
      await user.type(input, ",");
      expect(onValueChange).toHaveBeenCalledWith(["b"]);
      expect(input).toHaveValue("");
    });

    it("popover baru dibuka (opsi pertama ter-highlight default, belum ngetik apa²/tidak dirty), lalu Tab -> label ditulis, fokus PINDAH keluar -> blur otomatis commit", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <MultiSelect
            options={options}
            value={[]}
            onValueChange={onValueChange}
          />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.tab();

      // Gak dirty sebelum Tab -> Tab TIDAK di-preventDefault -> fokus pindah
      // keluar spt tab-navigation biasa -- itu trigger blur ASLI, dan blur-
      // lah (bukan Tab-nya sendiri) yang commit label yg baru ditulis.
      expect(input).not.toHaveFocus();
      expect(onValueChange).toHaveBeenCalledWith(["a"]);
      expect(input).toHaveValue("Alpha");
    });

    it("Tab di baris All (showAllOption) -> tulis label All ke buffer, blur berikutnya commit select-semua", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
          showAllOption
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.tab();

      expect(onValueChange).toHaveBeenCalledWith(["a", "b", "c"]);
    });

    it("ArrowDown pindah highlight ke opsi ke-2, lalu Tab -> label opsi ke-2 yg ditulis (bukan yang pertama)", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <MultiSelect
            options={options}
            value={[]}
            onValueChange={onValueChange}
          />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      // ArrowDown lewat Input jg mentrigger isDirty=true (perilaku existing
      // `onInputKeyDown` -- semua tombol selain Tab/Enter/modifier dianggap
      // "mulai berinteraksi") -- jadi abis ArrowDown, Tab akan TERKUNCI di
      // input (bukan langsung blur+commit spt kalau belum ngetik apa²).
      await user.keyboard("{ArrowDown}");
      await user.tab();

      expect(input).toHaveValue("Beta");
      expect(onValueChange).not.toHaveBeenCalled();

      // Delimiter berikutnya -> BARU beneran ke-commit.
      await user.type(input, ",");
      expect(onValueChange).toHaveBeenCalledWith(["b"]);
    });

    it("daftar option kosong (hasil search gak ketemu) -> Tab TIDAK nulis/commit apa-apa", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          options={options}
          value={[]}
          onValueChange={onValueChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Zzz");
      await user.tab();

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe("tooltip (Radix) saat popover tertutup", () => {
    // Radix Tooltip (bukan native `title` lagi) -- lihat dok prop di atas.
    // Percobaan pertama nesting Tooltip+Popover di komponen ini SEMPAT
    // dikira gak bisa (popover ketutup sendiri abis 1 klik checkbox), TAPI
    // itu ternyata bug di STRUKTUR percobaan itu (ada div ekstra nyelip di
    // antara TooltipTrigger asChild & PopoverTrigger asChild), BUKAN
    // ketidakcocokan Radix Tooltip+Popover secara umum -- Select.jsx &
    // LinkModel.jsx sudah lama pakai pola nesting yg SAMA (TooltipTrigger
    // asChild membungkus PopoverTrigger asChild LANGSUNG, tanpa elemen
    // perantara) dan popovernya baik-baik saja. Diverifikasi ulang di sini:
    // 48/49 test lain (semua interaksi checkbox/Tab/delimiter dst) TETAP
    // hijau dengan Tooltip asli terpasang.
    it("ada value terpilih & popover tertutup -> tooltip muncul saat di-hover, berisi daftar per-item (bukan satu string gabungan)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={["a", "b"]} />);

      await user.hover(screen.getByRole("textbox"));
      const tooltip = await screen.findByRole("tooltip");

      // List terpisah -- masing-masing label muncul sbg baris sendiri.
      expect(within(tooltip).getByText("Alpha")).toBeInTheDocument();
      expect(within(tooltip).getByText("Beta")).toBeInTheDocument();
    });

    it("tidak ada value terpilih -> tooltip tidak dirender sama sekali (gak ada apa pun buat ditampilkan)", () => {
      render(<MultiSelect options={options} value={[]} />);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("popover TERBUKA -> tooltip tidak dirender (lagi mode edit, bukan lihat ringkasan)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={["a"]} />);

      const input = screen.getByRole("textbox");
      await user.click(input);

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  describe("valueBefore -- diff before/after (pola sama Select.jsx/LinkModel.jsx)", () => {
    it("value beda dari valueBefore -> border ke-highlight & tooltip tandai per-item added/removed", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <MultiSelect
          options={options}
          value={["a", "c"]}
          valueBefore={["a", "b"]}
        />,
      );

      const input = screen.getByRole("textbox");
      expect(input.closest('[class*="bg-yellow-200"]')).toBeInTheDocument();

      await user.hover(input);
      const tooltip = await screen.findByRole("tooltip");

      // Alpha gak berubah -- tanpa class diff apapun.
      expect(within(tooltip).getByText("Alpha").className).not.toMatch(
        /bg-(green|red)/,
      );
      // Gamma baru ditambahkan.
      expect(within(tooltip).getByText("Gamma").className).toMatch(/bg-green/);
      // Beta dihapus -- ditampilkan tercoret.
      const removed = within(tooltip).getByText("Beta");
      expect(removed.className).toMatch(/bg-red/);
      expect(removed.className).toMatch(/line-through/);
    });

    it("valueBefore SAMA dgn value (urutan beda) -> TIDAK dianggap berubah, gak ada highlight border", () => {
      render(
        <MultiSelect
          options={options}
          value={["a", "b"]}
          valueBefore={["b", "a"]}
        />,
      );
      const input = screen.getByRole("textbox");
      expect(input.closest('[class*="bg-yellow-200"]')).not.toBeInTheDocument();
    });

    it("tanpa valueBefore -> tooltip list biasa, gak ada class diff apapun", async () => {
      const user = userEvent.setup({ delay: null });
      render(<MultiSelect options={options} value={["a"]} />);

      await user.hover(screen.getByRole("textbox"));
      const tooltip = await screen.findByRole("tooltip");

      expect(within(tooltip).getByText("Alpha").className).not.toMatch(
        /bg-(green|red)/,
      );
    });
  });
});
