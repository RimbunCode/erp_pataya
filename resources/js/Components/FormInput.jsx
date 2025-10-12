import React, { cloneElement, memo, useId } from "react";

import InputError from "./InputError";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 *
 * @param {object} props
 * @param {boolean} props.ignoreDisabled
 * @param {string} props.label
 * @param {boolean} props.required
 * @param {string} props.className
 * @param {string} props.name
 * @param {object} props.errors
 * @param {string} props.error
 * @param {string | React.JSX.Element} props.description
 * @param {React.ReactNode} props.children
 * @returns {React.JSX.Element}
 */
function FormInput({
  label,
  required,
  className,
  name,
  errors: errorsProps,
  error,
  children,
  description,
  ignoreDisabled = false,
  ...props
}) {
  const form = useFormPage();
  const id = useId();
  const { t } = useLaravelReactI18n();
  const child = typeof children == "function" ? children : children;
  const errors = errorsProps ?? form?.errors ?? {};
  const _required = required || child.props?.required;
  const _name = name || child.props?.name;
  return (
    <div
      className={cn("flex flex-col gap-y-2", className)}
      role={!ignoreDisabled ? "forminput" : ""}
    >
      <Label htmlFor={id}>
        {label} {_required && <span className="text-red-500">*</span>}
      </Label>
      {typeof child == "function"
        ? child({ id, required: _required, readOnly: form?.disabled, ...props })
        : React.Children.map(children, (child) =>
            cloneElement(child, {
              id,
              required: _required && (child.props?.required ?? true),
              readOnly: child.props?.readOnly || form?.disabled,
              ...props,
            }),
          )}
      {description &&
        (typeof description == "string" ? (
          <p className="text-sm font-normal text-muted-foreground">
            {description}
          </p>
        ) : (
          description
        ))}
      {(error || _name in (errors ?? {})) && (
        <InputError
          message={
            error ??
            (form.fieldNameTrans
              ? errors?.[_name].replace(
                  _name,
                  t(`${form.fieldNameTrans}.${_name}`),
                )
              : errors?.[_name])
          }
          className=""
        />
      )}
    </div>
  );
}

export default memo(FormInput);
