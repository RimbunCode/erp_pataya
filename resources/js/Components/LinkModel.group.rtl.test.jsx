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
    // SearchBar (Dialog Advance Search) memuat daftar Filter Tersimpan.
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

const MODEL = "AppModelsItem";
const row = (id, name) => ({
  id,
  templateLink: ":name",
  name,
  thisModel: MODEL,
});
const levels = [
  { column: "category", granularity: null, range: null, type: "string" },
];
const groupsPage = (items, over = {}) => ({
  type: "groups",
  data: items,
  current_page: 1,
  last_page: 1,
  total: items.length,
  per_page: 25,
  groupMeta: { levels, aggregates: [] },
  defaultGroups: [],
  ...over,
});
const rowsPage = (rows, over = {}) => ({
  type: "rows",
  data: rows,
  current_page: 1,
  last_page: 1,
  total: rows.length,
  per_page: 25,
  ...over,
});
const descriptor = (key, count) => ({
  key,
  raw: key,
  count,
  aggregates: {},
});

// Server mock: level-0 (tanpa groupPath) -> grup; groupPath -> baris grup itu.
const mockGrouped = ({ level0, byPath }) => {
  axiosPost.mockImplementation((url, payload) => {
    if (url !== "model") return Promise.resolve({ data: {} });
    if (payload.groupPath === undefined) {
      return Promise.resolve({ data: level0(payload) });
    }
    return Promise.resolve({
      data: byPath(JSON.parse(payload.groupPath), payload),
    });
  });
};

let observers = [];
beforeEach(() => {
  axiosPost.mockReset();
  observers = [];
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
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

describe("LinkModel -- grup dropdown (server, mode search)", () => {
  it("prop group -> level-0 header grup, klik membuka & memuat baris, pilih opsi", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    mockGrouped({
      level0: () => groupsPage([descriptor("alpha", 2), descriptor("beta", 1)]),
      byPath: ([raw]) =>
        rowsPage(raw === "alpha" ? [row(1, "Alpha 1"), row(2, "Alpha 2")] : []),
    });
    await render(
      <LinkModel
        model={MODEL}
        group="category"
        onValueChange={onValueChange}
      />,
    );

    await openDropdown(user);
    const header = await screen.findByText("alpha");
    expect(screen.getByText("beta")).toBeInTheDocument();
    // semua grup tertutup default, isi belum dimuat
    expect(screen.queryByText("Alpha 1")).not.toBeInTheDocument();

    const first = axiosPost.mock.calls.find(([, p]) => p.groupPath === undefined);
    expect(first[1]).toMatchObject({
      groupTree: true,
      group: [{ column: "category", granularity: null, range: null }],
      page: 1,
    });
    expect(first[1].limit).toBeUndefined();

    await act(async () => {
      await user.click(header);
    });
    expect(await screen.findByText("Alpha 1")).toBeInTheDocument();
    const expand = axiosPost.mock.calls.find(([, p]) => p.groupPath !== undefined);
    expect(expand[1]).toMatchObject({
      groupPath: '["alpha"]',
      groupPage: 1,
      group: [{ column: "category", granularity: null, range: null }],
    });
    // expand membawa group EFEKTIF eksplisit, bukan flag opt-in level-0
    expect(expand[1].groupTree).toBeUndefined();

    await act(async () => {
      await user.click(screen.getByText("Alpha 2"));
    });
    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: "Alpha 2" }),
    );
  });

  it("label header memakai valueTrans dari groupMeta.levels (terjemahan nilai grup)", async () => {
    const user = userEvent.setup({ delay: null });
    mockGrouped({
      level0: () =>
        groupsPage([descriptor("alpha", 1)], {
          groupMeta: {
            levels: [{ ...levels[0], valueTrans: "x.category.types" }],
            aggregates: [],
          },
        }),
      byPath: () => rowsPage([]),
    });
    await render(<LinkModel model={MODEL} group="category" />);

    await openDropdown(user);

    expect(await screen.findByText("TR:x.category.types.alpha")).toBeInTheDocument();
  });

  it("tanpa prop group: tidak mengirim `group` (server memakai default model); respons flat -> tanpa header", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockResolvedValue({
      data: rowsPage([row(1, "Alpha"), row(2, "Beta")], { total: 2 }),
    });
    await render(<LinkModel model={MODEL} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });

    const payload = axiosPost.mock.calls[0][1];
    expect(payload.groupTree).toBe(true);
    expect("group" in payload).toBe(false);
    expect(screen.queryByTestId("linkmodel-group-header")).not.toBeInTheDocument();
  });

  it("group={[]} -> kirim group kosong eksplisit (menimpa default model)", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockResolvedValue({ data: rowsPage([row(1, "Alpha")]) });
    await render(<LinkModel model={MODEL} group={[]} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });

    expect(axiosPost.mock.calls[0][1].group).toEqual([]);
  });

  it("default model dari respons: header muncul walau prop group tak diberikan", async () => {
    const user = userEvent.setup({ delay: null });
    mockGrouped({
      level0: () =>
        groupsPage([descriptor("alpha", 1)], {
          defaultGroups: [{ column: "category", granularity: null, range: null }],
        }),
      byPath: () => rowsPage([row(1, "Alpha 1")]),
    });
    await render(<LinkModel model={MODEL} />);

    await openDropdown(user);

    expect(await screen.findByTestId("linkmodel-group-header")).toBeInTheDocument();
  });

  it("search terisi -> grup diisi otomatis (auto-expand) dan search ikut dikirim ke node", async () => {
    const user = userEvent.setup({ delay: null });
    mockGrouped({
      level0: (payload) =>
        groupsPage(
          payload.search ? [descriptor("alpha", 1)] : [descriptor("alpha", 2), descriptor("beta", 1)],
        ),
      byPath: (_path, payload) =>
        rowsPage(payload.search ? [row(1, "Alpha cocok")] : []),
    });
    await render(<LinkModel model={MODEL} group="category" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Alp");
    });

    // tanpa klik: node pertama terbuka otomatis
    expect(await screen.findByText(/cocok/, {}, { timeout: 4000 })).toBeInTheDocument();
    const expand = axiosPost.mock.calls.filter(([, p]) => p.groupPath !== undefined);
    expect(expand.at(-1)[1]).toMatchObject({ search: "Alp", groupPath: '["alpha"]' });
  });

  it("search terisi + deskriptor membawa `children` (prefill) -> baris tampil tanpa request node, prefill dikirim", async () => {
    const user = userEvent.setup({ delay: null });
    mockGrouped({
      level0: (payload) =>
        payload.search
          ? groupsPage([
              {
                ...descriptor("alpha", 1),
                children: rowsPage([row(1, "Alpha cocok")]),
              },
            ])
          : groupsPage([descriptor("alpha", 2)]),
      byPath: () => rowsPage([]),
    });
    await render(<LinkModel model={MODEL} group="category" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Alp");
    });

    expect(await screen.findByText(/cocok/, {}, { timeout: 4000 })).toBeInTheDocument();
    const level0 = axiosPost.mock.calls.filter(
      ([, p]) => p.groupPath === undefined && p.search === "Alp",
    );
    expect(level0[0][1].prefill).toBe(25);
    // tanpa pencarian tak ada prefill
    expect(axiosPost.mock.calls[0][1].prefill).toBeUndefined();
    // isi grup datang bersama level-0: tak ada fetch lazy per grup
    expect(axiosPost.mock.calls.some(([, p]) => p.groupPath !== undefined)).toBe(false);
  });

  it("panah kanan/kiri pada header yang di-highlight membuka/menutup grup", async () => {
    const user = userEvent.setup({ delay: null });
    mockGrouped({
      level0: () => groupsPage([descriptor("alpha", 1)]),
      byPath: () => rowsPage([row(1, "Alpha 1")]),
    });
    await render(<LinkModel model={MODEL} group="category" />);

    await openDropdown(user);
    const header = await screen.findByTestId("linkmodel-group-header");
    expect(header).toHaveAttribute("aria-expanded", "false");

    await act(async () => {
      await user.keyboard("{ArrowRight}");
    });
    expect(await screen.findByText("Alpha 1")).toBeInTheDocument();
    expect(screen.getByTestId("linkmodel-group-header")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await act(async () => {
      await user.keyboard("{ArrowLeft}");
    });
    await waitFor(() =>
      expect(screen.queryByText("Alpha 1")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("linkmodel-group-header")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("Tab saat header grup di-highlight TIDAK mengisi teks (autocomplete hanya utk opsi)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    mockGrouped({
      level0: () => groupsPage([descriptor("alpha", 1)]),
      byPath: () => rowsPage([row(1, "Alpha 1")]),
    });
    await render(
      <div>
        <LinkModel
          model={MODEL}
          group="category"
          onValueChange={onValueChange}
        />
        <button type="button">Outside</button>
      </div>,
    );

    await openDropdown(user);
    await screen.findByTestId("linkmodel-group-header");
    await act(async () => {
      await user.tab();
    });

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("search kosong -> semua grup tertutup (tanpa auto-expand)", async () => {
    const user = userEvent.setup({ delay: null });
    mockGrouped({
      level0: () => groupsPage([descriptor("alpha", 1)]),
      byPath: () => rowsPage([row(1, "Alpha 1")]),
    });
    await render(<LinkModel model={MODEL} group="category" />);

    await openDropdown(user);
    await screen.findByText("alpha");

    expect(
      axiosPost.mock.calls.some(([, p]) => p.groupPath !== undefined),
    ).toBe(false);
  });
});

describe("LinkModel -- infinite scroll flat (tanpa limit)", () => {
  it("sentinel terlihat -> halaman berikutnya ditambahkan di bawah; tanpa baris 'more'", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockImplementation((url, payload) =>
      Promise.resolve({
        data:
          payload.page === 2
            ? rowsPage([row(3, "Gamma")], { current_page: 2, last_page: 2, total: 3 })
            : rowsPage([row(1, "Alpha"), row(2, "Beta")], {
                current_page: 1,
                last_page: 2,
                total: 3,
              }),
      }),
    );
    await render(<LinkModel model={MODEL} />);

    await openDropdown(user);
    await screen.findByRole("option", { name: "Alpha" });
    expect(screen.queryByRole("option", { name: "Gamma" })).not.toBeInTheDocument();
    expect(screen.queryByText("TR:core.form.linkmodel.more")).not.toBeInTheDocument();

    await act(async () => {
      observers.at(-1).callback([{ isIntersecting: true }]);
    });

    expect(await screen.findByRole("option", { name: "Gamma" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();
    expect(axiosPost.mock.calls.map(([, p]) => p.page)).toEqual([1, 2]);
  });
});

describe("LinkModel -- mode cache + grup (dikelompokkan di client)", () => {
  const cachedRows = [
    { ...row(1, "Alpha 1"), category: "alpha" },
    { ...row(2, "Alpha 2"), category: "alpha" },
    { ...row(3, "Beta 1"), category: "beta" },
  ];

  it("header per grup dari dataset cache, isi dibuka lokal tanpa request grup", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockResolvedValue({ data: { data: cachedRows, total: 3 } });
    await render(<LinkModel model={MODEL} cache group="category" />);

    await openDropdown(user);
    const header = await screen.findByText("alpha");
    expect(screen.getByText("beta")).toBeInTheDocument();

    await act(async () => {
      await user.click(header);
    });
    expect(await screen.findByText("Alpha 2")).toBeInTheDocument();
    // hanya request cache awal; tidak ada groupPath/groupTree ke server
    expect(axiosPost.mock.calls.every(([, p]) => p.groupPath === undefined)).toBe(true);
    expect(axiosPost.mock.calls.every(([, p]) => p.groupTree === undefined)).toBe(true);
  });

  it("filter search cache menyempitkan grup & hitungnya", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockResolvedValue({ data: { data: cachedRows, total: 3 } });
    await render(<LinkModel model={MODEL} cache group="category" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Beta");
    });

    await waitFor(() => expect(screen.queryByText("alpha")).not.toBeInTheDocument());
    expect(screen.getByText("beta")).toBeInTheDocument();
  });
});

describe("LinkModel -- zero overhead tanpa grup", () => {
  it("respons flat: tidak ada header grup dan opsi berperilaku seperti sebelumnya", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    axiosPost.mockResolvedValue({
      data: rowsPage([row(1, "Alpha")], { total: 1 }),
    });
    await render(<LinkModel model={MODEL} onValueChange={onValueChange} />);

    await openDropdown(user);
    await act(async () => {
      await user.click(await screen.findByRole("option", { name: "Alpha" }));
    });

    expect(onValueChange).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
