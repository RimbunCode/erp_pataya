import { jsxs, jsx } from "react/jsx-runtime";
import { useForm, Head } from "@inertiajs/react";
import { B as Button } from "./button-Us2TB7GG.js";
import { G as GuestLayout, C as CardContent } from "./GuestLayout-BDOgVAas.js";
import { I as InputError } from "./InputError-2JjWc6nJ.js";
import { I as InputLabel } from "./InputLabel-DDs2XNYP.js";
import { T as TextInput } from "./TextInput-CCgNZyEO.js";
import "react";
import "lucide-react";
import "radix-ui";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "zustand";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "laravel-react-i18n";
function ConfirmPassword() {
  const route = window.route;
  const { data, setData, post, processing, errors, reset } = useForm({
    password: ""
  });
  const submit = (e) => {
    e.preventDefault();
    post(route("password.confirm"), {
      onFinish: () => reset("password")
    });
  };
  return /* @__PURE__ */ jsxs(GuestLayout, { children: [
    /* @__PURE__ */ jsx(Head, { title: "Confirm Password" }),
    /* @__PURE__ */ jsxs(CardContent, { children: [
      /* @__PURE__ */ jsx("div", { className: "mb-4 text-sm text-gray-600 dark:text-gray-400", children: "This is a secure area of the application. Please confirm your password before continuing." }),
      /* @__PURE__ */ jsxs("form", { onSubmit: submit, children: [
        /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
          /* @__PURE__ */ jsx(InputLabel, { htmlFor: "password", value: "Password" }),
          /* @__PURE__ */ jsx(
            TextInput,
            {
              id: "password",
              type: "password",
              name: "password",
              value: data.password,
              className: "block w-full mt-1",
              isFocused: true,
              onChange: (e) => setData("password", e.target.value)
            }
          ),
          /* @__PURE__ */ jsx(InputError, { message: errors.password, className: "mt-2" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center justify-end mt-4", children: /* @__PURE__ */ jsx(Button, { className: "ms-4", disabled: processing, children: "Confirm" }) })
      ] })
    ] })
  ] });
}
export {
  ConfirmPassword as default
};
