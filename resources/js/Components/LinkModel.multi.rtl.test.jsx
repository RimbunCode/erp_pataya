import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { lang: "id", preferences: {} } }),
}));
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));
vi.mock("@/Pages/Core/FormPage", () => ({ FormPageDialog: () => null }));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args) => axiosPost(...args),
    get: () => Promise.resolve({ data: { data: [] } }),
  },
}));

window.route = (name) => name;

import LinkModel from "./LinkModel";
import { TooltipProvider } from "./ui/tooltip";

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

const MAIN = "App\\Models\\Main";
const SUB = "App\\Models\\Sub";
const row = (model, id, name) => ({
  id,
  name,
  templateLink: ":name",
  thisModel: model,
});
const flat = (rows) => ({
  data: rows,
  total: rows.length,
  current_page: 1,
  last_page: 1,
});

// Server mock per model; nilai boleh fungsi (payload) -> rows untuk simulasi search.
const mockServer = ({ main = [], sub = [] }) => {
  axiosPost.mockImplementation((url, payload) => {
    if (url !== "model") return Promise.resolve({ data: {} });
    const source = payload.model === MAIN ? main : sub;
    const rows = typeof source === "function" ? source(payload) : source;

    return Promise.resolve({ data: flat(rows) });
  });
};
const bySearch = (rows) => (payload) =>
  rows.filter((r) =>
    r.name.toLowerCase().includes((payload.search ?? "").toLowerCase()),
  );
const callsFor = (model) =>
  axiosPost.mock.calls.filter(([, payload]) => payload.model === model);

beforeEach(() => {
  axiosPost.mockReset();
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const openDropdown = async (user) => {
  await act(async () => {
    await user.click(screen.getByRole("textbox"));
  });
};
const subModels = (over = {}) => [
  { model: SUB, label: "Item Lainnya", ...over },
];

describe("LinkModel multi-model -- kompatibilitas", () => {
  it("tanpa subModels: tak ada header bagian, hanya model utama di-fetch", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({ main: [row(MAIN, 1, "Alpha")] });
    await render(<LinkModel model={MAIN} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });

    expect(
      screen.queryByTestId("linkmodel-source-header"),
    ).not.toBeInTheDocument();
    expect(callsFor(SUB)).toHaveLength(0);
  });
});

describe("LinkModel multi-model -- model kosong", () => {
  it("model null (mis. dipilih dinamis & belum diisi) tidak crash dan tak fetch", async () => {
    mockServer({});
    await render(<LinkModel model={null} disabled />);

    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(axiosPost).not.toHaveBeenCalled();
  });
});

describe("LinkModel multi-model -- tampilan & fetch lazy", () => {
  it("main tak dibungkus tampil biasa; sub = header tertutup & TIDAK di-fetch", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({
      main: [row(MAIN, 1, "Alpha")],
      sub: [row(SUB, 10, "Variant X")],
    });
    await render(<LinkModel model={MAIN} subModels={subModels()} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });

    const headers = screen.getAllByTestId("linkmodel-source-header");
    expect(headers).toHaveLength(1);
    expect(headers[0]).toHaveTextContent("Item Lainnya");
    expect(headers[0]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Variant X")).not.toBeInTheDocument();
    expect(callsFor(SUB)).toHaveLength(0);
  });

  it("mainLabel -> main dibungkus header, terbuka default", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({
      main: [row(MAIN, 1, "Alpha")],
      sub: [row(SUB, 10, "Variant X")],
    });
    await render(
      <LinkModel
        model={MAIN}
        mainLabel="Purchase Order Item"
        subModels={subModels()}
      />,
    );

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });

    const headers = screen.getAllByTestId("linkmodel-source-header");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent("Purchase Order Item");
    expect(headers[0]).toHaveAttribute("aria-expanded", "true");

    // tutup bagian main -> barisnya hilang
    await act(async () => {
      await user.click(headers[0]);
    });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("membuka header sub -> fetch memakai model, filters (notIn), fields & with sub", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({
      main: [row(MAIN, 1, "Alpha")],
      sub: [row(SUB, 10, "Variant X"), row(SUB, 11, "Variant Y")],
    });
    await render(
      <LinkModel
        model={MAIN}
        filters={{ purchase_order_id: "po-1" }}
        subModels={subModels({
          filters: { id: { notIn: ["a", "b"] } },
          fields: ["unit"],
          with: ["unit"],
        })}
      />,
    );

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(screen.getByTestId("linkmodel-source-header"));
    });

    expect(await screen.findByText("Variant X")).toBeInTheDocument();
    expect(screen.getByText("Variant Y")).toBeInTheDocument();
    const payload = callsFor(SUB)[0][1];
    expect(payload).toMatchObject({
      model: SUB,
      filters: { id: { notIn: ["a", "b"] } },
      fields: ["unit"],
      with: ["unit"],
    });
    // filters main tak bocor ke sub
    expect(payload.filters.purchase_order_id).toBeUndefined();
  });

  it("sub ber-group mengirim group & groupTree miliknya sendiri", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({ main: [row(MAIN, 1, "Alpha")], sub: [] });
    await render(
      <LinkModel model={MAIN} subModels={subModels({ group: "category" })} />,
    );

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(screen.getByTestId("linkmodel-source-header"));
    });

    await waitFor(() => expect(callsFor(SUB).length).toBeGreaterThan(0));
    expect(callsFor(SUB)[0][1]).toMatchObject({
      groupTree: true,
      group: [{ column: "category", granularity: null, range: null }],
    });
    // main tak ikut ber-group
    expect("group" in callsFor(MAIN)[0][1]).toBe(false);
  });
});

describe("LinkModel multi-model -- pencarian lintas sumber", () => {
  it("mengetik -> semua sumber di-fetch; bagian dengan hasil terbuka, bagian kosong disembunyikan", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({
      main: bySearch([row(MAIN, 1, "Alpha"), row(MAIN, 2, "Beta")]),
      sub: bySearch([row(SUB, 10, "Alphabet X")]),
    });
    await render(<LinkModel model={MAIN} subModels={subModels()} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: /Alpha$/ });
    await act(async () => {
      await user.type(screen.getByRole("textbox"), "alp");
    });

    await waitFor(
      () =>
        expect(
          screen.getByRole("option", { name: "Alphabet X" }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(callsFor(SUB).some(([, p]) => p.search === "alp")).toBe(true);
    // tak ada fetch sub dgn search kosong (ditahan sampai debounce selesai)
    expect(callsFor(SUB).every(([, p]) => p.search === "alp")).toBe(true);
    expect(screen.getByTestId("linkmodel-source-header")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    // kata yang hanya cocok di main -> bagian sub disembunyikan
    await act(async () => {
      await user.clear(screen.getByRole("textbox"));
      await user.type(screen.getByRole("textbox"), "beta");
    });
    await waitFor(
      () =>
        expect(
          screen.queryByTestId("linkmodel-source-header"),
        ).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByRole("option", { name: /Beta/ })).toBeInTheDocument();
  });

  it("semua sumber kosong saat mencari -> 'tidak ditemukan'", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({
      main: bySearch([row(MAIN, 1, "Alpha")]),
      sub: bySearch([row(SUB, 10, "Variant X")]),
    });
    await render(<LinkModel model={MAIN} subModels={subModels()} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.type(screen.getByRole("textbox"), "zzz");
    });

    expect(
      await screen.findByText("TR:core.form.not_found", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("linkmodel-source-header"),
    ).not.toBeInTheDocument();
  });
});

describe("LinkModel multi-model -- pemilihan & validasi", () => {
  it("memilih baris sub -> onValueChange dengan baris sub (thisModel sub)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    mockServer({
      main: [row(MAIN, 1, "Alpha")],
      sub: [row(SUB, 10, "Variant X")],
    });
    await render(
      <LinkModel
        model={MAIN}
        subModels={subModels()}
        onValueChange={onValueChange}
      />,
    );

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(screen.getByTestId("linkmodel-source-header"));
    });
    await act(async () => {
      await user.click(await screen.findByText("Variant X"));
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, thisModel: SUB }),
    );
  });

  it("id sama di main & sub tidak bentrok: memilih baris sub memilih baris sub", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    mockServer({
      main: [row(MAIN, 1, "Alpha")],
      sub: [row(SUB, 1, "Variant Same Id")],
    });
    await render(
      <LinkModel
        model={MAIN}
        subModels={subModels()}
        onValueChange={onValueChange}
      />,
    );

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(screen.getByTestId("linkmodel-source-header"));
    });
    await act(async () => {
      await user.click(await screen.findByText("Variant Same Id"));
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ thisModel: SUB, name: "Variant Same Id" }),
    );
  });

  it("opsi bermodel di luar daftar (main+sub) ditolak -- onValueChange tak terpanggil", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    mockServer({
      main: [row(MAIN, 1, "Alpha")],
      sub: [row("App\\Models\\Foreign", 10, "Foreign Row")],
    });
    await render(
      <LinkModel
        model={MAIN}
        subModels={subModels()}
        onValueChange={onValueChange}
      />,
    );

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(screen.getByTestId("linkmodel-source-header"));
    });
    await act(async () => {
      await user.click(await screen.findByText("Foreign Row"));
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("nilai terkendali bermodel sub tidak dikosongkan oleh validasi", async () => {
    const onValueChange = vi.fn();
    mockServer({ main: [row(MAIN, 1, "Alpha")] });
    await render(
      <LinkModel
        model={MAIN}
        subModels={subModels()}
        value={row(SUB, 10, "Variant X")}
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("Variant X");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("subModels tanpa label diabaikan (tetap mode satu model)", async () => {
    const user = userEvent.setup({ delay: null });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockServer({ main: [row(MAIN, 1, "Alpha")] });
    await render(<LinkModel model={MAIN} subModels={[{ model: SUB }]} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });

    expect(
      screen.queryByTestId("linkmodel-source-header"),
    ).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("LinkModel multi-model -- Advance Search bertab", () => {
  const openAdvanceSearch = async (user) => {
    await openDropdown(user);
    await act(async () => {
      await user.click(
        await screen.findByText("TR:core.form.linkmodel.advance_search"),
      );
    });
  };

  it("tombol Advance Search membuka dialog dengan tab main + sub", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({ main: [row(MAIN, 1, "Alpha")] });
    await render(
      <LinkModel
        model={MAIN}
        mainLabel="Purchase Order Item"
        subModels={subModels()}
      />,
    );

    await openAdvanceSearch(user);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Purchase Order Item",
      "Item Lainnya",
    ]);
  });

  it("sub ber-advanceSearch:false tidak dapat tab (satu sumber -> tanpa tab)", async () => {
    const user = userEvent.setup({ delay: null });
    mockServer({ main: [row(MAIN, 1, "Alpha")] });
    await render(
      <LinkModel
        model={MAIN}
        subModels={subModels({ advanceSearch: false })}
      />,
    );

    await openAdvanceSearch(user);
    await screen.findByRole("heading", {
      name: "TR:core.form.linkmodel.advance_search",
    });

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
