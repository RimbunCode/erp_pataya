import "quill/dist/quill.bubble.css";
import "quill-mention/autoregister";

import React, {
  Children,
  createContext,
  forwardRef,
  Fragment,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import AppLayout from "@/Layouts/AppLayout";
import Attachments from "./Components/Attachments";
import Comments from "./Components/Comments";
import Tags from "./Components/Tags";
import { cn, generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import {
  AlertDialog,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/Components/ui/alert-dialog";
import { useAlertDraftForm } from "@/Hooks/useDraftForm";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/Components/ui/accordion";

/**
 * @typedef {object} FormPageContentTitleProps
 * @property {React.ReactNode} children
 * @property {string} className
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageContentTitleProps>}
 */
const FormPageContentTitle = memo(
  forwardRef(function FormPageTitle({ children, className }, ref) {
    return (
      <div
        ref={ref}
        className={cn(className, "font-bold text-lg")}
        role="title"
      >
        {children}
      </div>
    );
  }),
);

/**
 * @typedef {object} FormPageContentDescriptionProps
 * @property {React.ReactNode} children
 * @property {string} className
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageContentDescriptionProps>}
 */
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

/**
 * @typedef {object} FormPageContentProps
 * @property {string} title
 * @property {string} value
 * @property {React.ReactNode} children
 * @property {string} className
 * @property {boolean} collapsible
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageContentProps>}
 */
const FormPageContent = memo(
  forwardRef(function FormPageContent(
    { title, value, children, className, collapsible = false },
    ref,
  ) {
    const { menus, addMenu } = useFormPage();
    const [id] = useState(generateRandom(8));
    useEffect(() => {
      addMenu({
        id,
        title,
        value,
      });
    }, []);
    const headerChildren = Children.toArray(children).filter((child) => {
      return (
        child?.type == FormPageContentTitle ||
        child?.type == FormPageContentDescription
      );
    });
    const isSingle = menus.length <= 1;
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
    const Trigger = collapsible
      ? AccordionTrigger
      : (props) => <div {...props} />;
    const Content = collapsible ? AccordionContent : Fragment;
    return (
      <TabsContent value={value} className="mt-0">
        <AccordionItem value={generateRandom(8)} asChild>
          <div
            ref={ref}
            className={cn(className, "px-4 py-4 !mt-0")}
            role="content"
          >
            {headerChildren.length > 0 || isSingle ? (
              <>
                <Trigger className="pt-0 pb-1 mb-3 border-b border-muted-foreground/25">
                  {!haveTitle && (
                    <FormPageContentTitle>
                      {title || value}
                    </FormPageContentTitle>
                  )}
                  {headerChildren}
                </Trigger>
                <Content>{contentChildren}</Content>
              </>
            ) : (
              children
            )}
          </div>
        </AccordionItem>
      </TabsContent>
    );
  }),
);

/**
 * @typedef {object} FormPageBottomBarProps
 * @property {string} defaultMenu Menu yang pertama kali ditampilkan, Beri nilai value sesuai FormPageContent value yang ingin di pilih
 * @property {boolean} showHeader
 * @property {React.ReactNode} children
 * @property {string} className
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageBottomBarProps>}
 */
const FormChildren = memo(
  forwardRef(function FormChildren(
    { children, className, defaultMenu, showHeader },
    ref,
  ) {
    const { menus } = useFormPage();
    const { t } = useLaravelReactI18n();
    const [menuSelected, setMenuSelected] = useState(defaultMenu);

    useImperativeHandle(
      ref,
      () => ({
        setMenuSelected,
      }),
      [],
    );
    return (
      <Accordion type="multiple" className="w-full" asChild>
        <div
          className={cn(
            className,
            "flex flex-col order-1 max-w-full  border rounded-xl lg:col-start-1 border-muted-foreground/25",
            "[&_:not(div[role=content])_+_div[role=content]]:border-t-0 [&_div[role=content]:first-child]:!border-t-0 [&_div[role=content]]:border-t [&_div[role=content]]:border-muted-foreground/25",
          )}
        >
          <Tabs
            value={menuSelected ?? menus?.[0]?.value}
            onValueChange={setMenuSelected}
          >
            <TabsList
              className={cn(
                menus?.length <= 1 ? "hidden" : "",
                showHeader ? "top-14" : "top-0",
                "transition-[top] duration-300 ease-in-out sticky z-9 w-full !p-0 h-auto rounded-b-none rounded-t-xl items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b",
              )}
            >
              {menus.map((child) => {
                return (
                  <TabsTrigger
                    key={child.value}
                    value={child.value}
                    className="text-base border-0 data-[state=active]:font-bold !p-0 !px-4 group rounded-none transition-colors "
                  >
                    <span className="pt-2 pb-1 border-transparent w-fit group-[[data-state=active]]:border-foreground border-b transition-colors duration-300 ">
                      {t(child.title || child.value)}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {children}
          </Tabs>
        </div>
      </Accordion>
    );
  }),
);

const FormPageContext = createContext();

/**
 * @typedef FormPageContextProps
 * @property {object} errors
 * @returns {FormPageContextProps}
 */
const useFormPage = () => useContext(FormPageContext);

/**
 * @callback SidebarContent
 * @property {React.JSX.Element} defaultComp
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} FormPageProps
 * @property {object} errors
 * @property {boolean} isCreate
 * @property {boolean} disabled
 * @property {string} fieldNameTrans untuk translate name attribute
 * @property {string} defaultMenu Menu yang pertama kali ditampilkan, Beri nilai value sesuai FormPageContent value yang ingin di pilih
 * @property {string} title
 * @property {SidebarContent | React.JSX.Element} sidebarContent
 * @property {SidebarContent | React.JSX.Element} bottombarContent
 * @property {React.JSX.Element?} badge jika lebih dari satu bungkus dengan <> </>
 * @property {React.JSX.Element?} controls jika lebih dari satu bungkus dengan <> </>
 * @property {React.ReactNode<FormPageContent>} children
 * @property {React.FormEventHandler} onSubmit
 * @property {string} className
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageProps>}
 * @param {object} props
 * @param {object} props.errors
 * @param {boolean} props.isCreate
 * @param {boolean} props.disabled
 * @param {string} props.fieldNameTrans untuk translate name attribute
 * @param {string} props.defaultMenu Menu yang pertama kali ditampilkan, Beri nilai value sesuai FormPageContent value yang ingin di pilih
 * @param {string} props.title
 * @param {SidebarContent | React.JSX.Element} props.sidebarContent
 * @param {SidebarContent | React.JSX.Element} props.bottombarContent
 * @param {React.JSX.Element?} props.badge jika lebih dari satu bungkus dengan <> </>
 * @param {React.JSX.Element?} props.controls jika lebih dari satu bungkus dengan <> </>
 * @param {React.ReactNode<FormPageContent>} props.children
 * @param {React.FormEventHandler} props.onSubmit
 * @param {string} props.className
 */
const FormPage = memo(
  forwardRef(function FormPage(
    {
      errors,
      disabled,
      isCreate,
      fieldNameTrans,
      title,
      badge,
      controls,
      defaultMenu,
      sidebarContent,
      bottombarContent,
      className,
      onSubmit,
      children,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
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
    const [menus, setMenus] = useState([]);
    const addMenu = useCallback((newItem) => {
      setMenus((prev) => {
        let newItems = [...(prev ?? [])];
        const index = newItems?.findIndex(
          (menu) => menu.value === newItem.value,
        );
        if (index < 0) {
          newItems = [...newItems, newItem];
        }
        return newItems;
      });
    }, []);
    const defaultSidebarChildren = useMemo(() => {
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
    const defaultBottombarChildren = useMemo(() => {
      return <Comments />;
    }, []);

    const sidebarChildren =
      sidebarContent === false
        ? null
        : !sidebarContent
          ? defaultSidebarChildren
          : typeof sidebarContent === "function"
            ? sidebarContent?.(defaultSidebarChildren)
            : sidebarContent;
    const bottombarChildren =
      bottombarContent === false
        ? null
        : !bottombarContent
          ? defaultBottombarChildren
          : typeof bottombarContent === "function"
            ? bottombarContent?.(defaultBottombarChildren)
            : bottombarContent;

    return (
      <AppLayout
        data-disabled={disabled}
        className="!pt-0 relative group/form"
        onScroll={handleScroll}
      >
        <FormPageContext.Provider
          value={{ errors, fieldNameTrans, menus, addMenu }}
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
                <div className="flex items-center gap-x-2 ">{controls}</div>
              )}
            </div>
            {errors && Object.keys(errors).length > 0 && (
              <div className="flex-col w-full mt-4 alert error">
                <h3 className="text-base font-semibold">
                  {t("core.form.errors.title")}
                </h3>
                <ul className="block pl-5">
                  {Object.entries(errors).map(([key, value]) => (
                    <li key={key} className="list-disc">
                      {fieldNameTrans
                        ? value.replace(key, t(`${fieldNameTrans}.${key}`))
                        : value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div
              className={cn(
                disabled &&
                  "[&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
                "relative grid grid-cols-1 auto-rows-max lg:grid-rows-[auto_1fr] lg:grid-cols-[1fr_auto] flex-1 gap-4 mt-4",
              )}
            >
              {!isCreate && sidebarChildren && (
                <div
                  ref={ref}
                  className={cn(
                    className,
                    "flex flex-col order-2 lg:col-start-2 lg:row-span-2 h-fit  gap-y-4 lg:sticky lg:top-[73px]",
                  )}
                >
                  {sidebarChildren}
                </div>
              )}
              <FormChildren
                ref={ref}
                defaultMenu={defaultMenu}
                className={className}
                showHeader={showHeader}
              >
                {children}
              </FormChildren>
              {!isCreate && bottombarChildren && (
                <div
                  ref={ref}
                  className={cn(
                    className,
                    "flex flex-col order-3 lg:col-start-1 gap-y-4",
                  )}
                >
                  {bottombarChildren}
                </div>
              )}
            </div>
          </form>
        </FormPageContext.Provider>
      </AppLayout>
    );
  }),
);
/**
 * @typedef {object} FormPageProps
 * @property {object} errors
 * @property {boolean} disabled
 * @property {string} fieldNameTrans untuk translate name attribute
 * @property {string} defaultMenu Menu yang pertama kali ditampilkan, Beri nilai value sesuai FormPageContent value yang ingin di pilih
 * @property {string} title
 * @property {React.JSX.Element?} badge jika lebih dari satu bungkus dengan <> </>
 * @property {React.ReactNode<FormPageContent>} children
 * @property {React.FormEventHandler} onSubmit
 * @property {boolean} open
 * @property {React.Dispatch<React.SetStateAction<boolean>>} onOpenChange
 * @property {string} className
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageProps>}
 */
const FormPageDialog = memo(
  forwardRef(function FormPageDialog(
    {
      title,
      errors,
      disabled,
      fieldNameTrans,
      defaultMenu,
      className,
      onSubmit,
      open,
      onOpenChange,
      children,
      badge,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [menus, setMenus] = useState([]);
    const {
      setContinue,
      isDirty,
      setIsDirty,
      recentlySuccessful,
      setShowAlert,
    } = useIsDirtyForm();
    const { cancel } = useAlertDraftForm();

    const onClose = (val) => {
      if (val) return;
      setContinue(() => {
        onOpenChange(false);
        setShowAlert(false);
        setIsDirty(false);
        cancel();
      });
      if (isDirty) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
        onOpenChange(val);
      }
    };
    useDidMountEffect(() => {
      if (recentlySuccessful) {
        onOpenChange(false);
      }
    }, [recentlySuccessful]);
    const _onSubmit = (e) => {
      onSubmit?.(e);
    };
    const addMenu = useCallback((newItem) => {
      setMenus((prev) => {
        let newItems = [...(prev ?? [])];
        const index = newItems?.findIndex(
          (menu) => menu.value === newItem.value,
        );
        if (index < 0) {
          newItems = [...newItems, newItem];
        }
        return newItems;
      });
    }, []);
    return (
      <AlertDialog open={open}>
        <AlertDialogContent className={className}>
          <FormPageContext.Provider
            value={{ errors, fieldNameTrans, menus, addMenu }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                _onSubmit(e);
              }}
              disabled={disabled}
              className={cn(
                disabled &&
                  "[&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
              )}
            >
              <AlertDialogHeader className="mb-4 border-b border-muted-foreground/30">
                <AlertDialogTitle className="flex items-center gap-x-2">
                  {title}
                  {badge}
                </AlertDialogTitle>
                <AlertDialogDescription className="sr-only"></AlertDialogDescription>
              </AlertDialogHeader>
              {errors && Object.keys(errors).length > 0 && (
                <div className="flex-col w-full mt-4 alert error">
                  <h3 className="text-base font-semibold">
                    {t("core.form.errors.title")}
                  </h3>
                  <ul className="block pl-5">
                    {Object.entries(errors).map(([key, value]) => (
                      <li key={key} className="list-disc">
                        {fieldNameTrans
                          ? value.replace(key, t(`${fieldNameTrans}.${key}`))
                          : value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <FormChildren
                ref={ref}
                defaultMenu={defaultMenu}
                className={className}
                showHeader={false}
              >
                {children}
              </FormChildren>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel
                  className="h-8"
                  onClick={() => onClose(false)}
                >
                  {t("core.form.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="h-8"
                  type="submit"
                  onClick={() => {}}
                >
                  {t("core.form.save")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </FormPageContext.Provider>
        </AlertDialogContent>
      </AlertDialog>
    );
  }),
);

export {
  FormPage,
  FormPageContent,
  FormPageContentTitle,
  FormPageContentDescription,
  FormPageDialog,
  useFormPage,
  // useFormPageContent,
};
