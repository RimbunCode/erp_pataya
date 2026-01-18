import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { g as DialogHeader, h as DialogTitle, C as Command, k as CommandInput, a as CommandList, b as CommandEmpty, l as CommandGroup, c as CommandItem } from "./command-BSnyCa9u.js";
import { D as Drawer, a as DrawerTrigger, b as DrawerContent } from "./drawer-D3vDykaS.js";
import { P as Popover, a as PopoverTrigger, b as PopoverContent } from "./popover-CziqY8mR.js";
import React__default, { useRef, useEffect } from "react";
import { B as Button } from "./button-Us2TB7GG.js";
import { ChevronDown } from "lucide-react";
import { DialogDescription } from "@radix-ui/react-dialog";
import { c as cn } from "./utils-ClCZGsDL.js";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
function Combobox({
  options = [],
  search: searchProps,
  onSearchChange,
  value: optionProps,
  onValueChange,
  templateTrigger,
  templateItem,
  placeholder,
  className,
  disabled
}) {
  const commandRef = useRef();
  const isMobile = useIsMobile();
  const [open, setOpen] = React__default.useState(false);
  const [_option, _setOption] = React__default.useState();
  const [_search, _setSearch] = React__default.useState();
  const option = optionProps || _option;
  const setOption = onValueChange || _setOption;
  const search = searchProps || _search;
  const setSearch = onSearchChange || _setSearch;
  useEffect(() => {
    var _a;
    if (open) {
      (_a = commandRef.current) == null ? void 0 : _a.focus();
    }
  }, [open]);
  const Parent = isMobile ? Drawer : Popover;
  const ParentTrigger = isMobile ? DrawerTrigger : PopoverTrigger;
  const ParentContent = isMobile ? DrawerContent : PopoverContent;
  return /* @__PURE__ */ jsxs(Parent, { open, onOpenChange: setOpen, modal: false, children: [
    /* @__PURE__ */ jsx(ParentTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
      Button,
      {
        disabled,
        variant: "outline",
        size: "sm",
        className: cn(
          "flex justify-between w-full bg-accent h-8 ",
          className
        ),
        children: [
          option ? templateTrigger ? templateTrigger(option) : /* @__PURE__ */ jsx(Fragment, { children: option }) : /* @__PURE__ */ jsx(Fragment, { children: placeholder }),
          /* @__PURE__ */ jsx(ChevronDown, { className: "w-4 h-4 ml-2" })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(ParentContent, { className: "p-0", side: "bottom", align: "start", children: [
      isMobile && /* @__PURE__ */ jsxs(DialogHeader, { className: "sr-only", children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: "Choose an option" }),
        /* @__PURE__ */ jsx(DialogDescription, {})
      ] }),
      /* @__PURE__ */ jsxs(Command, { children: [
        /* @__PURE__ */ jsx(
          CommandInput,
          {
            ref: commandRef,
            value: search,
            onValueChange: setSearch,
            placeholder: "Search..."
          }
        ),
        /* @__PURE__ */ jsxs(CommandList, { children: [
          /* @__PURE__ */ jsx(CommandEmpty, { children: "No results found." }),
          /* @__PURE__ */ jsx(CommandGroup, { children: options.map((opt) => {
            if (templateItem) {
              const child = React__default.Children.only(templateItem(opt));
              return React__default.cloneElement(child, {
                onSelect: (value) => {
                  var _a, _b;
                  (_b = (_a = child.props).onSelect) == null ? void 0 : _b.call(_a, value);
                  setOpen(false);
                  setSearch("");
                }
              });
            }
            return /* @__PURE__ */ jsx(
              CommandItem,
              {
                value: opt,
                onSelect: (value) => {
                  setOption(value);
                  setOpen(false);
                },
                children: opt
              },
              opt
            );
          }) })
        ] })
      ] })
    ] })
  ] });
}
export {
  Combobox as C
};
