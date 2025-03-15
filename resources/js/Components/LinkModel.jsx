import { Command, CommandEmpty, CommandItem, CommandList } from "./ui/command";
import { PlusIcon, XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { forwardRef, memo, useCallback, useEffect, useState } from "react";

import { Button } from "./ui/button";
import { Command as CommandPrimitive } from "cmdk";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import { Input } from "./ui/input";
import LoadingIcon from "./LoadingIcon";
import React from "react";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useDetectClickOutside } from "react-detect-click-outside";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

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
 */
export default memo(
  forwardRef(function LinkModel(
    {
      value,
      onValueChange,
      placeholder,
      className,
      disabled,
      model,
      limit,
      filters,
      name,
      titleDialog,
      classNameDialog,
      onAddClick,
      form,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [option, _setOption] = useState(value);
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState([]);
    const [allowSearch, setAllowSearch] = useState(true);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const commandRef = useDetectClickOutside({
      onTriggered: () => {
        setOpen(false);
      },
    });

    const convertTemplateLink = useCallback((value, search) => {
      const template = value.templateLink;

      const item = template.replace(
        /:\w+/g,
        (match) => value[match.substring(1)] || match,
      );
      if (!search) {
        return item;
      }

      let searchWords =
        search
          .split(/\s+/)
          ?.map((string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) ||
        [];
      let regex = new RegExp(`(${searchWords.join("|")})`, "gi");

      let parts = item.split(regex).filter(Boolean);

      return (
        <p>
          {parts.map((part, index) => {
            return searchWords.some(
              (word) =>
                part.toString().toLowerCase() ===
                word.toString().replaceAll("\\", "").toLowerCase(),
            ) ? (
              <mark className="bg-yellow-500" key={index}>
                {part}
              </mark>
            ) : (
              <>{part}</>
            );
          })}
        </p>
      );
    });

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
      if (!open && !option) {
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
      }
    }, [option]);

    useDidMountEffect(() => {
      if (!allowSearch) return;
      const reloadModel = setTimeout(() => {
        setLoading(true);
        axios
          .post("/model", {
            model,
            limit: limit ?? 10,
            search: search,
            filters,
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
      }, 500);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [search]);
    const onInputKeyDown = (e) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.key == "Tab" ||
        e.key == "Enter"
      )
        return;
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
          className="relative h-auto overflow-visible bg-transparent"
          ref={commandRef}
          loop
        >
          <PopoverTrigger
            asChild
            className="flex h-8 overflow-hidden border rounded-md cursor-default rrelative focus-within:border-0 border-input ring-offset-background bg-muted focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1"
          >
            <div>
              <Input
                ref={ref}
                disabled={disabled}
                name={name}
                onKeyDown={onInputKeyDown}
                value={search}
                onChange={(e) => {
                  setAllowSearch(true);
                  setSearch(e.target.value);
                }}
                className={cn(
                  "focus:!border-0 h-8 w-full rounded-normal !pr-2 !border-0  focus-visible:!ring-0 focus-visible:!ring-offset-0  ",
                  className,
                )}
                placeholder={placeholder}
              />
              <div className="flex items-center h-8 pr-2 gap-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("size-6", !search && "hidden")}
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
          <PopoverContent
            onOpenAutoFocus={(e) => e.preventDefault()}
            align="start"
            side="bottom"
            className="relative z-50  w-[--radix-popover-trigger-width] p-0 "
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
                    options?.map((opt) => (
                      <CommandItem
                        key={opt.id}
                        value={convertTemplateLink(opt)}
                        onSelect={() => {
                          setOption(opt);
                          setOpen(false);
                        }}
                      >
                        {convertTemplateLink(opt, search)}
                      </CommandItem>
                    ))}
                  {(onAddClick || form) && (
                    <CommandItem
                      onSelect={() => {
                        console.log("onAddClick");
                        if (onAddClick) {
                          onAddClick();
                          return;
                        }
                        setOpenDialog(true);
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
        </Command>
        {form && (
          <FormPageDialog
            title={titleDialog}
            name={name}
            open={openDialog}
            onOpenChange={setOpenDialog}
            className={cn("max-w-lg", classNameDialog)}
          >
            {form}
          </FormPageDialog>
        )}
      </Popover>
    );
  }),
);
