import "quill/dist/quill.bubble.css";
import "quill-mention/autoregister";

import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Deferred, router, usePage } from "@inertiajs/react";
import { MessageSquare, Paperclip, SendHorizonal, Trash2 } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  cleanedQuillOutput,
  cn,
  getLocaleDate,
  isNullOrWhitespace,
} from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Link from "@/Components/Link";
import LoadingIcon from "@/Components/LoadingIcon";
import QueryString from "qs";
import { ReactQuill } from "@/Components/ReactQuill";
import { TZDate } from "@date-fns/tz";
import axios from "axios";
import { debounce } from "lodash";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function Comments() {
  const { logs, lang } = usePage().props;
  const { t } = useLaravelReactI18n();
  const commentRef = useRef();
  const route = window.route;
  const [comment, setComment] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [focusedOnComment, setFocusedOnComment] = useState(false);

  useEffect(() => {
    if (isNullOrWhitespace(comment) || comment === "<p><br></p>") {
      setShowSend(false);
    } else {
      setShowSend(true);
    }
  }, [comment]);
  const onSubmit = useCallback((_comment) => {
    router.post(
      route(route().current(), route().params) + "/comment",
      { comment: cleanedQuillOutput(_comment) },
      {
        reset: ["logs"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
        onSuccess: () => {
          setComment("");
          setFocusedOnComment(false);
          commentRef.current.blur();
        },
      },
    );
  }, []);
  const removeComment = useCallback((id) => {
    router.delete(route(route().current(), route().params) + `/comment/${id}`, {
      reset: ["logs"],
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  }, []);

  const onKeyDown = useCallback((e, comment, focusedOnComment) => {
    e.stopPropagation();
    if (e.ctrlKey && e.key == "b" && focusedOnComment) {
      e.preventDefault();
    }
    if (e.ctrlKey && e.key == "Enter" && focusedOnComment) {
      e.preventDefault();
      onSubmit(comment);
    }
  }, []);

  const user = usePage().props.auth.user;
  const alias = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");
  const toolbarOptions = [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ["bold", "italic", "underline", "strike"], // toggled buttons
    [{ script: "sub" }, { script: "super" }], // superscript/subscript
    ["blockquote", "code-block"],
    ["link"],

    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],

    ["clean"], // remove formatting button
  ];
  const mention = {
    allowedChars: /^[A-Za-z\sÅÄÖåäö]*$/,
    mentionDenotationChars: ["@"],
    source: debounce(async function (searchTerm, renderList) {
      const data = await axios
        .get(
          `${route("users.index")}?${QueryString.stringify({
            search: searchTerm,
            limit: 10,
          })}`,
        )
        .then((res) => {
          const data = res.data.map((x) => ({ id: x.id, value: x.name }));
          return data;
        })
        .catch((err) => {
          console.log(err);
        });
      renderList(data, searchTerm);
    }, 500),
  };
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <h1 className="text-xl font-bold">{t("core.form.comments")}</h1>
        <div
          className="flex w-full max-w-full gap-x-3"
          onKeyDown={(e) => {
            onKeyDown(e, comment, focusedOnComment);
          }}
        >
          <Avatar className="rounded-full size-10">
            {user.image && (
              <AvatarImage
                src={
                  route("files.show", user.image) +
                  `?v=${new Date(user.updated_at).getTime()}`
                }
                alt={user.name}
              />
            )}
            <AvatarFallback className="text-xl font-semibold rounded-lg">
              {alias}
            </AvatarFallback>
          </Avatar>
          <ReactQuill
            ref={commentRef}
            placeholder="Type a reply / comment"
            className="bg-muted relative **:font-sans! focus:border-0! grid grid-cols-1 text-wrap w-full max-w-full grow  basis-0  rounded-lg border border-input  text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            theme="bubble"
            value={comment}
            onChange={setComment}
            modules={{
              toolbar: toolbarOptions,
              mention,
            }}
            onFocus={() => setFocusedOnComment(true)}
            onBlur={() => setFocusedOnComment(false)}
          />
          {showSend && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="p-2!"
              onClick={() => onSubmit(comment)}
            >
              <SendHorizonal className="size-6!" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-y-2">
        <h1 className="text-xl font-bold">{t("core.form.activity")}</h1>
        <ol className="relative ml-3.5 border-muted border-s-2 ">
          <Deferred
            data={["logs"]}
            fallback={
              <li className="mb-3 first:mt-2 ms-6">
                <div className="text-base! font-normal text-foreground flex gap-x-4">
                  <LoadingIcon className="size-4" />
                  <span>{t("core.form.loading")} ...</span>
                </div>
              </li>
            }
          >
            {logs &&
              logs.map(
                ({ id, type, activity, user, created_at, data_after }) => (
                  <li key={id} className="mb-3 first:mt-2 ms-6">
                    <div
                      className={cn(
                        type == "log" ? "bg-inherit" : "bg-muted border-[3px]",
                        "p-2 -mt-0.5 size-[34px] -start-[18px] border-muted flex justify-center items-center absolute rounded-full",
                      )}
                    >
                      {type == "log" && (
                        <span className="block rounded-full bg-accent-foreground size-2" />
                      )}
                      {type == "attachment" && <Paperclip className="size-4" />}
                      {type == "comment" && (
                        <MessageSquare className="size-4" />
                      )}
                    </div>
                    {type == "comment" ? (
                      <div className="rounded-lg px-4 py-1 grid grid-cols-[auto_1fr] gap-x-4 border border-muted-foreground/30">
                        <div className="flex items-center">
                          <Avatar className="rounded-full h-max size-10">
                            {user.image && (
                              <AvatarImage
                                src={
                                  route("files.show", user.image) +
                                  `?v=${new Date(user.updated_at).getTime()}`
                                }
                                alt={user.name}
                              />
                            )}
                            <AvatarFallback className="text-xl font-semibold rounded-lg">
                              {alias}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex items-center border-b border-muted-foreground/30">
                          <div className="flex-1">
                            <Link
                              href={route("users.show", user.id)}
                              className="hover:underline"
                            >
                              {user.name}
                            </Link>{" "}
                            <span>{t("core.form.commented")}</span>
                            <span className="mx-2 text-muted-foreground">
                              ●
                            </span>
                            <span className="text-muted-foreground">
                              {format(new TZDate(created_at, "UTC"), "PPPp", {
                                locale: getLocaleDate(lang),
                              })}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="p-0! hover:text-red-500"
                            onClick={() => removeComment(id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="[&_pre]:font-sans! col-start-2 pt-2 **:text-sm  font-normal text-foreground ql-container ql-bubble font-sans! [&_a]:underline-offset-2 [&_a]:hover:underline">
                          <div
                            className="ql-editor p-0!"
                            dangerouslySetInnerHTML={{
                              __html: activity,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <time className="mb-1 text-xs font-normal leading-none text-muted-foreground">
                          <span>
                            {format(new TZDate(created_at, "UTC"), "PPPp", {
                              locale: getLocaleDate(lang),
                            })}
                          </span>
                        </time>
                        <div className="[&_pre]:font-sans! col-start-2 pt-0 **:text-sm font-normal text-foreground ql-container ql-bubble font-sans! [&_a]:underline-offset-2 [&_a]:hover:underline">
                          <div
                            className="ql-editor p-0! hover:[&_*[role=noeditor]]:underline! [&_*[role=noeditor]]:no-underline! [&_*[role=noeditor]]:after:content-none! [&_*[role=noeditor]]:before:content-none!"
                            dangerouslySetInnerHTML={{
                              __html: activity[lang].replace(
                                ":user",
                                `<a role="noeditor" href="${route("users.show", user.id)}" rel="noopener noreferrer" target="_blank" >${user.name}</a>`,
                              ),
                            }}
                          />
                        </div>
                        {data_after && (
                          <Link
                            className="hover:underline text-blue-400 text-sm"
                            href={route("logs.show", id)}
                          >
                            {t("core.form.show_diff")}
                          </Link>
                        )}
                      </>
                    )}
                  </li>
                ),
              )}
          </Deferred>
        </ol>
      </div>
    </div>
  );
});
