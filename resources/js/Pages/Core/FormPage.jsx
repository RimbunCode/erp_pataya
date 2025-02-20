import "quill/dist/quill.bubble.css";
import "quill-mention/autoregister";

import {
  Children,
  Fragment,
  cloneElement,
  forwardRef,
  memo,
  useMemo,
  useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import AppLayout from "@/Layouts/AppLayout";
import Attachments from "./Components/Attachments";
import Comments from "./Components/Comments";
import Tags from "./Components/Tags";
import { cn } from "@/lib/utils";
import { usePage } from "@inertiajs/react";

const FormPageContentTitle = memo(
  forwardRef(function FormPageTitle({ children, className }, ref) {
    return (
      <h1 ref={ref} className={cn(className, "font-bold text-lg")} role="title">
        {children}
      </h1>
    );
  }),
);

const FormPageContentDescription = memo(
  forwardRef(function FormPageDescription({ children, className }, ref) {
    return (
      <p
        ref={ref}
        className={cn(className, "text-sm font-normal")}
        role="description"
      >
        {children}
      </p>
    );
  }),
);
const FormPageContent = memo(
  forwardRef(function FormPageContent(
    { title, value, isSingle, children, className },
    ref,
  ) {
    const headerChildren = Children.toArray(children).filter((child) => {
      return (
        child?.type == FormPageContentTitle ||
        child?.type == FormPageContentDescription
      );
    });
    if (headerChildren.length > 0 || isSingle) {
      var contentChildren = Children.toArray(children).filter((child) => {
        return !(
          child?.type == FormPageContentTitle ||
          child?.type == FormPageContentDescription
        );
      });
    }
    const haveTitle =
      Children.toArray(children).findIndex(
        (child) => child?.type == FormPageContentTitle,
      ) >= 0;

    return (
      <div
        ref={ref}
        className={cn(className, "px-4 py-4 !mt-0")}
        role="content"
      >
        {headerChildren.length > 0 || isSingle ? (
          <>
            <div className="pb-1 mb-3 border-b border-muted-foreground/25">
              {!haveTitle && (
                <FormPageContentTitle>{title || value}</FormPageContentTitle>
              )}
              {headerChildren}
            </div>
            {contentChildren}
          </>
        ) : (
          children
        )}
      </div>
    );
  }),
);

const FormPageSidebar = memo(
  forwardRef(function FormPageSidebar(
    { hidden = false, children, className },
    ref,
  ) {
    const defaultChildren = useMemo(() => {
      return (
        <ul className={cn("flex w-full min-w-0 flex-col gap-1")}>
          <li role="forminput">
            <Attachments />
          </li>
          <li role="forminput">
            <Tags />
          </li>
        </ul>
      );
    }, []);
    if (hidden) return null;

    const sidebarChildren = !children
      ? defaultChildren
      : typeof children === "function"
        ? children(defaultChildren)
        : children;
    return (
      <div
        ref={ref}
        className={cn(
          className,
          "flex flex-col order-2 lg:col-start-2 lg:row-span-2 h-fit  gap-y-4 lg:sticky lg:top-[73px]",
        )}
      >
        {sidebarChildren}
      </div>
    );
  }),
);

const FormPageBottomBar = memo(
  forwardRef(function FormPageBottomBar(
    { hidden = false, children, className },
    ref,
  ) {
    const defaultChildren = useMemo(() => {
      return <Comments />;
    }, []);
    if (hidden) return null;

    const bottomBarChildren = !children
      ? defaultChildren
      : typeof children === "function"
        ? children(defaultChildren)
        : children;
    return (
      <div
        ref={ref}
        className={cn(
          className,
          "flex flex-col order-3 lg:col-start-1 gap-y-4",
        )}
      >
        {bottomBarChildren}
      </div>
    );
  }),
);
const FormChildren = memo(function FormChildren({
  children,
  className,
  defaultMenu,
  showHeader,
}) {
  const [menuSelected, setMenuSelected] = useState(defaultMenu);
  const contentChildren = Children.toArray(children).filter((child) => {
    return (
      child?.type?.type?.render?.name == FormPageContent.type?.render?.name
    );
  });
  const uniqueChildren = contentChildren.filter((child, index, self) => {
    return (
      child.props.value !== undefined &&
      self.findIndex((c) => c.props.value === child.props.value) === index
    );
  });
  return (
    <div
      className={cn(
        className,
        "flex flex-col order-1 max-w-full  border rounded-xl lg:col-start-1 border-muted-foreground/25",
        "[&_:not(div[role=content])_+_div[role=content]]:border-t-0 [&_div[role=content]:first-child]:!border-t-0 [&_div[role=content]]:border-t [&_div[role=content]]:border-muted-foreground/25",
      )}
    >
      {uniqueChildren.length > 1 ? (
        <Tabs
          value={menuSelected ?? uniqueChildren[0].props.value}
          onValueChange={setMenuSelected}
        >
          <TabsList
            className={cn(
              showHeader ? "top-14" : "top-0",
              "transition-[top] duration-300 ease-in-out sticky z-9 w-full !p-0 h-auto rounded-b-none rounded-t-xl items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b",
            )}
          >
            {Children.map(uniqueChildren, (child) => {
              return (
                <TabsTrigger
                  value={child.props.value}
                  className="text-base border-0 data-[state=active]:font-bold !p-0 !px-4 group rounded-none transition-colors "
                >
                  <span className="pt-2 pb-1 border-transparent w-fit group-[[data-state=active]]:border-foreground border-b transition-colors duration-300 ">
                    {child.props.title || child.props.value}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {Children.map(contentChildren, (child) => {
            if (child?.type?.render?.name == FormPageContent?.render?.name) {
              return (
                <TabsContent value={child.props.value} asChild>
                  {child}
                </TabsContent>
              );
            }
            throw Error("FormPage children only accepts FormPageContent ");
          })}
        </Tabs>
      ) : (
        <>
          {Children.map(contentChildren, (child) => {
            if (child.type == FormPageContent) {
              return cloneElement(child, {
                ...child.props,
                isSingle: true,
              });
            }
            throw Error("FormPage children only accepts FormPageContent ");
          })}
        </>
      )}
    </div>
  );
});

const FormPage = memo(function FormPage({
  disabled,
  title,
  badge,
  controls,
  defaultMenu,
  className,
  onSubmit,
  children,
}) {
  // const permissions = usePage().props.permissions;
  const [showHeader, setShowHeader] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [lastPosition, setLastPosition] = useState(0);
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const position = Math.ceil(
      (scrollTop / (scrollHeight - clientHeight)) * 100,
    );
    setLastPosition((prev) => {
      if (prev === position) return prev;
      setShowHeader(position <= prev);
      return position;
    });
  };
  children = children?.type == Fragment ? children?.props?.children : children;
  const sidebarContent = useMemo(() => {
    const sidebarChildren = Children.toArray(children).filter((child) => {
      return child?.type == FormPageSidebar;
    });
    if (sidebarChildren.length <= 0) return <FormPageSidebar />;
    return Children.only(sidebarChildren[0]);
  }, [children]);
  const bottombarContent = useMemo(() => {
    const bottombarChildren = Children.toArray(children).filter((child) => {
      return child?.type == FormPageBottomBar;
    });
    if (bottombarChildren.length <= 0) return <FormPageBottomBar />;
    return Children.only(bottombarChildren[0]);
  }, [children]);

  return (
    <AppLayout
      data-disabled={disabled}
      className="!pt-0 relative group/form"
      onScroll={handleScroll}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e);
        }}
      >
        <div
          className={cn(
            showHeader ? "top-0" : "-top-16",
            " transition-[top] duration-300 ease-in-out sticky z-10 flex items-center justify-between pt-4 pb-2 border-b gap-x-4 bg-background border-muted-foreground/25",
          )}
        >
          <div className="flex items-center gap-x-2">
            {title && <h1 className="text-xl font-bold">{title}</h1>}
            {badge}
          </div>
          {controls && (
            <div className="flex items-center gap-x-4 ">{controls}</div>
          )}
        </div>
        <div
          className={cn(
            disabled &&
              "[&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
            "relative grid grid-cols-1 auto-rows-max lg:grid-rows-[auto_1fr] lg:grid-cols-[1fr_auto] flex-1 gap-4 mt-4",
          )}
        >
          {sidebarContent}
          <FormChildren
            defaultMenu={defaultMenu}
            className={className}
            showHeader={showHeader}
          >
            {children}
          </FormChildren>
          {bottombarContent}
        </div>
      </form>
    </AppLayout>
  );
});

export {
  FormPage,
  FormPageSidebar,
  FormPageContent,
  FormPageContentTitle,
  FormPageContentDescription,
  FormPageBottomBar,
};
