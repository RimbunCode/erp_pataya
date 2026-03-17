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
import { forwardRef, memo } from "react";

import { Button } from "../ui/button";
import { CSS } from "@dnd-kit/utilities";
import { DialogTrigger } from "../ui/dialog";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { RunningText, RunningTextContent } from "../ui/running-text";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useSortable } from "@dnd-kit/sortable";

export default memo(
  forwardRef(function Header(
    {
      id,
      title,
      titleTrans,
      name,
      isEmpty,
      tableHeight,
      onResize,
      onResetSize,
      freezeColumn,
      resizeable,
      sortable,
      setSort,
      resetSorting,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const headerTitle = title ?? t(titleTrans);
    const hasPlainTitle =
      typeof headerTitle === "string" || typeof headerTitle === "number";

    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const mouseDown = (e) => {
      onResize(e);
    };
    const doubleClick = (e) => {
      onResetSize(e);
    };
    return (
      <th
        ref={mergeRefs(setNodeRef, ref)}
        style={!freezeColumn ? style : {}}
        className="pr-3! group/header"
      >
        <div
          className={cn(
            !freezeColumn && "-ml-5!",
            "flex min-w-0 justify-between gap-x-2 group",
          )}
        >
          <div className="flex min-w-0 items-center">
            {!freezeColumn && (
              <button className="cursor-move " {...listeners} {...attributes}>
                <GripVertical className="transition-colors group-hover:text-foreground text-muted size-5" />
              </button>
            )}
            <RunningText className="w-full">
              {sortable ? (
                <button
                  type="button"
                  className="flex items-center hover:underline gap-x-2 [&>svg]:size-5"
                  onClick={() => setSort(name)}
                >
                  {hasPlainTitle ? (
                    <RunningTextContent text={headerTitle} />
                  ) : (
                    headerTitle
                  )}
                </button>
              ) : (
                <>
                  {hasPlainTitle ? (
                    <RunningTextContent text={headerTitle} />
                  ) : (
                    headerTitle
                  )}
                </>
              )}
            </RunningText>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-1! py-1! ">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              {sortable && (
                <>
                  <DropdownMenuItem onClick={() => setSort(name, "asc")}>
                    <ArrowUpAZ absoluteStrokeWidth />
                    {t("core.datatable.sorting.sort_ascending")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort(name, "desc")}>
                    <ArrowDownZA />
                    {t("core.datatable.sorting.sort_descending")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={resetSorting}>
                    <ListRestart />
                    {t("core.datatable.sorting.reset_sorting")}
                  </DropdownMenuItem>
                </>
              )}
              <DialogTrigger asChild>
                <DropdownMenuItem>
                  <Columns3 />
                  {t("core.datatable.columns.trigger")}
                </DropdownMenuItem>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div
          style={{ height: tableHeight }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (resizeable) mouseDown(e);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (resizeable) doubleClick(e);
          }}
          className={cn(
            style.transform ? "opacity-0" : "opacity-100",
            resizeable ? "cursor-col-resize" : "cursor-default",
            isEmpty ? "h-[40px]!" : "",
            `flex transition-opacity justify-center items-center absolute w-4 -right-2 top-0 z-1 group`,
          )}
        >
          <div
            className={cn(
              resizeable
                ? " group-hover:border-muted-foreground  group-active:border-foreground group-active:border-r-[3px]"
                : "",
              "h-full w-px border-r border-muted-foreground/15",
            )}
          ></div>
        </div>
      </th>
    );
  }),
);
