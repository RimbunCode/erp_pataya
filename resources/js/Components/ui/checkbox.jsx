import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";

import { Check, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    role="forminput"
    className={cn(
      "group peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="w-4 h-4 hidden group-data-[state=checked]:block" />
      <MinusIcon className="w-4 h-4 hidden group-data-[state=indeterminate]:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

const FormCheckbox = React.forwardRef(
  (
    {
      id,
      checked,
      onCheckedChange,
      label,
      className,
      classNameCheckbox,
      classNameLabel,
      children,
      ...props
    },
    ref,
  ) => {
    const defaultId = React.useId();
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Checkbox
          ref={ref}
          id={id ?? defaultId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          className={classNameCheckbox}
          {...props}
        />
        <label
          htmlFor={id ?? defaultId}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            classNameLabel,
          )}
        >
          {children ?? label}
        </label>
      </div>
    );
  },
);
FormCheckbox.displayName = "FormCheckbox";

export { Checkbox, FormCheckbox };
