import { jsx, jsxs } from "react/jsx-runtime";
import "react";
import { I as Input, a as InputWrapper } from "./input-wk3Ou7wI.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { S as Select } from "./Select-DB9toH_t.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import { useEditor } from "@grapesjs/react";
import "class-variance-authority";
import "lucide-react";
import "radix-ui";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "react-detect-click-outside";
import "laravel-react-i18n";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
function Checkbox({ className = "", ...props }) {
  return /* @__PURE__ */ jsx(
    "input",
    {
      ...props,
      type: "checkbox",
      className: "rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-indigo-600 dark:focus:ring-offset-gray-800 " + className
    }
  );
}
function TraitPropertyField({ trait, ...rest }) {
  const editor = useEditor();
  const handleChange = (value2) => {
    trait.setValue(value2);
  };
  const onChange = (ev) => {
    handleChange(ev.target.value);
  };
  const handleButtonClick = () => {
    const command = trait.get("command");
    if (command) {
      typeof command === "string" ? editor.runCommand(command) : command(editor, trait);
    }
  };
  const type = trait.getType();
  const defValue = trait.getDefault() || trait.attributes.placeholder;
  const value = trait.getValue();
  const valueWithDef = typeof value !== "undefined" ? value : defValue;
  let inputToRender = /* @__PURE__ */ jsx(Input, { placeholder: defValue, value, onValueChange: onChange });
  switch (type) {
    case "select":
      {
        inputToRender = /* @__PURE__ */ jsx(
          Select,
          {
            value,
            onValueChange: onChange,
            options: trait.getOptions().map((opt) => ({
              value: trait.getOptionId(opt),
              label: trait.getOptionLabel(opt)
            }))
          }
        );
      }
      break;
    case "color":
      {
        inputToRender = /* @__PURE__ */ jsxs(InputWrapper, { children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: `w-[15px] h-[15px] `,
              style: { backgroundColor: valueWithDef },
              children: /* @__PURE__ */ jsx(
                "input",
                {
                  type: "color",
                  className: "w-[15px] h-[15px] cursor-pointer opacity-0",
                  value: valueWithDef,
                  onChange: (ev) => handleChange(ev.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            Input,
            {
              placeholder: defValue,
              value,
              onValueChange: onChange
            }
          )
        ] });
      }
      break;
    case "checkbox":
      {
        inputToRender = /* @__PURE__ */ jsx(
          Checkbox,
          {
            checked: value,
            onChange: (ev) => trait.setValue(ev.target.checked),
            size: "small"
          }
        );
      }
      break;
    case "button":
      {
        inputToRender = /* @__PURE__ */ jsx(Button, { onClick: handleButtonClick, children: trait.getLabel() });
      }
      break;
  }
  return /* @__PURE__ */ jsxs("div", { ...rest, className: cn("mb-3 px-1 w-full"), children: [
    /* @__PURE__ */ jsx("div", { className: cn("flex mb-2 items-center"), children: /* @__PURE__ */ jsx("div", { className: "flex-grow capitalize", children: trait.getLabel() }) }),
    inputToRender
  ] });
}
export {
  TraitPropertyField as default
};
