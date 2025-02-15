import { FileText, Trash2 } from "lucide-react";
import React, { useCallback, useId, useState } from "react";
import { checkFileType, formatBytes } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Input } from "@/Components/ui/input";

function FileItem({
  id,
  onRemove,
  onUpdate,
  file,
  name = null,
  isPublic = false,
}) {
  const checkboxId = useId();
  const [thumbnail] = useState(
    checkFileType("image/*", file.type) ? (
      <img
        className="object-cover rounded-lg size-full"
        src={URL.createObjectURL(file)}
        alt=""
      />
    ) : (
      <FileText className="p-3 border rounded-lg size-full text-muted-foreground" />
    ),
  );
  //   axios
  //     .post(
  //       route("files.store"),
  //       {
  //         file: file,
  //       },
  //       {
  //         headers: {
  //           "Content-Type": "multipart/form-data",
  //         },
  //         onUploadProgress: (e) => {
  //           setProgress(e.progress * 100);
  //         },
  //       },
  //     )
  //     .then(({ data }) => {
  //       console.log(data);
  //       setIsNew(false);
  //     })
  //     .catch((err) => {
  //       console.log(err);
  //     })
  //     .finally(() => {
  //       setProgress(false);
  //     });
  // }, []);
  // useState(() => {
  //   if (isNew) {
  //     // uploadFile(file);
  //   }
  // }, [isNew]);
  const removeFile = useCallback((id) => {
    onRemove(id);
  });
  return (
    <div className="flex items-center w-full max-w-full px-4 py-2 border rounded-lg shadow-md border-muted shadow-muted gap-x-2">
      <div className=" aspect-square size-16">{thumbnail}</div>
      <div className="self-start justify-between flex-1 p-2 overflow-hidden">
        <Input
          type="text"
          value={(name ?? file.name).match(/^(.+)\.[^.]+$/)?.[1]}
          onChange={(e) => {
            onUpdate(id, {
              name: e.target.value,
            });
          }}
          className="!bg-background focus-visible:!bg-muted focus-visible:mb-2 focus-visible:ring-1  border-none !pointer-events-auto text-base focus-visible:px-2 px-0 !py-1 !h-fit font-semibold truncate overflow-clip"
        />
        {/* <h1 className="text-base font-semibold truncate overflow-clip">
          {file.name}
        </h1> */}
        <p className="text-sm uppercase text-muted-foreground">
          {file.name.match(/([^.]+)$/g)[0]}
          <span className="mx-1"> ● </span>
          {formatBytes(file.size)}
        </p>
        <div className="mt-1 flex items-center gap-x-2 [&_*]:!pointer-events-auto">
          <Checkbox
            id={checkboxId}
            checked={isPublic}
            onCheckedChange={(val) => {
              onUpdate(id, {
                isPublic: val,
              });
            }}
          />
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Public
          </label>
        </div>
      </div>
      <div className="flex items-center gap-x-0 [&_*]:!pointer-events-auto">
        {/* {isNew && progress && (
          <Button
            variant="ghost"
            size="icon"
            className=" !p-2 size-auto"
            onClick={() => uploadFile(file)}
          >
            <RefreshCw className="!size-5" />
          </Button>
        )} */}
        <Button
          variant="ghost"
          size="icon"
          className="hover:text-red-500 !p-2 size-auto"
          onClick={() => removeFile(id)}
        >
          <Trash2 className="!size-5" />
        </Button>
      </div>
    </div>
  );
}

export default FileItem;
