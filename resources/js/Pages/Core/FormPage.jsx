import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/Components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import React, {
  Children,
  Fragment,
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { cn, generateRandom } from "@/lib/utils";
import { useAlertDraftForm, useDraftForm } from "@/Hooks/useDraftForm";

import AppLayout from "@/Layouts/AppLayout";
import Attachments from "./Components/Attachments";
import Comments from "./Components/Comments";
import Tags from "./Components/Tags";
import pluralize from "pluralize";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useForm } from "@inertiajs/react";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

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
 * @property {boolean | string | string[]} showAt
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageContentProps>}
 */
const FormPageContent = memo(
  forwardRef(function FormPageContent(
    {
      title,
      value,
      children,
      className,
      collapsible = false,
      showAt = false,
      show = true,
    },
    ref,
  ) {
    const { menus, addMenu, menuSelected, removeMenu } = useFormPage();
    const [id] = useState(generateRandom(8));
    const [valueAccordion] = useState(generateRandom(8));
    useEffect(() => {
      if (!show) {
        removeMenu(value);
        return;
      }
      if (showAt) return;
      const index = menus?.findIndex((menu) => menu.value === value);
      if (index >= 0) return;
      addMenu({
        id,
        title,
        value,
      });
    }, [show]);
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
      <TabsContent
        value={
          showAt
            ? typeof showAt === "string"
              ? showAt
              : Array.isArray(showAt)
                ? (showAt.find(
                    (item) => item === (menuSelected ?? menus?.[0]?.value),
                  ) ?? value)
                : (menuSelected ?? menus?.[0]?.value)
            : value
        }
        className="mt-0"
      >
        <AccordionItem value={valueAccordion} asChild className="border-b-0">
          <div
            ref={ref}
            className={cn("px-4 py-4 !mt-0", className)}
            role="content"
          >
            {headerChildren.length > 0 ||
            (isSingle && collapsible) ||
            (isSingle && title) ||
            (title && collapsible) ? (
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

const FormChildren = memo(function FormChildren({
  children,
  className,
  showHeader,
  errors,
  fieldNameTrans,
  data,
  setData,
  defaultMenu,
}) {
  const { t } = useLaravelReactI18n();

  const [menus, setMenus] = useState([]);

  const [menuSelected, setMenuSelected] = useState(defaultMenu);
  const addMenu = useCallback((newItem) => {
    setMenus((prev) => {
      let newItems = [...(prev ?? [])];
      const index = newItems?.findIndex((menu) => menu.value === newItem.value);
      if (index < 0) {
        newItems = [...newItems, newItem];
      }
      return newItems;
    });
  }, []);
  // useEffect(() => {
  //   setMenus([]);
  //   console.log("children", children);
  // }, [children]);
  const removeMenu = useCallback((value) => {
    console.log(value);
    setMenus((prev) => {
      const newItems = prev?.filter((menu) => menu.value !== value);
      return newItems;
    });
  }, []);
  return (
    <Accordion type="multiple" className="w-full" asChild>
      <Tabs
        value={menuSelected ?? menus?.[0]?.value}
        onValueChange={setMenuSelected}
        asChild
      >
        <div
          className={cn(
            className,
            "flex flex-col order-1 max-w-full  border rounded-xl lg:col-start-1 border-muted-foreground/25",
            "[&_:not(div[role=content])_+_div[role=content]]:border-t-0 [&_div[role=content]:first-child]:!border-t-0 [&_div[role=content]]:border-t [&_div[role=content]]:border-muted-foreground/25",
          )}
        >
          <TabsList
            className={cn(
              menus?.length <= 1 ? "hidden" : "",
              showHeader ? "top-14" : "top-0",
              "transition-[top] duration-300 ease-in-out sticky z-[9] w-full !p-0 h-auto rounded-b-none rounded-t-xl items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b",
            )}
          >
            {menus.map((child) => {
              return (
                <TabsTrigger
                  key={child.value}
                  value={child.value}
                  className="text-base border-0 data-[state=active]:font-bold !p-0 !px-4 group rounded-none transition-colors"
                >
                  <span className="pt-2 pb-1 border-transparent w-fit group-[[data-state=active]]:border-foreground border-b transition-colors duration-300 ">
                    {t(child.title || child.value)}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <FormPageProvider
            errors={errors}
            fieldNameTrans={fieldNameTrans}
            data={data}
            setData={setData}
            menus={menus}
            addMenu={addMenu}
            removeMenu={removeMenu}
            menuSelected={menuSelected}
            setMenuSelected={setMenuSelected}
          >
            {children}
          </FormPageProvider>
        </div>
      </Tabs>
    </Accordion>
  );
});

const FormPageContext = createContext();
/**
 * @typedef FormPageContextProps
 * @property {object} errors
 * @returns {FormPageContextProps}
 */
const useFormPage = () => useContext(FormPageContext);

const FormPageProvider = memo(function FormPageProvider({
  children,
  errors,
  fieldNameTrans,
  data,
  setData,
  menus,
  addMenu,
  removeMenu,
  menuSelected,
  setMenuSelected,
}) {
  return (
    <FormPageContext.Provider
      value={{
        menus,
        addMenu,
        removeMenu,
        menuSelected,
        setMenuSelected,
        errors,
        fieldNameTrans,
        data,
        setData,
      }}
    >
      {children}
    </FormPageContext.Provider>
  );
});

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
 * @param {object} props.data
 * @param {Function} props.setData
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
      data,
      setData,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    // const permissions = usePage().props.permissions;
    const [showHeader, setShowHeader] = useState(true);
    // eslint-disable-next-line no-unused-vars
    const [lastPosition, setLastPosition] = useState(0);
    const formRef = useRef();
    const handleScroll = useCallback(
      (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const position = Math.ceil(
          (scrollTop / (scrollHeight - clientHeight)) * 100,
        );
        setLastPosition((prev) => {
          if (prev === position) return prev;
          setShowHeader(position <= prev);
          return position;
        });
      },
      [setLastPosition, setShowHeader],
    );
    const onKeyDown = useCallback(
      (e) => {
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          e.stopPropagation();
          const form = formRef.current;

          if (form) {
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
            } else {
              form.dispatchEvent(new Event("submit", { cancelable: true }));
            }
          }
        }
      },
      [formRef],
    );

    return (
      <AppLayout
        data-disabled={disabled}
        className="!pt-0 relative group/form"
        onScroll={handleScroll}
      >
        <form
          onKeyDown={onKeyDown}
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (disabled) return;
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
            {!isCreate && <SidebarChildren content={sidebarContent} />}
            <FormChildren
              ref={ref}
              className={className}
              showHeader={showHeader}
              errors={errors}
              fieldNameTrans={fieldNameTrans}
              data={data}
              setData={setData}
              defaultMenu={defaultMenu}
            >
              {children}
            </FormChildren>
            {!isCreate && <BottombarChildren content={bottombarContent} />}
          </div>
        </form>
      </AppLayout>
    );
  }),
);

const SidebarChildren = memo(
  forwardRef(function SidebarChildren({ content, className }, ref) {
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
    const sidebarChildren =
      content === false
        ? null
        : !content
          ? defaultSidebarChildren
          : typeof content === "function"
            ? content?.(defaultSidebarChildren)
            : content;
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

const BottombarChildren = memo(
  forwardRef(function BottombarChildren({ content, className }, ref) {
    const defaultBottombarChildren = useMemo(() => {
      return <Comments />;
    }, []);

    const bottombarChildren =
      content === false
        ? null
        : !content
          ? defaultBottombarChildren
          : typeof content === "function"
            ? content?.(defaultBottombarChildren)
            : content;
    return (
      <div
        ref={ref}
        className={cn(
          className,
          "flex flex-col order-3 lg:col-start-1 gap-y-4",
        )}
      >
        {bottombarChildren}
      </div>
    );
  }),
);
/**
 * @typedef {object} FormPageProps
 * @property {object} errors
 * @property {boolean} disabled
 * @property {string} name untuk menyimpan key ke cookie dan route
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
      name,
      disabled: disabledProps,
      fieldNameTrans,
      defaultMenu,
      className,
      open,
      onOpenChange,
      children,
      badge,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const route = window.route;
    const {
      data,
      setData,
      post,
      processing,
      errors,
      isDirty,
      recentlySuccessful,
      clearErrors,
    } = useDraftForm(
      name,
      {},
      {
        onContinueDraft: () => {
          onOpenChange?.(true);
        },
      },
    );
    const disabled = disabledProps ?? processing;
    const {
      setContinue,

      setIsDirty,
      setShowAlert,
    } = useIsDirtyForm();
    const { cancel } = useAlertDraftForm();
    const formRef = useRef();
    const onKeyDown = useCallback(
      (e) => {
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          const form = formRef.current;

          if (form) {
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
            } else {
              form.dispatchEvent(new Event("submit", { cancelable: true }));
            }
          }
        }
      },
      [formRef],
    );

    const onClose = (val) => {
      if (val) return;
      setContinue(() => {
        onOpenChange(false);
        setShowAlert(false);
        setIsDirty(false);
        cancel();
        setData?.({});
        clearErrors();
      });
      if (isDirty) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
        onOpenChange(val);
        setData?.({});
        clearErrors();
      }
    };
    useDidMountEffect(() => {
      if (recentlySuccessful) {
        onOpenChange(false);
      }
    }, [recentlySuccessful]);
    const _onSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (!name) return;
      const pluralized = `${pluralize.plural(name ?? "")}.store`;
      post(route(pluralized));
    };
    return (
      <AlertDialog open={open}>
        <AlertDialogContent className={cn(className, "pt-0")}>
          <form
            ref={formRef}
            onKeyDown={onKeyDown}
            onSubmit={_onSubmit}
            disabled={disabled}
            className={cn(
              disabled &&
                " [&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
            )}
          >
            <AlertDialogHeader className="pt-6 mb-4 border-b border-muted-foreground/30">
              <AlertDialogTitle className="flex items-center mb-1 gap-x-2">
                {title}
                {isDirty && (
                  <span className="text-sm badge warning">
                    {t("core.form.not_saved")}
                  </span>
                )}
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
              errors={errors}
              fieldNameTrans={fieldNameTrans}
              data={data}
              setData={setData}
            >
              {children}
            </FormChildren>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel className="h-8" onClick={() => onClose(false)}>
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
        </AlertDialogContent>
      </AlertDialog>
    );
  }),
);

const FormPageLinkModelDialog = memo(
  forwardRef(function FormPageDialog(
    {
      title,
      name,
      disabled: disabledProps,
      fieldNameTrans,
      defaultMenu,
      className,
      open,
      onOpenChange,
      children,
      badge,
      postOption = {},
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const route = window.route;
    const {
      data,
      setData,
      post,
      put,
      patch,
      processing,
      errors,
      isDirty,
      recentlySuccessful,
      reset,
      setDefaults,
    } = useForm(postOption.initialData ?? {});
    useEffect(() => {
      setDefaults(postOption.initialData ?? {});
      reset();
    }, [postOption.initialData]);
    const disabled = disabledProps ?? processing;
    const formRef = useRef();
    const onKeyDown = useCallback(
      (e) => {
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          e.stopPropagation();
          const form = formRef.current;

          if (form) {
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
            } else {
              form.dispatchEvent(new Event("submit", { cancelable: true }));
            }
          }
        }
      },
      [formRef],
    );

    const onClose = (val) => {
      if (val) return;
      onOpenChange(val);
      setData?.({});
    };
    const _onSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (!name) return;
      const pluralized = `${pluralize.plural(name ?? "")}.store`;

      const excludedKeys = ["initalData", "method"];

      const fiteredOption = Object.fromEntries(
        Object.entries(postOption ?? {}).filter(
          ([key]) => !excludedKeys.includes(key),
        ),
      );

      const routerOption = {
        preserveScroll: true,
        preserveState: true,
        preserveUrl: true,
        replace: true,
        ...fiteredOption,
      };

      switch (postOption.method) {
        case "put":
          put(route(pluralized), routerOption);
          break;
        case "patch":
          patch(route(pluralized), routerOption);
          break;
        default:
          post(route(pluralized), routerOption);
      }
    };
    useDidMountEffect(() => {
      if (recentlySuccessful) {
        onOpenChange(false);
        reset();
      }
    }, [recentlySuccessful]);
    return (
      <AlertDialog open={open}>
        <AlertDialogContent className={cn(className, "pt-0 overflow-hidden")}>
          <form
            ref={formRef}
            onKeyDown={onKeyDown}
            onSubmit={_onSubmit}
            disabled={disabled}
            className={cn(
              disabled &&
                " [&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
            )}
          >
            <AlertDialogHeader className="pt-6 mb-4 border-b border-muted-foreground/30">
              <AlertDialogTitle className="flex items-center mb-1 gap-x-2">
                {title}
                {isDirty && (
                  <span className="text-sm badge warning">
                    {t("core.form.not_saved")}
                  </span>
                )}
                {badge}
              </AlertDialogTitle>
              <AlertDialogDescription className="sr-only"></AlertDialogDescription>
            </AlertDialogHeader>
            <div className="overflow-y-auto">
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
            </div>
            <FormChildren
              ref={ref}
              defaultMenu={defaultMenu}
              className={className}
              showHeader={false}
              errors={errors}
              fieldNameTrans={fieldNameTrans}
              data={data}
              setData={setData}
            >
              {children}
            </FormChildren>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel className="h-8" onClick={() => onClose(false)}>
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
  FormPageLinkModelDialog,
  useFormPage,
  // useFormPageContent,
};
