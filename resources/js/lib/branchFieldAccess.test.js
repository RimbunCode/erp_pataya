import { describe, expect, it } from "vitest";

import { resolveBranchFieldAccess } from "./branchFieldAccess";

describe("resolveBranchFieldAccess", () => {
  it("user punya akses branch utama: tidak locked, filter tanpa batasan id", () => {
    const branches = [
      { id: "b1", is_main_branch: false },
      { id: "main", is_main_branch: true },
    ];

    const result = resolveBranchFieldAccess(branches, branches[0]);

    expect(result.hasMainBranchAccess).toBe(true);
    expect(result.isLocked).toBe(false);
    expect(result.filters).toEqual({
      branchable_type: null,
      branchable_id: null,
    });
  });

  it("user hanya akses 1 branch non-utama: locked, filter dibatasi 1 id itu", () => {
    const branches = [{ id: "b1", is_main_branch: false }];

    const result = resolveBranchFieldAccess(branches, branches[0]);

    expect(result.isLocked).toBe(true);
    expect(result.filters).toEqual({
      branchable_type: null,
      branchable_id: null,
      id: { in: ["b1"] },
    });
  });

  it("user akses beberapa branch non-utama: tidak locked, filter dibatasi daftar id yang dia akses", () => {
    const branches = [
      { id: "b1", is_main_branch: false },
      { id: "b2", is_main_branch: false },
    ];

    const result = resolveBranchFieldAccess(branches, branches[0]);

    expect(result.isLocked).toBe(false);
    expect(result.filters).toEqual({
      branchable_type: null,
      branchable_id: null,
      id: { in: ["b1", "b2"] },
    });
  });

  it("tanpa branches (default): tidak locked, currentBranch undefined", () => {
    const result = resolveBranchFieldAccess();

    expect(result.isLocked).toBe(false);
    expect(result.currentBranch).toBeUndefined();
    expect(result.filters).toEqual({
      branchable_type: null,
      branchable_id: null,
      id: { in: [] },
    });
  });
});
