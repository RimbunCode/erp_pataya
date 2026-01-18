import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, k as FormPageContentTitle, a as FormInput, F as FormCheckbox, l as FormPageContentDescription } from "./checkbox-C_BEU5E4.js";
import { useState, useCallback, useEffect } from "react";
import { ArrowLeftRightIcon } from "lucide-react";
import { B as Button } from "./button-Us2TB7GG.js";
import { C as Combobox } from "./Combobox-CnMmTQqc.js";
import { c as CommandItem } from "./command-BSnyCa9u.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import QueryString from "qs";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-checkbox";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
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
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "cmdk";
import "./LoadingIcon-CRleOEtX.js";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
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
import "./drawer-D3vDykaS.js";
import "vaul";
function Form() {
  var _a, _b, _c, _d;
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [units, setUnits] = useState([]);
  const [unitSelected, setUnitSelected] = useState({ from: null, to: data });
  const [groups, setGroups] = useState([]);
  const [searchGroup, setSearchGroup] = useState();
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const loadGroups = useCallback((search) => {
    axios.get(route("units.groups", search ?? "")).then((res) => {
      setGroups(res.data);
    }).catch((err) => {
      console.log(err);
    });
  }, []);
  const loadUnits = useCallback((group) => {
    axios.get(
      `${route("units.index")}?${QueryString.stringify({ group, except: data.id })}`
    ).then((res) => {
      setUnits(res.data);
    }).catch((err) => {
      console.log(err);
    });
  }, []);
  const swapPlayground = useCallback(() => {
    setUnitSelected((prev) => ({
      from: prev.to,
      to: prev.from
    }));
    const fromTemp = fromValue;
    const toTemp = toValue;
    setToValue(fromTemp);
    setFromValue(toTemp);
  }, [fromValue, toValue]);
  useEffect(() => {
    var _a2, _b2;
    if (!fromValue) {
      setToValue("");
      return;
    }
    const fromUnit = unitSelected.from && ((_a2 = unitSelected.from) == null ? void 0 : _a2.id) === data.id ? data : unitSelected.from;
    const toUnit = unitSelected.to && ((_b2 = unitSelected.to) == null ? void 0 : _b2.id) === data.id ? data : unitSelected.to;
    const result = Number(fromValue) * ((fromUnit == null ? void 0 : fromUnit.conversion_factor) / (toUnit == null ? void 0 : toUnit.conversion_factor));
    setToValue(Number.isNaN(result) ? "" : result);
  }, [fromValue, data.conversion_factor, unitSelected]);
  useEffect(() => {
    setUnitSelected((prev) => {
      var _a2, _b2;
      if (unitSelected.from && ((_a2 = unitSelected.from) == null ? void 0 : _a2.id) === data.id)
        return {
          ...prev,
          to: null
        };
      if (unitSelected.to && ((_b2 = unitSelected.to) == null ? void 0 : _b2.id) === data.id)
        return {
          ...prev,
          from: null
        };
    });
  }, [units]);
  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      loadGroups(searchGroup);
    }, 500);
    return () => clearTimeout(searchTimeout);
  }, [searchGroup]);
  useEffect(() => {
    loadUnits(data.group);
  }, [data.group]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(FormPageContent, { title: null, value: "detail", children: [
      /* @__PURE__ */ jsx(FormPageContentTitle, {}),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-x-3 gap-y-4", children: [
        /* @__PURE__ */ jsx(FormInput, { required: true, label: t("inventory.unit.columns.group"), children: /* @__PURE__ */ jsx(
          Combobox,
          {
            search: searchGroup,
            onSearchChange: (val) => {
              if (data.group) return;
              setSearchGroup(val);
            },
            options: groups,
            value: data.group,
            placeholder: t("inventory.unit.columns.group.placeholder"),
            templateTrigger: (group) => {
              return /* @__PURE__ */ jsx("span", { children: group });
            },
            templateItem: (group) => {
              return /* @__PURE__ */ jsx(
                CommandItem,
                {
                  onSelect: () => setData("group", group),
                  value: group,
                  keywords: [group],
                  children: group
                },
                group
              );
            }
          }
        ) }),
        /* @__PURE__ */ jsx(FormInput, { required: true, label: t("inventory.unit.columns.code"), children: /* @__PURE__ */ jsx(
          Input,
          {
            value: data.code,
            onChange: (e) => setData("code", e.target.value)
          }
        ) }),
        /* @__PURE__ */ jsx(FormInput, { required: true, label: t("inventory.unit.columns.name"), children: /* @__PURE__ */ jsx(
          Input,
          {
            value: data.name,
            onChange: (e) => setData("name", e.target.value)
          }
        ) }),
        /* @__PURE__ */ jsx(
          FormCheckbox,
          {
            checked: data.customable ?? false,
            onCheckedChange: (val) => {
              setData("customable", val);
            },
            label: t("inventory.unit.columns.customable")
          }
        ),
        !data.customable && /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("inventory.unit.columns.conversion_factor"),
            children: /* @__PURE__ */ jsx(
              Input,
              {
                pattern: "^\\d*(\\.\\d+)?$",
                value: data.conversion_factor,
                onChange: (e) => setData("conversion_factor", e.target.value)
              }
            )
          }
        )
      ] })
    ] }),
    !data.customable && units.length > 0 && /* @__PURE__ */ jsxs(FormPageContent, { title: t("inventory.unit.playground"), value: "detail", children: [
      /* @__PURE__ */ jsx(FormPageContentDescription, { children: t("inventory.unit.playground.description") }),
      /* @__PURE__ */ jsx("div", { className: "grid gap-x-3 gap-y-4", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-3", children: [
        /* @__PURE__ */ jsx(
          FormInput,
          {
            ignoreDisabled: true,
            label: t("inventory.unit.columns.units.from"),
            children: /* @__PURE__ */ jsx(
              Combobox,
              {
                options: units,
                value: unitSelected.from && ((_a = unitSelected.from) == null ? void 0 : _a.id) === (data == null ? void 0 : data.id) ? data : unitSelected.from,
                disabled: unitSelected.from && ((_b = unitSelected.from) == null ? void 0 : _b.id) === (data == null ? void 0 : data.id),
                placeholder: t("inventory.unit.playground.unit.placeholder"),
                templateTrigger: (unit) => {
                  return /* @__PURE__ */ jsxs("span", { children: [
                    unit.name,
                    " (",
                    unit.code,
                    ")"
                  ] });
                },
                templateItem: (unit) => {
                  return /* @__PURE__ */ jsxs(
                    CommandItem,
                    {
                      onSelect: () => setUnitSelected((prev) => ({ ...prev, from: unit })),
                      value: `${unit.code} ${unit.name}`,
                      keywords: [unit.code, unit.name],
                      children: [
                        unit.name,
                        " (",
                        unit.code,
                        ")"
                      ]
                    },
                    unit.id
                  );
                }
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "icon",
            className: "self-end size-8!",
            onClick: swapPlayground,
            children: /* @__PURE__ */ jsx(ArrowLeftRightIcon, { className: "size-8" })
          }
        ),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            ignoreDisabled: true,
            label: t("inventory.unit.columns.units.to"),
            children: /* @__PURE__ */ jsx(
              Combobox,
              {
                options: units,
                value: unitSelected.to && ((_c = unitSelected.to) == null ? void 0 : _c.id) === (data == null ? void 0 : data.id) ? data : unitSelected.to,
                disabled: unitSelected.to && ((_d = unitSelected.to) == null ? void 0 : _d.id) === (data == null ? void 0 : data.id),
                placeholder: t("inventory.unit.playground.unit.placeholder"),
                templateTrigger: (unit) => {
                  return /* @__PURE__ */ jsxs("span", { children: [
                    unit.name,
                    " (",
                    unit.code,
                    ")"
                  ] });
                },
                templateItem: (unit) => {
                  return /* @__PURE__ */ jsxs(
                    CommandItem,
                    {
                      onSelect: () => setUnitSelected((prev) => ({ ...prev, to: unit })),
                      value: `${unit.code} ${unit.name}`,
                      keywords: [unit.code, unit.name],
                      children: [
                        unit.name,
                        " (",
                        unit.code,
                        ")"
                      ]
                    },
                    unit.id
                  );
                }
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          Input,
          {
            disabled: unitSelected.from === null || unitSelected.to === null,
            value: fromValue,
            onChange: (e) => {
              setFromValue(e.target.value);
            }
          }
        ),
        /* @__PURE__ */ jsx(
          Input,
          {
            disabled: unitSelected.from === null || unitSelected.to === null,
            className: "col-start-3",
            readOnly: true,
            value: toValue
          }
        )
      ] }) })
    ] })
  ] });
}
export {
  Form as default
};
