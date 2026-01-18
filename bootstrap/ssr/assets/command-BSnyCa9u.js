import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Search } from "lucide-react";
import { c as cn } from "./utils-ClCZGsDL.js";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
import { Command as Command$1 } from "cmdk";
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Overlay,
  {
    ref,
    className: cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    ),
    ...props
  }
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef(
  ({
    className,
    forceAsDialog = false,
    children,
    align = "top",
    hideX,
    ...props
  }, ref) => {
    const isMobile = useIsMobile();
    return /* @__PURE__ */ jsxs(DialogPortal, { children: [
      /* @__PURE__ */ jsx(DialogOverlay, {}),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: cn(
            "fixed h-screen w-full z-50 flex items-center md:px-6",
            align == "top" && "flex-col",
            align == "bottom" && "flex-col-reverse"
          ),
          children: [
            align != "center" && /* @__PURE__ */ jsx("div", { className: "h-[8%]" }),
            /* @__PURE__ */ jsx(
              "div",
              {
                className: cn(
                  "flex-1 w-full flex items-center",
                  align == "center" && "flex-col justify-center",
                  align == "top" && "flex-col",
                  align == "bottom" && "flex-col-reverse"
                ),
                children: /* @__PURE__ */ jsx(
                  DialogPrimitive.Content,
                  {
                    ref,
                    className: cn(
                      "relative overflow-y-auto md:h-auto grid content-start items w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:ease-in data-[state=closed]:ease-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg",
                      align == "top" && "data-[state=closed]:slide-out-to-top-[28%] data-[state=open]:slide-in-from-top-[28%]",
                      align == "bottom" && "data-[state=closed]:slide-out-to-bottom-[28%] data-[state=open]:slide-in-from-bottom-[28%]",
                      !forceAsDialog && "h-screen",
                      !forceAsDialog && isMobile && "max-w-full!",
                      className
                    ),
                    ...props,
                    children: !hideX ? /* @__PURE__ */ jsxs(Fragment, { children: [
                      children,
                      /* @__PURE__ */ jsxs(DialogPrimitive.Close, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground", children: [
                        /* @__PURE__ */ jsx(X, { className: "w-4 h-4" }),
                        /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Close" })
                      ] })
                    ] }) : children
                  }
                )
              }
            )
          ]
        }
      )
    ] });
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogHeader = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    ),
    ...props
  }
);
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    ),
    ...props
  }
);
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Title,
  {
    ref,
    className: cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    ),
    ...props
  }
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Description,
  {
    ref,
    className: cn("text-sm text-muted-foreground", className),
    ...props
  }
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
const Command = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Command$1,
  {
    ref,
    className: cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    ),
    ...props
  }
));
Command.displayName = Command$1.displayName;
const CommandInput = React.forwardRef(
  ({ className, withoutBorder, showIcon = true, ...props }, ref) => /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "flex items-center",
        !withoutBorder && "border-b border-muted"
      ),
      "cmdk-input-wrapper": "",
      children: [
        showIcon && /* @__PURE__ */ jsx(Search, { className: "w-4 h-4 ml-3 mr-2 opacity-50 shrink-0" }),
        /* @__PURE__ */ jsx(
          Command$1.Input,
          {
            ref,
            className: cn(
              "focus:border-0! flex h-10 w-full border-0! rounded-md  bg-background px-3 py-2 text-base ring-offset-background  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            ),
            ...props
          }
        )
      ]
    }
  )
);
CommandInput.displayName = Command$1.Input.displayName;
const CommandList = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Command$1.List,
  {
    ref,
    className: cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className),
    ...props
  }
));
CommandList.displayName = Command$1.List.displayName;
const CommandEmpty = React.forwardRef((props, ref) => /* @__PURE__ */ jsx(
  Command$1.Empty,
  {
    ref,
    className: "py-6 text-sm text-center",
    ...props
  }
));
CommandEmpty.displayName = Command$1.Empty.displayName;
const CommandGroup = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Command$1.Group,
  {
    ref,
    className: cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    ),
    ...props
  }
));
CommandGroup.displayName = Command$1.Group.displayName;
const CommandSeparator = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Command$1.Separator,
  {
    ref,
    className: cn("-mx-1 h-px bg-border", className),
    ...props
  }
));
CommandSeparator.displayName = Command$1.Separator.displayName;
const CommandItem = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Command$1.Item,
  {
    ref,
    className: cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-disabled:pointer-events-auto data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className
    ),
    ...props
  }
));
CommandItem.displayName = Command$1.Item.displayName;
export {
  Command as C,
  Dialog as D,
  CommandList as a,
  CommandEmpty as b,
  CommandItem as c,
  CommandSeparator as d,
  DialogTrigger as e,
  DialogContent as f,
  DialogHeader as g,
  DialogTitle as h,
  DialogDescription as i,
  DialogFooter as j,
  CommandInput as k,
  CommandGroup as l,
  DialogClose as m
};
