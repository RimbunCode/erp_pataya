import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import React from "react";
import useDidMountEffect from "@/Hooks/useDidMountEffect";

function ColumnsFilter({ columns: initColumn, onApply, open }) {
  const [columns, setColumns] = React.useState(initColumn);

  useDidMountEffect(() => {
    if (open) setColumns(initColumn);
  }, [open]);
  const _onApply = () => {
    onApply(columns);
  };
  return (
    <DialogContent className="max-w-full sm:max-w-sm w-fit min-w-64">
      <DialogHeader>
        <DialogTitle>Select Column</DialogTitle>
        <DialogDescription className="sr-only">Select Column</DialogDescription>
      </DialogHeader>
      {columns.map(({ name, title, show }) => (
        <div key={name} className="flex items-center space-x-2">
          <Checkbox
            id={name + "-checkbox"}
            checked={show}
            onCheckedChange={(val) => {
              setColumns((x) => {
                return x.map((y) => {
                  if (y.name === name) {
                    return { ...y, show: val };
                  }
                  return y;
                });
              });
            }}
          />
          <label
            htmlFor={name + "-checkbox"}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {title}
          </label>
        </div>
      ))}
      <DialogFooter className="flex justify-end">
        <Button className="h-8 !px-2" onClick={_onApply}>
          Apply
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default ColumnsFilter;
