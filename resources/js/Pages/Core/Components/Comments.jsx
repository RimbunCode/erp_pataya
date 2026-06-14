import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Deferred, router, usePage } from "@inertiajs/react";
import { MessageSquare, Paperclip, Pencil, Trash2 } from "lucide-react";
import React, {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { cn, getLocaleDate } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Link from "@/Components/Link";
import LoadingIcon from "@/Components/LoadingIcon";
import TiptapEditor from "@/Components/TiptapEditor";
import { TZDate } from "@date-fns/tz";
import axios from "axios";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";

function CommentBody({ activity }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef(null);
  const { t } = useLaravelReactI18n();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight > clientHeight means content is taller than 3-line clamp
    setClamped(el.scrollHeight > el.clientHeight + 2);
  }, [activity]);

  return (
    <div className="col-start-2 pt-2 **:text-sm font-normal text-foreground">
      <div
        ref={ref}
        className={expanded ? "tiptap" : "tiptap line-clamp-3"}
        dangerouslySetInnerHTML={{ __html: activity }}
      />
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground mt-0.5 underline underline-offset-2 cursor-pointer"
        >
          {expanded ? t("core.form.show_less") : t("core.form.show_more")}
        </button>
      )}
    </div>
  );
}

function userAlias(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");
}

export default memo(function Comments() {
  const { logs, lang } = usePage().props;
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const commentBasePath = `${currentPath}/comment`;

  const currentUser = usePage().props.auth.user;

  const [open, setOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [commentJson, setCommentJson] = useState(null);
  const editorRef = useRef();

  const isEmpty = !commentJson || editorRef.current?.isEmpty;

  // Returns a Promise that resolves with user list.
  // Uses a cancel-aware debounce: each call cancels the previous pending resolve
  // so only the latest query fires the API request.
  const fetchMentionUsers = useMemo(() => {
    let pendingResolve = null;
    let timer = null;
    return (query) =>
      new Promise((resolve) => {
        if (timer) clearTimeout(timer);
        pendingResolve = resolve;
        timer = setTimeout(async () => {
          if (pendingResolve !== resolve) return;
          try {
            const res = await axios.get(route("users.index"), {
              params: { search: query, limit: 10 },
            });
            resolve(res.data.map((x) => ({ id: x.id, label: x.name })));
          } catch {
            resolve([]);
          }
        }, 300);
      });
  }, []);

  const handleOpenAdd = useCallback(() => {
    setEditingLog(null);
    setCommentJson(null);
    setOpen(true);
  }, []);

  const handleOpenEdit = useCallback((log) => {
    setEditingLog(log);
    setCommentJson(log.comment_json ?? null);
    setOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setCommentJson(null);
    setEditingLog(null);
    setOpen(false);
  }, []);

  const handleSubmit = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? "";
    const routerOptions = {
      reset: ["logs"],
      preserveScroll: true,
      preserveState: true,
      replace: true,
      onSuccess: () => {
        setCommentJson(null);
        setEditingLog(null);
        setOpen(false);
      },
    };

    if (editingLog) {
      router.put(
        `${commentBasePath}/${editingLog.id}${currentQueryString}`,
        { comment: html, comment_json: commentJson },
        routerOptions,
      );
    } else {
      router.post(
        `${commentBasePath}${currentQueryString}`,
        { comment: html, comment_json: commentJson },
        routerOptions,
      );
    }
  }, [editingLog, commentJson, commentBasePath, currentQueryString]);

  const removeComment = useCallback(
    (id) => {
      router.delete(`${commentBasePath}/${id}${currentQueryString}`, {
        reset: ["logs"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      });
    },
    [commentBasePath, currentQueryString],
  );

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t("core.form.activity")}</h1>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleOpenAdd}
          >
            <MessageSquare className="size-4 mr-1.5" />
            {t("core.form.add_comment")}
          </Button>
        </div>

        <ol className="relative ml-3.5 border-muted border-s-2">
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
                ({
                  id,
                  type,
                  activity,
                  user,
                  created_at,
                  updated_at,
                  comment_json,
                  data_after,
                }) => (
                  <li key={id} className="mb-3 first:mt-2 ms-6">
                    <div
                      className={cn(
                        type == "log" ? "bg-inherit" : "bg-muted border-[3px]",
                        "p-2 -mt-0.5 size-[34px] -inset-s-[18px] border-muted flex justify-center items-center absolute rounded-full",
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
                                  route("files.preview", user.image) +
                                  `?v=${new Date(user.updated_at).getTime()}`
                                }
                                alt={user.name}
                              />
                            )}
                            <AvatarFallback className="text-xl font-semibold rounded-lg">
                              {userAlias(user.name)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex items-center border-b border-muted-foreground/30">
                          <div className="flex-1 flex flex-wrap items-center gap-x-1">
                            <Link
                              href={route("users.show", user.id)}
                              className="hover:underline font-medium"
                            >
                              {user.name}
                            </Link>
                            <span>{t("core.form.commented")}</span>
                            <span className="text-muted-foreground">●</span>
                            <span className="text-muted-foreground text-xs">
                              {format(new TZDate(created_at, "UTC"), "PPPp", {
                                locale: getLocaleDate(lang),
                              })}
                            </span>
                            {updated_at != created_at && (
                              <span className="text-xs text-muted-foreground italic">
                                ({t("core.form.comment_edited")})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {currentUser.id === user.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="p-0! hover:text-blue-500 size-7"
                                onClick={() =>
                                  handleOpenEdit({
                                    id,
                                    comment_json,
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {currentUser.id === user.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="p-0! hover:text-red-500 size-7"
                                onClick={() => removeComment(id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <CommentBody activity={activity} />
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

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-2xl flex flex-col max-h-[85vh] p-0 gap-0">
          <AlertDialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <AlertDialogTitle>
              {editingLog
                ? t("core.form.edit_comment")
                : t("core.form.add_comment")}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {/* Editor wrapper: toolbar stays sticky, only content area scrolls */}
          <div className="flex-1 min-h-0 overflow-hidden px-6">
            <TiptapEditor
              ref={editorRef}
              value={commentJson}
              onValueChange={(json) => setCommentJson(json)}
              placeholder={t("core.form.comment_placeholder")}
              mentionSource={fetchMentionUsers}
              className="h-full flex flex-col"
              scrollable
            />
          </div>
          <AlertDialogFooter className="px-6 py-4 shrink-0">
            <AlertDialogCancel onClick={handleCancel}>
              {t("core.form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction disabled={isEmpty} onClick={handleSubmit}>
              {editingLog
                ? t("core.form.comment_update")
                : t("core.form.comment_send")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
