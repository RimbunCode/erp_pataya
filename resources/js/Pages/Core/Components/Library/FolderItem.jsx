import {
  AccordionContent,
  AccordionItem,
  AccordionTriggerCustom,
} from "@/Components/ui/accordion";
import { Folder, FolderOpen } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";

import FileItems from "./FileItems";
import LoadingIcon from "@/Components/LoadingIcon";
import QueryString from "qs";
import axios from "axios";
import { isNullOrWhitespace } from "@/lib/utils";
import { useLibrary } from "./hooks";

export default memo(function FolderItem({ id, name, open, isRoot }) {
  const route = window.route;
  const [_files, _setFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const { search, resultSearch, imageOnly } = useLibrary();
  const [isLoading, setIsLoading] = useState(isNullOrWhitespace(search));

  const loadFiles = useCallback(() => {
    setIsLoading(true);
    axios
      .get(
        `${route("files.index")}?${QueryString.stringify({
          folder: id,
          imageOnly: imageOnly ?? false,
        })}`,
      )
      .then((res) => {
        _setFiles(res.data ?? []);
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // refresh data when folder is opened
  useEffect(() => {
    if (
      isNullOrWhitespace(search) &&
      resultSearch.length <= 0 &&
      (open || isRoot)
    ) {
      loadFiles();
    }
  }, [open]);

  // refresh data when search is changed
  useEffect(() => {
    if (isNullOrWhitespace(search) && resultSearch.length <= 0 && isRoot) {
      loadFiles();
    }
  }, [search, resultSearch]);

  // set source files when search is changed
  useEffect(() => {
    setFiles(
      resultSearch.length > 0
        ? resultSearch.filter((x) => x.folder_id == (isRoot ? null : id))
        : _files,
    );
  }, [resultSearch, _files]);

  if (isRoot) {
    return isLoading ? (
      <div className="!text-base font-normal text-foreground flex gap-x-4 items-center">
        <LoadingIcon className="size-4" />
        <span>Loading ...</span>
      </div>
    ) : (
      <FileItems files={files} />
    );
  }
  return (
    <AccordionItem value={id} className="border-b last:border-b-0">
      <AccordionTriggerCustom asChild>
        <div className="flex gap-x-2 group cursor-pointer !py-2 text-sm [&>svg]:size-5 data-[state=open]:border-b">
          <Folder className="group-[[data-state=open]]:hidden" />
          <FolderOpen className="group-[[data-state=closed]]:hidden" />
          {name}
        </div>
      </AccordionTriggerCustom>
      <AccordionContent className="[&>div>div]:pl-8 !pb-0">
        {isLoading ? (
          <div className="!text-base font-normal text-foreground flex gap-x-4 items-center">
            <LoadingIcon className="size-4" />
            <span>Loading ...</span>
          </div>
        ) : (
          <FileItems files={files} folderId={id} />
        )}
      </AccordionContent>
    </AccordionItem>
  );
});
