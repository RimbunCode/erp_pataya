/**
 * Menentukan visibility/filter field Branch pada form berdasarkan daftar
 * Branch yang bisa diakses user (branchSettings.branches dari AppMiddleware).
 * Branch Company selalu branchable null (Location/Warehouse disimpan di situ,
 * bukan di Branch milik Customer/Supplier dsb yang branchable-nya terisi).
 * @param {Array<{id: string, is_main_branch?: boolean}>} branches
 * @param {object} [currentBranch]
 * @returns {{currentBranch: object|undefined, hasMainBranchAccess: boolean, isLocked: boolean, filters: object}}
 */
export function resolveBranchFieldAccess(branches = [], currentBranch) {
  const hasMainBranchAccess = branches.some((branch) => branch?.is_main_branch);
  const isLocked = branches.length === 1 && !hasMainBranchAccess;

  const filters = {
    branchable_type: null,
    branchable_id: null,
    ...(hasMainBranchAccess
      ? {}
      : { id: { in: branches.map((branch) => branch.id) } }),
  };

  return { currentBranch, hasMainBranchAccess, isLocked, filters };
}
