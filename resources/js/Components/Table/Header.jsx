import {
  ArrowDownZA,
  ArrowUpAZ,
  Columns3,
  EllipsisVertical,
  GripVertical,
  ListRestart,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { cn, mergeRefs } from "@/lib/utils";
import { forwardRef, memo, useCallback, useEffect, useState } from "react";

import { Button } from "../ui/button";
import { CSS } from "@dnd-kit/utilities";
import { DialogTrigger } from "../ui/dialog";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { useSortable } from "@dnd-kit/sortable";

export default memo(
  forwardRef(function Header(
    {
      id,
      title,
      name,
      tableHeight,
      onResize,
      freezeColumn,
      resizeable,
      sortable,
      setSort,
      resetSorting,
    },
    ref,
  ) {
    const mouseUp = useCallback(() => {
      setActive(false);
    }, []);

    useEffect(() => {
      window.addEventListener("mouseup", mouseUp);

      return () => {
        window.removeEventListener("mouseup", mouseUp);
      };
    }, []);

    const [active, setActive] = useState(false);
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const mouseDown = (e) => {
      setActive(true);
      onResize(e);
    };
    return (
      <th
        ref={mergeRefs(setNodeRef, ref)}
        style={!freezeColumn ? style : {}}
        className="group"
      >
        <div
          className={cn(
            !freezeColumn && "!-ml-5",
            "flex justify-between gap-x-2",
          )}
        >
          <div className="flex items-center">
            {!freezeColumn && (
              <button className="cursor-move " {...listeners} {...attributes}>
                <GripVertical className="transition-colors group-hover:text-foreground text-muted size-5" />
              </button>
            )}
            {sortable ? (
              <button
                type="button"
                className="flex items-center hover:underline gap-x-2 [&>svg]:size-5"
                onClick={() => setSort(name)}
              >
                {title}
              </button>
            ) : (
              <span>{title}</span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="!px-1 !py-1">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              {sortable && (
                <>
                  <DropdownMenuItem onClick={() => setSort(name, "asc")}>
                    <ArrowUpAZ absoluteStrokeWidth />
                    Sort Ascending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort(name, "desc")}>
                    <ArrowDownZA />
                    Sort Descending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={resetSorting}>
                    <ListRestart />
                    Reset Sorting
                  </DropdownMenuItem>
                </>
              )}
              <DialogTrigger asChild>
                <DropdownMenuItem>
                  <Columns3 /> Show/Hide Columns
                </DropdownMenuItem>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {resizeable && (
          <div
            style={{ height: tableHeight }}
            onMouseDown={mouseDown}
            className={`resize-handle ${active ? "active" : "idle"}`}
          />
        )}
      </th>
    );
  }),
);
