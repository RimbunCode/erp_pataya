import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as React from "react";

import { buttonVariants } from "@/Components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/Hooks/use-mobile";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef(
  ({ className, forceAsDialog = false, align = "top", ...props }, ref) => {
    const isMobile = useIsMobile();
    return (
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <div
          className={cn(
            "fixed h-screen w-full z-50 flex items-center md:px-6",
            align == "top" && "flex-col",
            align == "bottom" && "flex-col-reverse",
          )}
        >
          {align != "center" && <div className="h-[8%]"></div>}
          <div
            className={cn(
              "flex-1 w-full flex items-center",
              align == "center" && "flex-col justify-center",
              align == "top" && "flex-col",
              align == "bottom" && "flex-col-reverse",
            )}
          >
            <AlertDialogPrimitive.Content
              ref={ref}
              className={cn(
                "overflow-y-auto w-full md:h-auto grid content-start max-w-lg gap-4 border bg-background p-6 shadow-lg duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:ease-in data-[state=closed]:ease-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg",
                align == "top" &&
                  "data-[state=closed]:slide-out-to-top-[28%] data-[state=open]:slide-in-from-top-[28%]",
                align == "bottom" &&
                  "data-[state=closed]:slide-out-to-bottom-[28%] data-[state=open]:slide-in-from-bottom-[28%]",
                !forceAsDialog && "h-screen",
                !forceAsDialog && isMobile && "max-w-full!",
                className,
              )}
              {...props}
            />
          </div>
        </div>
      </AlertDialogPortal>
    );
  },
);
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  ),
);
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef(
  ({ variant, size, className, ...props }, ref) => (
    <AlertDialogPrimitive.Action
      ref={ref}
      className={cn(
        buttonVariants({
          variant: variant ?? "primary",
          size: size ?? "lg",
        }),
        "p-2 md:size-fit",
        className,
      )}
      {...props}
    />
  ),
);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef(
  ({ variant, size, className, ...props }, ref) => (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      className={cn(
        buttonVariants({
          variant: variant ?? "outline",
          size: size ?? "lg",
        }),
        "mt-2 sm:mt-0 p-2 md:size-fit ",
        className,
      )}
      {...props}
    />
  ),
);
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
