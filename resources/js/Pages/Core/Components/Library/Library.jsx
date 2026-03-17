import { forwardRef, useCallback, useState } from "react";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/Components/ui/button";
import FolderItem from "./FolderItem";
import { Input } from "@/Components/ui/input";
import { LibraryContext } from "./hooks";
import LoadingIcon from "@/Components/LoadingIcon";
import QueryString from "qs";
import axios from "axios";
import { isNullOrWhitespace } from "@/lib/utils";
import useDidMountEffect from "@/Hooks/useDidMountEffect";

const Library = forwardRef(function Library(
  {
    setMenu,
    checklistFile,
    setChecklistFile: _setChecklistFile,
    single,
    imageOnly,
  },
  ref,
) {
  const [search, setSearch] = useState("");
  const route = window.route;
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const setChecklistFile = useCallback(
    (idFile, val) => {
      let filesId = [];
      if (single) {
        filesId = new Set([idFile]);
      } else {
        filesId = new Set(checklistFile);
        if (!val) {
          filesId.delete(idFile);
        } else {
          filesId.add(idFile);
        }
      }
      _setChecklistFile(filesId);
    },
    [checklistFile],
  );

  const searchFiles = useCallback((search) => {
    setIsLoading(true);
    axios
      .get(
        `${route("files.index")}?${QueryString.stringify({
          search,
        })}`,
      )
      .then((res) => {
        setFiles(res.data ?? []);
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);
  useDidMountEffect(() => {
    const debounce = setTimeout(() => {
      if (isNullOrWhitespace(search)) {
        setFiles([]);
        return;
      }
      searchFiles(search);
    }, 500);
    return () => clearTimeout(debounce);
  }, [search]);
  return (
    <LibraryContext.Provider
      value={{
        search,
        resultSearch: files,
        checklistFile,
        setChecklistFile,
        imageOnly,
      }}
    >
      <div
        ref={ref}
        className="flex flex-col items-start overflow-y-auto gap-y-2"
      >
        <Button
          variant="ghost"
          className="px-2 py-1! size-auto"
          onClick={() => setMenu("home")}
        >
          <ArrowLeft /> Back
        </Button>
        <div className="w-full px-1">
          <Input
            placeholder="Search by filename or extension"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full px-2">
          {isLoading ? (
            <div className="text-base! font-normal text-foreground flex gap-x-4 items-center">
              <LoadingIcon className="size-4" />
              <span>Loading ...</span>
            </div>
          ) : (
            <FolderItem isRoot={true} key="root" />
          )}
        </div>
      </div>
    </LibraryContext.Provider>
  );
});

export default Library;
