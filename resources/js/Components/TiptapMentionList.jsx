import React, { useEffect, useImperativeHandle, useState } from "react";

// Suggestion dropdown for @mentions. Follows Tiptap's official React example:
// `ref` arrives as a prop (React 19) and exposes onKeyDown via useImperativeHandle
// so the editor can drive keyboard navigation.
export default function TiptapMentionList(props) {
  const { items, command, ref } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index) => {
    const item = items[index];
    if (item) {
      command({ id: item.id, label: item.label });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + items.length - 1) % items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-popover border border-border rounded-md shadow-md overflow-hidden min-w-[160px] py-1">
      {items.length ? (
        items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors cursor-pointer select-none ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              selectItem(index);
            }}
          >
            <span className="truncate">{item.label}</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-1.5 text-sm text-muted-foreground">
          No results
        </div>
      )}
    </div>
  );
}
