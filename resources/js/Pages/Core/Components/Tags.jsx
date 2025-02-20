import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/Components/ui/command";
import { Deferred, router, usePage } from "@inertiajs/react";
import { Plus, TagsIcon, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn, generateRandom, isNullOrWhitespace } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Link from "@/Components/Link";
import LoadingIcon from "@/Components/LoadingIcon";
import QueryString from "qs";
import axios from "axios";
import { useDetectClickOutside } from "react-detect-click-outside";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Tags() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const inputRef = useRef();
  const [tags, setTags] = useState([]);
  const { tags: _tags } = usePage().props;
  const [search, setSearch] = useState("");
  const [listTags, setListTags] = useState([]);
  const [open, setOpen] = useState();
  const [showSearch, setShowSearch] = useState(false);
  const commandRef = useDetectClickOutside({
    onTriggered: () => {
      setOpen(false);
    },
  });
  const ref = useDetectClickOutside({
    onTriggered: () => {
      setShowSearch(false);
    },
  });
  useEffect(() => {
    setTags(_tags ?? []);
  }, [_tags]);

  useEffect(() => {
    if (!showSearch) {
      setSearch("");
    } else {
      inputRef.current.focus();
    }
  }, [showSearch]);

  const addTag = useCallback(
    (tag) => {
      if (tags.findIndex((t) => t.name == tag.name) >= 0) {
        setSearch("");
        setShowSearch(false);
        return;
      }
      setTags([...tags, { ...tag, isLoading: true }]);
      router.post(
        route(route().current(), route().params) + "/tag",
        { ...tag },
        {
          reset: ["tags"],
          preserveScroll: true,
          preserveState: true,
          replace: true,
          onSuccess: () => {},
        },
      );
      setSearch("");
      setShowSearch(false);
    },
    [tags],
  );

  const removeTag = useCallback((id) => {
    router.delete(route(route().current(), route().params) + `/tag/${id}`, {
      reset: ["tags"],
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  }, []);

  useDidMountEffect(() => {
    const reloadData = setTimeout(() => {
      setOpen(!isNullOrWhitespace(search) || listTags.length > 0);
      axios
        .get(
          `${route("tags.index")}?${QueryString.stringify({
            search,
            limit: 10,
            excepts: tags?.map((t) => t.name),
          })}`,
        )
        .then((res) => {
          const data = res.data;
          if (data.findIndex((t) => t.name === search) === -1) {
            data.unshift({
              id: generateRandom(8),
              name: search,
              isNew: true,
            });
          }
          setListTags(data);
        })
        .catch((err) => {
          console.log(err);
        });
    }, 500);

    return () => clearTimeout(reloadData);
  }, [search]);

  return (
    <div ref={ref}>
      <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none  [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ">
        <TagsIcon />
        <span className="flex-1">Tags</span>
        <Button
          variant="ghost"
          className="rounded-full !p-0"
          size="icon"
          onClick={() => setShowSearch(!showSearch)}
        >
          {showSearch ? <X /> : <Plus />}
        </Button>
      </div>
      {showSearch && (
        <div className={cn("px-8 mb-2")}>
          <Command
            className="relative h-auto overflow-visible bg-transparent"
            ref={commandRef}
          >
            <CommandInput
              ref={inputRef}
              onFocus={() => {
                setOpen(listTags.length > 0);
              }}
              // onBlur={() => {
              //   setOpen(false);
              // }}
              value={search}
              onValueChange={setSearch}
              showIcon={false}
              placeholder={t("core.form.tag.search")}
              className="my-2 !border focus:`!ring-1 bg-muted h-8"
            />
            <div className="relative w-full">
              {open && (
                <CommandList className="absolute top-0 z-10 w-full border rounded-md shadow-md outline-none visi bg-popover text-popover-foreground animate-in">
                  <CommandEmpty>{t("core.form.tag.not_found")}</CommandEmpty>
                  {listTags?.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => addTag(tag)}
                    >
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandList>
              )}
            </div>
          </Command>
        </div>
      )}
      <Deferred
        data={["tags"]}
        fallback={
          <div className="mb-3 first:mt-2 ms-6">
            <div className="!text-base font-normal text-foreground flex gap-x-4">
              <LoadingIcon className="size-4" />
              <span>{t("core.form.loading")} ...</span>
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap px-8 gap-x-2 gap-y-3 lg:max-w-72">
          {tags &&
            tags.map(({ id, name, isLoading }) => (
              <div
                key={id}
                className="flex items-center px-2 py-1 text-sm rounded-lg gap-x-2 bg-muted"
              >
                <Link
                  href={route("tags.show", { tag: id })}
                  className="hover:underline"
                >
                  {name}
                </Link>
                <Button
                  variant="ghost"
                  className="rounded-full !p-0 !m-0 w-auto h-auto"
                  size="icon"
                  onClick={() => {
                    if (!isLoading) removeTag(id);
                  }}
                >
                  {isLoading ? (
                    <LoadingIcon className="size-4" />
                  ) : (
                    <X className="!size-4" />
                  )}
                </Button>
              </div>
            ))}
        </div>
      </Deferred>
    </div>
  );
}

export default Tags;
