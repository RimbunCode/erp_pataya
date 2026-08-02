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
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import {
  ChevronDownIcon,
  MailIcon,
  PanelRightIcon,
  PrinterIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";
import { Deferred, Head, WhenVisible, router, usePage } from "@inertiajs/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import React, {
  Children,
  Fragment,
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import {
  cn,
  generateRandom,
  getLocaleDate,
  inArray,
  isCompletedStatus,
  removeFromLocalStorage,
  resolveImageSrc,
} from "@/lib/utils";
import { useAlertDraftForm, useDraftForm } from "@/Hooks/useDraftForm";

import AppLayout from "@/Layouts/AppLayout";
import ApproverDecision from "./Components/ApproverDecision";
import AssignedTo from "./Components/AssignedTo";
import Attachments from "./Components/Attachments";
import BadgeStatus from "@/Components/BadgeStatus";
import { Button } from "@/Components/ui/button";
import { ButtonGroup } from "@/Components/ui/button-group";
import Comments from "./Components/Comments";
import EmailSendDialog from "./Components/EmailSendDialog";
import FormInput from "@/Components/FormInput";
import Link from "@/Components/Link";
import LinkModel from "@/Components/LinkModel";
import LoadingIcon from "@/Components/LoadingIcon";
import { TZDate } from "@date-fns/tz";
import Tags from "./Components/Tags";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { evaluate } from "@marcbachmann/cel-js";
import { format } from "date-fns";
import pluralize from "pluralize";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import useDeleteModal from "@/Hooks/useDeleteModal";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";
import usePermission from "@/Hooks/usePermission";

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

const FormPageContentTrigger = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);
FormPageContentTrigger.displayName = "FormPageContentTrigger";

/**
 * @typedef {object} FormPageContentProps
 * @property {string} title
 * @property {string} value
 * @property {React.ReactNode} children
 * @property {string} className
 * @property {boolean} collapsible
 * @property {boolean} defaultOpen
 * @property {boolean | string | string[]} showAt
 */
/**
 * @type {React.ForwardRefRenderFunction<HTMLHeadingElement, FormPageContentProps>}
 */
const FormPageContent = forwardRef(function FormPageContent(
  {
    title,
    value,
    children,
    className,
    actions,
    collapsible = false,
    defaultOpen = false,
    showAt = false,
    show = true,
  },
  ref,
) {
  const { menus, addMenu, menuSelected, removeMenu, firstIds, isSingle } =
    useFormPage();
  const [id] = useState(generateRandom(8));
  const [openCollapsible, setOpenCollapsible] = useState(defaultOpen);
  const childrenArray = useMemo(() => Children.toArray(children), [children]);

  useEffect(() => {
    if (showAt && !value) {
      return;
    }
    if (!show) {
      removeMenu(id);
      return;
    }
    addMenu({
      id,
      title,
      value,
    });
    return () => {
      removeMenu(id);
    };
  }, [addMenu, id, removeMenu, show, title, value]);
  const headerChildren = useMemo(() => {
    return childrenArray.filter((child) => {
      return (
        child?.type == FormPageContentTitle ||
        child?.type == FormPageContentDescription
      );
    });
  }, [childrenArray]);
  const contentChildren = useMemo(() => {
    return childrenArray.filter((child) => {
      return !(
        child?.type == FormPageContentTitle ||
        child?.type == FormPageContentDescription
      );
    });
  }, [childrenArray]);
  const haveTitle = useMemo(() => {
    return (
      childrenArray.findIndex((child) => child?.type == FormPageContentTitle) >=
      0
    );
  }, [childrenArray]);
  const isFirst = firstIds?.has(id) ?? true;
  const isMultiTab = !isSingle;
  const effectiveCollapsible = collapsible && !(isMultiTab && isFirst);
  const showHeaderSection =
    headerChildren.length > 0 ||
    (isSingle && (title || effectiveCollapsible)) ||
    (isMultiTab && !isFirst && title) ||
    (title && effectiveCollapsible);
  const Trigger = effectiveCollapsible
    ? CollapsibleTrigger
    : FormPageContentTrigger;
  const Content = effectiveCollapsible ? CollapsibleContent : Fragment;
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
      <Collapsible open={openCollapsible} onOpenChange={setOpenCollapsible}>
        <div
          ref={ref}
          className={cn("px-4 py-4 mt-0! border-b-0", className)}
          role="content"
        >
          {showHeaderSection ? (
            <>
              <Trigger className="w-full pt-0 pb-1 mb-3 border-b border-muted-foreground/25 [&[data-state=open]_svg]:rotate-180">
                {(!haveTitle || (!haveTitle && actions)) && (
                  <FormPageContentTitle className="flex items-center justify-between gap-x-4">
                    {title || value}
                    {actions}
                    {effectiveCollapsible && (
                      <ChevronDownIcon className="w-4 h-4 transition-transform duration-200 shrink-0" />
                    )}
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
      </Collapsible>
    </TabsContent>
  );
});

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
  dataBefore,
  defaultData,
  data,
  setData,
  defaultMenu,
  disabled,
  form,
  isCreate = false,
  // hasConnections,
}) {
  const tabsListRef = useRef(null);
  const isMobile = useIsMobile();

  const { t } = useLaravelReactI18n();
  const [_menus, setMenus] = useState([]);

  const [menuSelected, setMenuSelected] = useState(defaultMenu);
  const addMenu = useCallback((newItem) => {
    setMenus((prev = []) => {
      const existingIndex = prev.findIndex((menu) => menu.id === newItem.id);
      if (existingIndex < 0) {
        return [...prev, newItem];
      }
      const existingItem = prev[existingIndex];
      if (
        existingItem?.title === newItem?.title &&
        existingItem?.value === newItem?.value
      ) {
        return prev;
      }
      const nextMenus = [...prev];
      nextMenus[existingIndex] = newItem;
      return nextMenus;
    });
  }, []);
  const removeMenu = useCallback((id) => {
    setMenus((prev = []) => {
      const newItems = prev.filter((menu) => menu.id !== id);
      if (newItems.length === prev.length) {
        return prev;
      }
      return newItems;
    });
  }, []);

  const menus = useMemo(() => {
    const mapMenus = new Map();
    _menus?.forEach((menu) => {
      if (mapMenus.has(menu.value)) return;
      mapMenus.set(menu.value, menu);
    });
    return Array.from(mapMenus.values());
  }, [_menus]);

  const isSingle = menus.length <= 1;

  const firstIds = useMemo(() => {
    const seen = new Set();
    const ids = new Set();
    _menus.forEach((m) => {
      if (!seen.has(m.value)) {
        seen.add(m.value);
        ids.add(m.id);
      }
    });
    return ids;
  }, [_menus]);

  return (
    <Tabs
      value={menuSelected ?? menus?.[0]?.value ?? ""}
      className={cn("w-full", isMobile && "max-w-full!", className)}
      onValueChange={setMenuSelected}
      asChild
    >
      <div
        className={cn(
          "flex flex-col order-1 max-w-full  border rounded-xl lg:col-start-1 border-muted-foreground/25",
          "[&_:not(div[role=content])+div[role=content]]:border-t-0 [&_div[role=content]:first-child]:border-t-0! [&_div[role=content]]:border-t [&_div[role=content]]:border-muted-foreground/25",
        )}
      >
        <TabsList
          ref={tabsListRef}
          data-tabs
          style={{
            "--tabs-top": showHeader ? "3.5rem" : "0rem",
            top: "var(--tabs-top)",
          }}
          className={cn(
            menus?.length <= 1 && !defaultData?.approvalable ? "hidden" : "",
            // showHeader ? "top-14" : "top-0",
            "transition-[top] duration-300 ease-in-out sticky z-9 w-full p-0! h-auto rounded-b-none rounded-t-xl items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b",
          )}
        >
          {menus.map((child) => {
            return (
              <TabsTrigger
                key={child.value}
                value={child.value}
                className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
              >
                <span className="pt-2 pb-1 border-transparent w-fit group-data-[state=active]:border-foreground border-b transition-colors duration-300 ">
                  {t(child.title || child.value)}
                </span>
              </TabsTrigger>
            );
          })}

          {/* {hasConnections && (
            <TabsTrigger
              value="connections"
              className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
            >
              <span className="pt-2 pb-1 border-transparent w-fit group-data-[state=active]:border-foreground border-b transition-colors duration-300 ">
                {t("core.form.connections")}
              </span>
            </TabsTrigger>
          )} */}

          {defaultData?.approvalable && (
            <TabsTrigger
              value="approvals"
              className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
            >
              <span className="pt-2 pb-1 border-transparent w-fit group-data-[state=active]:border-foreground border-b transition-colors duration-300 ">
                {t("core.form.approvals")}
              </span>
            </TabsTrigger>
          )}
        </TabsList>
        <FormPageProvider
          disabled={disabled}
          errors={errors}
          fieldNameTrans={fieldNameTrans}
          defaultData={defaultData}
          data={data}
          setData={setData}
          menus={menus}
          addMenu={addMenu}
          removeMenu={removeMenu}
          menuSelected={menuSelected}
          setMenuSelected={setMenuSelected}
          isCreate={isCreate}
          dataBefore={dataBefore}
          form={form}
          isSingle={isSingle}
          firstIds={firstIds}
        >
          {children}
          {/* {hasConnections && <Connections />} */}
          {defaultData?.approvalable && (
            <Approvals approvals={defaultData?.approvalable.steps} />
          )}
        </FormPageProvider>
      </div>
    </Tabs>
  );
});

const FormPageContext = createContext();
const FormPageMetaContext = createContext();
/**
 * @param {object|(() => object|Promise<object>)} defaultValue
 * @param {{ trackDefaultValue?: boolean, notUseWhenCreate:boolean }} options
 * @typedef FormPageContextProps
 * @returns {FormPageContextProps}
 */
const useFormPage = (
  defaultValue,
  options = { trackDefaultValue: true, notUseWhenCreate: false },
) => {
  const context = useContext(FormPageContext);
  const shouldResolveDefaults = typeof defaultValue !== "undefined";
  const { trackDefaultValue, notUseWhenCreate } = options ?? {};
  const normalizedDefaultValue = shouldResolveDefaults
    ? (defaultValue ?? {})
    : {};
  const { isCreate } = context ?? {};
  const hasContextDefaultData = useMemo(() => {
    const data = context?.defaultData;
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === "object") return Object.keys(data).length > 0;
    return true;
  }, [context?.defaultData]);

  // Jika ada defaultData dari context (hasil fetch server), abaikan defaultValue dari parameter
  const effectiveDefaultValue = useMemo(
    () =>
      shouldResolveDefaults &&
      hasContextDefaultData &&
      !(isCreate && !notUseWhenCreate)
        ? {}
        : normalizedDefaultValue,
    [
      hasContextDefaultData,
      isCreate,
      normalizedDefaultValue,
      notUseWhenCreate,
      shouldResolveDefaults,
    ],
  );
  const appliedDefaultsRef = useRef(null);
  const form = context?.form;
  const stableDefaultRef = useRef(null);
  const lastResolvedSerializedRef = useRef(null);
  const shouldTrackDefaultValue =
    shouldResolveDefaults &&
    !hasContextDefaultData &&
    (trackDefaultValue || typeof effectiveDefaultValue === "function");
  const defaultValueEffectDep = shouldTrackDefaultValue
    ? effectiveDefaultValue
    : trackDefaultValue;
  const [resolvedDefaultValue, setResolvedDefaultValue] = useState(() => {
    if (typeof effectiveDefaultValue === "function") return {};
    if (!shouldTrackDefaultValue) {
      return effectiveDefaultValue ?? {};
    }
    return effectiveDefaultValue ?? {};
  });

  useEffect(() => {
    if (!shouldResolveDefaults) return;
    let isActive = true;
    const resolveValue = async () => {
      try {
        const value =
          typeof effectiveDefaultValue === "function"
            ? await effectiveDefaultValue()
            : shouldTrackDefaultValue
              ? effectiveDefaultValue
              : (stableDefaultRef.current ??
                (stableDefaultRef.current = effectiveDefaultValue ?? {}));
        if (!isActive) return;
        const serializedResolved = JSON.stringify(value ?? {});
        if (lastResolvedSerializedRef.current === serializedResolved) return;

        lastResolvedSerializedRef.current = serializedResolved;
        setResolvedDefaultValue(value ?? {});
      } catch (error) {
        console.error("Failed to resolve defaultValue in useFormPage", error);
      }
    };
    resolveValue();
    return () => {
      isActive = false;
    };
  }, [
    defaultValueEffectDep,
    effectiveDefaultValue,
    shouldResolveDefaults,
    shouldTrackDefaultValue,
  ]);

  const serializedDefaultValue = useMemo(
    () => JSON.stringify(resolvedDefaultValue ?? {}),
    [resolvedDefaultValue],
  );
  const memoizedDefaultValue = useMemo(
    () => resolvedDefaultValue ?? {},
    [resolvedDefaultValue],
  );

  useEffect(() => {
    if (!shouldResolveDefaults) return;
    if (!form) return;
    if (Object.keys(memoizedDefaultValue ?? {}).length === 0) return;
    if (appliedDefaultsRef.current === serializedDefaultValue) return;

    appliedDefaultsRef.current = serializedDefaultValue;
    form.setDefaults?.(memoizedDefaultValue);
    form.setData?.((prev) => ({
      ...(prev ?? {}),
      ...memoizedDefaultValue,
    }));
  }, [
    form,
    memoizedDefaultValue,
    serializedDefaultValue,
    shouldResolveDefaults,
  ]);

  return context;
};

const useFormPageMeta = () => useContext(FormPageMetaContext);

const FormPageProvider = memo(function FormPageProvider({
  children,
  disabled,
  errors,
  fieldNameTrans,
  defaultData,
  data,
  setData,
  menus,
  addMenu,
  removeMenu,
  menuSelected,
  setMenuSelected,
  dataBefore,
  form,
  isCreate = false,
  isSingle = true,
  firstIds,
}) {
  const stableDataBefore = useMemo(() => dataBefore ?? {}, [dataBefore]);
  const metaContextValue = useMemo(
    () => ({
      disabled,
      errors,
      fieldNameTrans,
      dataBefore: stableDataBefore,
    }),
    [disabled, errors, fieldNameTrans, stableDataBefore],
  );
  const contextValue = useMemo(
    () => ({
      disabled,
      menus,
      addMenu,
      removeMenu,
      menuSelected,
      setMenuSelected,
      errors,
      fieldNameTrans,
      defaultData,
      data,
      setData,
      dataBefore: stableDataBefore,
      isCreate,
      form,
      isSingle,
      firstIds,
    }),
    [
      disabled,
      menus,
      addMenu,
      removeMenu,
      menuSelected,
      setMenuSelected,
      errors,
      fieldNameTrans,
      defaultData,
      data,
      setData,
      stableDataBefore,
      isCreate,
      form,
      isSingle,
      firstIds,
    ],
  );
  return (
    <FormPageMetaContext.Provider value={metaContextValue}>
      <FormPageContext.Provider value={contextValue}>
        {children}
      </FormPageContext.Provider>
    </FormPageMetaContext.Provider>
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
 * @param {(key: string | object | ((prev: object) => object), value?: unknown) => void} props.setData
 * @param {boolean} props.isSubmitable
 */
const FormPage = memo(
  forwardRef(function FormPage(
    {
      name,
      disabled: _disabled,
      isCreate = false,
      fieldNameTrans,
      title: _title,
      badge,
      controls,
      defaultMenu,
      sidebarContent,
      bottombarContent,
      className,
      children,
      submitable = false,
      ignoreDraft = false,
      defaultValues,
      deleteable = true,
      banner,
      printable: _printable,
      usePasswordConfirmationForDelete,
      primaryKey = "id",
    },
    ref,
  ) {
    const printable = !isCreate && (_printable ?? submitable);
    const route = window.route;
    const { deleteItem } = useDeleteModal();
    const { t } = useLaravelReactI18n();
    const defaultData = usePage().props[name] ?? defaultValues ?? {};
    const prints = usePage().props.prints ?? [];
    const emailTemplates = usePage().props.emailTemplates;
    const [emailDialog, setEmailDialog] = useState(null);
    const form = useDraftForm(name, defaultData, { isCreate, ignoreDraft });
    const user = usePage().props.auth.user;
    const { model, translateKey } = usePage().props;
    const { can } = usePermission(model);
    const title = useMemo(() => {
      return (
        _title ??
        (isCreate
          ? translateKey && t(`${translateKey}.new`)
          : defaultData.templateLink
            ? convertTemplateLink(defaultData)
            : (defaultData.code ?? defaultData.name)) ??
        ""
      );
    }, [_title, t, defaultData, isCreate, translateKey]);
    const {
      data,
      setData: _setData,
      put,
      post,
      processing,
      errors,
      isDirty,
    } = form;
    const disabled = useMemo(() => {
      if (!defaultData?.disabledOn) {
        return !!_disabled;
      }
      return evaluate(defaultData?.disabledOn, defaultData);
    }, [_disabled, defaultData?.disabledOn]);
    const onSubmit = useCallback(
      (e) => {
        e.preventDefault();
        if (e.action == "submit") {
          put(
            route(
              `${pluralize.plural(name ?? "")}.submit`,
              defaultData[primaryKey],
            ),
            {
              isSubmit: true,
            },
          );
          return;
        }

        if (isCreate) {
          // Sertakan buffer sidebar create: tags (buffered_tags) & file draft
          // (filesId). File sudah ter-upload sebagai draft, kirim id saja.
          const files = Array.isArray(data?.files) ? data.files : [];
          form.transform((payload) => {
            const payloadData = { ...payload };
            const fileIds = files.map((f) => f.id).filter(Boolean);

            if (fileIds.length > 0) {
              payloadData.filesId = fileIds;
            }

            return payloadData;
          });
          post(route(`${pluralize.plural(name ?? "")}.store`));
          return;
        }

        form.transform((payload) => payload);
        put(
          route(
            `${pluralize.plural(name ?? "")}.update`,
            defaultData[primaryKey],
          ),
        );
      },
      [route, name, isCreate, defaultData, data, form],
    );
    const [showAlertBeforeSubmit, setShowAlertBeforeSubmit] = useState(false);
    const [showAlertBeforeCancel, setShowAlertBeforeCancel] = useState(false);
    const formRef = useRef();
    const layoutRef = useRef(null); // wrapper AppLayout
    const lastPositionRef = useRef(0);
    const showHeaderRef = useRef(true);
    const handleScroll = useCallback((e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const position = Math.ceil(
        (scrollTop / (scrollHeight - clientHeight)) * 100,
      );
      const prev = lastPositionRef.current;
      if (prev === position) return;
      lastPositionRef.current = position;

      const nextShow = position <= prev;
      if (showHeaderRef.current === nextShow) return;
      showHeaderRef.current = nextShow;

      // toggle kelas header tanpa re-render
      const headerEl = layoutRef.current?.querySelector("[data-header]");
      headerEl?.classList.toggle("is-hidden", !nextShow);

      // update top TabsList via CSS variable
      const tabsEl = layoutRef.current?.querySelector("[data-tabs]");
      tabsEl?.style.setProperty("--tabs-top", nextShow ? "3.5rem" : "0px");
    }, []);

    const onKeyDown = useCallback(
      (e) => {
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          e.stopPropagation();
          if (submitable && !isDirty) {
            setShowAlertBeforeSubmit(true);
            return;
          }
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
      [formRef, isDirty, submitable],
    );
    const setData = useCallback(
      (...args) => {
        if (disabled) return;
        _setData(...args);
      },
      [disabled, _setData],
    );
    const submit = useCallback(() => {
      if (!submitable) new Error("This form not submitable!");
      setShowAlertBeforeSubmit(true);
    }, []);

    const cancel = useCallback(() => {
      if (!submitable) new Error("This form not submitable!");
      setShowAlertBeforeCancel(true);
    }, []);
    const onCancel = useCallback(() => {
      put(
        route(
          `${pluralize.plural(name ?? "")}.cancel`,
          defaultData[primaryKey],
        ),
      );
    }, []);
    const amend = useCallback(() => {
      put(
        route(`${pluralize.plural(name ?? "")}.amend`, defaultData[primaryKey]),
      );
    }, []);
    return (
      <AppLayout
        ref={layoutRef}
        // data-disabled={disabled}
        className="pt-0! relative group/form"
        onScroll={handleScroll}
      >
        <form
          onKeyDown={onKeyDown}
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (disabled) return;
            e.action = "update";
            onSubmit?.(e);
          }}
        >
          <div
            data-header
            className={cn(
              // showHeader ? "top-0" : "-top-16",
              " transition-[top] duration-300 ease-in-out sticky z-10 flex items-center justify-between pt-4 pb-2 border-b gap-x-4 bg-background border-muted-foreground/25",
            )}
          >
            <Head title={title} />
            <div className="flex items-center gap-x-2">
              {title && <h1 className="text-xl font-bold">{title}</h1>}
              {badge}
              {defaultData?.status &&
                (Array.isArray(defaultData?.appendStatus) ? (
                  defaultData?.appendStatus?.map((status, idx) => (
                    <BadgeStatus key={idx} status={status} />
                  ))
                ) : (
                  <BadgeStatus status={defaultData?.status} />
                ))}
              {isDirty && (
                <span className="text-sm badge warning">
                  {t("core.form.not_saved")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-x-2 ">
              {typeof controls === "function" ? controls({ form }) : controls}
              {printable && !inArray(defaultData?.status, "draft") && (
                <Deferred
                  data={["prints"]}
                  fallback={
                    <Button
                      type="button"
                      variant="outline"
                      className="p-2! size-fit h-8"
                      disabled={processing}
                    >
                      <PrinterIcon />
                      {t("core.form.print")}

                      <LoadingIcon className="size-4" />
                    </Button>
                  }
                >
                  <ButtonGroup className="h-fit">
                    {prints && prints.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="p-2! size-fit h-8"
                        disabled={processing}
                        asChild
                      >
                        <Link
                          href={route(
                            `${pluralize.plural(name ?? "")}.print`,
                            defaultData[primaryKey],
                          )}
                        >
                          <PrinterIcon />
                          {t("core.form.print")}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="p-2! size-fit h-8"
                        disabled={processing}
                        onClick={() => {
                          toast.error(t("core.form.print.errors.no_template"), {
                            action: {
                              label: t(
                                "core.form.print.errors.no_template.create",
                              ),
                              onClick: () =>
                                router.visit(
                                  route(
                                    `${pluralize.plural(name ?? "")}.createPrintTemplate`,
                                  ),
                                ),
                            },
                          });
                        }}
                      >
                        <PrinterIcon />
                        {t("core.form.print")}
                      </Button>
                    )}
                    {prints && prints.length > 1 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="p-2! size-fit h-8"
                            disabled={processing}
                            size="icon"
                          >
                            <ChevronDownIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {prints.map((print) => (
                            <DropdownMenuItem asChild key={print.id}>
                              <Link
                                href={route(
                                  `${pluralize.plural(name ?? "")}.print`,
                                  {
                                    [name]: defaultData[primaryKey],
                                    printTemplate: print.id,
                                  },
                                )}
                              >
                                {print.name}
                                {print.is_default && (
                                  <div className="badge secondary">
                                    {t("core.form.default")}
                                  </div>
                                )}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </ButtonGroup>
                </Deferred>
              )}
              {printable &&
                !inArray(defaultData?.status, "draft") &&
                can("print") &&
                emailTemplates !== undefined && (
                  <Deferred
                    data={["emailTemplates"]}
                    fallback={
                      <Button
                        type="button"
                        variant="outline"
                        className="p-2! size-fit h-8"
                        disabled={processing}
                      >
                        <MailIcon />
                        {t("core.form.email")}
                        <LoadingIcon className="size-4" />
                      </Button>
                    }
                  >
                    <ButtonGroup className="h-fit">
                      <Button
                        type="button"
                        variant="outline"
                        className="p-2! size-fit h-8"
                        disabled={processing}
                        onClick={() =>
                          setEmailDialog({ emailTemplateId: undefined })
                        }
                      >
                        <MailIcon />
                        {t("core.form.email")}
                      </Button>
                      {emailTemplates && emailTemplates.length > 1 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="p-2! size-fit h-8"
                              disabled={processing}
                              size="icon"
                            >
                              <ChevronDownIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {emailTemplates.map((emailTemplate) => (
                              <DropdownMenuItem
                                key={emailTemplate.id}
                                onClick={() =>
                                  setEmailDialog({
                                    emailTemplateId: emailTemplate.id,
                                  })
                                }
                              >
                                {emailTemplate.name}
                                {emailTemplate.is_default && (
                                  <div className="badge secondary">
                                    {t("core.form.default")}
                                  </div>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </ButtonGroup>
                  </Deferred>
                )}
              {defaultData?.approvalable && (
                <ApproverDecision
                  name={name}
                  approval={defaultData?.approvalable}
                />
              )}
              {!disabled &&
                (!submitable ||
                  (submitable && inArray(defaultData?.status, "draft"))) &&
                deleteable &&
                defaultData?.canDelete &&
                defaultData?.id &&
                can("delete", { user_id: defaultData?.created_by_id }) && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="p-2! size-fit h-8"
                    disabled={processing}
                    onClick={() =>
                      deleteItem(
                        `${pluralize.plural(name ?? "")}.destroy`,
                        defaultData[primaryKey],
                        {
                          usePasswordConfirmation:
                            usePasswordConfirmationForDelete,
                        },
                      )
                    }
                  >
                    <Trash2Icon />
                    {t("core.form.delete")}
                  </Button>
                )}
              {!isDirty && !isCreate
                ? submitable &&
                  defaultData?.created_by_id == user?.id &&
                  (!defaultData?.submitted_at
                    ? can(
                        "submit",
                        submitable && { user_id: defaultData?.created_by_id },
                      ) && (
                        <Button
                          type="button"
                          className="p-2! size-fit h-8"
                          disabled={processing}
                          onClick={submit}
                          variant="primary"
                        >
                          {t("core.form.submit")}
                        </Button>
                      )
                    : inArray(defaultData?.status, ["canceled", "rejected"])
                      ? can(
                          "amend",
                          submitable && { user_id: defaultData?.created_by_id },
                        ) && (
                          <Button
                            type="button"
                            className="p-2! size-fit h-8"
                            disabled={processing}
                            onClick={amend}
                            variant="primary"
                          >
                            {t("core.form.amend")}
                          </Button>
                        )
                      : !isCompletedStatus(defaultData?.status) &&
                        can(
                          "cancel",
                          submitable && { user_id: defaultData?.created_by_id },
                        ) && (
                          <Button
                            type="button"
                            className="p-2! size-fit h-8"
                            disabled={processing}
                            onClick={cancel}
                            variant="destructive"
                          >
                            {t("core.form.cancel")}
                          </Button>
                        ))
                : can("write", { user_id: defaultData?.created_by_id }) && (
                    <Button
                      type="submit"
                      className="p-2! size-fit h-8"
                      disabled={processing}
                    >
                      <SaveIcon />
                      {t("core.form.save")}
                    </Button>
                  )}
            </div>
          </div>
          {banner}
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
              // disabled &&
              //   "[&_[role=title]]:pointer-events-none [&_[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
              "relative grid grid-cols-1 auto-rows-max lg:grid-rows-[auto_1fr] lg:grid-cols-[1fr_auto] flex-1 gap-4 mt-4",
            )}
          >
            {isCreate ? (
              // SidebarChildren sibling dari FormChildren (beda provider
              // instance), jadi butuh FormPageProvider sendiri agar
              // useFormPage() (mis. ItemImageUploader) tidak undefined.
              // Mode create: defaultData null, Connections/amended_from di-skip (butuh record).
              <FormPageProvider
                isCreate={true}
                disabled={disabled}
                errors={errors}
                fieldNameTrans={fieldNameTrans}
                defaultData={null}
                data={data}
                setData={setData}
                form={form}
              >
                <SidebarChildren
                  content={sidebarContent}
                  hasConnections={false}
                  submitable={false}
                  defaultData={null}
                />
              </FormPageProvider>
            ) : (
              <FormPageProvider
                isCreate={false}
                disabled={disabled}
                errors={errors}
                fieldNameTrans={fieldNameTrans}
                defaultData={defaultData}
                data={data}
                setData={setData}
                form={form}
              >
                <SidebarChildren
                  content={sidebarContent}
                  hasConnections={
                    submitable &&
                    defaultData?.status &&
                    !inArray(defaultData?.status, "draft")
                  }
                  submitable={submitable}
                  defaultData={defaultData}
                />
              </FormPageProvider>
            )}
            <FormChildren
              ref={ref}
              disabled={disabled}
              className={className}
              isCreate={isCreate}
              // showHeader={showHeader}
              errors={errors}
              fieldNameTrans={fieldNameTrans}
              defaultData={defaultData}
              data={data}
              setData={setData}
              defaultMenu={defaultMenu}
              form={form}
              hasConnections={
                submitable &&
                defaultData?.status &&
                !inArray(defaultData?.status, "draft")
              }
            >
              {children}
            </FormChildren>
            {!isCreate && <BottombarChildren content={bottombarContent} />}
          </div>
        </form>
        {submitable && (
          <AlertDialog
            open={showAlertBeforeSubmit}
            onOpenChange={setShowAlertBeforeSubmit}
          >
            <AlertDialogContent>
              <TooltipProvider>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("core.form.confirmation_submit.title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("core.form.confirmation_submit.subtitle")}
                  </AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      className="h-8"
                      onClick={() => setShowAlertBeforeSubmit(false)}
                    >
                      {t("core.form.confirmation_submit.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="h-8"
                      onClick={(e) => {
                        setShowAlertBeforeSubmit(false);
                        e.action = "submit";
                        onSubmit?.(e);
                      }}
                    >
                      {t("core.form.confirmation_submit.submit")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogHeader>
              </TooltipProvider>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {submitable &&
          defaultData?.submitted_at &&
          !inArray(defaultData?.status, ["canceled", "completed"]) && (
            <AlertDialog
              open={showAlertBeforeCancel}
              onOpenChange={setShowAlertBeforeCancel}
            >
              <AlertDialogContent>
                <TooltipProvider>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("core.form.confirmation_cancel.title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("core.form.confirmation_cancel.subtitle")}
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        className="h-8"
                        onClick={() => setShowAlertBeforeCancel(false)}
                      >
                        {t("core.form.confirmation_cancel.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="h-8"
                        onClick={(e) => {
                          setShowAlertBeforeCancel(false);
                          onCancel(e);
                        }}
                      >
                        {t("core.form.confirmation_cancel.submit")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogHeader>
                </TooltipProvider>
              </AlertDialogContent>
            </AlertDialog>
          )}
        {emailDialog && (
          <EmailSendDialog
            open={!!emailDialog}
            onOpenChange={(open) => !open && setEmailDialog(null)}
            resourceNamePlural={pluralize.plural(name ?? "")}
            documentId={defaultData[primaryKey]}
            emailTemplateId={emailDialog.emailTemplateId}
          />
        )}
      </AppLayout>
    );
  }),
);

const ApprovalActedByDetail = memo(function ApprovalActedByDetail({
  acted_by,
  acted_at,
  notes,
}) {
  const { t } = useLaravelReactI18n();
  const lang = usePage().props?.lang;

  const alias = acted_by?.name
    ?.split(" ")
    ?.slice(0, 2)
    ?.map((n) => n.charAt(0))
    ?.join("");

  return (
    <div className="text-sm space-y-1.5 mt-1">
      <p className="truncate">
        {t("core.approvalScheme.steps.columns.acted_by")} :
      </p>
      <p className="truncate flex items-center gap-x-2 w-full">
        <Avatar className="rounded-full h-max size-10">
          {acted_by?.picture && (
            <AvatarImage
              src={resolveImageSrc(acted_by.picture)}
              alt={acted_by?.name}
            />
          )}
          <AvatarFallback className="text-xl font-semibold rounded-lg">
            {alias}
          </AvatarFallback>
        </Avatar>
        <span>{acted_by?.name}</span>
        <span>●</span>
        <span>
          {format(new TZDate(acted_at, "UTC"), "PPPp", {
            locale: getLocaleDate(lang),
          })}
        </span>
      </p>

      {notes && (
        <div className="rounded-lg border-muted-foreground/30 mt-2 border">
          <p className="truncate border-b border-muted-foreground/30 px-2 pt-2 pb-1 font-semibold">
            {t("core.approvalScheme.steps.columns.notes")}
          </p>
          <p className="p-2 w-full text-wrap wrap-break-word text-justify">
            {notes}
          </p>
        </div>
      )}
    </div>
  );
});

const ApprovalItem = memo(function ApprovalItem({
  id,
  approver,
  approver_type,
  acted_by,
  acted_at,
  notes,
  status,
  is_advanced,
  approvers,
}) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);

  const hasDetail = !(
    status == "waiting" ||
    status == "pending" ||
    status == "skipped"
  );

  return (
    <li key={id} className="mb-3 first:mt-2 ms-6">
      <div
        className={cn(
          "p-2 -mt-1.5 size-[34px] inset-s-[-18px] border-muted flex justify-center items-center absolute rounded-full",
        )}
      >
        <span
          className={cn(
            "block rounded-full bg-accent-foreground size-2",
            !hasDetail && "bg-muted-foreground",
          )}
        />
      </div>
      <Collapsible open={hasDetail && open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            "[&[data-state=open]_svg]:rotate-180 text-foreground grid grid-cols-[auto_1fr] gap-x-2 items-center",
            !hasDetail && "text-muted-foreground",
            hasDetail && "cursor-pointer",
          )}
        >
          {hasDetail && (
            <ChevronDownIcon className="w-4 h-4 transition-transform duration-200 shrink-0" />
          )}
          <p className="text-sm font-normal leading-none">
            {is_advanced ? (
              <span className="font-medium">
                {t("core.approvalScheme.steps.columns.is_advanced_label")}
              </span>
            ) : (
              <>
                <span className="capitalize">{approver_type + ": "}</span>
                <span>{convertTemplateLink(approver)}</span>
              </>
            )}
            <BadgeStatus className="ml-2" status={status} />
          </p>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <div className="ml-6 w-[calc(100%-calc(var(--spacing,0.25)*6))]">
            {is_advanced && approvers && approvers.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {approvers.map((childApprover) => {
                  const childHasDetail = !(
                    childApprover.status == "waiting" ||
                    childApprover.status == "pending" ||
                    childApprover.status == "skipped"
                  );
                  return (
                    <li
                      key={childApprover.id}
                      className="border-l-2 border-muted pl-3"
                    >
                      <p className="text-sm">
                        <span className="capitalize">
                          {childApprover.approver_type + ": "}
                        </span>
                        <span>
                          {convertTemplateLink(childApprover.approver)}
                        </span>
                        <BadgeStatus
                          className="ml-2"
                          status={childApprover.status}
                        />
                      </p>
                      {childHasDetail && (
                        <ApprovalActedByDetail
                          acted_by={childApprover.acted_by}
                          acted_at={childApprover.acted_at}
                          notes={null}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              hasDetail && (
                <ApprovalActedByDetail
                  acted_by={acted_by}
                  acted_at={acted_at}
                  notes={notes}
                />
              )
            )}
            {hasDetail && is_advanced && notes && (
              <div className="rounded-lg border-muted-foreground/30 mt-2 border">
                <p className="truncate border-b border-muted-foreground/30 px-2 pt-2 pb-1 font-semibold text-sm">
                  {t("core.approvalScheme.steps.columns.notes")}
                </p>
                <p className="p-2 w-full text-wrap wrap-break-word text-justify text-sm">
                  {notes}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
});

const Approvals = memo(
  forwardRef(function Approvals({ approvals }, ref) {
    return (
      <TabsContent value="approvals" className="mt-0" ref={ref}>
        <div className="p-4 mt-0! border-b-0">
          <ol className="relative ml-3.5 border-muted border-s-2 ">
            {approvals &&
              approvals.map(({ id, ...approval }) => (
                <ApprovalItem {...approval} key={id} />
              ))}
          </ol>
        </div>
      </TabsContent>
    );
  }),
);

const SidebarChildren = memo(
  forwardRef(function SidebarChildren(
    { content, className, hasConnections, submitable, defaultData },
    ref,
  ) {
    const route = window.route;
    const { connections } = usePage().props;
    const { t } = useLaravelReactI18n();
    const defaultSidebarChildren = useMemo(() => {
      return (
        <ul className={cn("flex w-full min-w-0 flex-col gap-1")}>
          <li>
            <AssignedTo />
          </li>
          <li>
            <Attachments />
          </li>
          <li>
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
          "flex flex-col z-10 order-2 lg:max-w-72 lg:col-start-2 lg:row-span-2 h-fit  gap-y-4 lg:sticky lg:top-[73px]",
        )}
      >
        {submitable && defaultData?.amended_from_id && (
          <FormInput
            label={t("core.form.amended_from")}
            className="pointer-events-auto!"
          >
            <LinkModel
              disabledAddButton
              readOnly
              value={defaultData?.amended_from}
              customNavigation={(value) => {
                window.open(route(route().current(), value?.id), "_blank");
              }}
            />
          </FormInput>
        )}
        {hasConnections && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="[&[data-state=open]_svg]:rotate-180 flex items-center gap-x-2">
              <ChevronDownIcon className="w-4 h-4 transition-transform duration-200 shrink-0" />
              {t("core.form.connections")}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <WhenVisible
                data={["connections"]}
                fallback={
                  <div className="text-base! font-normal text-foreground flex gap-x-4">
                    <LoadingIcon className="size-4" />
                    <span>{t("core.form.loading")} ...</span>
                  </div>
                }
              >
                {connections &&
                  connections?.map((connection) => {
                    return (
                      <Collapsible
                        key={connection.reference_type}
                        className="ml-6"
                      >
                        <CollapsibleTrigger className="[&[data-state=open]_svg]:rotate-180  flex items-center gap-x-2">
                          <ChevronDownIcon className="w-4 h-4 transition-transform duration-200 shrink-0" />
                          {connection.model}
                          <span className="rounded-full size-6 flex justify-center items-center bg-foreground/90 text-muted!">
                            {connection.count}
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          {connection.items?.map((item) => {
                            return (
                              <div key={item.id} className="ml-6">
                                <Link
                                  href={route(item.route, item.reference_id)}
                                  className="text-blue-800 dark:text-blue-200 hover:underline"
                                >
                                  {item.reference_display}
                                </Link>
                              </div>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
              </WhenVisible>
            </CollapsibleContent>
          </Collapsible>
        )}
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
      defaultValue,
      children,
      badge,
      method = "post",
      routeName,
      routeParams,
      ignoreDraft = false,
      sidebarContent,
      open: openProps,
      onOpenChange,
      onSuccess,
      postOption = {},
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const route = window.route;
    const [internalOpen, setInternalOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const isControlled = openProps !== undefined;
    const open = isControlled ? openProps : internalOpen;

    const handleOpenChange = (val) => {
      if (isControlled && onOpenChange) {
        onOpenChange(val);
      } else {
        setInternalOpen(val);
      }
    };

    const hasSidebar = sidebarContent !== false;
    useImperativeHandle(
      ref,
      () => ({
        open: () => handleOpenChange(true),
        close: () => handleOpenChange(false),
      }),
      [isControlled, onOpenChange],
    );

    // Tutup dialog saat Inertia terima non-JSON response (Whoops/HTML) agar
    // Radix focus trap tidak memblokir Whoops page, lalu buka kembali setelah
    // satu tick sehingga Whoops tampil di belakang dialog.
    useEffect(() => {
      if (!open) return;
      const handler = () => {
        handleOpenChange(false);
        setTimeout(() => handleOpenChange(true), 100);
      };
      document.addEventListener("inertia:invalid", handler);
      return () => document.removeEventListener("inertia:invalid", handler);
    }, [open]);
    const { loadDraft, ...form } = useDraftForm(name, defaultValue ?? {}, {
      // onContinueDraft: () => {
      //   onOpenChange?.(true);
      // },
      isCreate: true,
      isDialog: true,
    });
    const {
      data,
      setData: _setData,
      processing,
      errors,
      isDirty,
      reset,
      setDefaults,
      clearErrors,
      key,
      submit,
    } = form;
    const disabled = disabledProps ?? processing;

    useEffect(() => {
      setDefaults(defaultValue ?? {});
      _setData(defaultValue ?? {});
    }, [defaultValue]);
    useEffect(() => {
      if (ignoreDraft) return;
      if (!open) return;
      else {
        loadDraft();
      }
      reset();
    }, [open, ignoreDraft]);
    // Setiap dialog dibuka, sidebar default terbuka.
    useEffect(() => {
      if (open) setSidebarOpen(true);
    }, [open]);

    const setData = useCallback(
      (...args) => {
        if (disabled) return;
        _setData(...args);
      },
      [disabled, _setData],
    );
    const {
      setLeave,
      setSaveAsDraft,
      setIsDirty,
      setShowAlert,
      setKeepDraftOnClean,
    } = useIsDirtyForm();
    const { cancel } = useAlertDraftForm();
    const formRef = useRef();
    const onKeyDown = useCallback(
      (e) => {
        e.stopPropagation();
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
      setLeave(() => {
        handleOpenChange(false);
        setShowAlert(false);
        setIsDirty(false);
        cancel();
        reset();
        clearErrors();
        removeFromLocalStorage(key);
      });
      setSaveAsDraft(() => {
        handleOpenChange(false);
        setShowAlert(false);
        if (key) setKeepDraftOnClean(key, true);
        setIsDirty(false);
        clearErrors();
        reset();
      });
      if (isDirty) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
        handleOpenChange(val);
        reset();
        clearErrors();
        if (isControlled) {
          setData?.({});
        }
      }
    };

    useDidMountEffect(() => {
      if (form.recentlySuccessful && isControlled) {
        handleOpenChange(false);
        reset();
      }
    }, [form.recentlySuccessful, isControlled]);

    const _onSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (!name) return;
      const pluralized = routeName ?? `${pluralize.plural(name ?? "")}.store`;
      // File sudah ter-upload sebagai draft (punya id). Submit cukup kirim
      // filesId[] → File::uploadFile cabang filesId → Fileable dibuat &
      // is_draft di-clear. form.transform agar tak memutasi data reaktif.
      const files = Array.isArray(data?.files) ? data.files : [];
      form.transform((payload) => {
        const payloadData = { ...payload };
        const fileIds = files.map((f) => f.id).filter(Boolean);

        if (fileIds.length > 0) {
          payloadData.filesId = fileIds;
        }

        return payloadData;
      });

      const methodToUse = postOption?.method ?? method;

      const excludedKeys = ["initalData", "method"];
      const filteredOption = Object.fromEntries(
        Object.entries(postOption ?? {}).filter(
          ([key]) => !excludedKeys.includes(key),
        ),
      );

      const routerOption = {
        preserveState: true,
        preserveUrl: isControlled ? true : false,
        ...filteredOption,
        onSuccess: (e) => {
          _setData(defaultValue ?? {});
          if (!isControlled) {
            handleOpenChange(false);
          }
          if (onSuccess) onSuccess(e);
        },
      };

      submit(methodToUse, route(pluralized, routeParams), routerOption);
    };
    return (
      <AlertDialog open={open}>
        <AlertDialogContent
          className={cn(
            "py-0 overflow-hidden",
            // Lebar dialog = className call-site (mis. max-w-6xl), TETAP saat
            // buka/tutup sidebar → tak ada glitch lebar (w-fit tak bisa dianimasi).
            // Ruang sidebar dibuka via padding-right yang ditransisi (lihat body).
            className,
          )}
        >
          <TooltipProvider>
            <form
              ref={formRef}
              onKeyDown={onKeyDown}
              onSubmit={_onSubmit}
              disabled={disabled}
              className={cn(
                "max-h-screen overflow-y-hidden flex flex-col",
                disabled &&
                  " **:[[role=title]]:pointer-events-none **:[[role=forminput]]:pointer-events-none [&_button[role=save]]:hidden",
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
                  {hasSidebar && (
                    <button
                      type="button"
                      onClick={() => setSidebarOpen((v) => !v)}
                      className="items-center hidden gap-2 px-2 py-1 ml-auto text-sm font-normal rounded lg:flex text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={t("core.form.attachments_and_tags")}
                    >
                      <PanelRightIcon className="size-4" />
                      <span>{t("core.form.attachments_and_tags")}</span>
                    </button>
                  )}
                </AlertDialogTitle>
                <AlertDialogDescription className="sr-only"></AlertDialogDescription>
              </AlertDialogHeader>
              <div
                className={cn(
                  "overflow-y-auto",
                  // ≥lg: container relatif; ruang sidebar dibuka via padding-right
                  // yang ditransisi (length → mulus, tak loncat seperti w-fit).
                  // Sidebar di-absolute-kan mengisi area padding itu.
                  hasSidebar &&
                    "lg:relative lg:transition-[padding] lg:duration-200",
                  hasSidebar && (sidebarOpen ? "lg:pr-[19rem]" : "lg:pr-0"),
                )}
              >
                <div className="min-w-0">
                  {errors && Object.keys(errors).length > 0 && (
                    <div className="flex-col w-full mt-4 alert error">
                      <h3 className="text-base font-semibold">
                        {t("core.form.errors.title")}
                      </h3>
                      <ul className="block pl-5">
                        {Object.entries(errors).map(([key, value]) => (
                          <li key={key} className="list-disc">
                            {fieldNameTrans
                              ? value.replace(
                                  key,
                                  t(`${fieldNameTrans}.${key}`),
                                )
                              : value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <FormChildren
                    isCreate={true}
                    disabled={disabled}
                    defaultMenu={defaultMenu}
                    className={className}
                    showHeader={false}
                    errors={errors}
                    fieldNameTrans={fieldNameTrans}
                    data={data}
                    setData={setData}
                    form={form}
                  >
                    {children}
                  </FormChildren>
                </div>
                {hasSidebar && (
                  <FormPageProvider
                    isCreate={true}
                    disabled={disabled}
                    errors={errors}
                    fieldNameTrans={fieldNameTrans}
                    defaultData={null}
                    data={data}
                    setData={setData}
                    form={form}
                  >
                    <div
                      className={cn(
                        "min-w-0 h-fit mt-4",
                        // ≥lg: sidebar absolute mengisi area padding-right (19rem)
                        // dialog. Slide+fade saat buka/tutup (transform & opacity
                        // dapat dianimasi mulus, tak memicu reflow lebar dialog).
                        "lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:w-72 lg:h-full lg:overflow-y-auto",
                        "lg:transition-[transform,opacity] lg:duration-200",
                        // Mobile (<lg): border atas (stack di bawah form).
                        // ≥lg: border kiri.
                        "border-t pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-4",
                        // SidebarChildren bawa class grid FormPage (lg:sticky/col-start)
                        // yang tak relevan di dialog — netralkan via wrapper.
                        "[&>div]:static! [&>div]:top-auto! [&>div]:max-w-none! [&>div]:col-auto! [&>div]:row-auto!",
                        // Mobile (<lg): SELALU tampil (toggle disembunyikan).
                        // ≥lg: ikut sidebarOpen — slide+fade keluar saat tutup.
                        sidebarOpen
                          ? "lg:translate-x-0 lg:opacity-100"
                          : "lg:translate-x-full lg:opacity-0 lg:pointer-events-none",
                      )}
                    >
                      <SidebarChildren
                        content={sidebarContent}
                        submitable={false}
                        defaultData={null}
                        hasConnections={false}
                      />
                    </div>
                  </FormPageProvider>
                )}
              </div>
              <AlertDialogFooter className="pb-6 mt-4">
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
          </TooltipProvider>
        </AlertDialogContent>
      </AlertDialog>
    );
  }),
);

const FormPageDiff = memo(
  forwardRef(function FormPageDiff({ title, badge, className, children }, ref) {
    const { t } = useLaravelReactI18n();
    const { dataAfter: data, dataBefore, log, lang } = usePage().props;
    const layoutRef = useRef(null); // wrapper AppLayout
    const lastPositionRef = useRef(0);
    const showHeaderRef = useRef(true);
    const handleScroll = useCallback((e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const position = Math.ceil(
        (scrollTop / (scrollHeight - clientHeight)) * 100,
      );
      const prev = lastPositionRef.current;
      if (prev === position) return;
      lastPositionRef.current = position;

      const nextShow = position <= prev;
      if (showHeaderRef.current === nextShow) return;
      showHeaderRef.current = nextShow;

      // toggle kelas header tanpa re-render
      const headerEl = layoutRef.current?.querySelector("[data-header]");
      headerEl?.classList.toggle("is-hidden", !nextShow);

      // update top TabsList via CSS variable
      const tabsEl = layoutRef.current?.querySelector("[data-tabs]");
      tabsEl?.style.setProperty("--tabs-top", nextShow ? "3.5rem" : "0px");
    }, []);
    const alias = useMemo(() => {
      return log.user.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n.charAt(0))
        .join("");
    }, [log.user.name]);
    return (
      <AppLayout
        data-disabled={true}
        className="pt-0! relative group/form"
        onScroll={handleScroll}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div
            data-header
            className={cn(
              // showHeader ? "top-0" : "-top-16",
              " transition-[top] duration-300 ease-in-out sticky z-10 flex items-center justify-between pt-4 pb-2 border-b gap-x-4 bg-background border-muted-foreground/25",
            )}
          >
            <Head title={title} />
            <div className="flex items-center gap-x-2">
              {title && <h1 className="text-xl font-bold">{title}</h1>}
              {/* {isDirty && (
                <span className="text-sm badge warning">
                  {t("core.form.not_saved")}
                </span>
              )} */}
              {badge}
            </div>
            <div className="flex items-center gap-x-2 "></div>
          </div>

          <div
            className={cn(
              "**:[[role=title]]:pointer-events-none  [&_button[role=save]]:hidden",
              "relative grid grid-cols-1 auto-rows-max lg:grid-rows-[auto_1fr] lg:grid-cols-[1fr_auto] flex-1 gap-4 mt-4",
            )}
          >
            <FormChildren
              isCreate={false}
              ref={ref}
              disabled={true}
              className={className}
              // showHeader={showHeader}
              dataBefore={dataBefore ?? {}}
              data={data ?? {}}
              setData={() => {}}
            >
              {children}
            </FormChildren>
            <BottombarChildren
              content={
                <>
                  <p className="mt-8 text-xl font-bold">
                    {t("core.form.log_informations")}
                  </p>
                  <div className="border border-muted-foreground/25 rounded-lg grid grid-cols-[auto_1fr] [&>div:nth-child(odd)]:bg-muted/50  [&>div>*]:py-1.5 [&>div>*]:px-4 [&>div>*:first-child]:pl-2 [&>div>*]:border-muted-foreground/25 [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25 [&>div_p]:text-sm">
                    <div className="grid grid-cols-subgrid col-span-full">
                      <p>{t("core.form.timestamp")}</p>
                      <p>
                        {format(new TZDate(log.created_at, "UTC"), "PPPp", {
                          locale: getLocaleDate(lang),
                        })}
                      </p>
                    </div>
                    <div className="grid grid-cols-subgrid col-span-full">
                      <p>{t("core.form.updated_by")}</p>
                      <div className="flex items-center gap-3 px-1 py-1.5 text-left text-sm">
                        <Avatar className="rounded-lg size-20">
                          {log.user.picture && (
                            <AvatarImage
                              src={resolveImageSrc(log.user.picture)}
                              alt={log.user.name}
                            />
                          )}
                          <AvatarFallback className="text-4xl font-semibold rounded-lg">
                            {alias}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-base leading-tight text-left gap-y-0.5">
                          <span className="font-semibold truncate">
                            {log.user.name}
                          </span>
                          <span className="text-sm truncate text-foreground/80">
                            {log.user.username}
                          </span>
                          <div className="w-fit px-2 py-0.5 rounded-full gap-x-1 items-center text-foreground/80  bg-muted">
                            <span className="text-sm truncate">
                              {log.user.email}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              }
            />
          </div>
        </form>
      </AppLayout>
    );
  }),
);

export {
  FormPage,
  FormChildren,
  FormPageContent,
  FormPageContentTitle,
  FormPageContentDescription,
  FormPageDialog,
  FormPageDiff,
  useFormPage,
  useFormPageMeta,
  // useFormPageContent,
};
