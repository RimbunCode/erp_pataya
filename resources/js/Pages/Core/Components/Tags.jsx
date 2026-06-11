import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/Components/ui/command";
import { Deferred, router, usePage } from "@inertiajs/react";
import { Plus, TagsIcon, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { cn, generateRandom, isNullOrWhitespace } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import ClickAwayListener from "react-click-away-listener";
import Link from "@/Components/Link";
import LoadingIcon from "@/Components/LoadingIcon";
import QueryString from "qs";
import axios from "axios";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Tags() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const inputRef = useRef();
  const [tags, setTags] = useState([]);
  const { tags: _tags } = usePage().props;
  // SidebarChildren bisa dirender di luar FormPageContext (sidebar FormPage),
  // jadi context bisa undefined → fallback ke edit-mode (isCreate falsy).
  const { isCreate, data, setData } = useFormPage() ?? {};
  const bufferedTags = data?.buffered_tags ?? [];
  const [search, setSearch] = useState("");
  const [listTags, setListTags] = useState([]);
  const [open, setOpen] = useState();
  const [showSearch, setShowSearch] = useState(false);

  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const basePath = `${currentPath}/tag`;
  useEffect(() => {
    setTags(isCreate ? bufferedTags : (_tags ?? []));
  }, [_tags, isCreate, JSON.stringify(bufferedTags)]);

  useEffect(() => {
    if (!showSearch) {
      setSearch("");
    } else {
      inputRef.current.focus();
    }
  }, [showSearch]);

  const addTag = (tag) => {
    if (tags.findIndex((t) => t.name == tag.name) >= 0) {
      setSearch("");
      setShowSearch(false);
      return;
    }
    if (isCreate) {
      const next = [
        ...bufferedTags,
        { id: tag.id, name: tag.name, isNew: tag.isNew },
      ];
      setData("buffered_tags", next);
      setTags(next);
      setSearch("");
      setShowSearch(false);
      return;
    }
    setTags([...tags, { ...tag, isLoading: true }]);
    router.post(
      `${basePath}${currentQueryString}`,
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
  };

  const removeTag = (id) => {
    if (isCreate) {
      const next = bufferedTags.filter((t) => t.id !== id);
      setData("buffered_tags", next);
      setTags(next);
      return;
    }
    router.delete(`${basePath}/${id}${currentQueryString}`, {
      reset: ["tags"],
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };

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

  const tagList = (
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
              className="rounded-full p-0! m-0! w-auto h-auto group-data-[disabled=true]/form:hidden"
              size="icon"
              onClick={() => {
                if (!isLoading) removeTag(id);
              }}
            >
              {isLoading ? (
                <LoadingIcon className="size-4" />
              ) : (
                <X className="size-4!" />
              )}
            </Button>
          </div>
        ))}
    </div>
  );

  return (
    <ClickAwayListener onClickAway={() => setShowSearch(false)}>
      <div>
        <div className="flex w-full items-center gap-2 overflow-hidden rounded-md py-2 text-left outline-none  [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ">
          <TagsIcon />
          <span className="flex-1">{t("core.form.tags")}</span>
          <Button
            variant="ghost"
            className="rounded-full p-0! "
            size="icon"
            type="button"
            onClick={() => setShowSearch(!showSearch)}
          >
            {showSearch ? <X /> : <Plus />}
          </Button>
        </div>
        {showSearch && (
          <div className={cn("px-8 mb-2")}>
            <ClickAwayListener onClickAway={() => setOpen(false)}>
              <div>
                <Command className="relative h-auto overflow-visible bg-transparent">
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
                    className="my-2 border! focus:`ring-1! bg-muted h-8"
                  />
                  <div className="relative w-full">
                    {open && (
                      <CommandList className="absolute top-0 z-10 w-full border rounded-md shadow-md outline-none visi bg-popover text-popover-foreground animate-in">
                        <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
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
            </ClickAwayListener>
          </div>
        )}
        {/* Create: tag dari buffer lokal — tanpa Deferred (cegah loading abadi). */}
        {isCreate ? (
          tagList
        ) : (
          <Deferred
            data={["tags"]}
            fallback={
              <div className="mb-3 first:mt-2 ms-6">
                <div className="text-base! font-normal text-foreground flex gap-x-4">
                  <LoadingIcon className="size-4" />
                  <span>{t("core.form.loading")} ...</span>
                </div>
              </div>
            }
          >
            {tagList}
          </Deferred>
        )}
      </div>
    </ClickAwayListener>
  );
}

export default Tags;
