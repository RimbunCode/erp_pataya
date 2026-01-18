import { jsx, jsxs } from "react/jsx-runtime";
import { C as Command, a as CommandList, b as CommandEmpty, c as CommandItem } from "./command-BSnyCa9u.js";
import { P as Popover, a as PopoverTrigger, b as PopoverContent } from "./popover-CziqY8mR.js";
import { T as Tooltip, a as TooltipTrigger } from "./tooltip-Df8khweJ.js";
import { f as isNullOrWhitespace, c as cn } from "./utils-ClCZGsDL.js";
import { memo, forwardRef, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { B as Button } from "./button-Us2TB7GG.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { XIcon } from "lucide-react";
import { useDetectClickOutside } from "react-detect-click-outside";
import { useLaravelReactI18n } from "laravel-react-i18n";
const Select = memo(
  forwardRef(function Select2({
    id,
    value,
    onValueChange,
    defaultValue,
    placeholder,
    className,
    disabled,
    required,
    readOnly,
    onKeyDown,
    optionTrans,
    options: _options
  }, ref) {
    const { t } = useLaravelReactI18n();
    const [search, setSearch] = useState("");
    const oriOptions = useMemo(() => {
      const options2 = _options == null ? void 0 : _options.map((x) => {
        const label = typeof x === "object" && x.label ? x.label : optionTrans ? t(`${optionTrans}.${x.value ?? x}`) : x.value ?? x;
        const value2 = typeof x === "object" ? x.value : x;
        return {
          label,
          value: value2
        };
      });
      return options2;
    }, [_options, optionTrans, t]);
    const getOption = useCallback(
      (val) => {
        return oriOptions.find((x) => x.value == val);
      },
      [oriOptions]
    );
    const [isDirty, setIsDirty] = useState(false);
    const [open, setOpen] = useState(false);
    const [_option, _setOption] = useState(getOption(value));
    const commandRef = useDetectClickOutside({
      onTriggered: () => {
        setOpen(false);
      }
    });
    const hasValue = value !== void 0 && value !== null;
    const option = hasValue ? getOption(value) : _option;
    const setOption = useCallback(
      (val) => {
        setIsDirty(false);
        if (disabled || readOnly) return;
        _setOption(val);
        onValueChange == null ? void 0 : onValueChange(val == null ? void 0 : val.value);
      },
      [onValueChange, _setOption, disabled, readOnly]
    );
    const appliedDefaultKeyRef = useRef(null);
    useEffect(() => {
      if (option) return;
      if (!defaultValue) {
        appliedDefaultKeyRef.current = null;
        return;
      }
      if (appliedDefaultKeyRef.current === defaultValue) {
        return;
      }
      const opt = getOption(defaultValue);
      if (!opt) {
        return;
      }
      _setOption((prev) => {
        if ((prev == null ? void 0 : prev.value) === opt.value) return prev;
        onValueChange == null ? void 0 : onValueChange(opt.value);
        return opt;
      });
      appliedDefaultKeyRef.current = defaultValue;
    }, [defaultValue, getOption, onValueChange, _setOption]);
    const options = useMemo(() => {
      if (!oriOptions) return [];
      if (search && isDirty) {
        return oriOptions.filter(
          (x) => x.label.toLowerCase().includes(search.toLowerCase())
        );
      }
      return oriOptions;
    }, [oriOptions, search, isDirty]);
    useEffect(() => {
      if (open) return;
      if (search && isDirty) {
        const findOption = oriOptions.find(
          (x) => x.label.toLowerCase() == search.toLowerCase()
        );
        setOption(findOption);
        if (!findOption) {
          setSearch("");
        }
      }
    }, [open, isDirty]);
    useEffect(() => {
      if (option) {
        setSearch(option.label);
      } else if (!open) {
        setSearch("");
      }
    }, [option]);
    const onInputKeyDown = (e) => {
      if (e.key == "Enter" && open) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.key == "Tab" || e.key == "Enter") {
        onKeyDown == null ? void 0 : onKeyDown(e);
        return;
      }
      if (readOnly || disabled) return;
      setIsDirty(true);
      if (!open) {
        setOpen(true);
      }
    };
    const highlightItem = useCallback((item, search2) => {
      var _a;
      let searchWords = ((_a = search2.split(/\s+/)) == null ? void 0 : _a.map((string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter((x) => !isNullOrWhitespace(x))) || [];
      if (searchWords.length < 1) return item;
      let regex = new RegExp(`(${searchWords.join("|")})`, "gi");
      item = item.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
        if (tag) return tag;
        return text.replace(regex, `<mark class="bg-yellow-500">$1</mark>`);
      });
      return item;
    }, []);
    return /* @__PURE__ */ jsx(Popover, { open, onOpenChange: () => {
    }, children: /* @__PURE__ */ jsxs(
      Command,
      {
        className: "relative h-full overflow-visible bg-transparent",
        ref: commandRef,
        loop: true,
        children: [
          /* @__PURE__ */ jsx(Tooltip, { children: /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
            PopoverTrigger,
            {
              asChild: true,
              className: cn(
                "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                // valueBefore !== undefined &&
                // !diff?.same &&
                // "bg-yellow-200 dark:bg-yellow-900",
                disabled && "cursor-not-allowed opacity-50",
                className
              ),
              children: /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx(
                  Input,
                  {
                    id,
                    ref,
                    disabled,
                    readOnly,
                    onKeyDown: onInputKeyDown,
                    onClick: (e) => {
                      e.preventDefault();
                      if (!search && !open || !open && option) {
                        setOpen(true);
                      }
                    },
                    required,
                    value: search,
                    onChange: (e) => {
                      setSearch(e.target.value);
                    },
                    className: cn(
                      "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  "
                      // diff.same && "text-",
                    ),
                    placeholder
                  }
                ),
                /* @__PURE__ */ jsx("div", { className: "flex items-center h-8 pr-2 w-fit gap-x-2", children: !(readOnly || disabled) && /* @__PURE__ */ jsx(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "icon",
                    className: cn(
                      "size-6 ",
                      (!search || disabled || readOnly) && "hidden"
                    ),
                    onClick: () => {
                      setOption(null);
                      setSearch("");
                    },
                    children: /* @__PURE__ */ jsx(XIcon, { className: "size-3" })
                  }
                ) })
              ] })
            }
          ) }) }),
          !(disabled || readOnly) && /* @__PURE__ */ jsx(
            PopoverContent,
            {
              onOpenAutoFocus: (e) => e.preventDefault(),
              align: "start",
              side: "bottom",
              className: "relative z-50 w-auto  min-w-(--radix-popover-trigger-width) p-0 ",
              forceMount: true,
              asChild: true,
              children: /* @__PURE__ */ jsxs(CommandList, { className: "p-1 space-y-2", children: [
                /* @__PURE__ */ jsx(CommandEmpty, { children: t("core.form.not_found") }),
                options && (options == null ? void 0 : options.map((option2) => {
                  return /* @__PURE__ */ jsx(
                    CommandItem,
                    {
                      value: option2.value,
                      onSelect: () => {
                        setOption(option2);
                        setOpen(false);
                      },
                      children: /* @__PURE__ */ jsx(
                        "p",
                        {
                          dangerouslySetInnerHTML: {
                            __html: highlightItem(option2.label, search ?? "")
                          }
                        }
                      )
                    },
                    option2.value
                  );
                }))
              ] })
            }
          )
        ]
      }
    ) });
  })
);
export {
  Select as S
};
