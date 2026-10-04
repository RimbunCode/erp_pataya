// Test SearchBar mode draft TERKONTROL (task 10.3, spec datatable2-column-search-
// row, Requirement 7.2-7.4, 7.6): draft dimiliki host lewat `useSearchDraft`
// dan dioper lewat prop `draft` -- chip atas selalu turunan draft itu, commit
// dari luar (Sel Filter) muncul sbg chip, draft yang belum di-apply ikut
// ter-apply, dan tanpa prop SearchBar tetap memakai draft internal.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/Components/ui/tooltip";
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
    delete: vi.fn(),
    post: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  },
}));

window.route = (name) => name;

vi.mock("../Filter/FilterTable2", () => ({
  SaveFilterControl: () => <div data-testid="save-control" />,
}));

import SearchBar from "./SearchBar";
import { addLeafChip } from "./searchChips";
import ColumnFilterRow from "./ColumnFilterRow";
import useSearchDraft from "./useSearchDraft";

const columns = {
  name: { name: "name", title: "Nama", type: "string" },
  code: { name: "code", title: "Kode", type: "string" },
  qty: { name: "qty", title: "Jumlah", type: "number" },
};

// Referensi stabil: `group` baru tiap render akan memicu effect reset draft terus-menerus.
const NO_GROUP = [];
const client = new QueryClient();

function Host({ expose, controlled = true, onTreeChange, withRow = false }) {
  const [tree, setTree] = useState(null);
  const handleTree = (next) => {
    onTreeChange?.(next);
    setTree(next);
    return Promise.resolve();
  };
  const draft = useSearchDraft({
    tree,
    group: NO_GROUP,
    onTreeChange: handleTree,
  });
  expose.current = draft;
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <SearchBar
          columns={columns}
          tree={tree}
          onTreeChange={handleTree}
          draft={controlled ? draft : undefined}
        />
        {withRow && (
          <table>
            <thead>
              <ColumnFilterRow
                showedColumns={[{ name: "name" }, { name: "qty" }]}
                columnFilter={{ columns, draft, onOpenBuilder: () => {} }}
              />
            </thead>
          </table>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const setup = (props = {}) => {
  const expose = { current: null };
  const onTreeChange = vi.fn();
  render(<Host expose={expose} onTreeChange={onTreeChange} {...props} />);
  return { expose, onTreeChange };
};

describe("SearchBar dengan draft terkontrol", () => {
  it("commit dari luar (Sel Filter) muncul sbg chip di Search Bar", async () => {
    const { expose, onTreeChange } = setup();
    await act(async () => {
      await expose.current.commitTreeChange((d) =>
        addLeafChip(d, { k: "qty", o: ">=", v: 5 }),
      );
    });
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Jumlah/)).toBeTruthy();
  });

  it("draft yang belum di-apply tampil sbg chip tanpa memanggil host", () => {
    const { expose, onTreeChange } = setup();
    act(() => {
      expose.current.setDraftTree(
        addLeafChip(null, { k: "name", o: "matches", v: "abc" }),
      );
    });
    expect(screen.getByText(/Nama/)).toBeTruthy();
    expect(onTreeChange).not.toHaveBeenCalled();
  });

  it("commit sel meng-apply draft atas yang belum di-apply (tak hilang)", async () => {
    const { expose, onTreeChange } = setup();
    act(() => {
      expose.current.setDraftTree(
        addLeafChip(null, { k: "name", o: "matches", v: "abc" }),
      );
    });
    await act(async () => {
      await expose.current.commitTreeChange((d) =>
        addLeafChip(d, { k: "code", o: "matches", v: "xyz" }),
      );
    });
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    const applied = onTreeChange.mock.calls[0][0];
    const keys = Object.values(applied.root.c)
      .map((n) => n.k)
      .sort();
    expect(keys).toEqual(["code", "name"]);
    expect(screen.getByText(/Nama/)).toBeTruthy();
    expect(screen.getByText(/Kode/)).toBeTruthy();
  });

  it("tanpa prop draft: SearchBar memakai draft internal (perilaku lama)", () => {
    setup({ controlled: false });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});

describe("SearchBar draft langsung (Requirement 14)", () => {
  const colLeaves = (expose) =>
    Object.values(expose.current.draftTree?.root?.c ?? {})
      .map((n) => `${n.k}${n.o}${JSON.stringify(n.v)}`)
      .sort();

  it("ketikan di Search Bar atas (mode nilai) muncul sbg badge di sel kolomnya saat itu juga", async () => {
    const user = userEvent.setup();
    const { expose, onTreeChange } = setup({ withRow: true });
    await user.click(screen.getAllByRole("textbox")[0]); // input Search Bar atas
    await user.keyboard("jumlah:");
    await user.keyboard("5");
    await waitFor(() => expect(colLeaves(expose)).toEqual(["qty=5"]));
    // sel Jumlah menampilkan badge dari draft yang sama, belum di-apply
    await waitFor(() =>
      expect(screen.getAllByTestId("column-filter-badge")).toHaveLength(1),
    );
    expect(onTreeChange).not.toHaveBeenCalled();
  });
});
