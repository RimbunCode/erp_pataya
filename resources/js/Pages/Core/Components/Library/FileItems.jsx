import { ExternalLink, FileTextIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { Accordion } from "@/Components/ui/accordion";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/Checkbox";
import FolderItem from "./FolderItem";
import React from "react";
import { useLibrary } from "./hooks";

export default memo(function FileItems({ files, folderId = null }) {
  const route = window.route;
  const { resultSearch } = useLibrary();
  const [openedFolders, setOpenedFolders] = useState([]);
  const { checklistFile, setChecklistFile } = useLibrary();

  // set open all folders when search
  useEffect(() => {
    if (resultSearch.length <= 0) {
      setOpenedFolders([]);
      return;
    }
    const folders = resultSearch
      .filter((x) => x.mime_type == "folder" && x.folder_id == folderId)
      .map((x) => x.id);
    setOpenedFolders(folders);
  }, [resultSearch]);

  if (files.length <= 0) {
    return (
      <div className="pl-8 flex gap-x-2 group  !py-2 text-sm [&>svg]:size-5 data-[state=open]:border-b">
        No files found
      </div>
    );
  }
  return (
    <Accordion
      type="multiple"
      value={openedFolders}
      onValueChange={setOpenedFolders}
    >
      {files.map((file) => {
        if (file.mime_type == "folder") {
          return (
            <FolderItem
              key={file.id}
              {...file}
              open={openedFolders.some((x) => x == file.id)}
            />
          );
        } else {
          return (
            <div
              className="border-b last:border-b-0"
              key={file.id}
              value={file.id}
            >
              <div className="flex items-center gap-x-2 group">
                <Checkbox
                  id={file.id + "checkbox"}
                  checked={checklistFile.has(file.id)}
                  onCheckedChange={(val) => setChecklistFile(file.id, val)}
                />
                <label
                  htmlFor={file.id + "checkbox"}
                  className="flex  items-center overflow-hidden  !py-2 text-sm [&>svg]:size-5 font-normal transition-all hover:underline gap-x-2 group cursor-pointer"
                >
                  <FileTextIcon />
                  <span className="truncate">{file.fullname}</span>
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-auto !p-2 -ml-1 opacity-0 group-hover:opacity-100 transition duration-300 ease-in-out"
                  asChild
                >
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={route("files.show", file.id)}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          );
        }
      })}
    </Accordion>
  );
});
