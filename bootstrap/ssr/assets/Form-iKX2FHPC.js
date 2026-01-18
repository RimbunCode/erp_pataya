import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, F as FormCheckbox, a as FormInput, L as LinkModel } from "./checkbox-C_BEU5E4.js";
import { useState, useEffect } from "react";
import { k as generateRandom, g as getFonts } from "./utils-ClCZGsDL.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import PermissionLinkModel from "./PermissionLinkModel-Cy7R6yf4.js";
import { S as Select } from "./Select-DB9toH_t.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
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
import "lodash";
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
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
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
function Form() {
  const [fonts, setFonts] = useState([]);
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  useEffect(() => {
    const fn = async () => {
      const fonts2 = await getFonts();
      setFonts(fonts2);
    };
    fn();
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { title: null, value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-3 gap-y-4", children: [
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data.is_letter_head,
          onCheckedChange: (val) => setData("is_letter_head", val),
          label: t("core.printTemplate.columns.is_letter_head")
        }
      ),
      !data.is_letter_head && /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("core.printTemplate.columns.model"),
          children: /* @__PURE__ */ jsx(
            PermissionLinkModel,
            {
              required: true,
              placeholder: t("core.printTemplate.columns.model.placeholder"),
              value: data.permission,
              onValueChange: (val) => setData((prev) => ({
                ...prev,
                permission: val,
                model: val == null ? void 0 : val.model,
                name: val ? `${val.name}_${generateRandom(5).toLowerCase()}` : ""
              })),
              filters: {
                is_submitable: true
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("core.printTemplate.columns.name"),
          children: /* @__PURE__ */ jsx(
            Input,
            {
              value: (data == null ? void 0 : data.name) ?? "",
              onValueChange: (e) => setData("name", e)
            }
          )
        }
      ),
      !data.is_letter_head && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          FormInput,
          {
            label: t("core.printTemplate.columns.default_languange"),
            children: /* @__PURE__ */ jsx(
              Select,
              {
                value: (data == null ? void 0 : data.default_languange) ?? "",
                onValueChange: (e) => setData("default_languange", e),
                options: ["en", "id"],
                optionTrans: "core.printTemplate.columns.default_languange.options"
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(FormInput, { label: t("core.printTemplate.columns.letter_head"), children: /* @__PURE__ */ jsx(
          LinkModel,
          {
            model: "App\\Models\\Core\\PrintTemplate",
            value: (data == null ? void 0 : data.letter_head) ?? "",
            onValueChange: (e) => setData("letter_head", e),
            disabledAddButton: true,
            defaultValue: {
              is_default: true
            },
            filters: {
              id: {
                not: data == null ? void 0 : data.id
              },
              is_letter_head: true
            }
          }
        ) })
      ] }),
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data.is_default,
          onCheckedChange: (val) => setData("is_default", val),
          label: t("core.printTemplate.columns.is_default")
        }
      )
    ] }) }),
    !data.is_letter_head && /* @__PURE__ */ jsx(
      FormPageContent,
      {
        title: t("core.printTemplate.style_settings"),
        value: "detail",
        children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsx(FormInput, { label: t("core.printTemplate.columns.paper"), required: true, children: /* @__PURE__ */ jsx(
            Select,
            {
              defaultValue: "A4",
              value: (data == null ? void 0 : data.paper) ?? "",
              onValueChange: (paper) => {
                setData((prev) => {
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
                  value: (data == null ? void 0 : data.orientation) ?? "",
                  onValueChange: (val) => {
                    setData((prev) => ({
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
                  value: (data == null ? void 0 : data.font_family) ?? "",
                  onValueChange: (e) => setData("font_family", e),
                  options: fonts
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(FormInput, { required: true, label: t("core.printTemplate.columns.unit"), children: /* @__PURE__ */ jsx(
            Select,
            {
              defaultValue: "cm",
              value: (data == null ? void 0 : data.unit) ?? "",
              options: Object.values(units),
              onValueChange: (unit) => {
                setData((prev) => {
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
                  value: (data == null ? void 0 : data.page_number) ?? "",
                  onValueChange: (e) => setData("page_number", e),
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
          (data == null ? void 0 : data.page_number) && (data == null ? void 0 : data.page_number) != "hide" && /* @__PURE__ */ jsx(
            FormInput,
            {
              required: true,
              label: t("core.printTemplate.columns.page_number_format"),
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: (data == null ? void 0 : data.page_number_format) || ":page / :total",
                  onValueChange: (e) => setData("page_number_format", e)
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "grid col-span-full grid-cols-subgrid gap-y-4 border-y pt-8 pb-4", children: [
            /* @__PURE__ */ jsx(
              FormInput,
              {
                disabled: !data.unit,
                required: true,
                label: t("core.printTemplate.columns.width"),
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-left",
                    value: (data == null ? void 0 : data.width) ?? "",
                    onValueChange: (val) => {
                      setData((prev) => {
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
                disabled: !data.unit,
                required: true,
                label: t("core.printTemplate.columns.height"),
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-left",
                    value: (data == null ? void 0 : data.height) ?? "",
                    onValueChange: (val) => {
                      setData((prev) => {
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
                disabled: !data.unit,
                required: true,
                label: t("core.printTemplate.columns.margin_top"),
                className: "col-start-1",
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-left",
                    value: (data == null ? void 0 : data.margin_top) ?? "",
                    onValueChange: (e) => setData("margin_top", e),
                    options: ["potrait", "landscape"]
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                disabled: !data.unit,
                required: true,
                label: t("core.printTemplate.columns.margin_bottom"),
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-left",
                    value: (data == null ? void 0 : data.margin_bottom) ?? "",
                    onValueChange: (e) => setData("margin_bottom", e),
                    options: ["potrait", "landscape"]
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                disabled: !data.unit,
                required: true,
                label: t("core.printTemplate.columns.margin_left"),
                className: "col-start-1",
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-left",
                    value: (data == null ? void 0 : data.margin_left) ?? "",
                    onValueChange: (e) => setData("margin_left", e),
                    options: ["potrait", "landscape"]
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                disabled: !data.unit,
                required: true,
                label: t("core.printTemplate.columns.margin_right"),
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-left",
                    value: (data == null ? void 0 : data.margin_right) ?? "",
                    onValueChange: (e) => setData("margin_right", e),
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
                checked: data.show_absolute_values,
                onCheckedChange: (val) => setData("show_absolute_values", val),
                label: t("core.printTemplate.columns.show_absolute_values")
              }
            ),
            /* @__PURE__ */ jsx("p", { className: "text-foreground/75 mt-3", children: t(
              "core.printTemplate.columns.show_absolute_values.description"
            ) })
          ] })
        ] })
      }
    )
  ] });
}
export {
  Form as default
};
