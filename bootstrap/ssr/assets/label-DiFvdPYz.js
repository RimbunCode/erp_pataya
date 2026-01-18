import { jsx } from "react/jsx-runtime";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { c as cn } from "./utils-ClCZGsDL.js";
import { cva } from "class-variance-authority";
const labelVariants = cva(
  "text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);
const Label = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  LabelPrimitive.Root,
  {
    ref,
    className: cn(labelVariants(), className),
    ...props
  }
));
Label.displayName = LabelPrimitive.Root.displayName;
export {
  Label as L
};
