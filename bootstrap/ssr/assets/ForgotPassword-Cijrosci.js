import { jsxs, jsx } from "react/jsx-runtime";
import { useForm, Head } from "@inertiajs/react";
import { B as Button } from "./button-Us2TB7GG.js";
import { G as GuestLayout, C as CardContent } from "./GuestLayout-BDOgVAas.js";
import { I as InputError } from "./InputError-2JjWc6nJ.js";
import { S as Skeleton } from "./skeleton-IN0PLOYc.js";
import { T as TextInput } from "./TextInput-CCgNZyEO.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
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
function ForgotPassword({ status }) {
  const { t, loading } = useLaravelReactI18n();
  const route = window.route;
  const { data, setData, post, processing, errors } = useForm({
    email: ""
  });
  const submit = (e) => {
    e.preventDefault();
    post(route("password.email"));
  };
  return /* @__PURE__ */ jsxs(GuestLayout, { children: [
    /* @__PURE__ */ jsx(Head, { title: "Forgot Password" }),
    /* @__PURE__ */ jsxs(CardContent, { children: [
      /* @__PURE__ */ jsx("div", { className: "mb-4 text-sm text-gray-600 dark:text-gray-400", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-full h-16" }) : t("auth.forgotPassword.description") }),
      status && /* @__PURE__ */ jsx("div", { className: "mb-4 text-sm font-medium text-green-600 dark:text-green-400", children: status }),
      /* @__PURE__ */ jsxs("form", { onSubmit: submit, children: [
        /* @__PURE__ */ jsx(
          TextInput,
          {
            id: "email",
            type: "email",
            name: "email",
            value: data.email,
            className: "block w-full mt-1",
            isFocused: true,
            onChange: (e) => setData("email", e.target.value)
          }
        ),
        /* @__PURE__ */ jsx(InputError, { message: errors.email, className: "mt-2" }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center justify-end mt-4", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-64 h-6" }) : /* @__PURE__ */ jsx(Button, { className: "ms-4", disabled: processing, children: t("auth.forgotPassword.button") }) })
      ] })
    ] })
  ] });
}
export {
  ForgotPassword as default
};
