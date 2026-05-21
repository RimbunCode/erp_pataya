import * as React from "react";

import { cn } from "@/lib/utils";

export default function CustomBlockManager({
  mapCategoryBlocks,
  dragStart,
  dragStop,
}) {
  return (
    <div className="gjs-custom-block-manager text-left text-sm text-foreground">
      {Array.from(mapCategoryBlocks).map(([category, blocks]) => (
        <div key={category}>
          <div
            className={cn(
              "border-y border-border bg-muted/40 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground",
            )}
          >
            {category}
          </div>
          <div className="grid grid-cols-2 gap-2 p-2">
            {blocks.map((block) => (
              <div
                key={block.getId()}
                draggable
                className={cn(
                  "group flex cursor-grab flex-col items-center rounded-md border border-border bg-background px-3 py-2 transition-all",
                  "hover:border-primary/40 hover:bg-accent/70 active:scale-[0.99] active:cursor-grabbing",
                )}
                onDragStart={(ev) => {
                  dragStart(block, ev.nativeEvent);
                }}
                onDragEnd={() => dragStop(false)}
              >
                <div
                  className="h-10 w-10 text-muted-foreground transition-colors group-hover:text-foreground"
                  dangerouslySetInnerHTML={{ __html: block.getMedia() }}
                />
                <div
                  className="w-full text-center text-xs font-medium text-foreground"
                  title={block.getLabel()}
                >
                  {block.getLabel()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
