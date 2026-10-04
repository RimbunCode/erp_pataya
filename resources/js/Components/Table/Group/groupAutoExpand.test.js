import { describe, expect, it } from "vitest";

import { AUTO_EXPAND_MAX_GROUPS, computeAutoExpand } from "./groupAutoExpand";

const items = (...counts) =>
  counts.map((count, i) => ({ key: `g${i}`, count }));

describe("computeAutoExpand", () => {
  it("membuka berurutan selama kumulatif count muat di anggaran", () => {
    const picked = computeAutoExpand(items(5, 10, 10, 1), { budget: 25 });

    expect(picked.map((i) => i.key)).toEqual(["g0", "g1", "g2"]);
  });

  it("berhenti di grup pertama yang membuat kumulatif melebihi anggaran", () => {
    const picked = computeAutoExpand(items(5, 10, 20, 1), { budget: 25 });

    expect(picked.map((i) => i.key)).toEqual(["g0", "g1"]);
  });

  it("grup pertama selalu dibuka walau count-nya melebihi anggaran", () => {
    const picked = computeAutoExpand(items(100, 1), { budget: 25 });

    expect(picked.map((i) => i.key)).toEqual(["g0"]);
  });

  it("dibatasi maxGroups (default 3)", () => {
    expect(AUTO_EXPAND_MAX_GROUPS).toBe(3);
    const picked = computeAutoExpand(items(1, 1, 1, 1, 1), { budget: 25 });
    expect(picked).toHaveLength(3);

    const two = computeAutoExpand(items(1, 1, 1), { budget: 25, maxGroups: 2 });
    expect(two).toHaveLength(2);
  });

  it("daftar kosong/undefined -> kosong", () => {
    expect(computeAutoExpand([], { budget: 25 })).toEqual([]);
    expect(computeAutoExpand(undefined, { budget: 25 })).toEqual([]);
  });
});
