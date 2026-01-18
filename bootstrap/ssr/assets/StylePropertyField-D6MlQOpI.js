import { jsx, jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Circle, ChevronUpCircleIcon, ChevronDownCircleIcon, Trash2Icon, PlusIcon } from "lucide-react";
import { I as Input, a as InputWrapper } from "./input-wk3Ou7wI.js";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { c as cn } from "./utils-ClCZGsDL.js";
import { Slider as Slider$1 } from "radix-ui";
import { B as Button } from "./button-Us2TB7GG.js";
import { a as FormInput } from "./checkbox-C_BEU5E4.js";
import "./label-DiFvdPYz.js";
import { S as Select } from "./Select-DB9toH_t.js";
import { useEditor } from "@grapesjs/react";
import "class-variance-authority";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@radix-ui/react-checkbox";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "laravel-react-i18n";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@radix-ui/react-label";
const RadioGroup = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(RadioGroupPrimitive.Root, { className: cn("grid gap-2", className), ...props, ref });
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;
const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    RadioGroupPrimitive.Item,
    {
      ref,
      className: cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(RadioGroupPrimitive.Indicator, { className: "flex items-center justify-center", children: /* @__PURE__ */ jsx(Circle, { className: "h-2.5 w-2.5 fill-current text-current" }) })
    }
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;
function Slider({ className, children, ...props }) {
  return /* @__PURE__ */ jsxs(
    Slider$1.Root,
    {
      "data-slot": "slider",
      className: cn(
        "relative flex h-4 w-full touch-none select-none items-center",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx(Slider$1.Track, { className: "relative h-1.5 w-full overflow-hidden rounded-full bg-accent", children: /* @__PURE__ */ jsx(Slider$1.Range, { className: "absolute h-full bg-primary" }) }),
        children
      ]
    }
  );
}
function SliderThumb({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    Slider$1.Thumb,
    {
      "data-slot": "slider-thumb",
      className: cn(
        "box-content block size-4 shrink-0 cursor-pointer rounded-full border-[2px] border-primary bg-primary-foreground shadow-xs shadow-black/5 outline-hidden focus:outline-hidden",
        className
      ),
      ...props
    }
  );
}
function StylePropertyField({ prop, ...rest }) {
  const editor = useEditor();
  const handleChange = (value2) => {
    prop.upValue(value2);
  };
  const onChange = (ev) => {
    handleChange(ev);
  };
  const openAssets = () => {
    const { Assets } = editor;
    Assets.open({
      select: (asset, complete) => {
        console.log({ complete });
        prop.upValue(asset.getSrc(), { partial: !complete });
        complete && Assets.close();
      },
      types: ["image"],
      accept: "image/*"
    });
  };
  const type = prop.getType();
  const defValue = prop.getDefaultValue();
  prop.canClear();
  const hasValue = prop.hasValue();
  const value = prop.getValue();
  const valueString = hasValue ? value : "";
  const valueWithDef = hasValue ? value : defValue;
  let inputToRender = /* @__PURE__ */ jsx(
    Input,
    {
      placeholder: defValue,
      value: valueString,
      onValueChange: onChange
    }
  );
  switch (type) {
    case "radio":
    case "select":
      {
        const selectProp = prop;
        inputToRender = /* @__PURE__ */ jsx(
          Select,
          {
            value,
            onValueChange: onChange,
            options: selectProp.getOptions().map((opt) => ({
              value: selectProp.getOptionId(opt),
              label: selectProp.getOptionLabel(opt)
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
    case "slider":
      {
        const sliderProp = prop;
        console.log({
          value: parseFloat(value),
          min: sliderProp.getMin(),
          max: sliderProp.getMax(),
          step: sliderProp.getStep()
        });
        inputToRender = /* @__PURE__ */ jsx(
          Slider,
          {
            size: "small",
            className: "col-span-full",
            value: [parseFloat(value)],
            min: sliderProp.getMin(),
            max: sliderProp.getMax(),
            step: sliderProp.getStep(),
            onValueChange: (val) => onChange(val[0]),
            children: /* @__PURE__ */ jsx(SliderThumb, {})
          }
        );
      }
      break;
    case "file":
      {
        inputToRender = /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-3", children: [
          value && value !== defValue && /* @__PURE__ */ jsx(
            "div",
            {
              className: "w-[50px] h-[50px] rounded inline-block bg-cover bg-center cursor-pointer",
              style: { backgroundImage: `url("${value}")` },
              onClick: () => handleChange("")
            }
          ),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: openAssets, children: "Select Image" })
        ] });
      }
      break;
    case "composite":
      {
        const compositeProp = prop;
        inputToRender = /* @__PURE__ */ jsx("div", { className: cn("grid gap-2 grid-cols-subgrid col-span-full"), children: compositeProp.getProperties().map((prop2) => /* @__PURE__ */ jsx(StylePropertyField, { prop: prop2 }, prop2.getId())) });
      }
      break;
    case "stack":
      {
        const stackProp = prop;
        const layers = stackProp.getLayers();
        const isTextShadow = stackProp.getName() === "text-shadow";
        inputToRender = /* @__PURE__ */ jsx(
          "div",
          {
            className: cn("flex flex-col p-2 gap-2 bg-black/20 min-h-[54px]"),
            children: layers.map((layer) => /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex gap-1 bg-slate-800 px-2 py-1 items-center", children: [
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    variant: "icon",
                    onClick: () => layer.move(layer.getIndex() - 1),
                    children: /* @__PURE__ */ jsx(ChevronUpCircleIcon, {})
                  }
                ),
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    size: "small",
                    onClick: () => layer.move(layer.getIndex() + 1),
                    children: /* @__PURE__ */ jsx(ChevronDownCircleIcon, {})
                  }
                ),
                /* @__PURE__ */ jsx("button", { className: "flex-grow", onClick: () => layer.select(), children: layer.getLabel() }),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: cn(
                      "bg-white min-w-[17px] min-h-[17px] text-black text-sm flex justify-center"
                    ),
                    style: layer.getStylePreview({
                      number: { min: -3, max: 3 },
                      camelCase: true
                    }),
                    children: isTextShadow && "T"
                  }
                ),
                /* @__PURE__ */ jsx(Button, { variant: "icon", onClick: () => layer.remove(), children: /* @__PURE__ */ jsx(Trash2Icon, {}) })
              ] }),
              layer.isSelected() && /* @__PURE__ */ jsx("div", { className: "p-2 flex flex-wrap", children: stackProp.getProperties().map((prop2) => /* @__PURE__ */ jsx(StylePropertyField, { prop: prop2 }, prop2.getId())) })
            ] }, layer.getId()))
          }
        );
      }
      break;
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        type == "composite" && "col-span-full grid grid-cols-subgrid ",
        (type == "stack" || type == "slider") && "col-span-full "
      ),
      children: [
        /* @__PURE__ */ jsx(
          FormInput,
          {
            label: prop.getLabel(),
            className: cn(
              type == "composite" && "col-span-full grid grid-cols-subgrid"
            ),
            children: inputToRender
          }
        ),
        type === "stack" && /* @__PURE__ */ jsx(
          Button,
          {
            variant: "icon",
            className: "!ml-2",
            onClick: () => prop.addLayer({}, { at: 0 }),
            children: /* @__PURE__ */ jsx(PlusIcon, {})
          }
        )
      ]
    }
  );
}
export {
  StylePropertyField as default
};
