import React, { cloneElement, memo, useId } from "react";

import InputError from "./InputError";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";
import { useFormPageMeta } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Tentukan nilai `valueBefore` yang diinjeksikan otomatis ke child input
 * berdasarkan `name` field, dari `dataBefore` yang tersedia di context saat
 * mode diff log. Dipisah dari komponen agar bisa diuji tanpa render React.
 * @param {object} params
 * @param {string} [params.name]
 * @param {object} [params.dataBefore]
 * @param {boolean} [params.ignoreDiff]
 * @returns {unknown} `undefined` bila tidak ada nilai yang bisa diinjeksikan
 */
export function resolveDiffValue({ name, dataBefore, ignoreDiff }) {
  const hasDataBefore =
    dataBefore != null && Object.keys(dataBefore).length > 0;
  if (ignoreDiff || !name || !hasDataBefore) return undefined;
  return dataBefore[name];
}

/**
 *
 * @param {object} props
 * @param {boolean} props.ignoreDisabled
 * @param {boolean} props.ignoreDiff nonaktifkan auto-inject `valueBefore` (mode diff log) untuk field ini
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
  ignoreDiff = false,
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
  // Auto-inject valueBefore (mode diff log) dari context by field name.
  // `valueBefore` eksplisit pada child selalu menang (lihat injeksi di bawah).
  const diffValue = resolveDiffValue({
    name: _name,
    dataBefore: form?.dataBefore,
    ignoreDiff,
  });

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
            ...props,
            id,
            required: _required,
            readOnly: ignoreDisabled ? false : props.readOnly || form?.disabled,
            valueBefore: props.valueBefore ?? diffValue,
          })
        : React.Children.map(children, (child) => {
            return cloneElement(child, {
              id,
              ...props,
              required: _required && (child.props?.required ?? true),
              readOnly: ignoreDisabled
                ? false
                : child.props?.readOnly || props.readOnly || form?.disabled,
              valueBefore: child.props?.valueBefore ?? diffValue,
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
