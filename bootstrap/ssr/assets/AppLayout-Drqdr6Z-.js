import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import "./command-BSnyCa9u.js";
import * as React from "react";
import React__default, { useEffect, memo, useMemo, Fragment as Fragment$1, forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Building2Icon, ChevronsUpDown, Plus, ChevronRight, LayoutDashboard, PackageIcon, ShoppingBagIcon, Receipt, HandCoins, StampIcon, Users2, Settings2, MoreHorizontal, UserCog2, LogOut } from "lucide-react";
import { c as cn, n as getCookieByName, o as checkUrlPath } from "./utils-ClCZGsDL.js";
import { cva } from "class-variance-authority";
import { c as TooltipProvider, T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { S as Skeleton } from "./skeleton-IN0PLOYc.js";
import { Slot } from "@radix-ui/react-slot";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, d as DropdownMenuLabel, c as DropdownMenuItem, e as DropdownMenuShortcut, f as DropdownMenuSeparator, g as DropdownMenuGroup, T as ToggleTheme } from "./ToggleTheme-BSs-sHS2.js";
import { usePage, Link, router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Collapsible as Collapsible$1 } from "radix-ui";
import { P as Popover, a as PopoverTrigger, b as PopoverContent } from "./popover-CziqY8mR.js";
import { L as Link$1 } from "./Link-p0Z4AKax.js";
import { h as useTheme, M as MasterLayout } from "./MasterLayout-CRsmljQs.js";
import { A as Avatar, a as AvatarImage, b as AvatarFallback } from "./avatar-_KK8H2Pc.js";
function Collapsible({ ...props }) {
  return /* @__PURE__ */ jsx(Collapsible$1.Root, { "data-slot": "collapsible", ...props });
}
function CollapsibleTrigger({ ...props }) {
  return /* @__PURE__ */ jsx(
    Collapsible$1.CollapsibleTrigger,
    {
      "data-slot": "collapsible-trigger",
      ...props
    }
  );
}
function CollapsibleContent({ className, children, ...props }) {
  return /* @__PURE__ */ jsx(
    Collapsible$1.CollapsibleContent,
    {
      "data-slot": "collapsible-content",
      className: cn(
        "overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      ),
      ...props,
      children
    }
  );
}
const Sheet = DialogPrimitive.Root;
const SheetPortal = DialogPrimitive.Portal;
const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Overlay,
  {
    className: cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    ),
    ...props,
    ref
  }
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
      }
    },
    defaultVariants: {
      side: "right"
    }
  }
);
const SheetContent = React.forwardRef(
  ({ side = "right", className, children, ...props }, ref) => /* @__PURE__ */ jsxs(SheetPortal, { children: [
    /* @__PURE__ */ jsx(SheetOverlay, {}),
    /* @__PURE__ */ jsxs(
      DialogPrimitive.Content,
      {
        ref,
        className: cn(sheetVariants({ side }), className),
        ...props,
        children: [
          children,
          /* @__PURE__ */ jsxs(DialogPrimitive.Close, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary", children: [
            /* @__PURE__ */ jsx(X, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] })
);
SheetContent.displayName = DialogPrimitive.Content.displayName;
const SheetTitle = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Title,
  {
    ref,
    className: cn("text-lg font-semibold text-foreground", className),
    ...props
  }
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;
const SheetDescription = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Description,
  {
    ref,
    className: cn("text-sm text-muted-foreground", className),
    ...props
  }
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;
const Separator = React.forwardRef(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => /* @__PURE__ */ jsx(
    SeparatorPrimitive.Root,
    {
      ref,
      decorative,
      orientation,
      className: cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      ),
      ...props
    }
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;
function useScreen(minWidth) {
  const [isMatch, setIsMatch] = React.useState(void 0);
  React.useEffect(() => {
    const mql = window.matchMedia(`(width >= ${minWidth})`);
    const onChange = (e) => {
      const isMatch2 = e.matches;
      setIsMatch(isMatch2);
    };
    mql.addEventListener("change", onChange);
    setIsMatch(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return !!isMatch;
}
const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SidebarContext = React.createContext(null);
function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}
const SidebarProvider = React.forwardRef(
  ({
    defaultOpen = true,
    open: openProp,
    onOpenChange: setOpenProp,
    className,
    style,
    children,
    ...props
  }, ref) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);
    const [_open, _setOpen] = React.useState(
      getCookieByName(SIDEBAR_COOKIE_NAME) === null ? defaultOpen : getCookieByName(SIDEBAR_COOKIE_NAME) === "true"
    );
    const open = openProp ?? _open;
    const setOpen = React.useCallback(
      (value) => {
        const openState = typeof value === "function" ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(openState);
        } else {
          _setOpen(openState);
        }
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open]
    );
    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((open2) => !open2) : setOpen((open2) => !open2);
    }, [isMobile, setOpen, setOpenMobile]);
    React.useEffect(() => {
      const handleKeyDown = (event) => {
        if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar]);
    const state = open ? "expanded" : "collapsed";
    const contextValue = React.useMemo(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar
      }),
      [
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar
      ]
    );
    return /* @__PURE__ */ jsx(SidebarContext.Provider, { value: contextValue, children: /* @__PURE__ */ jsx(TooltipProvider, { delayDuration: 0, children: /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          ...style
        },
        className: cn(
          "group/sidebar-wrapper flex absolute w-full top-0 bottom-0  has-data-[variant=inset]:bg-sidebar",
          className
        ),
        ref,
        ...props,
        children
      }
    ) }) });
  }
);
SidebarProvider.displayName = "SidebarProvider";
const Sidebar = React.forwardRef(
  ({
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    className,
    children,
    ...props
  }, ref) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
    if (collapsible === "none") {
      return /* @__PURE__ */ jsx(
        "div",
        {
          className: cn(
            "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
            className
          ),
          ref,
          ...props,
          children
        }
      );
    }
    if (isMobile) {
      return /* @__PURE__ */ jsxs(Sheet, { open: openMobile, onOpenChange: setOpenMobile, ...props, children: [
        /* @__PURE__ */ jsx(SheetTitle, {}),
        /* @__PURE__ */ jsx(SheetDescription, {}),
        /* @__PURE__ */ jsx(
          SheetContent,
          {
            "data-sidebar": "sidebar",
            "data-mobile": "true",
            className: "w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden",
            style: {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE
            },
            side,
            children: /* @__PURE__ */ jsx("div", { className: "flex flex-col w-full h-full", children })
          }
        )
      ] });
    }
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        className: "relative hidden group peer md:block text-sidebar-foreground print:hidden",
        "data-state": state,
        "data-collapsible": state === "collapsed" ? collapsible : "",
        "data-variant": variant,
        "data-side": side,
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: cn(
                "duration-200 relative h-svh w-(--sidebar-width) bg-transparent transition-[width] ease-linear",
                "group-data-[collapsible=offcanvas]:w-0",
                "group-data-[side=right]:rotate-180",
                variant === "floating" || variant === "inset" ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
              )
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: cn(
                "duration-200 fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] ease-linear md:flex",
                // side === "left"
                //   ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
                //   : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
                // Adjust the padding for floating and inset variants.
                variant === "floating" || variant === "inset" ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l border-muted-foreground/50",
                className
              ),
              ...props,
              children: /* @__PURE__ */ jsx(
                "div",
                {
                  "data-sidebar": "sidebar",
                  className: "flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow",
                  children
                }
              )
            }
          )
        ]
      }
    );
  }
);
Sidebar.displayName = "Sidebar";
const SidebarTrigger = React.forwardRef(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();
    const isLargeDesktop = useScreen("108rem");
    return /* @__PURE__ */ jsxs(
      Button,
      {
        ref,
        "data-sidebar": "trigger",
        variant: "ghost",
        size: "icon",
        className: cn("h-7 w-7", isLargeDesktop && "hidden!", className),
        onClick: (event) => {
          onClick == null ? void 0 : onClick(event);
          toggleSidebar();
        },
        ...props,
        children: [
          /* @__PURE__ */ jsx(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              viewBox: "0 0 24 24",
              className: "size-4",
              children: /* @__PURE__ */ jsx("path", { fill: "currentColor", d: "M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" })
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Toggle Sidebar" })
        ]
      }
    );
  }
);
SidebarTrigger.displayName = "SidebarTrigger";
const SidebarRail = React.forwardRef(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  const isLargeDesktop = useScreen("108rem");
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      "data-sidebar": "rail",
      "aria-label": "Toggle Sidebar",
      tabIndex: -1,
      onClick: toggleSidebar,
      title: "Toggle Sidebar",
      className: cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        isLargeDesktop && "hidden!",
        className
      ),
      ...props
    }
  );
});
SidebarRail.displayName = "SidebarRail";
const SidebarInset = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    "main",
    {
      ref,
      className: cn(
        "print:p-0",
        "relative flex min-h-screen flex-1 flex-col bg-background w-full max-w-full overflow-x-hidden overflow-y-hidden",
        "peer-data-[variant=inset]:min-h-[calc(100svh-(--spacing(4)))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className
      ),
      ...props
    }
  );
});
SidebarInset.displayName = "SidebarInset";
const SidebarInput = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    Input,
    {
      ref,
      "data-sidebar": "input",
      className: cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      ),
      ...props
    }
  );
});
SidebarInput.displayName = "SidebarInput";
const SidebarHeader = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      "data-sidebar": "header",
      className: cn("flex flex-col gap-2 p-2", className),
      ...props
    }
  );
});
SidebarHeader.displayName = "SidebarHeader";
const SidebarFooter = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      "data-sidebar": "footer",
      className: cn("flex flex-col gap-2 p-2", className),
      ...props
    }
  );
});
SidebarFooter.displayName = "SidebarFooter";
const SidebarSeparator = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    Separator,
    {
      ref,
      "data-sidebar": "separator",
      className: cn("mx-2 w-auto bg-sidebar-border", className),
      ...props
    }
  );
});
SidebarSeparator.displayName = "SidebarSeparator";
const SidebarContent = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      "data-sidebar": "content",
      className: cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      ),
      ...props
    }
  );
});
SidebarContent.displayName = "SidebarContent";
const SidebarGroup = React.forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      "data-sidebar": "group",
      className: cn("relative flex w-full min-w-0 flex-col p-2", className),
      ...props
    }
  );
});
SidebarGroup.displayName = "SidebarGroup";
const SidebarGroupLabel = React.forwardRef(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return /* @__PURE__ */ jsx(
      Comp,
      {
        ref,
        "data-sidebar": "group-label",
        className: cn(
          "duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
          className
        ),
        ...props
      }
    );
  }
);
SidebarGroupLabel.displayName = "SidebarGroupLabel";
const SidebarGroupAction = React.forwardRef(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsx(
      Comp,
      {
        ref,
        "data-sidebar": "group-action",
        className: cn(
          "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          // Increases the hit area of the button on mobile.
          "after:absolute after:-inset-2 after:md:hidden",
          "group-data-[collapsible=icon]:hidden",
          className
        ),
        ...props
      }
    );
  }
);
SidebarGroupAction.displayName = "SidebarGroupAction";
const SidebarGroupContent = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "div",
  {
    ref,
    "data-sidebar": "group-content",
    className: cn("w-full text-sm", className),
    ...props
  }
));
SidebarGroupContent.displayName = "SidebarGroupContent";
const SidebarMenu = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "ul",
  {
    ref,
    "data-sidebar": "menu",
    className: cn("flex w-full min-w-0 flex-col gap-1", className),
    ...props
  }
));
SidebarMenu.displayName = "SidebarMenu";
const SidebarMenuItem = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "li",
  {
    ref,
    "data-sidebar": "menu-item",
    className: cn("group/menu-item relative", className),
    ...props
  }
));
SidebarMenuItem.displayName = "SidebarMenuItem";
const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline: "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]"
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const SidebarMenuButton = React.forwardRef(
  ({
    asChild = false,
    isActive = false,
    variant = "default",
    size = "default",
    tooltip,
    className,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button";
    const { isMobile, state } = useSidebar();
    const button = /* @__PURE__ */ jsx(
      Comp,
      {
        ref,
        "data-sidebar": "menu-button",
        "data-size": size,
        "data-active": isActive,
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
        ...props
      }
    );
    if (!tooltip) {
      return button;
    }
    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip
      };
    }
    return /* @__PURE__ */ jsxs(Tooltip, { children: [
      /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: button }),
      /* @__PURE__ */ jsx(
        TooltipContent,
        {
          side: "right",
          align: "center",
          hidden: state !== "collapsed" || isMobile,
          ...tooltip
        }
      )
    ] });
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";
const SidebarMenuAction = React.forwardRef(
  ({ className, asChild = false, showOnHover = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsx(
      Comp,
      {
        ref,
        "data-sidebar": "menu-action",
        className: cn(
          "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
          // Increases the hit area of the button on mobile.
          "after:absolute after:-inset-2 after:md:hidden",
          "peer-data-[size=sm]/menu-button:top-1",
          "peer-data-[size=default]/menu-button:top-1.5",
          "peer-data-[size=lg]/menu-button:top-2.5",
          "group-data-[collapsible=icon]:hidden",
          showOnHover && "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
          className
        ),
        ...props
      }
    );
  }
);
SidebarMenuAction.displayName = "SidebarMenuAction";
const SidebarMenuBadge = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "div",
  {
    ref,
    "data-sidebar": "menu-badge",
    className: cn(
      "absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "peer-data-[size=sm]/menu-button:top-1",
      "peer-data-[size=default]/menu-button:top-1.5",
      "peer-data-[size=lg]/menu-button:top-2.5",
      "group-data-[collapsible=icon]:hidden",
      className
    ),
    ...props
  }
));
SidebarMenuBadge.displayName = "SidebarMenuBadge";
const SidebarMenuSkeleton = React.forwardRef(
  ({ className, showIcon = false, ...props }, ref) => {
    const width = React.useMemo(() => {
      return `${Math.floor(Math.random() * 40) + 50}%`;
    }, []);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        "data-sidebar": "menu-skeleton",
        className: cn("rounded-md h-8 flex gap-2 px-2 items-center", className),
        ...props,
        children: [
          showIcon && /* @__PURE__ */ jsx(
            Skeleton,
            {
              className: "rounded-md size-4",
              "data-sidebar": "menu-skeleton-icon"
            }
          ),
          /* @__PURE__ */ jsx(
            Skeleton,
            {
              className: "h-4 flex-1 max-w-(--skeleton-width)",
              "data-sidebar": "menu-skeleton-text",
              style: {
                "--skeleton-width": width
              }
            }
          )
        ]
      }
    );
  }
);
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";
const SidebarMenuSub = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "ul",
  {
    ref,
    "data-sidebar": "menu-sub",
    className: cn(
      "ml-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5",
      "group-data-[collapsible=icon]:hidden",
      className
    ),
    ...props
  }
));
SidebarMenuSub.displayName = "SidebarMenuSub";
const SidebarMenuSubItem = React.forwardRef(({ ...props }, ref) => /* @__PURE__ */ jsx("li", { ref, ...props }));
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";
const SidebarMenuSubButton = React.forwardRef(
  ({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";
    return /* @__PURE__ */ jsx(
      Comp,
      {
        ref,
        "data-sidebar": "menu-sub-button",
        "data-size": size,
        "data-active": isActive,
        className: cn(
          "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
          "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
          size === "sm" && "text-xs",
          size === "md" && "text-sm",
          "group-data-[collapsible=icon]:hidden",
          className
        ),
        ...props
      }
    );
  }
);
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";
const BranchSwitcher = React.memo(function BranchSwitcher2() {
  const route = window.route;
  const { branches, currentBranch } = usePage().props.branchSettings;
  const { t } = useLaravelReactI18n();
  const { isMobile } = useSidebar();
  const [activeBranch, setActiveBranch] = React.useState(currentBranch);
  React.useEffect(() => {
    setActiveBranch(currentBranch);
  }, [branches, currentBranch]);
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key;
      if ((event.metaKey || event.ctrlKey) && key <= branches.length) {
        event.preventDefault();
        const branch = branches[key - 1];
        router.put(
          route("branch.switch", branch.id),
          {},
          {
            preserveScroll: false,
            preserveState: false,
            replace: true
          }
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  return /* @__PURE__ */ jsx(SidebarMenu, { children: /* @__PURE__ */ jsx(SidebarMenuItem, { children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
      SidebarMenuButton,
      {
        size: "lg",
        className: "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground ",
        children: [
          /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center rounded-lg aspect-square size-8 -ml-2 bg-sidebar-foreground dark:text-muted! text-sidebar-primary-foreground", children: /* @__PURE__ */ jsx(Building2Icon, { className: "size-5" }) }),
          /* @__PURE__ */ jsx("div", { className: "grid flex-1 text-sm leading-tight text-left", children: /* @__PURE__ */ jsx("span", { className: "font-semibold truncate", children: activeBranch == null ? void 0 : activeBranch.name }) }),
          /* @__PURE__ */ jsx(ChevronsUpDown, { className: "ml-auto" })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(
      DropdownMenuContent,
      {
        className: "w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg",
        align: "start",
        side: isMobile ? "bottom" : "right",
        sideOffset: 4,
        children: [
          /* @__PURE__ */ jsx(DropdownMenuLabel, { className: "text-xs text-muted-foreground", children: t("core.branch.branches") }),
          branches.map((branch, index) => /* @__PURE__ */ jsx(
            DropdownMenuItem,
            {
              className: "w-full gap-2 p-2",
              asChild: true,
              children: /* @__PURE__ */ jsxs(
                Link,
                {
                  method: "put",
                  as: "button",
                  href: route("branch.switch", branch.id),
                  children: [
                    branch.name,
                    index < 9 && /* @__PURE__ */ jsx(DropdownMenuShortcut, { children: /* @__PURE__ */ jsxs("kbd", { children: [
                      "Ctrl+",
                      index + 1
                    ] }) })
                  ]
                }
              )
            },
            branch.name
          )),
          /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
          /* @__PURE__ */ jsx(DropdownMenuItem, { className: "w-full gap-2 p-2", asChild: true, children: /* @__PURE__ */ jsxs(Link, { href: route("branches.index"), as: "button", children: [
            /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center border rounded-md size-6 bg-background", children: /* @__PURE__ */ jsx(Plus, { className: "size-4" }) }),
            /* @__PURE__ */ jsx("div", { className: "font-medium text-muted-foreground", children: t("core.branch.add_branch") })
          ] }) })
        ]
      }
    )
  ] }) }) });
});
function NavMain({ items }) {
  const isMobile = useIsMobile();
  const isLargeDesktop = useScreen("108rem");
  const { open, setOpen } = useSidebar();
  useEffect(() => {
    setOpen(isLargeDesktop);
  }, [isLargeDesktop]);
  return /* @__PURE__ */ jsx(SidebarGroup, { children: /* @__PURE__ */ jsx(SidebarMenu, { children: items.map((item) => {
    if (item.items && Array.isArray(item.items)) {
      const subItems = item.items.map((subItem) => ({
        ...subItem,
        isActive: checkUrlPath(subItem.urlPattern)
      }));
      const isActive2 = subItems.some((subItem) => subItem.isActive);
      return /* @__PURE__ */ jsx(
        Collapsible,
        {
          asChild: true,
          defaultOpen: isActive2,
          className: "group/collapsible",
          children: /* @__PURE__ */ jsx(Popover, { asChild: true, children: /* @__PURE__ */ jsx(SidebarMenuItem, { children: open || isMobile ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(CollapsibleTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
              SidebarMenuButton,
              {
                tooltip: item.title,
                isActive: isActive2 ?? false,
                className: "group",
                children: [
                  item.icon,
                  /* @__PURE__ */ jsx("span", { children: item.title }),
                  /* @__PURE__ */ jsx(ChevronRight, { className: "ml-auto transition-transform duration-200 group-data-[state=open]:rotate-90" })
                ]
              }
            ) }),
            /* @__PURE__ */ jsx(CollapsibleContent, { children: /* @__PURE__ */ jsx(SidebarMenuSub, { children: subItems == null ? void 0 : subItems.map((subItem) => /* @__PURE__ */ jsx(SidebarMenuSubItem, { children: /* @__PURE__ */ jsx(
              SidebarMenuSubButton,
              {
                asChild: true,
                isActive: subItem.isActive ?? false,
                children: /* @__PURE__ */ jsx(Link$1, { href: subItem.url, children: /* @__PURE__ */ jsx("span", { children: subItem.title }) })
              }
            ) }, subItem.title)) }) })
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
              SidebarMenuButton,
              {
                tooltip: item.title,
                isActive: isActive2 ?? false,
                children: [
                  item.icon,
                  /* @__PURE__ */ jsx("span", { children: item.title }),
                  /* @__PURE__ */ jsx(ChevronRight, { className: "ml-auto transition-transform duration-200 " })
                ]
              }
            ) }),
            /* @__PURE__ */ jsxs(
              PopoverContent,
              {
                side: "right",
                align: "start",
                className: "w-56 p-2 rounded-lg ",
                children: [
                  /* @__PURE__ */ jsx("div", { className: "px-2 pt-1 pb-2 mb-1 space-y-2 border-b border-muted-foreground/30", children: /* @__PURE__ */ jsx("h4", { className: "font-medium leading-none", children: item.title }) }),
                  subItems == null ? void 0 : subItems.map((subItem) => /* @__PURE__ */ jsx(
                    SidebarMenuButton,
                    {
                      asChild: true,
                      isActive: subItem.isActive ?? false,
                      className: "mt-1",
                      children: /* @__PURE__ */ jsx(Link$1, { href: subItem.url, children: /* @__PURE__ */ jsx("span", { children: subItem.title }) })
                    },
                    subItem.title
                  ))
                ]
              }
            )
          ] }) }) })
        },
        item.title
      );
    }
    const isActive = checkUrlPath(item.urlPattern);
    return /* @__PURE__ */ jsx(SidebarMenuItem, { children: /* @__PURE__ */ jsx(
      SidebarMenuButton,
      {
        tooltip: item.title,
        asChild: true,
        isActive: isActive ?? false,
        children: /* @__PURE__ */ jsxs(Link$1, { href: item.url, children: [
          item.icon,
          /* @__PURE__ */ jsx("span", { children: item.title })
        ] })
      }
    ) }, item.title);
  }) }) });
}
const navList = [
  {
    title: "Dashboard",
    url: "/dashboard",
    urlPattern: "/dashboard*",
    icon: /* @__PURE__ */ jsx(LayoutDashboard, {})
  },
  {
    title: "Inventories",
    icon: /* @__PURE__ */ jsx(PackageIcon, {}),
    items: [
      {
        title: "Items",
        url: "/items",
        urlPattern: "/items/*"
      },
      {
        title: "Item Alternatives",
        url: "/itemAlternatives",
        urlPattern: "/itemAlternatives/*"
      },
      {
        title: "Warehouses",
        url: "/warehouses",
        urlPattern: "/warehouses/*"
      },
      {
        title: "Attributes",
        url: "/attributes",
        urlPattern: "/attributes/*"
      },
      {
        title: "Categories",
        url: "/categories",
        urlPattern: "/categories/*"
      },
      {
        title: "Units",
        url: "/units",
        urlPattern: "/units/*"
      },
      {
        title: "Stock Entries",
        url: "/stockEntries",
        urlPattern: "/stockEntries/*"
      },
      {
        title: "Delivery Notes",
        url: "/deliveryNotes",
        urlPattern: "/deliveryNotes/*"
      }
    ]
  },
  {
    title: "Services",
    icon: /* @__PURE__ */ jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 32", children: /* @__PURE__ */ jsx(
      "path",
      {
        fill: "currentColor",
        d: "M21.5 2.5v1.406a5.6 5.6 0 0 0-2.28.938l-1.032-.97l-1.375 1.47l1 .937a5.7 5.7 0 0 0-.907 2.22H15.5v2h1.406c.146.83.474 1.586.938 2.25l-1.063 1.03l1.44 1.44l1.03-1.064c.664.464 1.42.792 2.25.938V16.5h2v-1.406a5.7 5.7 0 0 0 2.22-.906l.936 1l1.47-1.376l-.97-1.03c.47-.67.79-1.445.938-2.282H29.5v-2h-1.406a5.6 5.6 0 0 0-.938-2.25l.938-.938l-1.407-1.406l-.937.938a5.6 5.6 0 0 0-2.25-.938V2.5zm1 3.313A3.664 3.664 0 0 1 26.188 9.5c0 2.055-1.633 3.688-3.688 3.688s-3.688-1.633-3.688-3.688s1.633-3.688 3.688-3.688zM9.53 11.718l-1.842.75l.718 1.81a6.94 6.94 0 0 0-2.344 2.314l-1.78-.72l-.75 1.845l1.78.718a6.8 6.8 0 0 0-.218 1.656c0 .57.085 1.126.218 1.656l-1.78.72l.75 1.843l1.78-.72a6.9 6.9 0 0 0 2.344 2.345l-.72 1.78l1.845.75l.72-1.78a6.8 6.8 0 0 0 1.656.218c.57 0 1.128-.085 1.656-.218l.72 1.78l1.843-.75l-.72-1.78a6.9 6.9 0 0 0 2.314-2.344l1.81.718l.75-1.843l-1.81-.72c.13-.53.218-1.087.218-1.656c0-.57-.087-1.128-.22-1.657l1.813-.718l-.75-1.845l-1.81.72a6.9 6.9 0 0 0-2.314-2.314l.72-1.81l-1.845-.75l-.717 1.81a7 7 0 0 0-1.657-.217c-.57 0-1.126.086-1.656.218l-.72-1.81zm2.376 3.592c2.663 0 4.78 2.12 4.78 4.782c.002 2.663-2.117 4.812-4.78 4.812a4.806 4.806 0 0 1-4.812-4.812c0-2.663 2.15-4.782 4.812-4.782"
      }
    ) }),
    items: [
      {
        title: "Work Orders",
        url: "/workOrders",
        urlPattern: "/workOrders/*"
      }
    ]
  },
  {
    title: "Purchases",
    icon: /* @__PURE__ */ jsx(ShoppingBagIcon, {}),
    items: [
      {
        title: "Suppliers",
        url: "/suppliers",
        urlPattern: "/suppliers/*"
      },
      {
        title: "Purchase Receipts",
        url: "/purchaseReceipts",
        urlPattern: "/purchaseReceipts/*"
      },
      {
        title: "Purchase Requests",
        url: "/purchaseRequests",
        urlPattern: "/purchaseRequests/*"
      },
      {
        title: "Purchase Orders",
        url: "/purchaseOrders",
        urlPattern: "/purchaseOrders/*"
      },
      {
        title: "Purchase Returns",
        url: "/purchaseReturns",
        urlPattern: "/purchaseReturns/*"
      }
    ]
  },
  {
    title: "Customers",
    url: "/customers",
    urlPattern: "/customers/*",
    icon: /* @__PURE__ */ jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", children: [
      /* @__PURE__ */ jsx(
        "path",
        {
          fill: "currentColor",
          d: "M13.88 6.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0-4.5 0m-2.14 6.41a.23.23 0 0 0 0 .23a.23.23 0 0 0 .26.11h8.39a.19.19 0 0 0 .16-.08a.2.2 0 0 0 0-.17a4.63 4.63 0 0 0-8.81-.09"
        }
      ),
      /* @__PURE__ */ jsx(
        "path",
        {
          fill: "currentColor",
          d: "M22.38 16.5a1 1 0 0 0 0-2H10.12a.5.5 0 0 1-.5-.5v-1.5a4.5 4.5 0 1 0-9 0V16a.5.5 0 0 0 .5.5h1a.49.49 0 0 1 .5.46L3.09 23a.49.49 0 0 0 .5.46h3.07a.5.5 0 0 0 .5-.46l.43-6a.49.49 0 0 1 .5-.46ZM2.13 3.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0"
        }
      )
    ] })
  },
  {
    title: "Sales",
    icon: /* @__PURE__ */ jsx(Receipt, {}),
    items: [
      {
        title: "Sales Orders",
        url: "/salesOrders",
        urlPattern: "/salesOrders/*"
      },
      {
        title: "Internal Orders",
        url: "/internalOrders",
        urlPattern: "/internalOrders/*"
      },
      {
        title: "Sales Returns",
        url: "/salesReturns",
        urlPattern: "/salesReturns/*"
      }
    ]
  },
  {
    title: "Finances",
    icon: /* @__PURE__ */ jsx(HandCoins, {}),
    items: [
      {
        title: "Accounts",
        url: "/accounts",
        urlPattern: "/accounts/*"
      },
      {
        title: "Payment Methods",
        url: "/paymentMethods",
        urlPattern: "/paymentMethods/*"
      },
      {
        title: "Payment Terms",
        url: "/paymentTerms",
        urlPattern: "/paymentTerms/*"
      },
      {
        title: "Payment Entries",
        url: "/paymentEntries",
        urlPattern: "/paymentEntries/*"
      },
      {
        title: "Purchase Invoices",
        url: "/purchaseInvoices",
        urlPattern: "/purchaseInvoices/*"
      },
      {
        title: "Sales Invoices",
        url: "/salesInvoices",
        urlPattern: "/salesInvoices/*"
      },
      {
        title: "Taxes",
        url: "/taxes",
        urlPattern: "/taxes/*"
      },
      {
        title: "General Ledgers",
        url: "/generalLedgers",
        urlPattern: "/generalLedgers/*"
      }
    ]
  },
  {
    title: "Approvals",
    icon: /* @__PURE__ */ jsx(StampIcon, {}),
    url: "/approvals",
    urlPattern: "/approvals/*"
  },
  {
    title: "Users",
    icon: /* @__PURE__ */ jsx(Users2, {}),
    items: [
      {
        title: "Manage Users",
        url: "/users",
        urlPattern: "/users/*"
      },
      {
        title: "Roles",
        url: "/roles",
        urlPattern: "/roles/*"
      }
    ]
  },
  {
    title: "Settings",
    icon: /* @__PURE__ */ jsx(Settings2, {}),
    items: [
      {
        title: "Company",
        url: "/settings/company",
        urlPattern: "/settings/company/*"
      },
      {
        title: "Branches",
        url: "/settings/branches",
        urlPattern: "/settings/branches/*"
      },
      {
        title: "Formating Series",
        url: "/settings/formatingSeries",
        urlPattern: "/settings/formatingSeries/*"
      },
      {
        title: "Approval Schemes",
        url: "/settings/approvalSchemes",
        urlPattern: "/settings/approvalSchemes/*"
      },
      {
        title: "Print Templates",
        url: "/settings/printTemplates",
        urlPattern: "/settings/printTemplates/*"
      },
      {
        title: "Database Backup",
        url: "/settings/backup",
        urlPattern: "/settings/backup/*"
      }
    ]
  }
];
const AppSidebar = React.memo(function AppSidebar2({ ...props }) {
  return /* @__PURE__ */ jsxs(Sidebar, { collapsible: "icon", ...props, children: [
    /* @__PURE__ */ jsx(SidebarHeader, { children: /* @__PURE__ */ jsx(BranchSwitcher, {}) }),
    /* @__PURE__ */ jsx(SidebarContent, { children: /* @__PURE__ */ jsx(NavMain, { items: navList }) }),
    /* @__PURE__ */ jsx(SidebarRail, {})
  ] });
});
const Breadcrumb = React.forwardRef(({ ...props }, ref) => /* @__PURE__ */ jsx("nav", { ref, "aria-label": "breadcrumb", ...props }));
Breadcrumb.displayName = "Breadcrumb";
const BreadcrumbList = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "ol",
  {
    ref,
    className: cn(
      "flex items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
      className
    ),
    ...props
  }
));
BreadcrumbList.displayName = "BreadcrumbList";
const BreadcrumbItem = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "li",
  {
    ref,
    className: cn("inline-flex items-center gap-1.5", className),
    ...props
  }
));
BreadcrumbItem.displayName = "BreadcrumbItem";
const BreadcrumbLink = React.forwardRef(
  ({ asChild, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";
    return /* @__PURE__ */ jsx(
      Comp,
      {
        ref,
        className: cn("transition-colors hover:text-foreground", className),
        ...props
      }
    );
  }
);
BreadcrumbLink.displayName = "BreadcrumbLink";
const BreadcrumbPage = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "span",
  {
    ref,
    role: "link",
    "aria-disabled": "true",
    "aria-current": "page",
    className: cn("font-normal text-foreground", className),
    ...props
  }
));
BreadcrumbPage.displayName = "BreadcrumbPage";
const BreadcrumbSeparator = ({ children, className, ...props }) => /* @__PURE__ */ jsx(
  "li",
  {
    role: "presentation",
    "aria-hidden": "true",
    className: cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className),
    ...props,
    children: children ?? /* @__PURE__ */ jsx(ChevronRight, {})
  }
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";
const BreadcrumbEllipsis = ({ className, ...props }) => /* @__PURE__ */ jsxs(
  "span",
  {
    role: "presentation",
    "aria-hidden": "true",
    className: cn("flex h-9 w-9 items-center justify-center", className),
    ...props,
    children: [
      /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-4 w-4" }),
      /* @__PURE__ */ jsx("span", { className: "sr-only", children: "More" })
    ]
  }
);
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";
function Notifications() {
  return /* @__PURE__ */ jsxs(Popover, { children: [
    /* @__PURE__ */ jsx(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "relative rounded-lg p-2.5 text-sm text-gray-500 hover:bg-gray-100 hover:outline-none dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700",
        children: [
          /* @__PURE__ */ jsx(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              className: "size-5",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx(
                "path",
                {
                  fill: "currentColor",
                  d: "M21 19v1H3v-1l2-2v-6c0-3.1 2.03-5.83 5-6.71V4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v.29c2.97.88 5 3.61 5 6.71v6zm-7 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: "notifications" }),
          /* @__PURE__ */ jsx("span", { className: "absolute left-1/2 top-0.5 rounded-full bg-red-600 px-1 text-xs font-medium leading-4 text-white", children: "8" })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(
      PopoverContent,
      {
        side: "bottom",
        align: "end",
        className: "p-0! overflow-hidden h-[460px] w-96 flex flex-col",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "sticky top-0 flex items-center justify-between px-4 py-1 bg-white shadow-md dark:bg-gray-800", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-base font-bold", children: "Notifications" }),
            /* @__PURE__ */ jsx("div", { className: "flex gap-x-1", children: /* @__PURE__ */ jsx(Button, { tooltip: "Mark all as read", variant: "gosht", children: /* @__PURE__ */ jsx(
              "svg",
              {
                xmlns: "http://www.w3.org/2000/svg",
                className: "size-5",
                viewBox: "0 0 24 24",
                children: /* @__PURE__ */ jsx(
                  "path",
                  {
                    fill: "currentColor",
                    d: "M21.003 15.578a7 7 0 0 0-.87-1.57a4.1 4.1 0 0 1-.89-1.88c0-2.89 0-3.87-1.58-5.76a5.8 5.8 0 0 0-1.9-1.47l-.73-.35a.3.3 0 0 1-.1-.1a.23.23 0 0 1-.05-.1a2.77 2.77 0 0 0-2.93-2.34a2.77 2.77 0 0 0-2.84 2.29a.3.3 0 0 1-.07.14a.3.3 0 0 1-.09.08l-.78.38a5.6 5.6 0 0 0-1.91 1.48c-1.57 1.88-1.57 2.86-1.57 5.75a3.84 3.84 0 0 1-.82 1.77a6.6 6.6 0 0 0-.88 1.62a2.79 2.79 0 0 0 .26 2.37a2.24 2.24 0 0 0 1.94.85h2.82q.065.404.22.78c.198.497.498.947.88 1.32c.37.38.816.677 1.31.87c.46.188.953.287 1.45.29h.16a4 4 0 0 0 2.79-1.16a4 4 0 0 0 .87-1.31q.152-.384.23-.79h2.94a2.4 2.4 0 0 0 1-.23a2.4 2.4 0 0 0 .88-.76c.226-.322.364-.698.4-1.09a2.2 2.2 0 0 0-.14-1.08m-6-5.28l-2.81 2.83c-.113.124-.253.22-.41.28a1.2 1.2 0 0 1-.49.1a1.26 1.26 0 0 1-.91-.38l-1.41-1.4a.75.75 0 0 1 0-1.06a.74.74 0 0 1 1.06 0l1.26 1.25l2.68-2.68a.75.75 0 1 1 1.06 1.06z"
                  }
                )
              }
            ) }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: " flex flex-col h-full text-center justify-center items-center", children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-lg", children: "Under Development " }),
            /* @__PURE__ */ jsx("p", { children: "Please wait for the next update, thank you." })
          ] })
        ]
      }
    )
  ] });
}
const UserInfo = memo(function UserInfo2() {
  const route = window.route;
  const user = usePage().props.auth.user;
  const alias = user.name.split(" ").slice(0, 2).map((n) => n.charAt(0)).join("");
  return /* @__PURE__ */ jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsx(DropdownMenuTrigger, { className: "inline-flex items-center border-gray-200 rounded-md lg:mx-2 gap-x-2 dark:border-gray-700", children: /* @__PURE__ */ jsxs(Avatar, { className: "rounded-lg size-9", children: [
      user.image && /* @__PURE__ */ jsx(
        AvatarImage,
        {
          src: route("files.preview", user.image) + `?v=${new Date(user.updated_at).getTime()}`,
          alt: user.name
        }
      ),
      /* @__PURE__ */ jsx(AvatarFallback, { className: "text-base font-semibold rounded-full", children: alias })
    ] }) }),
    /* @__PURE__ */ jsxs(
      DropdownMenuContent,
      {
        className: "rounded-lg w-fit min-w-56",
        side: "bottom",
        align: "end",
        sideOffset: 4,
        children: [
          /* @__PURE__ */ jsx(DropdownMenuLabel, { className: "p-0 font-normal", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-1 py-1.5 text-left text-sm", children: [
            /* @__PURE__ */ jsxs(Avatar, { className: "rounded-lg size-12", children: [
              user.image && /* @__PURE__ */ jsx(
                AvatarImage,
                {
                  src: route("files.preview", user.image) + `?v=${new Date(user.updated_at).getTime()}`,
                  alt: user.name
                }
              ),
              /* @__PURE__ */ jsx(AvatarFallback, { className: "text-xl font-semibold rounded-lg", children: alias })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid flex-1 text-base leading-tight text-left", children: [
              /* @__PURE__ */ jsx("span", { className: "font-semibold truncate", children: user.name }),
              /* @__PURE__ */ jsx("span", { className: "text-sm truncate text-foreground/80", children: user.username }),
              /* @__PURE__ */ jsxs("div", { className: "flex p-0.5  rounded-full gap-x-1 items-center text-foreground/80  bg-muted", children: [
                /* @__PURE__ */ jsx(
                  "svg",
                  {
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: "0 0 24 24",
                    className: "size-4",
                    children: /* @__PURE__ */ jsx(
                      "path",
                      {
                        fill: "currentColor",
                        d: "M12.72 2.03A9.99 9.99 0 0 0 2.03 12.72C2.39 18.01 7.01 22 12.31 22H16c.55 0 1-.45 1-1s-.45-1-1-1h-3.67c-3.73 0-7.15-2.42-8.08-6.03c-1.49-5.8 3.91-11.21 9.71-9.71C17.58 5.18 20 8.6 20 12.33v1.1c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57v-1.25c0-2.51-1.78-4.77-4.26-5.12a5.008 5.008 0 0 0-5.66 5.87a5 5 0 0 0 3.72 3.94c1.84.43 3.59-.16 4.74-1.33c.89 1.22 2.67 1.86 4.3 1.21c1.34-.53 2.16-1.9 2.16-3.34v-1.09c0-5.31-3.99-9.93-9.28-10.29M12 15c-1.66 0-3-1.34-3-3s1.34-3 3-3s3 1.34 3 3s-1.34 3-3 3"
                      }
                    )
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "text-sm truncate", children: user.email })
              ] })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
          /* @__PURE__ */ jsx(DropdownMenuGroup, { children: /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs(
            Link$1,
            {
              href: route("users.show", user.id),
              as: "button",
              className: "w-full",
              children: [
                /* @__PURE__ */ jsx(UserCog2, {}),
                "Manage Account"
              ]
            }
          ) }) }),
          /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs(
            Link$1,
            {
              href: route("logout"),
              method: "post",
              as: "button",
              className: "w-full text-red-500 hover:text-red-500!",
              children: [
                /* @__PURE__ */ jsx(LogOut, {}),
                "Log out"
              ]
            }
          ) })
        ]
      }
    )
  ] });
});
const Navbar = memo(function Navbar2({ setShowSearch }) {
  const { t, loading } = useLaravelReactI18n();
  const breadcrumbs = usePage().props.breadcrumbs;
  const isMobile = useIsMobile();
  const breadcrumbsMenu = useMemo(() => {
    var _a;
    if (!breadcrumbs) return null;
    return /* @__PURE__ */ jsx(Breadcrumb, { className: "flex w-full ", children: /* @__PURE__ */ jsx(BreadcrumbList, { className: "flex  w-full pr-6", children: breadcrumbs.length > 1 && (isMobile || breadcrumbs.length > 3) ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(BreadcrumbItem, { children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
        /* @__PURE__ */ jsxs(DropdownMenuTrigger, { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ jsx(BreadcrumbEllipsis, { className: "w-4 h-4" }),
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Toggle menu" })
        ] }),
        /* @__PURE__ */ jsx(DropdownMenuContent, { align: "start", children: breadcrumbs.map((breadcrumb, index) => {
          var _a2;
          if (index === breadcrumbs.length - 1) return null;
          const name = t(
            (_a2 = breadcrumb.name) == null ? void 0 : _a2.replace(/__\(\s*(.*?)\s*\)/g, "$1")
          );
          return /* @__PURE__ */ jsx(
            DropdownMenuItem,
            {
              asChild: true,
              children: /* @__PURE__ */ jsx(Link$1, { href: breadcrumb.link, children: name })
            },
            name + index + "dropdown"
          );
        }) })
      ] }) }),
      /* @__PURE__ */ jsx(BreadcrumbSeparator, { className: "" }),
      /* @__PURE__ */ jsx(BreadcrumbItem, { className: "overflow-hidden block", children: /* @__PURE__ */ jsx(BreadcrumbPage, { className: "truncate block w-full", children: t(
        (_a = breadcrumbs[breadcrumbs.length - 1].name) == null ? void 0 : _a.replace(
          /__\(\s*(.*?)\s*\)/g,
          "$1"
        )
      ) }) })
    ] }) : breadcrumbs.map(
      (breadcrumb, index) => {
        var _a2, _b;
        return index < breadcrumbs.length - 1 ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
          /* @__PURE__ */ jsx(BreadcrumbItem, { className: "hidden md:block overflow-hidden", children: /* @__PURE__ */ jsx(BreadcrumbLink, { asChild: true, children: /* @__PURE__ */ jsx(
            Link$1,
            {
              href: breadcrumb.link,
              className: "truncate block w-full",
              children: t(
                (_a2 = breadcrumb.name) == null ? void 0 : _a2.replace(/__\(\s*(.*?)\s*\)/g, "$1")
              )
            }
          ) }) }),
          /* @__PURE__ */ jsx(BreadcrumbSeparator, { className: "hidden md:inline-block" })
        ] }, breadcrumb.name + index) : /* @__PURE__ */ jsx(
          BreadcrumbItem,
          {
            className: "overflow-hidden block",
            children: /* @__PURE__ */ jsx(BreadcrumbPage, { className: "truncate block w-full", children: t((_b = breadcrumb.name) == null ? void 0 : _b.replace(/__\(\s*(.*?)\s*\)/g, "$1")) })
          },
          breadcrumb.name + index
        );
      }
    ) }) });
  }, [breadcrumbs, isMobile, loading]);
  return /* @__PURE__ */ jsxs("header", { className: "print:hidden overflow-hidden sticky top-0 bg-background z-10 max-w-full w-full border-b border-muted-foreground/50 flex h-16 justify-between shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12", children: [
    /* @__PURE__ */ jsxs("div", { className: "overflow-hidden flex w-full items-center gap-2 px-4", children: [
      /* @__PURE__ */ jsx(SidebarTrigger, { className: "-ml-1" }),
      /* @__PURE__ */ jsx(Separator, { orientation: "vertical", className: "h-4 mr-2" }),
      breadcrumbsMenu
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-1 items-center gap-2 px-4 justify-end", children: [
      /* @__PURE__ */ jsxs(
        Button,
        {
          onClick: () => setShowSearch((open) => !open),
          variant: "outline",
          className: cn(
            "relative h-9 w-fit px-2! md:px-4!  justify-start rounded-[0.5rem] lg:bg-muted/50 text-sm font-normal text-muted-foreground shadow-none lg:w-56 xl:w-64"
          ),
          children: [
            /* @__PURE__ */ jsx("span", { className: "hidden lg:inline-flex", children: "Search ..." }),
            /* @__PURE__ */ jsx(
              "svg",
              {
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                className: "size-4 lg:hidden",
                children: /* @__PURE__ */ jsx(
                  "path",
                  {
                    fill: "currentColor",
                    d: "M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5l-1.5 1.5l-5-5v-.79l-.27-.27A6.52 6.52 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14S14 12 14 9.5S12 5 9.5 5"
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx("kbd", { className: "pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 lg:flex", children: /* @__PURE__ */ jsx("span", { className: "text-xs", children: "Ctrl + J" }) })
          ]
        }
      ),
      /* @__PURE__ */ jsx(ToggleTheme, { className: "size-4" }),
      /* @__PURE__ */ jsx(Notifications, {}),
      /* @__PURE__ */ jsx(UserInfo, {})
    ] })
  ] });
});
const AppLayout = memo(
  forwardRef(function AppLayout2({ className, children, ...props }, ref) {
    const { setTheme } = useTheme();
    const [showSearch, setShowSearch] = React__default.useState(false);
    React__default.useEffect(() => {
      const down = (e) => {
        if (e.key === "k" && (e.metaKey || e.ctrlKey) || e.key === "/") {
          if (e.target instanceof HTMLElement && e.target.isContentEditable || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
            return;
          }
          e.preventDefault();
          setShowSearch((open) => !open);
        }
      };
      document.addEventListener("keydown", down);
      return () => document.removeEventListener("keydown", down);
    }, []);
    React__default.useCallback((command) => {
      setShowSearch(false);
      command();
    }, []);
    return /* @__PURE__ */ jsx(MasterLayout, { children: /* @__PURE__ */ jsx("div", { className: "relative mx-auto max-w-[1920px] print:invisible print:bg-white!", children: /* @__PURE__ */ jsxs(SidebarProvider, { children: [
      /* @__PURE__ */ jsx(AppSidebar, { className: "print:hidden " }),
      /* @__PURE__ */ jsxs(SidebarInset, { children: [
        /* @__PURE__ */ jsx(Navbar, { setShowSearch }),
        /* @__PURE__ */ jsx(
          "div",
          {
            ref,
            ...props,
            className: cn(
              "relative flex flex-col flex-1 max-h-full px-8 py-4 overflow-y-auto ",
              className
            ),
            children
          }
        )
      ] })
    ] }) }) });
  })
);
export {
  AppLayout as A,
  Collapsible as C,
  CollapsibleTrigger as a,
  CollapsibleContent as b
};
