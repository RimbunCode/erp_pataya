import { ArrowRight, PlusIcon, XIcon } from "lucide-react";
import { Command, CommandEmpty, CommandItem, CommandList } from "./ui/command";
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
import { cn, getValueObject, isNullOrWhitespace } from "@/lib/utils";

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
      case "or":
        result = validateWithOperators(value, val, key);
        break;
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
        result = Array.isArray(value) ? value.includes(val) : false;
        break;
      case "notLike":
      case "notIn":
        result = Array.isArray(value) ? !value.includes(val) : true;
        break;
      case "between":
        result = value > val[0] && value < val[1];
        break;
      case "notBetween":
        result = value < val[0] || value > val[1];
        break;
      default:
        result = true;
        break;
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
      as,
      value,
      onValueChange,
      placeholder,
      className,
      disabled,
      readOnly,
      required,
      model,
      limit,
      filters,
      joins,
      keywords,
      titleDialog,
      classNameDialog,
      disabledNavigation,
      disabledAddButton,
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
    const [options, setOptions] = useState([]);
    const [allowSearch, setAllowSearch] = useState(true);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const { name, keyRoute } = useMemo(() => {
      if (as) {
        const [name, keyRoute] = as.split(":");
        return { name: name.toLowerCase(), keyRoute };
      }
      return {
        name: model.split("\\").pop().toLowerCase(),
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

    const convertTemplateLink = useCallback((value, search) => {
      const template = value.templateLink ?? "";
      let item = template.replace(
        /:((\w[\w]+{:[\w]+})|(\w[\w.]+))/g,
        (match) => {
          match = match.replace(/(.*?){:(.*?)}/i, ":$2");
          const newValue = getValueObject(value, match.substring(1));
          return newValue || match;
        },
      );
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
    }, []);

    useDidMountEffect(() => {
      _setOption(value);
    }, [value]);

    const setOption = useCallback(
      (val) => {
        _setOption(val);
        onValueChange?.(val);
      },
      [onValueChange, _setOption],
    );

    useEffect(() => {
      if (!open && !option && search) {
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
      if (!(option || value)) return;
      const isValid = validate(option || value, filters);

      if (!isValid) {
        setOption(null);
      }
    }, [filters]);

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
        })
        .then((res) => {
          setOptions(res.data);
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
      const reloadModel = setTimeout(() => {
        setLoading(true);
        getModels();
      }, 500);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [search]);
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
    return (
      <Popover open={open} onOpenChange={() => {}}>
        <Command
          className="relative h-full overflow-visible bg-transparent"
          ref={commandRef}
          loop
        >
          <PopoverTrigger
            asChild
            className={cn(
              "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
              disabled && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            <div>
              <Input
                ref={ref}
                disabled={disabled}
                readOnly={readOnly}
                onKeyDown={onInputKeyDown}
                onClick={(e) => {
                  e.preventDefault();
                  if (!option || !search) {
                    setOpen(true);
                    getModels();
                  }
                }}
                required={required}
                value={search}
                onChange={(e) => {
                  setAllowSearch(true);
                  setSearch(e.target.value);
                }}
                className={cn(
                  "focus:!border-0 !bg-inherit disabled:!opacity-100 h-8 w-full !rounded-none !pr-2 !border-0  focus-visible:!ring-0 focus-visible:!ring-offset-0  ",
                )}
                placeholder={placeholder}
              />
              <div className="flex items-center h-8 pr-2 gap-x-2">
                {!disabledNavigation && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-6 hidden",
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
              </div>
            </div>
          </PopoverTrigger>
          {!(disabled || readOnly) && (
            <PopoverContent
              onOpenAutoFocus={(e) => e.preventDefault()}
              align="start"
              side="bottom"
              className="relative z-50 w-auto  min-w-[--radix-popover-trigger-width] p-0 "
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
            postOption={postOption}
          >
            {form}
          </FormPageLinkModelDialog>
        )}
      </Popover>
    );
  }),
);
