import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";

import { Check, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import { RunningText, RunningTextContent } from "@/Components/ui/running-text";

const Checkbox = React.forwardRef(({ className, readOnly, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    role="forminput"
    className={cn(
      "group peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
      readOnly && "pointer-events-none",
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
      readOnly: _readOnly,
      ...props
    },
    ref,
  ) => {
    const defaultId = React.useId();
    const { disabled } = useFormPage() ?? {};
    const readOnly = _readOnly || (disabled ?? false);
    const labelContent = children ?? label;
    const hasPlainLabel =
      typeof labelContent === "string" || typeof labelContent === "number";

    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <Checkbox
          ref={ref}
          id={id ?? defaultId}
          checked={checked ?? false}
          onCheckedChange={onCheckedChange}
          className={classNameCheckbox}
          readOnly={readOnly}
          {...props}
        />
        <RunningText
          asChild
          className={cn(
            "min-w-0 flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            classNameLabel,
          )}
        >
          <label htmlFor={id ?? defaultId}>
            {hasPlainLabel ? (
              <RunningTextContent text={labelContent} />
            ) : (
              labelContent
            )}
          </label>
        </RunningText>
      </div>
    );
  },
);
FormCheckbox.displayName = "FormCheckbox";

export { Checkbox, FormCheckbox };
