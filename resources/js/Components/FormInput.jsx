import React, { Children, cloneElement, useId } from "react";

import InputError from "./InputError";
import { Label } from "./ui/label";

function FormInput({ label, required, name, errors, children }) {
  const id = useId();
  const child = Children.only(children);
  const _required = required || child.props.required;
  const _name = name || child.props.name;
  return (
    <div className="grid gap-y-2">
      <Label htmlFor={id}>
        {label} {_required && <span className="text-red-500">*</span>}
      </Label>
      {cloneElement(child, {
        id,
        required: _required,
      })}
      <InputError message={errors?.[_name]} className="mt-2" />
    </div>
  );
}

export default FormInput;
