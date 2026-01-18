import { jsx, jsxs } from "react/jsx-runtime";
import { Edit2Icon, PrinterIcon } from "lucide-react";
import { c as cn, g as getFonts } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n, LaravelReactI18nProvider } from "laravel-react-i18n";
import { useRef, useState, useEffect, useCallback } from "react";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import { A as AppLayout } from "./AppLayout-Drqdr6Z-.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { a as FormInput, L as LinkModel, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import PrintPreview from "./PrintPreview-CrLWtfMZ.js";
import { S as Select } from "./Select-DB9toH_t.js";
import { useForm } from "@inertiajs/react";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@radix-ui/react-tooltip";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "class-variance-authority";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
import "zustand";
import "radix-ui";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "@radix-ui/react-checkbox";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
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
import "@inertiajs/core";
import "handlebars";
import "./initHandlebar-DkcLBbFK.js";
function Kbd({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "kbd",
    {
      "data-slot": "kbd",
      className: cn(
        "bg-muted text-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-muted-foreground dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className
      ),
      ...props
    }
  );
}
function KbdGroup({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "kbd",
    {
      "data-slot": "kbd-group",
      className: cn("inline-flex items-center gap-1", className),
      ...props
    }
  );
}
const paperSize = {
  A4: {
    width: 210,
    height: 297
  },
  A5: {
    width: 148,
    height: 210
  },
  Letter: {
    width: 215.9,
    height: 279.4
  },
  Legal: {
    width: 215.9,
    height: 355.6
  },
  Tabloid: {
    width: 279.4,
    height: 431.8
  },
  // Umum dipakai di Indonesia sebagai 210 x 330 mm
  F4: {
    width: 210,
    height: 330
  }
};
const units = {
  in: {
    value: "in",
    label: "Inch",
    conversion_factor: 25.4
  },
  cm: {
    value: "cm",
    label: "Centimeter",
    conversion_factor: 10
  },
  mm: {
    value: "mm",
    label: "Millimeter",
    conversion_factor: 1
  }
};
function Print({ data: _data, printTemplate }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data: template, setData: setTemplate } = useForm(printTemplate);
  const frame = useRef();
  const [fonts, setFonts] = useState([]);
  useEffect(() => {
    const fn = async () => {
      const fonts2 = await getFonts();
      setFonts(fonts2);
    };
    fn();
  }, []);
  const onKeyDown = useCallback(
    (e) => {
      e.stopPropagation();
      if (e.ctrlKey && e.key == "p") {
        e.preventDefault();
        frame.current.contentWindow.print();
      }
    },
    [frame]
  );
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown]);
  return /* @__PURE__ */ jsxs(AppLayout, { className: "print:p-0", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center border-b justify-between py-2 mb-4 bg-background", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold", children: t("core.form.print_preview") }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-4", children: [
        /* @__PURE__ */ jsx(Button, { variant: "outline", asChild: true, children: /* @__PURE__ */ jsxs(Link, { href: route("printTemplates.editor", template.id), children: [
          /* @__PURE__ */ jsx(Edit2Icon, {}),
          t("core.form.edit_template")
        ] }) }),
        /* @__PURE__ */ jsxs(Tooltip, { children: [
          /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
            Button,
            {
              type: "button",
              className: "p-2! size-fit h-8",
              onClick: () => frame.current.contentWindow.print(),
              children: [
                /* @__PURE__ */ jsx(PrinterIcon, {}),
                t("core.form.print")
              ]
            }
          ) }),
          /* @__PURE__ */ jsx(TooltipContent, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            "Print Document",
            /* @__PURE__ */ jsxs(KbdGroup, { children: [
              /* @__PURE__ */ jsx(Kbd, { children: "Ctrl" }),
              /* @__PURE__ */ jsx("span", { children: "+" }),
              /* @__PURE__ */ jsx(Kbd, { children: "P" })
            ] })
          ] }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "h-full flex lg:flex-row flex-col gap-y-4 overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "lg:border-r lg:mr-4 lg:px-4 lg:h-full static top-0 overflow-y-auto overflow-x-hidden lg:max-w-2xs", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-4 h-auto w-full grid-cols-1", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid col-span-full grid-cols-subgrid gap-y-4 border-b py-4", children: [
          /* @__PURE__ */ jsx(FormInput, { label: t("core.printTemplate.columns.languange"), children: /* @__PURE__ */ jsx(
            Select,
            {
              value: (template == null ? void 0 : template.default_languange) ?? "",
              onValueChange: (e) => setTemplate("default_languange", e),
              options: ["en", "id"],
              optionTrans: "core.printTemplate.columns.default_languange.options"
            }
          ) }),
          /* @__PURE__ */ jsx(FormInput, { label: t("core.printTemplate.columns.letter_head"), children: /* @__PURE__ */ jsx(
            LinkModel,
            {
              model: "App\\Models\\Core\\PrintTemplate",
              value: (template == null ? void 0 : template.letter_head) ?? "",
              onValueChange: (e) => setTemplate("letter_head", e),
              disabledAddButton: true,
              defaultValue: {
                is_default: true
              },
              filters: {
                is_letter_head: true
              }
            }
          ) })
        ] }),
        /* @__PURE__ */ jsx(FormInput, { label: t("core.printTemplate.columns.paper"), required: true, children: /* @__PURE__ */ jsx(
          Select,
          {
            defaultValue: "A4",
            value: (template == null ? void 0 : template.paper) ?? "",
            onValueChange: (paper) => {
              setTemplate((prev) => {
                var _a, _b, _c;
                const conversion_factor = ((_a = units[prev.unit]) == null ? void 0 : _a.conversion_factor) ?? 1;
                const widthOri = ((_b = paperSize[paper]) == null ? void 0 : _b.width) / conversion_factor;
                const heightOri = ((_c = paperSize[paper]) == null ? void 0 : _c.height) / conversion_factor;
                const width = paper != "custom" ? widthOri : prev == null ? void 0 : prev.width;
                const height = paper != "custom" ? heightOri : prev == null ? void 0 : prev.height;
                return {
                  ...prev,
                  paper,
                  width: prev.orientation == "portrait" ? width : height,
                  height: prev.orientation == "portrait" ? height : width
                };
              });
            },
            options: [
              {
                value: "A4",
                label: "A4"
              },
              {
                value: "A5",
                label: "A5"
              },
              {
                value: "Letter",
                label: "Letter"
              },
              {
                value: "Legal",
                label: "Legal"
              },
              {
                value: "Tabloid",
                label: "Tabloid"
              },
              {
                value: "F4",
                label: "F4"
              },
              {
                value: "custom",
                label: t("core.printTemplate.columns.paper.options.custom")
              }
            ]
          }
        ) }),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("core.printTemplate.columns.orientation"),
            children: /* @__PURE__ */ jsx(
              Select,
              {
                defaultValue: "portrait",
                value: (template == null ? void 0 : template.orientation) ?? "",
                onValueChange: (val) => {
                  setTemplate((prev) => ({
                    ...prev,
                    orientation: val,
                    width: val == "portrait" ? prev.width : prev.height,
                    height: val == "portrait" ? prev.height : prev.width
                  }));
                },
                options: ["portrait", "landscape"],
                optionTrans: "core.printTemplate.columns.orientation.options"
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("core.printTemplate.columns.font_family"),
            children: /* @__PURE__ */ jsx(
              Select,
              {
                defaultValue: "Times New Roman",
                value: (template == null ? void 0 : template.font_family) ?? "",
                onValueChange: (e) => setTemplate("font_family", e),
                options: fonts
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(FormInput, { required: true, label: t("core.printTemplate.columns.unit"), children: /* @__PURE__ */ jsx(
          Select,
          {
            defaultValue: "cm",
            value: (template == null ? void 0 : template.unit) ?? "",
            options: Object.values(units),
            onValueChange: (unit) => {
              setTemplate((prev) => {
                var _a, _b, _c, _d;
                const last_conversion_factor = ((_a = units[prev.unit ?? ""]) == null ? void 0 : _a.conversion_factor) ?? prev.last_conversion_factor;
                const conversion_factor = ((_b = units[unit ?? ""]) == null ? void 0 : _b.conversion_factor) ?? null;
                const width = prev.paper == "custom" ? prev.width * (last_conversion_factor / conversion_factor) : ((_c = paperSize[prev == null ? void 0 : prev.paper]) == null ? void 0 : _c.width) / conversion_factor * 100 / 100;
                const height = prev.paper == "custom" ? prev.height * (last_conversion_factor / conversion_factor) : ((_d = paperSize[prev == null ? void 0 : prev.paper]) == null ? void 0 : _d.height) / conversion_factor * 100 / 100;
                const margin_top = prev.margin_top * (last_conversion_factor / conversion_factor);
                const margin_bottom = prev.margin_bottom * (last_conversion_factor / conversion_factor);
                const margin_left = prev.margin_left * (last_conversion_factor / conversion_factor);
                const margin_right = prev.margin_right * (last_conversion_factor / conversion_factor);
                return {
                  ...prev,
                  unit,
                  last_conversion_factor: conversion_factor,
                  width: width ?? (prev == null ? void 0 : prev.width),
                  height: height ?? (prev == null ? void 0 : prev.height),
                  margin_top,
                  margin_bottom,
                  margin_left,
                  margin_right
                };
              });
            }
          }
        ) }),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("core.printTemplate.columns.page_number"),
            children: /* @__PURE__ */ jsx(
              Select,
              {
                defaultValue: "bottom_right",
                value: (template == null ? void 0 : template.page_number) ?? "",
                onValueChange: (e) => setTemplate("page_number", e),
                options: [
                  "hide",
                  "top_left",
                  "top_center",
                  "top_right",
                  "bottom_left",
                  "bottom_center",
                  "bottom_right"
                ],
                optionTrans: "core.printTemplate.columns.page_number.options"
              }
            )
          }
        ),
        (template == null ? void 0 : template.page_number) && (template == null ? void 0 : template.page_number) != "hide" && /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("core.printTemplate.columns.page_number_format"),
            children: /* @__PURE__ */ jsx(
              Input,
              {
                value: (template == null ? void 0 : template.page_number_format) || ":page / :total",
                onValueChange: (e) => setTemplate("page_number_format", e)
              }
            )
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "grid col-span-full grid-cols-subgrid gap-y-4 border-y pt-8 pb-4", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !template.unit,
              required: true,
              label: t("core.printTemplate.columns.width"),
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-left",
                  value: (template == null ? void 0 : template.width) ?? "",
                  onValueChange: (val) => {
                    setTemplate((prev) => {
                      var _a;
                      return {
                        ...prev,
                        width: val,
                        paper: val != ((_a = paperSize[prev.paper]) == null ? void 0 : _a.width) ? "custom" : prev.paper,
                        orientation: val > prev.height ? "landscape" : "potrait"
                      };
                    });
                  },
                  options: ["potrait", "landscape"]
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !template.unit,
              required: true,
              label: t("core.printTemplate.columns.height"),
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-left",
                  value: (template == null ? void 0 : template.height) ?? "",
                  onValueChange: (val) => {
                    setTemplate((prev) => {
                      var _a;
                      return {
                        ...prev,
                        height: val,
                        paper: val != ((_a = paperSize[prev.paper]) == null ? void 0 : _a.height) ? "custom" : prev.paper,
                        orientation: val >= prev.width ? "portrait" : "landscape"
                      };
                    });
                  },
                  options: ["potrait", "landscape"]
                }
              )
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid col-span-full grid-cols-subgrid gap-y-4 border-b py-4", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !template.unit,
              required: true,
              label: t("core.printTemplate.columns.margin_top"),
              className: "col-start-1",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-left",
                  value: (template == null ? void 0 : template.margin_top) ?? "",
                  onValueChange: (e) => setTemplate("margin_top", e),
                  options: ["potrait", "landscape"]
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !template.unit,
              required: true,
              label: t("core.printTemplate.columns.margin_bottom"),
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-left",
                  value: (template == null ? void 0 : template.margin_bottom) ?? "",
                  onValueChange: (e) => setTemplate("margin_bottom", e),
                  options: ["potrait", "landscape"]
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !template.unit,
              required: true,
              label: t("core.printTemplate.columns.margin_left"),
              className: "col-start-1",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-left",
                  value: (template == null ? void 0 : template.margin_left) ?? "",
                  onValueChange: (e) => setTemplate("margin_left", e),
                  options: ["potrait", "landscape"]
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !template.unit,
              required: true,
              label: t("core.printTemplate.columns.margin_right"),
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-left",
                  value: (template == null ? void 0 : template.margin_right) ?? "",
                  onValueChange: (e) => setTemplate("margin_right", e),
                  options: ["potrait", "landscape"]
                }
              )
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(
            FormCheckbox,
            {
              checked: template.show_absolute_values,
              onCheckedChange: (val) => setTemplate("show_absolute_values", val),
              label: t("core.printTemplate.columns.show_absolute_values")
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "text-foreground/75 mt-3", children: t(
            "core.printTemplate.columns.show_absolute_values.description"
          ) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "h-full overflow-auto w-full flex-shrink-1", children: /* @__PURE__ */ jsx("div", { className: "bg-muted p-8 h-fit! w-fit! rounded-lg mx-auto", children: /* @__PURE__ */ jsx(
        LaravelReactI18nProvider,
        {
          locale: template.default_languange,
          fallbackLocale: "en",
          files: /* @__PURE__ */ Object.assign({ "/lang/php_en.json": () => import("./php_en-D1fItnaV.js"), "/lang/php_id.json": () => import("./php_id-DC1XGTL1.js") }),
          children: /* @__PURE__ */ jsx(PrintPreview, { ref: frame, template })
        }
      ) }) })
    ] })
  ] });
}
export {
  Print as default
};
