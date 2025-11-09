import * as React from "react";

import { useEffect, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

// Define input size variants
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
        sm: "h-8 px-2.5 text-xs rounded-md file:pe-2.5 file:me-2.5",
      },
    },
    defaultVariants: {
      variant: "sm",
    },
  },
);

const inputAddonVariants = cva(
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
        sm: "rounded-md h-8 min-w-7 px-2.5 text-xs [&_svg:not([class*=size-])]:size-3.5",
      },
      mode: {
        default: "",
        icon: "px-0 justify-center",
      },
    },
    defaultVariants: {
      variant: "sm",
      mode: "default",
    },
  },
);

const inputGroupVariants = cva(
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
    defaultVariants: {},
  },
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
        lg: "gap-1.5 [&_svg:not([class*=size-])]:size-4",
      },
    },
    defaultVariants: {
      variant: "sm",
    },
  },
);

const Input = React.forwardRef(function Input(
  {
    className,
    type,
    variant,
    onValueChange,
    onChange,
    isFocused = false,
    ...props
  },
  ref,
) {
  const localRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => localRef.current?.focus(),
  }));

  useEffect(() => {
    if (isFocused) {
      localRef.current?.focus();
    }
  }, [isFocused]);
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(inputVariants({ variant }), className)}
      onChange={(e) => {
        onValueChange?.(e.target.value);
        onChange?.(e);
      }}
      {...props}
    />
  );
});

function InputAddon({ className, variant, mode, ...props }) {
  return (
    <div
      data-slot="input-addon"
      className={cn(inputAddonVariants({ variant, mode }), className)}
      {...props}
    />
  );
}

function InputGroup({ className, ...props }) {
  return (
    <div
      data-slot="input-group"
      className={cn(inputGroupVariants(), className)}
      {...props}
    />
  );
}

function InputWrapper({ className, variant, ...props }) {
  return (
    <div
      data-slot="input-wrapper"
      className={cn(
        inputVariants({ variant }),
        inputWrapperVariants({ variant }),
        className,
      )}
      {...props}
    />
  );
}

export {
  Input,
  InputAddon,
  InputGroup,
  InputWrapper,
  inputVariants,
  inputAddonVariants,
};

// const Input = React.forwardRef(
//   (
//     { className, isFocused = false, type, onValueChange, onChange, ...props },
//     ref,
//   ) => {
//     const localRef = useRef(null);

//     useImperativeHandle(ref, () => ({
//       focus: () => localRef.current?.focus(),
//     }));

//     useEffect(() => {
//       if (isFocused) {
//         localRef.current?.focus();
//       }
//     }, [isFocused]);
//     return (
//       <input
//         type={type}
//         className={cn(
//           "focus:border-0! text-ellipsis  flex h-8 w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
//           className,
//         )}
//         onChange={(e) => {
//           onValueChange?.(e.target.value);
//           onChange?.(e);
//         }}
//         ref={localRef}
//         {...props}
//       />
//     );
//   },
// );
// Input.displayName = "Input";

// export { Input };
