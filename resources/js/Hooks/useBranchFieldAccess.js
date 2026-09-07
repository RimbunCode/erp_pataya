import { resolveBranchFieldAccess } from "@/lib/branchFieldAccess";
import { usePage } from "@inertiajs/react";

export default function useBranchFieldAccess() {
  const { branches = [], currentBranch } = usePage().props.branchSettings ?? {};

  return resolveBranchFieldAccess(branches, currentBranch);
}
