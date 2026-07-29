import React, { useEffect, useImperativeHandle, useState } from "react";

// Highlight bagian text yang cocok dengan query, mengikuti pola highlight
// LinkModel (lib/linkModelUtils.js::convertTemplateLink) — di sini label
// selalu plain text (bukan HTML), jadi cukup React children biasa tanpa
// dangerouslySetInnerHTML.
function highlightMatch(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index} className="bg-yellow-500">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// Suggestion dropdown for @mentions. Follows Tiptap's official React example:
// `ref` arrives as a prop (React 19) and exposes onKeyDown via useImperativeHandle
// so the editor can drive keyboard navigation.
export default function TiptapMentionList(props) {
  const { items, command, query, ref } = props;
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
    <div className="bg-popover border border-border rounded-md shadow-md min-w-[160px] py-1 max-h-[300px] overflow-y-auto overflow-x-hidden">
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
            <span className="truncate">
              {highlightMatch(item.label, query)}
            </span>
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
