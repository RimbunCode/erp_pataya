import React, { cloneElement, memo, useId } from "react";

import InputError from "./InputError";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";
import { useFormPageMeta } from "@/Pages/Core/FormPage";
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
  const form = useFormPageMeta();
  const id = useId();
  const { t } = useLaravelReactI18n();
  const firstChild = React.Children.toArray(children)[0];
  const isRenderProp = typeof children == "function";
  const errors = errorsProps ?? form?.errors ?? {};
  const _required = required || firstChild?.props?.required;
  const _name = name || firstChild?.props?.name;
  const errorMessage = error
    ? error
    : _name && errors?.[_name]
      ? form?.fieldNameTrans
        ? errors[_name].replace(_name, t(`${form.fieldNameTrans}.${_name}`))
        : errors[_name]
      : null;

  return (
    <div
      className={cn("grid grid-cols-1 content-start", className)}
      role={!ignoreDisabled ? "forminput" : ""}
    >
      <Label htmlFor={id} className="truncate mb-2 h-auto">
        {label} {_required && <span className="text-red-500">*</span>}
      </Label>
      {isRenderProp
        ? children({
            id,
            required: _required,
            readOnly: ignoreDisabled ? false : props.readOnly || form?.disabled,
            ...props,
          })
        : React.Children.map(children, (child) => {
            return cloneElement(child, {
              id,
              ...props,
              required: _required && (child.props?.required ?? true),
              readOnly: ignoreDisabled
                ? false
                : child.props?.readOnly || props.readOnly || form?.disabled,
            });
          })}
      {description &&
        (typeof description == "string" ? (
          <p className="text-sm mt-0.5 font-normal text-muted-foreground">
            {description}
          </p>
        ) : (
          description
        ))}
      {errorMessage && (
        <InputError
          message={errorMessage}
          className="mt-0.5 text-sm font-normal"
        />
      )}
    </div>
  );
}

export default memo(FormInput);
