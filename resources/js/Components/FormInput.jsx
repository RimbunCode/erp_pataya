import React, { Children, cloneElement, useId } from "react";

import InputError from "./InputError";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";

function FormInput({
  label,
  required,
  className,
  name,
  errors,
  children,
  description,
}) {
  const id = useId();
  const child =
    typeof children == "function" ? children : Children.only(children);
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
        <InputError message={errors?.[_name]} className="mt-2" />
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
