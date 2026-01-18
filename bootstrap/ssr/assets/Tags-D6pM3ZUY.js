import { jsxs, jsx } from "react/jsx-runtime";
import { C as Command, k as CommandInput, a as CommandList, b as CommandEmpty, c as CommandItem } from "./command-BSnyCa9u.js";
import { usePage, router, Deferred } from "@inertiajs/react";
import { TagsIcon, X, Plus } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { f as isNullOrWhitespace, k as generateRandom, c as cn } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { b as useDidMountEffect, L as Link } from "./Link-p0Z4AKax.js";
import { L as LoadingIcon } from "./LoadingIcon-CRleOEtX.js";
import QueryString from "qs";
import axios from "axios";
import { useDetectClickOutside } from "react-detect-click-outside";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-dialog";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "radix-ui";
import "class-variance-authority";
import "@inertiajs/core";
import "zustand";
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
    }
  });
  const ref = useDetectClickOutside({
    onTriggered: () => {
      setShowSearch(false);
    }
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
      if (tags.findIndex((t2) => t2.name == tag.name) >= 0) {
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
          onSuccess: () => {
          }
        }
      );
      setSearch("");
      setShowSearch(false);
    },
    [tags]
  );
  const removeTag = useCallback((id) => {
    router.delete(route(route().current(), route().params) + `/tag/${id}`, {
      reset: ["tags"],
      preserveScroll: true,
      preserveState: true,
      replace: true
    });
  }, []);
  useDidMountEffect(() => {
    const reloadData = setTimeout(() => {
      setOpen(!isNullOrWhitespace(search) || listTags.length > 0);
      axios.get(
        `${route("tags.index")}?${QueryString.stringify({
          search,
          limit: 10,
          excepts: tags == null ? void 0 : tags.map((t2) => t2.name)
        })}`
      ).then((res) => {
        const data = res.data;
        if (data.findIndex((t2) => t2.name === search) === -1) {
          data.unshift({
            id: generateRandom(8),
            name: search,
            isNew: true
          });
        }
        setListTags(data);
      }).catch((err) => {
        console.log(err);
      });
    }, 500);
    return () => clearTimeout(reloadData);
  }, [search]);
  return /* @__PURE__ */ jsxs("div", { ref, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center gap-2 overflow-hidden rounded-md py-2 text-left outline-none  [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ", children: [
      /* @__PURE__ */ jsx(TagsIcon, {}),
      /* @__PURE__ */ jsx("span", { className: "flex-1", children: t("core.form.tags") }),
      /* @__PURE__ */ jsx(
        Button,
        {
          variant: "ghost",
          className: "rounded-full p-0! ",
          size: "icon",
          type: "button",
          onClick: () => setShowSearch(!showSearch),
          children: showSearch ? /* @__PURE__ */ jsx(X, {}) : /* @__PURE__ */ jsx(Plus, {})
        }
      )
    ] }),
    showSearch && /* @__PURE__ */ jsx("div", { className: cn("px-8 mb-2"), children: /* @__PURE__ */ jsxs(
      Command,
      {
        className: "relative h-auto overflow-visible bg-transparent",
        ref: commandRef,
        children: [
          /* @__PURE__ */ jsx(
            CommandInput,
            {
              ref: inputRef,
              onFocus: () => {
                setOpen(listTags.length > 0);
              },
              value: search,
              onValueChange: setSearch,
              showIcon: false,
              placeholder: t("core.form.tag.search"),
              className: "my-2 border! focus:`ring-1! bg-muted h-8"
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "relative w-full", children: open && /* @__PURE__ */ jsxs(CommandList, { className: "absolute top-0 z-10 w-full border rounded-md shadow-md outline-none visi bg-popover text-popover-foreground animate-in", children: [
            /* @__PURE__ */ jsx(CommandEmpty, { children: t("core.form.not_found") }),
            listTags == null ? void 0 : listTags.map((tag) => /* @__PURE__ */ jsx(
              CommandItem,
              {
                value: tag.name,
                onSelect: () => addTag(tag),
                children: tag.name
              },
              tag.id
            ))
          ] }) })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(
      Deferred,
      {
        data: ["tags"],
        fallback: /* @__PURE__ */ jsx("div", { className: "mb-3 first:mt-2 ms-6", children: /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4", children: [
          /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
          /* @__PURE__ */ jsxs("span", { children: [
            t("core.form.loading"),
            " ..."
          ] })
        ] }) }),
        children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap px-8 gap-x-2 gap-y-3 lg:max-w-72", children: tags && tags.map(({ id, name, isLoading }) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-center px-2 py-1 text-sm rounded-lg gap-x-2 bg-muted",
            children: [
              /* @__PURE__ */ jsx(
                Link,
                {
                  href: route("tags.show", { tag: id }),
                  className: "hover:underline",
                  children: name
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  variant: "ghost",
                  className: "rounded-full p-0! m-0! w-auto h-auto group-data-[disabled=true]/form:hidden",
                  size: "icon",
                  onClick: () => {
                    if (!isLoading) removeTag(id);
                  },
                  children: isLoading ? /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }) : /* @__PURE__ */ jsx(X, { className: "size-4!" })
                }
              )
            ]
          },
          id
        )) })
      }
    )
  ] });
}
export {
  Tags as default
};
