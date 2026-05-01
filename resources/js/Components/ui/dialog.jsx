"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/Hooks/use-mobile";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(
  (
    {
      className,
      forceAsDialog = false,
      children,
      align = "top",
      hideX,
      ...props
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    return (
      <DialogPortal>
        <DialogOverlay />
        <div
          className={cn(
            "fixed top-0 h-screen w-full z-50 flex items-center md:px-6",
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
            <DialogPrimitive.Content
              ref={ref}
              className={cn(
                "relative overflow-y-auto md:h-auto grid content-start items w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:ease-in data-[state=closed]:ease-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg",
                align == "top" &&
                  "data-[state=closed]:slide-out-to-top-[28%] data-[state=open]:slide-in-from-top-[28%]",
                align == "bottom" &&
                  "data-[state=closed]:slide-out-to-bottom-[28%] data-[state=open]:slide-in-from-bottom-[28%]",
                !forceAsDialog && "h-screen",
                !forceAsDialog && isMobile && "max-w-full!",
                className,
              )}
              {...props}
            >
              {!hideX ? (
                <>
                  {children}
                  <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                    <X className="w-4 h-4" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </>
              ) : (
                children
              )}
            </DialogPrimitive.Content>
          </div>
        </div>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
