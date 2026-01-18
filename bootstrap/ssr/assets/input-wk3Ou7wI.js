import { jsx } from "react/jsx-runtime";
import * as React from "react";
import { useRef, useImperativeHandle, useEffect } from "react";
import { c as cn } from "./utils-ClCZGsDL.js";
import { cva } from "class-variance-authority";
const inputVariants = cva(
  `
    flex w-full h-8
    rounded-md
    border border-input
    bg-muted
    px-3 py-2
    text-base md:text-sm
    text-foreground
    placeholder:text-muted-foreground/80
    text-ellipsis
    shadow-xs shadow-black/5
    ring-offset-background
    transition-[color,box-shadow,border,background-color]

    file:border-0 file:bg-transparent
    file:text-sm file:font-medium file:text-foreground

    focus-visible:outline-none
    focus-visible:ring-1
    focus-visible:ring-ring
    focus-visible:ring-offset-1
    focus-visible:border-ring

    disabled:cursor-not-allowed disabled:opacity-60

    [&[readonly]]:bg-muted/80
    [&[readonly]]:cursor-not-allowed

    aria-invalid:border-destructive/60
    aria-invalid:ring-destructive/10
    dark:aria-invalid:border-destructive
    dark:aria-invalid:ring-destructive/20
  `,
  {
    variants: {
      variant: {
        lg: "h-10 px-4 text-sm rounded-md file:pe-4 file:me-4",
        md: "h-9 px-3 text-sm rounded-md file:pe-3 file:me-3",
        sm: "h-8 px-2.5 text-xs rounded-md file:pe-2.5 file:me-2.5"
      }
    },
    defaultVariants: {
      variant: "sm"
    }
  }
);
cva(
  `
    flex items-center shrink-0 justify-center
    bg-muted
    border border-input
    shadow-xs shadow-[rgba(0,0,0,0.05)]
    text-secondary-foreground
    [&_svg]:text-secondary-foreground/60
  `,
  {
    variants: {
      variant: {
        lg: "rounded-md h-10 min-w-10 px-4 text-sm [&_svg:not([class*=size-])]:size-4.5",
        md: "rounded-md h-9 min-w-9 px-3 text-sm [&_svg:not([class*=size-])]:size-4.5",
        sm: "rounded-md h-8 min-w-7 px-2.5 text-xs [&_svg:not([class*=size-])]:size-3.5"
      },
      mode: {
        default: "",
        icon: "px-0 justify-center"
      }
    },
    defaultVariants: {
      variant: "sm",
      mode: "default"
    }
  }
);
cva(
  `
    flex items-stretch

    [&_[data-slot=input]]:grow
    [&_[data-slot=datefield]]:grow

    [&_[data-slot=input-addon]:has(+[data-slot=input])]:rounded-e-none border-e-0
    [&_[data-slot=input-addon]:has(+[data-slot=datefield])]:rounded-e-none border-e-0

    [&_[data-slot=input]+[data-slot=input-addon]]:rounded-s-none border-s-0
    [&_[data-slot=datefield]+[data-slot=input-addon]]:rounded-s-none border-s-0

    [&_[data-slot=input-addon]:has(+[data-slot=button])]:rounded-e-none

    [&_[data-slot=input]+[data-slot=button]]:rounded-s-none
    [&_[data-slot=button]+[data-slot=input]]:rounded-s-none

    [&_[data-slot=input-addon]+[data-slot=input]]:rounded-s-none
  `,
  {
    variants: {},
    defaultVariants: {}
  }
);
const inputWrapperVariants = cva(
  `
    flex items-center
    bg-muted
    border border-input
    rounded-md
    shadow-xs shadow-black/5
    gap-1.5
    transition-[color,box-shadow,border,background-color]
    has-[:focus-visible]:ring-ring/30
    has-[:focus-visible]:border-ring
    has-[:focus-visible]:outline-none
    has-[:focus-visible]:ring-[3px]

    [&_[data-slot=input]]:ring-0!
    [&_[data-slot=input]]:outline-none!
    [&_[data-slot=input]]:border-0!
    [&_[data-slot=input]]:bg-transparent
    [&_[data-slot=input]]:p-0
    [&_[data-slot=input]]:m-0
    [&_[data-slot=input]]:shadow-none
    [&_[data-slot=input]]:h-auto
    [&_[data-slot=input]]:w-full
    [&_[data-slot=input]]:flex
    [&_[data-slot=input]]:text-foreground
    [&_[data-slot=input]]:placeholder:text-muted-foreground

    [&_[data-slot=input]]:disabled:cursor-not-allowed
    [&_[data-slot=input]]:disabled:opacity-50

    [&_svg]:text-muted-foreground
    [&_svg]:shrink-0


    has-[[aria-invalid=true]]:border-destructive/60
    has-[[aria-invalid=true]]:ring-destructive/10
    dark:has-[[aria-invalid=true]]:border-destructive
    dark:has-[[aria-invalid=true]]:ring-destructive/20
  `,
  {
    variants: {
      variant: {
        sm: "gap-1.25 [&_svg:not([class*=size-])]:size-3.5",
        md: "gap-1.5 [&_svg:not([class*=size-])]:size-4",
        lg: "gap-1.5 [&_svg:not([class*=size-])]:size-4"
      }
    },
    defaultVariants: {
      variant: "sm"
    }
  }
);
const Input = React.forwardRef(function Input2({
  className,
  type,
  variant,
  value,
  onValueChange,
  onChange,
  isFocused = false,
  ...props
}, ref) {
  const localRef = useRef(null);
  useImperativeHandle(ref, () => ({
    focus: () => {
      var _a;
      return (_a = localRef.current) == null ? void 0 : _a.focus();
    }
  }));
  useEffect(() => {
    var _a;
    if (isFocused) {
      (_a = localRef.current) == null ? void 0 : _a.focus();
    }
  }, [isFocused]);
  return /* @__PURE__ */ jsx(
    "input",
    {
      "data-slot": "input",
      type,
      className: cn(inputVariants({ variant }), className),
      onChange: (e) => {
        onValueChange == null ? void 0 : onValueChange(e.target.value);
        onChange == null ? void 0 : onChange(e);
      },
      value,
      ...props
    }
  );
});
function InputWrapper({ className, variant, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "input-wrapper",
      className: cn(
        inputVariants({ variant }),
        inputWrapperVariants({ variant }),
        className
      ),
      ...props
    }
  );
}
export {
  Input as I,
  InputWrapper as a
};
