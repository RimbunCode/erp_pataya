import React, { Children, cloneElement, useEffect, useId } from "react";

import InputError from "./InputError";
import { Label } from "./ui/label";
<<<<<<< HEAD
import { cn } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 *
 * @typedef FormInputProps
 * @property {string} label
 * @property {boolean} required
 * @property {string} className
 * @property {string} name
 * @property {object} errors
 * @property {string} description
 * @param {FormInputProps} props
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
=======

function FormInput({ label, required, name, errors, children }) {
  const id = useId();
  const child = Children.only(children);
  const _required = required || child.props.required;
  const _name = name || child.props.name;
>>>>>>> origin/dev
  return (
    <div className="grid gap-y-2">
      <Label htmlFor={id}>
        {label} {_required && <span className="text-red-500">*</span>}
      </Label>
<<<<<<< HEAD
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
=======
      {cloneElement(child, {
        id,
        required: _required,
      })}
      <InputError message={errors?.[_name]} className="mt-2" />
>>>>>>> origin/dev
    </div>
  );
}

export default FormInput;
