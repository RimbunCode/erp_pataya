import React from "react";
import { Input } from "@/Components/ui/input";

function DefaultInputField({ prop }) {
  const defaultValue = prop.getDefaultValue?.() ?? "";
  const value = prop.hasValue?.() ? prop.getValue?.() : "";

  return (
    <Input
      value={value}
      placeholder={defaultValue}
      onValueChange={(nextValue) => prop.upValue?.(nextValue)}
    />
  );
}

export default DefaultInputField;
