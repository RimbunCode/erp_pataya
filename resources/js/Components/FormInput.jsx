import React, { Children, cloneElement, useEffect, useId } from "react";

import InputError from "./InputError";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 *
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} props.required
 * @param {string} props.className
 * @param {string} props.name
 * @param {object} props.errors
 * @param {string} props.description
 * @param {React.ReactNode} props.children
 * @returns {React.JSX.Element}
 */
function FormInput({
  label,
  required,
  className,
  name,
  errors: errorsProps,
  children,
  description,
}) {
  const form = useFormPage();
  const id = useId();
  const { t } = useLaravelReactI18n();
  const child =
    typeof children == "function" ? children : Children.only(children);
  const errors = errorsProps ?? form?.errors ?? {};
  const _required = required || child.props?.required;
  const _name = name || child.props?.name;
  const _value = child.props?.value;
  return (
    <div className={cn("flex flex-col gap-y-2", className)} role="forminput">
      <Label htmlFor={id}>
        {label} {_required && <span className="text-red-500">*</span>}
      </Label>
      {typeof child == "function"
        ? child({ id, required: _required })
        : cloneElement(child, {
            id,
            required: _required,
            value: _value ?? "",
          })}
      {_name in (errors ?? {}) ? (
        <InputError
          message={
            form.fieldNameTrans
              ? errors?.[_name].replace(
                  _name,
                  t(`${form.fieldNameTrans}.${_name}`),
                )
              : errors?.[_name]
          }
          className=""
        />
      ) : typeof description == "string" ? (
        <p className="text-sm font-normal text-muted-foreground">
          {description}
        </p>
      ) : (
        description
      )}
    </div>
  );
}

export default FormInput;
