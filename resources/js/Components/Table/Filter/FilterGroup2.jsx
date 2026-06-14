import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import FilterItem2 from "./FilterItem2";
import { RiGitMergeLine } from "@remixicon/react";
import Select from "@/Components/Select";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useNestedFilters, {
  canWrapGroup,
  getNodeById,
  getSubtreeMaxDepth,
  isGroupNode,
  MAX_NESTED_DEPTH,
} from "@/Hooks/useNestedFilters";

function FilterGroup2({ id, depth = 0 }) {
  const {
    filters,
    updateGroupKey,
    addItemToGroup,
    wrapGroupWithGroup,
    removeNode,
  } = useNestedFilters();
  const { t } = useLaravelReactI18n();
  const filter = getNodeById(filters, id);
  const cannotBranch = !canWrapGroup(filters, id);
  // Group ini sudah berada di kedalaman peringatan.
  const isTooDeep = depth >= MAX_NESTED_DEPTH;
  // Warning bila: (a) keturunan node ini sudah mencapai batas (subtree dalam),
  // atau (b) branch di sini akan membuat group baru yang melewati batas.
  // Node dangkal tanpa keturunan dalam tetap normal.
  const subtreeReachesLimit =
    getSubtreeMaxDepth(filter, depth) >= MAX_NESTED_DEPTH;
  const branchWillBeTooDeep =
    subtreeReachesLimit || depth + 1 >= MAX_NESTED_DEPTH;

  if (!filter || !isGroupNode(filter)) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-subgrid col-span-full gap-y-2 border-y border-l border-muted-foreground/30 rounded-l-lg mb-2",
        id === "root" && "rounded-lg border",
        isTooDeep && "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20",
      )}
    >
      <div
        style={{
          top: `calc(var(--row-h) * ${depth})`,
          height: "var(--row-h)",
          zIndex: 50 - depth,
        }}
        className={cn(
          "sticky grid grid-cols-subgrid col-span-full items-center bg-background",
          isTooDeep && "bg-amber-50 dark:bg-amber-950",
        )}
      >
        <Select
          className="w-72 col-span-3"
          value={filter.k ?? "and"}
          optionTrans="core.datatable.filter.group.options"
          options={["and", "or"]}
          onValueChange={(value) => updateGroupKey(id, value)}
        />
        <Button
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => addItemToGroup(id)}
        >
          <PlusIcon />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={cn(
                cannotBranch && "opacity-50 cursor-not-allowed",
                !cannotBranch &&
                  branchWillBeTooDeep &&
                  "text-amber-600 hover:text-amber-700 dark:text-amber-400",
              )}
              size="icon"
              variant="ghost"
              type="button"
              aria-disabled={cannotBranch}
              onClick={() => {
                if (cannotBranch) return;
                wrapGroupWithGroup(id);
              }}
            >
              <RiGitMergeLine />
            </Button>
          </TooltipTrigger>
          {cannotBranch ? (
            <TooltipContent>
              {t("core.datatable.filter.branch.disabled_single_group")}
            </TooltipContent>
          ) : branchWillBeTooDeep ? (
            <TooltipContent>
              {t("core.datatable.filter.depth_warning.branch", {
                max: MAX_NESTED_DEPTH,
              })}
            </TooltipContent>
          ) : null}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={cn(id === "root" && "opacity-50 cursor-not-allowed")}
              size="icon"
              variant="ghost"
              type="button"
              aria-disabled={id === "root"}
              onClick={() => {
                if (id === "root") return;
                removeNode(id);
              }}
            >
              <Trash2Icon />
            </Button>
          </TooltipTrigger>
          {id === "root" && (
            <TooltipContent>
              {t("core.datatable.filter.delete.disabled_root_group")}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
      <div className="pl-8 grid grid-cols-subgrid col-span-full">
        {Object.entries(filter.c ?? {}).map(([key, value]) =>
          isGroupNode(value) ? (
            <FilterGroup2 key={key} id={key} depth={depth + 1} />
          ) : (
            <FilterItem2 key={key} id={key} depth={depth} />
          ),
        )}
      </div>
    </div>
  );
}

export default FilterGroup2;
