import { jsxs, jsx } from "react/jsx-runtime";
import { PlusIcon, XIcon } from "lucide-react";
import { S as Select } from "./Select-DB9toH_t.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import "./command-BSnyCa9u.js";
import "react";
import "@radix-ui/react-dialog";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "class-variance-authority";
import "./input-wk3Ou7wI.js";
import "react-detect-click-outside";
import "laravel-react-i18n";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
function CustomSelectorManager({
  selectors,
  selectedState,
  states,
  targets,
  setState,
  addSelector,
  removeSelector
}) {
  const addNewSelector = () => {
    const next = selectors.length + 1;
    addSelector({ name: `new-${next}`, label: `New ${next}` });
  };
  const targetStr = targets.join(", ");
  return /* @__PURE__ */ jsxs("div", { className: "gjs-custom-selector-manager p-2 flex flex-col gap-2 text-left", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center", children: [
      /* @__PURE__ */ jsx("div", { className: "flex-grow", children: "Selectors" }),
      /* @__PURE__ */ jsx(
        Select,
        {
          value: selectedState,
          onChange: (ev) => setState(ev.target.value),
          options: states.map((state) => ({
            value: state.id,
            label: state.getName()
          }))
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: cn(
          "flex items-center gap-2 flex-wrap p-2 bg-black/30 border rounded min-h-[45px]"
        ),
        children: [
          targetStr ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: addNewSelector,
              className: cn("border rounded px-2 py-1"),
              children: /* @__PURE__ */ jsx(PlusIcon, {})
            }
          ) : /* @__PURE__ */ jsx("div", { className: "opacity-70", children: "Select a component" }),
          selectors.map((selector) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "px-2 py-1 flex items-center gap-1 whitespace-nowrap bg-sky-500 rounded",
              children: [
                /* @__PURE__ */ jsx("div", { children: selector.getLabel() }),
                /* @__PURE__ */ jsx("button", { type: "button", onClick: () => removeSelector(selector), children: /* @__PURE__ */ jsx(XIcon, {}) })
              ]
            },
            selector.toString()
          ))
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { children: [
      "Selected: ",
      /* @__PURE__ */ jsx("span", { className: "opacity-70", children: targetStr || "None" })
    ] })
  ] });
}
export {
  CustomSelectorManager as default
};
