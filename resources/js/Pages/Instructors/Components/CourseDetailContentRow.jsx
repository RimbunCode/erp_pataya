import { useCallback, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { Button } from "@/Components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { FileTextIcon, XIcon } from "lucide-react";
import Link from "@/Components/Link";
import { cn } from "@/lib/utils";
import UploadDialog2 from "../../Core/Components/UploadDialog2";
import CourseDetailTypeIcon from "./CourseDetailTypeIcon";

export default function CourseDetailContentRow({ content, onDelete, typeCfg }) {
  const [editing, setEditing] = useState(false);
  const [deadline, setDeadline] = useState(content.deadline ?? "");
  const uploadDialogRef = useRef();
  const [title, setTitle] = useState(content.title);

  const saveTitle = () => {
    router.patch(
      route("instructor.classes.sections.contents.update", content.id),
      { title },
      { onSuccess: () => setEditing(false), preserveScroll: true },
    );
  };

  const saveDeadline = () => {
    router.patch(
      route("instructor.classes.sections.contents.update", content.id),
      { deadline: deadline || null },
      { preserveScroll: true },
    );
  };

  const removeFile = useCallback(
    (id) => {
      console.log(id);
      router.delete(
        route("instructor.classes.sections.contents.files.destroy", {
          content: content.id,
          file: id,
        }),
        {
          preserveScroll: true,
          replace: true,
        },
      );
    },
    [content?.id],
  );

  return (
    <>
      <div
        className={`flex flex-col px-3.5 py-3 rounded-xl border ${typeCfg.bg} group`}
      >
        <div className="flex items-center gap-3">
          <CourseDetailTypeIcon type={content.type} />
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveTitle();
                  }
                  if (event.key === "Escape") {
                    setEditing(false);
                    setTitle(content.title);
                  }
                }}
                className="w-full bg-card border border-primary/35 rounded-lg px-2.5 py-1.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <div>
                <p className="text-sm font-bold text-foreground truncate">
                  {content.title}
                </p>
                {content.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {content.description}
                  </p>
                )}
                {(content.type === "pre_assessment" ||
                  content.type === "assignment") && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={saveDeadline}
                      className="text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary hover:text-white transition-all"
                    >
                      Simpan
                    </button>
                    {content.deadline_label && (
                      <span className="text-[10px] text-muted-foreground">
                        {content.deadline_label}
                      </span>
                    )}
                  </div>
                )}
                {content.url && (
                  <a
                    href={content.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1.5 mt-1.5 hover:text-primary"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    External Link
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => uploadDialogRef.current?.open()}
              title="Upload / Link"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/35 transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </button>
            {editing ? (
              <>
                <button
                  onClick={saveTitle}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary-soft0 text-white hover:bg-primary-hover transition-all"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setTitle(content.title);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted text-muted-foreground transition-all"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/35 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={() => onDelete(content.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted-foreground hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        <ul
          className={cn(
            "mt-2 ml-2 w-[calc(100%-calc(var(--spacing,0.25rem)*2))] flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5 pr-3.5",
          )}
        >
          {content?.files &&
            content.files.map(({ id, name }) => (
              <li key={id}>
                <div
                  className={cn(
                    "w-full flex h-8 min-w-0 -translate-x-px items-center gap-2 rounded-md px-2 text-sidebar-foreground outline-none [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                    "text-base",
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center flex-1 overflow-hidden gap-x-2">
                        <Link href={route("files.preview", id)}>
                          <FileTextIcon className="size-5" />
                        </Link>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={route("files.preview", id)}
                          className="hover:underline truncate"
                        >
                          <p className="text-base truncate">{name}</p>
                        </a>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent align="start">{name}</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full p-0!"
                    onClick={() => {
                      removeFile(id);
                    }}
                  >
                    <XIcon />
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      </div>
      <UploadDialog2
        ref={uploadDialogRef}
        options={{
          route: route(
            "instructor.classes.sections.contents.upload",
            content.id,
          ),
        }}
      />
    </>
  );
}
