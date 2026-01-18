import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";
import React__default, { memo, forwardRef, useState, useMemo, useCallback, useEffect, useRef, useId, cloneElement, useContext, createContext, createElement, Children, Fragment as Fragment$1, useImperativeHandle } from "react";
import { X, ArrowRight, XIcon, PlusIcon, FileText, Trash2, ChevronDown, FileTextIcon, ExternalLink, Folder, FolderOpen, ArrowLeft, Laptop2, LibraryIcon, Paperclip, Plus, PrinterIcon, ChevronDownIcon, Trash2Icon, SaveIcon, Check, MinusIcon } from "lucide-react";
import { c as cn, d as camelize, e as getValueObject, f as isNullOrWhitespace, h as checkFileType, j as formatBytes, k as generateRandom, l as inArray, m as isCompletedStatus, a as getLocaleDate, r as removeFromLocalStorage } from "./utils-ClCZGsDL.js";
import { cva } from "class-variance-authority";
import { u as useDeleteModal, A as AlertDialog, a as AlertDialogContent, b as AlertDialogHeader, c as AlertDialogTitle, d as AlertDialogDescription, e as AlertDialogFooter, f as AlertDialogCancel, g as AlertDialogAction } from "./MasterLayout-CRsmljQs.js";
import { A as Avatar, a as AvatarImage, b as AvatarFallback } from "./avatar-_KK8H2Pc.js";
import { A as AppLayout, C as Collapsible, a as CollapsibleTrigger, b as CollapsibleContent } from "./AppLayout-Drqdr6Z-.js";
import { usePage, useForm, router, Deferred, Head, WhenVisible } from "@inertiajs/react";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem } from "./ToggleTheme-BSs-sHS2.js";
import { C as Command, a as CommandList, b as CommandEmpty, c as CommandItem, d as CommandSeparator, D as Dialog, e as DialogTrigger, f as DialogContent, g as DialogHeader, h as DialogTitle, i as DialogDescription, j as DialogFooter } from "./command-BSnyCa9u.js";
import { P as Popover, a as PopoverTrigger, b as PopoverContent } from "./popover-CziqY8mR.js";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent, c as TooltipProvider } from "./tooltip-Df8khweJ.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { Command as Command$1 } from "cmdk";
import { I as Input } from "./input-wk3Ou7wI.js";
import { L as LoadingIcon } from "./LoadingIcon-CRleOEtX.js";
import axios from "axios";
import { isEqual } from "lodash";
import pluralize from "pluralize";
import { useDetectClickOutside } from "react-detect-click-outside";
import { b as useDidMountEffect, L as Link, c as useDraftForm, a as useIsDirtyForm, u as useAlertDraftForm } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { c as TabsContent, T as Tabs, a as TabsList, b as TabsTrigger } from "./tabs-DhZjhdeH.js";
import { I as InputError } from "./InputError-2JjWc6nJ.js";
import { L as Label } from "./label-DiFvdPYz.js";
import { S as Select } from "./Select-DB9toH_t.js";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import QueryString from "qs";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { Transition } from "@headlessui/react";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
import Comments from "./Comments-Bvo3255G.js";
import { RiErrorWarningFill } from "@remixicon/react";
import { TZDate } from "@date-fns/tz";
import Tags from "./Tags-D6pM3ZUY.js";
import { evaluate } from "@marcbachmann/cel-js";
import { format } from "date-fns";
import { toast } from "sonner";
const alertVariants = cva(
  "flex items-stretch w-full gap-2 group-[.toaster]:w-(--width)",
  {
    variants: {
      variant: {
        secondary: "",
        primary: "",
        destructive: "",
        success: "",
        info: "",
        mono: "",
        warning: ""
      },
      icon: {
        primary: "",
        destructive: "",
        success: "",
        info: "",
        warning: ""
      },
      appearance: {
        solid: "",
        outline: "",
        light: "",
        stroke: "text-foreground"
      },
      size: {
        lg: "rounded-lg p-4 gap-3 text-base [&>[data-slot=alert-icon]>svg]:size-6 *:data-slot=alert-icon:mt-0.5 [&_[data-slot=alert-close]]:mt-1",
        md: "rounded-lg p-3.5 gap-2.5 text-sm [&>[data-slot=alert-icon]>svg]:size-5 *:data-slot=alert-icon:mt-0 [&_[data-slot=alert-close]]:mt-0.5",
        sm: "rounded-md px-3 py-2.5 gap-2 text-xs [&>[data-slot=alert-icon]>svg]:size-4 *:data-alert-icon:mt-0.5 [&_[data-slot=alert-close]]:mt-0.25 [&_[data-slot=alert-close]_svg]:size-3.5"
      }
    },
    compoundVariants: [
      /* Solid */
      {
        variant: "secondary",
        appearance: "solid",
        className: "bg-muted text-foreground"
      },
      {
        variant: "primary",
        appearance: "solid",
        className: "bg-primary text-primary-foreground"
      },
      {
        variant: "destructive",
        appearance: "solid",
        className: "bg-destructive text-destructive-foreground"
      },
      {
        variant: "success",
        appearance: "solid",
        className: "bg-[var(--color-success,var(--color-green-500))] text-[var(--color-success-foreground,var(--color-white))]"
      },
      {
        variant: "info",
        appearance: "solid",
        className: "bg-[var(--color-info,var(--color-violet-600))] text-[var(--color-info-foreground,var(--color-white))]"
      },
      {
        variant: "warning",
        appearance: "solid",
        className: "bg-[var(--color-warning,var(--color-yellow-500))] text-[var(--color-warning-foreground,var(--color-white))]"
      },
      {
        variant: "mono",
        appearance: "solid",
        className: "bg-zinc-950 text-white dark:bg-zinc-300 dark:text-black *:data-slot-[alert=close]:text-white"
      },
      /* Outline */
      {
        variant: "secondary",
        appearance: "outline",
        className: "border border-border bg-background text-foreground [&_[data-slot=alert-close]]:text-foreground"
      },
      {
        variant: "primary",
        appearance: "outline",
        className: "border border-border bg-background text-primary [&_[data-slot=alert-close]]:text-foreground"
      },
      {
        variant: "destructive",
        appearance: "outline",
        className: "border border-border bg-background text-destructive [&_[data-slot=alert-close]]:text-foreground"
      },
      {
        variant: "success",
        appearance: "outline",
        className: "border border-border bg-background text-[var(--color-success,var(--color-green-500))] [&_[data-slot=alert-close]]:text-foreground"
      },
      {
        variant: "info",
        appearance: "outline",
        className: "border border-border bg-background text-[var(--color-info,var(--color-violet-600))] [&_[data-slot=alert-close]]:text-foreground"
      },
      {
        variant: "warning",
        appearance: "outline",
        className: "border border-border bg-background text-[var(--color-warning,var(--color-yellow-500))] [&_[data-slot=alert-close]]:text-foreground"
      },
      {
        variant: "mono",
        appearance: "outline",
        className: "border border-border bg-background text-foreground [&_[data-slot=alert-close]]:text-foreground"
      },
      /* Light */
      {
        variant: "secondary",
        appearance: "light",
        className: "bg-muted border border-border text-foreground"
      },
      {
        variant: "primary",
        appearance: "light",
        className: "text-foreground bg-[var(--color-primary-soft,var(--color-blue-50))] border border-[var(--color-primary-alpha,var(--color-blue-100))] [&_[data-slot=alert-icon]]:text-primary dark:bg-[var(--color-primary-soft,var(--color-blue-950))] dark:border-[var(--color-primary-alpha,var(--color-blue-900))]"
      },
      {
        variant: "destructive",
        appearance: "light",
        className: "bg-[var(--color-destructive-soft,var(--color-red-50))] border border-[var(--color-destructive-alpha,var(--color-red-100))] text-foreground [&_[data-slot=alert-icon]]:text-destructive dark:bg-[var(--color-destructive-soft,var(--color-red-950))] dark:border-[var(--color-destructive-alpha,var(--color-red-900))] "
      },
      {
        variant: "success",
        appearance: "light",
        className: "bg-[var(--color-success-soft,var(--color-green-50))] border border-[var(--color-success-alpha,var(--color-green-200))] text-foreground [&_[data-slot=alert-icon]]:text-[var(--color-success-foreground,var(--color-green-600))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:border-[var(--color-success-alpha,var(--color-green-900))]"
      },
      {
        variant: "info",
        appearance: "light",
        className: "bg-[var(--color-info-soft,var(--color-violet-50))] border border-[var(--color-info-alpha,var(--color-violet-100))] text-foreground [&_[data-slot=alert-icon]]:text-[var(--color-info-foreground,var(--color-violet-600))] dark:bg-[var(--color-info-soft,var(--color-violet-950))] dark:border-[var(--color-info-alpha,var(--color-violet-900))]"
      },
      {
        variant: "warning",
        appearance: "light",
        className: "bg-[var(--color-warning-soft,var(--color-yellow-50))] border border-[var(--color-warning-alpha,var(--color-yellow-200))] text-foreground [&_[data-slot=alert-icon]]:text-[var(--color-warning-foreground,var(--color-yellow-600))] dark:bg-[var(--color-warning-soft,var(--color-yellow-950))] dark:border-[var(--color-warning-alpha,var(--color-yellow-900))]"
      },
      /* Mono */
      {
        variant: "mono",
        icon: "primary",
        className: "[&_[data-slot=alert-icon]]:text-primary"
      },
      {
        variant: "mono",
        icon: "warning",
        className: "[&_[data-slot=alert-icon]]:text-[var(--color-warning-foreground,var(--color-yellow-600))]"
      },
      {
        variant: "mono",
        icon: "success",
        className: "[&_[data-slot=alert-icon]]:text-[var(--color-success-foreground,var(--color-green-600))]"
      },
      {
        variant: "mono",
        icon: "destructive",
        className: "[&_[data-slot=alert-icon]]:text-destructive"
      },
      {
        variant: "mono",
        icon: "info",
        className: "[&_[data-slot=alert-icon]]:text-[var(--color-info-foreground,var(--color-violet-600))]"
      }
    ],
    defaultVariants: {
      variant: "secondary",
      appearance: "solid",
      size: "md"
    }
  }
);
function Alert({
  className,
  variant,
  size,
  icon,
  appearance,
  close = false,
  onClose,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-slot": "alert",
      role: "alert",
      className: cn(
        alertVariants({ variant, size, icon, appearance }),
        className
      ),
      ...props,
      children: [
        children,
        close && /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onClose,
            "aria-label": "Dismiss",
            "data-slot": "alert-close",
            className: cn("group shrink-0 size-4 cursor-pointer"),
            children: /* @__PURE__ */ jsx(X, { className: "opacity-60 group-hover:opacity-100 size-4" })
          }
        )
      ]
    }
  );
}
function AlertTitle({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "alert-title",
      className: cn("grow tracking-tight", className),
      ...props
    }
  );
}
function AlertIcon({ children, className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "alert-icon",
      className: cn("shrink-0", className),
      ...props,
      children
    }
  );
}
function AlertToolbar({ children, className, ...props }) {
  return /* @__PURE__ */ jsx("div", { "data-slot": "alert-toolbar", className: cn(className), ...props, children });
}
function validateWithOperators(value, operators, logic = "and") {
  var _a;
  let result = false;
  for (let keyOperator in operators) {
    const valOperator = operators[keyOperator];
    keyOperator = ((_a = keyOperator.match(/^([^\[\]]+)/)) == null ? void 0 : _a[1]) ?? keyOperator;
    switch (keyOperator) {
      case "and":
      case "or": {
        result = Array.isArray(valOperator) && keyOperator == "or" ? valOperator.includes(value) : validateWithOperators(value, valOperator, keyOperator);
        break;
      }
      case "not":
        result = value != valOperator;
        break;
      case "=":
        result = value == valOperator;
        break;
      case ">":
        result = value > valOperator;
        break;
      case ">=":
        result = value >= valOperator;
        break;
      case "<":
        result = value < valOperator;
        break;
      case "<=":
        result = value <= valOperator;
        break;
      case "jsonContains":
        if (Array.isArray(value)) {
          let rst = false;
          value.forEach((item) => {
            if (valOperator.includes(item)) {
              rst = true;
            }
            return;
          });
          result = rst;
        }
        break;
      case "jsonDoesntContains":
        if (Array.isArray(value)) {
          let rst = true;
          value.forEach((item) => {
            if (!valOperator.includes(item)) {
              rst = false;
            }
            return;
          });
          result = rst;
        }
        break;
      case "like":
        result = valOperator.includes(value);
        break;
      case "notlike":
        result = !valOperator.includes(value);
        break;
      case "in":
        if (Array.isArray(value)) {
          let rst = false;
          value.forEach((item) => {
            if (valOperator.includes(item)) {
              rst = true;
            }
          });
          result = rst;
          break;
        }
        result = Array.isArray(valOperator) ? valOperator.includes(value) : false;
        break;
      case "notIn":
        if (Array.isArray(value)) {
          let rst = true;
          value.forEach((item) => {
            if (!valOperator.includes(item)) {
              rst = false;
            }
          });
          result = rst;
          break;
        }
        result = Array.isArray(valOperator) ? !valOperator.includes(value) : true;
        break;
      case "between":
        result = value >= valOperator[0] && value <= valOperator[1];
        break;
      case "notBetween":
        result = value < valOperator[0] || value > valOperator[1];
        break;
      default: {
        const keys = keyOperator.split(/\.|->/);
        let val = value;
        for (let key of keys) {
          if (!val) break;
          val = val[key];
        }
        result = val ? validateWithOperators(val, valOperator) : true;
        break;
      }
    }
    if (logic === "and" && !result) return false;
    if (logic === "or" && result) return true;
  }
  return logic == "and";
}
function validate(value, filters, logic = "and") {
  var _a;
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return true;
  }
  for (let keyFilter in filters) {
    const valFilter = filters[keyFilter];
    keyFilter = ((_a = keyFilter.match(/^([^\[\]]+)/)) == null ? void 0 : _a[1]) ?? keyFilter;
    const keys = keyFilter.split(/\.|->/);
    let val = value;
    for (let key of keys) {
      if (!val) break;
      val = val[key];
    }
    let result = false;
    if (/^raw\((.+)\)$/.test(keyFilter)) {
      result = true;
    } else if (keyFilter === "and" || keyFilter === "or") {
      result = validate(value, valFilter, keyFilter);
    } else if (valFilter === void 0) {
      result = true;
    } else if (Array.isArray(valFilter)) {
      result = JSON.stringify(val) === JSON.stringify(valFilter);
    } else if (typeof valFilter !== "object" || valFilter === null) {
      result = val == valFilter;
    } else {
      result = validateWithOperators(val, valFilter);
    }
    if (logic === "and" && !result) return false;
    if (logic === "or" && result) return true;
  }
  return logic === "and";
}
const convertTemplateLink = (value, search) => {
  var _a;
  if (!value) return "";
  const template = value.templateLink ?? "";
  let item = template.replace(/:((\w[\w]+{:[\w]+})|(\w[\w.]+))/g, (match) => {
    match = match.replace(/(.*?){:(.*?)}/i, ":$2");
    const newValue = getValueObject(value, match.substring(1));
    if (typeof newValue == "object") {
      return convertTemplateLink(newValue, search);
    }
    return newValue ?? match;
  });
  if (search == null) {
    const titleMatch = item.match(/<title(.*?)>(.*?)<\/title>/i);
    const plainTextMatch = item.match(/^[^<]+/g);
    return titleMatch ? titleMatch[2].trim() : plainTextMatch ? plainTextMatch[0].trim() : "";
  }
  item = item.replace(/<title(.*?)>(.*?)<\/title>/gi, "");
  let searchWords = ((_a = search.split(/\s+/)) == null ? void 0 : _a.map((string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter((x) => !isNullOrWhitespace(x))) || [];
  if (searchWords.length < 1) return item;
  let regex = new RegExp(`(${searchWords.join("|")})`, "gi");
  item = item.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag;
    return text.replace(regex, `<mark class="bg-yellow-500">$1</mark>`);
  });
  return item;
};
const LinkModel = memo(
  forwardRef(function LinkModel2({
    id,
    as,
    valueBefore,
    defaultValue,
    value,
    onValueChange,
    placeholder,
    className,
    disabled,
    readOnly,
    required,
    model,
    sort,
    limit = 10,
    filters,
    joins,
    keywords,
    translate,
    titleDialog,
    classNameDialog,
    disabledNavigation,
    disabledAddButton,
    defaultValueForm,
    form,
    postOption,
    onKeyDown,
    with: _with,
    order,
    customNavigation
  }, ref) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [_option, _setOption] = useState(value);
    const [search, setSearch] = useState("");
    const [total, setTotal] = useState(0);
    const [options, setOptions] = useState([]);
    const [allowSearch, setAllowSearch] = useState(true);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const { name, keyRoute } = useMemo(() => {
      if (as) {
        const [name2, keyRoute2] = as.split(":");
        return { name: camelize(name2), keyRoute: keyRoute2 };
      }
      return {
        name: camelize((model ?? "").split("\\").pop()),
        keyRoute: "id"
      };
    }, [as, model]);
    const route = window.route;
    const commandRef = useDetectClickOutside({
      onTriggered: () => {
        setOpen(false);
      }
    });
    const option = value ?? _option;
    useDidMountEffect(() => {
      _setOption(value);
    }, [value]);
    const setOption = useCallback(
      (val) => {
        if (disabled || readOnly) return;
        if (val) {
          const isValid = validate(val, filters);
          if (!isValid) return;
        }
        _setOption((prev) => {
          if (isEqual(prev, val)) return prev;
          onValueChange == null ? void 0 : onValueChange(val);
          return val;
        });
      },
      [onValueChange, _setOption, disabled, readOnly, filters]
    );
    useEffect(() => {
      if (open) return;
      setLoading(false);
      if (!option && search) {
        const findOption = options.find(
          (x) => convertTemplateLink(x).toLowerCase() == search.toLowerCase()
        );
        if (findOption) {
          setOption(findOption);
          return;
        }
        setAllowSearch(false);
        setSearch("");
      }
    }, [open]);
    useEffect(() => {
      if (option) {
        setAllowSearch(false);
        setSearch(convertTemplateLink(option));
      } else if (!open) {
        setAllowSearch(true);
        setSearch("");
      }
    }, [option]);
    useEffect(() => {
      if (valueBefore !== void 0) {
        return;
      }
      if (!(option || value)) return;
      const isValid = validate(option || value, filters);
      if (!isValid) {
        setOption(null);
      }
    }, [filters, option, value]);
    const getModels = (filterForDefaultValue = {}, callback) => {
      axios.post(route("model"), {
        model,
        limit: limit ?? 10,
        search,
        with: _with,
        filters: {
          ...filters,
          ...filterForDefaultValue
        },
        sort,
        joins,
        keywords,
        order,
        translate
      }).then((res) => {
        const data = res.data.data;
        setTotal(res.data.total ?? data.length);
        setOptions(data);
        callback == null ? void 0 : callback(data);
      }).catch((err) => {
        console.log(err);
      }).finally(() => {
        setLoading(false);
      });
    };
    useDidMountEffect(() => {
      if (!allowSearch) return;
      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels();
      }, 500);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [search]);
    const defaultKey = useMemo(
      () => defaultValue ? JSON.stringify(defaultValue) : null,
      [defaultValue]
    );
    const loadedDefaultKeyRef = useRef(null);
    useEffect(() => {
      if (!defaultKey || option) return;
      if (loadedDefaultKeyRef.current === defaultKey) return;
      loadedDefaultKeyRef.current = defaultKey;
      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels(defaultValue, (data) => {
          if (data.length <= 0) return;
          setOption(data[0]);
        });
      }, 500);
      return () => clearTimeout(reloadModel);
    }, [defaultKey, option]);
    useDidMountEffect(() => {
      if (!open) return;
      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels();
      }, 100);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [open]);
    const onInputKeyDown = (e) => {
      if (e.key == "Enter" && open) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.key == "Tab" || e.key == "Enter") {
        onKeyDown == null ? void 0 : onKeyDown(e);
        return;
      }
      if (readOnly || disabled) return;
      if (option) {
        setOption(null);
      }
      if (!open) {
        setOpen(true);
      }
    };
    const onSuccessFormPageLinkModelDialog = (e) => {
      setOpen(false);
      axios.post(route("model"), {
        model,
        with: _with,
        id: e.props.flash.id ?? null
      }).then((res) => {
        setOption(res.data);
      }).catch((err) => {
        console.log(err);
      }).finally(() => {
        setLoading(false);
      });
    };
    const diff = useMemo(() => {
      const before = convertTemplateLink(valueBefore);
      const after = convertTemplateLink(value);
      return {
        before: before != after && before,
        after,
        same: before == after
      };
    }, [value, valueBefore]);
    return /* @__PURE__ */ jsxs(Popover, { open, onOpenChange: () => {
    }, children: [
      /* @__PURE__ */ jsxs(
        Command,
        {
          className: "relative h-full overflow-visible bg-transparent",
          ref: commandRef,
          loop: true,
          children: [
            /* @__PURE__ */ jsxs(Tooltip, { children: [
              /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                PopoverTrigger,
                {
                  asChild: true,
                  className: cn(
                    "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                    valueBefore !== void 0 && !(diff == null ? void 0 : diff.same) && "bg-yellow-200 dark:bg-yellow-900",
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
                          if (!(option && search) && !open) {
                            setOpen(true);
                          }
                        },
                        required,
                        value: search,
                        onChange: (e) => {
                          setAllowSearch(true);
                          setSearch(e.target.value);
                        },
                        className: cn(
                          "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  "
                          // diff.same && "text-",
                        ),
                        placeholder
                      }
                    ),
                    /* @__PURE__ */ jsx("div", { className: "flex items-center h-8 pr-2 w-fit gap-x-2", children: loading ? /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                      !disabledNavigation && /* @__PURE__ */ jsx(
                        Button,
                        {
                          type: "button",
                          variant: "ghost",
                          size: "icon",
                          className: cn(
                            "size-6 hidden",
                            valueBefore && "inline-flex!",
                            option && search && "group-focus-within/model:inline-flex"
                          ),
                          onClick: () => {
                            if (!name || !option || !search) return;
                            if (customNavigation && typeof customNavigation === "function") {
                              customNavigation(value);
                            }
                            const pluralized = `${pluralize.plural(name ?? "")}.show`;
                            window.open(
                              route(pluralized, option[keyRoute ?? "id"]),
                              "_blank"
                            );
                          },
                          children: /* @__PURE__ */ jsx(ArrowRight, { className: "size-3" })
                        }
                      ),
                      /* @__PURE__ */ jsx(
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
                      )
                    ] }) })
                  ] })
                }
              ) }),
              valueBefore && !(diff == null ? void 0 : diff.same) && /* @__PURE__ */ jsxs(TooltipContent, { side: "top", align: "start", children: [
                (diff == null ? void 0 : diff.before) && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("s", { children: diff == null ? void 0 : diff.before }),
                  /* @__PURE__ */ jsx("br", {})
                ] }),
                /* @__PURE__ */ jsx("span", { children: diff == null ? void 0 : diff.after })
              ] })
            ] }),
            !(disabled || readOnly) && /* @__PURE__ */ jsx(
              PopoverContent,
              {
                onOpenAutoFocus: (e) => e.preventDefault(),
                align: "start",
                side: "bottom",
                className: "relative z-50 w-auto  min-w-(--radix-popover-trigger-width) p-0 ",
                forceMount: true,
                asChild: true,
                children: /* @__PURE__ */ jsx(CommandList, { className: "p-1 space-y-2", children: loading ? /* @__PURE__ */ jsx(Command$1.Loading, { children: /* @__PURE__ */ jsxs("div", { className: "flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4", children: [
                  /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    t("core.form.loading"),
                    " ..."
                  ] })
                ] }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(CommandEmpty, { children: t("core.form.not_found") }),
                  options && (options == null ? void 0 : options.map((opt, index) => {
                    return /* @__PURE__ */ jsx(
                      CommandItem,
                      {
                        value: opt.id ?? index,
                        onSelect: () => {
                          setOption(opt);
                          setOpen(false);
                        },
                        children: /* @__PURE__ */ jsx(
                          "p",
                          {
                            dangerouslySetInnerHTML: {
                              __html: convertTemplateLink(opt, search ?? "")
                            }
                          }
                        )
                      },
                      opt.id ?? index
                    );
                  })),
                  total > limit && !disabledAddButton && /* @__PURE__ */ jsx(CommandSeparator, {}),
                  total > limit && /* @__PURE__ */ jsx(
                    CommandItem,
                    {
                      className: "text-blue-700 hover:text-blue-900! dark:text-blue-300 dark:hover:text-blue-200!",
                      onSelect: () => {
                      },
                      children: t("core.form.linkmodel.more")
                    }
                  ),
                  !disabledAddButton && /* @__PURE__ */ jsxs(
                    CommandItem,
                    {
                      onSelect: () => {
                        if (form) {
                          setOpenDialog(true);
                          return;
                        }
                        if (!name) return;
                        const pluralized = `${pluralize.plural(name ?? "")}.create`;
                        window.open(route(pluralized), "_blank");
                      },
                      children: [
                        /* @__PURE__ */ jsx(PlusIcon, { className: "size-4" }),
                        titleDialog
                      ]
                    }
                  )
                ] }) })
              }
            )
          ]
        }
      ),
      form && /* @__PURE__ */ jsx(
        FormPageLinkModelDialog,
        {
          title: titleDialog,
          name,
          open: openDialog,
          onOpenChange: setOpenDialog,
          className: cn("max-w-lg", classNameDialog),
          defaultValue: defaultValueForm,
          onSuccess: onSuccessFormPageLinkModelDialog,
          postOption,
          children: form
        }
      )
    ] });
  })
);
function FormInput({
  label,
  required,
  className,
  name,
  errors: errorsProps,
  error,
  children,
  description,
  ignoreDisabled = false,
  ...props
}) {
  var _a, _b;
  const form = useFormPage();
  const id = useId();
  const { t } = useLaravelReactI18n();
  const child = typeof children == "function" ? children : children;
  const errors = errorsProps ?? (form == null ? void 0 : form.errors) ?? {};
  const _required = required || ((_a = child.props) == null ? void 0 : _a.required);
  const _name = name || ((_b = child.props) == null ? void 0 : _b.name);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn("grid grid-cols-1 gap-y-2", className),
      role: !ignoreDisabled ? "forminput" : "",
      children: [
        /* @__PURE__ */ jsxs(Label, { htmlFor: id, className: "truncate h-auto", children: [
          label,
          " ",
          _required && /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
        ] }),
        typeof child == "function" ? child({
          id,
          required: _required,
          readOnly: props.readOnly || (form == null ? void 0 : form.disabled),
          ...props
        }) : React__default.Children.map(children, (child2) => {
          var _a2, _b2;
          return cloneElement(child2, {
            id,
            ...props,
            required: _required && (((_a2 = child2.props) == null ? void 0 : _a2.required) ?? true),
            readOnly: ((_b2 = child2.props) == null ? void 0 : _b2.readOnly) || props.readOnly || (form == null ? void 0 : form.disabled)
          });
        }),
        description && (typeof description == "string" ? /* @__PURE__ */ jsx("p", { className: "text-sm font-normal text-muted-foreground", children: description }) : description),
        (error || _name in (errors ?? {})) && /* @__PURE__ */ jsx(
          InputError,
          {
            message: error ?? (form.fieldNameTrans ? errors == null ? void 0 : errors[_name].replace(
              _name,
              t(`${form.fieldNameTrans}.${_name}`)
            ) : errors == null ? void 0 : errors[_name]),
            className: ""
          }
        )
      ]
    }
  );
}
const FormInput$1 = memo(FormInput);
const Textarea = React.forwardRef(
  ({ className, rows, value, onValueChange, onChange, ...props }, ref) => {
    return /* @__PURE__ */ jsx(
      "textarea",
      {
        className: cn(
          rows == 1 && "min-h-8",
          rows == 2 && "min-h-16",
          rows >= 2 && "min-h-[80px]",
          "focus:border-0! flex overflow-y-auto w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        ),
        onChange: (e) => {
          onValueChange == null ? void 0 : onValueChange(e.target.value);
          onChange == null ? void 0 : onChange(e);
        },
        value: value ?? "",
        ref,
        rows,
        ...props
      }
    );
  }
);
Textarea.displayName = "Textarea";
function ApproverDecision({ name, approval }) {
  var _a, _b, _c;
  const route = window.route;
  const user = (_b = (_a = usePage().props) == null ? void 0 : _a.auth) == null ? void 0 : _b.user;
  const { t } = useLaravelReactI18n();
  const { data, setData, post, reset, processing } = useForm({});
  const [open, setOpen] = useState(false);
  const currentStep = (approval == null ? void 0 : approval.steps[approval.current_sequence]) ?? null;
  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      post(route("approvalInstances.decision", currentStep == null ? void 0 : currentStep.id), {
        reset: [name, "logs", "flash"],
        preserveState: true,
        preverseScroll: true,
        replace: true,
        onSuccess() {
          setOpen(false);
          reset();
        }
      });
    },
    [data]
  );
  if (!currentStep) return;
  const approver = currentStep.approver;
  if ((user == null ? void 0 : user.id) != (approver == null ? void 0 : approver.id) && !((_c = user == null ? void 0 : user.id_roles) == null ? void 0 : _c.find((x) => x == (approver == null ? void 0 : approver.id))))
    return null;
  return /* @__PURE__ */ jsxs(Dialog, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsx(Button, { children: t("core.form.approvalDecision.trigger") }) }),
    /* @__PURE__ */ jsxs(DialogContent, { children: [
      /* @__PURE__ */ jsxs(DialogHeader, { className: "border-b border-muted-foreground/30", children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: t("core.form.approvalDecision.title") }),
        /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only" })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "grid grid-cols-1 gap-y-4", onSubmit, children: [
        /* @__PURE__ */ jsx(
          FormInput$1,
          {
            readOnly: processing,
            required: true,
            label: t("core.form.approvalDecision.decision"),
            children: /* @__PURE__ */ jsx(
              Select,
              {
                value: data.decision,
                onValueChange: (val) => setData("decision", val),
                options: ["approve", "reject"],
                optionTrans: "core.form.approvalDecision.decision.options"
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          FormInput$1,
          {
            readOnly: processing,
            label: t("core.form.approvalDecision.notes"),
            children: /* @__PURE__ */ jsx(
              Textarea,
              {
                rows: "3",
                value: data.notes ?? "",
                onValueChange: (val) => setData("notes", val)
              }
            )
          }
        ),
        /* @__PURE__ */ jsxs(DialogFooter, { className: "pt-2 -mb-2 border-t border-muted-foreground/30", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              type: "button",
              variant: "secondary",
              disabled: processing,
              onClick: () => setOpen(false),
              children: t("core.form.cancel")
            }
          ),
          /* @__PURE__ */ jsxs(Button, { type: "submit", disabled: processing, children: [
            processing && /* @__PURE__ */ jsx(LoadingIcon, {}),
            t("core.form.submit")
          ] })
        ] })
      ] })
    ] })
  ] });
}
const ApproverDecision$1 = memo(ApproverDecision);
const ApproverDecision$2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: ApproverDecision$1
}, Symbol.toStringTag, { value: "Module" }));
function FileItem({
  id,
  onRemove,
  onUpdate,
  file,
  name = null,
  isPublic = false
}) {
  var _a;
  const [thumbnail] = useState(
    checkFileType("image/*", file.type) ? /* @__PURE__ */ jsx(
      "img",
      {
        className: "object-cover rounded-lg size-full",
        src: URL.createObjectURL(file),
        alt: ""
      }
    ) : /* @__PURE__ */ jsx(FileText, { className: "p-3 border rounded-lg size-full text-muted-foreground" })
  );
  const removeFile = useCallback((id2) => {
    onRemove(id2);
  });
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center w-full max-w-full px-4 py-2 border rounded-lg shadow-md border-muted shadow-muted gap-x-2", children: [
    /* @__PURE__ */ jsx("div", { className: " aspect-square size-16", children: thumbnail }),
    /* @__PURE__ */ jsxs("div", { className: "self-start justify-between flex-1 p-2 overflow-hidden", children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          type: "text",
          value: (_a = (name ?? file.name).match(/^(.+)\.[^.]+$/)) == null ? void 0 : _a[1],
          onChange: (e) => {
            onUpdate(id, {
              name: e.target.value
            });
          },
          className: "bg-background! focus-visible:bg-muted! focus-visible:mb-2 focus-visible:ring-1  border-none pointer-events-auto! text-base focus-visible:px-2 px-0 py-1! h-fit! font-semibold truncate overflow-clip"
        }
      ),
      /* @__PURE__ */ jsxs("p", { className: "text-sm uppercase text-muted-foreground", children: [
        file.name.match(/([^.]+)$/g)[0],
        /* @__PURE__ */ jsx("span", { className: "mx-1", children: " ● " }),
        formatBytes(file.size)
      ] }),
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: isPublic,
          onCheckedChange: (val) => {
            onUpdate(id, {
              isPublic: val
            });
          },
          label: "Public",
          className: "mt-1 flex items-center gap-x-2 **:pointer-events-auto!"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center gap-x-0 **:pointer-events-auto!", children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "ghost",
        size: "icon",
        className: "hover:text-red-500 p-2! size-auto",
        onClick: () => removeFile(id),
        children: /* @__PURE__ */ jsx(Trash2, { className: "size-5!" })
      }
    ) })
  ] });
}
const FileItem$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: FileItem
}, Symbol.toStringTag, { value: "Module" }));
const Accordion = AccordionPrimitive.Root;
const AccordionItem = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AccordionPrimitive.Item,
  {
    ref,
    className: cn("border-b", className),
    ...props
  }
));
AccordionItem.displayName = "AccordionItem";
const AccordionTrigger = React.forwardRef(
  ({ className, children, asChild, ...props }, ref) => /* @__PURE__ */ jsx(AccordionPrimitive.Header, { className: "flex", children: /* @__PURE__ */ jsxs(
    AccordionPrimitive.Trigger,
    {
      ref,
      className: cn(
        "flex flex-1 items-center py-4 font-medium transition-all hover:underline",
        !asChild && "[&[data-state=open]>svg]:rotate-180 justify-between",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4 shrink-0 transition-transform duration-200" })
      ]
    }
  ) })
);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;
const AccordionTriggerCustom = React.forwardRef(
  ({ className, children, ...props }, ref) => /* @__PURE__ */ jsx(AccordionPrimitive.Header, { className: "flex", children: /* @__PURE__ */ jsx(
    AccordionPrimitive.Trigger,
    {
      ref,
      className: cn(
        "flex flex-1 items-center py-4 font-medium transition-all hover:underline",
        className
      ),
      ...props,
      children
    }
  ) })
);
AccordionTriggerCustom.displayName = AccordionPrimitive.Trigger.displayName;
const AccordionContent = React.forwardRef(
  ({ className, children, ...props }, ref) => /* @__PURE__ */ jsx(
    AccordionPrimitive.Content,
    {
      ref,
      className: cn(
        "pb-4 pt-0",
        "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
        className
      ),
      ...props,
      children
    }
  )
);
AccordionContent.displayName = AccordionPrimitive.Content.displayName;
const LibraryContext = createContext();
const useLibrary = () => useContext(LibraryContext);
const FileItems = memo(function FileItems2({ files, folderId = null }) {
  const route = window.route;
  const { resultSearch } = useLibrary();
  const [openedFolders, setOpenedFolders] = useState([]);
  const { checklistFile, setChecklistFile } = useLibrary();
  useEffect(() => {
    if (resultSearch.length <= 0) {
      setOpenedFolders([]);
      return;
    }
    const folders = resultSearch.filter((x) => x.mime_type == "folder" && x.folder_id == folderId).map((x) => x.id);
    setOpenedFolders(folders);
  }, [resultSearch]);
  if (files.length <= 0) {
    return /* @__PURE__ */ jsx("div", { className: "pl-8 flex gap-x-2 group  py-2! text-sm [&>svg]:size-5 data-[state=open]:border-b", children: "No files found" });
  }
  return /* @__PURE__ */ jsx(
    Accordion,
    {
      type: "multiple",
      value: openedFolders,
      onValueChange: setOpenedFolders,
      children: files.map((file) => {
        if (file.mime_type == "folder") {
          return /* @__PURE__ */ jsx(
            FolderItem,
            {
              ...file,
              open: openedFolders.some((x) => x == file.id)
            },
            file.id
          );
        } else {
          return /* @__PURE__ */ jsxs(
            "div",
            {
              className: "flex items-center border-b last:border-b-0 group",
              value: file.id,
              children: [
                /* @__PURE__ */ jsxs(
                  FormCheckbox,
                  {
                    checked: checklistFile.has(file.id),
                    onCheckedChange: (val) => setChecklistFile(file.id, val),
                    classNameLabel: "flex items-center gap-x-2 overflow-hidden [&_svg]:size-5 group-hover:underline text-sm font-normal cursor-pointer",
                    children: [
                      /* @__PURE__ */ jsx(FileTextIcon, {}),
                      /* @__PURE__ */ jsx("span", { className: "truncate ", children: file.fullname })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    variant: "ghost",
                    size: "icon",
                    className: "size-auto p-2! ml-1 opacity-0 group-hover:opacity-100 transition duration-300 ease-in-out ",
                    asChild: true,
                    children: /* @__PURE__ */ jsx(
                      "a",
                      {
                        target: "_blank",
                        rel: "noopener noreferrer",
                        href: route("files.preview", file.id),
                        children: /* @__PURE__ */ jsx(ExternalLink, { className: "size-4" })
                      }
                    )
                  }
                )
              ]
            },
            file.id
          );
        }
      })
    }
  );
});
const FileItems$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: FileItems
}, Symbol.toStringTag, { value: "Module" }));
const FolderItem = memo(function FolderItem2({ id, name, open, isRoot }) {
  const route = window.route;
  const [_files, _setFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const { search, resultSearch, imageOnly } = useLibrary();
  const [isLoading, setIsLoading] = useState(isNullOrWhitespace(search));
  const loadFiles = useCallback(() => {
    setIsLoading(true);
    axios.get(
      `${route("files.index")}?${QueryString.stringify({
        folder: id,
        imageOnly: imageOnly ?? false
      })}`
    ).then((res) => {
      _setFiles(res.data ?? []);
    }).catch((err) => {
      console.log(err);
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);
  useEffect(() => {
    if (isNullOrWhitespace(search) && resultSearch.length <= 0 && (open || isRoot)) {
      loadFiles();
    }
  }, [open]);
  useEffect(() => {
    if (isNullOrWhitespace(search) && resultSearch.length <= 0 && isRoot) {
      loadFiles();
    }
  }, [search, resultSearch]);
  useEffect(() => {
    setFiles(
      resultSearch.length > 0 ? resultSearch.filter((x) => x.folder_id == (isRoot ? null : id)) : _files
    );
  }, [resultSearch, _files]);
  if (isRoot) {
    return isLoading ? /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4 items-center", children: [
      /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
      /* @__PURE__ */ jsx("span", { children: "Loading ..." })
    ] }) : /* @__PURE__ */ jsx(FileItems, { files });
  }
  return /* @__PURE__ */ jsxs(AccordionItem, { value: id, className: "border-b last:border-b-0", children: [
    /* @__PURE__ */ jsx(AccordionTriggerCustom, { asChild: true, children: /* @__PURE__ */ jsxs("div", { className: "flex gap-x-2 group cursor-pointer py-2! text-sm [&>svg]:size-5 data-[state=open]:border-b", children: [
      /* @__PURE__ */ jsx(Folder, { className: "group-data-[state=open]:hidden" }),
      /* @__PURE__ */ jsx(FolderOpen, { className: "group-data-[state=closed]:hidden" }),
      name
    ] }) }),
    /* @__PURE__ */ jsx(AccordionContent, { className: "[&>div>div]:pl-8 pb-0!", children: isLoading ? /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4 items-center", children: [
      /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
      /* @__PURE__ */ jsx("span", { children: "Loading ..." })
    ] }) : /* @__PURE__ */ jsx(FileItems, { files, folderId: id }) })
  ] });
});
const FolderItem$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: FolderItem
}, Symbol.toStringTag, { value: "Module" }));
const Library = forwardRef(function Library2({
  setMenu,
  checklistFile,
  setChecklistFile: _setChecklistFile,
  single,
  imageOnly
}, ref) {
  const [search, setSearch] = useState("");
  const route = window.route;
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const setChecklistFile = useCallback(
    (idFile, val) => {
      let filesId = [];
      if (single) {
        filesId = /* @__PURE__ */ new Set([idFile]);
      } else {
        filesId = new Set(checklistFile);
        if (!val) {
          filesId.delete(idFile);
        } else {
          filesId.add(idFile);
        }
      }
      _setChecklistFile(filesId);
    },
    [checklistFile]
  );
  const searchFiles = useCallback((search2) => {
    setIsLoading(true);
    axios.get(
      `${route("files.index")}?${QueryString.stringify({
        search: search2
      })}`
    ).then((res) => {
      setFiles(res.data ?? []);
    }).catch((err) => {
      console.log(err);
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);
  useDidMountEffect(() => {
    const debounce = setTimeout(() => {
      if (isNullOrWhitespace(search)) {
        setFiles([]);
        return;
      }
      searchFiles(search);
    }, 500);
    return () => clearTimeout(debounce);
  }, [search]);
  return /* @__PURE__ */ jsx(
    LibraryContext.Provider,
    {
      value: {
        search,
        resultSearch: files,
        checklistFile,
        setChecklistFile,
        imageOnly
      },
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          ref,
          className: "flex flex-col items-start overflow-y-auto gap-y-2",
          children: [
            /* @__PURE__ */ jsxs(
              Button,
              {
                variant: "ghost",
                className: "px-2 py-1! size-auto",
                onClick: () => setMenu("home"),
                children: [
                  /* @__PURE__ */ jsx(ArrowLeft, {}),
                  " Back"
                ]
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "w-full px-1", children: /* @__PURE__ */ jsx(
              Input,
              {
                placeholder: "Search by filename or extension",
                type: "search",
                value: search,
                onChange: (e) => setSearch(e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx("div", { className: "w-full px-2", children: isLoading ? /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4 items-center", children: [
              /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
              /* @__PURE__ */ jsx("span", { children: "Loading ..." })
            ] }) : /* @__PURE__ */ jsx(FolderItem, { isRoot: true }, "root") })
          ]
        }
      )
    }
  );
});
const Library$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Library
}, Symbol.toStringTag, { value: "Module" }));
const Progress = React.forwardRef(({ className, value, ...props }, ref) => /* @__PURE__ */ jsx(
  ProgressPrimitive.Root,
  {
    ref,
    className: cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    ),
    ...props,
    children: /* @__PURE__ */ jsx(
      ProgressPrimitive.Indicator,
      {
        className: "flex-1 w-full h-full transition-all bg-primary",
        style: { transform: `translateX(-${100 - (value || 0)}%)` }
      }
    )
  }
));
Progress.displayName = ProgressPrimitive.Root.displayName;
function UploadDialog({
  onClose,
  single = false,
  imageOnly = false,
  options: { route: routeProp, ...optionsProp } = {}
}) {
  const route = window.route;
  const isMobile = useIsMobile();
  const [menu, setMenu] = useState("home");
  const [files, setFiles] = useState([]);
  const [hover, setHover] = useState(false);
  const [progress, setProgress] = useState(false);
  const [checklistFile, setChecklistFile] = useState(/* @__PURE__ */ new Set());
  const libraryRef = useRef();
  const id = useId();
  const addFile = useCallback(
    (file) => {
      if (imageOnly && checkFileType("image/*", file.type)) {
        return;
      }
      setFiles((prev) => {
        return [
          ...prev,
          {
            id: generateRandom(8),
            file
          }
        ];
      });
    },
    [imageOnly]
  );
  const updateFile = useCallback((id2, payload) => {
    setFiles((prev) => {
      const updatedFiles = prev.map((f) => {
        if (f.id === id2) {
          return { ...f, ...payload };
        }
        return f;
      });
      return updatedFiles;
    });
  });
  const removeFile = useCallback((id2) => {
    setFiles((prev) => prev.filter((file) => file.id !== id2));
  }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setHover(false);
    if (e.dataTransfer.items) {
      [...e.dataTransfer.items].forEach((item) => {
        if (item.kind != "file") return;
        const file = item.getAsFile();
        addFile(file);
      });
    } else {
      [...e.dataTransfer.files].forEach((file) => {
        addFile(file);
      });
    }
  }, []);
  const onAttach = useCallback((menu2, files2) => {
    const formData = new FormData();
    if (menu2 == "library") {
      files2.forEach((id2) => {
        formData.append(`filesId[]`, id2);
      });
    } else {
      files2.forEach((file, index) => {
        formData.append(`files[${index}]`, file.file);
        formData.append(`isPublic[${index}]`, file.isPublic ?? false);
        formData.append(`name[${index}]`, file.name || file.file.name);
      });
    }
    console.log(routeProp);
    router.post(
      routeProp ?? route(route().current(), route().params) + "/file",
      formData,
      {
        reset: ["attachments"],
        forceFormData: true,
        replace: true,
        preserveState: true,
        preserveScroll: true,
        showProgress: true,
        ...optionsProp,
        onProgress: (e) => {
          setProgress(e);
        },
        onSuccess: () => {
          setFiles([]);
          onClose();
          setProgress(false);
        }
      }
    );
  }, []);
  const getMenu = () => {
    switch (menu) {
      case "home":
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "relative flex items-center justify-center w-full flex-col **:pointer-events-none min-h-64 overflow-y-auto",
            onDragOver: (e) => {
              e.preventDefault();
              setHover(true);
            },
            onDragLeave: (e) => {
              e.preventDefault();
              setHover(false);
            },
            onDrop: (e) => {
              if (single && files.length > 0) return false;
              return onDrop(e);
            },
            children: [
              files.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col w-full min-h-64 gap-y-2", children: [
                /* @__PURE__ */ jsx("p", { className: "mb-1 alert warning border", children: "Maximum File Size: 10 MB" }),
                files.map((file) => /* @__PURE__ */ createElement(
                  FileItem,
                  {
                    ...file,
                    key: file.id,
                    onUpdate: updateFile,
                    onRemove: removeFile
                  }
                ))
              ] }),
              /* @__PURE__ */ jsx(
                Transition,
                {
                  show: !(files && files.length > 0) || hover && !isMobile,
                  children: /* @__PURE__ */ jsxs(
                    "div",
                    {
                      className: cn(
                        "transition ease-in-out duration-300 data-closed:opacity-0 ",
                        "absolute top-0 left-0 data flex flex-col items-center justify-center w-full min-h-64 h-full overflow-hidden border-2 border-dashed rounded-lg border-muted-foreground/30 bg-background"
                      ),
                      children: [
                        /* @__PURE__ */ jsxs(
                          "div",
                          {
                            className: cn(
                              !hover && files.length <= 0 ? "translate-y-0" : "translate-y-14",
                              "transition ease-in-out duration-300 flex flex-col items-center justify-center pt-5 pb-6"
                            ),
                            children: [
                              /* @__PURE__ */ jsx(
                                "svg",
                                {
                                  className: cn(
                                    hover ? "size-24" : "size-12",
                                    "mb-4 text-muted-foreground transition-all hidden md:block"
                                  ),
                                  "aria-hidden": "true",
                                  xmlns: "http://www.w3.org/2000/svg",
                                  fill: "none",
                                  viewBox: "0 0 20 16",
                                  children: /* @__PURE__ */ jsx(
                                    "path",
                                    {
                                      stroke: "currentColor",
                                      strokeLinecap: "round",
                                      strokeLinejoin: "round",
                                      strokeWidth: "2",
                                      d: "M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                                    }
                                  )
                                }
                              ),
                              /* @__PURE__ */ jsx("p", { className: "mb-2 text-sm text-muted-foreground", children: !hover && files.length <= 0 ? /* @__PURE__ */ jsx(Fragment, { children: !isMobile ? /* @__PURE__ */ jsxs(Fragment, { children: [
                                /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "Drag & Drop" }),
                                " ",
                                "files here or upload from"
                              ] }) : "Upload file from" }) : /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "Drop files here!" }) }),
                              /* @__PURE__ */ jsxs(
                                "div",
                                {
                                  className: cn(
                                    !hover && files.length <= 0 ? "opacity-100" : "opacity-0",
                                    "transition ease-in-out duration-300 "
                                  ),
                                  children: [
                                    /* @__PURE__ */ jsxs("div", { className: "gap-x-2 flex [&_svg]:rounded-full [&_svg]:bg-muted [&_svg]:p-2 [&_svg]:size-9! *:h-auto *:p-2! *:border-0! *:flex *:flex-col *:gap-y-1 *:items-center *:cursor-pointer", children: [
                                      /* @__PURE__ */ jsx(
                                        Button,
                                        {
                                          className: cn(!hover && "pointer-events-auto!"),
                                          variant: "outline",
                                          asChild: true,
                                          children: /* @__PURE__ */ jsxs("label", { htmlFor: id, children: [
                                            /* @__PURE__ */ jsx(Laptop2, {}),
                                            " My Device"
                                          ] })
                                        }
                                      ),
                                      /* @__PURE__ */ jsxs(
                                        Button,
                                        {
                                          className: cn(!hover && "pointer-events-auto!"),
                                          variant: "outline",
                                          onClick: () => setMenu("library"),
                                          children: [
                                            /* @__PURE__ */ jsx(LibraryIcon, {}),
                                            " Library"
                                          ]
                                        }
                                      )
                                    ] }),
                                    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm font-bold text-center text-muted-foreground", children: "Maximum file size: 10MB" })
                                  ]
                                }
                              )
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          "input",
                          {
                            id,
                            type: "file",
                            accept: imageOnly ? "image/*" : "*",
                            className: "hidden",
                            multiple: true,
                            onChange: (e) => {
                              const files2 = e.currentTarget.files;
                              setFiles((prev) => {
                                return [
                                  ...prev,
                                  ...Array.from(files2).map((file) => {
                                    return {
                                      id: generateRandom(8),
                                      file
                                    };
                                  })
                                ];
                              });
                              e.currentTarget.value = null;
                            }
                          }
                        )
                      ]
                    }
                  )
                }
              )
            ]
          }
        );
      case "library": {
        return /* @__PURE__ */ jsx(
          Library,
          {
            ref: libraryRef,
            setMenu,
            single,
            imageOnly,
            checklistFile,
            setChecklistFile
          }
        );
      }
    }
  };
  return /* @__PURE__ */ jsxs(DialogContent, { className: "max-w-xl overflow-hidden!", children: [
    /* @__PURE__ */ jsxs(DialogHeader, { className: "pb-2 border-b", children: [
      /* @__PURE__ */ jsx(DialogTitle, { children: "Upload" }),
      /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only" })
    ] }),
    getMenu(),
    progress && /* @__PURE__ */ jsxs("div", { className: "flex items-center w-full text-xs text-muted-foreground", children: [
      /* @__PURE__ */ jsx(Progress, { value: progress.progress * 100, className: "h-2!" }),
      /* @__PURE__ */ jsxs("p", { className: "mx-3 text-nowrap", children: [
        "(",
        formatBytes(progress.loaded),
        " / ",
        formatBytes(progress.total),
        ")"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        (progress.progress * 100).toFixed(1),
        "%"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      DialogFooter,
      {
        className: cn(
          files.length > 0 && menu === "home" && !single ? "justify-between!" : "justify-end!",
          "flex flex-row!  pt-2 border-t gap-x-2"
        ),
        children: [
          files.length > 0 && menu === "home" && /* @__PURE__ */ jsxs(Fragment, { children: [
            !single && /* @__PURE__ */ jsx(
              Button,
              {
                variant: "secondary",
                size: "sm",
                asChild: true,
                className: "cursor-pointer",
                children: /* @__PURE__ */ jsx("label", { htmlFor: id, children: "Browse" })
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                id,
                type: "file",
                className: "hidden",
                multiple: true,
                onChange: (e) => {
                  const files2 = e.currentTarget.files;
                  setFiles((prev) => {
                    return [
                      ...prev,
                      ...Array.from(files2).map((file) => {
                        return {
                          id: generateRandom(8),
                          file
                        };
                      })
                    ];
                  });
                  e.currentTarget.value = null;
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            Button,
            {
              disabled: menu == "home" ? files.length <= 0 : checklistFile.size <= 0,
              size: "sm",
              onClick: () => onAttach(menu, menu == "library" ? checklistFile : files),
              children: "Attach"
            }
          )
        ]
      }
    )
  ] });
}
const UploadDialog$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: UploadDialog
}, Symbol.toStringTag, { value: "Module" }));
const Attachments = memo(function Attachments2() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const attachments = usePage().props.attachments;
  const [openAttachment, setOpenAttachment] = useState(false);
  const removeFile = useCallback((id) => {
    router.delete(route(route().current(), route().params) + `/file/${id}`, {
      reset: ["attachments"],
      preserveScroll: true,
      preserveState: true,
      replace: true
    });
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center gap-2 rounded-md py-2 text-left outline-none  [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ", children: [
      /* @__PURE__ */ jsx(Paperclip, {}),
      /* @__PURE__ */ jsx("span", { className: "flex-1", children: t("core.form.attachments") }),
      /* @__PURE__ */ jsxs(Dialog, { open: openAttachment, onOpenChange: setOpenAttachment, children: [
        /* @__PURE__ */ jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
          Button,
          {
            variant: "ghost",
            className: "rounded-full p-0!",
            size: "icon",
            type: "button",
            children: /* @__PURE__ */ jsx(Plus, {})
          }
        ) }),
        /* @__PURE__ */ jsx(
          UploadDialog,
          {
            open: openAttachment,
            onClose: () => {
              setOpenAttachment(false);
            }
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      Deferred,
      {
        data: ["attachments"],
        fallback: /* @__PURE__ */ jsx("div", { className: "mb-3 first:mt-2 ms-6", children: /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4", children: [
          /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
          /* @__PURE__ */ jsxs("span", { children: [
            t("core.form.loading"),
            " ..."
          ] })
        ] }) }),
        children: /* @__PURE__ */ jsx(
          "ul",
          {
            className: cn(
              "ml-3.5 w-[calc(100%-calc(var(--spacing,0.25rem)*3.5))] flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5 pr-3.5"
            ),
            children: attachments && attachments.map(({ id, name }) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
              "div",
              {
                className: cn(
                  "w-full flex h-6 min-w-0 -translate-x-px items-center gap-2  rounded-md px-2 text-sidebar-foreground outline-none  [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                  "text-base"
                ),
                children: [
                  /* @__PURE__ */ jsxs(Tooltip, { children: [
                    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs("div", { className: "flex items-center flex-1 overflow-hidden gap-x-2", children: [
                      /* @__PURE__ */ jsxs(Link, { href: route("files.preview", id), children: [
                        /* @__PURE__ */ jsx(FileTextIcon, { className: "size-5" }),
                        " "
                      ] }),
                      /* @__PURE__ */ jsx(
                        "a",
                        {
                          target: "_blank",
                          rel: "noreferrer",
                          href: route("files.preview", id),
                          className: "hover:underline truncate",
                          children: /* @__PURE__ */ jsx("p", { className: "text-sm truncate", children: name })
                        }
                      )
                    ] }) }),
                    /* @__PURE__ */ jsx(TooltipContent, { align: "start", children: name })
                  ] }),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      variant: "ghost",
                      size: "icon",
                      className: "rounded-full p-0!",
                      onClick: () => {
                        removeFile(id);
                      },
                      children: /* @__PURE__ */ jsx(X, {})
                    }
                  )
                ]
              }
            ) }, id))
          }
        )
      }
    )
  ] });
});
const Attachments$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Attachments
}, Symbol.toStringTag, { value: "Module" }));
const theme = {
  draft: "secondary",
  submitted: "primary",
  canceled: "error",
  approved: "success",
  rejected: "error",
  pending: "warning",
  completed: "success",
  active: "success",
  inactive: "error",
  deleted: "error",
  closed: "error",
  in_progress: "primary",
  need_approval: "warning",
  waiting: "secondary",
  delivered: "success",
  billed: "success",
  overdue: "error",
  to_bill: "warning",
  to_deliver: "warning",
  partially_received: "warning",
  received: "success",
  returned: "gray",
  in_rent: "primary"
};
function BadgeStatus({ status, className, ...props }) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsxs(
    "span",
    {
      className: cn(
        "text-center badge w-fit",
        theme[status] ?? "secondary",
        className
      ),
      ...props,
      children: [
        status == "in_progress" && /* @__PURE__ */ jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", children: [
          /* @__PURE__ */ jsx("circle", { cx: 18, cy: 12, r: 0, fill: "currentColor", children: /* @__PURE__ */ jsx(
            "animate",
            {
              attributeName: "r",
              begin: 0.67,
              calcMode: "spline",
              dur: "1.5s",
              keySplines: "0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8",
              repeatCount: "indefinite",
              values: "0;2;0;0"
            }
          ) }),
          /* @__PURE__ */ jsx("circle", { cx: 12, cy: 12, r: 0, fill: "currentColor", children: /* @__PURE__ */ jsx(
            "animate",
            {
              attributeName: "r",
              begin: 0.33,
              calcMode: "spline",
              dur: "1.5s",
              keySplines: "0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8",
              repeatCount: "indefinite",
              values: "0;2;0;0"
            }
          ) }),
          /* @__PURE__ */ jsx("circle", { cx: 6, cy: 12, r: 0, fill: "currentColor", children: /* @__PURE__ */ jsx(
            "animate",
            {
              attributeName: "r",
              begin: 0,
              calcMode: "spline",
              dur: "1.5s",
              keySplines: "0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8",
              repeatCount: "indefinite",
              values: "0;2;0;0"
            }
          ) })
        ] }),
        t(`status.${status}`)
      ]
    }
  );
}
const buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal: "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical: "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none"
      }
    },
    defaultVariants: {
      orientation: "horizontal"
    }
  }
);
function ButtonGroup({
  className,
  orientation,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "group",
      "data-slot": "button-group",
      "data-orientation": orientation,
      className: cn(buttonGroupVariants({ orientation }), className),
      ...props
    }
  );
}
const FormPageContentTitle = memo(
  forwardRef(function FormPageTitle({ children, className }, ref) {
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref,
        className: cn(className, "font-bold text-lg"),
        role: "title",
        children
      }
    );
  })
);
const FormPageContentDescription = memo(
  forwardRef(function FormPageDescription({ children, className }, ref) {
    return /* @__PURE__ */ jsx(
      "p",
      {
        ref,
        className: cn(className, "text-sm font-normal"),
        role: "description",
        children
      }
    );
  })
);
const FormPageContent = forwardRef(function FormPageContent2({
  title,
  value,
  children,
  className,
  actions,
  collapsible = false,
  defaultOpen = false,
  showAt = false,
  show = true
}, ref) {
  var _a;
  const { menus, addMenu, menuSelected, removeMenu } = useFormPage();
  const [id] = useState(generateRandom(8));
  const [openCollapsible, setOpenCollapsible] = useState(defaultOpen);
  useEffect(() => {
    if (showAt) return;
    if (!show) {
      removeMenu(id);
      return;
    }
    addMenu({
      id,
      title,
      value
    });
  }, [show]);
  const headerChildren = Children.toArray(children).filter((child) => {
    return (child == null ? void 0 : child.type) == FormPageContentTitle || (child == null ? void 0 : child.type) == FormPageContentDescription;
  });
  const isSingle = menus.length <= 1 || !menus.some((x) => x.id == id);
  if (headerChildren.length > 0 || isSingle) {
    var contentChildren = Children.toArray(children).filter((child) => {
      return !((child == null ? void 0 : child.type) == FormPageContentTitle || (child == null ? void 0 : child.type) == FormPageContentDescription);
    });
  }
  const haveTitle = Children.toArray(children).findIndex(
    (child) => (child == null ? void 0 : child.type) == FormPageContentTitle
  ) >= 0;
  const Trigger = collapsible ? CollapsibleTrigger : (props) => /* @__PURE__ */ jsx("div", { ...props });
  const Content = collapsible ? CollapsibleContent : Fragment$1;
  return /* @__PURE__ */ jsx(
    TabsContent,
    {
      value: showAt ? typeof showAt === "string" ? showAt : Array.isArray(showAt) ? showAt.find(
        (item) => {
          var _a2;
          return item === (menuSelected ?? ((_a2 = menus == null ? void 0 : menus[0]) == null ? void 0 : _a2.value));
        }
      ) ?? value : menuSelected ?? ((_a = menus == null ? void 0 : menus[0]) == null ? void 0 : _a.value) : value,
      className: "mt-0",
      children: /* @__PURE__ */ jsx(Collapsible, { open: openCollapsible, onOpenChange: setOpenCollapsible, children: /* @__PURE__ */ jsx(
        "div",
        {
          ref,
          className: cn("px-4 py-4 mt-0! border-b-0", className),
          role: "content",
          children: headerChildren.length > 0 || isSingle && collapsible || isSingle && title || title && collapsible ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs(Trigger, { className: "w-full pt-0 pb-1 mb-3 border-b border-muted-foreground/25 [&[data-state=open]_svg]:rotate-180", children: [
              (!haveTitle || !haveTitle && actions) && /* @__PURE__ */ jsxs(FormPageContentTitle, { className: "flex items-center justify-between gap-x-4", children: [
                title || value,
                actions,
                collapsible && /* @__PURE__ */ jsx(ChevronDownIcon, { className: "w-4 h-4 transition-transform duration-200 shrink-0" })
              ] }),
              headerChildren
            ] }),
            /* @__PURE__ */ jsx(Content, { children: contentChildren })
          ] }) : children
        }
      ) })
    }
  );
});
const FormChildren = memo(function FormChildren2({
  children,
  className,
  showHeader,
  errors,
  fieldNameTrans,
  dataBefore,
  defaultData,
  data,
  setData,
  defaultMenu,
  disabled,
  form
  // hasConnections,
}) {
  var _a;
  const tabsListRef = useRef(null);
  const isMobile = useIsMobile();
  const { t } = useLaravelReactI18n();
  const [_menus, setMenus] = useState([]);
  const [menuSelected, setMenuSelected] = useState(defaultMenu);
  const addMenu = useCallback((newItem) => {
    setMenus((prev) => {
      let newItems = [...prev ?? []];
      newItems = [...newItems, newItem];
      return newItems;
    });
  }, []);
  const removeMenu = useCallback((id) => {
    setMenus((prev) => {
      const newItems = prev == null ? void 0 : prev.filter((menu) => menu.id !== id);
      return newItems;
    });
  }, []);
  const menus = useMemo(() => {
    const mapMenus = /* @__PURE__ */ new Map();
    _menus == null ? void 0 : _menus.forEach((menu) => {
      if (mapMenus.has(menu.value)) return;
      mapMenus.set(menu.value, menu);
    });
    return Array.from(mapMenus.values());
  }, [_menus]);
  return /* @__PURE__ */ jsx(
    Tabs,
    {
      value: menuSelected ?? ((_a = menus == null ? void 0 : menus[0]) == null ? void 0 : _a.value) ?? "",
      className: cn("w-full", isMobile && "max-w-full!", className),
      onValueChange: setMenuSelected,
      asChild: true,
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          className: cn(
            "flex flex-col order-1 max-w-full  border rounded-xl lg:col-start-1 border-muted-foreground/25",
            "[&_:not(div[role=content])+div[role=content]]:border-t-0 [&_div[role=content]:first-child]:border-t-0! [&_div[role=content]]:border-t [&_div[role=content]]:border-muted-foreground/25"
          ),
          children: [
            /* @__PURE__ */ jsxs(
              TabsList,
              {
                ref: tabsListRef,
                "data-tabs": true,
                style: {
                  "--tabs-top": showHeader ? "3.5rem" : "0rem",
                  top: "var(--tabs-top)"
                },
                className: cn(
                  (menus == null ? void 0 : menus.length) <= 1 && !(defaultData == null ? void 0 : defaultData.approvalable) ? "hidden" : "",
                  // showHeader ? "top-14" : "top-0",
                  "transition-[top] duration-300 ease-in-out sticky z-9 w-full p-0! h-auto rounded-b-none rounded-t-xl items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b"
                ),
                children: [
                  menus.map((child) => {
                    return /* @__PURE__ */ jsx(
                      TabsTrigger,
                      {
                        value: child.value,
                        className: "text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors",
                        children: /* @__PURE__ */ jsx("span", { className: "pt-2 pb-1 border-transparent w-fit group-data-[state=active]:border-foreground border-b transition-colors duration-300 ", children: t(child.title || child.value) })
                      },
                      child.value
                    );
                  }),
                  (defaultData == null ? void 0 : defaultData.approvalable) && /* @__PURE__ */ jsx(
                    TabsTrigger,
                    {
                      value: "approvals",
                      className: "text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors",
                      children: /* @__PURE__ */ jsx("span", { className: "pt-2 pb-1 border-transparent w-fit group-data-[state=active]:border-foreground border-b transition-colors duration-300 ", children: t("core.form.approvals") })
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              FormPageProvider,
              {
                disabled,
                errors,
                fieldNameTrans,
                defaultData,
                data,
                setData,
                menus,
                addMenu,
                removeMenu,
                menuSelected,
                setMenuSelected,
                dataBefore,
                form,
                children: [
                  children,
                  (defaultData == null ? void 0 : defaultData.approvalable) && /* @__PURE__ */ jsx(Approvals, { approvals: defaultData == null ? void 0 : defaultData.approvalable.steps })
                ]
              }
            )
          ]
        }
      )
    }
  );
});
const FormPageContext = createContext();
const useFormPage = () => useContext(FormPageContext);
const FormPageProvider = memo(function FormPageProvider2({
  children,
  disabled,
  errors,
  fieldNameTrans,
  defaultData,
  data,
  setData,
  menus,
  addMenu,
  removeMenu,
  menuSelected,
  setMenuSelected,
  dataBefore,
  form
}) {
  const contextValue = useMemo(
    () => ({
      disabled,
      menus,
      addMenu,
      removeMenu,
      menuSelected,
      setMenuSelected,
      errors,
      fieldNameTrans,
      defaultData,
      data,
      setData,
      dataBefore: dataBefore ?? {},
      form
    }),
    [
      disabled,
      menus,
      addMenu,
      removeMenu,
      menuSelected,
      setMenuSelected,
      errors,
      fieldNameTrans,
      defaultData,
      data,
      setData,
      dataBefore,
      form
    ]
  );
  return /* @__PURE__ */ jsx(FormPageContext.Provider, { value: contextValue, children });
});
const FormPage = memo(
  forwardRef(function FormPage2({
    name,
    disabled: _disabled,
    isCreate = false,
    fieldNameTrans,
    title,
    badge,
    controls,
    defaultMenu,
    sidebarContent,
    bottombarContent,
    className,
    children,
    submitable = false,
    ignoreDraft = false,
    defaultValues,
    deleteable = true,
    banner,
    printable: _printable
  }, ref) {
    var _a;
    const printable = !isCreate && (_printable ?? submitable);
    const route = window.route;
    const { deleteItem } = useDeleteModal();
    const { t } = useLaravelReactI18n();
    const defaultData = usePage().props[name] ?? defaultValues ?? {};
    const prints = usePage().props.prints ?? [];
    const form = useDraftForm(name, defaultData, { isCreate, ignoreDraft });
    const user = usePage().props.auth.user;
    const {
      data,
      setData: _setData,
      put,
      post,
      processing,
      errors,
      isDirty,
      key
    } = form;
    window.keyForm = key;
    const disabled = useMemo(() => {
      if (!(defaultData == null ? void 0 : defaultData.disabledOn)) {
        return !!_disabled;
      }
      return evaluate(defaultData == null ? void 0 : defaultData.disabledOn, defaultData);
    }, [_disabled, defaultData == null ? void 0 : defaultData.disabledOn]);
    const onSubmit = useCallback(
      (e) => {
        e.preventDefault();
        if (e.action == "submit") {
          put(route(`${pluralize.plural(name ?? "")}.submit`, defaultData.id));
          return;
        }
        if (isCreate) {
          post(route(`${pluralize.plural(name ?? "")}.store`));
          return;
        }
        put(route(`${pluralize.plural(name ?? "")}.update`, defaultData.id));
      },
      [route, name, isCreate, defaultData, data]
    );
    const [showAlertBeforeSubmit, setShowAlertBeforeSubmit] = useState(false);
    const [showAlertBeforeCancel, setShowAlertBeforeCancel] = useState(false);
    const formRef = useRef();
    const layoutRef = useRef(null);
    const lastPositionRef = useRef(0);
    const showHeaderRef = useRef(true);
    const handleScroll = useCallback((e) => {
      var _a2, _b;
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const position = Math.ceil(
        scrollTop / (scrollHeight - clientHeight) * 100
      );
      const prev = lastPositionRef.current;
      if (prev === position) return;
      lastPositionRef.current = position;
      const nextShow = position <= prev;
      if (showHeaderRef.current === nextShow) return;
      showHeaderRef.current = nextShow;
      const headerEl = (_a2 = layoutRef.current) == null ? void 0 : _a2.querySelector("[data-header]");
      headerEl == null ? void 0 : headerEl.classList.toggle("is-hidden", !nextShow);
      const tabsEl = (_b = layoutRef.current) == null ? void 0 : _b.querySelector("[data-tabs]");
      tabsEl == null ? void 0 : tabsEl.style.setProperty("--tabs-top", nextShow ? "3.5rem" : "0px");
    }, []);
    const onKeyDown = useCallback(
      (e) => {
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          e.stopPropagation();
          if (submitable && !isDirty) {
            setShowAlertBeforeSubmit(true);
            return;
          }
          const form2 = formRef.current;
          if (form2) {
            if (typeof form2.requestSubmit === "function") {
              form2.requestSubmit();
            } else {
              form2.dispatchEvent(new Event("submit", { cancelable: true }));
            }
          }
        }
      },
      [formRef, isDirty, submitable]
    );
    const setData = useCallback(
      (...args) => {
        if (disabled) return;
        _setData(...args);
      },
      [disabled, _setData]
    );
    const submit = useCallback(() => {
      setShowAlertBeforeSubmit(true);
    }, []);
    const cancel = useCallback(() => {
      setShowAlertBeforeCancel(true);
    }, []);
    const onCancel = useCallback(() => {
      put(route(`${pluralize.plural(name ?? "")}.cancel`, defaultData.id));
    }, []);
    const amend = useCallback(() => {
      put(route(`${pluralize.plural(name ?? "")}.amend`, defaultData.id));
    }, []);
    return /* @__PURE__ */ jsxs(
      AppLayout,
      {
        ref: layoutRef,
        className: "pt-0! relative group/form",
        onScroll: handleScroll,
        children: [
          /* @__PURE__ */ jsxs(
            "form",
            {
              onKeyDown,
              ref: formRef,
              onSubmit: (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (disabled) return;
                e.action = "update";
                onSubmit == null ? void 0 : onSubmit(e);
              },
              children: [
                /* @__PURE__ */ jsxs(
                  "div",
                  {
                    "data-header": true,
                    className: cn(
                      // showHeader ? "top-0" : "-top-16",
                      " transition-[top] duration-300 ease-in-out sticky z-10 flex items-center justify-between pt-4 pb-2 border-b gap-x-4 bg-background border-muted-foreground/25"
                    ),
                    children: [
                      /* @__PURE__ */ jsx(Head, { title }),
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
                        title && /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: title }),
                        badge,
                        (defaultData == null ? void 0 : defaultData.status) && (Array.isArray(defaultData == null ? void 0 : defaultData.status) ? defaultData == null ? void 0 : defaultData.status.map((status, idx) => /* @__PURE__ */ jsx(BadgeStatus, { status }, idx)) : /* @__PURE__ */ jsx(BadgeStatus, { status: defaultData == null ? void 0 : defaultData.status })),
                        isDirty && /* @__PURE__ */ jsx("span", { className: "text-sm badge warning", children: t("core.form.not_saved") })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2 ", children: [
                        typeof controls === "function" ? controls({ form }) : controls,
                        printable && !inArray(defaultData == null ? void 0 : defaultData.status, "draft") && /* @__PURE__ */ jsx(
                          Deferred,
                          {
                            data: ["prints"],
                            fallback: /* @__PURE__ */ jsxs(
                              Button,
                              {
                                type: "button",
                                variant: "outline",
                                className: "p-2! size-fit h-8",
                                disabled: processing,
                                children: [
                                  /* @__PURE__ */ jsx(PrinterIcon, {}),
                                  t("core.form.print"),
                                  /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" })
                                ]
                              }
                            ),
                            children: /* @__PURE__ */ jsxs(ButtonGroup, { className: "h-fit", children: [
                              prints && prints.length > 0 ? /* @__PURE__ */ jsx(
                                Button,
                                {
                                  type: "button",
                                  variant: "outline",
                                  className: "p-2! size-fit h-8",
                                  disabled: processing,
                                  asChild: true,
                                  children: /* @__PURE__ */ jsxs(
                                    Link,
                                    {
                                      href: route(
                                        `${pluralize.plural(name ?? "")}.print`,
                                        defaultData.id
                                      ),
                                      children: [
                                        /* @__PURE__ */ jsx(PrinterIcon, {}),
                                        t("core.form.print")
                                      ]
                                    }
                                  )
                                }
                              ) : /* @__PURE__ */ jsxs(
                                Button,
                                {
                                  type: "button",
                                  variant: "outline",
                                  className: "p-2! size-fit h-8",
                                  disabled: processing,
                                  onClick: () => {
                                    toast.custom(
                                      (e) => /* @__PURE__ */ jsxs(
                                        Alert,
                                        {
                                          variant: "mono",
                                          icon: "destructive",
                                          onClose: () => toast.dismiss(e),
                                          children: [
                                            /* @__PURE__ */ jsx(AlertIcon, { children: /* @__PURE__ */ jsx(RiErrorWarningFill, {}) }),
                                            /* @__PURE__ */ jsx(AlertTitle, { children: t("core.form.print.errors.no_template") }),
                                            /* @__PURE__ */ jsx(AlertToolbar, { children: /* @__PURE__ */ jsx(Button, { children: /* @__PURE__ */ jsx(
                                              Link,
                                              {
                                                href: route(
                                                  `${pluralize.plural(name ?? "")}.createPrintTemplate`
                                                ),
                                                children: t(
                                                  "core.form.print.errors.no_template.create"
                                                )
                                              }
                                            ) }) })
                                          ]
                                        }
                                      ),
                                      {
                                        duration: 5e3
                                      }
                                    );
                                  },
                                  children: [
                                    /* @__PURE__ */ jsx(PrinterIcon, {}),
                                    t("core.form.print")
                                  ]
                                }
                              ),
                              prints && prints.length > 1 && /* @__PURE__ */ jsxs(DropdownMenu, { children: [
                                /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                                  Button,
                                  {
                                    type: "button",
                                    variant: "outline",
                                    className: "p-2! size-fit h-8",
                                    disabled: processing,
                                    size: "icon",
                                    children: /* @__PURE__ */ jsx(ChevronDownIcon, {})
                                  }
                                ) }),
                                /* @__PURE__ */ jsx(DropdownMenuContent, { align: "end", children: prints.map((print) => /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs(
                                  Link,
                                  {
                                    href: route(
                                      `${pluralize.plural(name ?? "")}.print`,
                                      {
                                        [name]: defaultData.id,
                                        printTemplate: print.id
                                      }
                                    ),
                                    children: [
                                      print.name,
                                      print.is_default && /* @__PURE__ */ jsx("div", { className: "badge secondary", children: t("core.form.default") })
                                    ]
                                  }
                                ) }, print.id)) })
                              ] })
                            ] })
                          }
                        ),
                        (defaultData == null ? void 0 : defaultData.approvalable) && /* @__PURE__ */ jsx(
                          ApproverDecision$1,
                          {
                            name,
                            approval: defaultData == null ? void 0 : defaultData.approvalable
                          }
                        ),
                        !disabled && (!submitable || submitable && inArray(defaultData == null ? void 0 : defaultData.status, "draft")) && deleteable && (defaultData == null ? void 0 : defaultData.canDelete) && (defaultData == null ? void 0 : defaultData.id) && /* @__PURE__ */ jsxs(
                          Button,
                          {
                            type: "button",
                            variant: "destructive",
                            className: "p-2! size-fit h-8",
                            disabled: processing,
                            onClick: () => deleteItem(
                              `${pluralize.plural(name ?? "")}.destroy`,
                              defaultData.id
                            ),
                            children: [
                              /* @__PURE__ */ jsx(Trash2Icon, {}),
                              t("core.form.delete")
                            ]
                          }
                        ),
                        !isDirty && !isCreate ? submitable && ((_a = defaultData == null ? void 0 : defaultData.created_by) == null ? void 0 : _a.id) == (user == null ? void 0 : user.id) && (!(defaultData == null ? void 0 : defaultData.submitted_at) ? /* @__PURE__ */ jsx(
                          Button,
                          {
                            type: "button",
                            className: "p-2! size-fit h-8",
                            disabled: processing,
                            onClick: submit,
                            variant: "primary",
                            children: t("core.form.submit")
                          }
                        ) : inArray(defaultData == null ? void 0 : defaultData.status, ["canceled", "rejected"]) ? /* @__PURE__ */ jsx(
                          Button,
                          {
                            type: "button",
                            className: "p-2! size-fit h-8",
                            disabled: processing,
                            onClick: amend,
                            variant: "primary",
                            children: t("core.form.amend")
                          }
                        ) : !isCompletedStatus(defaultData == null ? void 0 : defaultData.status) && /* @__PURE__ */ jsx(
                          Button,
                          {
                            type: "button",
                            className: "p-2! size-fit h-8",
                            disabled: processing,
                            onClick: cancel,
                            variant: "destructive",
                            children: t("core.form.cancel")
                          }
                        )) : /* @__PURE__ */ jsxs(
                          Button,
                          {
                            type: "submit",
                            className: "p-2! size-fit h-8",
                            disabled: processing,
                            children: [
                              /* @__PURE__ */ jsx(SaveIcon, {}),
                              t("core.form.save")
                            ]
                          }
                        )
                      ] })
                    ]
                  }
                ),
                banner,
                errors && Object.keys(errors).length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex-col w-full mt-4 alert error", children: [
                  /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold", children: t("core.form.errors.title") }),
                  /* @__PURE__ */ jsx("ul", { className: "block pl-5", children: Object.entries(errors).map(([key2, value]) => /* @__PURE__ */ jsx("li", { className: "list-disc", children: fieldNameTrans ? value.replace(key2, t(`${fieldNameTrans}.${key2}`)) : value }, key2)) })
                ] }),
                /* @__PURE__ */ jsxs(
                  "div",
                  {
                    className: cn(
                      // disabled &&
                      //   "[&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
                      "relative grid grid-cols-1 auto-rows-max lg:grid-rows-[auto_1fr] lg:grid-cols-[1fr_auto] flex-1 gap-4 mt-4"
                    ),
                    children: [
                      !isCreate && /* @__PURE__ */ jsx(
                        SidebarChildren,
                        {
                          content: sidebarContent,
                          hasConnections: submitable && (defaultData == null ? void 0 : defaultData.status) && !inArray(defaultData == null ? void 0 : defaultData.status, "draft"),
                          submitable,
                          defaultData
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        FormChildren,
                        {
                          ref,
                          disabled,
                          className,
                          errors,
                          fieldNameTrans,
                          defaultData,
                          data,
                          setData,
                          defaultMenu,
                          form,
                          hasConnections: submitable && (defaultData == null ? void 0 : defaultData.status) && !inArray(defaultData == null ? void 0 : defaultData.status, "draft"),
                          children
                        }
                      ),
                      !isCreate && /* @__PURE__ */ jsx(BottombarChildren, { content: bottombarContent })
                    ]
                  }
                )
              ]
            }
          ),
          submitable && /* @__PURE__ */ jsx(
            AlertDialog,
            {
              open: showAlertBeforeSubmit,
              onOpenChange: setShowAlertBeforeSubmit,
              children: /* @__PURE__ */ jsx(AlertDialogContent, { children: /* @__PURE__ */ jsx(TooltipProvider, { children: /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
                /* @__PURE__ */ jsx(AlertDialogTitle, { children: t("core.form.confirmation_submit.title") }),
                /* @__PURE__ */ jsx(AlertDialogDescription, { children: t("core.form.confirmation_submit.subtitle") }),
                /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
                  /* @__PURE__ */ jsx(
                    AlertDialogCancel,
                    {
                      className: "h-8",
                      onClick: () => setShowAlertBeforeSubmit(false),
                      children: t("core.form.confirmation_submit.cancel")
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    AlertDialogAction,
                    {
                      className: "h-8",
                      onClick: (e) => {
                        setShowAlertBeforeSubmit(false);
                        e.action = "submit";
                        onSubmit == null ? void 0 : onSubmit(e);
                      },
                      children: t("core.form.confirmation_submit.submit")
                    }
                  )
                ] })
              ] }) }) })
            }
          ),
          submitable && (defaultData == null ? void 0 : defaultData.submitted_at) && !inArray(defaultData == null ? void 0 : defaultData.status, ["canceled", "complated"]) && /* @__PURE__ */ jsx(
            AlertDialog,
            {
              open: showAlertBeforeCancel,
              onOpenChange: setShowAlertBeforeCancel,
              children: /* @__PURE__ */ jsx(AlertDialogContent, { children: /* @__PURE__ */ jsx(TooltipProvider, { children: /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
                /* @__PURE__ */ jsx(AlertDialogTitle, { children: t("core.form.confirmation_cancel.title") }),
                /* @__PURE__ */ jsx(AlertDialogDescription, { children: t("core.form.confirmation_cancel.subtitle") }),
                /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
                  /* @__PURE__ */ jsx(
                    AlertDialogCancel,
                    {
                      className: "h-8",
                      onClick: () => setShowAlertBeforeCancel(false),
                      children: t("core.form.confirmation_cancel.cancel")
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    AlertDialogAction,
                    {
                      className: "h-8",
                      onClick: (e) => {
                        setShowAlertBeforeCancel(false);
                        onCancel(e);
                      },
                      children: t("core.form.confirmation_cancel.submit")
                    }
                  )
                ] })
              ] }) }) })
            }
          )
        ]
      }
    );
  })
);
const ApprovalItem = memo(function ApprovalItem2({
  id,
  approver,
  approver_type,
  acted_by,
  acted_at,
  notes,
  status
}) {
  var _a, _b, _c, _d, _e;
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const lang = (_a = usePage().props) == null ? void 0 : _a.lang;
  const [open, setOpen] = useState(false);
  const hasDetail = !(status == "waiting" || status == "pending" || status == "skipped");
  const alias = (_e = (_d = (_c = (_b = acted_by == null ? void 0 : acted_by.name) == null ? void 0 : _b.split(" ")) == null ? void 0 : _c.slice(0, 2)) == null ? void 0 : _d.map((n) => n.charAt(0))) == null ? void 0 : _e.join("");
  return /* @__PURE__ */ jsxs("li", { className: "mb-3 first:mt-2 ms-6", children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        className: cn(
          // type == "log" ? "bg-inherit" : "bg-muted border-[3px]",
          "p-2 -mt-1.5 size-[34px] -start-[18px] border-muted flex justify-center items-center absolute rounded-full"
        ),
        children: /* @__PURE__ */ jsx(
          "span",
          {
            className: cn(
              "block rounded-full bg-accent-foreground size-2",
              !hasDetail && "bg-muted-foreground"
            )
          }
        )
      }
    ),
    /* @__PURE__ */ jsxs(Collapsible, { open: hasDetail && open, onOpenChange: setOpen, children: [
      /* @__PURE__ */ jsxs(
        CollapsibleTrigger,
        {
          className: cn(
            "[&[data-state=open]_svg]:rotate-180 text-foreground grid grid-cols-[auto_1fr] gap-x-2 items-center",
            !hasDetail && "text-muted-foreground",
            hasDetail && "cursor-pointer"
          ),
          children: [
            hasDetail && /* @__PURE__ */ jsx(ChevronDownIcon, { className: "w-4 h-4 transition-transform duration-200 shrink-0" }),
            /* @__PURE__ */ jsxs("p", { className: "text-sm font-normal leading-none ", children: [
              /* @__PURE__ */ jsx("span", { className: "capitalize", children: approver_type + ": " }),
              /* @__PURE__ */ jsx("span", { children: convertTemplateLink(approver) }),
              /* @__PURE__ */ jsx(BadgeStatus, { className: "ml-2", status })
            ] })
          ]
        }
      ),
      hasDetail && /* @__PURE__ */ jsx(CollapsibleContent, { asChild: true, children: /* @__PURE__ */ jsxs("div", { className: "ml-6 w-[calc(100%-calc(var(--spacing,0.25)*6))] text-sm space-y-1.5 mt-1", children: [
        /* @__PURE__ */ jsxs("p", { className: "truncate", children: [
          t("core.approvalScheme.steps.columns.acted_by"),
          " :"
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "truncate flex items-center gap-x-2 w-full", children: [
          /* @__PURE__ */ jsxs(Avatar, { className: "rounded-full h-max size-10", children: [
            (acted_by == null ? void 0 : acted_by.image) && /* @__PURE__ */ jsx(
              AvatarImage,
              {
                src: route("files.preview", acted_by == null ? void 0 : acted_by.image) + `?v=${new Date(acted_by == null ? void 0 : acted_by.updated_at).getTime()}`,
                alt: acted_by == null ? void 0 : acted_by.name
              }
            ),
            /* @__PURE__ */ jsx(AvatarFallback, { className: "text-xl font-semibold rounded-lg", children: alias })
          ] }),
          /* @__PURE__ */ jsx("span", { children: acted_by == null ? void 0 : acted_by.name }),
          /* @__PURE__ */ jsx("span", { children: "●" }),
          /* @__PURE__ */ jsx("span", { children: format(new TZDate(acted_at, "UTC"), "PPPp", {
            locale: getLocaleDate(lang)
          }) })
        ] }),
        notes && /* @__PURE__ */ jsxs("div", { className: "rounded-lg border-muted-foreground/30 mt-2 border", children: [
          /* @__PURE__ */ jsx("p", { className: "truncate border-b border-muted-foreground/30 px-2 pt-2 pb-1 font-semibold", children: t("core.approvalScheme.steps.columns.notes") }),
          /* @__PURE__ */ jsx("p", { className: "p-2 w-full text-wrap wrap-break-word text-justify", children: notes })
        ] })
      ] }) })
    ] })
  ] }, id);
});
const Approvals = memo(
  forwardRef(function Approvals2({ approvals }, ref) {
    return /* @__PURE__ */ jsx(TabsContent, { value: "approvals", className: "mt-0", ref, children: /* @__PURE__ */ jsx("div", { className: "p-4 mt-0! border-b-0", children: /* @__PURE__ */ jsx("ol", { className: "relative ml-3.5 border-muted border-s-2 ", children: approvals && approvals.map(({ id, ...approval }) => /* @__PURE__ */ createElement(ApprovalItem, { ...approval, key: id })) }) }) });
  })
);
const SidebarChildren = memo(
  forwardRef(function SidebarChildren2({ content, className, hasConnections, submitable, defaultData }, ref) {
    const route = window.route;
    const { connections } = usePage().props;
    const { t } = useLaravelReactI18n();
    const defaultSidebarChildren = useMemo(() => {
      return /* @__PURE__ */ jsxs("ul", { className: cn("flex w-full min-w-0 flex-col gap-1"), children: [
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Attachments, {}) }),
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Tags, {}) })
      ] });
    }, []);
    const sidebarChildren = content === false ? null : !content ? defaultSidebarChildren : typeof content === "function" ? content == null ? void 0 : content(defaultSidebarChildren) : content;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        className: cn(
          className,
          "flex flex-col z-10 order-2 lg:max-w-72 lg:col-start-2 lg:row-span-2 h-fit  gap-y-4 lg:sticky lg:top-[73px]"
        ),
        children: [
          submitable && (defaultData == null ? void 0 : defaultData.amended_from_id) && /* @__PURE__ */ jsx(
            FormInput$1,
            {
              label: t("core.form.amended_from"),
              className: "pointer-events-auto!",
              children: /* @__PURE__ */ jsx(
                LinkModel,
                {
                  disabledAddButton: true,
                  readOnly: true,
                  value: defaultData == null ? void 0 : defaultData.amended_from,
                  customNavigation: (value) => {
                    window.open(route(route().current(), value == null ? void 0 : value.id), "_blank");
                  }
                }
              )
            }
          ),
          hasConnections && /* @__PURE__ */ jsxs(Collapsible, { defaultOpen: true, children: [
            /* @__PURE__ */ jsxs(CollapsibleTrigger, { className: "[&[data-state=open]_svg]:rotate-180 flex items-center gap-x-2", children: [
              /* @__PURE__ */ jsx(ChevronDownIcon, { className: "w-4 h-4 transition-transform duration-200 shrink-0" }),
              t("core.form.connections")
            ] }),
            /* @__PURE__ */ jsx(CollapsibleContent, { children: /* @__PURE__ */ jsx(
              WhenVisible,
              {
                data: ["connections"],
                fallback: /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4", children: [
                  /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    t("core.form.loading"),
                    " ..."
                  ] })
                ] }),
                children: connections && (connections == null ? void 0 : connections.map((connection) => {
                  var _a;
                  return /* @__PURE__ */ jsxs(
                    Collapsible,
                    {
                      className: "ml-6",
                      children: [
                        /* @__PURE__ */ jsxs(CollapsibleTrigger, { className: "[&[data-state=open]_svg]:rotate-180  flex items-center gap-x-2", children: [
                          /* @__PURE__ */ jsx(ChevronDownIcon, { className: "w-4 h-4 transition-transform duration-200 shrink-0" }),
                          connection.model,
                          /* @__PURE__ */ jsx("span", { className: "rounded-full size-6 flex justify-center items-center bg-foreground/90 text-muted!", children: connection.count })
                        ] }),
                        /* @__PURE__ */ jsx(CollapsibleContent, { children: (_a = connection.items) == null ? void 0 : _a.map((item) => {
                          return /* @__PURE__ */ jsx("div", { className: "ml-6", children: /* @__PURE__ */ jsx(
                            Link,
                            {
                              href: route(item.route, item.reference_id),
                              className: "text-blue-800 dark:text-blue-200 hover:underline",
                              children: item.reference_display
                            }
                          ) }, item.id);
                        }) })
                      ]
                    },
                    connection.reference_type
                  );
                }))
              }
            ) })
          ] }),
          sidebarChildren
        ]
      }
    );
  })
);
const BottombarChildren = memo(
  forwardRef(function BottombarChildren2({ content, className }, ref) {
    const defaultBottombarChildren = useMemo(() => {
      return /* @__PURE__ */ jsx(Comments, {});
    }, []);
    const bottombarChildren = content === false ? null : !content ? defaultBottombarChildren : typeof content === "function" ? content == null ? void 0 : content(defaultBottombarChildren) : content;
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref,
        className: cn(
          className,
          "flex flex-col order-3 lg:col-start-1 gap-y-4"
        ),
        children: bottombarChildren
      }
    );
  })
);
const FormPageDialog = memo(
  forwardRef(function FormPageDialog2({
    title,
    name,
    disabled: disabledProps,
    fieldNameTrans,
    defaultMenu,
    className,
    defaultValue,
    children,
    badge
  }, ref) {
    const { t } = useLaravelReactI18n();
    const route = window.route;
    const [open, setOpen] = useState(false);
    useImperativeHandle(
      ref,
      () => ({
        open: () => setOpen(true),
        close: () => setOpen(false)
      }),
      []
    );
    const { loadDraft, ...form } = useDraftForm(name, defaultValue ?? {}, {
      // onContinueDraft: () => {
      //   onOpenChange?.(true);
      // },
      isCreate: true,
      isDialog: true
    });
    const {
      data,
      setData: _setData,
      post,
      processing,
      errors,
      isDirty,
      reset,
      setDefaults,
      clearErrors,
      key
    } = form;
    const disabled = disabledProps ?? processing;
    useEffect(() => {
      setDefaults(defaultValue ?? {});
      reset();
    }, [defaultValue]);
    useEffect(() => {
      if (!open) return;
      else {
        loadDraft();
      }
      reset();
    }, [open]);
    const setData = useCallback(
      (...args) => {
        if (disabled) return;
        _setData(...args);
      },
      [disabled, _setData]
    );
    const { setLeave, setSaveAsDraft, setIsDirty, setShowAlert } = useIsDirtyForm();
    const { cancel } = useAlertDraftForm();
    const formRef = useRef();
    const onKeyDown = useCallback(
      (e) => {
        e.stopPropagation();
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          const form2 = formRef.current;
          if (form2) {
            if (typeof form2.requestSubmit === "function") {
              form2.requestSubmit();
            } else {
              form2.dispatchEvent(new Event("submit", { cancelable: true }));
            }
          }
        }
      },
      [formRef]
    );
    const onClose = (val) => {
      setLeave(() => {
        setOpen(false);
        setShowAlert(false);
        setIsDirty(false);
        cancel();
        reset();
        clearErrors();
        removeFromLocalStorage(key);
      });
      setSaveAsDraft(() => {
        setOpen(false);
        setShowAlert(false);
        setIsDirty(false);
        clearErrors();
      });
      if (isDirty) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
        setOpen(val);
        reset();
        clearErrors();
      }
    };
    const _onSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (!name) return;
      const pluralized = `${pluralize.plural(name ?? "")}.store`;
      post(route(pluralized), {
        preserveState: true,
        preserveUrl: false,
        onSuccess: () => {
          _setData(defaultValue ?? {});
          setOpen(false);
        }
      });
    };
    return /* @__PURE__ */ jsx(AlertDialog, { open, children: /* @__PURE__ */ jsx(AlertDialogContent, { className: cn(className, "py-0 overflow-hidden"), children: /* @__PURE__ */ jsx(TooltipProvider, { children: /* @__PURE__ */ jsxs(
      "form",
      {
        ref: formRef,
        onKeyDown,
        onSubmit: _onSubmit,
        disabled,
        className: cn(
          "max-h-screen overflow-y-hidden flex flex-col",
          disabled && " [&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden"
        ),
        children: [
          /* @__PURE__ */ jsxs(AlertDialogHeader, { className: "pt-6 mb-4 border-b border-muted-foreground/30", children: [
            /* @__PURE__ */ jsxs(AlertDialogTitle, { className: "flex items-center mb-1 gap-x-2", children: [
              title,
              isDirty && /* @__PURE__ */ jsx("span", { className: "text-sm badge warning", children: t("core.form.not_saved") }),
              badge
            ] }),
            /* @__PURE__ */ jsx(AlertDialogDescription, { className: "sr-only" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "overflow-y-auto", children: [
            errors && Object.keys(errors).length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex-col w-full mt-4 alert error", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold", children: t("core.form.errors.title") }),
              /* @__PURE__ */ jsx("ul", { className: "block pl-5", children: Object.entries(errors).map(([key2, value]) => /* @__PURE__ */ jsx("li", { className: "list-disc", children: fieldNameTrans ? value.replace(key2, t(`${fieldNameTrans}.${key2}`)) : value }, key2)) })
            ] }),
            /* @__PURE__ */ jsx(
              FormChildren,
              {
                disabled,
                defaultMenu,
                className,
                showHeader: false,
                errors,
                fieldNameTrans,
                data,
                setData,
                form,
                children
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(AlertDialogFooter, { className: "pb-6 mt-4", children: [
            /* @__PURE__ */ jsx(
              AlertDialogCancel,
              {
                className: "h-8",
                onClick: () => onClose(false),
                children: t("core.form.cancel")
              }
            ),
            /* @__PURE__ */ jsx(
              AlertDialogAction,
              {
                className: "h-8",
                type: "submit",
                onClick: () => {
                },
                children: t("core.form.save")
              }
            )
          ] })
        ]
      }
    ) }) }) });
  })
);
const FormPageLinkModelDialog = memo(
  forwardRef(function FormPageDialog3({
    title,
    name,
    disabled: disabledProps,
    fieldNameTrans,
    defaultMenu,
    className,
    open,
    onOpenChange,
    children,
    badge,
    defaultValue,
    onSuccess,
    postOption = {}
  }, ref) {
    const { t } = useLaravelReactI18n();
    const route = window.route;
    const { setLeave, setSaveAsDraft, setIsDirty, setShowAlert } = useIsDirtyForm();
    const { cancel } = useAlertDraftForm();
    const {
      data,
      setData: _setData,
      post,
      put,
      patch,
      processing,
      errors,
      isDirty,
      recentlySuccessful,
      reset,
      setDefaults,
      clearErrors,
      loadDraft,
      key
    } = useDraftForm(name, defaultValue ?? {}, {
      // onContinueDraft: () => {
      //   onOpenChange?.(true);
      // },
      isDialog: true,
      isCreate: true
    });
    useEffect(() => {
      setDefaults(defaultValue ?? {});
      _setData(defaultValue ?? {});
    }, [defaultValue]);
    useEffect(() => {
      if (!open) return;
      else {
        loadDraft();
      }
      reset();
      clearErrors();
    }, [open]);
    const disabled = disabledProps ?? processing;
    const formRef = useRef();
    const setData = useCallback(
      (...args) => {
        if (disabled) return;
        _setData(...args);
      },
      [disabled, _setData]
    );
    const onKeyDown = useCallback(
      (e) => {
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          e.stopPropagation();
          const form = formRef.current;
          if (form) {
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
            } else {
              form.dispatchEvent(new Event("submit", { cancelable: true }));
            }
          }
        }
      },
      [formRef]
    );
    const onClose = (val) => {
      setLeave(() => {
        onOpenChange(false);
        setShowAlert(false);
        setIsDirty(false);
        cancel();
        reset();
        clearErrors();
        removeFromLocalStorage(key);
      });
      setSaveAsDraft(() => {
        onOpenChange(false);
        setShowAlert(false);
        setIsDirty(false);
        clearErrors();
      });
      if (isDirty) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
        onOpenChange(val);
        setData == null ? void 0 : setData({});
        clearErrors();
      }
    };
    const _onSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (!name) return;
      const pluralized = `${pluralize.plural(name ?? "")}.store`;
      const excludedKeys = ["initalData", "method"];
      const filteredOption = Object.fromEntries(
        Object.entries(postOption ?? {}).filter(
          ([key2]) => !excludedKeys.includes(key2)
        )
      );
      const routerOption = {
        preserveScroll: true,
        preserveState: true,
        preserveUrl: true,
        replace: true,
        ...filteredOption,
        onSuccess: (e2) => {
          _setData(defaultValue ?? {});
          if (onSuccess) onSuccess(e2);
        }
      };
      switch (postOption.method) {
        case "put":
          put(route(pluralized), routerOption);
          break;
        case "patch":
          patch(route(pluralized), routerOption);
          break;
        default:
          post(route(pluralized), routerOption);
      }
    };
    useDidMountEffect(() => {
      if (recentlySuccessful) {
        onOpenChange(false);
        reset();
      }
    }, [recentlySuccessful]);
    return /* @__PURE__ */ jsx(AlertDialog, { open, children: /* @__PURE__ */ jsx(AlertDialogContent, { className: cn(className, "py-0 overflow-hidden"), children: /* @__PURE__ */ jsx(TooltipProvider, { children: /* @__PURE__ */ jsxs(
      "form",
      {
        ref: formRef,
        onKeyDown,
        onSubmit: _onSubmit,
        disabled,
        className: cn(
          "max-h-screen overflow-y-hidden flex flex-col",
          disabled && " [&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden "
        ),
        children: [
          /* @__PURE__ */ jsxs(AlertDialogHeader, { className: "pt-6 mb-4 border-b border-muted-foreground/30", children: [
            /* @__PURE__ */ jsxs(AlertDialogTitle, { className: "flex items-center mb-1 gap-x-2", children: [
              title,
              isDirty && /* @__PURE__ */ jsx("span", { className: "text-sm badge warning", children: t("core.form.not_saved") }),
              badge
            ] }),
            /* @__PURE__ */ jsx(AlertDialogDescription, { className: "sr-only" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "overflow-y-auto", children: [
            errors && Object.keys(errors).length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex-col w-full mt-4 alert error", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold", children: t("core.form.errors.title") }),
              /* @__PURE__ */ jsx("ul", { className: "block pl-5", children: Object.entries(errors).map(([key2, value]) => /* @__PURE__ */ jsx("li", { className: "list-disc", children: fieldNameTrans ? value.replace(key2, t(`${fieldNameTrans}.${key2}`)) : value }, key2)) })
            ] }),
            /* @__PURE__ */ jsx(
              FormChildren,
              {
                ref,
                disabled,
                defaultMenu,
                className,
                showHeader: false,
                errors,
                fieldNameTrans,
                data,
                setData,
                children
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(AlertDialogFooter, { className: "pb-6 mt-4", children: [
            /* @__PURE__ */ jsx(
              AlertDialogCancel,
              {
                className: "h-8",
                onClick: () => onClose(false),
                children: t("core.form.cancel")
              }
            ),
            /* @__PURE__ */ jsx(
              AlertDialogAction,
              {
                className: "h-8",
                type: "submit",
                onClick: () => {
                },
                children: t("core.form.save")
              }
            )
          ] })
        ]
      }
    ) }) }) });
  })
);
const FormPageDiff = memo(
  forwardRef(function FormPageDiff2({ title, badge, className, children }, ref) {
    const route = window.route;
    const { t } = useLaravelReactI18n();
    const { dataAfter: data, dataBefore, log, lang } = usePage().props;
    const layoutRef = useRef(null);
    const lastPositionRef = useRef(0);
    const showHeaderRef = useRef(true);
    const handleScroll = useCallback((e) => {
      var _a, _b;
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const position = Math.ceil(
        scrollTop / (scrollHeight - clientHeight) * 100
      );
      const prev = lastPositionRef.current;
      if (prev === position) return;
      lastPositionRef.current = position;
      const nextShow = position <= prev;
      if (showHeaderRef.current === nextShow) return;
      showHeaderRef.current = nextShow;
      const headerEl = (_a = layoutRef.current) == null ? void 0 : _a.querySelector("[data-header]");
      headerEl == null ? void 0 : headerEl.classList.toggle("is-hidden", !nextShow);
      const tabsEl = (_b = layoutRef.current) == null ? void 0 : _b.querySelector("[data-tabs]");
      tabsEl == null ? void 0 : tabsEl.style.setProperty("--tabs-top", nextShow ? "3.5rem" : "0px");
    }, []);
    const alias = useMemo(() => {
      return log.user.name.split(" ").slice(0, 2).map((n) => n.charAt(0)).join("");
    }, [log.user.name]);
    return /* @__PURE__ */ jsx(
      AppLayout,
      {
        "data-disabled": true,
        className: "pt-0! relative group/form",
        onScroll: handleScroll,
        children: /* @__PURE__ */ jsxs(
          "form",
          {
            onSubmit: (e) => {
              e.preventDefault();
              e.stopPropagation();
            },
            children: [
              /* @__PURE__ */ jsxs(
                "div",
                {
                  "data-header": true,
                  className: cn(
                    // showHeader ? "top-0" : "-top-16",
                    " transition-[top] duration-300 ease-in-out sticky z-10 flex items-center justify-between pt-4 pb-2 border-b gap-x-4 bg-background border-muted-foreground/25"
                  ),
                  children: [
                    /* @__PURE__ */ jsx(Head, { title }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
                      title && /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: title }),
                      badge
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "flex items-center gap-x-2 " })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "div",
                {
                  className: cn(
                    "[&_[role=title]]:pointer-events-none  [&_button[role=save]]:hidden",
                    "relative grid grid-cols-1 auto-rows-max lg:grid-rows-[auto_1fr] lg:grid-cols-[1fr_auto] flex-1 gap-4 mt-4"
                  ),
                  children: [
                    /* @__PURE__ */ jsx(
                      FormChildren,
                      {
                        ref,
                        disabled: true,
                        className,
                        dataBefore: dataBefore ?? {},
                        data: data ?? {},
                        setData: () => {
                        },
                        children
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      BottombarChildren,
                      {
                        content: /* @__PURE__ */ jsxs(Fragment, { children: [
                          /* @__PURE__ */ jsx("p", { className: "mt-8 text-xl font-bold", children: t("core.form.log_informations") }),
                          /* @__PURE__ */ jsxs("div", { className: "border border-muted-foreground/25 rounded-lg grid grid-cols-[auto_1fr] [&>div:nth-child(odd)]:bg-muted/50  [&>div>*]:py-1.5 [&>div>*]:px-4 [&>div>*:first-child]:pl-2 [&>div>*]:border-muted-foreground/25 [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25 [&>div_p]:text-sm", children: [
                            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-subgrid col-span-full", children: [
                              /* @__PURE__ */ jsx("p", { children: t("core.form.timestamp") }),
                              /* @__PURE__ */ jsx("p", { children: format(new TZDate(log.created_at, "UTC"), "PPPp", {
                                locale: getLocaleDate(lang)
                              }) })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-subgrid col-span-full", children: [
                              /* @__PURE__ */ jsx("p", { children: t("core.form.updated_by") }),
                              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-1 py-1.5 text-left text-sm", children: [
                                /* @__PURE__ */ jsxs(Avatar, { className: "rounded-lg size-20", children: [
                                  log.user.image && /* @__PURE__ */ jsx(
                                    AvatarImage,
                                    {
                                      src: route("files.preview", log.user.image) + `?v=${new Date(log.user.updated_at).getTime()}`,
                                      alt: log.user.name
                                    }
                                  ),
                                  /* @__PURE__ */ jsx(AvatarFallback, { className: "text-4xl font-semibold rounded-lg", children: alias })
                                ] }),
                                /* @__PURE__ */ jsxs("div", { className: "grid flex-1 text-base leading-tight text-left gap-y-0.5", children: [
                                  /* @__PURE__ */ jsx("span", { className: "font-semibold truncate", children: log.user.name }),
                                  /* @__PURE__ */ jsx("span", { className: "text-sm truncate text-foreground/80", children: log.user.username }),
                                  /* @__PURE__ */ jsx("div", { className: "w-fit px-2 py-0.5 rounded-full gap-x-1 items-center text-foreground/80  bg-muted", children: /* @__PURE__ */ jsx("span", { className: "text-sm truncate", children: log.user.email }) })
                                ] })
                              ] })
                            ] })
                          ] })
                        ] })
                      }
                    )
                  ]
                }
              )
            ]
          }
        )
      }
    );
  })
);
const FormPage$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  FormChildren,
  FormPage,
  FormPageContent,
  FormPageContentDescription,
  FormPageContentTitle,
  FormPageDialog,
  FormPageDiff,
  FormPageLinkModelDialog,
  useFormPage
}, Symbol.toStringTag, { value: "Module" }));
const Checkbox = React.forwardRef(({ className, readOnly, ...props }, ref) => /* @__PURE__ */ jsx(
  CheckboxPrimitive.Root,
  {
    ref,
    role: "forminput",
    className: cn(
      "group peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
      readOnly && "pointer-events-none",
      className
    ),
    ...props,
    children: /* @__PURE__ */ jsxs(
      CheckboxPrimitive.Indicator,
      {
        className: cn("flex items-center justify-center text-current"),
        children: [
          /* @__PURE__ */ jsx(Check, { className: "w-4 h-4 hidden group-data-[state=checked]:block" }),
          /* @__PURE__ */ jsx(MinusIcon, { className: "w-4 h-4 hidden group-data-[state=indeterminate]:block" })
        ]
      }
    )
  }
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
const FormCheckbox = React.forwardRef(
  ({
    id,
    checked,
    onCheckedChange,
    label,
    className,
    classNameCheckbox,
    classNameLabel,
    children,
    readOnly: _readOnly,
    ...props
  }, ref) => {
    const defaultId = React.useId();
    const { disabled } = useFormPage() ?? {};
    const readOnly = _readOnly || (disabled ?? false);
    return /* @__PURE__ */ jsxs("div", { className: cn("flex items-center space-x-2", className), children: [
      /* @__PURE__ */ jsx(
        Checkbox,
        {
          ref,
          id: id ?? defaultId,
          checked: checked ?? false,
          onCheckedChange,
          className: classNameCheckbox,
          readOnly,
          ...props
        }
      ),
      /* @__PURE__ */ jsx(
        "label",
        {
          htmlFor: id ?? defaultId,
          className: cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            classNameLabel
          ),
          children: children ?? label
        }
      )
    ] });
  }
);
FormCheckbox.displayName = "FormCheckbox";
export {
  Accordion as A,
  BadgeStatus as B,
  Checkbox as C,
  FormCheckbox as F,
  LinkModel as L,
  Textarea as T,
  UploadDialog as U,
  FormInput$1 as a,
  FormPageDialog as b,
  convertTemplateLink as c,
  AccordionItem as d,
  AccordionTrigger as e,
  AccordionContent as f,
  FormPageContent as g,
  FormPage as h,
  FormPageDiff as i,
  FormChildren as j,
  FormPageContentTitle as k,
  FormPageContentDescription as l,
  ApproverDecision$2 as m,
  FileItem$1 as n,
  FileItems$1 as o,
  FolderItem$1 as p,
  Library$1 as q,
  UploadDialog$1 as r,
  Attachments$1 as s,
  FormPage$1 as t,
  useFormPage as u
};
