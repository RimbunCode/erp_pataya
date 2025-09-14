import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Laptop2, LibraryIcon } from "lucide-react";
import React, { useCallback, useId, useRef, useState } from "react";
import { checkFileType, cn, formatBytes, generateRandom } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import FileItem from "./FileItem";
import Library from "@/Pages/Core/Components/Library/Library";
import { Progress } from "@/Components/ui/progress";
import { Transition } from "@headlessui/react";
import { router } from "@inertiajs/react";
import { useIsMobile } from "@/Hooks/use-mobile";

function UploadDialog({
  onClose,
  single = false,
  imageOnly = false,
  options: { route: routeProp, ...optionsProp } = {},
}) {
  const route = window.route;
  const isMobile = useIsMobile();
  const [menu, setMenu] = useState("home");
  const [files, setFiles] = useState([]);
  const [hover, setHover] = useState(false);
  const [progress, setProgress] = useState(false);
  const [checklistFile, setChecklistFile] = useState(new Set());
  const libraryRef = useRef();
  const id = useId();

  const addFile = useCallback(
    (file) => {
      if (imageOnly && checkFileType("image/*", file.type)) {
        return;
      }
      setFiles((prev) => {
        return [
          ...prev,
          {
            id: generateRandom(8),
            file: file,
          },
        ];
      });
    },
    [imageOnly],
  );
  const updateFile = useCallback((id, payload) => {
    setFiles((prev) => {
      const updatedFiles = prev.map((f) => {
        if (f.id === id) {
          return { ...f, ...payload };
        }
        return f;
      });
      return updatedFiles;
    });
  });
  const removeFile = useCallback((id) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setHover(false);
    if (e.dataTransfer.items) {
      [...e.dataTransfer.items].forEach((item) => {
        if (item.kind != "file") return;
        const file = item.getAsFile();
        // if (!typeValidation(file.type)) return;
        addFile(file);
      });
    } else {
      [...e.dataTransfer.files].forEach((file) => {
        // if (!typeValidation(file.type)) return;
        addFile(file);
      });
    }
  }, []);

  const onAttach = useCallback((menu, files) => {
    const formData = new FormData();
    if (menu == "library") {
      files.forEach((id) => {
        formData.append(`filesId[]`, id);
      });
    } else {
      files.forEach((file, index) => {
        formData.append(`files[${index}]`, file.file);
        formData.append(`isPublic[${index}]`, file.isPublic ?? false);
        formData.append(`name[${index}]`, file.name || file.file.name);
      });
    }
    router.post(
      routeProp ?? route(route().current(), route().params) + "/file",
      formData,
      {
        reset: ["attachments"],
        forceFormData: true,
        replace: true,
        preserveState: true,
        preserveScroll: true,
        showProgress: true,
        ...optionsProp,
        onProgress: (e) => {
          setProgress(e);
        },
        onSuccess: () => {
          setFiles([]);
          onClose();
        },
      },
    );
  }, []);

  const getMenu = () => {
    switch (menu) {
      case "home":
        return (
          <div
            className="relative flex items-center justify-center w-full flex-col **:pointer-events-none min-h-64 overflow-y-auto"
            onDragOver={(e) => {
              e.preventDefault();
              setHover(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setHover(false);
            }}
            onDrop={(e) => {
              if (single && files.length > 0) return false;
              return onDrop(e);
            }}
          >
            {/* Files To Upload */}
            {files.length > 0 && (
              <div className="flex flex-col w-full min-h-64 gap-y-2">
                <p className="mb-1 alert warning border">
                  Maximum File Size: 10 MB
                </p>
                {files.map((file) => (
                  <FileItem
                    {...file}
                    key={file.id}
                    onUpdate={updateFile}
                    onRemove={removeFile}
                  />
                ))}
              </div>
            )}
            {/* Dropzone File */}
            <Transition
              show={!(files && files.length > 0) || (hover && !isMobile)}
            >
              <div
                className={cn(
                  "transition ease-in-out duration-300 data-closed:opacity-0 ",
                  "absolute top-0 left-0 data flex flex-col items-center justify-center w-full min-h-64 h-full overflow-hidden border-2 border-dashed rounded-lg border-muted-foreground/30 bg-background",
                )}
              >
                <div
                  className={cn(
                    !hover && files.length <= 0
                      ? "translate-y-0"
                      : "translate-y-14",
                    "transition ease-in-out duration-300 flex flex-col items-center justify-center pt-5 pb-6",
                  )}
                >
                  <svg
                    className={cn(
                      hover ? "size-24" : "size-12",
                      "mb-4 text-muted-foreground transition-all hidden md:block",
                    )}
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 20 16"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                    />
                  </svg>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {!hover && files.length <= 0 ? (
                      <>
                        {!isMobile ? (
                          <>
                            <span className="font-semibold">Drag & Drop</span>{" "}
                            files here or upload from
                          </>
                        ) : (
                          "Upload file from"
                        )}
                      </>
                    ) : (
                      <span className="font-semibold">Drop files here!</span>
                    )}
                  </p>
                  <div
                    className={cn(
                      !hover && files.length <= 0 ? "opacity-100" : "opacity-0",
                      "transition ease-in-out duration-300 ",
                    )}
                  >
                    <div className="gap-x-2 flex [&_svg]:rounded-full [&_svg]:bg-muted [&_svg]:p-2 [&_svg]:size-9 *:h-auto *:p-2! *:border-0! *:flex *:flex-col *:gap-y-1 *:items-center *:cursor-pointer">
                      <Button
                        className={cn(!hover && "pointer-events-auto!")}
                        variant="outline"
                        asChild
                      >
                        <label htmlFor={id}>
                          <Laptop2 /> My Device
                        </label>
                      </Button>
                      <Button
                        className={cn(!hover && "pointer-events-auto!")}
                        variant="outline"
                        onClick={() => setMenu("library")}
                      >
                        <LibraryIcon /> Library
                      </Button>
                    </div>
                    <p className="mt-2 text-sm font-bold text-center text-muted-foreground">
                      Maximum file size: 10MB
                    </p>
                  </div>
                </div>
                <input
                  id={id}
                  type="file"
                  accept={imageOnly ? "image/*" : "*"}
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    setFiles((prev) => {
                      return [
                        ...prev,
                        ...Array.from(files).map((file) => {
                          return {
                            id: generateRandom(8),
                            file: file,
                          };
                        }),
                      ];
                    });
                    e.currentTarget.value = null;
                  }}
                />
              </div>
            </Transition>
          </div>
        );
      case "library": {
        return (
          <Library
            ref={libraryRef}
            setMenu={setMenu}
            single={single}
            imageOnly={imageOnly}
            checklistFile={checklistFile}
            setChecklistFile={setChecklistFile}
          />
        );
      }
    }
  };
  return (
    <DialogContent className="max-w-xl overflow-hidden!">
      <DialogHeader className="pb-2 border-b">
        <DialogTitle>Upload</DialogTitle>
        <DialogDescription className="sr-only"></DialogDescription>
      </DialogHeader>
      {getMenu()}
      {progress && (
        <div className="flex items-center w-full text-xs text-muted-foreground">
          <Progress value={progress.progress * 100} className="h-2!" />
          <p className="mx-3 text-nowrap">
            ({formatBytes(progress.loaded)} / {formatBytes(progress.total)})
          </p>
          <p>{(progress.progress * 100).toFixed(1)}%</p>
        </div>
      )}
      <DialogFooter
        className={cn(
          files.length > 0 && menu === "home"
            ? "justify-between!"
            : "justify-end!",
          "flex flex-row!  pt-2 border-t gap-x-2",
        )}
      >
        {files.length > 0 && menu === "home" && (
          <>
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="cursor-pointer"
            >
              <label htmlFor={id}>Browse</label>
            </Button>

            <input
              id={id}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                const files = e.currentTarget.files;
                setFiles((prev) => {
                  return [
                    ...prev,
                    ...Array.from(files).map((file) => {
                      return {
                        id: generateRandom(8),
                        file: file,
                      };
                    }),
                  ];
                });
                e.currentTarget.value = null;
              }}
            />
          </>
        )}
        <Button
          disabled={
            menu == "home" ? files.length <= 0 : checklistFile.size <= 0
          }
          size="sm"
          onClick={() =>
            onAttach(menu, menu == "library" ? checklistFile : files)
          }
        >
          Attach
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default UploadDialog;
