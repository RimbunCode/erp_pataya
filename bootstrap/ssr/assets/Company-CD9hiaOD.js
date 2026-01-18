import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { a as AvatarImage, A as Avatar, b as AvatarFallback } from "./avatar-_KK8H2Pc.js";
import { D as Dialog, e as DialogTrigger, c as CommandItem } from "./command-BSnyCa9u.js";
import { h as FormPage, U as UploadDialog, u as useFormPage, g as FormPageContent, a as FormInput, T as Textarea, C as Checkbox } from "./checkbox-C_BEU5E4.js";
import { useState, useMemo } from "react";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-XM4G_Lvw.js";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import { UploadIcon, Trash2Icon } from "lucide-react";
import { B as Button } from "./button-Us2TB7GG.js";
import { C as Combobox } from "./Combobox-CnMmTQqc.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import "@radix-ui/react-avatar";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@radix-ui/react-dialog";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "@radix-ui/react-checkbox";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
import "zustand";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "radix-ui";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
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
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@radix-ui/react-select";
import "@radix-ui/react-tooltip";
import "./drawer-D3vDykaS.js";
import "vaul";
function Form() {
  const { t } = useLaravelReactI18n();
  const { currencies, countries, timezones } = usePage().props;
  const { data, setData } = useFormPage();
  const onUpdatePerPageOptions = (list) => {
    setData(
      "per_page_options",
      [...new Set(list.filter((x) => x))].sort((a, b) => a - b)
    );
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "company_details",
        title: t("core.company.company_details.title"),
        children: /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.name"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.company_name,
                  onChange: (e) => setData("company_name", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.short_name"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.short_name,
                  onChange: (e) => setData("short_name", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.email"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  type: "email",
                  value: data.email,
                  onChange: (e) => setData("email", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.phone"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.phone,
                  onChange: (e) => setData("phone", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.street"),
              required: true,
              className: "col-span-full",
              children: /* @__PURE__ */ jsx(
                Textarea,
                {
                  value: data.street,
                  onChange: (e) => setData("street", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.city"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.city,
                  onChange: (e) => setData("city", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.state"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.state,
                  onChange: (e) => setData("state", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.zip_code"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.zip_code,
                  onChange: (e) => setData("zip_code", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.company_details.country"),
              required: true,
              children: /* @__PURE__ */ jsx(
                Combobox,
                {
                  options: countries,
                  value: data.country_id,
                  placeholder: t(
                    "core.company.company_details.country.placeholder"
                  ),
                  templateTrigger: (country_code) => {
                    const country = countries == null ? void 0 : countries.find((c) => c.code === country_code);
                    return /* @__PURE__ */ jsx("span", { children: country == null ? void 0 : country.name });
                  },
                  templateItem: (country) => {
                    return /* @__PURE__ */ jsx(
                      CommandItem,
                      {
                        value: `${country.name} ${country.code}`,
                        keywords: [country.code, country.name],
                        onSelect: () => {
                          setData("shipping_country_id", country.code);
                        },
                        className: "block px-4 ",
                        children: country.name
                      },
                      country.code
                    );
                  }
                }
              )
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "email_setup",
        title: t("core.company.email_setup.title"),
        children: /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-4 gap-y-4 md:grid-cols-3", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.protocol"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsxs(
                Select,
                {
                  value: data.mail_protocol,
                  onValueChange: (val) => setData("mail_protocol", val),
                  children: [
                    /* @__PURE__ */ jsx(SelectTrigger, { children: /* @__PURE__ */ jsx(
                      SelectValue,
                      {
                        placeholder: t(
                          "core.company.email_setup.protocol.placeholder"
                        )
                      }
                    ) }),
                    /* @__PURE__ */ jsx(SelectContent, { children: /* @__PURE__ */ jsx(SelectItem, { value: "smtp", children: "SMTP" }) })
                  ]
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.encryption"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.mail_encryption,
                  onChange: (e) => setData("mail_encryption", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.host"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.mail_host,
                  onChange: (e) => setData("mail_host", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.port"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  type: "number",
                  value: data.mail_port,
                  onChange: (e) => setData("mail_port", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.username"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.mail_username,
                  onChange: (e) => setData("mail_username", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.password"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.mail_password,
                  onChange: (e) => setData("mail_password", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.from_address"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.mail_from_address,
                  onChange: (e) => setData("mail_from_address", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.email_setup.from_name"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.mail_from_name,
                  onChange: (e) => setData("mail_from_name", e.target.value)
                }
              )
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "preferences",
        title: t("core.company.preferences.title"),
        children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col w-full max-w-lg gap-y-4", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.preferences.default_currency"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Combobox,
                {
                  options: currencies,
                  value: data.default_currency_id,
                  placeholder: t(
                    "core.company.preferences.default_currency.placeholder"
                  ),
                  templateTrigger: (currency_code) => {
                    const currency = currencies == null ? void 0 : currencies.find(
                      (c) => c.code === currency_code
                    );
                    return /* @__PURE__ */ jsxs("span", { children: [
                      currency == null ? void 0 : currency.name,
                      " ",
                      /* @__PURE__ */ jsxs("span", { className: "uppercase", children: [
                        "(",
                        currency == null ? void 0 : currency.code,
                        ")"
                      ] })
                    ] });
                  },
                  templateItem: (currency) => {
                    return /* @__PURE__ */ jsxs(
                      CommandItem,
                      {
                        value: `${currency.name} ${currency.code}`,
                        keywords: [currency.code, currency.name],
                        onSelect: () => {
                          setData("default_currency_id", currency.code);
                        },
                        className: "block px-4 ",
                        children: [
                          currency.name,
                          " ",
                          /* @__PURE__ */ jsxs("span", { className: "uppercase", children: [
                            "(",
                            currency.code,
                            ")"
                          ] })
                        ]
                      },
                      currency.code
                    );
                  }
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.company.preferences.timezone"),
              required: true,
              className: "",
              children: /* @__PURE__ */ jsx(
                Combobox,
                {
                  options: timezones,
                  value: data.timezone,
                  placeholder: t("core.company.preferences.timezone.placeholder"),
                  templateTrigger: (timezone) => {
                    return /* @__PURE__ */ jsx("span", { children: timezone });
                  },
                  templateItem: (timezone) => {
                    return /* @__PURE__ */ jsx(
                      CommandItem,
                      {
                        value: timezone,
                        keywords: [timezone],
                        onSelect: () => {
                          setData("timezone", timezone);
                        },
                        className: "block px-4 ",
                        children: timezone
                      },
                      timezone
                    );
                  }
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "grid [&>div]:px-3 gap-x-1 grid-cols-[auto_1fr_auto] text-sm [&>div>*]:px-1h max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-sm lg:[&>div]:text-base", children: [
              /* @__PURE__ */ jsx("div", { className: "pr-2! pl-2! justify-start! text-left", children: "No." }),
              /* @__PURE__ */ jsx("div", { className: "justify-start! text-left", children: "Rows per Page" }),
              /* @__PURE__ */ jsx("div", { className: "text-center", children: "Default" })
            ] }),
            (data == null ? void 0 : data.per_page_options) && (data == null ? void 0 : data.per_page_options.map((item, index) => {
              return /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base",
                  children: [
                    /* @__PURE__ */ jsx("div", { className: "pr-2! pl-2! justify-start! text-left", children: index + 1 }),
                    /* @__PURE__ */ jsx("div", { className: "justify-start! text-left", children: /* @__PURE__ */ jsx(
                      Input,
                      {
                        type: "number",
                        defaultValue: item,
                        onBlur: (e) => {
                          const index2 = data.per_page_options.findIndex(
                            (x) => x == item
                          );
                          const options = data.per_page_options;
                          options[index2] = e.target.value ? Number(e.target.value) : null;
                          onUpdatePerPageOptions(options);
                        }
                      }
                    ) }),
                    /* @__PURE__ */ jsx("div", { className: "text-center", children: /* @__PURE__ */ jsx(
                      Checkbox,
                      {
                        checked: item == (data == null ? void 0 : data.num_per_page),
                        onCheckedChange: () => {
                          setData("num_per_page", item);
                        }
                      }
                    ) })
                  ]
                },
                item
              );
            })),
            /* @__PURE__ */ jsxs("div", { className: "grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base", children: [
              /* @__PURE__ */ jsx("div", { className: "pr-2! pl-2! justify-start! text-left", children: data.per_page_options.length + 1 }),
              /* @__PURE__ */ jsx("div", { className: "justify-start! text-left", children: /* @__PURE__ */ jsx(
                Input,
                {
                  type: "number",
                  onBlur: (e) => {
                    onUpdatePerPageOptions([
                      ...data.per_page_options,
                      Number(e.target.value)
                    ]);
                    e.target.value = null;
                  }
                }
              ) }),
              /* @__PURE__ */ jsx("div", { className: "text-center", children: /* @__PURE__ */ jsx(Checkbox, { disabled: true }) })
            ] })
          ] })
        ] })
      }
    )
  ] });
}
function Company({ company }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const [openAttachment, setOpenAttachment] = useState(false);
  const alias = company.company_name.split(" ").slice(0, 2).map((n) => n.charAt(0)).join("");
  const avatar = useMemo(() => {
    if (!company.company_image) return null;
    return /* @__PURE__ */ jsx(
      AvatarImage,
      {
        src: route("files.preview", company.company_image) + (company.updated_at ? `?v=${new Date(company.updated_at).getTime()}` : ""),
        alt: company.name,
        className: " transition-[filter] duration-300 group-hover:blur-sm"
      }
    );
  }, [company.company_image]);
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      name: "company",
      title: t("core.company.title"),
      sidebarContent: () => {
        return /* @__PURE__ */ jsxs(Dialog, { open: openAttachment, onOpenChange: setOpenAttachment, children: [
          /* @__PURE__ */ jsxs(Avatar, { className: "relative  h-auto border rounded-xl aspect-square w-64 group", children: [
            avatar,
            /* @__PURE__ */ jsx(AvatarFallback, { className: "rounded-lg ", children: /* @__PURE__ */ jsx("p", { className: "w-full font-semibold text-center text-muted-foreground text-9xl  transition-[filter]", children: alias }) }),
            /* @__PURE__ */ jsxs("div", { className: "absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4", children: [
              /* @__PURE__ */ jsxs(Tooltip, { children: [
                /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "default", size: "icon", type: "button", children: /* @__PURE__ */ jsx(UploadIcon, { className: "size-5!" }) }) }) }),
                /* @__PURE__ */ jsx(TooltipContent, { align: "center", children: "Upload" })
              ] }),
              company.company_image && /* @__PURE__ */ jsxs(Tooltip, { children: [
                /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "destructive", size: "icon", type: "button", children: /* @__PURE__ */ jsx(Trash2Icon, { className: "size-5!" }) }) }),
                /* @__PURE__ */ jsx(TooltipContent, { align: "center", children: "Remove" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            UploadDialog,
            {
              open: openAttachment,
              single: true,
              imageOnly: true,
              options: {
                route: route(route().current()) + "/image",
                reset: ["company", "auth"]
              },
              onClose: () => {
                setOpenAttachment(false);
              }
            }
          )
        ] });
      },
      bottombarContent: false,
      children: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Company as default
};
