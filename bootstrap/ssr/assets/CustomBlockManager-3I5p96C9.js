import { jsx, jsxs } from "react/jsx-runtime";
import "react";
import { c as cn } from "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
function CustomBlockManager({
  mapCategoryBlocks,
  dragStart,
  dragStop
}) {
  return /* @__PURE__ */ jsx("div", { className: "gjs-custom-block-manager text-left", children: Array.from(mapCategoryBlocks).map(([category, blocks]) => /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { className: cn("py-2 px-4 border-y"), children: category }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2 p-2", children: blocks.map((block) => /* @__PURE__ */ jsxs(
      "div",
      {
        draggable: true,
        className: cn(
          "flex flex-col items-center border rounded cursor-pointer py-2 px-5 transition-colors"
        ),
        onDragStart: (ev) => {
          dragStart(block, ev.nativeEvent);
        },
        onDragEnd: () => dragStop(false),
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "h-10 w-10",
              dangerouslySetInnerHTML: { __html: block.getMedia() }
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "text-sm text-center w-full",
              title: block.getLabel(),
              children: block.getLabel()
            }
          )
        ]
      },
      block.getId()
    )) })
  ] }, category)) });
}
export {
  CustomBlockManager as default
};
