import { ArrowRight, PlusIcon, XIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import {
  Fragment,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { camelize, cn, getValueObject, isNullOrWhitespace } from "@/lib/utils";

import { Button } from "./ui/button";
import { Command as CommandPrimitive } from "cmdk";
import { FormPageLinkModelDialog } from "@/Pages/Core/FormPage";
import { Input } from "./ui/input";
import LoadingIcon from "./LoadingIcon";
import React from "react";
import axios from "axios";
import pluralize from "pluralize";
import { useDetectClickOutside } from "react-detect-click-outside";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

function validateWithOperators(value, operators, logic = "and") {
  let result = false;
  for (let key in operators) {
    const val = operators[key];
    key = key.match(/^([^\[\]]+)/)?.[1] ?? key;
    switch (key) {
      case "and":
      case "or": {
        result =
          Array.isArray(val) && key == "or"
            ? val.includes(value)
            : validateWithOperators(value, val, key);
        break;
      }
      case "not":
        result = value != operators[key];
        break;
      case "=":
        result = value == val;
        break;
      case ">":
        result = value > val;
        break;
      case ">=":
        result = value >= val;
        break;
      case "<":
        result = value < val;
        break;
      case "<=":
        result = value <= val;
        break;
      case "like":
      case "in":
        result = Array.isArray(val) ? val.includes(value) : false;
        break;
      case "notLike":
      case "notIn":
        result = Array.isArray(val) ? !val.includes(value) : true;
        break;
      case "between":
        result = value > val[0] && value < val[1];
        break;
      case "notBetween":
        result = value < val[0] || value > val[1];
        break;
      default: {
        result =
          (value?.[key] ?? false)
            ? validateWithOperators(value[key], val)
            : true;

        break;
      }
    }
    if (logic === "and" && !result) return false;
    if (logic === "or" && result) return true;
  }
  return logic == "and";
}
function validate(value, filters, logic = "and") {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return true;
  }

  for (let key in filters) {
    const val = filters[key];
    key = key.match(/^([^\[\]]+)/)?.[1] ?? key;
    // key = (key.match(/^raw\((.+)\)$/)?.[1] ?? key).split(".").pop();
    let result = false;
    if (/^raw\((.+)\)$/.test(key)) {
      result = true;
    } else if (key === "and" || key === "or") {
      result = validate(value, val, key);
    } else if (val === undefined) {
      result = true;
    } else if (Array.isArray(val)) {
      result = JSON.stringify(value[key]) === JSON.stringify(val);
    } else if (typeof val !== "object" || val === null) {
      result = value[key] == val;
    } else {
      result = validateWithOperators(value[key], val);
    }
    if (logic === "and" && !result) return false;
    if (logic === "or" && result) return true;
  }

  return logic === "and";
}

export const convertTemplateLink = (value, search) => {
  if (!value) return "";
  const template = value.templateLink ?? "";
  let item = template.replace(/:((\w[\w]+{:[\w]+})|(\w[\w.]+))/g, (match) => {
    match = match.replace(/(.*?){:(.*?)}/i, ":$2");
    const newValue = getValueObject(value, match.substring(1));
    return newValue || match;
  });
  if (search == null) {
    const titleMatch = item.match(/<title(.*?)>(.*?)<\/title>/i);
    const plainTextMatch = item.match(/^[^<]+/g);

    return titleMatch
      ? titleMatch[2].trim()
      : plainTextMatch
        ? plainTextMatch[0].trim()
        : "";
  }

  item = item.replace(/<title(.*?)>(.*?)<\/title>/gi, "");

  let searchWords =
    search
      .split(/\s+/)
      ?.map((string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter((x) => !isNullOrWhitespace(x)) || [];

  if (searchWords.length < 1) return item;

  let regex = new RegExp(`(${searchWords.join("|")})`, "gi");
  item = item.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag; // Jika ini bagian dari tag HTML, jangan ubah
    return text.replace(regex, `<mark class="bg-yellow-500">$1</mark>`); // Hanya ubah teks biasa
  });

  return item;
};

/**
 *
 * @param props
 * @param props.value
 * @param props.onValueChange
 * @param props.placeholder
 * @param props.className
 * @param props.disabled
 * @param props.model
 * @param props.limit
 * @param props.filters
 * @param props.joins
 * @param props.keywords
 */
export default memo(
  forwardRef(function LinkModel(
    {
      id,
      as,
      valueBefore,
      value,
      onValueChange,
      placeholder,
      className,
      disabled,
      readOnly,
      required,
      model,
      limit = 10,
      filters,
      joins,
      keywords,
      translate,
      titleDialog,
      classNameDialog,
      disabledNavigation,
      disabledAddButton,
      defaultValueForm,
      form,
      postOption,
      onKeyDown,
      with: _with,
      order,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [_option, _setOption] = useState(value);
    const [search, setSearch] = useState("");
    const [total, setTotal] = useState(0);
    const [options, setOptions] = useState([]);
    const [allowSearch, setAllowSearch] = useState(true);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const { name, keyRoute } = useMemo(() => {
      if (as) {
        const [name, keyRoute] = as.split(":");
        return { name: camelize(name), keyRoute };
      }
      return {
        name: camelize(model.split("\\").pop()),
        keyRoute: "id",
      };
    }, [as, model]);
    // const name = (as || model.split("\\").pop()).toLowerCase();
    const route = window.route;
    const commandRef = useDetectClickOutside({
      onTriggered: () => {
        setOpen(false);
      },
    });
    const option = value ?? _option;

    useDidMountEffect(() => {
      _setOption(value);
    }, [value]);

    const setOption = useCallback(
      (val) => {
        if (disabled || readOnly) return;
        if (val) {
          const isValid = validate(val, filters);
          if (!isValid) return;
        }
        _setOption(val);
        onValueChange?.(val);
      },
      [onValueChange, _setOption, disabled, readOnly, filters],
    );

    useEffect(() => {
      if (open) return;

      setLoading(false);
      if (!option && search) {
        const findOption = options.find(
          (x) => convertTemplateLink(x).toLowerCase() == search.toLowerCase(),
        );
        if (findOption) {
          setOption(findOption);
          return;
        }
        setAllowSearch(false);
        setSearch("");
      }
    }, [open]);

    useEffect(() => {
      if (option) {
        setAllowSearch(false);
        setSearch(convertTemplateLink(option));
      } else if (!open) {
        setAllowSearch(true);
        setSearch("");
      }
    }, [option]);

    useEffect(() => {
      if (valueBefore !== undefined) {
        return;
      }
      if (!(option || value)) return;
      const isValid = validate(option || value, filters);

      if (!isValid) {
        setOption(null);
      }
    }, [filters, option, value]);

    const getModels = () => {
      axios
        .post(route("model"), {
          model,
          limit: limit ?? 10,
          search: search,
          with: _with,
          filters,
          joins,
          keywords,
          order,
          translate,
        })
        .then((res) => {
          const data = res.data.data;
          setTotal(res.data.total ?? data.length);
          setOptions(data);
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setLoading(false);
        });
    };

    useDidMountEffect(() => {
      if (!allowSearch) return;
      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels();
      }, 500);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [search]);
    useDidMountEffect(() => {
      if (!open) return;
      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels();
      }, 100);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [open]);
    const onInputKeyDown = (e) => {
      if (e.key == "Enter" && open) return;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.key == "Tab" ||
        e.key == "Enter"
      ) {
        onKeyDown?.(e);
        return;
      }
      if (readOnly || disabled) return;
      if (option) {
        setOption(null);
      }
      if (!open) {
        setOpen(true);
      }
    };

    const onSuccessFormPageLinkModelDialog = (e) => {
      setOpen(false);
      axios
        .post(route("model"), {
          model,
          with: _with,
          id: e.props.flash.id ?? null,
        })
        .then((res) => {
          setOption(res.data);
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setLoading(false);
        });
    };

    const diff = useMemo(() => {
      const before = convertTemplateLink(valueBefore);
      const after = convertTemplateLink(value);
      return {
        before: before != after && before,
        after,
        same: before == after,
      };
    }, [value, valueBefore]);
    return (
      <Popover open={open} onOpenChange={() => {}}>
        <Command
          className="relative h-full overflow-visible bg-transparent"
          ref={commandRef}
          loop
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger
                asChild
                className={cn(
                  "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                  valueBefore !== undefined &&
                    !diff?.same &&
                    "bg-yellow-200 dark:bg-yellow-900",
                  disabled && "cursor-not-allowed opacity-50",
                  className,
                )}
              >
                <div>
                  <Input
                    id={id}
                    ref={ref}
                    disabled={disabled}
                    readOnly={readOnly}
                    onKeyDown={onInputKeyDown}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!(option && search) && !open) {
                        setOpen(true);
                      }
                    }}
                    required={required}
                    value={search}
                    onChange={(e) => {
                      setAllowSearch(true);
                      setSearch(e.target.value);
                    }}
                    className={cn(
                      "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                      // diff.same && "text-",
                    )}
                    placeholder={placeholder}
                  />
                  <div className="flex items-center h-8 pr-2 w-fit gap-x-2">
                    {loading ? (
                      <LoadingIcon className="size-4" />
                    ) : (
                      <>
                        {!disabledNavigation && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-6 hidden",
                              valueBefore && "inline-flex!",
                              option &&
                                search &&
                                "group-focus-within/model:inline-flex",
                            )}
                            onClick={() => {
                              if (!name || !option || !search) return;
                              const pluralized = `${pluralize.plural(name ?? "")}.show`;
                              window.open(
                                route(pluralized, option[keyRoute ?? "id"]),
                                "_blank",
                              );
                            }}
                          >
                            <ArrowRight className="size-3" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "size-6 ",
                            (!search || disabled || readOnly) && "hidden",
                          )}
                          onClick={() => {
                            setOption(null);
                            setSearch("");
                          }}
                        >
                          <XIcon className="size-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            {valueBefore && !diff?.same && (
              <TooltipContent side="top" align="start">
                {diff?.before && (
                  <>
                    <s>{diff?.before}</s>
                    <br />
                  </>
                )}
                <span>{diff?.after}</span>
              </TooltipContent>
            )}
          </Tooltip>
          {!(disabled || readOnly) && (
            <PopoverContent
              onOpenAutoFocus={(e) => e.preventDefault()}
              align="start"
              side="bottom"
              className="relative z-50 w-auto  min-w-(--radix-popover-trigger-width) p-0 "
              forceMount
              asChild
            >
              <CommandList className="p-1 space-y-2">
                {loading ? (
                  <CommandPrimitive.Loading>
                    <div className="flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4">
                      <LoadingIcon className="size-4" />
                      <span>{t("core.form.loading")} ...</span>
                    </div>
                  </CommandPrimitive.Loading>
                ) : (
                  <>
                    <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                    {options &&
                      options?.map((opt, index) => {
                        return (
                          <CommandItem
                            key={opt.id ?? index}
                            value={opt.id ?? index}
                            onSelect={() => {
                              setOption(opt);
                              setOpen(false);
                            }}
                          >
                            <p
                              dangerouslySetInnerHTML={{
                                __html: convertTemplateLink(opt, search ?? ""),
                              }}
                            />
                          </CommandItem>
                        );
                      })}
                    {total > limit && !disabledAddButton && (
                      <CommandSeparator />
                    )}
                    {total > limit && (
                      <CommandItem
                        className="text-blue-700 hover:text-blue-900! dark:text-blue-300 dark:hover:text-blue-200!"
                        onSelect={() => {
                          // setOpenDialog(true);
                        }}
                      >
                        {t("core.form.linkmodel.more")}
                      </CommandItem>
                    )}
                    {!disabledAddButton && (
                      <CommandItem
                        onSelect={() => {
                          if (form) {
                            setOpenDialog(true);
                            return;
                          }

                          if (!name) return;
                          const pluralized = `${pluralize.plural(name ?? "")}.create`;
                          window.open(route(pluralized), "_blank");
                        }}
                      >
                        <PlusIcon className="size-4" />
                        {titleDialog}
                      </CommandItem>
                    )}
                  </>
                )}
              </CommandList>
            </PopoverContent>
          )}
        </Command>
        {form && (
          <FormPageLinkModelDialog
            title={titleDialog}
            name={name}
            open={openDialog}
            onOpenChange={setOpenDialog}
            className={cn("max-w-lg", classNameDialog)}
            defaultValue={defaultValueForm}
            onSuccess={onSuccessFormPageLinkModelDialog}
            postOption={postOption}
          >
            {form}
          </FormPageLinkModelDialog>
        )}
      </Popover>
    );
  }),
);
