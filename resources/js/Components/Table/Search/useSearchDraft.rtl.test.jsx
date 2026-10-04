// Test useSearchDraft (task 4.4): staged-apply draft yang diangkat dari
// SearchBar -- apply menolak saat busy, reset dari `tree` luar, dan
// `commitTreeChange` tidak kehilangan perubahan/draft yang belum di-apply
// (spec datatable2-column-search-row, Requirement 6.7, 7.4, 7.5).

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { addLeafChip } from "./searchChips";
import useSearchDraft from "./useSearchDraft";

const leafKeys = (tree) =>
  Object.values(tree?.root?.c ?? {})
    .map((n) => `${n.k}:${n.o}`)
    .sort();

function Harness({ expose, ...props }) {
  const draft = useSearchDraft(props);
  expose.current = draft;
  return <span data-testid="busy">{String(draft.busy)}</span>;
}

const setup = (props = {}) => {
  const expose = { current: null };
  const onTreeChange = props.onTreeChange ?? vi.fn();
  const onGroupChange = props.onGroupChange ?? vi.fn();
  const onPickSaved = props.onPickSaved ?? vi.fn();
  const utils = render(
    <Harness
      expose={expose}
      tree={props.tree ?? null}
      group={props.group ?? []}
      onTreeChange={onTreeChange}
      onGroupChange={onGroupChange}
      onPickSaved={onPickSaved}
    />,
  );
  return { expose, onTreeChange, onGroupChange, onPickSaved, ...utils };
};

const withLeaf = (leaf) => (draft) => addLeafChip(draft, leaf);

describe("useSearchDraft", () => {
  it("commitTreeChange menulis draft lalu meng-apply ke host", async () => {
    const { expose, onTreeChange } = setup();
    await act(async () => {
      await expose.current.commitTreeChange(
        withLeaf({ k: "name", o: "matches", v: "abc" }),
      );
    });
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(leafKeys(onTreeChange.mock.calls[0][0])).toEqual(["name:matches"]);
    expect(leafKeys(expose.current.draftTree)).toEqual(["name:matches"]);
  });

  it("menolak commit baru selagi commit sebelumnya pending (busy), lalu pulih", async () => {
    let resolve;
    const onTreeChange = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { expose } = setup({ onTreeChange });

    await act(async () => {
      await expose.current.commitTreeChange(
        withLeaf({ k: "name", o: "matches", v: "a" }),
      );
    });
    expect(screen.getByTestId("busy").textContent).toBe("true");

    await act(async () => {
      await expect(
        expose.current.commitTreeChange(withLeaf({ k: "qty", o: ">", v: 5 })),
      ).rejects.toThrow("busy");
    });
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    // draft tak berubah oleh commit yang ditolak
    expect(leafKeys(expose.current.draftTree)).toEqual(["name:matches"]);

    await act(async () => {
      resolve();
    });
    expect(screen.getByTestId("busy").textContent).toBe("false");
  });

  it("applyDraft tidak memanggil host saat busy", async () => {
    let resolve;
    const onTreeChange = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { expose } = setup({ onTreeChange });
    await act(async () => {
      await expose.current.commitTreeChange(
        withLeaf({ k: "name", o: "matches", v: "a" }),
      );
    });
    act(() => {
      expose.current.setDraftTree(
        addLeafChip(expose.current.draftTree, { k: "qty", o: ">", v: 5 }),
      );
    });
    act(() => {
      expose.current.applyDraft();
    });
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
    });
  });

  it("dua commit beruntun dalam satu tick tidak kehilangan perubahan (ref sinkron)", async () => {
    const onTreeChange = vi.fn(); // sinkron: tidak busy
    const { expose } = setup({ onTreeChange });
    await act(async () => {
      await expose.current.commitTreeChange(
        withLeaf({ k: "name", o: "matches", v: "a" }),
      );
      await expose.current.commitTreeChange(
        withLeaf({ k: "qty", o: ">", v: 5 }),
      );
    });
    expect(onTreeChange).toHaveBeenCalledTimes(2);
    expect(leafKeys(onTreeChange.mock.calls[1][0])).toEqual([
      "name:matches",
      "qty:>",
    ]);
  });

  it("draft yang belum di-apply ikut ter-apply saat commit sel (tak hilang)", async () => {
    const { expose, onTreeChange } = setup();
    // chip yang disusun di Search Bar atas tapi belum di-apply
    act(() => {
      expose.current.setDraftTree(
        addLeafChip(null, { k: "status", o: "=", v: "Draft" }),
      );
    });
    expect(onTreeChange).not.toHaveBeenCalled();

    await act(async () => {
      await expose.current.commitTreeChange(
        withLeaf({ k: "customer", o: "matches", v: "PT A" }),
      );
    });
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(leafKeys(onTreeChange.mock.calls[0][0])).toEqual([
      "customer:matches",
      "status:=",
    ]);
  });

  it("group draft ikut ter-apply bersama commit sel", async () => {
    const { expose, onGroupChange } = setup();
    const groups = [{ column: "status", granularity: null, range: null }];
    act(() => {
      expose.current.setDraftGroup(groups);
    });
    await act(async () => {
      await expose.current.commitTreeChange(
        withLeaf({ k: "name", o: "matches", v: "a" }),
      );
    });
    expect(onGroupChange).toHaveBeenCalledWith(groups);
  });

  it("pendingSaved dilepas dan edit sel di-apply sbg tree biasa (bukan onPickSaved)", async () => {
    const { expose, onTreeChange, onPickSaved } = setup();
    const saved = {
      id: 9,
      filter: addLeafChip(null, { k: "status", o: "=", v: "Open" }),
    };
    act(() => {
      expose.current.setPendingSaved(saved);
      expose.current.setDraftTree(saved.filter);
    });
    await act(async () => {
      await expose.current.commitTreeChange(
        withLeaf({ k: "name", o: "matches", v: "a" }),
      );
    });
    expect(onPickSaved).not.toHaveBeenCalled();
    expect(expose.current.pendingSaved).toBeNull();
    expect(leafKeys(onTreeChange.mock.calls[0][0])).toEqual([
      "name:matches",
      "status:=",
    ]);
  });

  it("applyDraft dengan pendingSaved memanggil onPickSaved (jalur lama tak berubah)", () => {
    const { expose, onPickSaved, onTreeChange } = setup();
    const saved = {
      id: 3,
      filter: addLeafChip(null, { k: "a", o: "=", v: 1 }),
    };
    act(() => {
      expose.current.setPendingSaved(saved);
    });
    act(() => {
      expose.current.applyDraft();
    });
    expect(onPickSaved).toHaveBeenCalledWith(saved);
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(expose.current.pendingSaved).toBeNull();
  });

  it("draft di-reset ke tree terapan yang berubah dari luar (Builder/saved/addFilter)", () => {
    const expose = { current: null };
    const onTreeChange = vi.fn();
    const treeA = addLeafChip(null, { k: "name", o: "matches", v: "a" });
    const treeB = addLeafChip(null, { k: "qty", o: ">", v: 5 });
    const { rerender } = render(
      <Harness
        expose={expose}
        tree={treeA}
        group={[]}
        onTreeChange={onTreeChange}
      />,
    );
    expect(leafKeys(expose.current.draftTree)).toEqual(["name:matches"]);
    rerender(
      <Harness
        expose={expose}
        tree={treeB}
        group={[]}
        onTreeChange={onTreeChange}
      />,
    );
    expect(leafKeys(expose.current.draftTree)).toEqual(["qty:>"]);
  });

  it("isDraftDirty: true bila draft beda dari tree terapan", () => {
    const { expose } = setup();
    expect(expose.current.isDraftDirty).toBe(false);
    act(() => {
      expose.current.setDraftTree(addLeafChip(null, { k: "a", o: "=", v: 1 }));
    });
    expect(expose.current.isDraftDirty).toBe(true);
  });
});
