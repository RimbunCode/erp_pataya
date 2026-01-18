import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, F as FormCheckbox, a as FormInput, T as Textarea, L as LinkModel } from "./checkbox-C_BEU5E4.js";
import { useMemo, forwardRef } from "react";
import CountryLinkModel from "./CountryLinkModel-sHdBSxco.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
function Form() {
  var _a;
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const banksColumns = useMemo(
    () => [
      {
        name: "bank",
        titleTrans: "purchase.supplier.columns.bank",
        required: true
      },
      {
        name: "no_acc",
        titleTrans: "purchase.supplier.columns.no_acc",
        required: true
      },
      {
        name: "account",
        titleTrans: "purchase.supplier.columns.account",
        required: true
      }
    ],
    []
  );
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        title: t("purchase.supplier.supplier_detail"),
        value: "supplier_detail",
        children: [
          /* @__PURE__ */ jsx(
            FormCheckbox,
            {
              label: t("purchase.supplier.columns.is_disabled"),
              checked: data == null ? void 0 : data.is_disabled,
              onCheckedChange: (e) => setData("is_disabled", e)
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("purchase.supplier.columns.name"),
              required: true,
              name: "name",
              className: "mt-4",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: (data == null ? void 0 : data.name) ?? "",
                  onChange: (e) => setData("name", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("purchase.supplier.columns.branch_of"),
              required: false,
              name: "branch_of",
              className: "mt-4",
              children: /* @__PURE__ */ jsx(
                SupplierLinkModel,
                {
                  disabled: (data == null ? void 0 : data.branches) && (data == null ? void 0 : data.branches.length) > 0,
                  value: data.branch_of,
                  onValueChange: (val) => setData("branch_of", val),
                  filters: {
                    parent_id: null,
                    id: {
                      not: data == null ? void 0 : data.id,
                      notIn: ((_a = data == null ? void 0 : data.branches) == null ? void 0 : _a.map((x) => x.id)) ?? []
                    }
                  },
                  disabledAddButton: true
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-2", children: [
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("purchase.supplier.columns.email"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    type: "email",
                    value: (data == null ? void 0 : data.email) ?? "",
                    onChange: (e) => setData("email", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("purchase.supplier.columns.phone"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    value: (data == null ? void 0 : data.phone) ?? "",
                    onChange: (e) => setData("phone", e.target.value)
                  }
                )
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            FormTable,
            {
              label: t("purchase.supplier.columns.banks"),
              className: "mt-4",
              columns: banksColumns,
              value: data.banks ?? [],
              onValueChange: (val) => {
                setData("banks", val);
              }
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        title: t("purchase.supplier.address"),
        value: "supplier_detail",
        children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("purchase.supplier.columns.street"),
              required: true,
              className: "col-span-full",
              children: /* @__PURE__ */ jsx(
                Textarea,
                {
                  value: (data == null ? void 0 : data.street) ?? "",
                  onChange: (e) => setData("street", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3", children: [
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("purchase.supplier.columns.city"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    value: (data == null ? void 0 : data.city) ?? "",
                    onChange: (e) => setData("city", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("purchase.supplier.columns.province"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    value: (data == null ? void 0 : data.province) ?? "",
                    onChange: (e) => setData("province", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("purchase.supplier.columns.zip_code"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    value: (data == null ? void 0 : data.zip_code) ?? "",
                    onChange: (e) => setData("zip_code", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("purchase.supplier.columns.country"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  CountryLinkModel,
                  {
                    placeholder: t("purchase.supplier.columns.country.placeholder"),
                    value: data.country,
                    onValueChange: (val) => setData("country", val)
                  }
                )
              }
            )
          ] })
        ]
      }
    )
  ] });
}
const Form$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Form
}, Symbol.toStringTag, { value: "Module" }));
const SupplierLinkModel = forwardRef(function SupplierLinkModel2({ value, onValueChange, placeholder, ...props }, ref) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    LinkModel,
    {
      placeholder,
      value,
      onValueChange,
      model: "App\\Models\\Purchase\\Supplier",
      titleDialog: t("purchase.supplier.new"),
      classNameDialog: "max-w-(--breakpoint-lg)!",
      form: /* @__PURE__ */ jsx(Form, {}),
      ...props,
      ref
    }
  );
});
const SupplierLinkModel$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: SupplierLinkModel
}, Symbol.toStringTag, { value: "Module" }));
export {
  Form as F,
  SupplierLinkModel as S,
  Form$1 as a,
  SupplierLinkModel$1 as b
};
