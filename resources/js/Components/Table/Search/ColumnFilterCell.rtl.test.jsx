// Test ColumnFilterCell/ColumnFilterRow (task 13.3-13.4, spec
// datatable2-column-search-row, Requirement 1, 3-8): sintaks operator ketik,
// picker list, badge edit/hapus, hapus 2 langkah, blur/Escape tidak commit,
// badge read-only -> Builder, indikator filter lanjutan, kolom non-searchable,
// readOnly saat busy, serta sinkron sel <-> draft tree.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  },
}));

window.route = (name) => name;

import ColumnFilterRow from "./ColumnFilterRow";
import useSearchDraft from "./useSearchDraft";

const NO_GROUP = [];
const client = new QueryClient();

const columns = {
  name: { name: "name", title: "Nama", type: "string" },
  qty: { name: "qty", title: "Jumlah", type: "number" },
  status: {
    name: "status",
    title: "Status",
    type: "string",
    options: [
      { value: "draft", label: "Draft" },
      { value: "done", label: "Selesai" },
    ],
  },
  active: { name: "active", title: "Aktif", type: "boolean" },
  meta: { name: "meta", title: "Meta", type: "json" },
};
const showed = ["name", "qty", "status", "active", "meta"].map((name) => ({
  name,
}));

const tree = (nodes) => ({ root: { k: "and", c: nodes } });
const leaves = (t) =>
  Object.values(t?.root?.c ?? {})
    .map((n) => `${n.k}${n.o}${JSON.stringify(n.v)}`)
    .sort();

function Host({
  expose,
  initialTree = null,
  onTreeChange,
  onOpenBuilder,
  selectable,
  actions,
  columnsMap = columns,
  showedColumns = showed,
}) {
  const [applied, setApplied] = useState(initialTree);
  const handleTree = (next) => {
    const result = onTreeChange?.(next);
    setApplied(next);
    return result ?? Promise.resolve();
  };
  const draft = useSearchDraft({
    tree: applied,
    group: NO_GROUP,
    onTreeChange: handleTree,
  });
  expose.current = draft;
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <table>
          <thead>
            <ColumnFilterRow
              showedColumns={showedColumns}
              selectable={selectable}
              actions={actions}
              columnFilter={{ columns: columnsMap, draft, onOpenBuilder }}
            />
          </thead>
        </table>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const setup = (props = {}) => {
  const expose = { current: null };
  const onTreeChange = props.onTreeChange ?? vi.fn();
  const onOpenBuilder = vi.fn();
  render(
    <Host
      expose={expose}
      onTreeChange={onTreeChange}
      onOpenBuilder={onOpenBuilder}
      {...props}
    />,
  );
  return { expose, onTreeChange, onOpenBuilder };
};

const inputOf = (title) => screen.getByLabelText(title);
const lastTree = (fn) => fn.mock.calls.at(-1)?.[0];

describe("ColumnFilterRow", () => {
  it("satu sel per kolom tampil, urutan sama dgn header; kolom non-searchable kosong", () => {
    setup();
    const labels = screen
      .getAllByRole("textbox")
      .map((el) => el.getAttribute("aria-label"));
    expect(labels).toEqual(["Nama", "Jumlah", "Status", "Aktif"]);
    expect(screen.queryByLabelText("Meta")).toBeNull();
    // 5 kolom tampil -> 5 sel th (meta tetap punya th kosong agar sejajar)
    expect(document.querySelectorAll("th")).toHaveLength(5);
  });

  it("sel kosong pengisi utk kolom checkbox & aksi", () => {
    setup({ selectable: true, actions: true });
    const ths = [...document.querySelectorAll("th")];
    expect(ths).toHaveLength(7);
    expect(ths[0].getAttribute("aria-hidden")).toBe("true");
    expect(ths[1].getAttribute("aria-hidden")).toBe("true");
    expect(within(ths[2]).getByLabelText("Nama")).toBeTruthy();
  });

  it("kolom tampil berubah -> sel mengikuti tanpa reload", () => {
    const expose = { current: null };
    const { rerender } = render(
      <Host
        expose={expose}
        showedColumns={[{ name: "qty" }, { name: "name" }]}
      />,
    );
    expect(
      screen.getAllByRole("textbox").map((el) => el.getAttribute("aria-label")),
    ).toEqual(["Jumlah", "Nama"]);
    rerender(<Host expose={expose} showedColumns={[{ name: "name" }]} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});

describe("ColumnFilterCell — sintaks operator & commit", () => {
  it("text: Enter pertama jadi chip, Enter kedua commit `matches` dan badge muncul", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.type(inputOf("Nama"), "abc{Enter}");
    expect(onTreeChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    expect(leaves(lastTree(onTreeChange))).toEqual(['namematches"abc"']);
    expect(await screen.findByText('"abc"')).toBeTruthy();
  });

  it("negasi `!x` -> operator !matches", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.type(inputOf("Nama"), "!abc{Enter}{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    expect(leaves(lastTree(onTreeChange))).toEqual(['name!matches"abc"']);
  });

  it("daftar `a|b` -> operator in", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.type(inputOf("Nama"), "a|b{Enter}{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    expect(leaves(lastTree(onTreeChange))).toEqual(['namein["a","b"]']);
  });

  it("number bersimbol `>=5` + Enter -> langsung commit; badge `≥ 5`", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.type(inputOf("Jumlah"), ">=5{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    expect(leaves(lastTree(onTreeChange))).toEqual(["qty>=5"]);
    expect(await screen.findByText("≥ 5")).toBeTruthy();
  });

  it("number `1..9` -> between", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.type(inputOf("Jumlah"), "1..9{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    expect(leaves(lastTree(onTreeChange))).toEqual(["qtybetween[1,9]"]);
  });

  it("number bukan angka -> pesan galat, tidak commit", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.type(inputOf("Jumlah"), "abc{Enter}");
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/core\.datatable\.search\.number_invalid/),
    ).toBeTruthy();
  });

  it("list: pilih opsi dari dropdown lalu Enter -> leaf =", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.click(inputOf("Status"));
    await user.click(await screen.findByText("Draft"));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    expect(leaves(lastTree(onTreeChange))).toEqual(['status="draft"']);
    expect(await screen.findByText("Draft")).toBeTruthy();
  });

  it("sesudah commit, klik/panah pada input yang masih fokus membuka dropdown lagi", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    await user.click(inputOf("Status"));
    await user.click(await screen.findByText("Draft"));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    // dropdown menutup sesudah commit (opsi "Selesai" tidak terlihat lagi)
    await waitFor(() => expect(screen.queryByText("Selesai")).toBeNull());
    await user.click(inputOf("Status"));
    expect(await screen.findByText("Selesai")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Selesai")).toBeNull());
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByText("Selesai")).toBeTruthy();
  });

  it("commit sel menambah ke draft yang sudah ada (tak menimpa kolom lain)", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup({
      initialTree: tree({ x: { k: "qty", o: ">", v: 1 } }),
    });
    await user.type(inputOf("Nama"), ">=7");
    await user.clear(inputOf("Nama"));
    await user.type(inputOf("Nama"), "zzz{Enter}{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    expect(leaves(lastTree(onTreeChange))).toEqual([
      'namematches"zzz"',
      "qty>1",
    ]);
  });
});

describe("ColumnFilterCell — badge", () => {
  const initial = tree({ L: { k: "qty", o: "in", v: [1, 2] } });

  it("leaf `in` multi-nilai tampil sbg satu badge per nilai", () => {
    setup({ initialTree: initial });
    const badges = screen.getAllByTestId("column-filter-badge");
    expect(badges.map((b) => b.textContent)).toEqual(["1", "2"]);
  });

  it("tombol × menghapus satu nilai (in -> =)", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup({ initialTree: initial });
    await user.click(
      screen.getByLabelText(
        'TR:core.datatable.search.remove_chip:{"label":"1"}',
      ),
    );
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    expect(leaves(lastTree(onTreeChange))).toEqual(["qty=2"]);
  });

  it("Backspace dua langkah: sorot badge terakhir lalu hapus", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup({ initialTree: initial });
    await user.click(inputOf("Jumlah"));
    await user.keyboard("{Backspace}");
    expect(onTreeChange).not.toHaveBeenCalled();
    const badges = screen.getAllByTestId("column-filter-badge");
    expect(badges.at(-1).className).toContain("ring-destructive");
    await user.keyboard("{Backspace}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    expect(leaves(lastTree(onTreeChange))).toEqual(["qty=1"]);
  });

  it("klik badge -> edit: nilai dimuat ke input, commit mengganti leaf yang sama", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup({
      initialTree: tree({ L: { k: "qty", o: ">=", v: 5 } }),
    });
    await user.click(screen.getByText("≥ 5"));
    const input = inputOf("Jumlah");
    await waitFor(() => expect(input.value).toBe(">=5"));
    await user.clear(input);
    await user.type(input, ">=9{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    // leaf yang SAMA diperbarui (bukan leaf kedua)
    expect(leaves(lastTree(onTreeChange))).toEqual(["qty>=9"]);
  });

  it("leaf yang tak bisa diedit di sel (starts_with) -> badge read-only, klik membuka Builder", async () => {
    const user = userEvent.setup();
    const { onOpenBuilder } = setup({
      initialTree: tree({ L: { k: "name", o: "starts_with", v: "abc" } }),
    });
    await user.click(screen.getByText(/starts_with/));
    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
    expect(leaves(onOpenBuilder.mock.calls[0][0])).toEqual([
      'namestarts_with"abc"',
    ]);
  });

  it("kolom yang dipakai di filter lanjutan diberi indikator", () => {
    setup({
      initialTree: tree({
        A: {
          k: "and",
          c: {
            a: { k: "qty", o: ">", v: 1 },
            b: { k: "name", o: "=", v: "x" },
          },
        },
      }),
    });
    const indicators = screen.getAllByRole("img", {
      name: "TR:core.datatable.column_search.advanced_used",
    });
    expect(indicators).toHaveLength(2); // qty & name
  });

  it("root OR multi-kondisi: sel tetap aktif, OR lama dibungkus bukan hilang", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup({
      initialTree: {
        root: {
          k: "or",
          c: {
            a: { k: "name", o: "=", v: "x" },
            b: { k: "qty", o: ">", v: 1 },
          },
        },
      },
    });
    await user.type(inputOf("Jumlah"), "<9{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
    const applied = lastTree(onTreeChange);
    expect(applied.root.k).toBe("and");
    const nodes = Object.values(applied.root.c);
    expect(nodes).toHaveLength(2);
    expect(
      nodes.some((n) => n.k === "or" && Object.keys(n.c).length === 2),
    ).toBe(true);
    expect(nodes.some((n) => n.k === "qty" && n.o === "<")).toBe(true);
  });
});

describe("ColumnFilterCell — sesi ketik", () => {
  it("blur tidak commit: ketikan tetap di input, Enter yang commit", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    const input = inputOf("Nama");
    await user.type(input, "abc");
    await user.tab(); // fokus pindah ke sel lain
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(inputOf("Nama").value).toBe("abc");
  });

  it("Escape membuang ketikan tanpa commit", async () => {
    const user = userEvent.setup();
    const { onTreeChange } = setup();
    const input = inputOf("Nama");
    await user.type(input, "abc{Escape}");
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(inputOf("Nama").value).toBe("");
  });

  it("ketikan per sel terpisah: pindah sel tidak menghapus ketikan sel lain", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(inputOf("Nama"), "abc");
    await user.click(inputOf("Jumlah"));
    await user.type(inputOf("Jumlah"), "12");
    expect(inputOf("Nama").value).toBe("abc");
    expect(inputOf("Jumlah").value).toBe("12");
  });

  it("host sibuk: ketikan tetap diterima, tapi Enter (commit) ditolak sampai selesai", async () => {
    const user = userEvent.setup();
    let resolve;
    const pending = new Promise((r) => {
      resolve = r;
    });
    const { onTreeChange } = setup({ onTreeChange: vi.fn(() => pending) });
    await user.type(inputOf("Jumlah"), ">=5{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId("column-filter-cell")[0]
          .getAttribute("aria-busy"),
      ).toBe("true"),
    );
    // ketikan TIDAK hilang saat sibuk
    await user.type(inputOf("Nama"), "x");
    expect(inputOf("Nama").value).toBe("x");
    await user.type(inputOf("Nama"), "{Enter}{Enter}");
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
    });
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId("column-filter-cell")[0]
          .getAttribute("aria-busy"),
      ).toBeNull(),
    );
    // sesudah selesai, Enter meng-commit ketikan yang tadi tertahan
    await user.type(inputOf("Nama"), "{Enter}{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(2));
  });
});

describe("sinkron sel <-> draft", () => {
  it("draft yang berubah dari luar (chip atas) muncul sbg badge di sel", async () => {
    const { expose } = setup();
    await act(async () => {
      await expose.current.commitTreeChange((d) => ({
        root: {
          k: "and",
          c: { ...(d?.root?.c ?? {}), N: { k: "name", o: "matches", v: "q" } },
        },
      }));
    });
    expect(await screen.findByText('"q"')).toBeTruthy();
  });

  it("badge hilang saat leaf dihapus dari luar", async () => {
    const { expose } = setup({
      initialTree: tree({ L: { k: "qty", o: "=", v: 3 } }),
    });
    expect(screen.getByText("3")).toBeTruthy();
    await act(async () => {
      await expose.current.commitTreeChange(() => null);
    });
    await waitFor(() => expect(screen.queryByText("3")).toBeNull());
  });
});

describe("draft langsung (Requirement 14)", () => {
  const draftLeaves = (expose) => leaves(expose.current.draftTree);

  it("ketikan valid masuk draft tanpa apply; tidak memanggil host", async () => {
    const user = userEvent.setup();
    const { expose, onTreeChange } = setup();
    await user.type(inputOf("Nama"), "abc");
    await waitFor(() =>
      expect(draftLeaves(expose)).toEqual(['namematches"abc"']),
    );
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(expose.current.isDraftDirty).toBe(true);
  });

  it("leaf sementara diperbarui di tempat (tidak menumpuk) tiap ketukan", async () => {
    const user = userEvent.setup();
    const { expose } = setup();
    await user.type(inputOf("Nama"), "ab");
    await waitFor(() =>
      expect(draftLeaves(expose)).toEqual(['namematches"ab"']),
    );
    await user.type(inputOf("Nama"), "c");
    await waitFor(() =>
      expect(draftLeaves(expose)).toEqual(['namematches"abc"']),
    );
    expect(Object.keys(expose.current.draftTree.root.c)).toHaveLength(1);
  });

  it("ketikan jadi tak valid (number) menghapus leaf sementara", async () => {
    const user = userEvent.setup();
    const { expose } = setup();
    await user.type(inputOf("Jumlah"), "5");
    await waitFor(() => expect(draftLeaves(expose)).toEqual(["qty=5"]));
    await user.type(inputOf("Jumlah"), "a");
    await waitFor(() => expect(draftLeaves(expose)).toEqual([]));
  });

  it("Escape mengembalikan draft ke kondisi sebelum sesi", async () => {
    const user = userEvent.setup();
    const initial = tree({ x: { k: "qty", o: ">", v: 1 } });
    const { expose, onTreeChange } = setup({ initialTree: initial });
    await user.type(inputOf("Nama"), "abc");
    await waitFor(() =>
      expect(draftLeaves(expose)).toEqual(['namematches"abc"', "qty>1"]),
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(draftLeaves(expose)).toEqual(["qty>1"]));
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(inputOf("Nama").value).toBe("");
  });

  it("Enter meng-commit leaf final TANPA menggandakan leaf sementara", async () => {
    const user = userEvent.setup();
    const { expose, onTreeChange } = setup();
    await user.type(inputOf("Nama"), "abc");
    await waitFor(() => expect(draftLeaves(expose)).toHaveLength(1));
    await user.keyboard("{Enter}{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    expect(leaves(lastTree(onTreeChange))).toEqual(['namematches"abc"']);
    await waitFor(() =>
      expect(draftLeaves(expose)).toEqual(['namematches"abc"']),
    );
  });

  it("edit badge: leaf asli diperbarui langsung; Escape mengembalikan nilai asli", async () => {
    const user = userEvent.setup();
    const { expose } = setup({
      initialTree: tree({ L: { k: "qty", o: ">=", v: 5 } }),
    });
    await user.click(screen.getByText("≥ 5"));
    const input = inputOf("Jumlah");
    await waitFor(() => expect(input.value).toBe(">=5"));
    await user.clear(input);
    await user.type(input, ">=9");
    await waitFor(() => expect(draftLeaves(expose)).toEqual(["qty>=9"]));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(draftLeaves(expose)).toEqual(["qty>=5"]));
  });

  it("dua sel mengetik bergantian tidak saling menimpa; Escape hanya membatalkan sel itu", async () => {
    const user = userEvent.setup();
    const { expose } = setup();
    await user.type(inputOf("Nama"), "abc");
    await waitFor(() => expect(draftLeaves(expose)).toHaveLength(1));
    await user.click(inputOf("Jumlah"));
    await user.type(inputOf("Jumlah"), "7");
    await waitFor(() =>
      expect(draftLeaves(expose)).toEqual(['namematches"abc"', "qty=7"]),
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(draftLeaves(expose)).toEqual(['namematches"abc"']),
    );
    await user.click(inputOf("Nama"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(draftLeaves(expose)).toEqual([]));
  });

  it("badge sel sendiri disembunyikan selama sesi (tak ganda dgn chip sesi)", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(inputOf("Nama"), "abc|");
    await waitFor(() =>
      expect(screen.getAllByText("abc").length).toBeGreaterThan(0),
    );
    // hanya chip sesi (ValueChipList) -- bukan badge idle `"abc"`
    expect(screen.queryAllByTestId("column-filter-badge")).toHaveLength(0);
  });

  it("sel lain melihat leaf sementara sbg badge (sinkron saat mengetik)", async () => {
    const user = userEvent.setup();
    setup({
      showedColumns: [{ name: "name" }, { name: "name" }],
    });
    // dua sel bertipe sama untuk kolom `name`: ketik di yang pertama,
    // sel kedua (tanpa sesi) menampilkan badge dari draft yang sama
    const inputs = screen.getAllByLabelText("Nama");
    await user.type(inputs[0], "abc");
    await waitFor(() =>
      expect(screen.getAllByTestId("column-filter-badge")).toHaveLength(1),
    );
  });
});
