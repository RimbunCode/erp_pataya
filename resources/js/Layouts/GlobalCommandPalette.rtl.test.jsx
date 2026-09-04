import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const axiosGet = vi.fn();
const axiosPost = vi.fn();
const axiosDelete = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...args) => axiosGet(...args),
    post: (...args) => axiosPost(...args),
    delete: (...args) => axiosDelete(...args),
  },
}));

const routerVisit = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { visit: (...args) => routerVisit(...args) },
}));

const setThemeSpy = vi.fn();
vi.mock("@/Hooks/useTheme", () => ({
  default: () => ({ setTheme: setThemeSpy }),
}));

// route() global (Ziggy) -- dites cukup dgn identity function spt pola test
// lain (InputBarcode.rtl.test.jsx, LinkPicker.rtl.test.jsx): argumen pertama
// (nama route) dikembalikan apa adanya supaya assertion axios bisa cek nama
// route persis.
window.route = (name) => name;

import GlobalCommandPalette from "./GlobalCommandPalette";

const DEFAULT_RESULTS = {
  navigation: [],
  documents: [],
  recent: [],
  meta: {
    intent: {
      is_scoped: false,
      doctype_model: null,
      doctype_token: null,
      code_tokens: [],
      prioritize_documents: false,
    },
  },
};

function makeResults(overrides = {}) {
  return {
    ...DEFAULT_RESULTS,
    ...overrides,
    meta: {
      intent: {
        ...DEFAULT_RESULTS.meta.intent,
        ...(overrides.meta?.intent ?? {}),
      },
    },
  };
}

const navCommand = {
  signature: "nav-1",
  type: "navigation",
  title: "Item Master",
  subtitle: "Inventory",
  route_name: "items.index",
  route_params: {},
  url: "/items",
};

const docCommand = {
  signature: "doc-1",
  type: "record",
  title: "PO-0001",
  subtitle: "Purchase Order",
  route_name: "purchase-orders.show",
  route_params: { purchase_order: 1 },
  url: "/purchase-orders/1",
  target_model_type: "App\\Models\\Purchase\\PurchaseOrder",
  target_model_id: 1,
};

const recentCommand = {
  recent_key: "recent-1",
  type: "record",
  title: "Recent Sales Order",
  subtitle: "Sales",
  route_name: "sales-orders.show",
  route_params: { sales_order: 5 },
  url: "/sales-orders/5",
};

let capturedTrigger;
const handleRegister = vi.fn((fn) => {
  capturedTrigger = fn;
});

function renderPalette(props) {
  return render(
    <GlobalCommandPalette onRegisterOpenTrigger={handleRegister} {...props} />,
  );
}

/**
 * Buka dialog lewat trigger yg didaftarkan ke onRegisterOpenTrigger (pola
 * pemakaian nyata di AppLayout.jsx via Navbar).
 */
async function openPalette() {
  await act(async () => {
    capturedTrigger();
  });
}

beforeEach(() => {
  axiosGet.mockReset();
  axiosPost.mockReset();
  axiosDelete.mockReset();
  routerVisit.mockReset();
  setThemeSpy.mockReset();
  handleRegister.mockReset();
  capturedTrigger = undefined;
  axiosGet.mockResolvedValue({ data: { data: makeResults() } });
  axiosPost.mockResolvedValue({});
  axiosDelete.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GlobalCommandPalette — registrasi trigger buka/tutup", () => {
  it("mendaftarkan toggleSearch via onRegisterOpenTrigger saat mount", () => {
    renderPalette();

    expect(handleRegister).toHaveBeenCalledWith(expect.any(Function));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("memanggil trigger yg terdaftar membuka dialog", async () => {
    renderPalette();

    await openPalette();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("unmount membersihkan trigger dgn memanggil onRegisterOpenTrigger(null)", () => {
    const { unmount } = renderPalette();
    handleRegister.mockClear();

    unmount();

    expect(handleRegister).toHaveBeenCalledWith(null);
  });
});

describe("GlobalCommandPalette — shortcut keyboard global", () => {
  it("Ctrl+K membuka dialog", () => {
    renderPalette();

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Meta+K (Cmd, macOS) membuka dialog", () => {
    renderPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("'/' membuka dialog", () => {
    renderPalette();

    fireEvent.keyDown(document, { key: "/" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Ctrl+K kedua menutup kembali dialog yg terbuka (toggle)", () => {
    renderPalette();

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("'/' diketik di dalam elemen input lain TIDAK membuka dialog (menghindari bentrok input form biasa)", () => {
    renderPalette();
    const outsideInput = document.createElement("input");
    document.body.appendChild(outsideInput);

    fireEvent.keyDown(outsideInput, { key: "/" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    document.body.removeChild(outsideInput);
  });

  it("Ctrl+K di dalam textarea TIDAK membuka dialog", () => {
    renderPalette();
    const outsideTextarea = document.createElement("textarea");
    document.body.appendChild(outsideTextarea);

    fireEvent.keyDown(outsideTextarea, { key: "k", ctrlKey: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    document.body.removeChild(outsideTextarea);
  });
});

describe("GlobalCommandPalette — state kosong (belum ada query)", () => {
  it("menampilkan grup Theme dgn 3 opsi (Light, Dark, System) saat dialog dibuka tanpa query", async () => {
    renderPalette();
    await openPalette();

    const themeGroup = screen.getByText("Theme").closest("[cmdk-group]");
    expect(within(themeGroup).getByText("Light")).toBeInTheDocument();
    expect(within(themeGroup).getByText("Dark")).toBeInTheDocument();
    expect(within(themeGroup).getByText("System")).toBeInTheDocument();
  });

  it("grup Recent tidak muncul sebelum hasil pencarian awal datang (recent masih kosong)", async () => {
    axiosGet.mockResolvedValue({ data: { data: makeResults() } });
    renderPalette();
    await openPalette();

    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });
});

describe("GlobalCommandPalette — fetch pencarian ter-debounce", () => {
  it("mengetik query memicu axios.get ke commands.search SETELAH debounce 500ms, dgn q & limit yg benar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();
    axiosGet.mockClear(); // buang panggilan awal saat dialog dibuka (q kosong)

    await user.type(screen.getByRole("combobox"), "widget");
    expect(axiosGet).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(axiosGet).toHaveBeenCalledTimes(1);
    expect(axiosGet).toHaveBeenCalledWith(
      "commands.search",
      expect.objectContaining({
        params: { q: "widget", limit: 30 },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("mengetik cepat hanya menghasilkan SATU request dgn nilai akhir (debounce direset tiap keystroke)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();
    axiosGet.mockClear();

    await user.type(screen.getByRole("combobox"), "abc");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(axiosGet).toHaveBeenCalledTimes(1);
    expect(axiosGet).toHaveBeenCalledWith(
      "commands.search",
      expect.objectContaining({ params: { q: "abc", limit: 30 } }),
    );
  });

  it("menampilkan 'Searching...' selagi request berjalan, lalu 'No results found.' setelah selesai kosong", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveRequest;
    axiosGet.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "xyz");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("Searching...")).toBeInTheDocument();

    await act(async () => {
      resolveRequest({ data: { data: makeResults() } });
      await Promise.resolve();
    });

    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("error non-abort saat fetch me-reset commandResults ke default (grup hasil hilang)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet
      .mockResolvedValueOnce({
        data: { data: makeResults({ navigation: [navCommand] }) },
      })
      .mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "a");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText("Item Master")).toBeInTheDocument();

    await user.type(screen.getByRole("combobox"), "b");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.queryByText("Item Master")).not.toBeInTheDocument();
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });
});

describe("GlobalCommandPalette — grup hasil & urutan (Navigation/Documents/Recent)", () => {
  it("prioritize_documents=false (default) -> grup Navigation muncul sebelum Documents", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: {
        data: makeResults({
          navigation: [navCommand],
          documents: [docCommand],
          meta: { intent: { prioritize_documents: false } },
        }),
      },
    });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "po");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const headings = screen
      .getAllByText(/Navigation|Documents/)
      .map((el) => el.textContent);
    expect(headings).toEqual(["Navigation", "Documents"]);
  });

  it("prioritize_documents=true -> grup Documents muncul sebelum Navigation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: {
        data: makeResults({
          navigation: [navCommand],
          documents: [docCommand],
          meta: { intent: { prioritize_documents: true } },
        }),
      },
    });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "po-0001");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const headings = screen
      .getAllByText(/Navigation|Documents/)
      .map((el) => el.textContent);
    expect(headings).toEqual(["Documents", "Navigation"]);
  });

  it("subtitle command ditampilkan di bawah title", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: { data: makeResults({ navigation: [navCommand] }) },
    });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "item");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("Item Master")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
  });

  it("grup Recent HANYA tampil saat query kosong, meski server mengirim data recent", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: { data: makeResults({ recent: [recentCommand] }) },
    });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Recent Sales Order")).toBeInTheDocument();

    await user.type(screen.getByRole("combobox"), "cari");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });
});

describe("GlobalCommandPalette — memilih command (navigasi + tracking)", () => {
  it("klik command memanggil axios.post ke commands.recent.track dgn payload lengkap, router.visit(url), lalu menutup dialog", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: { data: makeResults({ navigation: [navCommand] }) },
    });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "item");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await user.click(screen.getByText("Item Master"));

    expect(routerVisit).toHaveBeenCalledWith("/items");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(axiosPost).toHaveBeenCalledWith(
      "commands.recent.track",
      expect.objectContaining({
        command: expect.objectContaining({
          signature: "nav-1",
          type: "navigation",
          title: "Item Master",
          subtitle: "Inventory",
          route_name: "items.index",
          route_params: {},
          target_model_type: null,
          target_model_id: null,
        }),
      }),
    );
  });

  it("command tanpa route_name TIDAK memicu axios.post tracking, tapi router.visit tetap dipanggil", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: {
        data: makeResults({
          navigation: [{ ...navCommand, route_name: null }],
        }),
      },
    });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "item");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await user.click(screen.getByText("Item Master"));

    expect(routerVisit).toHaveBeenCalledWith("/items");
    expect(axiosPost).not.toHaveBeenCalled();
  });
});

describe("GlobalCommandPalette — Recent: hapus satu & hapus semua", () => {
  async function openWithRecent() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: { data: makeResults({ recent: [recentCommand] }) },
    });
    renderPalette();
    await openPalette();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
  }

  it("klik tombol remove menghapus item dari daftar (optimistic) & memanggil axios.delete dgn recent_key", async () => {
    await openWithRecent();
    const user = userEvent.setup({ delay: null });

    await user.click(
      screen.getByRole("button", {
        name: "Remove Recent Sales Order from recent",
      }),
    );

    expect(screen.queryByText("Recent Sales Order")).not.toBeInTheDocument();
    expect(axiosDelete).toHaveBeenCalledWith(
      "commands.recent.remove",
      expect.objectContaining({ data: { recent_key: "recent-1" } }),
    );
  });

  it("axios.delete gagal -> item recent dikembalikan lagi ke daftar (rollback)", async () => {
    axiosDelete.mockRejectedValue(new Error("gagal hapus"));
    await openWithRecent();
    const user = userEvent.setup({ delay: null });

    // TIDAK dibungkus act() manual di sini (beda dari test lain di atas
    // yg sengaja pakai act() eksplisit) -- userEvent v14 SUDAH
    // asyncWrap tiap step event dgn act() secara internal, jadi
    // membungkusnya lagi dgn act(async () => { await user.click(...) })
    // menghasilkan act() bersarang (nested) yg memicu warning React
    // "environment not configured to support act(...)" saat setCommandResults
    // rollback di blok catch handleRemoveRecent (async, tidak di-await
    // oleh onClick -- `void handleRemoveRecent(...)`) di-flush di antara
    // dua lapis actQueue. screen.findByText di bawah sudah act-aware
    // (polling via waitFor), jadi tidak butuh act() manual sama sekali.
    await user.click(
      screen.getByRole("button", {
        name: "Remove Recent Sales Order from recent",
      }),
    );

    expect(await screen.findByText("Recent Sales Order")).toBeInTheDocument();
  });

  it("klik 'Clear All Recent' langsung menutup dialog lalu memanggil axios.delete tanpa recent_key", async () => {
    await openWithRecent();
    const user = userEvent.setup({ delay: null });

    await user.click(screen.getByText("Clear All Recent"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() =>
      expect(axiosDelete).toHaveBeenCalledWith("commands.recent.remove"),
    );
  });
});

describe("GlobalCommandPalette — Theme (pilih & filter pencarian)", () => {
  it("klik salah satu opsi Theme memanggil setTheme dgn value yg benar & menutup dialog", async () => {
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.click(screen.getByText("Dark"));

    expect(setThemeSpy).toHaveBeenCalledWith("dark");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("query 'gelap' (keyword Dark) HANYA menampilkan opsi Dark, bukan Light/System", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "gelap");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.queryByText("Light")).not.toBeInTheDocument();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
  });

  it("query 'theme' menampilkan ketiga opsi (Light, Dark, System)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "theme");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("query yg sama sekali tidak cocok dgn tema manapun -> grup Theme tidak dirender", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({
      data: { data: makeResults({ navigation: [navCommand] }) },
    });
    const user = userEvent.setup({ delay: null });
    renderPalette();
    await openPalette();

    await user.type(screen.getByRole("combobox"), "item master");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.queryByText("Theme")).not.toBeInTheDocument();
    expect(screen.getByText("Item Master")).toBeInTheDocument();
  });
});
