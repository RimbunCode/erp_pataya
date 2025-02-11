// import "quill/dist/quill.bubble.css";

import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Deferred, Link, router, usePage } from "@inertiajs/react";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import {
  MessageSquare,
  Paperclip,
  Plus,
  SendHorizonal,
  Trash2,
  X,
} from "lucide-react";
import React, {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cleanedQuillOutput, cn, isNullOrWhitespace } from "@/lib/utils";

import AppLayout from "@/Layouts/AppLayout";
import { Button } from "@/Components/ui/button";
import LoadingIcon from "@/Components/LoadingIcon";
import { ReactQuill } from "@/Components/ReactQuill";
import Tags from "./Components/Tags";
import UploadDialog from "./Components/UploadDialog";
import moment from "moment-timezone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import FormPageContent from "./Components/FormPageContent";

export default function FormPage({
  title,
  controls,
  defaultMenu,
  className,
  children,
}) {
  const { logs, attachments } = usePage().props;
  const commentRef = useRef();
  const route = window.route;
  const [comment, setComment] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [focusedOnComment, setFocusedOnComment] = useState(false);
  const [openAttachment, setOpenAttachment] = useState(false);

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

  const removeFile = useCallback((id) => {
    router.delete(route(route().current(), route().params) + `/file/${id}`, {
      reset: ["attachments"],
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
  return (
    <AppLayout>
      <div className="flex items-center justify-between gap-x-4">
        <h1 className="text-xl font-bold">{title}</h1>
        {controls && (
          <div className="flex items-center gap-x-4 ">{controls}</div>
        )}
      </div>
      <div className="grid grid-cols-1 auto-rows-max lg:grid-rows-[auto_1fr] lg:grid-cols-[1fr_auto] flex-1 gap-4 mt-4">
        <div className="order-2 lg:col-start-2 lg:row-span-2 h-fit lg:max-w-64">
          <ul className={cn("flex w-full min-w-0 flex-col gap-1")}>
            <li>
              <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none  [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ">
                <Paperclip />
                <span className="flex-1">Attachments</span>

                <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="rounded-full !p-0"
                      size="icon"
                    >
                      <Plus />
                    </Button>
                  </DialogTrigger>
                  <UploadDialog
                    open={openAttachment}
                    onClose={() => {
                      setOpenAttachment(false);
                      router.getCached(
                        route(route().current(), route().params),
                        {
                          reset: ["attachments"],
                          preserveScroll: true,
                          preserveState: true,
                          replace: true,
                        },
                      );
                    }}
                  />
                </Dialog>
              </div>
              <Deferred
                data="attachments"
                fallback={
                  <div className="mb-3 first:mt-2 ms-6">
                    <div className="!text-base font-normal text-foreground flex gap-x-4">
                      <LoadingIcon className="size-4" />
                      <span>Loading ...</span>
                    </div>
                  </div>
                }
              >
                <ul
                  className={cn(
                    "ml-3.5 w-full flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5 pr-3.5",
                  )}
                >
                  {attachments &&
                    attachments.map(({ id, name }) => (
                      <li key={id}>
                        <div
                          className={cn(
                            "w-full flex h-6 min-w-0 -translate-x-px items-center gap-2  rounded-md px-2 text-sidebar-foreground outline-none  [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                            "text-base",
                          )}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex-1 overflow-hidden text-sm truncate">
                                {name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent align="start">
                              {name}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full !p-0"
                            onClick={() => {
                              removeFile(id);
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              </Deferred>
            </li>
            <li>
              <Tags />
            </li>
          </ul>
        </div>
        <div
          className={cn(
            className,
            "flex flex-col order-1 max-w-full  border rounded-xl lg:col-start-1 border-muted-foreground/25",
          )}
        >
          {Children.count(children) > 1 ? (
            <Tabs defaultValue={defaultMenu ?? children[0].props.value}>
              <TabsList className="w-full !p-0 h-auto items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b rounded-none">
                {Children.map(children, (child) => {
                  if (child.type == FormPageContent) {
                    return (
                      <TabsTrigger
                        value={child.props.value}
                        className="text-base border-0 data-[state=active]:font-bold !p-0 !px-4 group rounded-none transition-colors duration-300"
                      >
                        <span className="pt-2 pb-1 border-foreground w-fit group-[[data-state=active]]:border-b">
                          {child.props.title}
                        </span>
                      </TabsTrigger>
                    );
                  }
                  throw Error(
                    "FormPage children only accepts FormPageContent ",
                  );
                })}
              </TabsList>
              {Children.map(children, (child) => {
                if (child.type == FormPageContent) {
                  return (
                    <TabsContent value={child.props.value} asChild>
                      {child}
                    </TabsContent>
                  );
                }
                throw Error("FormPage children only accepts FormPageContent ");
              })}
            </Tabs>
          ) : (
            Children.map(children, (child) => {
              if (child.type == FormPageContent) {
                return child;
              }
              throw Error("FormPage children only accepts FormPageContent ");
            })
          )}
        </div>
        <div className="flex flex-col order-3 lg:col-start-1 gap-y-4">
          <div className="flex flex-col gap-y-2">
            <h1 className="text-xl font-bold">Comments</h1>
            <div
              className="flex w-full max-w-full gap-x-3"
              onKeyDown={(e) => {
                onKeyDown(e, comment, focusedOnComment);
              }}
            >
              <Avatar className="rounded-full size-10">
                <AvatarImage src={user.image} alt={user.name} />
                <AvatarFallback className="text-xl font-semibold rounded-lg">
                  {alias}
                </AvatarFallback>
              </Avatar>
              <ReactQuill
                ref={commentRef}
                placeholder="Type a reply / comment"
                className="relative [&_*]:!font-sans focus:!border-0 grid grid-cols-1 text-wrap w-full max-w-full flex-grow  basis-0  rounded-md border border-input bg-background  text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                theme="bubble"
                value={comment}
                onChange={setComment}
                modules={{
                  toolbar: toolbarOptions,
                }}
                onFocus={() => setFocusedOnComment(true)}
                onBlur={() => setFocusedOnComment(false)}
              />
              {showSend && (
                <Button
                  variant="outline"
                  size="icon"
                  className="!p-2"
                  onClick={() => onSubmit(comment)}
                >
                  <SendHorizonal className="!size-6" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-y-2">
            <h1 className="text-xl font-bold">Activity</h1>
            <ol className="relative ml-3.5 border-muted border-s-2 ">
              <Deferred
                data="logs"
                fallback={
                  <li className="mb-3 first:mt-2 ms-6">
                    <div className="!text-base font-normal text-foreground flex gap-x-4">
                      <LoadingIcon className="size-4" />
                      <span>Loading ...</span>
                    </div>
                  </li>
                }
              >
                {logs &&
                  logs.map(({ id, type, activity, user, created_at }) => (
                    <li key={id} className="mb-3 first:mt-2 ms-6">
                      <div className="p-2 -mt-0.5 size-[34px] -start-[18px] bg-muted border-[3px] border-muted flex justify-center items-center absolute rounded-full">
                        {type == "log" && (
                          <span className="block rounded-full bg-muted-foreground size-2" />
                        )}
                        {type == "attachment" && (
                          <Paperclip className="size-4" />
                        )}
                        {type == "comment" && (
                          <MessageSquare className="size-4" />
                        )}
                      </div>
                      {type == "comment" ? (
                        <div className="rounded-lg px-4 py-2 grid grid-cols-[auto_1fr] gap-x-4 border border-muted-foreground/30">
                          <div className="flex items-center">
                            <Avatar className="rounded-full h-max size-10">
                              <AvatarImage src={user.image} alt={user.name} />
                              <AvatarFallback className="text-xl font-semibold rounded-lg">
                                {alias}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="flex items-center border-b border-muted-foreground/30">
                            <div className="flex-1">
                              <Link
                                href={route("users.edit", user.id)}
                                className="hover:underline"
                              >
                                {user.name}
                              </Link>{" "}
                              <span>commented</span>
                              <span className="mx-2 text-muted-foreground">
                                ●
                              </span>
                              <span className="text-muted-foreground">
                                {moment.utc(created_at).format("LLL")}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="!p-0 hover:text-red-500"
                              onClick={() => removeComment(id)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          <div className="[&_pre]:!font-sans col-start-2 pt-2  font-normal text-foreground ql-container ql-bubble !font-sans [&_a]:underline-offset-[2px] [&_a]:hover:underline">
                            <div
                              className="ql-editor !p-0"
                              dangerouslySetInnerHTML={{ __html: activity }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <time className="mb-1 text-xs font-normal leading-none text-muted-foreground">
                            <span>{moment.utc(created_at).format("LLL")}</span>
                            {user && (
                              <span className="font-bold"> by {user.name}</span>
                            )}
                          </time>
                          <div className="[&_pre]:!font-sans col-start-2 pt-2  font-normal text-foreground ql-container ql-bubble !font-sans [&_a]:underline-offset-[2px] [&_a]:hover:underline">
                            <div
                              className="ql-editor !p-0"
                              dangerouslySetInnerHTML={{ __html: activity }}
                            />
                          </div>
                        </>
                      )}
                    </li>
                  ))}
              </Deferred>
            </ol>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
