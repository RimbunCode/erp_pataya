import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import { usePage, WhenVisible } from "@inertiajs/react";
import { memo, useMemo } from "react";
import { g as FormPageContent, c as convertTemplateLink } from "./checkbox-C_BEU5E4.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { L as LoadingIcon } from "./LoadingIcon-CRleOEtX.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-tooltip";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "./input-wk3Ou7wI.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "axios";
import "lodash";
import "pluralize";
import "react-detect-click-outside";
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
const FormStockLevels = memo(function FormStockLevels2() {
  const route = window.route;
  const stocks = usePage().props.stocks;
  const { t } = useLaravelReactI18n();
  const maxStocks = useMemo(() => {
    return (stocks == null ? void 0 : stocks.reduce((acc, stock) => {
      const rightQty = stock.actual_quantity + stock.incoming_quantity + stock.rented_quantity;
      const leftQty = stock.reserved_quantity;
      return Math.max(acc, rightQty, leftQty);
    }, 0)) ?? 0;
  }, [stocks]);
  return /* @__PURE__ */ jsx(Fragment, { children: stocks && /* @__PURE__ */ jsx(
    FormPageContent,
    {
      title: t("inventory.item.menu.stock_levels"),
      value: "stock_levels",
      children: /* @__PURE__ */ jsx(
        WhenVisible,
        {
          data: ["stocks"],
          fallback: () => /* @__PURE__ */ jsxs("div", { className: "flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4", children: [
            /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
            /* @__PURE__ */ jsxs("span", { children: [
              t("core.form.loading"),
              " ..."
            ] })
          ] }),
          children: /* @__PURE__ */ jsxs("div", { className: "grid text-sm  *:px-4 ", children: [
            /* @__PURE__ */ jsxs("div", { className: "[&_p]:text-sm [&_p]:font-normal [&_p]:text-foreground pb-2 mb-2 border-b border-muted-foreground/25 col-span-full flex flex-wrap justify-between gap-4", children: [
              /* @__PURE__ */ jsxs("p", { children: [
                /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-blue-500 dark:bg-blue-600" }),
                t("inventory.stock.columns.actual_quantity")
              ] }),
              /* @__PURE__ */ jsxs("p", { children: [
                /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-gray-400 dark:bg-gray-500" }),
                t("inventory.stock.columns.incoming_quantity")
              ] }),
              /* @__PURE__ */ jsxs("p", { children: [
                /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-green-500 dark:bg-green-600" }),
                t("inventory.stock.columns.rented_quantity")
              ] }),
              /* @__PURE__ */ jsxs("p", { children: [
                /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-yellow-500 dark:bg-yellow-700" }),
                t("inventory.stock.columns.reserved_quantity")
              ] })
            ] }),
            stocks == null ? void 0 : stocks.map((stock) => {
              const maxStock = stock.actual_quantity + stock.incoming_quantity + stock.rented_quantity;
              return /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "grid items-center py-2 border-b border-muted-foreground/25 grid-cols-2 gap-x-4 col-span-full",
                  children: [
                    /* @__PURE__ */ jsx(
                      Link,
                      {
                        className: "mr-6 hover:underline",
                        href: route("warehouses.show", {
                          warehouse: stock.id
                        }),
                        children: convertTemplateLink(stock)
                      }
                    ),
                    /* @__PURE__ */ jsxs(Tooltip, { children: [
                      /* @__PURE__ */ jsxs(TooltipTrigger, { className: "grid grid-cols-2", children: [
                        /* @__PURE__ */ jsxs("div", { className: "pr-0.5 flex flex-col items-end justify-center relative border-r border-muted-foreground/25 ", children: [
                          /* @__PURE__ */ jsx("span", { className: "px-1 text-xs", children: stock.reserved_quantity }),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: cn(
                                "relative h-2 rounded-l-full bg-muted w-full"
                              )
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: cn(
                                "absolute bottom-0 rounded-l-full h-2 bg-yellow-500 dark:bg-yellow-700"
                              ),
                              style: {
                                width: `${stock.reserved_quantity / maxStocks * 100}%`
                              }
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "pl-0.5 flex flex-col items-start justify-center relative", children: [
                          /* @__PURE__ */ jsx("span", { className: "px-1 text-xs", children: stock.actual_quantity }),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: cn(
                                "relative h-2 rounded-r-full bg-muted w-full"
                              )
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: cn(
                                "absolute bottom-0 h-2 rounded-r-full bg-gray-400 dark:bg-gray-500"
                              ),
                              style: {
                                width: `${maxStock / maxStocks * 100}%`
                              }
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: cn(
                                "absolute bottom-0 h-2 bg-green-500 dark:bg-green-600",
                                stock.actual_quantity + stock.rented_quantity >= maxStock && "rounded-r-full"
                              ),
                              style: {
                                width: `${(stock.actual_quantity + stock.rented_quantity) / maxStocks * 100}%`
                              }
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: cn(
                                "absolute bottom-0 h-2 bg-blue-500 dark:bg-blue-600",
                                stock.actual_quantity >= maxStock && "rounded-r-full"
                              ),
                              style: {
                                width: `${stock.actual_quantity / maxStocks * 100}%`
                              }
                            }
                          )
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs(
                        TooltipContent,
                        {
                          align: "center",
                          className: "grid grid-cols-[auto_1fr] gap-x-2 [&_p]:text-sm [&_p]:font-normal [&_p]:text-foreground",
                          children: [
                            /* @__PURE__ */ jsxs("p", { children: [
                              /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-blue-500 dark:bg-blue-600" }),
                              t("inventory.stock.columns.actual_quantity")
                            ] }),
                            /* @__PURE__ */ jsxs("p", { children: [
                              ": ",
                              stock.actual_quantity
                            ] }),
                            /* @__PURE__ */ jsxs("p", { children: [
                              /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-gray-400 dark:bg-gray-500" }),
                              t("inventory.stock.columns.incoming_quantity")
                            ] }),
                            /* @__PURE__ */ jsxs("p", { children: [
                              ": ",
                              stock.incoming_quantity
                            ] }),
                            /* @__PURE__ */ jsxs("p", { children: [
                              /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-green-500 dark:bg-green-600" }),
                              t("inventory.stock.columns.rented_quantity")
                            ] }),
                            /* @__PURE__ */ jsxs("p", { children: [
                              ": ",
                              stock.rented_quantity
                            ] }),
                            /* @__PURE__ */ jsxs("p", { children: [
                              /* @__PURE__ */ jsx("span", { className: "inline-block size-2 mr-2 rounded-full bg-yellow-500 dark:bg-yellow-700" }),
                              t("inventory.stock.columns.reserved_quantity")
                            ] }),
                            /* @__PURE__ */ jsxs("p", { children: [
                              ": ",
                              stock.reserved_quantity
                            ] })
                          ]
                        }
                      )
                    ] })
                  ]
                },
                stock.id
              );
            })
          ] })
        }
      )
    }
  ) });
});
export {
  FormStockLevels as default
};
