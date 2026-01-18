import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { C as Checkbox, u as useFormPage, g as FormPageContent, a as FormInput, k as FormPageContentTitle } from "./checkbox-C_BEU5E4.js";
import { M as MentionsInput, a as Mention } from "./Mention-CB0VqwkR.js";
import { forwardRef, useState, useRef, useCallback, useEffect, memo, useMemo } from "react";
import { usePage, WhenVisible } from "@inertiajs/react";
import AttributeLinkModel from "./AttributeLinkModel-ED6Z3erq.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import FormBarcodes from "./FormBarcodes-BWe8Q1fd.js";
import FormDetail from "./FormDetail-Qe3HBKif.js";
import FormStockLevels from "./FormStockLevels-Dn2rbyo9.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import { b as useDidMountEffect, L as Link } from "./Link-p0Z4AKax.js";
import { L as LoadingIcon } from "./LoadingIcon-CRleOEtX.js";
import { C as Command, a as CommandList, b as CommandEmpty, c as CommandItem } from "./command-BSnyCa9u.js";
import { P as Popover, a as PopoverTrigger, b as PopoverContent } from "./popover-CziqY8mR.js";
import { f as isNullOrWhitespace, c as cn } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { XIcon } from "lucide-react";
import { useDetectClickOutside } from "react-detect-click-outside";
import { useLaravelReactI18n } from "laravel-react-i18n";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import axios from "axios";
import "@radix-ui/react-checkbox";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-dialog";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "radix-ui";
import "cmdk";
import "lodash";
import "pluralize";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@inertiajs/core";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "react-mentions";
import "./Form-Cvx0UpcU.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./useDynamicRefs-DuDlSZ7v.js";
import "@radix-ui/react-popover";
import "./Form-C_ygZCFM.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
const MultiSelect = forwardRef(function MultiSelect2({
  value,
  onValueChange,
  className,
  disabled,
  readOnly,
  onKeyDown,
  required,
  placeholder,
  options: optionsProps
}, ref) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);
  const [search, _setSearch] = useState("");
  const [values, _setValues] = useState(value ?? []);
  const [options, setOptions] = useState(optionsProps);
  const commandRef = useRef();
  const popoverRef = useDetectClickOutside({
    onTriggered: () => {
      setOpen(false);
    }
  });
  const convertValues = useCallback(
    (values2) => {
      const options2 = optionsProps == null ? void 0 : optionsProps.filter((opt) => values2.includes(opt.value)).map((opt) => opt.label);
      return (options2 == null ? void 0 : options2.join(", ")) ?? "";
    },
    [options]
  );
  const setSearch = useCallback(
    (search2) => {
      _setSearch(search2);
      if (!isNullOrWhitespace(search2)) {
        const keywords = search2.split(",").map((s) => s.replace(/\s/g, "").toLowerCase());
        const options2 = optionsProps == null ? void 0 : optionsProps.filter((opt) => {
          var _a;
          const lowerOpt = (_a = opt.label) == null ? void 0 : _a.toString().toLowerCase();
          return keywords.some((keyword) => lowerOpt.includes(keyword));
        });
        const values2 = optionsProps == null ? void 0 : optionsProps.filter((opt) => {
          var _a;
          const lowerOpt = (_a = opt.label) == null ? void 0 : _a.toString().toLowerCase();
          return keywords.some((keyword) => lowerOpt == keyword);
        }).map((x) => x.value);
        setValues(values2);
        setOptions(options2);
      } else {
        setOptions(optionsProps);
      }
    },
    [optionsProps]
  );
  useDidMountEffect(() => {
    _setValues(value ?? []);
  }, [value]);
  const setValues = useCallback(
    (val) => {
      _setValues(val);
      onValueChange == null ? void 0 : onValueChange(val);
    },
    [onValueChange, _setValues]
  );
  const onChecked = useCallback(
    (val, checked) => {
      setValues((prev) => {
        const isNumber = Number(val);
        val = !isNaN(isNumber) ? isNumber : val.toString();
        if (checked == null || checked === true) {
          const included = prev == null ? void 0 : prev.includes(val);
          if (included && checked === true) return prev;
          checked = !included;
        }
        const newValues = checked ? [...prev ?? [], val] : (prev ?? []).filter((x) => x !== val);
        setSearch(
          newValues && newValues.length > 0 ? convertValues(newValues) + ", " : ""
        );
        return newValues;
      });
    },
    [values, setValues]
  );
  useEffect(() => {
    if (!open) {
      setSearch(convertValues(values));
    } else {
      setSearch(
        values && values.length > 0 ? convertValues(values) + ", " : ""
      );
    }
  }, [open]);
  const onInputKeyDown = useCallback(
    (e) => {
      if (e.key == "Enter" && open) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.key == "Tab" || e.key == "Enter") {
        onKeyDown == null ? void 0 : onKeyDown(e);
        return;
      }
      if (readOnly || disabled) return;
      if (!open) {
        setOpen(true);
      }
    },
    [open, readOnly, disabled, onKeyDown]
  );
  return /* @__PURE__ */ jsx(Popover, { open, onOpenChange: () => {
  }, children: /* @__PURE__ */ jsxs(
    Command,
    {
      ref: commandRef,
      className: "relative h-auto overflow-visible bg-transparent",
      loop: true,
      shouldFilter: true,
      onKeyDown: (e) => {
        var _a;
        const item = (_a = popoverRef.current) == null ? void 0 : _a.querySelector(
          `[cmdk-item=""][data-selected="true"]`
        );
        const value2 = item == null ? void 0 : item.getAttribute("data-value");
        if (!value2 || e.key !== "Enter") return;
        e.preventDefault();
        e.stopPropagation();
        onChecked(value2);
      },
      children: [
        /* @__PURE__ */ jsx(
          PopoverTrigger,
          {
            asChild: true,
            className: cn(
              "flex h-8 overflow-hidden border rounded-md cursor-default group/model rrelative focus-within:border-0 border-input ring-offset-background bg-muted focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
              className
            ),
            children: /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(
                Input,
                {
                  ref,
                  disabled,
                  readOnly,
                  onKeyDown: onInputKeyDown,
                  required,
                  value: search,
                  onDoubleClick: (e) => {
                    e.preventDefault();
                    setOpen(true);
                  },
                  onChange: (e) => {
                    setSearch(e.target.value);
                  },
                  className: cn(
                    "focus:border-0! bg-inherit! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  "
                  ),
                  placeholder
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "flex items-center h-8 pr-2 gap-x-2", children: /* @__PURE__ */ jsx(
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
                    _setValues([]);
                    setSearch("");
                  },
                  children: /* @__PURE__ */ jsx(XIcon, { className: "size-3" })
                }
              ) })
            ] })
          }
        ),
        !(disabled || readOnly) && /* @__PURE__ */ jsx(
          PopoverContent,
          {
            onOpenAutoFocus: (e) => e.preventDefault(),
            ref: popoverRef,
            align: "start",
            side: "bottom",
            className: "relative z-50  w-(--radix-popover-trigger-width) p-0 ",
            forceMount: true,
            asChild: true,
            children: /* @__PURE__ */ jsxs(CommandList, { className: "p-1 space-y-2", children: [
              /* @__PURE__ */ jsx(CommandEmpty, { children: t("core.form.not_found") }),
              options && (options == null ? void 0 : options.map((opt) => {
                return /* @__PURE__ */ jsx(
                  CommandItem,
                  {
                    value: opt.value,
                    onSelect: () => {
                      setOpen(true);
                    },
                    asChild: true,
                    children: /* @__PURE__ */ jsxs(
                      "label",
                      {
                        htmlFor: `${opt.value}-checkbox`,
                        className: "flex items-center space-x-2",
                        children: [
                          /* @__PURE__ */ jsx(
                            Checkbox,
                            {
                              id: `${opt.value}-checkbox`,
                              checked: values == null ? void 0 : values.includes(opt.value),
                              onCheckedChange: (val) => onChecked(opt.value, val)
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              htmlFor: `${opt.value}-checkbox`,
                              className: "flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                              children: opt.label
                            }
                          )
                        ]
                      }
                    )
                  },
                  opt.value
                );
              }))
            ] })
          }
        )
      ]
    }
  ) });
});
const Form = memo(function Form2() {
  var _a, _b;
  const { dataBefore = {}, data, setData, disabled } = useFormPage();
  const { item, variants } = usePage().props;
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const [formatVariantSelected, setFormatVariantSelected] = useState([]);
  const [listFormatVariant, setListFormatVariant] = useState([]);
  useEffect(() => {
    var _a2;
    const list = [
      { id: "item", display: "Item Code" },
      ...((_a2 = data == null ? void 0 : data.attributes) == null ? void 0 : _a2.map((x) => {
        var _a3, _b2;
        return {
          id: (_a3 = x.attribute) == null ? void 0 : _a3.id,
          display: (_b2 = x.attribute) == null ? void 0 : _b2.name
        };
      })) ?? []
    ].filter(
      (x) => !formatVariantSelected.some(
        (y) => y.display.replace(/^\{(.*?)\}$/g, "$1") == x.display
      )
    );
    console.log(list);
    setListFormatVariant(list);
  }, [data.attributes, formatVariantSelected]);
  const getUnits = useCallback((group) => {
    axios.post(route("model"), {
      model: "App\\Models\\Inventory\\Unit",
      filters: {
        group
      }
    }).then((res) => {
      var _a2;
      setData(
        "uoms",
        (_a2 = res.data.data) == null ? void 0 : _a2.map((x) => ({
          ...x,
          readOnly: x.conversion_factor,
          isCustom: !x.conversion_factor
        }))
      );
    }).catch((err) => {
      console.log(err);
    });
  }, []);
  useDidMountEffect(() => {
    var _a2, _b2;
    if (data.default_unit) {
      if (((_b2 = (_a2 = data.uoms) == null ? void 0 : _a2.at(0)) == null ? void 0 : _b2.group) == data.default_unit.group) return;
      getUnits(data.default_unit.group);
    } else {
      setData("uoms", []);
    }
  }, [data.default_unit]);
  const uomColumns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "inventory.unit.unit",
        required: true,
        cell({ dataRow, setData: setData2, attributes }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              value: dataRow,
              ...attributes,
              filters: {
                group: (_a2 = data == null ? void 0 : data.default_unit) == null ? void 0 : _a2.group,
                ...dataRow.readOnly ? {} : { conversion_factor: null }
              },
              defaultValueForm: {
                group: (_b2 = data == null ? void 0 : data.default_unit) == null ? void 0 : _b2.group
              },
              onValueChange: (value) => {
                if (!value) return;
                setData2({
                  ...value,
                  isCustom: !(value == null ? void 0 : value.conversion_factor)
                });
              }
            }
          );
        }
      },
      {
        name: "conversion_factor",
        titleTrans: "inventory.unit.columns.conversion_factor",
        required: true,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              ...attributes,
              disabled: !(dataRow == null ? void 0 : dataRow.code),
              readOnly: attributes.disabled || dataRow.readOnly && !dataRow.isCustom,
              value: data2,
              onValueChange: (value) => {
                setData2("conversion_factor", value);
              }
            }
          );
        }
      }
    ],
    [(_a = data.default_unit) == null ? void 0 : _a.group]
  );
  const variantColumns = useMemo(
    () => [
      {
        name: "attribute",
        titleTrans: "inventory.item.columns.attribute",
        required: true,
        unique: true,
        cell({ dataRow, attributes, setData: setData2 }) {
          return /* @__PURE__ */ jsx(
            AttributeLinkModel,
            {
              onValueChange: (val) => {
                setData2("attribute", val);
              },
              placeholder: t("inventory.item.columns.attribute.placeholder"),
              value: dataRow.attribute,
              ...attributes
            }
          );
        }
      },
      {
        name: "values",
        titleTrans: "inventory.item.columns.attribute_values",
        required: true,
        cell({ dataRow, attributes, setData: setData2 }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            MultiSelect,
            {
              value: dataRow.values,
              onValueChange: (val) => {
                setData2("values", val);
              },
              options: (_b2 = (_a2 = dataRow.attribute) == null ? void 0 : _a2.values) == null ? void 0 : _b2.map((x) => {
                return { label: x.value, value: x.value };
              }),
              ...attributes
            }
          );
        }
      }
    ],
    []
  );
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormDetail, { dataBefore, data, setData }),
    /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        title: t("inventory.item.menu.variants"),
        value: "variants",
        children: [
          /* @__PURE__ */ jsx(
            FormTable,
            {
              name: "variants",
              disabled,
              columns: variantColumns,
              value: data.attributes ?? [],
              onValueChange: (val) => {
                setData("attributes", val);
              }
            }
          ),
          (data == null ? void 0 : data.attributes) && ((_b = data == null ? void 0 : data.attributes) == null ? void 0 : _b.length) > 0 && /* @__PURE__ */ jsx(
            FormInput,
            {
              className: "max-w-sm mt-4",
              label: t("inventory.item.columns.format_variant"),
              required: true,
              children: /* @__PURE__ */ jsx(
                MentionsInput,
                {
                  singleLine: true,
                  value: (data == null ? void 0 : data.format_variant) ?? "",
                  onChange: (_, value, __, mentions) => {
                    setFormatVariantSelected(mentions);
                    setData("format_variant", value);
                  },
                  className: "mentions",
                  placeholder: t(
                    "inventory.item.columns.format_variant.placeholder"
                  ),
                  a11ySuggestionsListLabel: "Suggested mentions",
                  allowSuggestionsAboveCursor: true,
                  autoComplete: "off",
                  children: /* @__PURE__ */ jsx(
                    Mention,
                    {
                      trigger: /(\{([^{]*))$/,
                      data: listFormatVariant,
                      displayTransform: (x, display) => "{" + display + "}"
                    }
                  )
                }
              )
            }
          )
        ]
      }
    ),
    variants && variants.length > 0 && /* @__PURE__ */ jsx(
      FormPageContent,
      {
        title: t("inventory.item.menu.variants"),
        value: "variants",
        collapsible: true,
        children: /* @__PURE__ */ jsx(
          WhenVisible,
          {
            data: ["variants"],
            fallback: () => /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4", children: [
              /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
              /* @__PURE__ */ jsxs("span", { children: [
                t("core.form.loading"),
                " ..."
              ] })
            ] }),
            children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[2fr_auto_auto_auto] gap-x-6 *:px-4 border rounded-md", children: [
              /* @__PURE__ */ jsxs("div", { className: "grid py-1 border-b rounded-t-md bg-muted border-muted-foreground/25 grid-cols-subgrid col-span-full", children: [
                /* @__PURE__ */ jsx("span", { className: "flex items-center justify-start font-bold text-center", children: t("inventory.item.columns.sku") }),
                /* @__PURE__ */ jsx("span", { className: "flex items-center justify-start font-bold text-center", children: t("inventory.item.columns.allow_alternative_item") }),
                /* @__PURE__ */ jsx("span", { className: "flex items-center justify-start font-bold text-center", children: t("inventory.item.columns.is_disabled.parse.false") }),
                /* @__PURE__ */ jsx("span", { className: "flex items-center justify-start font-bold text-center", children: t("inventory.item.columns.total_stock") })
              ] }),
              variants.map((variant) => /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "grid py-2 border-b last:rounded-b-md border-muted-foreground/25 grid-cols-subgrid col-span-full",
                  children: [
                    variant.sku ? /* @__PURE__ */ jsx(
                      Link,
                      {
                        className: "hover:underline",
                        href: route("itemVariants.show", {
                          itemVariant: variant.id
                        }),
                        children: variant.sku || item.code
                      }
                    ) : /* @__PURE__ */ jsx("span", { className: "flex items-center justify-start", children: item.code }),
                    /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(
                      Checkbox,
                      {
                        id: "allow_alternative_item",
                        checked: variant.allow_alternative_item == null ? "indeterminate" : variant.allow_alternative_item === true,
                        disabled: true
                      }
                    ) }),
                    /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(
                      Checkbox,
                      {
                        id: "allow_alternative_item",
                        checked: variant.disabled == null ? "indeterminate" : variant.disabled === false,
                        disabled: true
                      }
                    ) }),
                    /* @__PURE__ */ jsx("span", { className: "px-2 text-center", children: variant.total_stock })
                  ]
                },
                variant.id
              ))
            ] })
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(FormBarcodes, { disabled }),
    item && !(item.attributes && item.attributes.length > 0) && !disabled && /* @__PURE__ */ jsx(FormStockLevels, {}),
    /* @__PURE__ */ jsxs(FormPageContent, { title: t("inventory.item.menu.uom"), value: "detail", children: [
      /* @__PURE__ */ jsx(FormPageContentTitle, { children: t("inventory.item.menu.uom") }),
      /* @__PURE__ */ jsx(
        FormTable,
        {
          name: "uoms",
          columns: uomColumns,
          value: data.uoms ?? [],
          onValueChange: useCallback((val) => setData("uoms", val), [])
        }
      )
    ] })
  ] });
});
export {
  Form as default
};
