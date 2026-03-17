import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import FilterItem2 from "./FilterItem2";
import { RiGitMergeLine } from "@remixicon/react";
import Select from "@/Components/Select";
import { cn } from "@/lib/utils";
import useNestedFilters, {
  getNodeById,
  isGroupNode,
} from "@/Hooks/useNestedFilters";

function FilterGroup2({ id }) {
  const {
    filters,
    updateGroupKey,
    addItemToGroup,
    addGroupToGroup,
    removeNode,
  } = useNestedFilters();
  const filter = getNodeById(filters, id);

  if (!filter || !isGroupNode(filter)) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-subgrid col-span-full gap-y-2 border-y border-l border-muted-foreground/30 rounded-l-lg pb-4",
        id === "root" && "rounded-lg border",
      )}
    >
      <Select
        className="w-32"
        value={filter.key ?? "and"}
        optionTrans="core.datatable.filter.group.options"
        options={["and", "or"]}
        onValueChange={(value) => updateGroupKey(id, value)}
      />
      {id !== "root" && (
        <div className="flex gap-x-1 pr-2 -col-start-1">
          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => addItemToGroup(id)}
          >
            <PlusIcon />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => addGroupToGroup(id)}
          >
            <RiGitMergeLine />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => removeNode(id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
      <div className="pl-8 grid grid-cols-subgrid col-span-full gap-y-2">
        {Object.entries(filter.children ?? {}).map(([key, value]) =>
          isGroupNode(value) ? (
            <FilterGroup2 key={key} id={key} />
          ) : (
            <FilterItem2 key={key} id={key} />
          ),
        )}
      </div>
    </div>
  );
}

export default FilterGroup2;
